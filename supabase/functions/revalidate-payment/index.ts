import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RevalidateRequest {
  payment_id: string;
  order_id?: string; // Full UUID from frontend
}

// ========================================
// HELPER: Parse external_reference
// ========================================
interface ParsedRefLiveCart {
  type: "live_cart";
  id: string;
}

interface ParsedRefOrder {
  type: "order";
  ref_raw: string;
  ref_cleaned: string;
  uuid_candidate: string | null;
}

type ParsedRef = ParsedRefLiveCart | ParsedRefOrder;

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function parseExternalReference(ref: string): ParsedRef {
  const raw = (ref || "").replace(/\s+/g, "").trim();
  if (!raw) {
    return { type: "order", ref_raw: "", ref_cleaned: "", uuid_candidate: null };
  }

  if (raw.startsWith("live_cart:")) {
    return { type: "live_cart", id: raw.slice("live_cart:".length).trim() };
  }

  let cleaned = raw;
  if (cleaned.startsWith("#")) cleaned = cleaned.slice(1);
  if (cleaned.includes(":")) cleaned = cleaned.split(":")[0];

  const uuid_candidate = isUuidLike(cleaned) ? cleaned.toLowerCase() : null;
  const base = cleaned.split("-")[0] || cleaned;
  const ref_cleaned = base.toLowerCase();

  return {
    type: "order",
    ref_raw: cleaned,
    ref_cleaned,
    uuid_candidate,
  };
}

function logRevalidate(level: "info" | "error" | "warn", message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const prefix = `[REVALIDATE ${timestamp}]`;
  if (level === "error") {
    console.error(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : "");
  } else if (level === "warn") {
    console.warn(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : "");
  } else {
    console.log(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : "");
  }
}

// ========================================
// RESOLVE ORDER BY REFERENCE
// ========================================
async function resolveOrderByReference(
  supabase: any,
  parsedRef: ParsedRefOrder
): Promise<{ order: any | null; error: string | null; strategy_used: string | null }> {
  const selectFields = "id, status, payment_status, paid_at, total, payment_confirmed_amount, gateway";
  const { ref_cleaned, uuid_candidate } = parsedRef;

  logRevalidate("info", "Resolving order", { parsedRef });

  // Strategy A: Exact UUID match
  if (uuid_candidate) {
    logRevalidate("info", "Trying Strategy A: exact UUID match", { uuid_candidate });
    const { data, error } = await supabase
      .from("orders")
      .select(selectFields)
      .eq("id", uuid_candidate)
      .maybeSingle();

    if (error) {
      logRevalidate("warn", "Strategy A error", { error: error.message });
    }
    if (data) {
      logRevalidate("info", "✅ Resolved by Strategy A (exact UUID)", { id: data.id, status: data.status });
      return { order: data, error: null, strategy_used: "A_exact_uuid" };
    }
  }

  // Strategy B: UUID prefix match
  if (ref_cleaned && ref_cleaned.length >= 6) {
    logRevalidate("info", "Trying Strategy B: UUID prefix match", { prefix: ref_cleaned });
    const { data, error } = await supabase
      .from("orders")
      .select(selectFields)
      .ilike("id", `${ref_cleaned}%`)
      .limit(1);

    if (error) {
      logRevalidate("warn", "Strategy B error", { error: error.message });
    }
    if (data && data.length > 0) {
      logRevalidate("info", "✅ Resolved by Strategy B (UUID prefix)", { id: data[0].id, status: data[0].status });
      return { order: data[0], error: null, strategy_used: "B_uuid_prefix" };
    }
  }

  logRevalidate("error", "❌ Order not found with any strategy", { parsedRef });
  return {
    order: null,
    error: `Pedido não encontrado para: ${parsedRef.ref_raw || parsedRef.ref_cleaned}`,
    strategy_used: null,
  };
}

