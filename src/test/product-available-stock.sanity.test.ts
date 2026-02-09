import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe("sanity: product_available_stock view", () => {
  it("deve diminuir available imediatamente ao criar carrinhos novos e pedidos pagos sem baixa", async () => {
    const supabase = getServiceClient();
    if (!supabase) {
      // In ambientes sem secrets no runner, não falhar o build.
      expect(true).toBe(true);
      return;
    }

    const runId = crypto.randomUUID();

    const size = "M";
    const onHand = 10;

    // --- Create product ---
    const { data: product, error: productErr } = await supabase
      .from("product_catalog")
      .insert({
        name: `TEST-RESERVED-${runId}`,
        price: 100,
        sizes: [size],
        stock_by_size: { [size]: onHand },
        erp_stock_by_size: { [size]: onHand },
        committed_by_size: { [size]: 0 },
      })
      .select("id")
      .single();

    expect(productErr).toBeNull();
    expect(product?.id).toBeTruthy();

    const productId = product!.id as string;

    // --- Create live context (event + customer) ---
    const { data: liveEvent, error: liveEventErr } = await supabase
      .from("live_events")
      .insert({
        titulo: `TEST-LIVE-${runId}`,
        data_hora_inicio: new Date().toISOString(),
        status: "planejada",
      })
      .select("id")
      .single();

    expect(liveEventErr).toBeNull();
    const liveEventId = liveEvent!.id as string;

    const { data: liveCustomer, error: liveCustomerErr } = await supabase
      .from("live_customers")
      .insert({
        live_event_id: liveEventId,
        instagram_handle: `test_${runId}`,
      })
      .select("id")
      .single();

    expect(liveCustomerErr).toBeNull();
    const liveCustomerId = liveCustomer!.id as string;

    // 2 carts waiting + 1 paid (but without stock_decremented_at)
    const { data: carts, error: cartsErr } = await supabase
      .from("live_carts")
      .insert([
        {
          live_event_id: liveEventId,
          live_customer_id: liveCustomerId,
          status: "aguardando_pagamento",
          operational_status: "aguardando_pagamento",
        },
        {
          live_event_id: liveEventId,
          live_customer_id: liveCustomerId,
          status: "aguardando_pagamento",
          operational_status: "cobrado",
        },
        {
          live_event_id: liveEventId,
          live_customer_id: liveCustomerId,
          status: "pago",
          operational_status: "pago",
          stock_decremented_at: null,
        },
      ])
      .select("id")
      .order("created_at", { ascending: false });

    expect(cartsErr).toBeNull();
    expect(carts?.length).toBe(3);

    const cartIds = (carts || []).map((c: any) => c.id as string);

    const { error: itemsErr } = await supabase.from("live_cart_items").insert(
      cartIds.map((live_cart_id) => ({
        live_cart_id,
        product_id: productId,
        qtd: 1,
        preco_unitario: 100,
        status: "reservado",
        variante: { tamanho: size },
      }))
    );

    expect(itemsErr).toBeNull();

    // --- Validate view reflects 3 reservations immediately ---
    const { data: availability1, error: availability1Err } = await supabase
      .from("product_available_stock")
      .select("on_hand, committed, reserved, available")
      .eq("product_id", productId)
      .eq("size", size)
      .single();

    expect(availability1Err).toBeNull();
    expect(availability1?.on_hand).toBe(onHand);
    expect(availability1?.reserved).toBe(3);
    expect(availability1?.available).toBe(7);

    // --- Also validate orders paid without decrement are counted as reserved ---
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        customer_name: `TEST-${runId}`,
        customer_phone: `119${runId.replace(/\D/g, "").slice(0, 8).padEnd(8, "0")}`,
        customer_address: "Rua Teste, 123",
        status: "pago",
        total: 200,
        stock_decremented_at: null,
      })
      .select("id, customer_id")
      .single();

    expect(orderErr).toBeNull();
    const orderId = order!.id as string;
    const createdCustomerId = (order as any).customer_id as string | null;

    const { error: orderItemsErr } = await supabase.from("order_items").insert({
      order_id: orderId,
      product_id: productId,
      product_name: `TEST-RESERVED-${runId}`,
      product_price: 100,
      size,
      quantity: 2,
    });

    expect(orderItemsErr).toBeNull();

    const { data: availability2, error: availability2Err } = await supabase
      .from("product_available_stock")
      .select("reserved, available")
      .eq("product_id", productId)
      .eq("size", size)
      .single();

    expect(availability2Err).toBeNull();
    expect(availability2?.reserved).toBe(5);
    expect(availability2?.available).toBe(5);

    // --- Cleanup (best-effort) ---
    await supabase.from("order_items").delete().eq("order_id", orderId);
    await supabase.from("orders").delete().eq("id", orderId);

    await supabase.from("live_cart_items").delete().in("live_cart_id", cartIds);
    await supabase.from("live_carts").delete().in("id", cartIds);
    await supabase.from("live_customers").delete().eq("id", liveCustomerId);
    await supabase.from("live_events").delete().eq("id", liveEventId);
    await supabase.from("product_catalog").delete().eq("id", productId);

    if (createdCustomerId) {
      await supabase.from("customers").delete().eq("id", createdCustomerId);
    }
  }, 30_000);
});
