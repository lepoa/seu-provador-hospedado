import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Regex patterns
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_SITE_URL = "https://lepoa.online";

function normalizePublicSiteUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase();
    const isLocalHost =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1";

    if (url.protocol !== "https:" || isLocalHost) return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function resolveSiteUrl(req: Request): string {
  const envUrl = normalizePublicSiteUrl(Deno.env.get("SITE_URL"));
  if (envUrl) return envUrl;

  const originUrl = normalizePublicSiteUrl(req.headers.get("origin"));
  if (originUrl) return originUrl;

  const refererUrl = normalizePublicSiteUrl(req.headers.get("referer"));
  if (refererUrl) return refererUrl;

  return DEFAULT_SITE_URL;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[create-mp-preference] Iniciando execução...");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

    const API_URL = Deno.env.get("API_URL") || SUPABASE_URL || "https://seuprovador.supabase.co";

    if (!MERCADOPAGO_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Mercado Pago não configurado (Token ausente)", error_code: "CONFIG_MISSING" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Login necessário.", error_code: "UNAUTHORIZED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth check
    const supabaseAnon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await supabaseAnon.auth.getUser();

    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida.", error_code: "SESSION_INVALID" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Body Parsing
    let bodyText = "";
    try { bodyText = await req.text(); } catch (e) { }

    let requestBody;
    try {
      requestBody = JSON.parse(bodyText);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "JSON inválido.", error_code: "INVALID_JSON" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { order_id, payer_email } = requestBody;

    if (!order_id || !UUID_REGEX.test(order_id)) {
      return new Response(
        JSON.stringify({ error: "ID do pedido inválido.", error_code: "INVALID_ORDER_ID" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch Order
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*, items:order_items(*)")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Pedido não encontrado.", error_code: "ORDER_NOT_FOUND" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (order.status === "pago") {
      return new Response(
        JSON.stringify({ error: "Pedido já pago.", error_code: "ALREADY_PAID" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare Items
    const items = order.items || [];
    const productsSubtotal = items.reduce((sum: number, item: any) =>
      sum + (Number(item.product_price || 0) * Number(item.quantity || 1)), 0
    );
    const shippingFee = Number(order.shipping_fee || 0);
    const couponDiscount = Number(order.coupon_discount || 0);

    const mpItems = items.map((item: any) => ({
      title: String(item.product_name),
      quantity: Number(item.quantity),
      unit_price: Number(item.product_price),
      currency_id: "BRL",
      picture_url: item.image_url,
      description: `Tam: ${item.size} ${item.color ? '-' + item.color : ''}`,
    }));

    if (shippingFee > 0) {
      mpItems.push({
        title: "Frete",
        quantity: 1,
        unit_price: shippingFee,
        currency_id: "BRL",
        description: "Entrega"
      });
    }

    if (couponDiscount > 0) {
      mpItems.push({
        title: "Desconto",
        quantity: 1,
        unit_price: -couponDiscount,
        currency_id: "BRL",
        description: "Cupom aplicado"
      });
    }

    // Use environment/site origin for payment callbacks.
    const baseUrl = resolveSiteUrl(req);
    console.log(`[create-mp-preference] Using Base URL: ${baseUrl}`);

    const backUrls = {
      success: `${baseUrl}/pedido/sucesso?order_id=${order_id}`,
      failure: `${baseUrl}/pedido/erro?order_id=${order_id}`,
      pending: `${baseUrl}/pedido/pendente?order_id=${order_id}`,
    };

    const preferenceBody = {
      items: mpItems,
      payer: {
        email: payer_email || "cliente@lepoa.com.br",
      },
      metadata: {
        order_id: order_id,
        app_source: "le-poa-live",
      },
      back_urls: backUrls,
      auto_return: "approved",
      external_reference: order_id,
      notification_url: `${API_URL}/functions/v1/mp-webhook`,
    };

    console.log("[create-mp-preference] Criando preferência...", JSON.stringify(preferenceBody));

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`
      },
      body: JSON.stringify(preferenceBody)
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error("Erro MP:", mpData);
      const errorDetail = mpData.message || (mpData.cause && mpData.cause[0]?.description) || JSON.stringify(mpData);
      return new Response(
        JSON.stringify({
          error: `Mercado Pago: ${errorDetail}`,
          details: mpData,
          error_code: "MP_API_ERROR"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        preference_id: mpData.id,
        init_point: mpData.init_point,
        sandbox_init_point: mpData.sandbox_init_point,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[create-mp-preference] CRITICAL ERROR:", err);
    return new Response(
      JSON.stringify({ error: `Erro Crítico: ${err.message}`, error_code: "INTERNAL_CRASH" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