// ========================================
// MAIN HANDLER
// ========================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let responseDebug: any = null;

  try {
    const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    logRevalidate("info", "Starting revalidation", { service_role: !!SUPABASE_SERVICE_ROLE_KEY });

    if (!MERCADOPAGO_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: "Mercado Pago não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SERVICE ROLE for updates (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validate user session
    const anonClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Sessão inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { payment_id, order_id }: RevalidateRequest = await req.json();
    if (!payment_id) {
      return new Response(
        JSON.stringify({ success: false, error: "payment_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logRevalidate("info", "Input received", { payment_id, order_id });

    // Fetch payment from Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      headers: { Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}` },
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      logRevalidate("error", "MP fetch error", { status: mpResponse.status, errorText });
      return new Response(
        JSON.stringify({ success: false, error: `Pagamento não encontrado no MP (${mpResponse.status})` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payment = await mpResponse.json();
    logRevalidate("info", "Payment from MP", {
      id: payment.id,
      status: payment.status,
      external_reference: payment.external_reference,
      amount: payment.transaction_amount,
      date_approved: payment.date_approved,
    });

    if (payment.status !== "approved") {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Pagamento não aprovado. Status: ${payment.status}`,
          mp_status: payment.status,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const externalRef = payment.external_reference;
    const confirmedAmount = Number(payment.transaction_amount || 0);
    const paidAt = payment.date_approved || new Date().toISOString();

    const parsedRef = parseExternalReference(externalRef || "");
    logRevalidate("info", "Parsed external_reference", { raw: externalRef, parsed: parsedRef });

    // ========================================
    // LIVE CART FLOW
    // ========================================
    if (parsedRef.type === "live_cart") {
      const liveCartId = parsedRef.id;
      logRevalidate("info", "Processing live cart", { liveCartId });

      const { data: liveCart, error: cartError } = await supabase
        .from("live_carts")
        .select("*, live_customer:live_customers(*), items:live_cart_items(*, product:product_catalog(id, name, image_url, color, price))")
        .eq("id", liveCartId)
        .single();

      if (cartError || !liveCart) {
        return new Response(
          JSON.stringify({ success: false, error: "Carrinho não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (liveCart.status === "pago") {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Carrinho já estava pago",
            already_paid: true,
            live_cart: { id: liveCartId, status: "pago", paid_at: liveCart.paid_at, total: liveCart.total, order_id: liveCart.order_id },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let orderId = liveCart.order_id;
      if (!orderId) {
        const customer = liveCart.live_customer;
        const items = liveCart.items?.filter((i: any) => ["reservado", "confirmado"].includes(i.status)) || [];
        const subtotal = items.reduce((s: number, i: any) => s + i.preco_unitario * i.qtd, 0);
        const addressSnapshot = liveCart.shipping_address_snapshot as Record<string, unknown> | null;

        const { data: newOrder, error: orderError } = await supabase
          .from("orders")
          .insert({
            customer_name: customer?.nome || customer?.instagram_handle || "Cliente Live",
            customer_phone: customer?.whatsapp || "",
            customer_address: (addressSnapshot?.full_address as string) || "",
            subtotal,
            total: confirmedAmount,
            payment_confirmed_amount: confirmedAmount,
            status: "pago",
            payment_status: "approved",
            paid_at: paidAt,
            gateway: "mercado_pago",
            delivery_method: liveCart.delivery_method || "pickup",
            shipping_fee: liveCart.frete || 0,
            live_event_id: liveCart.live_event_id,
            customer_notes: liveCart.customer_checkout_notes || liveCart.customer_live_notes,
            address_snapshot: addressSnapshot,
          })
          .select()
          .single();

        if (orderError) {
          logRevalidate("error", "Failed to create order", orderError);
          return new Response(
            JSON.stringify({ success: false, error: "Falha ao criar pedido" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        orderId = newOrder.id;

        const orderItems = items.map((item: any) => ({
          order_id: orderId,
          product_id: item.product_id,
          product_name: item.product?.name || "Produto",
          product_price: item.preco_unitario,
          quantity: item.qtd,
          size: (item.variante as any)?.tamanho || "",
          color: item.product?.color || null,
          image_url: item.product?.image_url || null,
        }));
        if (orderItems.length > 0) {
          await supabase.from("order_items").insert(orderItems);
        }

        // Call apply_paid_effects RPC for stock management
        const { data: effectsResult, error: effectsError } = await supabase
          .rpc("apply_paid_effects", {
            p_order_id: orderId,
            p_confirmed_amount: confirmedAmount,
            p_paid_at: paidAt,
            p_gateway: "mercado_pago",
          });

        if (effectsError) {
          logRevalidate("error", "apply_paid_effects error for live cart order", { orderId, error: effectsError.message });
        } else {
          logRevalidate("info", "apply_paid_effects result for live cart", effectsResult);
        }
      } else {
        // Use apply_paid_effects for existing order
        const { data: effectsResult, error: effectsError } = await supabase
          .rpc("apply_paid_effects", {
            p_order_id: orderId,
            p_confirmed_amount: confirmedAmount,
            p_paid_at: paidAt,
            p_gateway: "mercado_pago",
          });

        if (effectsError) {
          logRevalidate("error", "apply_paid_effects error", { orderId, error: effectsError.message });
        } else {
          logRevalidate("info", "apply_paid_effects result", effectsResult);
        }
      }

      const { data: updatedCart, error: cartUpdateError } = await supabase
        .from("live_carts")
        .update({ order_id: orderId, status: "pago", paid_at: paidAt, paid_method: payment.payment_method_id || "mercadopago", updated_at: new Date().toISOString() })
        .eq("id", liveCartId)
        .select("id, status, paid_at, total, order_id")
        .single();

      if (cartUpdateError || !updatedCart || updatedCart.status !== "pago") {
        return new Response(
          JSON.stringify({ success: false, error: "Falha ao persistir status pago no carrinho" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.from("live_cart_items").update({ status: "confirmado" }).eq("live_cart_id", liveCartId).in("status", ["reservado", "confirmado"]);
      await supabase.from("live_cart_status_history").insert({ live_cart_id: liveCartId, old_status: liveCart.status, new_status: "pago", payment_method: "revalidacao_manual", notes: `Revalidação por ${user.email}` });

      logRevalidate("info", "✅ Live cart updated to PAGO", { liveCartId, orderId });
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Pagamento revalidado e carrinho atualizado para PAGO",
          live_cart: updatedCart,
          order_id: orderId,
          amount: confirmedAmount,
          paid_at: paidAt,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================
    // REGULAR ORDER FLOW
    // ========================================
    responseDebug = {
      service_role: true,
      ref_raw: parsedRef.type === "order" ? parsedRef.ref_raw : null,
      ref_cleaned: parsedRef.type === "order" ? parsedRef.ref_cleaned : null,
      uuid_candidate: parsedRef.type === "order" ? parsedRef.uuid_candidate : null,
      order_id_from_frontend: order_id || null,
      strategy_used: null,
      resolved_order_id: null,
      before: null,
      after: null,
    };

    let resolvedOrder: any = null;
    let strategyUsed: string | null = null;

    // PRIORITY 1: If order_id (full UUID) is provided from frontend, use it directly
    if (order_id && isUuidLike(order_id)) {
      logRevalidate("info", "Using order_id from frontend (exact UUID)", { order_id });
      
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, payment_status, paid_at, total, payment_confirmed_amount, gateway")
        .eq("id", order_id.toLowerCase())
        .maybeSingle();

      if (error) {
        logRevalidate("warn", "Frontend order_id lookup error", { error: error.message });
      }
      if (data) {
        resolvedOrder = data;
        strategyUsed = "FRONTEND_UUID";
        logRevalidate("info", "✅ Resolved by frontend order_id", { id: data.id, status: data.status });
      }
    }

    // PRIORITY 2: Try to resolve from external_reference
    if (!resolvedOrder && parsedRef.type === "order" && (parsedRef.uuid_candidate || parsedRef.ref_cleaned)) {
      const resolved = await resolveOrderByReference(supabase, parsedRef);
      if (resolved.order) {
        resolvedOrder = resolved.order;
        strategyUsed = resolved.strategy_used;
      }
    }

    // PRIORITY 3: If external_reference didn't match but order_id hint exists (non-UUID), try prefix match
    if (!resolvedOrder && order_id && !isUuidLike(order_id)) {
      const cleanedHint = order_id.replace(/^#/, "").toLowerCase();
      if (cleanedHint.length >= 6) {
        logRevalidate("info", "Trying order_id hint as UUID prefix", { prefix: cleanedHint });
        
        const { data, error } = await supabase
          .from("orders")
          .select("id, status, payment_status, paid_at, total, payment_confirmed_amount, gateway")
          .ilike("id", `${cleanedHint}%`)
          .limit(1);

        if (error) {
          logRevalidate("warn", "Hint prefix lookup error", { error: error.message });
        }
        if (data && data.length > 0) {
          resolvedOrder = data[0];
          strategyUsed = "HINT_UUID_PREFIX";
          logRevalidate("info", "✅ Resolved by hint UUID prefix", { id: data[0].id, status: data[0].status });
        }
      }
    }

    responseDebug.strategy_used = strategyUsed;

    if (!resolvedOrder) {
      logRevalidate("error", "Order not found", { parsedRef, order_id });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Pedido não encontrado. Ref: ${externalRef || "N/A"}, order_id: ${order_id || "N/A"}`,
          debug: responseDebug,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orderId = resolvedOrder.id;
    responseDebug.resolved_order_id = orderId;
    responseDebug.before = { id: resolvedOrder.id, status: resolvedOrder.status, payment_status: resolvedOrder.payment_status, paid_at: resolvedOrder.paid_at };

    logRevalidate("info", "Order resolved", { orderId, strategy_used: strategyUsed, before: responseDebug.before });

    // Check if already paid
    if (resolvedOrder.status === "pago" || resolvedOrder.payment_status === "approved") {
      logRevalidate("info", "Order already paid", { orderId });
      responseDebug.after = responseDebug.before;
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Pedido já estava pago",
          already_paid: true,
          order: resolvedOrder,
          amount: resolvedOrder.payment_confirmed_amount || resolvedOrder.total,
          paid_at: resolvedOrder.paid_at,
          debug: responseDebug,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =====================================================
    // CALL apply_paid_effects RPC (status + stock idempotent)
    // =====================================================
    logRevalidate("info", "Calling apply_paid_effects RPC", { orderId, amount: confirmedAmount });
    
    const { data: effectsResult, error: effectsError } = await supabase
      .rpc("apply_paid_effects", {
        p_order_id: orderId,
        p_confirmed_amount: confirmedAmount,
        p_paid_at: paidAt,
        p_gateway: "mercado_pago",
      });

    if (effectsError) {
      logRevalidate("error", "apply_paid_effects RPC error", { orderId, error: effectsError.message });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Falha ao aplicar efeitos: ${effectsError.message}`,
          debug: responseDebug,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logRevalidate("info", "apply_paid_effects result", effectsResult);

    // Verify order is now paid
    const { data: proofOrder, error: proofError } = await supabase
      .from("orders")
      .select("id, status, payment_status, paid_at, total, payment_confirmed_amount, gateway")
      .eq("id", orderId)
      .single();

    if (proofError || !proofOrder) {
      logRevalidate("error", "Proof read failed", { proofError });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Falha ao verificar persistência",
          debug: responseDebug,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    responseDebug.after = proofOrder;
    responseDebug.effects_result = effectsResult;

    if (proofOrder.status !== "pago" || proofOrder.payment_status !== "approved") {
      logRevalidate("error", "Status not persisted!", { expected: "pago/approved", actual: proofOrder });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Status não persistiu no banco de dados",
          debug: responseDebug,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logRevalidate("info", "✅ Order updated and VERIFIED as PAGO (with stock effects)", { 
      orderId, 
      status: proofOrder.status, 
      payment_status: proofOrder.payment_status,
      stock_decremented: effectsResult?.stock_decremented 
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Pagamento revalidado e pedido atualizado para PAGO",
        order: proofOrder,
        order_id: orderId,
        amount: confirmedAmount,
        paid_at: paidAt,
        debug: responseDebug,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logRevalidate("error", "Unexpected error", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro inesperado",
        debug: responseDebug,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
