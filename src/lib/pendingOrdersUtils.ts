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
 * Get pending orders from the orders table based on operational criteria.
 * This is the SHARED function used by both KPI cards and lists.
 */
export async function getOperationalPendingOrders(
  filters: PendingOrderFilters = {}
): Promise<{ summary: PendingOrdersSummary[]; allOrders: PendingOrder[]; debug: string }> {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000);

  // Build base query from orders table
  let query = supabase
    .from("orders")
    .select("*")
    .neq("status", "cancelado");

  // Apply date filters if provided
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

  const debugQuery = `SELECT * FROM orders WHERE status != 'cancelado'${
    filters.startDate ? ` AND created_at >= '${filters.startDate.toISOString()}'` : ''
  }${filters.endDate ? ` AND created_at <= '${filters.endDate.toISOString()}'` : ''}`;

  const { data: orders, error } = await query;

  if (error) {
    console.error("[getOperationalPendingOrders] Error:", error);
    return { summary: [], allOrders: [], debug: `Error: ${error.message}` };
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
  summaryMap.set("pago_sem_logistica", initSummary("pago_sem_logistica", "Pagos sem logística >12h", "warning"));
  summaryMap.set("etiqueta_pendente", initSummary("etiqueta_pendente", "Etiqueta gerada sem postagem >24h", "warning"));
  summaryMap.set("sem_vendedora", initSummary("sem_vendedora", "Pedidos sem vendedora", "info"));
  summaryMap.set("urgente", initSummary("urgente", "Pedidos em rota >8h", "error"));

  (orders || []).forEach(order => {
    const createdAt = new Date(order.created_at);
    const updatedAt = new Date(order.updated_at);
    const hoursStalled = Math.round((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60));
    const hoursSinceCreation = Math.round((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));

    const basePendingOrder = {
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
    };

    // RULE 1: Awaiting payment >24h
    if (
      (order.status === "pendente" || order.status === "aguardando_pagamento" || order.payment_status === "pending") &&
      hoursSinceCreation > 24
    ) {
      const pending: PendingOrder = { ...basePendingOrder, type: "aguardando_pagamento_24h" };
      const summary = summaryMap.get("aguardando_pagamento_24h")!;
      summary.count++;
      summary.value += order.total || 0;
      summary.orders.push(pending);
      allOrders.push(pending);
      return; // Only classify once
    }

    // RULE 2: Awaiting return >24h (cobrado mas sem retorno)
    if (order.status === "aguardando_retorno" && hoursStalled > 24) {
      const pending: PendingOrder = { ...basePendingOrder, type: "aguardando_retorno_24h" };
      const summary = summaryMap.get("aguardando_retorno_24h")!;
      summary.count++;
      summary.value += order.total || 0;
      summary.orders.push(pending);
      allOrders.push(pending);
      return;
    }

    // RULE 3: Paid but no logistics progress >12h (needs shipping but not advanced)
    if (
      PAID_STATUSES.slice(0, 2).includes(order.status) && // pago or preparar_envio
      order.delivery_method === "shipping" &&
      !FINALIZED_STATUSES.includes(order.status) &&
      hoursStalled > 12
    ) {
      const pending: PendingOrder = { ...basePendingOrder, type: "pago_sem_logistica" };
      const summary = summaryMap.get("pago_sem_logistica")!;
      summary.count++;
      summary.value += order.total || 0;
      summary.orders.push(pending);
      allOrders.push(pending);
      return;
    }

    // RULE 4: Label generated but not posted >24h
    if (order.status === "etiqueta_gerada" && hoursStalled > 24) {
      const pending: PendingOrder = { ...basePendingOrder, type: "etiqueta_pendente" };
      const summary = summaryMap.get("etiqueta_pendente")!;
      summary.count++;
      summary.value += order.total || 0;
      summary.orders.push(pending);
      allOrders.push(pending);
      return;
    }

    // RULE 5: Orders without seller (non-canceled)
    if (!order.seller_id && !FINALIZED_STATUSES.includes(order.status)) {
      const pending: PendingOrder = { ...basePendingOrder, type: "sem_vendedora" };
      const summary = summaryMap.get("sem_vendedora")!;
      summary.count++;
      summary.value += order.total || 0;
      summary.orders.push(pending);
      allOrders.push(pending);
      return;
    }

    // RULE 6: In route >8h
    if (order.status === "em_rota" && hoursStalled > 8) {
      const pending: PendingOrder = { ...basePendingOrder, type: "urgente" };
      const summary = summaryMap.get("urgente")!;
      summary.count++;
      summary.value += order.total || 0;
      summary.orders.push(pending);
      allOrders.push(pending);
      return;
    }
  });

  // Filter to only non-empty summaries and optionally filter by type
  let summary = Array.from(summaryMap.values()).filter(s => s.count > 0);
  
  if (filters.type) {
    summary = summary.filter(s => s.type === filters.type);
  }

  const debug = `${debugQuery} | Total orders: ${orders?.length || 0} | Pending: ${allOrders.length}`;

  return { summary, allOrders, debug };
}

/**
 * Helper to get total pending count for KPI display
 */
export async function getPendingOrdersCount(filters: PendingOrderFilters = {}): Promise<number> {
  const { summary } = await getOperationalPendingOrders(filters);
  return summary.reduce((sum, s) => sum + s.count, 0);
}
