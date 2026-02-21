/**
 * Shared utility for operational pending orders logic.
 * SINGLE SOURCE OF TRUTH for what constitutes a "pending" order.
 * Used by both dashboard KPI counts and detailed lists.
 */

import { supabase } from "@/integrations/supabase/client";

// Statuses that indicate payment has been completed
const PAID_STATUSES = ['pago', 'preparar_envio', 'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue'];

// Statuses that indicate order is finalized (shipped/delivered)
const FINALIZED_STATUSES = ['postado', 'em_rota', 'retirada', 'entregue'];

export type PendingOrderType =
  | "aguardando_pagamento_24h"
  | "aguardando_retorno_24h"
  | "nao_cobrado"
  | "pago_sem_logistica"
  | "etiqueta_pendente"
  | "sem_vendedora"
  | "urgente";

export interface PendingOrderFilters {
  startDate?: Date;
  endDate?: Date;
  liveEventId?: string | null;
  sellerId?: string | null;
  type?: PendingOrderType | null;
}

export interface PendingOrder {
  id: string;
  type: PendingOrderType;
  customer_name: string;
  customer_phone: string;
  total: number;
  status: string;
  created_at: string;
  updated_at: string;
  delivery_method: string | null;
  seller_id: string | null;
  live_event_id: string | null;
  hoursStalled: number;
  isLiveCart?: boolean;
  customer_address?: string;
  address_snapshot?: any;
  tracking_code?: string | null;
}

export interface PendingOrdersSummary {
  type: PendingOrderType;
  title: string;
  count: number;
  value: number;
  severity: "info" | "warning" | "error";
  orders: PendingOrder[];
}

/**
 * Get pending orders from the orders and live_carts tables based on operational criteria.
 * This is the SHARED function used by both KPI cards and lists.
 */
