import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from "date-fns";

export type InsightsPeriod = "today" | "7d" | "30d" | "thisMonth" | "custom";
export type SourceFilter = "all" | "live" | "catalog";
export type StatusFilter = "pago" | "reservado" | "cancelado" | "all";

export interface InsightsFilters {
  period: InsightsPeriod;
  source: SourceFilter;
  status: StatusFilter;
  sellerId: string | null;
  paymentMethod: string | null;
  search: string;
  customDateRange?: { from: Date; to: Date };
}

export interface InsightsKPIs {
  receita: number;
  receitaPrev: number;
  itensSold: number;
  itensSoldPrev: number;
  ticketMedio: number;
  ticketMedioPrev: number;
  conversaoLive: number;
  conversaoCatalog: number;
  percentLive: number;
  percentCatalog: number;
  cancelamentoRate: number;
  ordersCount: number;
}

export interface ProductRanking {
  productId: string | null;
  productName: string;
  productSku: string | null;
  imageUrl: string | null;
  qtySold: number;
  revenue: number;
  avgPrice: number;
  percentLive: number;
  reservedQty: number;
  reservedValue: number;
  conversaoRate: number;
  canceledQty: number;
  cancelamentoRate: number;
  stockAvailable: number;
  lastSaleAt: string | null;
  riskLevel: "critical" | "warning" | "ok";
}

export interface SizeRanking {
  size: string;
  qtySold: number;
  revenue: number;
  reservedQty: number;
  canceledQty: number;
  stockAvailable: number;
}

export interface SellerRanking {
  id: string;
  name: string;
  revenue: number;
  qtySold: number;
  ordersCount: number;
  conversaoRate: number;
  cancelamentoRate: number;
  topProducts: { name: string; qty: number }[];
}

export interface OperationalAlert {
  id: string;
  type: "ruptura" | "baixa_conversao" | "alto_cancelamento";
  severity: "error" | "warning";
  productName: string;
  productId: string | null;
  message: string;
  value: number;
}

const PAID_STATUSES = ['pago', 'preparar_envio', 'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue'];
const CANCELLED_STATUSES = ['cancelado'];

