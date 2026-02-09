import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ========================================
// HELPER: Validate Mercado Pago webhook signature
// ========================================
async function validateMPSignature(req: Request, body: Record<string, unknown>): Promise<boolean> {
  const secret = Deno.env.get("MP_WEBHOOK_SECRET");
  if (!secret) {
    logWebhook("warn", "MP_WEBHOOK_SECRET not configured, skipping signature validation");
    return true; // Graceful degradation - allow if secret not set yet
  }

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");

  if (!xSignature || !xRequestId) {
    logWebhook("error", "Missing x-signature or x-request-id headers");
    return false;
  }

  // Parse x-signature: "ts=TIMESTAMP,v1=HASH"
  const parts = xSignature.split(",");
  const tsEntry = parts.find(p => p.trim().startsWith("ts="));
  const v1Entry = parts.find(p => p.trim().startsWith("v1="));

  if (!tsEntry || !v1Entry) {
    logWebhook("error", "Invalid x-signature format", { xSignature });
    return false;
  }

  const timestamp = tsEntry.split("=")[1];
  const receivedHash = v1Entry.split("=")[1];

  // Build the signed content per MP docs
  const dataId = (body.data && typeof body.data === "object" && "id" in body.data)
    ? String((body.data as Record<string, unknown>).id)
    : "";
  const signedContent = `id:${dataId};request-id:${xRequestId};ts:${timestamp};`;

  // Compute HMAC-SHA256
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  const expectedHash = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  if (receivedHash !== expectedHash) {
    logWebhook("error", "Signature mismatch", { receivedHash, expectedHash: expectedHash.substring(0, 8) + "..." });
    return false;
  }

  return true;
}

// ========================================
// HELPER: Parse external_reference robustly
// ========================================
interface ParsedRef {
  type: "live_cart" | "order";
  ref: string;
  rawRef: string;
  isUUID: boolean;
}

function parseExternalReference(ref: string): ParsedRef {
  if (!ref) {
    return { type: "order", ref: "", rawRef: "", isUUID: false };
  }

  const trimmed = ref.trim();

  if (trimmed.startsWith("live_cart:")) {
    const id = trimmed.replace("live_cart:", "");
    return { type: "live_cart", ref: id, rawRef: id, isUUID: true };
  }

  let cleaned = trimmed;
  if (cleaned.startsWith("#")) {
    cleaned = cleaned.substring(1);
  }
  cleaned = cleaned.trim();

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isUUID = uuidRegex.test(cleaned);

  if (isUUID) {
    return { type: "order", ref: cleaned.toLowerCase(), rawRef: cleaned, isUUID: true };
  }

  const dashIndex = cleaned.indexOf("-");
  let orderRef = dashIndex > 0 ? cleaned.substring(0, dashIndex) : cleaned;
  orderRef = orderRef.toLowerCase();

  return { type: "order", ref: orderRef, rawRef: cleaned, isUUID: false };
}

function logWebhook(level: "info" | "error" | "warn", message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const prefix = `[MP-WEBHOOK ${timestamp}]`;
  if (level === "error") {
    console.error(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : "");
  } else if (level === "warn") {
    console.warn(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : "");
  } else {
    console.log(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : "");
  }
}