export async function getOperationalPendingOrders(
  filters: PendingOrderFilters = {}
): Promise<{ summary: PendingOrdersSummary[]; allOrders: PendingOrder[]; debug: string }> {
  const now = new Date();

  // Build base query from orders table
  let query = supabase
    .from("orders")
    .select("*")
    .neq("status", "cancelado");

  if (filters.startDate) {
    query = query.gte("created_at", filters.startDate.toISOString());
  }
  if (filters.endDate) {
    query = query.lte("created_at", filters.endDate.toISOString());
  }
  if (filters.liveEventId) {
    query = query.eq("live_event_id", filters.liveEventId);
  }
  if (filters.sellerId) {
    query = query.eq("seller_id", filters.sellerId);
  }

  const { data: orders, error: ordersError } = await query;
  if (ordersError) console.error("[getOperationalPendingOrders] Orders Error:", ordersError);

  // Build live_carts query
  let liveCartsQuery = supabase
    .from("live_carts")
    .select("*, live_customer:live_customers(nome, instagram_handle, whatsapp)")
    .is("order_id", null)
    .neq("status", "cancelado")
    .neq("status", "expirado");

  if (filters.liveEventId) {
    liveCartsQuery = liveCartsQuery.eq("live_event_id", filters.liveEventId);
  }
  if (filters.sellerId) {
    liveCartsQuery = liveCartsQuery.eq("seller_id", filters.sellerId);
  }

  const { data: liveCarts, error: liveCartsError } = await liveCartsQuery;
  if (liveCartsError) console.error("[getOperationalPendingOrders] LiveCarts Error:", liveCartsError);

  if (ordersError && liveCartsError) {
    return { summary: [], allOrders: [], debug: `Error fetching orders and live carts` };
  }

  const allOrders: PendingOrder[] = [];
  const summaryMap = new Map<PendingOrderType, PendingOrdersSummary>();

  // Initialize summary types
  const initSummary = (type: PendingOrderType, title: string, severity: "info" | "warning" | "error"): PendingOrdersSummary => ({
    type,
    title,
    count: 0,
    value: 0,
    severity,
    orders: [],
  });

  summaryMap.set("aguardando_pagamento_24h", initSummary("aguardando_pagamento_24h", "Aguardando pagamento >24h", "error"));
  summaryMap.set("aguardando_retorno_24h", initSummary("aguardando_retorno_24h", "Aguardando retorno >24h", "error"));
  summaryMap.set("nao_cobrado", initSummary("nao_cobrado", "Não cobrados / Live aberta", "info"));
  summaryMap.set("pago_sem_logistica", initSummary("pago_sem_logistica", "Pagos sem logística >12h", "warning"));
  summaryMap.set("etiqueta_pendente", initSummary("etiqueta_pendente", "Etiqueta gerada sem postagem >24h", "warning"));
  summaryMap.set("sem_vendedora", initSummary("sem_vendedora", "Pedidos sem vendedora", "info"));
  summaryMap.set("urgente", initSummary("urgente", "Pedidos urgentes/em rota", "error"));

  // 1. Process regular orders
  (orders || []).forEach(order => {
    const createdAt = new Date(order.created_at);
    const updatedAt = new Date(order.updated_at);
    const hoursStalled = Math.round((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60));
    const hoursSinceCreation = Math.round((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));

    const basePending: PendingOrder = {
      id: order.id,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      total: order.total || 0,
      status: order.status,
      created_at: order.created_at,
      updated_at: order.updated_at,
      delivery_method: order.delivery_method,
      seller_id: order.seller_id,
      live_event_id: order.live_event_id,
      hoursStalled,
      customer_address: order.customer_address,
      address_snapshot: order.address_snapshot,
      tracking_code: order.tracking_code,
      type: "urgente" // fallback
    };

    // RULE: Awaiting payment >24h
    if ((order.status === "pendente" || order.status === "aguardando_pagamento") && hoursSinceCreation > 24) {
      appendOrder("aguardando_pagamento_24h", basePending);
      return;
    }

    // RULE: Awaiting return >24h
    if (order.status === "aguardando_retorno" && hoursStalled > 24) {
      appendOrder("aguardando_retorno_24h", basePending);
      return;
    }

    // RULE: Paid but no logistics >12h
    if (PAID_STATUSES.slice(0, 2).includes(order.status) && order.delivery_method === "shipping" && hoursStalled > 12) {
      appendOrder("pago_sem_logistica", basePending);
      return;
    }

    // Rule: Label generated no post >24h
    if (order.status === "etiqueta_gerada" && hoursStalled > 24) {
      appendOrder("etiqueta_pendente", basePending);
      return;
    }

    // Rule: No seller
    if (!order.seller_id && !FINALIZED_STATUSES.includes(order.status)) {
      appendOrder("sem_vendedora", basePending);
      return;
    }

    // Rule: In route >8h
    if (order.status === "em_rota" && hoursStalled > 8) {
      appendOrder("urgente", basePending);
      return;
    }
  });

  // 2. Process Live Carts (unpaid ones should show up as "Não cobrados")
  (liveCarts || []).forEach(cart => {
    const createdAt = new Date(cart.created_at);
    const updatedAt = new Date(cart.updated_at);
    const hoursStalled = Math.round((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60));
    const hoursSinceCreation = Math.round((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));

    const customerName = cart.live_customer?.nome || cart.live_customer?.instagram_handle || "Cliente Live";
    const customerPhone = cart.live_customer?.whatsapp || "";

    const basePending: PendingOrder = {
      id: cart.id,
      customer_name: customerName,
      customer_phone: customerPhone,
      total: cart.total || 0,
      status: cart.operational_status || cart.status,
      created_at: cart.created_at,
      updated_at: cart.updated_at,
      delivery_method: cart.delivery_method,
      seller_id: cart.seller_id,
      live_event_id: cart.live_event_id,
      hoursStalled,
      isLiveCart: true,
      customer_address: (cart.shipping_address_snapshot as any)?.full_address || "Endereço da live",
      address_snapshot: cart.shipping_address_snapshot,
      tracking_code: cart.shipping_tracking_code,
      type: "nao_cobrado"
    };

    if (hoursSinceCreation > 24) {
      appendOrder("aguardando_pagamento_24h", basePending);
    } else {
      appendOrder("nao_cobrado", basePending);
    }
  });

  function appendOrder(type: PendingOrderType, order: PendingOrder) {
    const typedOrder = { ...order, type };
    const summary = summaryMap.get(type);
    if (summary) {
      summary.count++;
      summary.value += order.total;
      summary.orders.push(typedOrder);
    }
    allOrders.push(typedOrder);
  }

  // Filter and response
  let summary = Array.from(summaryMap.values()).filter(s => s.count > 0);
  if (filters.type) summary = summary.filter(s => s.type === filters.type);

  return {
    summary,
    allOrders,
    debug: `Fetched ${orders?.length || 0} orders, ${liveCarts?.length || 0} carts.`
  };
}

/**
 * Helper to get total pending count for KPI display
 */
export async function getPendingOrdersCount(filters: PendingOrderFilters = {}): Promise<number> {
  const { summary } = await getOperationalPendingOrders(filters);
  return summary.reduce((sum, s) => sum + s.count, 0);
}
