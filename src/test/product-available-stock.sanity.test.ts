import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

function getServiceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function runId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function fakePhone(seed: string): string {
  const digits = seed.replace(/\D/g, "").slice(0, 10).padEnd(10, "7");
  return `55${digits}`;
}

async function getAvailability(
  supabase: SupabaseClient,
  productId: string,
  size: string
) {
  const { data, error } = await supabase
    .from("product_available_stock")
    .select("stock,reserved,committed,available")
    .eq("product_id", productId)
    .eq("size", size)
    .single();

  expect(error).toBeNull();
  expect(data).toBeTruthy();

  return data as {
    stock: number;
    reserved: number;
    committed: number;
    available: number;
  };
}

async function createTestProduct(
  supabase: SupabaseClient,
  name: string,
  sku: string,
  stockBySize: Record<string, number>
) {
  const sizes = Object.keys(stockBySize);
  const committedBySize = Object.fromEntries(sizes.map((size) => [size, 0]));

  const { data, error } = await supabase
    .from("product_catalog")
    .insert({
      name,
      sku,
      price: 10,
      sizes,
      is_active: true,
      stock_by_size: stockBySize,
      erp_stock_by_size: stockBySize,
      committed_by_size: committedBySize,
    })
    .select("id")
    .single();

  expect(error).toBeNull();
  expect(data?.id).toBeTruthy();

  return data!.id as string;
}

async function cleanupCatalogEntities(
  supabase: SupabaseClient,
  ids: { orderId?: string; customerId?: string | null; productId?: string }
) {
  if (ids.orderId) {
    await supabase.from("order_items").delete().eq("order_id", ids.orderId);
    await supabase.from("inventory_movements").delete().eq("order_id", ids.orderId);
    await supabase.from("orders").delete().eq("id", ids.orderId);
  }

  if (ids.customerId) {
    await supabase.from("customers").delete().eq("id", ids.customerId);
  }

  if (ids.productId) {
    await supabase.from("product_catalog").delete().eq("id", ids.productId);
  }
}

async function cleanupLiveEntities(
  supabase: SupabaseClient,
  ids: {
    orderId?: string;
    customerId?: string | null;
    liveCartId?: string;
    liveCustomerId?: string;
    liveEventId?: string;
    productId?: string;
  }
) {
  if (ids.orderId) {
    await supabase.from("orders").update({ live_cart_id: null }).eq("id", ids.orderId);
  }

  if (ids.liveCartId) {
    await supabase.from("live_carts").update({ order_id: null }).eq("id", ids.liveCartId);
  }

  if (ids.orderId) {
    await supabase.from("order_items").delete().eq("order_id", ids.orderId);
    await supabase.from("inventory_movements").delete().eq("order_id", ids.orderId);
    await supabase.from("orders").delete().eq("id", ids.orderId);
  }

  if (ids.liveCartId) {
    await supabase.from("live_cart_items").delete().eq("live_cart_id", ids.liveCartId);
    await supabase.from("inventory_movements").delete().eq("order_id", ids.liveCartId);
    await supabase.from("live_carts").delete().eq("id", ids.liveCartId);
  }

  if (ids.liveCustomerId) {
    await supabase.from("live_customers").delete().eq("id", ids.liveCustomerId);
  }

  if (ids.liveEventId) {
    await supabase.from("live_events").delete().eq("id", ids.liveEventId);
  }

  if (ids.customerId) {
    await supabase.from("customers").delete().eq("id", ids.customerId);
  }

  if (ids.productId) {
    await supabase.from("product_catalog").delete().eq("id", ids.productId);
  }
}

