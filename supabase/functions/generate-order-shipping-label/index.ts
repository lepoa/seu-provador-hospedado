import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function requireAuth(req: Request): Promise<{ userId: string; error?: undefined } | { userId?: undefined; error: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { error: new Response(JSON.stringify({ error: "Sessão inválida" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }
  return { userId: data.user.id };
}

interface ShippingLabelRequest {
  orderId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const melhorEnvioToken = Deno.env.get('MELHOR_ENVIO_TOKEN');
    if (!melhorEnvioToken) {
      console.error("Missing MELHOR_ENVIO_TOKEN secret");
      return new Response(
        JSON.stringify({ error: "Configuração de envio não encontrada" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and sanitize store CPF (must be exactly 11 digits)
    const storeCpf = (Deno.env.get('LEPOA_STORE_CPF') || "").replace(/\D/g, '');
    const storeCpfMasked = storeCpf.length > 2 ? `***${storeCpf.slice(-2)}` : '(vazio)';
    console.log(`[CPF Validation] Store CPF: length=${storeCpf.length}, masked=${storeCpfMasked}`);
    
    if (storeCpf.length !== 11) {
      console.error(`[CPF Error] Store CPF invalid: expected 11 digits, got ${storeCpf.length}`);
      return new Response(
        JSON.stringify({ 
          error: "CPF da loja inválido", 
          details: `O secret LEPOA_STORE_CPF deve conter um CPF válido com 11 dígitos (atual: ${storeCpf.length} dígitos)`
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { orderId }: ShippingLabelRequest = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "Order ID é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[generate-order-shipping-label] Processing order: ${orderId}`);

    // Fetch order with items
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        items:order_items(
          product_id,
          product_name,
          product_price,
          quantity,
          size,
          color
        )
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Order not found:", orderError);
      return new Response(
        JSON.stringify({ error: "Pedido não encontrado" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already has label - check me_label_url, tracking_code, and shipping_status
    const hasExistingLabel = order.me_label_url || 
                              order.tracking_code || 
                              order.shipping_status === 'etiqueta_gerada';
    
    if (hasExistingLabel) {
      console.log(`[generate-order-shipping-label] Label already exists for order ${orderId}`, {
        me_label_url: order.me_label_url,
        tracking_code: order.tracking_code,
        shipping_status: order.shipping_status
      });
      return new Response(
        JSON.stringify({ 
          error: "Etiqueta já foi gerada para este pedido",
          label_url: order.me_label_url, 
          tracking_code: order.tracking_code,
          shipping_status: order.shipping_status,
          already_generated: true
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate payment using paid_at as primary source of truth
    // IMPORTANT: paid_at != null means payment confirmed, regardless of status text
    const normalizedStatus = (order.status || '').toLowerCase().trim();
    const paidStatuses = ['pago', 'paid', 'approved', 'payment_approved'];
    const isPaidByStatus = paidStatuses.includes(normalizedStatus);
    const isPaidByTimestamp = order.paid_at !== null && order.paid_at !== undefined;
    const isPaid = isPaidByTimestamp || isPaidByStatus;
    
    console.log(`[Payment Check] Order ${orderId}:`, {
      status: order.status,
      normalizedStatus,
      paid_at: order.paid_at,
      isPaidByStatus,
      isPaidByTimestamp,
      finalIsPaid: isPaid
    });
    
    if (!isPaid) {
      return new Response(
        JSON.stringify({ 
          error: "Etiqueta só pode ser gerada para pedidos pagos",
          details: `Status atual: "${order.status}", paid_at: ${order.paid_at || 'null'}. Para gerar etiqueta, o pedido precisa estar pago (paid_at preenchido).`,
          current_status: order.status,
          paid_at: order.paid_at
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (order.delivery_method !== 'shipping') {
      return new Response(
        JSON.stringify({ error: "Etiqueta só pode ser gerada para pedidos com entrega via Correios" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if we have shipping address - handle both old and new address formats
    const rawAddress = order.address_snapshot as Record<string, string> | null;
    
    if (!rawAddress || !rawAddress.zip_code) {
      return new Response(
        JSON.stringify({ 
          error: "Dados de endereço incompletos",
          missing_fields: ['zip_code'],
          details: "CEP não encontrado no endereço"
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize address fields (handle both old format with address_line and new format with street/number)
    const address = {
      name: rawAddress.name || rawAddress.full_name || order.customer_name,
      zip_code: rawAddress.zip_code,
      street: rawAddress.street || parseStreet(rawAddress.address_line),
      number: rawAddress.number || parseNumber(rawAddress.address_line) || "S/N",
      complement: rawAddress.complement || parseComplement(rawAddress.address_line) || "",
      neighborhood: rawAddress.neighborhood || rawAddress.district || "",
      city: rawAddress.city,
      state: rawAddress.state,
      document: rawAddress.document || rawAddress.cpf || "",
      reference: rawAddress.reference || rawAddress.address_reference || ""
    };

    // Helper functions to parse address_line format like "Rua X, 123, complemento"
    function parseStreet(addressLine: string | undefined): string {
      if (!addressLine) return "";
      const parts = addressLine.split(',');
      return parts[0]?.trim() || addressLine;
    }

    function parseNumber(addressLine: string | undefined): string {
      if (!addressLine) return "";
      const parts = addressLine.split(',');
      if (parts.length > 1) {
        const numPart = parts[1]?.trim();
        // Check if it looks like a number
        if (numPart && /^\d+/.test(numPart)) {
          return numPart.match(/^\d+/)?.[0] || "";
        }
      }
      return "";
    }

    function parseComplement(addressLine: string | undefined): string {
      if (!addressLine) return "";
      const parts = addressLine.split(',');
      if (parts.length > 2) {
        return parts.slice(2).join(',').trim();
      }
      return "";
    }

    // Check minimum required fields
    const missingCoreFields: string[] = [];
    if (!address.zip_code) missingCoreFields.push('CEP');
    if (!address.city) missingCoreFields.push('Cidade');
    if (!address.state) missingCoreFields.push('Estado');
    
    if (missingCoreFields.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: "Dados de endereço incompletos",
          missing_fields: missingCoreFields,
          details: `Campos faltando: ${missingCoreFields.join(', ')}`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate package dimensions from items (with defaults)
    const items = order.items || [];
    let totalWeight = 0.3; // Default minimum weight
    const maxLength = 30; // cm
    const maxWidth = 20;  // cm
    let totalHeight = 5;  // cm minimum

    // Each item adds some weight and height
    items.forEach((item: { quantity: number }) => {
      totalWeight += 0.3 * (item.quantity || 1);
      totalHeight += 5 * (item.quantity || 1);
    });

    // Ensure minimums
    totalWeight = Math.max(totalWeight, 0.3);
    totalHeight = Math.max(totalHeight, 5);

    // Store origin (Anápolis, GO) - Endereço correto da Le.Poá
    const storeConfig = {
      name: "Le.Poá",
      phone: "62991223519",
      email: "contato@lepoa.com.br",
      address: "Rua Luiz França",
      number: "65",
      complement: "qd 32 lote 20",
      district: "Jundiaí",
      city: "Anápolis",
      state: "GO",
      postal_code: "75110760",
    };

    // Validate and sanitize recipient CPF (already normalized in address object)
    const recipientCpf = (address.document || "").replace(/\D/g, '');
    const recipientCpfMasked = recipientCpf.length > 2 ? `***${recipientCpf.slice(-2)}` : '(vazio)';
    console.log(`[CPF Validation] Recipient CPF: length=${recipientCpf.length}, masked=${recipientCpfMasked}`);

    // Check if recipient CPF is missing or invalid
    if (!recipientCpf || recipientCpf.length !== 11) {
      console.error(`[CPF Error] Recipient CPF invalid: expected 11 digits, got ${recipientCpf.length}`);
      return new Response(
        JSON.stringify({ 
          error: "CPF do destinatário inválido ou ausente",
          details: `CPF do destinatário inválido ou ausente. Informe 11 dígitos. (Atual: ${recipientCpf.length} dígitos)`,
          missing_fields: ['document']
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if sender and recipient CPF are the same
    if (recipientCpf === storeCpf) {
      console.error(`[CPF Error] Sender and recipient CPF are identical`);
      return new Response(
        JSON.stringify({ 
          error: "CPF do remetente e destinatário são iguais",
          details: "O CPF do cliente não pode ser o mesmo CPF da loja. Por favor, atualize o CPF do cliente."
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CPF Validation] Both CPFs validated successfully. From: ${storeCpfMasked}, To: ${recipientCpfMasked}`);
    console.log(`[Remetente] ${storeConfig.name} - ${storeConfig.address}, ${storeConfig.number} - ${storeConfig.district}, ${storeConfig.city}/${storeConfig.state} - CEP: ${storeConfig.postal_code}`);
    console.log(`Creating shipment for order ${orderId}, to: ${address.zip_code}`);

    // Step 0: Check available shipping services for this route
    const quotePayload = {
      from: { postal_code: storeConfig.postal_code },
      to: { postal_code: address.zip_code.replace(/\D/g, '') },
      products: items.map((item: { product_name: string; quantity: number; product_price: number }, index: number) => ({
        id: `item-${index}`,
        width: Math.ceil(maxWidth),
        height: Math.ceil(totalHeight / Math.max(items.length, 1)),
        length: Math.ceil(maxLength),
        weight: Math.round((totalWeight / Math.max(items.length, 1)) * 100) / 100,
        insurance_value: item.product_price || 0,
        quantity: item.quantity || 1
      }))
    };

    console.log(`[Quote] Checking available services from ${storeConfig.postal_code} to ${address.zip_code.replace(/\D/g, '')}`);

    const quoteResponse = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/calculate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${melhorEnvioToken}`,
        'User-Agent': 'LepoaApp/1.0'
      },
      body: JSON.stringify(quotePayload)
    });

    const quoteData = await quoteResponse.json();
    console.log("Quote response:", JSON.stringify(quoteData));

    // Filter available services (no errors)
    const availableServices = Array.isArray(quoteData) 
      ? quoteData.filter((s: { error?: string }) => !s.error)
      : [];

    if (availableServices.length === 0) {
      // Check if it's a local route issue
      const originPrefix = storeConfig.postal_code.slice(0, 5);
      const destPrefix = address.zip_code.replace(/\D/g, '').slice(0, 5);
      
      const isLocalRoute = originPrefix === destPrefix;
      
      const errorMessage = isLocalRoute
        ? "Correios não faz entregas locais (mesmo CEP/região). Para Anápolis, use a opção Motoboy."
        : "Nenhuma transportadora atende este trecho. Verifique o CEP de destino ou entre em contato com o suporte.";
      
      console.error(`[Route Error] No available services. Local route: ${isLocalRoute}, Origin: ${storeConfig.postal_code}, Dest: ${address.zip_code}`);
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          details: {
            origin: storeConfig.postal_code,
            destination: address.zip_code,
            is_local_route: isLocalRoute,
            available_services: 0
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Pick the cheapest available service
    const selectedService = availableServices.reduce((cheapest: { price: number; id: number; name: string }, current: { price: number; id: number; name: string }) => 
      parseFloat(String(current.price)) < parseFloat(String(cheapest.price)) ? current : cheapest
    );

    console.log(`[Service] Selected: ${selectedService.name} (ID: ${selectedService.id}) - R$ ${selectedService.price}`);

    // Step 1: Create shipment in Melhor Envio with available service
    const createShipmentResponse = await fetch('https://melhorenvio.com.br/api/v2/me/cart', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${melhorEnvioToken}`,
        'User-Agent': 'LepoaApp/1.0'
      },
      body: JSON.stringify({
        service: selectedService.id,
        agency: null,
        from: {
          name: storeConfig.name,
          phone: storeConfig.phone,
          email: storeConfig.email,
          document: storeCpf,
          company_document: "",
          state_register: "",
          address: storeConfig.address,
          complement: storeConfig.complement,
          number: storeConfig.number,
          district: storeConfig.district,
          city: storeConfig.city,
          country_id: "BR",
          postal_code: storeConfig.postal_code,
          note: ""
        },
        to: {
          name: address.name || order.customer_name || "Cliente",
          phone: order.customer_phone?.replace(/\D/g, '') || "",
          email: "",
          document: recipientCpf,
          company_document: "",
          state_register: "",
          address: address.street,
          complement: address.complement || "",
          number: address.number || "S/N",
          district: address.neighborhood || "",
          city: address.city,
          state_abbr: address.state,
          country_id: "BR",
          postal_code: address.zip_code.replace(/\D/g, ''),
          note: address.reference || ""
        },
        products: items.map((item: { product_name: string; quantity: number; product_price: number }, index: number) => ({
          name: item.product_name || `Produto ${index + 1}`,
          quantity: item.quantity || 1,
          unitary_value: item.product_price || 0
        })),
        volumes: [{
          height: Math.ceil(totalHeight),
          width: Math.ceil(maxWidth),
          length: Math.ceil(maxLength),
          weight: Math.round(totalWeight * 100) / 100
        }],
        options: {
          insurance_value: order.total,
          receipt: false,
          own_hand: false,
          reverse: false,
          non_commercial: false,
          invoice: {
            key: ""
          },
          platform: "Lepoa App",
          tags: [{ tag: `pedido-${order.id.slice(0, 8).toUpperCase()}`, url: "" }]
        }
      })
    });

    const shipmentData = await createShipmentResponse.json();
    console.log("Create shipment response:", JSON.stringify(shipmentData));

    if (!createShipmentResponse.ok || shipmentData.error) {
      console.error("Melhor Envio create error:", shipmentData);
      return new Response(
        JSON.stringify({ 
          error: "Erro ao criar envio no Melhor Envio", 
          details: shipmentData,
          selected_service: selectedService.name
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const shipmentId = shipmentData.id;

    // Step 2: Checkout (pay for the shipment using Melhor Envio balance)
    const checkoutResponse = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/checkout', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${melhorEnvioToken}`,
        'User-Agent': 'LepoaApp/1.0'
      },
      body: JSON.stringify({
        orders: [shipmentId]
      })
    });

    const checkoutData = await checkoutResponse.json();
    console.log("Checkout response:", JSON.stringify(checkoutData));

    if (!checkoutResponse.ok) {
      console.error("Melhor Envio checkout error:", checkoutData);
      
      // Check for insufficient balance error
      const errorMessage = checkoutData?.error || JSON.stringify(checkoutData);
      const isBalanceError = errorMessage.toLowerCase().includes('saldo') || 
                             errorMessage.toLowerCase().includes('insuficiente') ||
                             errorMessage.toLowerCase().includes('carteira');
      
      if (isBalanceError) {
        // Save the shipment ID so user can pay manually later
        await supabase
          .from("orders")
          .update({
            me_shipment_id: shipmentId,
            status: 'aguardando_pagamento_frete',
            updated_at: new Date().toISOString()
          })
          .eq("id", orderId);
        
        return new Response(
          JSON.stringify({ 
            error: "Saldo insuficiente no Melhor Envio",
            details: "Sem saldo na carteira do Melhor Envio para comprar a etiqueta. Recarregue a carteira em melhorenvio.com.br e tente novamente.",
            shipment_id: shipmentId,
            action: "recharge_wallet",
            wallet_url: "https://melhorenvio.com.br/painel/carteira"
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Erro ao confirmar envio", details: checkoutData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Generate label
    const generateLabelResponse = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/generate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${melhorEnvioToken}`,
        'User-Agent': 'LepoaApp/1.0'
      },
      body: JSON.stringify({
        orders: [shipmentId]
      })
    });

    const labelData = await generateLabelResponse.json();
    console.log("Generate label response:", JSON.stringify(labelData));

    // Step 4: Print label (get public URL)
    const printLabelResponse = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/print', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${melhorEnvioToken}`,
        'User-Agent': 'LepoaApp/1.0'
      },
      body: JSON.stringify({
        mode: "public",
        orders: [shipmentId]
      })
    });

    const printData = await printLabelResponse.json();
    console.log("Print label response:", JSON.stringify(printData));

    const labelUrl = printData.url || `https://melhorenvio.com.br/imprimir/${shipmentId}`;

    // Step 5: Get tracking code - Try multiple methods with VALIDATION
    // IMPORTANT: Only save real carrier tracking codes, NOT Melhor Envio internal IDs (ORD-...)
    let trackingCode = "";
    
    // Validation patterns for real carrier tracking codes
    const isCorreiosTracking = (code: string) => /^[A-Z]{2}\d{9}BR$/.test(code);
    const isNumericTracking = (code: string) => /^\d{8,20}$/.test(code);
    const isValidTrackingCode = (code: string) => {
      if (!code) return false;
      // Never accept Melhor Envio internal IDs
      if (code.startsWith('ORD-') || code.startsWith('ORD')) return false;
      // Must match Correios OR numeric (Jadlog, etc.) format
      return isCorreiosTracking(code) || isNumericTracking(code);
    };
    
    // Helper to extract tracking from nested object
    const extractTracking = (obj: Record<string, unknown>): string => {
      if (!obj || typeof obj !== 'object') return "";
      
      // Priority fields for tracking - authorization_code is Jadlog's real tracking!
      const trackingFields = [
        'tracking', 'tracking_code', 'tracking_number', 
        'authorization_code', // Jadlog uses this field for their tracking number
        'self_tracking', 'codigo_rastreio', 'objeto'
      ];
      
      for (const field of trackingFields) {
        const value = obj[field];
        if (typeof value === 'string' && isValidTrackingCode(value)) {
          console.log(`[generate-order-shipping-label] Found valid tracking in field '${field}': ${value}`);
          return value;
        }
      }
      
      // Check nested objects
      if (obj.shipment && typeof obj.shipment === 'object') {
        const nested = extractTracking(obj.shipment as Record<string, unknown>);
        if (nested) return nested;
      }
      
      // Check protocol as last resort (sometimes contains real tracking)
      const protocol = obj.protocol;
      if (typeof protocol === 'string' && isValidTrackingCode(protocol)) {
        return protocol;
      }
      
      return "";
    };
    
    // Method 1: Tracking endpoint
    try {
      const trackingResponse = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/tracking', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${melhorEnvioToken}`,
          'User-Agent': 'LepoaApp/1.0'
        },
        body: JSON.stringify({
          orders: [shipmentId]
        })
      });

      const trackingData = await trackingResponse.json();
      console.log("Tracking response:", JSON.stringify(trackingData));
      
      // Try to extract valid tracking from response
      const shipmentData = trackingData[shipmentId];
      if (shipmentData && typeof shipmentData === 'object') {
        trackingCode = extractTracking(shipmentData as Record<string, unknown>);
      }
      
      // Also try root level
      if (!trackingCode) {
        trackingCode = extractTracking(trackingData as Record<string, unknown>);
      }
    } catch (e) {
      console.error("Tracking endpoint error:", e);
    }
    
    // Method 2: If tracking not found, fetch shipment details directly
    if (!trackingCode) {
      try {
        console.log(`[Tracking Fallback] Fetching shipment details for ${shipmentId}`);
        const shipmentDetailResponse = await fetch(`https://melhorenvio.com.br/api/v2/me/orders/${shipmentId}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${melhorEnvioToken}`,
            'User-Agent': 'LepoaApp/1.0'
          }
        });
        
        const shipmentDetail = await shipmentDetailResponse.json();
        console.log("Shipment detail response:", JSON.stringify(shipmentDetail));
        
        trackingCode = extractTracking(shipmentDetail as Record<string, unknown>);
      } catch (e) {
        console.error("Shipment detail fetch error:", e);
      }
    }
    
    // Final validation - ensure we never save invalid tracking
    if (trackingCode && !isValidTrackingCode(trackingCode)) {
      console.log(`[Tracking] Rejected invalid tracking code: ${trackingCode}`);
      trackingCode = "";
    }
    
    console.log(`[Tracking] Final tracking code: ${trackingCode || "(not found - tracking_not_found)"}`);

    // Update address_snapshot with tracking info
    const updatedAddressSnapshot = {
      ...rawAddress,
      tracking_code: trackingCode,
      me_label_url: labelUrl,
      me_shipment_id: shipmentId
    };

    // Update order with label info and tracking in snapshot
    // IMPORTANT: Do NOT change orders.status - use shipping_status for shipping state
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        me_shipment_id: shipmentId,
        me_label_url: labelUrl,
        tracking_code: trackingCode,
        // DO NOT SET status: 'etiqueta_gerada' - payment status must remain intact
        // Use dedicated shipping_status field instead
        shipping_status: 'etiqueta_gerada',
        shipping_label_generated_at: new Date().toISOString(),
        address_snapshot: updatedAddressSnapshot,
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("Error updating order:", updateError);
    }

    console.log(`[generate-order-shipping-label] Label generated successfully for order ${orderId}: ${labelUrl}, tracking: ${trackingCode}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        label_url: labelUrl,
        tracking_code: trackingCode,
        shipment_id: shipmentId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Shipping label generation error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao gerar etiqueta" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
