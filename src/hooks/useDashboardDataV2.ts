import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, differenceInHours, parseISO } from "date-fns";
import { getOperationalPendingOrders, type PendingOrdersSummary, type PendingOrderType } from "@/lib/pendingOrdersUtils";

export type PeriodFilter = "today" | "7days" | "30days" | "thisMonth" | "lastMonth" | "custom";
export type ChannelFilter = "all" | "catalog" | "live";

// CRITICAL: Define paid status as all statuses AFTER payment confirmation
// This is the single source of truth for what counts as "paid"
const PAID_STATUSES = ['pago', 'preparar_envio', 'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue'];
const CANCELLED_STATUSES = ['cancelado'];

export const isPaidOrder = (order: { status: string; payment_status?: string | null }) => {
  return PAID_STATUSES.includes(order.status) || order.payment_status === 'approved';
};

export const isCancelledOrder = (order: { status: string }) => {
  return CANCELLED_STATUSES.includes(order.status);
};

export interface DashboardFilters {
  period: PeriodFilter;
  channel: ChannelFilter;
  liveEventId: string | null;
  sellerId: string | null;
  customDateRange?: { from: Date; to: Date };
}

export interface MainKPI {
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
}

export interface DashboardKPIsV2 {
  faturamentoPago: MainKPI;
  reservado: MainKPI;
  conversao: MainKPI;
  ticketMedio: MainKPI;
  pecasAtendimento: MainKPI;
  pendenciasOperacionais: MainKPI;
  pedidosPagos: number;
  pedidosPendentes: number;
  cancelados: number;
  tempoMedioPagamento: number; // hours
  taxaCancelamento: number;
}

export interface ChannelComparison {
  catalog: {
    pago: number;
    pedidosPagos: number;
    ticket: number;
    conversao: number;
    clientesAtivos: number;
  };
  live: {
    pago: number;
    reservado: number;
    pedidosPagos: number;
    ticket: number;
    conversao: number;
    progressoPagamento: number;
    lotesPendentes: number;
  };
}

export interface SellerPerformance {
  id: string;
  name: string;
  pedidosReservados: number;
  pedidosPagos: number;
  conversao: number;
  valorPago: number;
  ticketMedio: number;
  tempoMedioPagamento: number;
  badges: SellerBadge[];
  performanceScore: number;
}

export type SellerBadge = "maior_faturamento" | "maior_conversao" | "mais_pedidos" | "maior_ticket" | "velocidade";

export interface TopCustomer {
  id: string;
  name: string | null;
  instagram_handle: string | null;
  totalGasto: number;
  totalPedidos: number;
  ultimaCompra: string | null;
}

// Re-export for compatibility
export type PendingAction = {
  id: string;
  type: PendingOrderType;
  title: string;
  count: number;
  value: number;
  severity: "warning" | "error" | "info";
};