export function useInsightsData(filters: InsightsFilters) {
  const [kpis, setKpis] = useState<InsightsKPIs | null>(null);
  const [productRanking, setProductRanking] = useState<ProductRanking[]>([]);
  const [sizeRanking, setSizeRanking] = useState<SizeRanking[]>([]);
  const [sellerRanking, setSellerRanking] = useState<SellerRanking[]>([]);
  const [alerts, setAlerts] = useState<OperationalAlert[]>([]);
  const [sellers, setSellers] = useState<{ id: string; name: string }[]>([]);
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
      case "7d":
        start = startOfDay(subDays(now, 6));
        end = endOfDay(now);
        prevStart = startOfDay(subDays(now, 13));
        prevEnd = endOfDay(subDays(now, 7));
        break;
      case "30d":
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
      case "custom":
        start = filters.customDateRange?.from || startOfDay(now);
        end = filters.customDateRange?.to || endOfDay(now);
        const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        prevStart = subDays(start, daysDiff);
        prevEnd = subDays(end, daysDiff);
        break;
      default:
        start = startOfDay(subDays(now, 6));
        end = endOfDay(now);
        prevStart = startOfDay(subDays(now, 13));
        prevEnd = endOfDay(subDays(now, 7));
    }

    return { startDate: start, endDate: end, prevStartDate: prevStart, prevEndDate: prevEnd };
  }, [filters.period, filters.customDateRange]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch sellers
      const sellersRes = await supabase.from("sellers").select("id, name").eq("is_active", true);
      setSellers(sellersRes.data || []);

      // Build orders query
      let ordersQuery = supabase
        .from("orders")
        .select("*, order_items(*)")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (filters.source === "catalog") {
        ordersQuery = ordersQuery.is("live_event_id", null);
      } else if (filters.source === "live") {
        ordersQuery = ordersQuery.not("live_event_id", "is", null);
      }
      if (filters.sellerId) {
        ordersQuery = ordersQuery.eq("seller_id", filters.sellerId);
      }

      // Previous period query
      let prevOrdersQuery = supabase
        .from("orders")
        .select("*, order_items(*)")
        .gte("created_at", prevStartDate.toISOString())
        .lte("created_at", prevEndDate.toISOString());

      if (filters.source === "catalog") {
        prevOrdersQuery = prevOrdersQuery.is("live_event_id", null);
      } else if (filters.source === "live") {
        prevOrdersQuery = prevOrdersQuery.not("live_event_id", "is", null);
      }

      // Fetch stock data
      const stockQuery = supabase
        .from("product_available_stock")
        .select("product_id, size, available");

      const [ordersRes, prevOrdersRes, stockRes] = await Promise.all([
        ordersQuery,
        prevOrdersQuery,
        stockQuery,
      ]);

      const orders = ordersRes.data || [];
      const prevOrders = prevOrdersRes.data || [];
      const stockData = stockRes.data || [];

      // Create stock map: productId -> total available
      const stockByProduct = new Map<string, number>();
      const stockBySize = new Map<string, number>();
      stockData.forEach(s => {
        if (s.product_id) {
          stockByProduct.set(s.product_id, (stockByProduct.get(s.product_id) || 0) + (s.available || 0));
        }
        if (s.size) {
          stockBySize.set(s.size, (stockBySize.get(s.size) || 0) + (s.available || 0));
        }
      });

      // Filter orders by status if needed
      const filterByStatus = (ordersList: typeof orders) => {
        if (filters.status === "all") return ordersList;
        if (filters.status === "pago") return ordersList.filter(o => PAID_STATUSES.includes(o.status));
        if (filters.status === "reservado") return ordersList.filter(o => o.status === 'aguardando_pagamento');
        if (filters.status === "cancelado") return ordersList.filter(o => CANCELLED_STATUSES.includes(o.status));
        return ordersList;
      };

      const filteredOrders = filterByStatus(orders);
      const filteredPrevOrders = filterByStatus(prevOrders);

      // Calculate KPIs
      const paidOrders = orders.filter(o => PAID_STATUSES.includes(o.status));
      const prevPaidOrders = prevOrders.filter(o => PAID_STATUSES.includes(o.status));
      const canceledOrders = orders.filter(o => CANCELLED_STATUSES.includes(o.status));
      const reservedOrders = orders.filter(o => o.status === 'aguardando_pagamento');

      const liveOrders = orders.filter(o => o.live_event_id);
      const catalogOrders = orders.filter(o => !o.live_event_id);
      const livePaid = liveOrders.filter(o => PAID_STATUSES.includes(o.status));
      const catalogPaid = catalogOrders.filter(o => PAID_STATUSES.includes(o.status));
      const liveNotCancelled = liveOrders.filter(o => !CANCELLED_STATUSES.includes(o.status));
      const catalogNotCancelled = catalogOrders.filter(o => !CANCELLED_STATUSES.includes(o.status));

      const receita = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const receitaPrev = prevPaidOrders.reduce((sum, o) => sum + (o.total || 0), 0);

      const itensSold = paidOrders.reduce((sum, o) => {
        const items = o.order_items || [];
        return sum + items.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
      }, 0);

      const itensSoldPrev = prevPaidOrders.reduce((sum, o) => {
        const items = o.order_items || [];
        return sum + items.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
      }, 0);

      setKpis({
        receita,
        receitaPrev,
        itensSold,
        itensSoldPrev,
        ticketMedio: paidOrders.length > 0 ? receita / paidOrders.length : 0,
        ticketMedioPrev: prevPaidOrders.length > 0 ? receitaPrev / prevPaidOrders.length : 0,
        conversaoLive: liveNotCancelled.length > 0 ? (livePaid.length / liveNotCancelled.length) * 100 : 0,
        conversaoCatalog: catalogNotCancelled.length > 0 ? (catalogPaid.length / catalogNotCancelled.length) * 100 : 0,
        percentLive: paidOrders.length > 0 ? (livePaid.length / paidOrders.length) * 100 : 0,
        percentCatalog: paidOrders.length > 0 ? (catalogPaid.length / paidOrders.length) * 100 : 0,
        cancelamentoRate: orders.length > 0 ? (canceledOrders.length / orders.length) * 100 : 0,
        ordersCount: paidOrders.length,
      });

      // Build product ranking
      const productMap = new Map<string, {
        productId: string | null;
        productName: string;
        productSku: string | null;
        imageUrl: string | null;
        qtySold: number;
        revenue: number;
        liveQty: number;
        catalogQty: number;
        reservedQty: number;
        reservedValue: number;
        canceledQty: number;
        lastSaleAt: string | null;
      }>();

      // Process paid orders for sold data
      paidOrders.forEach(order => {
        const isLive = !!order.live_event_id;
        const items = order.order_items || [];
        items.forEach((item: any) => {
          const key = item.product_name || 'Unknown';
          const existing = productMap.get(key) || {
            productId: null,
            productName: item.product_name || 'Unknown',
            productSku: item.product_sku,
            imageUrl: item.image_url,
            qtySold: 0,
            revenue: 0,
            liveQty: 0,
            catalogQty: 0,
            reservedQty: 0,
            reservedValue: 0,
            canceledQty: 0,
            lastSaleAt: null,
          };

          existing.qtySold += item.quantity || 0;
          existing.revenue += (item.product_price || 0) * (item.quantity || 0);
          if (isLive) {
            existing.liveQty += item.quantity || 0;
          } else {
            existing.catalogQty += item.quantity || 0;
          }
          if (!existing.lastSaleAt || (order.paid_at && order.paid_at > existing.lastSaleAt)) {
            existing.lastSaleAt = order.paid_at || order.created_at;
          }

          productMap.set(key, existing);
        });
      });

      // Add reserved data
      reservedOrders.forEach(order => {
        const items = order.order_items || [];
        items.forEach((item: any) => {
          const key = item.product_name || 'Unknown';
          const existing = productMap.get(key) || {
            productId: null,
            productName: item.product_name || 'Unknown',
            productSku: item.product_sku,
            imageUrl: item.image_url,
            qtySold: 0,
            revenue: 0,
            liveQty: 0,
            catalogQty: 0,
            reservedQty: 0,
            reservedValue: 0,
            canceledQty: 0,
            lastSaleAt: null,
          };

          existing.reservedQty += item.quantity || 0;
          existing.reservedValue += (item.product_price || 0) * (item.quantity || 0);

          productMap.set(key, existing);
        });
      });

      // Add canceled data
      canceledOrders.forEach(order => {
        const items = order.order_items || [];
        items.forEach((item: any) => {
          const key = item.product_name || 'Unknown';
          const existing = productMap.get(key);
          if (existing) {
            existing.canceledQty += item.quantity || 0;
          }
        });
      });

      // Convert to array and calculate derived metrics
      const ranking: ProductRanking[] = Array.from(productMap.values()).map(p => {
        const totalInvolved = p.qtySold + p.reservedQty + p.canceledQty;
        const conversaoRate = totalInvolved > 0 ? (p.qtySold / totalInvolved) * 100 : 0;
        const cancelamentoRate = totalInvolved > 0 ? (p.canceledQty / totalInvolved) * 100 : 0;
        const percentLive = p.qtySold > 0 ? (p.liveQty / p.qtySold) * 100 : 0;
        const avgPrice = p.qtySold > 0 ? p.revenue / p.qtySold : 0;

        // Determine risk level
        let riskLevel: "critical" | "warning" | "ok" = "ok";
        const stockAvailable = 0; // Would need product_id mapping
        if (conversaoRate < 30 && p.reservedQty > 3) {
          riskLevel = "warning";
        }
        if (cancelamentoRate > 30) {
          riskLevel = "warning";
        }
        if (cancelamentoRate > 50 || (conversaoRate < 20 && p.reservedQty > 5)) {
          riskLevel = "critical";
        }

        return {
          productId: p.productId,
          productName: p.productName,
          productSku: p.productSku,
          imageUrl: p.imageUrl,
          qtySold: p.qtySold,
          revenue: p.revenue,
          avgPrice,
          percentLive,
          reservedQty: p.reservedQty,
          reservedValue: p.reservedValue,
          conversaoRate,
          canceledQty: p.canceledQty,
          cancelamentoRate,
          stockAvailable,
          lastSaleAt: p.lastSaleAt,
          riskLevel,
        };
      });

      // Filter by search
      const searchTerm = filters.search.toLowerCase();
      const filteredRanking = searchTerm
        ? ranking.filter(p => 
            p.productName.toLowerCase().includes(searchTerm) ||
            (p.productSku && p.productSku.toLowerCase().includes(searchTerm))
          )
        : ranking;

      // Sort by revenue by default
      filteredRanking.sort((a, b) => b.revenue - a.revenue);
      setProductRanking(filteredRanking);

      // Build size ranking
      const sizeMap = new Map<string, SizeRanking>();
      paidOrders.forEach(order => {
        const items = order.order_items || [];
        items.forEach((item: any) => {
          const size = item.size || 'N/A';
          const existing = sizeMap.get(size) || {
            size,
            qtySold: 0,
            revenue: 0,
            reservedQty: 0,
            canceledQty: 0,
            stockAvailable: stockBySize.get(size) || 0,
          };
          existing.qtySold += item.quantity || 0;
          existing.revenue += (item.product_price || 0) * (item.quantity || 0);
          sizeMap.set(size, existing);
        });
      });

      reservedOrders.forEach(order => {
        const items = order.order_items || [];
        items.forEach((item: any) => {
          const size = item.size || 'N/A';
          const existing = sizeMap.get(size);
          if (existing) {
            existing.reservedQty += item.quantity || 0;
          }
        });
      });

      canceledOrders.forEach(order => {
        const items = order.order_items || [];
        items.forEach((item: any) => {
          const size = item.size || 'N/A';
          const existing = sizeMap.get(size);
          if (existing) {
            existing.canceledQty += item.quantity || 0;
          }
        });
      });

      setSizeRanking(Array.from(sizeMap.values()).sort((a, b) => b.revenue - a.revenue));

      // Build seller ranking
      const sellerMap = new Map<string, {
        id: string;
        name: string;
        revenue: number;
        qtySold: number;
        ordersCount: number;
        paidCount: number;
        canceledCount: number;
        productCounts: Map<string, number>;
      }>();

      const sellerNames = new Map<string, string>();
      (sellersRes.data || []).forEach(s => sellerNames.set(s.id, s.name));

      orders.forEach(order => {
        if (!order.seller_id) return;
        const sellerId = order.seller_id;
        const sellerName = sellerNames.get(sellerId) || 'Desconhecido';
        const existing = sellerMap.get(sellerId) || {
          id: sellerId,
          name: sellerName,
          revenue: 0,
          qtySold: 0,
          ordersCount: 0,
          paidCount: 0,
          canceledCount: 0,
          productCounts: new Map<string, number>(),
        };

        existing.ordersCount += 1;
        if (PAID_STATUSES.includes(order.status)) {
          existing.paidCount += 1;
          existing.revenue += order.total || 0;
          const items = order.order_items || [];
          items.forEach((item: any) => {
            existing.qtySold += item.quantity || 0;
            const productName = item.product_name || 'Unknown';
            existing.productCounts.set(productName, (existing.productCounts.get(productName) || 0) + (item.quantity || 0));
          });
        }
        if (CANCELLED_STATUSES.includes(order.status)) {
          existing.canceledCount += 1;
        }

        sellerMap.set(sellerId, existing);
      });

      const sellerRankingArr: SellerRanking[] = Array.from(sellerMap.values()).map(s => {
        const topProducts = Array.from(s.productCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, qty]) => ({ name, qty }));

        return {
          id: s.id,
          name: s.name,
          revenue: s.revenue,
          qtySold: s.qtySold,
          ordersCount: s.ordersCount,
          conversaoRate: s.ordersCount > 0 ? (s.paidCount / s.ordersCount) * 100 : 0,
          cancelamentoRate: s.ordersCount > 0 ? (s.canceledCount / s.ordersCount) * 100 : 0,
          topProducts,
        };
      });

      sellerRankingArr.sort((a, b) => b.revenue - a.revenue);
      setSellerRanking(sellerRankingArr);

      // Generate alerts
      const alertsList: OperationalAlert[] = [];

      // Low conversion alert
      ranking.forEach((p, idx) => {
        if (p.reservedQty > 3 && p.conversaoRate < 30) {
          alertsList.push({
            id: `conv-${idx}`,
            type: "baixa_conversao",
            severity: p.conversaoRate < 20 ? "error" : "warning",
            productName: p.productName,
            productId: p.productId,
            message: `Conversão de ${p.conversaoRate.toFixed(0)}% com ${p.reservedQty} reservados`,
            value: p.reservedValue,
          });
        }

        if (p.cancelamentoRate > 30) {
          alertsList.push({
            id: `cancel-${idx}`,
            type: "alto_cancelamento",
            severity: p.cancelamentoRate > 50 ? "error" : "warning",
            productName: p.productName,
            productId: p.productId,
            message: `${p.cancelamentoRate.toFixed(0)}% de cancelamento (${p.canceledQty} cancelados)`,
            value: p.canceledQty,
          });
        }
      });

      setAlerts(alertsList);

    } catch (error) {
      console.error("Error fetching insights data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, prevStartDate, prevEndDate, filters.source, filters.sellerId, filters.status, filters.search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    kpis,
    productRanking,
    sizeRanking,
    sellerRanking,
    alerts,
    sellers,
    isLoading,
    refetch: fetchData,
    dateRange: { startDate, endDate },
  };
}
