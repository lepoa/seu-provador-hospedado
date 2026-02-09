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
  cartId: string;
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

    const { cartId }: ShippingLabelRequest = await req.json();

    if (!cartId) {
      return new Response(
        JSON.stringify({ error: "Cart ID é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch cart with customer and items
    const { data: cart, error: cartError } = await supabase
      .from("live_carts")
      .select(`
        *,
        live_customer:live_customers(*),
        items:live_cart_items(
          *,
          product:product_catalog(name, sku, weight_kg, length_cm, width_cm, height_cm)
        )
      `)
      .eq("id", cartId)
      .single();

    if (cartError || !cart) {
      console.error("Cart not found:", cartError);
      return new Response(
        JSON.stringify({ error: "Pedido não encontrado" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already has label
    if (cart.me_label_url) {
      return new Response(
        JSON.stringify({ 
          label_url: cart.me_label_url, 
          tracking_code: cart.shipping_tracking_code 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if we have shipping address with required fields
    const address = cart.shipping_address_snapshot;
    const requiredFields = ['name', 'phone', 'zip_code', 'street', 'number', 'neighborhood', 'city', 'state'];
    
    if (!address || !address.zip_code) {
      await supabase.from("live_carts").update({ 
        operational_status: 'pendencia_dados' 
      }).eq("id", cartId);

      return new Response(
        JSON.stringify({ 
          error: "Dados de envio incompletos",
          missing_fields: !address ? requiredFields : requiredFields.filter(f => !address[f] || address[f].trim() === '')
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check all required fields
    const missingFields = requiredFields.filter(f => !address[f] || String(address[f]).trim() === '');
    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: "Dados de envio incompletos",
          missing_fields: missingFields,
          details: `Campos faltando: ${missingFields.join(', ')}`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate package dimensions from items
    // Include ALL non-cancelled/non-removido items for shipping - even expirado items 
    // are part of a paid order and need to be shipped
    let totalWeight = 0;
    let maxLength = 20;
    let maxWidth = 15;
    let totalHeight = 0;

    // Items eligible for shipping: reservado, confirmado, expirado (was confirmed but timer expired after payment)
    // Exclude: cancelado, removido, substituido (these were explicitly removed from order)
    const shippableItems = cart.items?.filter((item: any) => 
      ['reservado', 'confirmado', 'expirado'].includes(item.status)
    ) || [];
    
    // Fallback: if no shippable items but cart is paid, use ALL items (edge case recovery)
    const itemsForShipment = shippableItems.length > 0 
      ? shippableItems 
      : (cart.items?.filter((item: any) => !['cancelado', 'removido'].includes(item.status)) || []);
    
    if (itemsForShipment.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "Nenhum item disponível para envio",
          details: "Todos os itens desta sacola foram cancelados ou removidos. Não é possível gerar etiqueta."
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    itemsForShipment.forEach((item: any) => {
      const product = item.product;
      const qty = item.qtd || 1;
      
      totalWeight += (product?.weight_kg || 0.3) * qty;
      maxLength = Math.max(maxLength, product?.length_cm || 30);
      maxWidth = Math.max(maxWidth, product?.width_cm || 20);
      totalHeight += (product?.height_cm || 5) * qty;
    });

    // Minimum dimensions
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
      postal_code: "75110760", // CEP correto: 75110-760
    };

    // Validate and sanitize recipient CPF
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
      console.error(`[CPF Error] Sender and recipient CPF are identical: ${recipientCpfMasked}`);
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

    console.log(`Creating shipment for cart ${cartId}, to: ${address.zip_code}`);

    // Step 1: Create shipment in Melhor Envio
    const createShipmentResponse = await fetch('https://melhorenvio.com.br/api/v2/me/cart', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${melhorEnvioToken}`,
        'User-Agent': 'LepoaApp/1.0'
      },
      body: JSON.stringify({
        service: 1, // PAC (cheapest option)
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
          name: cart.live_customer?.nome || address.name || "Cliente",
          phone: cart.live_customer?.whatsapp?.replace(/\D/g, '') || "",
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
        products: itemsForShipment.map((item: any, index: number) => ({
          name: item.product?.name || `Produto ${index + 1}`,
          quantity: item.qtd,
          unitary_value: item.preco_unitario
        })),
        volumes: [{
          height: Math.ceil(totalHeight),
          width: Math.ceil(maxWidth),
          length: Math.ceil(maxLength),
          weight: Math.round(totalWeight * 100) / 100
        }],
        options: {
          insurance_value: cart.total,
          receipt: false,
          own_hand: false,
          reverse: false,
          non_commercial: false,
          invoice: {
            key: ""
          },
          platform: "Lepoa App",
          tags: [{ tag: `sacola-${cart.bag_number}`, url: "" }]
        }
      })
    });

    const shipmentData = await createShipmentResponse.json();
    console.log("Create shipment response:", JSON.stringify(shipmentData));

    if (!createShipmentResponse.ok || shipmentData.error) {
      console.error("Melhor Envio create error:", shipmentData);
      return new Response(
        JSON.stringify({ error: "Erro ao criar envio no Melhor Envio", details: shipmentData }),
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
          .from("live_carts")
          .update({
            me_shipment_id: shipmentId,
            operational_status: 'aguardando_pagamento_frete',
            updated_at: new Date().toISOString()
          })
          .eq("id", cartId);
        
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

    // Step 4: Print label
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

    // ============= TRACKING EXTRACTION LOGIC (same as generate-order-shipping-label) =============
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
          console.log(`[generate-shipping-label] Found valid tracking in field '${field}': ${value}`);
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

    let trackingCode = "";
    
    // Step 5: Get tracking code - Method 1: Tracking endpoint
    try {
      console.log(`[generate-shipping-label] Fetching tracking for shipment ${shipmentId}`);
      const trackingResponse = await fetch(`https://melhorenvio.com.br/api/v2/me/shipment/tracking`, {
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
        console.log(`[generate-shipping-label] Fetching shipment details for ${shipmentId}`);
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
      console.log(`[generate-shipping-label] Rejected invalid tracking code: ${trackingCode}`);
      trackingCode = "";
    }
    
    console.log(`[generate-shipping-label] Final tracking code: ${trackingCode || "(not found - will sync later)"}`);

    // Update shipping_address_snapshot with tracking info for consistency
    const updatedAddressSnapshot = {
      ...address,
      tracking_code: trackingCode,
      me_label_url: labelUrl,
      me_shipment_id: shipmentId
    };

    // Update cart with label info AND linked order if exists
    const { error: updateError } = await supabase
      .from("live_carts")
      .update({
        me_shipment_id: shipmentId,
        me_label_url: labelUrl,
        shipping_tracking_code: trackingCode,
        shipping_address_snapshot: updatedAddressSnapshot,
        operational_status: 'etiqueta_gerada',
        updated_at: new Date().toISOString()
      })
      .eq("id", cartId);

    if (updateError) {
      console.error("Error updating cart:", updateError);
    }
    
    // IMPORTANT: Also update the linked orders table if there's an order_id
    if (cart.order_id) {
      console.log(`[generate-shipping-label] Syncing to linked order: ${cart.order_id}`);
      const { error: orderUpdateError } = await supabase
        .from("orders")
        .update({
          me_shipment_id: shipmentId,
          me_label_url: labelUrl,
          tracking_code: trackingCode,
          status: 'etiqueta_gerada',
          updated_at: new Date().toISOString()
        })
        .eq("id", cart.order_id);
        
      if (orderUpdateError) {
        console.error("Error updating linked order:", orderUpdateError);
      }
    }

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