export function useDashboardDataV2(filters: DashboardFilters) {
  const [kpis, setKpis] = useState<DashboardKPIsV2 | null>(null);
  const [channelComparison, setChannelComparison] = useState<ChannelComparison | null>(null);
  const [sellerPerformance, setSellerPerformance] = useState<SellerPerformance[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [sellers, setSellers] = useState<{ id: string; name: string }[]>([]);
  const [liveEvents, setLiveEvents] = useState<{ id: string; titulo: string; data_hora_inicio: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { startDate, endDate, prevStartDate, prevEndDate } = useMemo(() => {
    const now = new Date();
    let start: Date, end: Date, prevStart: Date, prevEnd: Date;

    switch (filters.period) {
      case "today":
        start = startOfDay(now);
        end = endOfDay(now);
        prevStart = startOfDay(subDays(now, 1));
        prevEnd = endOfDay(subDays(now, 1));
        break;
      case "7days":
        start = startOfDay(subDays(now, 6));
        end = endOfDay(now);
        prevStart = startOfDay(subDays(now, 13));
        prevEnd = endOfDay(subDays(now, 7));
        break;
      case "30days":
        start = startOfDay(subDays(now, 29));
        end = endOfDay(now);
        prevStart = startOfDay(subDays(now, 59));
        prevEnd = endOfDay(subDays(now, 30));
        break;
      case "thisMonth":
        start = startOfMonth(now);
        end = endOfDay(now);
        prevStart = startOfMonth(subMonths(now, 1));
        prevEnd = endOfMonth(subMonths(now, 1));
        break;
      case "lastMonth":
        start = startOfMonth(subMonths(now, 1));
        end = endOfMonth(subMonths(now, 1));
        prevStart = startOfMonth(subMonths(now, 2));
        prevEnd = endOfMonth(subMonths(now, 2));
        break;
      case "custom":
        start = filters.customDateRange?.from || startOfDay(now);
        end = filters.customDateRange?.to || endOfDay(now);
        const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        prevStart = subDays(start, daysDiff);
        prevEnd = subDays(end, daysDiff);
        break;
      default:
        start = startOfDay(now);
        end = endOfDay(now);
        prevStart = startOfDay(subDays(now, 1));
        prevEnd = endOfDay(subDays(now, 1));
    }

    return { startDate: start, endDate: end, prevStartDate: prevStart, prevEndDate: prevEnd };
  }, [filters.period, filters.customDateRange]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch sellers and live events for filters
      const [sellersRes, livesRes] = await Promise.all([
        supabase.from("sellers").select("id, name").eq("is_active", true),
        supabase.from("live_events").select("id, titulo, data_hora_inicio").order("data_hora_inicio", { ascending: false }).limit(20),
      ]);
      setSellers(sellersRes.data || []);
      setLiveEvents(livesRes.data || []);

      // Fetch orders for current period - SINGLE SOURCE OF TRUTH for all KPIs
      let ordersQuery = supabase
        .from("orders")
        .select("*, order_items(*)")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (filters.channel === "catalog") {
        ordersQuery = ordersQuery.is("live_event_id", null);
      } else if (filters.channel === "live") {
        ordersQuery = ordersQuery.not("live_event_id", "is", null);
      }
      if (filters.liveEventId) {
        ordersQuery = ordersQuery.eq("live_event_id", filters.liveEventId);
      }
      if (filters.sellerId) {
        ordersQuery = ordersQuery.eq("seller_id", filters.sellerId);
      }

      // Fetch orders for previous period (for comparison)
      let prevOrdersQuery = supabase
        .from("orders")
        .select("*, order_items(*)")
        .gte("created_at", prevStartDate.toISOString())
        .lte("created_at", prevEndDate.toISOString());

      if (filters.channel === "catalog") {
        prevOrdersQuery = prevOrdersQuery.is("live_event_id", null);
      } else if (filters.channel === "live") {
        prevOrdersQuery = prevOrdersQuery.not("live_event_id", "is", null);
      }
      if (filters.liveEventId) {
        prevOrdersQuery = prevOrdersQuery.eq("live_event_id", filters.liveEventId);
      }
      if (filters.sellerId) {
        prevOrdersQuery = prevOrdersQuery.eq("seller_id", filters.sellerId);
      }

      // Fetch customers for top customers
      const customersQuery = supabase
        .from("customers")
        .select("*")
        .order("total_spent", { ascending: false })
        .limit(10);

      const [ordersRes, prevOrdersRes, customersRes] = await Promise.all([
        ordersQuery,
        prevOrdersQuery,
        customersQuery,
      ]);

      const orders = ordersRes.data || [];
      const prevOrders = prevOrdersRes.data || [];
      const customers = customersRes.data || [];
      
      // Debug logging for troubleshooting
      {
        const debugLiveOrders = orders.filter(o => o.live_event_id);
        const debugCatalogOrders = orders.filter(o => !o.live_event_id);
        const debugPaidOrdersCount = orders.filter(o => isPaidOrder(o)).length;
        
        console.log(`[Dashboard Debug] Query Info:`, {
          dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
          filters: { channel: filters.channel, liveEventId: filters.liveEventId, sellerId: filters.sellerId },
          results: {
            totalOrders: orders.length,
            liveOrders: debugLiveOrders.length,
            catalogOrders: debugCatalogOrders.length,
            paidOrders: debugPaidOrdersCount,
            previousPeriodOrders: prevOrders.length,
          },
          warning: debugLiveOrders.length === 0 && filters.channel !== "catalog" 
            ? "⚠️ No Live orders found. Check if live_carts are being converted to orders." 
            : null,
        });
      }

      // Calculate KPIs using correct status logic
      const calcKPIs = (ordersList: typeof orders) => {
        const notCancelled = ordersList.filter(o => !isCancelledOrder(o));
        const paid = ordersList.filter(o => isPaidOrder(o));
        const cancelled = ordersList.filter(o => isCancelledOrder(o));

        // Exclude gifts from revenue calculations (price = 0)
        const paidTotal = paid.reduce((sum, o) => {
          const items = o.order_items || [];
          const itemsTotal = items.reduce((s: number, i: any) => {
            if (i.product_price === 0) return s; // Skip gifts
            return s + (i.product_price * i.quantity);
          }, 0);
          return sum + itemsTotal;
        }, 0);

        const reservedTotal = notCancelled.reduce((sum, o) => {
          const items = o.order_items || [];
          const itemsTotal = items.reduce((s: number, i: any) => {
            if (i.product_price === 0) return s;
            return s + (i.product_price * i.quantity);
          }, 0);
          return sum + itemsTotal;
        }, 0);

        // Count pieces excluding gifts
        const totalPieces = paid.reduce((sum, o) => {
          const items = o.order_items || [];
          return sum + items.filter((i: any) => i.product_price > 0).reduce((s: number, i: any) => s + i.quantity, 0);
        }, 0);

        return {
          paidTotal,
          reservedTotal,
          paidCount: paid.length,
          notCancelledCount: notCancelled.length,
          cancelledCount: cancelled.length,
          totalPieces,
        };
      };

      const current = calcKPIs(orders);
      const previous = calcKPIs(prevOrders);

      // Calculate time to payment (from creation to paid_at or updated_at)
      const paidOrders = orders.filter(o => isPaidOrder(o) && o.updated_at);
      const avgTimeToPayment = paidOrders.length > 0
        ? paidOrders.reduce((sum, o) => {
            const created = parseISO(o.created_at);
            const updated = parseISO(o.updated_at);
            return sum + differenceInHours(updated, created);
          }, 0) / paidOrders.length
        : 0;

      // Pending actions - Use shared utility from orders table
      const pendingResult = await getOperationalPendingOrders({
        startDate,
        endDate,
        liveEventId: filters.liveEventId,
        sellerId: filters.sellerId,
      });
      
      console.log("[Dashboard] Pending orders debug:", pendingResult.debug);
      
      // Convert to PendingAction format
      const actions: PendingAction[] = pendingResult.summary.map(s => ({
        id: s.type,
        type: s.type,
        title: s.title,
        count: s.count,
        value: s.value,
        severity: s.severity,
      }));

      setPendingActions(actions);

      // Channel comparison - Use correct status logic
      const catalogOrders = orders.filter(o => !o.live_event_id);
      const liveOrders = orders.filter(o => o.live_event_id);
      const catalogNotCancelled = catalogOrders.filter(o => !isCancelledOrder(o));
      const liveNotCancelled = liveOrders.filter(o => !isCancelledOrder(o));
      const catalogPaid = catalogOrders.filter(o => isPaidOrder(o));
      const livePaid = liveOrders.filter(o => isPaidOrder(o));

      const catalogPaidTotal = catalogPaid.reduce((sum, o) => sum + (o.total || 0), 0);
      const livePaidTotal = livePaid.reduce((sum, o) => sum + (o.total || 0), 0);
      const liveReservedTotal = liveNotCancelled.reduce((sum, o) => sum + (o.total || 0), 0);

      // Count unique customers in catalog
      const catalogCustomerIds = new Set(catalogPaid.map(o => o.customer_id).filter(Boolean));

      setChannelComparison({
        catalog: {
          pago: catalogPaidTotal,
          pedidosPagos: catalogPaid.length,
          ticket: catalogPaid.length > 0 ? catalogPaidTotal / catalogPaid.length : 0,
          conversao: catalogNotCancelled.length > 0 ? (catalogPaid.length / catalogNotCancelled.length) * 100 : 0,
          clientesAtivos: catalogCustomerIds.size,
        },
        live: {
          pago: livePaidTotal,
          reservado: liveReservedTotal,
          pedidosPagos: livePaid.length,
          ticket: livePaid.length > 0 ? livePaidTotal / livePaid.length : 0,
          conversao: liveNotCancelled.length > 0 ? (livePaid.length / liveNotCancelled.length) * 100 : 0,
          progressoPagamento: liveReservedTotal > 0 ? (livePaidTotal / liveReservedTotal) * 100 : 0,
          lotesPendentes: liveNotCancelled.filter(o => !isPaidOrder(o)).length,
        },
      });

      // Seller performance - Calculate from ORDERS not live_carts
      const sellerMap = new Map<string, {
        id: string;
        name: string;
        pedidosReservados: number;
        pedidosPagos: number;
        valorReservado: number;
        valorPago: number;
        tempoTotal: number;
      }>();
      
      // Get seller names
      const sellerNames = new Map<string, string>();
      (sellersRes.data || []).forEach(s => sellerNames.set(s.id, s.name));
      
      // Process orders for seller metrics
      orders.forEach(order => {
        const sellerId = order.seller_id;
        if (!sellerId) return;
        
        const sellerName = sellerNames.get(sellerId) || "Sem nome";
        const existing = sellerMap.get(sellerId) || {
          id: sellerId,
          name: sellerName,
          pedidosReservados: 0,
          pedidosPagos: 0,
          valorReservado: 0,
          valorPago: 0,
          tempoTotal: 0,
        };

        if (!isCancelledOrder(order)) {
          existing.pedidosReservados += 1;
          existing.valorReservado += order.total || 0;
        }
        
        if (isPaidOrder(order)) {
          existing.pedidosPagos += 1;
          existing.valorPago += order.total || 0;
          // Calculate time to payment
          if (order.updated_at) {
            const created = parseISO(order.created_at);
            const updated = parseISO(order.updated_at);
            existing.tempoTotal += differenceInHours(updated, created);
          }
        }

        sellerMap.set(sellerId, existing);
      });

      // Calculate derived metrics and performance score
      const sellersArr: SellerPerformance[] = Array.from(sellerMap.values()).map(s => {
        const conversao = s.pedidosReservados > 0 ? (s.pedidosPagos / s.pedidosReservados) * 100 : 0;
        const ticketMedio = s.pedidosPagos > 0 ? s.valorPago / s.pedidosPagos : 0;
        const tempoMedioPagamento = s.pedidosPagos > 0 ? s.tempoTotal / s.pedidosPagos : 0;
        
        return {
          id: s.id,
          name: s.name,
          pedidosReservados: s.pedidosReservados,
          pedidosPagos: s.pedidosPagos,
          conversao,
          valorPago: s.valorPago,
          ticketMedio,
          tempoMedioPagamento,
          badges: [] as SellerBadge[],
          performanceScore: 0, // Will be calculated below
        };
      });

      // Calculate normalized scores for performance ranking
      if (sellersArr.length > 0) {
        const maxFaturamento = Math.max(...sellersArr.map(s => s.valorPago), 1);
        const maxPedidos = Math.max(...sellersArr.map(s => s.pedidosPagos), 1);
        const maxTicket = Math.max(...sellersArr.map(s => s.ticketMedio), 1);
        
        // Calculate performance score: 40% conversion + 30% revenue + 20% orders + 10% ticket
        sellersArr.forEach(s => {
          const normFaturamento = s.valorPago / maxFaturamento;
          const normPedidos = s.pedidosPagos / maxPedidos;
          const normTicket = s.ticketMedio / maxTicket;
          const normConversao = s.conversao / 100;
          
          s.performanceScore = (normConversao * 0.4) + (normFaturamento * 0.3) + (normPedidos * 0.2) + (normTicket * 0.1);
        });

        // Assign badges - each badge goes to the TOP performer in that category
        const maxFaturamentoValue = Math.max(...sellersArr.map(s => s.valorPago));
        const eligibleForConversao = sellersArr.filter(s => s.pedidosReservados >= 3 || s.valorPago >= 300);
        const maxConversao = eligibleForConversao.length > 0 ? Math.max(...eligibleForConversao.map(s => s.conversao)) : 0;
        const maxPedidosValue = Math.max(...sellersArr.map(s => s.pedidosPagos));
        const maxTicketValue = Math.max(...sellersArr.map(s => s.ticketMedio));
        const minTempo = Math.min(...sellersArr.filter(s => s.pedidosPagos > 0).map(s => s.tempoMedioPagamento));

        sellersArr.forEach(s => {
          s.badges = [];
          if (s.valorPago === maxFaturamentoValue && maxFaturamentoValue > 0) s.badges.push("maior_faturamento");
          if ((s.pedidosReservados >= 3 || s.valorPago >= 300) && s.conversao === maxConversao && maxConversao > 0) s.badges.push("maior_conversao");
          if (s.pedidosPagos === maxPedidosValue && maxPedidosValue > 0) s.badges.push("mais_pedidos");
          if (s.ticketMedio === maxTicketValue && maxTicketValue > 0) s.badges.push("maior_ticket");
          if (s.pedidosPagos > 0 && s.tempoMedioPagamento === minTempo && minTempo < 24) s.badges.push("velocidade");
        });
      }

      // Sort by performance score (descending)
      setSellerPerformance(sellersArr.sort((a, b) => b.performanceScore - a.performanceScore));

      // Top customers
      const topCustomersList: TopCustomer[] = customers.slice(0, 5).map(c => ({
        id: c.id,
        name: c.name,
        instagram_handle: c.instagram_handle,
        totalGasto: c.total_spent || 0,
        totalPedidos: c.total_orders || 0,
        ultimaCompra: c.last_order_at,
      }));
      setTopCustomers(topCustomersList);

      // Build KPIs
      const createKPI = (current: number, previous: number): MainKPI => {
        const change = current - previous;
        const changePercent = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
        return { value: current, previousValue: previous, change, changePercent };
      };

      const cancelledCount = orders.filter(o => o.status === "cancelado").length;
      const notCancelledCount = orders.filter(o => o.status !== "cancelado").length;

      setKpis({
        faturamentoPago: createKPI(current.paidTotal, previous.paidTotal),
        reservado: createKPI(current.reservedTotal, previous.reservedTotal),
        conversao: createKPI(
          current.reservedTotal > 0 ? (current.paidTotal / current.reservedTotal) * 100 : 0,
          previous.reservedTotal > 0 ? (previous.paidTotal / previous.reservedTotal) * 100 : 0
        ),
        ticketMedio: createKPI(
          current.paidCount > 0 ? current.paidTotal / current.paidCount : 0,
          previous.paidCount > 0 ? previous.paidTotal / previous.paidCount : 0
        ),
        pecasAtendimento: createKPI(
          current.paidCount > 0 ? current.totalPieces / current.paidCount : 0,
          previous.paidCount > 0 ? previous.totalPieces / previous.paidCount : 0
        ),
        pendenciasOperacionais: createKPI(actions.reduce((sum, a) => sum + a.count, 0), 0),
        pedidosPagos: current.paidCount,
        pedidosPendentes: notCancelledCount - current.paidCount,
        cancelados: cancelledCount,
        tempoMedioPagamento: avgTimeToPayment,
        taxaCancelamento: (notCancelledCount + cancelledCount) > 0 ? (cancelledCount / (notCancelledCount + cancelledCount)) * 100 : 0,
      });

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, prevStartDate, prevEndDate, filters.channel, filters.sellerId, filters.liveEventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    kpis,
    channelComparison,
    sellerPerformance,
    topCustomers,
    pendingActions,
    sellers,
    liveEvents,
    isLoading,
    refetch: fetchData,
    dateRange: { startDate, endDate },
  };
}
