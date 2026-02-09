import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CPF_REGEX = /^\d{11}$/;

interface CreateLivePaymentRequest {
  live_cart_id: string;
  public_token?: string;
  shipping_fee?: number;
  payer_email?: string;
  payer_name?: string;
  payer_phone?: string;
  payer_cpf?: string;
  customer_notes?: string;
}

interface LiveCartItem {
  id: string;
  product_id: string;
  variante: { cor?: string; tamanho?: string };
  qtd: number;
  preco_unitario: number;
  status: string;
  product?: { name: string; color?: string };
}

function errorResponse(code: string, message: string, status: number, field?: string, action?: string, details?: string) {
  console.error(`[ERROR] ${code}: ${message}`, { field, details });
  return new Response(
    JSON.stringify({ error_code: code, message, field, action, details }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!MERCADOPAGO_ACCESS_TOKEN) {
      return errorResponse("MP_UNAVAILABLE", "Mercado Pago não configurado no sistema", 500);
    }

    let requestBody: CreateLivePaymentRequest;
    try {
      requestBody = await req.json();
    } catch {
      return errorResponse("INVALID_JSON", "Corpo da requisição inválido", 400);
    }

    const { live_cart_id, public_token, shipping_fee, payer_email, payer_name, payer_phone, payer_cpf, customer_notes } = requestBody;

    if (!live_cart_id || !UUID_REGEX.test(live_cart_id)) {
      return errorResponse("REQUIRED_FIELD_MISSING", "ID do carrinho é obrigatório", 400, "live_cart_id");
    }

    // Auth: accept either Bearer token (authenticated) OR public_token (guest)
    const authHeader = req.headers.get("Authorization");
    let isGuest = false;

    if (public_token) {
      if (!UUID_REGEX.test(public_token)) {
        return errorResponse("INVALID_FORMAT", "Token inválido", 400, "public_token");
      }
      isGuest = true;
    } else if (authHeader?.startsWith("Bearer ")) {
      const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data, error } = await anonClient.auth.getUser();
      if (error || !data.user) {
        return errorResponse("UNAUTHORIZED", "Sessão inválida", 401);
      }
    } else {
      return errorResponse("UNAUTHORIZED", "Token ou autenticação necessários", 401);
    }

    if (payer_email && (typeof payer_email !== "string" || payer_email.length > 254 || !EMAIL_REGEX.test(payer_email))) {
      return errorResponse("INVALID_FORMAT", "Formato de email inválido", 400, "payer_email");
    }

    if (typeof shipping_fee !== "undefined" && shipping_fee !== null) {
      if (typeof shipping_fee !== "number" || !Number.isFinite(shipping_fee) || shipping_fee < 0 || shipping_fee > 5000) {
        return errorResponse("INVALID_FORMAT", "Valor de frete inválido (0-5000)", 400, "shipping_fee");
      }
    }

    console.log("Creating payment for live cart:", live_cart_id, { shipping_fee, payer_email, payer_name, isGuest });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch live cart with items and customer
    let cartQuery = supabase
      .from("live_carts")
      .select(`
        *,
        live_customer:live_customers(*),
        items:live_cart_items(
          *,
          product:product_catalog(id, name, color, image_url)
        )
      `)
      .eq("id", live_cart_id);

    if (isGuest) {
      cartQuery = cartQuery.eq("public_token", public_token!);
    }

    const { data: cart, error: cartError } = await cartQuery.single();

    if (cartError || !cart) {
      console.error("Cart not found:", cartError);
      return errorResponse("ORDER_NOT_FOUND", "Carrinho não encontrado", 404);
    }

    if (cart.status === "pago") {
      return errorResponse("CART_ALREADY_PAID", "Este carrinho já foi pago", 409);
    }

    const activeItems = (cart.items || []).filter(
      (item: LiveCartItem) => ["reservado", "confirmado"].includes(item.status)
    );

    if (activeItems.length === 0) {
      return errorResponse("CART_EMPTY", "Carrinho sem itens ativos", 400);
    }

    // Calculate values
    const productsSubtotal = activeItems.reduce(
      (sum: number, item: LiveCartItem) => sum + (Number(item.preco_unitario) * item.qtd), 0
    );
    const couponDiscount = Number(cart.coupon_discount || 0);
    const productsWithDiscount = Math.max(0, productsSubtotal - couponDiscount);
    const cartShippingFee = Number(cart.frete ?? 0);

    const tolerance = 0.02;
    if (typeof shipping_fee === "number" && Math.abs(shipping_fee - cartShippingFee) > tolerance) {
      return errorResponse("SHIPPING_MISMATCH", "O frete do carrinho mudou. Recarregue a página.", 409, "shipping_fee");
    }

    const finalShippingFee = cartShippingFee;
    const calculatedTotal = productsWithDiscount + finalShippingFee;

    console.log("=== LIVE CART VALUE CALCULATION ===", { productsSubtotal, couponDiscount, productsWithDiscount, finalShippingFee, calculatedTotal });

    if (calculatedTotal <= 0) {
      return errorResponse("ORDER_ZERO_TOTAL", "O total do pedido é zero ou negativo", 400);
    }

    const cartTotal = Number(cart.total ?? 0);
    if (cartTotal > 0 && Math.abs(cartTotal - calculatedTotal) > tolerance) {
      return errorResponse("CART_TOTAL_MISMATCH", "Inconsistência no total. Recarregue a página.", 409);
    }

    // Update cart values
    const cartUpdateData: Record<string, unknown> = {
      frete: finalShippingFee,
      subtotal: productsSubtotal,
      total: calculatedTotal,
    };
    if (customer_notes) cartUpdateData.customer_checkout_notes = customer_notes;

    await supabase.from("live_carts").update(cartUpdateData).eq("id", live_cart_id);

    // Build rich payer info from checkout data + cart customer
    const customer = cart.live_customer;
    const resolvedName = payer_name || customer?.nome || customer?.instagram_handle || "";
    const resolvedPhone = payer_phone || customer?.whatsapp?.replace(/\D/g, "") || "";
    const resolvedEmail = payer_email || "";
    const resolvedCpf = payer_cpf?.replace(/\D/g, "") || "";
    const addressSnapshot = cart.shipping_address_snapshot as Record<string, unknown> | null;
    const addressCpf = (addressSnapshot?.document as string || "").replace(/\D/g, "");
    const finalCpf = resolvedCpf || addressCpf;

    // Build payer object with complete identification for anti-fraud
    const payerObj: Record<string, unknown> = {
      name: resolvedName,
      email: resolvedEmail || undefined,
      phone: resolvedPhone ? { area_code: resolvedPhone.substring(0, 2), number: resolvedPhone.substring(2) } : undefined,
    };

    // Add CPF identification to reduce anti-fraud rejections
    if (finalCpf && CPF_REGEX.test(finalCpf)) {
      payerObj.identification = { type: "CPF", number: finalCpf };
    }

    // Build address if available
    if (addressSnapshot?.zip_code) {
      payerObj.address = {
        zip_code: (addressSnapshot.zip_code as string).replace(/\D/g, ""),
        street_name: addressSnapshot.street || "",
        street_number: addressSnapshot.number || "S/N",
        neighborhood: addressSnapshot.neighborhood || "",
        city: addressSnapshot.city || "",
        federal_unit: addressSnapshot.state || "",
      };
    }

    const mpItems: any[] = [
      { id: "products", title: "Produtos", quantity: 1, unit_price: Number(productsWithDiscount.toFixed(2)), currency_id: "BRL" },
    ];
    if (finalShippingFee > 0) {
      mpItems.push({ id: "shipping", title: "Frete", quantity: 1, unit_price: Number(finalShippingFee.toFixed(2)), currency_id: "BRL" });
    }

    const mpTotal = mpItems.reduce((sum: number, item: any) => sum + item.unit_price * item.quantity, 0);
    if (Math.abs(mpTotal - calculatedTotal) > tolerance) {
      return errorResponse("MP_TOTAL_MISMATCH", "Falha interna ao preparar o pagamento", 500);
    }

    const baseUrl = SUPABASE_URL.replace("/rest/v1", "");
    const siteUrl = "https://seuprovador.lovable.app";

    const preferencePayload: Record<string, unknown> = {
      items: mpItems,
      external_reference: `live_cart:${live_cart_id}`,
      notification_url: `${baseUrl}/functions/v1/mp-webhook`,
      back_urls: {
        success: `${siteUrl}/pedido/sucesso?live_cart_id=${live_cart_id}`,
        pending: `${siteUrl}/pedido/pendente?live_cart_id=${live_cart_id}`,
        failure: `${siteUrl}/pedido/erro?live_cart_id=${live_cart_id}`,
      },
      auto_return: "approved",
      payer: payerObj,
      statement_descriptor: "PROVADOR VIP LIVE",
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      // Enable all payment methods including PIX
      payment_methods: {
        excluded_payment_types: [],
        installments: 12,
      },
    };

    console.log("Creating MP preference with payer:", JSON.stringify({
      items_count: mpItems.length,
      calculated_total: calculatedTotal,
      has_email: !!resolvedEmail,
      has_cpf: !!finalCpf,
      has_phone: !!resolvedPhone,
      has_address: !!addressSnapshot?.zip_code,
    }));

    let mpResponse: Response;
    try {
      mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}` },
        body: JSON.stringify(preferencePayload),
      });
    } catch (networkError) {
      return errorResponse("MP_NETWORK_ERROR", "Falha de conexão com Mercado Pago. Tente novamente.", 503);
    }

    const contentType = mpResponse.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return errorResponse("MP_INVALID_RESPONSE", "Resposta inválida do Mercado Pago", 502);
    }

    let mpData: any;
    try {
      mpData = await mpResponse.json();
    } catch {
      return errorResponse("MP_PARSE_ERROR", "Erro ao processar resposta do Mercado Pago", 502);
    }

    // Log full MP response for diagnostics
    console.log("MP Preference response:", JSON.stringify({
      ok: mpResponse.ok,
      status: mpResponse.status,
      preference_id: mpData?.id,
      init_point: mpData?.init_point ? "present" : "missing",
      error: mpData?.message || mpData?.error,
      cause: mpData?.cause,
    }));

    if (!mpResponse.ok) {
      console.error("MP API Error (full):", JSON.stringify(mpData));

      // Log the error to mp_payment_events for diagnostics
      try {
        await supabase.from("mp_payment_events").insert({
          live_cart_id: live_cart_id,
          mp_preference_id: null,
          event_type: "preference_creation_error",
          mp_status: "error",
          mp_status_detail: mpData?.message || `HTTP ${mpResponse.status}`,
          amount: calculatedTotal,
          processing_result: "error",
          error_message: JSON.stringify(mpData),
          payload: { preference_payload: preferencePayload, mp_response: mpData },
          received_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
        });
      } catch (logErr) {
        console.error("Failed to log MP error:", logErr);
      }

      if (mpResponse.status === 429) return errorResponse("MP_RATE_LIMITED", "Muitas requisições. Aguarde.", 429);
      if (mpResponse.status === 401) return errorResponse("MP_AUTH_ERROR", "Token do Mercado Pago inválido", 500);
      return errorResponse("MP_API_ERROR", `Erro ao criar link: ${mpData.message || "Erro desconhecido"}`, 500);
    }

    console.log("MP Preference created successfully:", mpData.id);

    // Log successful preference creation
    try {
      await supabase.from("mp_payment_events").insert({
        live_cart_id: live_cart_id,
        mp_preference_id: mpData.id,
        event_type: "preference_created",
        mp_status: "created",
        mp_status_detail: "preference_ok",
        amount: calculatedTotal,
        processing_result: "success",
        error_message: null,
        payload: { preference_id: mpData.id, init_point: mpData.init_point, payer_enriched: { has_email: !!resolvedEmail, has_cpf: !!finalCpf, has_phone: !!resolvedPhone } },
        received_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
      });
    } catch (logErr) {
      console.error("Failed to log preference creation:", logErr);
    }

    await supabase.from("live_carts").update({
      mp_preference_id: mpData.id,
      mp_checkout_url: mpData.init_point,
      status: "aguardando_pagamento",
      subtotal: productsSubtotal,
      total: calculatedTotal,
      frete: finalShippingFee,
    }).eq("id", live_cart_id);

    await supabase.from("live_cart_items").update({ status: "confirmado" }).eq("live_cart_id", live_cart_id).in("status", ["reservado"]);

    return new Response(
      JSON.stringify({
        success: true,
        preference_id: mpData.id,
        init_point: mpData.init_point,
        sandbox_init_point: mpData.sandbox_init_point,
        calculated_total: calculatedTotal,
        products_subtotal: productsSubtotal,
        coupon_discount: couponDiscount,
        shipping_fee: finalShippingFee,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return errorResponse("INTERNAL_ERROR", "Erro interno do servidor", 500, undefined, "Tente novamente.", error instanceof Error ? error.message : undefined);
  }
});