// ========================================
// HELPER: Resolve order UUID from various inputs
// ========================================
async function resolveOrderByReference(
  supabase: any,
  parsedRef: ParsedRef
): Promise<{ order: any | null; error: string | null; strategy: string | null }> {
  const selectFields = "id, status, payment_status, paid_at, total, payment_confirmed_amount, gateway";

  logWebhook("info", "Resolving order", { parsedRef });

  // Strategy A: If it looks like a UUID, try exact match
  if (parsedRef.isUUID && parsedRef.ref.includes("-")) {
    logWebhook("info", "Trying Strategy A: UUID exact match", { id: parsedRef.ref });
    const { data: orderById, error } = await supabase
      .from("orders")
      .select(selectFields)
      .eq("id", parsedRef.ref)
      .maybeSingle();

    if (error) {
      logWebhook("warn", "Strategy A error", { error: error.message });
    }
    if (orderById) {
      logWebhook("info", "✅ Found order by UUID exact match", { orderId: orderById.id });
      return { order: orderById, error: null, strategy: "A_uuid_exact" };
    }
  }

  // Strategy B: UUID prefix match
  if (parsedRef.ref && parsedRef.ref.length >= 6) {
    const prefix = parsedRef.ref.toLowerCase();
    logWebhook("info", "Trying Strategy B: UUID prefix match", { prefix });
    const { data: ordersPrefix, error: prefixError } = await supabase
      .from("orders")
      .select(selectFields)
      .ilike("id", `${prefix}%`)
      .limit(1);

    if (prefixError) {
      logWebhook("warn", "Strategy B error", { error: prefixError.message });
    }
    if (ordersPrefix && ordersPrefix.length > 0) {
      logWebhook("info", "✅ Found order by UUID prefix match", { orderId: ordersPrefix[0].id });
      return { order: ordersPrefix[0], error: null, strategy: "B_uuid_prefix" };
    }
  }

  logWebhook("error", "Order not found with any strategy", { parsedRef });
  return { order: null, error: `Pedido não encontrado para referência: ${parsedRef.rawRef}`, strategy: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Enforce POST only for webhooks
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // Validate content-type
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json") && !contentType.includes("x-www-form-urlencoded")) {
    logWebhook("warn", "Unexpected content-type", { contentType });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  async function logEvent(
    orderId: string | null,
    liveCartId: string | null,
    mpPaymentId: string | null,
    mpPreferenceId: string | null,
    eventType: string,
    mpStatus: string | null,
    mpStatusDetail: string | null,
    amount: number | null,
    processingResult: string,
    errorMessage: string | null,
    payload: unknown
  ) {
    try {
      await supabase.from("mp_payment_events").insert({
        order_id: orderId,
        live_cart_id: liveCartId,
        mp_payment_id: mpPaymentId,
        mp_preference_id: mpPreferenceId,
        event_type: eventType,
        mp_status: mpStatus,
        mp_status_detail: mpStatusDetail,
        amount,
        processing_result: processingResult,
        error_message: errorMessage,
        payload,
        received_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Failed to log event:", e);
    }
  }

  try {
    if (!MERCADOPAGO_ACCESS_TOKEN) {
      console.error("Missing MERCADOPAGO_ACCESS_TOKEN");
      return new Response("Config error", { status: 500 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      logWebhook("error", "Invalid JSON body");
      return new Response("Invalid JSON", { status: 400 });
    }

    // Validate Mercado Pago webhook signature
    const isValidSignature = await validateMPSignature(req, body);
    if (!isValidSignature) {
      logWebhook("error", "Invalid webhook signature - rejecting request");
      return new Response("Invalid signature", { status: 401, headers: corsHeaders });
    }

    logWebhook("info", "Webhook received", body);

    let paymentId: string | null = null;
    let eventType = "unknown";

    const url = new URL(req.url);
    const queryTopic = url.searchParams.get("topic");
    const queryId = url.searchParams.get("id");
    const queryDataId = url.searchParams.get("data.id");

    if (queryTopic === "payment" && (queryId || queryDataId)) {
      paymentId = queryId || queryDataId;
      eventType = "payment.ipn_query";
      logWebhook("info", "IPN query format detected", { paymentId });
    } else if (body.action && body.data && typeof body.data === "object" && "id" in body.data) {
      paymentId = String((body.data as Record<string, unknown>).id);
      eventType = String(body.action);
      logWebhook("info", "V2 notification format detected", { action: body.action, paymentId });
    } else if (body.topic === "payment" && body.id) {
      paymentId = String(body.id);
      eventType = "payment.ipn_body";
      logWebhook("info", "IPN body format detected", { paymentId });
    } else if (body.type === "payment" && body.data && typeof body.data === "object" && "id" in body.data) {
      paymentId = String((body.data as Record<string, unknown>).id);
      eventType = "payment.type_data";
      logWebhook("info", "Type+data format detected", { paymentId });
    }

    if (!paymentId) {
      const topicOrType = body.topic || body.type || body.action;
      if (topicOrType && !String(topicOrType).includes("payment")) {
        logWebhook("info", "Ignoring non-payment notification", { topicOrType });
        return new Response("OK", { status: 200, headers: corsHeaders });
      }
      logWebhook("warn", "No payment ID found in webhook", body);
      await logEvent(null, null, null, null, eventType, null, null, null, "skipped", "No payment ID found", body);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    logWebhook("info", "Fetching payment from MP", { paymentId });
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}` },
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      logWebhook("error", "Failed to fetch payment from MP", { status: mpResponse.status, error: errorText });
      await logEvent(null, null, paymentId, null, eventType, null, null, null, "mp_fetch_error", errorText, body);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const payment = await mpResponse.json();
    logWebhook("info", "Payment details from MP", {
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      transaction_amount: payment.transaction_amount,
      external_reference: payment.external_reference,
      payment_method_id: payment.payment_method_id,
      date_approved: payment.date_approved,
    });

    const externalRef = payment.external_reference;
    if (!externalRef) {
      logWebhook("warn", "No external_reference in payment", { paymentId });
      await logEvent(null, null, paymentId, null, eventType, payment.status, payment.status_detail, payment.transaction_amount, "skipped", "No external_reference", payment);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const mpStatus = payment.status;
    let paymentStatus = "pending";
    let orderStatus = "aguardando_pagamento";
    const paidAt = mpStatus === "approved" ? (payment.date_approved || new Date().toISOString()) : null;

    switch (mpStatus) {
      case "approved":
        paymentStatus = "approved";
        orderStatus = "pago";
        break;
      case "pending":
      case "in_process":
        paymentStatus = "pending";
        orderStatus = "aguardando_pagamento";
        break;
      case "rejected":
        paymentStatus = "rejected";
        orderStatus = "pagamento_rejeitado";
        break;
      case "cancelled":
        paymentStatus = "cancelled";
        orderStatus = "cancelado";
        break;
      case "refunded":
        paymentStatus = "refunded";
        orderStatus = "reembolsado";
        break;
      default:
        paymentStatus = mpStatus;
    }

    logWebhook("info", "Status mapping", { mpStatus, paymentStatus, orderStatus });
    const confirmedAmount = Number(payment.transaction_amount || 0);
    const parsedRef = parseExternalReference(externalRef);
    logWebhook("info", "Parsed external_reference", { raw: externalRef, parsed: parsedRef });

    // === LIVE CART PAYMENT ===
    if (parsedRef.type === "live_cart") {
      const liveCartId = parsedRef.ref;
      logWebhook("info", "Processing live cart payment", { liveCartId, paymentStatus, confirmedAmount });
      await logEvent(null, liveCartId, paymentId, payment.preference_id, eventType, mpStatus, payment.status_detail, confirmedAmount, "processing", null, payment);

      const { data: liveCart, error: liveCartError } = await supabase
        .from("live_carts")
        .select(`
          *,
          live_customer:live_customers(*),
          items:live_cart_items(
            *,
            product:product_catalog(id, name, image_url, color, price)
          ),
          live_event:live_events(id, titulo)
        `)
        .eq("id", liveCartId)
        .single();

      if (liveCartError || !liveCart) {
        logWebhook("error", "Live cart not found", { liveCartId, error: liveCartError });
        await logEvent(null, liveCartId, paymentId, payment.preference_id, eventType, mpStatus, payment.status_detail, confirmedAmount, "error", "Live cart not found", payment);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      if (liveCart.status === "pago") {
        if (mpStatus !== "refunded") {
          logWebhook("info", "Live cart already paid, ignoring event", { liveCartId, mpStatus });
          await logEvent(null, liveCartId, paymentId, payment.preference_id, eventType, mpStatus, payment.status_detail, confirmedAmount, "skipped", "Already paid - ignoring " + mpStatus, payment);
          return new Response("OK", { status: 200, headers: corsHeaders });
        }
      }

      const liveCartStatus = paymentStatus === "approved" ? "pago" : 
                            paymentStatus === "rejected" ? "cancelado" : "aguardando_pagamento";

      if (paymentStatus === "approved") {
        const customer = liveCart.live_customer;
        const items = liveCart.items || [];
        const customerPhone = customer?.whatsapp || "";
        const customerName = customer?.nome || customer?.instagram_handle || "Cliente Live";
        const addressSnapshot = liveCart.shipping_address_snapshot as Record<string, unknown> | null;
        const fullAddress = addressSnapshot?.full_address as string || "Endereço da live (verificar checkout)";

        const activeItems = items.filter((item: any) => 
          item.status === "reservado" || item.status === "confirmado"
        );
        const itemsSubtotal = activeItems.reduce((sum: number, item: any) => 
          sum + (Number(item.preco_unitario) * item.qtd), 0
        );

        logWebhook("info", "Creating order from live cart", {
          liveCartId,
          customerName,
          itemsCount: activeItems.length,
          subtotal: itemsSubtotal,
          shipping: liveCart.frete,
          confirmedAmount,
        });

        const { data: newOrder, error: orderError } = await supabase
          .from("orders")
          .insert({
            // Live order identification
            source: "live",
            live_cart_id: liveCartId,
            live_bag_number: liveCart.bag_number || null,
            // Customer info
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_address: fullAddress,
            // Financials
            subtotal: itemsSubtotal,
            total: confirmedAmount,
            payment_confirmed_amount: confirmedAmount,
            status: "pago",
            payment_status: "approved",
            paid_at: paidAt,
            gateway: "mercado_pago",
            // Delivery
            delivery_method: liveCart.delivery_method || (liveCart.frete > 0 ? "shipping" : "pickup"),
            shipping_fee: liveCart.frete || 0,
            live_event_id: liveCart.live_event_id,
            delivery_period: liveCart.delivery_period || null,
            delivery_notes: liveCart.delivery_notes || null,
            customer_notes: liveCart.customer_checkout_notes || liveCart.customer_live_notes || null,
            address_snapshot: addressSnapshot,
            // Tracking (if already generated)
            tracking_code: liveCart.shipping_tracking_code || null,
            me_shipment_id: liveCart.me_shipment_id || null,
            me_label_url: liveCart.me_label_url || null,
            // Coupon
            coupon_id: liveCart.coupon_id || null,
            coupon_discount: liveCart.coupon_discount || 0,
            // Seller
            seller_id: liveCart.seller_id || null,
          })
          .select()
          .single();

        if (orderError) {
          logWebhook("error", "Failed to create order from live cart", { error: orderError });
          await logEvent(null, liveCartId, paymentId, payment.preference_id, eventType, mpStatus, payment.status_detail, confirmedAmount, "error", "Failed to create order: " + orderError.message, payment);
        } else if (newOrder) {
          logWebhook("info", "Order created", { orderId: newOrder.id });

          const orderItems = activeItems.map((item: any) => ({
            order_id: newOrder.id,
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

          // Use apply_paid_effects RPC for idempotent stock management
          const { data: effectsResult, error: effectsError } = await supabase
            .rpc("apply_paid_effects", {
              p_order_id: newOrder.id,
              p_confirmed_amount: confirmedAmount,
              p_paid_at: paidAt,
              p_gateway: "mercado_pago",
            });

          if (effectsError) {
            logWebhook("error", "apply_paid_effects error", { orderId: newOrder.id, error: effectsError.message });
          } else {
            logWebhook("info", "apply_paid_effects result", effectsResult);
          }

          const { data: updatedCart, error: cartUpdateError } = await supabase
            .from("live_carts")
            .update({ 
              order_id: newOrder.id,
              status: liveCartStatus,
              paid_at: paidAt,
              paid_method: payment.payment_method_id || "mercadopago",
              updated_at: new Date().toISOString(),
            })
            .eq("id", liveCartId)
            .select("id, status")
            .single();

          if (cartUpdateError || !updatedCart || updatedCart.status !== "pago") {
            logWebhook("error", "Failed to update live cart to pago", { liveCartId, cartUpdateError, updatedCart });
          } else {
            logWebhook("info", "Live cart updated to pago", { liveCartId, status: updatedCart.status });
          }

          await supabase
            .from("live_cart_items")
            .update({ status: "confirmado" })
            .eq("live_cart_id", liveCartId)
            .in("status", ["reservado", "confirmado"]);

          await supabase.from("payments").upsert({
            order_id: newOrder.id,
            provider: "mercadopago",
            mp_payment_id: String(paymentId),
            status: paymentStatus,
            amount_total: confirmedAmount,
            installments: payment.installments || 1,
            payer_email: payment.payer?.email,
            payer_phone: payment.payer?.phone?.number,
            raw_webhook_data: payment,
            updated_at: new Date().toISOString(),
          }, { onConflict: "order_id,provider" });

          await supabase.from("live_cart_status_history").insert({
            live_cart_id: liveCartId,
            old_status: liveCart.status,
            new_status: liveCartStatus,
            payment_method: payment.payment_method_id || "mercadopago",
            notes: `Webhook MP: ${mpStatus}. Payment ID: ${paymentId}. Valor: R$ ${confirmedAmount.toFixed(2)}`,
          });

          // Upsert instagram identity for future recognition
          if (customer?.instagram_handle) {
            try {
              await supabase.rpc("upsert_instagram_identity", {
                p_handle: customer.instagram_handle,
                p_phone: customer.whatsapp || null,
                p_order_id: newOrder.id,
                p_paid_at: paidAt,
                p_customer_id: customer.client_id || null,
              });
              logWebhook("info", "Instagram identity upserted", { handle: customer.instagram_handle });
            } catch (identityErr) {
              logWebhook("warn", "Failed to upsert instagram identity", { error: identityErr });
            }
          }

          await logEvent(newOrder.id, liveCartId, paymentId, payment.preference_id, eventType, mpStatus, payment.status_detail, confirmedAmount, "success", null, payment);
        }
      } else {
        await supabase
          .from("live_carts")
          .update({ 
            status: liveCartStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", liveCartId);

        await logEvent(null, liveCartId, paymentId, payment.preference_id, eventType, mpStatus, payment.status_detail, confirmedAmount, "success", null, payment);
      }

      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // ============================================
    // === REGULAR ORDER PAYMENT ===
    // ============================================
    logWebhook("info", "Processing regular order payment", { parsedRef, paymentStatus, confirmedAmount });

    const { order: existingOrder, error: resolveError, strategy } = await resolveOrderByReference(supabase, parsedRef);

    if (!existingOrder || resolveError) {
      logWebhook("error", "Order not found", { rawRef: externalRef, parsedRef, resolveError });
      await logEvent(null, null, paymentId, payment.preference_id, eventType, mpStatus, payment.status_detail, confirmedAmount, "error", resolveError || "Order not found", payment);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const orderId = existingOrder.id;
    logWebhook("info", "Order resolved", { orderId, strategy, currentStatus: existingOrder.status, currentPaymentStatus: existingOrder.payment_status });
    await logEvent(orderId, null, paymentId, payment.preference_id, eventType, mpStatus, payment.status_detail, confirmedAmount, "processing", null, payment);

    // REGRESSION PROTECTION
    if (existingOrder.payment_status === "approved" || existingOrder.status === "pago") {
      if (mpStatus !== "refunded") {
        logWebhook("info", "Order already paid, ignoring event", { orderId, mpStatus });
        await logEvent(orderId, null, paymentId, payment.preference_id, eventType, mpStatus, payment.status_detail, confirmedAmount, "skipped", "Already paid - ignoring " + mpStatus, payment);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }
    }

    // APPROVED: Use apply_paid_effects RPC
    if (paymentStatus === "approved") {
      logWebhook("info", "Calling apply_paid_effects RPC", { orderId });

      const { data: effectsResult, error: effectsError } = await supabase
        .rpc("apply_paid_effects", {
          p_order_id: orderId,
          p_confirmed_amount: confirmedAmount,
          p_paid_at: paidAt,
          p_gateway: "mercado_pago",
        });

      if (effectsError) {
        logWebhook("error", "apply_paid_effects RPC error", { orderId, error: effectsError.message });
        await logEvent(orderId, null, paymentId, payment.preference_id, eventType, mpStatus, payment.status_detail, confirmedAmount, "error", "apply_paid_effects failed: " + effectsError.message, payment);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      logWebhook("info", "apply_paid_effects result", effectsResult);

      // Verify
      const { data: updatedOrder } = await supabase
        .from("orders")
        .select("id, status, payment_status")
        .eq("id", orderId)
        .single();

      if (!updatedOrder || updatedOrder.status !== "pago" || updatedOrder.payment_status !== "approved") {
        logWebhook("error", "Order update did not persist", { expected: { status: "pago", payment_status: "approved" }, actual: updatedOrder });
        await logEvent(orderId, null, paymentId, payment.preference_id, eventType, mpStatus, payment.status_detail, confirmedAmount, "error", "Status not persisted", payment);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      logWebhook("info", "✅ Order successfully updated to PAGO with stock effects", { 
        orderId, 
        status: updatedOrder.status,
        payment_status: updatedOrder.payment_status,
        stock_decremented: effectsResult?.stock_decremented,
      });

      await supabase.from("payments").upsert({
        order_id: orderId,
        provider: "mercadopago",
        mp_payment_id: String(paymentId),
        status: paymentStatus,
        amount_total: confirmedAmount,
        installments: payment.installments || 1,
        payer_email: payment.payer?.email,
        payer_phone: payment.payer?.phone?.number,
        raw_webhook_data: payment,
        updated_at: new Date().toISOString(),
      }, { onConflict: "order_id,provider" });

      await logEvent(orderId, null, paymentId, payment.preference_id, eventType, mpStatus, payment.status_detail, confirmedAmount, "success", null, payment);
    } else {
      // Non-approved
      await supabase
        .from("orders")
        .update({
          status: orderStatus,
          payment_status: paymentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      await logEvent(orderId, null, paymentId, payment.preference_id, eventType, mpStatus, payment.status_detail, confirmedAmount, "success", null, payment);
    }

    return new Response("OK", { status: 200, headers: corsHeaders });

  } catch (error) {
    logWebhook("error", "Webhook processing error", error);
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});
