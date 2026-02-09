import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

interface OrderItem {
  id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  size: string;
  color?: string;
}

interface CreatePreferenceRequest {
  order_id: string;
  payer_email?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!MERCADOPAGO_ACCESS_TOKEN) {
      console.error("Missing MERCADOPAGO_ACCESS_TOKEN");
      return new Response(
        JSON.stringify({ error: "Mercado Pago não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let requestBody: CreatePreferenceRequest;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Corpo da requisição inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { order_id, payer_email } = requestBody;

    if (!order_id || typeof order_id !== "string") {
      return new Response(
        JSON.stringify({ error: "order_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // UUID format validation
    if (!UUID_REGEX.test(order_id)) {
      return new Response(
        JSON.stringify({ error: "order_id formato inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payer_email) {
      if (typeof payer_email !== "string" || payer_email.length > 254 || !EMAIL_REGEX.test(payer_email)) {
        return new Response(
          JSON.stringify({ error: "Formato de email inválido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      console.error("Order not found:", orderError);
      return new Response(
        JSON.stringify({ error: "Pedido não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch order items
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order_id);

    if (itemsError || !items || items.length === 0) {
      console.error("Order items not found:", itemsError);
      return new Response(
        JSON.stringify({ error: "Itens do pedido não encontrados" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === CRITICAL: Calculate values with precision ===
    // 1. Calculate products subtotal from items
    const productsSubtotal = items.reduce((sum: number, item: OrderItem) => 
      sum + (Number(item.product_price) * item.quantity), 0
    );

    // 2. Coupon discount applies ONLY to products (never to shipping)
    const couponDiscount = Number(order.coupon_discount || 0);
    const productsWithDiscount = Math.max(0, productsSubtotal - couponDiscount);

    // 3. Shipping fee is FIXED and immutable
    const shippingFee = Number(order.shipping_fee || 0);

    // 4. Final total = products with discount + shipping
    const calculatedTotal = productsWithDiscount + shippingFee;

    // Log calculation for debugging
    console.log("=== CHECKOUT VALUE CALCULATION ===");
    console.log("Products subtotal:", productsSubtotal);
    console.log("Coupon discount:", couponDiscount);
    console.log("Products after discount:", productsWithDiscount);
    console.log("Shipping fee (immutable):", shippingFee);
    console.log("Calculated total:", calculatedTotal);
    console.log("Order total in DB:", order.total);

    // Validate that our calculation matches the order total (with small tolerance for rounding)
    const orderTotal = Number(order.total || 0);
    const tolerance = 0.02; // 2 cents tolerance
    if (Math.abs(calculatedTotal - orderTotal) > tolerance) {
      console.error("VALUE MISMATCH DETECTED!", {
        calculated: calculatedTotal,
        inDatabase: orderTotal,
        difference: calculatedTotal - orderTotal
      });
      // Update order with correct calculated total
      await supabase
        .from("orders")
        .update({
          total: calculatedTotal,
          subtotal: productsSubtotal,
        })
        .eq("id", order_id);
    }

    // Build Mercado Pago items from individual products
    const mpItems = items.map((item: OrderItem) => ({
      id: item.id,
      title: `${item.product_name} - ${item.size}${item.color ? ` (${item.color})` : ""}`,
      quantity: item.quantity,
      unit_price: Number(item.product_price),
      currency_id: "BRL",
    }));

    // Add coupon discount as negative item if applicable
    if (couponDiscount > 0) {
      mpItems.push({
        id: "coupon_discount",
        title: `Desconto (Cupom)`,
        quantity: 1,
        unit_price: -couponDiscount, // Negative value for discount
        currency_id: "BRL",
      });
    }

    // Add shipping as separate item if applicable
    if (shippingFee > 0) {
      const shippingName = order.delivery_method === "motoboy" 
        ? "Frete Motoboy (Anápolis)" 
        : order.delivery_method === "pickup"
        ? "Retirada na Loja"
        : `Frete ${order.shipping_service || "Correios"}`;
      
      mpItems.push({
        id: "shipping",
        title: shippingName,
        quantity: 1,
        unit_price: shippingFee,
        currency_id: "BRL",
      });
    }

    // Verify total of MP items matches our calculation
    const mpTotal = mpItems.reduce((sum: number, item: any) => sum + (item.unit_price * item.quantity), 0);
    console.log("MP items total:", mpTotal);
    
    if (Math.abs(mpTotal - calculatedTotal) > tolerance) {
      console.error("MP ITEMS TOTAL MISMATCH!", {
        mpTotal,
        calculatedTotal,
        difference: mpTotal - calculatedTotal
      });
    }

    // Get the base URL for webhooks and redirects
    const baseUrl = Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "") || "";
    const siteUrl = "https://seuprovador.lovable.app";

    // Build preference payload
    const preferencePayload = {
      items: mpItems,
      external_reference: order_id,
      notification_url: `${baseUrl}/functions/v1/mp-webhook`,
      back_urls: {
        success: `${siteUrl}/pedido/sucesso?order_id=${order_id}`,
        pending: `${siteUrl}/pedido/pendente?order_id=${order_id}`,
        failure: `${siteUrl}/pedido/erro?order_id=${order_id}`,
      },
      auto_return: "approved",
      payer: {
        name: order.customer_name || "",
        email: payer_email || "",
        phone: {
          number: order.customer_phone?.replace(/\D/g, "") || "",
        },
      },
      statement_descriptor: "PROVADOR VIP",
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    console.log("Creating MP preference:", JSON.stringify({
      items_count: mpItems.length,
      calculated_total: calculatedTotal,
      external_reference: order_id,
    }));

    // Call Mercado Pago API with robust error handling
    let mpResponse: Response;
    try {
      mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        },
        body: JSON.stringify(preferencePayload),
      });
    } catch (networkError) {
      console.error("MP Network Error:", networkError);
      return new Response(
        JSON.stringify({ 
          error_code: "MP_NETWORK_ERROR",
          error: "Falha de conexão com Mercado Pago. Tente novamente.",
          details: networkError instanceof Error ? networkError.message : "Network error"
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate Content-Type before parsing JSON
    const contentType = mpResponse.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      const textResponse = await mpResponse.text();
      console.error("MP returned non-JSON response:", { 
        contentType, 
        status: mpResponse.status,
        preview: textResponse.substring(0, 500) 
      });
      
      if (textResponse.trim().startsWith("<!") || textResponse.includes("<html")) {
        return new Response(
          JSON.stringify({ 
            error_code: "MP_HTML_RESPONSE",
            error: "Mercado Pago retornou página de erro. Verifique a configuração.",
            details: `Status: ${mpResponse.status}, got HTML instead of JSON`
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error_code: "MP_INVALID_RESPONSE",
          error: "Resposta inválida do Mercado Pago",
          details: `Content-Type: ${contentType}, Status: ${mpResponse.status}`
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let mpData: any;
    try {
      mpData = await mpResponse.json();
    } catch (parseError) {
      console.error("MP JSON Parse Error:", parseError);
      return new Response(
        JSON.stringify({ 
          error_code: "MP_PARSE_ERROR",
          error: "Erro ao processar resposta do Mercado Pago",
          details: "Malformed JSON response"
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!mpResponse.ok) {
      console.error("MP API Error:", JSON.stringify(mpData));
      
      const mpMessage = mpData.message || mpData.error || "Erro desconhecido";
      const mpCause = mpData.cause?.[0]?.description || "";
      
      if (mpResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            error_code: "MP_RATE_LIMITED",
            error: "Muitas requisições ao Mercado Pago. Aguarde 30 segundos.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (mpResponse.status === 401) {
        return new Response(
          JSON.stringify({ 
            error_code: "MP_AUTH_ERROR",
            error: "Token do Mercado Pago inválido ou expirado",
            details: "Verifique a configuração do MERCADOPAGO_ACCESS_TOKEN"
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error_code: "MP_API_ERROR",
          error: `Erro Mercado Pago: ${mpMessage}`, 
          details: mpCause || mpData
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("MP Preference created:", mpData.id);

    // Save preference to database with expected amount
    const { error: paymentError } = await supabase.from("payments").insert({
      order_id,
      provider: "mercadopago",
      mp_preference_id: mpData.id,
      status: "created",
      amount_total: calculatedTotal, // Store the expected amount
    });

    if (paymentError) {
      console.error("Error saving payment:", paymentError);
    }

    // Update order with preference info and correct totals
    await supabase
      .from("orders")
      .update({
        mp_preference_id: mpData.id,
        mp_checkout_url: mpData.init_point,
        payment_status: "pending",
        status: "aguardando_pagamento",
        subtotal: productsSubtotal,
        total: calculatedTotal,
      })
      .eq("id", order_id);

    return new Response(
      JSON.stringify({
        success: true,
        preference_id: mpData.id,
        init_point: mpData.init_point,
        sandbox_init_point: mpData.sandbox_init_point,
        // Include calculated values for frontend verification
        calculated_total: calculatedTotal,
        products_subtotal: productsSubtotal,
        coupon_discount: couponDiscount,
        shipping_fee: shippingFee,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