describe("stock regression: product_available_stock", () => {
  it("catalog pending order is reserved", async () => {
    const supabase = getServiceClient();
    if (!supabase) {
      expect(true).toBe(true);
      return;
    }

    const id = runId("stock-cat-res");
    const size = "P";
    const stock = 3;

    let productId: string | undefined;
    let orderId: string | undefined;
    let customerId: string | null | undefined;

    try {
      productId = await createTestProduct(supabase, `TEST-${id}`, `SKU-${id}`, {
        [size]: stock,
      });

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          source: "catalog",
          status: "aguardando_pagamento",
          customer_name: `Customer-${id}`,
          customer_phone: fakePhone(id),
          customer_address: "Rua Teste, 123",
          total: 10,
        })
        .select("id,customer_id")
        .single();

      expect(orderError).toBeNull();
      orderId = order!.id as string;
      customerId = (order as { customer_id?: string | null }).customer_id ?? null;

      const { error: itemError } = await supabase.from("order_items").insert({
        order_id: orderId,
        product_id: productId,
        product_name: `TEST-${id}`,
        product_price: 10,
        size,
        quantity: 1,
      });
      expect(itemError).toBeNull();

      const { data: reserveResult, error: reserveError } = await supabase.rpc(
        "reserve_order_stock",
        { p_order_id: orderId }
      );
      expect(reserveError).toBeNull();
      expect((reserveResult as { success?: boolean })?.success).toBe(true);

      const availability = await getAvailability(supabase, productId, size);
      expect(availability.stock).toBe(stock);
      expect(availability.reserved).toBe(1);
      expect(availability.committed).toBe(0);
      expect(availability.available).toBe(2);
    } finally {
      await cleanupCatalogEntities(supabase, { orderId, customerId, productId });
    }
  }, 60000);

  it("catalog paid order moves from reserved to sold", async () => {
    const supabase = getServiceClient();
    if (!supabase) {
      expect(true).toBe(true);
      return;
    }

    const id = runId("stock-cat-paid");
    const size = "P";

    let productId: string | undefined;
    let orderId: string | undefined;
    let customerId: string | null | undefined;

    try {
      productId = await createTestProduct(supabase, `TEST-${id}`, `SKU-${id}`, {
        [size]: 3,
      });

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          source: "catalog",
          status: "aguardando_pagamento",
          customer_name: `Customer-${id}`,
          customer_phone: fakePhone(id),
          customer_address: "Rua Teste, 123",
          total: 10,
        })
        .select("id,customer_id")
        .single();

      expect(orderError).toBeNull();
      orderId = order!.id as string;
      customerId = (order as { customer_id?: string | null }).customer_id ?? null;

      const { error: itemError } = await supabase.from("order_items").insert({
        order_id: orderId,
        product_id: productId,
        product_name: `TEST-${id}`,
        product_price: 10,
        size,
        quantity: 1,
      });
      expect(itemError).toBeNull();

      const { error: reserveError } = await supabase.rpc("reserve_order_stock", {
        p_order_id: orderId,
      });
      expect(reserveError).toBeNull();

      const { data: paidOrder, error: paidError } = await supabase
        .from("orders")
        .update({ status: "pago" })
        .eq("id", orderId)
        .select("stock_decremented_at")
        .single();

      expect(paidError).toBeNull();
      expect(paidOrder?.stock_decremented_at).toBeTruthy();

      const availability = await getAvailability(supabase, productId, size);
      expect(availability.reserved).toBe(0);
      expect(availability.committed).toBe(1);
      expect(availability.available).toBe(2);
    } finally {
      await cleanupCatalogEntities(supabase, { orderId, customerId, productId });
    }
  }, 60000);

  it("canceling a paid catalog order releases sold stock", async () => {
    const supabase = getServiceClient();
    if (!supabase) {
      expect(true).toBe(true);
      return;
    }

    const id = runId("stock-cat-cancel");
    const size = "P";

    let productId: string | undefined;
    let orderId: string | undefined;
    let customerId: string | null | undefined;

    try {
      productId = await createTestProduct(supabase, `TEST-${id}`, `SKU-${id}`, {
        [size]: 3,
      });

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          source: "catalog",
          status: "aguardando_pagamento",
          customer_name: `Customer-${id}`,
          customer_phone: fakePhone(id),
          customer_address: "Rua Teste, 123",
          total: 10,
        })
        .select("id,customer_id")
        .single();

      expect(orderError).toBeNull();
      orderId = order!.id as string;
      customerId = (order as { customer_id?: string | null }).customer_id ?? null;

      const { error: itemError } = await supabase.from("order_items").insert({
        order_id: orderId,
        product_id: productId,
        product_name: `TEST-${id}`,
        product_price: 10,
        size,
        quantity: 1,
      });
      expect(itemError).toBeNull();

      const { error: reserveError } = await supabase.rpc("reserve_order_stock", {
        p_order_id: orderId,
      });
      expect(reserveError).toBeNull();

      const { error: paidError } = await supabase
        .from("orders")
        .update({ status: "pago" })
        .eq("id", orderId);
      expect(paidError).toBeNull();

      const { error: cancelError } = await supabase
        .from("orders")
        .update({ status: "cancelado" })
        .eq("id", orderId);
      expect(cancelError).toBeNull();

      const availability = await getAvailability(supabase, productId, size);
      expect(availability.reserved).toBe(0);
      expect(availability.committed).toBe(0);
      expect(availability.available).toBe(3);
    } finally {
      await cleanupCatalogEntities(supabase, { orderId, customerId, productId });
    }
  }, 60000);

  it("live cart pending item is reserved", async () => {
    const supabase = getServiceClient();
    if (!supabase) {
      expect(true).toBe(true);
      return;
    }

    const id = runId("stock-live-res");
    const size = "P";

    let productId: string | undefined;
    let liveEventId: string | undefined;
    let liveCustomerId: string | undefined;
    let liveCartId: string | undefined;

    try {
      productId = await createTestProduct(supabase, `TEST-${id}`, `SKU-${id}`, {
        [size]: 3,
      });

      const { data: liveEvent, error: liveEventError } = await supabase
        .from("live_events")
        .insert({
          titulo: `LIVE-${id}`,
          data_hora_inicio: new Date().toISOString(),
          status: "planejada",
        })
        .select("id")
        .single();
      expect(liveEventError).toBeNull();
      liveEventId = liveEvent!.id as string;

      const { data: liveCustomer, error: liveCustomerError } = await supabase
        .from("live_customers")
        .insert({
          live_event_id: liveEventId,
          instagram_handle: `test_${id}`,
        })
        .select("id")
        .single();
      expect(liveCustomerError).toBeNull();
      liveCustomerId = liveCustomer!.id as string;

      const { data: liveCart, error: liveCartError } = await supabase
        .from("live_carts")
        .insert({
          live_event_id: liveEventId,
          live_customer_id: liveCustomerId,
          status: "aguardando_pagamento",
          operational_status: "aguardando_pagamento",
          subtotal: 10,
          total: 10,
        })
        .select("id")
        .single();
      expect(liveCartError).toBeNull();
      liveCartId = liveCart!.id as string;

      const { error: liveItemError } = await supabase.from("live_cart_items").insert({
        live_cart_id: liveCartId,
        product_id: productId,
        qtd: 1,
        preco_unitario: 10,
        status: "reservado",
        variante: { size },
      });
      expect(liveItemError).toBeNull();

      const availability = await getAvailability(supabase, productId, size);
      expect(availability.reserved).toBe(1);
      expect(availability.committed).toBe(0);
      expect(availability.available).toBe(2);
    } finally {
      await cleanupLiveEntities(supabase, {
        liveCartId,
        liveCustomerId,
        liveEventId,
        productId,
      });
    }
  }, 60000);

  it("live paid transition moves reserved to sold", async () => {
    const supabase = getServiceClient();
    if (!supabase) {
      expect(true).toBe(true);
      return;
    }

    const id = runId("stock-live-paid");
    const size = "P";

    let productId: string | undefined;
    let liveEventId: string | undefined;
    let liveCustomerId: string | undefined;
    let liveCartId: string | undefined;
    let orderId: string | undefined;
    let customerId: string | null | undefined;

    try {
      productId = await createTestProduct(supabase, `TEST-${id}`, `SKU-${id}`, {
        [size]: 3,
      });

      const { data: liveEvent, error: liveEventError } = await supabase
        .from("live_events")
        .insert({
          titulo: `LIVE-${id}`,
          data_hora_inicio: new Date().toISOString(),
          status: "planejada",
        })
        .select("id")
        .single();
      expect(liveEventError).toBeNull();
      liveEventId = liveEvent!.id as string;

      const { data: liveCustomer, error: liveCustomerError } = await supabase
        .from("live_customers")
        .insert({
          live_event_id: liveEventId,
          instagram_handle: `test_${id}`,
        })
        .select("id")
        .single();
      expect(liveCustomerError).toBeNull();
      liveCustomerId = liveCustomer!.id as string;

      const { data: liveCart, error: liveCartError } = await supabase
        .from("live_carts")
        .insert({
          live_event_id: liveEventId,
          live_customer_id: liveCustomerId,
          status: "aguardando_pagamento",
          operational_status: "aguardando_pagamento",
          subtotal: 10,
          total: 10,
        })
        .select("id")
        .single();
      expect(liveCartError).toBeNull();
      liveCartId = liveCart!.id as string;

      const { error: liveItemError } = await supabase.from("live_cart_items").insert({
        live_cart_id: liveCartId,
        product_id: productId,
        qtd: 1,
        preco_unitario: 10,
        status: "reservado",
        variante: { size },
      });
      expect(liveItemError).toBeNull();

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          source: "live",
          live_cart_id: liveCartId,
          live_event_id: liveEventId,
          status: "aguardando_pagamento",
          customer_name: `Customer-${id}`,
          customer_phone: fakePhone(id),
          customer_address: "Rua Teste, 123",
          total: 10,
        })
        .select("id,customer_id")
        .single();
      expect(orderError).toBeNull();
      orderId = order!.id as string;
      customerId = (order as { customer_id?: string | null }).customer_id ?? null;

      const { error: orderItemError } = await supabase.from("order_items").insert({
        order_id: orderId,
        product_id: productId,
        product_name: `TEST-${id}`,
        product_price: 10,
        size,
        quantity: 1,
      });
      expect(orderItemError).toBeNull();

      const pendingAvailability = await getAvailability(supabase, productId, size);
      expect(pendingAvailability.reserved).toBe(1);
      expect(pendingAvailability.committed).toBe(0);

      const { error: paidError } = await supabase
        .from("orders")
        .update({ status: "pago" })
        .eq("id", orderId);
      expect(paidError).toBeNull();

      const finalAvailability = await getAvailability(supabase, productId, size);
      expect(finalAvailability.reserved).toBe(0);
      expect(finalAvailability.committed).toBe(1);
      expect(finalAvailability.available).toBe(2);
    } finally {
      await cleanupLiveEntities(supabase, {
        orderId,
        customerId,
        liveCartId,
        liveCustomerId,
        liveEventId,
        productId,
      });
    }
  }, 90000);
});
