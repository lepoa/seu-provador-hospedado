import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardKPIs {
  // Vendas Hoje
  faturamentoHoje: number;
  pedidosHoje: number;
  ticketMedio: number;
  pedidosPendentes: number;
  
  // Live
  totalReservadoLive: number;
  totalPagoLive: number;
  liveAtiva: boolean;
  ultimaLiveId: string | null;
  ultimaLiveTitulo: string | null;
  
  // Logística
  pedidosAguardandoPagamento: number;
  pedidosParaSeparar: number;
  pedidosParaEnvio: number;
  pedidosRetirada: number;
  pedidosCancelados: number;
  
  // Produtos
  produtosEsgotados: number;
  produtosQuaseEsgotados: number;
  produtosParados: number;
  
  // Clientes
  totalClientes: number;
  clientesNovosHoje: number;
}

export interface TopCustomer {
  id: string;
  name: string | null;
  instagram_handle: string | null;
  totalGasto: number;
  totalPedidos: number;
  ultimaCompra: string | null;
}

export interface TopProduct {
  id: string;
  name: string;
  image_url: string | null;
  color: string | null;
  quantidadeVendida: number;
  valorTotal: number;
}

export interface AlertItem {
  id: string;
  type: "cart_unpaid" | "order_stuck" | "waitlist" | "low_stock";
  title: string;
  description: string;
  severity: "warning" | "error" | "info";
  timestamp: string;
  actionUrl?: string;
}

export interface HourlySale {
  hour: string;
  reservado: number;
  pago: number;
  reservadoOntem: number;
  pagoOntem: number;
}

export function useDashboardData() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [hourlySales, setHourlySales] = useState<HourlySale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayISO = yesterday.toISOString();

      // Parallel fetches
      const [
        ordersResult,
        ordersYesterdayResult,
        liveEventsResult,
        liveCartsResult,
        productsResult,
        customersResult,
        waitlistResult,
      ] = await Promise.all([
        // Orders today
        supabase
          .from("orders")
          .select("*")
          .gte("created_at", todayISO),
        // Orders yesterday
        supabase
          .from("orders")
          .select("*")
          .gte("created_at", yesterdayISO)
          .lt("created_at", todayISO),
        
        // Live events
        supabase
          .from("live_events")
          .select("*")
          .order("data_hora_inicio", { ascending: false })
          .limit(5),
        
        // Live carts
        supabase
          .from("live_carts")
          .select(`
            *,
            live_event:live_events(id, titulo, status)
          `),
        
        // Products
        supabase
          .from("product_catalog")
          .select("*")
          .eq("is_active", true),
        
        // Customers
        supabase
          .from("customers")
          .select("*")
          .order("total_spent", { ascending: false })
          .limit(10),
        
        // Waitlist
        supabase
          .from("live_waitlist")
          .select("*")
          .eq("status", "ativa"),
      ]);

      const orders = ordersResult.data || [];
      const ordersYesterday = ordersYesterdayResult.data || [];
      const liveEvents = liveEventsResult.data || [];
      const liveCarts = liveCartsResult.data || [];
      const products = productsResult.data || [];
      const customers = customersResult.data || [];
      const waitlist = waitlistResult.data || [];

      // Calculate KPIs
      const pedidosPagos = orders.filter(o => o.payment_status === "pago" || o.status === "pago");
      const faturamentoHoje = pedidosPagos.reduce((sum, o) => sum + (o.total || 0), 0);
      const pedidosHoje = orders.length;
      const ticketMedio = pedidosHoje > 0 ? faturamentoHoje / pedidosHoje : 0;
      const pedidosPendentes = orders.filter(o => 
        o.status === "pendente" || o.payment_status === "pending"
      ).length;

      // Live stats
      const liveAtiva = liveEvents.some(e => e.status === "ao_vivo");
      const ultimaLive = liveEvents[0];
      
      const liveCartsAtivos = liveCarts.filter(c => 
        c.live_event?.status === "ao_vivo" || 
        (ultimaLive && c.live_event_id === ultimaLive.id)
      );
      const liveCartsPagos = liveCartsAtivos.filter(c => c.status === "pago");
      const totalReservadoLive = liveCartsAtivos.reduce((sum, c) => sum + (c.total || 0), 0);
      const totalPagoLive = liveCartsPagos.reduce((sum, c) => sum + (c.total || 0), 0);

      // Logística - fetch all orders
      const { data: allOrders } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      const allOrdersList = allOrders || [];
      const pedidosAguardandoPagamento = allOrdersList.filter(o => 
        o.payment_status === "pending" || o.status === "aguardando_pagamento"
      ).length;
      const pedidosParaSeparar = allOrdersList.filter(o => 
        o.status === "pago" || o.payment_status === "pago"
      ).length;
      const pedidosParaEnvio = allOrdersList.filter(o => 
        o.status === "separado" && o.delivery_method === "shipping"
      ).length;
      const pedidosRetirada = allOrdersList.filter(o => 
        o.status === "separado" && o.delivery_method === "pickup"
      ).length;
      const pedidosCancelados = allOrdersList.filter(o => 
        o.status === "cancelado"
      ).length;

      // Produtos
      const produtosEsgotados = products.filter(p => {
        const stockBySize = p.stock_by_size as Record<string, number> || {};
        const totalStock = Object.values(stockBySize).reduce((sum, qty) => sum + (qty || 0), 0);
        return totalStock === 0;
      }).length;

      const produtosQuaseEsgotados = products.filter(p => {
        const stockBySize = p.stock_by_size as Record<string, number> || {};
        const totalStock = Object.values(stockBySize).reduce((sum, qty) => sum + (qty || 0), 0);
        return totalStock > 0 && totalStock <= 3;
      }).length;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const produtosParados = products.filter(p => {
        const createdAt = new Date(p.created_at);
        return createdAt < thirtyDaysAgo;
      }).length;

      // Clientes novos hoje
      const clientesNovosHoje = customers.filter(c => 
        new Date(c.created_at) >= today
      ).length;

      setKpis({
        faturamentoHoje,
        pedidosHoje,
        ticketMedio,
        pedidosPendentes,
        totalReservadoLive,
        totalPagoLive,
        liveAtiva,
        ultimaLiveId: ultimaLive?.id || null,
        ultimaLiveTitulo: ultimaLive?.titulo || null,
        pedidosAguardandoPagamento,
        pedidosParaSeparar,
        pedidosParaEnvio,
        pedidosRetirada,
        pedidosCancelados,
        produtosEsgotados,
        produtosQuaseEsgotados,
        produtosParados,
        totalClientes: customers.length,
        clientesNovosHoje,
      });

      // Top Customers
      const topCustomersList: TopCustomer[] = customers.slice(0, 5).map(c => ({
        id: c.id,
        name: c.name,
        instagram_handle: c.instagram_handle,
        totalGasto: c.total_spent || 0,
        totalPedidos: c.total_orders || 0,
        ultimaCompra: c.last_order_at,
      }));
      setTopCustomers(topCustomersList);

      // Top Products (from order items)
      const { data: orderItems } = await supabase
        .from("order_items")
        .select(`
          *,
          order:orders(payment_status, status)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      const productSales = new Map<string, TopProduct>();
      (orderItems || []).forEach(item => {
        if (item.order?.payment_status === "pago" || item.order?.status === "pago") {
          const existing = productSales.get(item.product_id);
          if (existing) {
            existing.quantidadeVendida += item.quantity;
            existing.valorTotal += item.product_price * item.quantity;
          } else {
            productSales.set(item.product_id, {
              id: item.product_id,
              name: item.product_name,
              image_url: item.image_url,
              color: item.color,
              quantidadeVendida: item.quantity,
              valorTotal: item.product_price * item.quantity,
            });
          }
        }
      });
      setTopProducts(Array.from(productSales.values()).sort((a, b) => b.valorTotal - a.valorTotal).slice(0, 5));

      // Alerts
      const alertsList: AlertItem[] = [];

      // Unpaid carts (older than 24h)
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      liveCarts
        .filter(c => 
          c.status === "aguardando_pagamento" && 
          new Date(c.created_at) < twentyFourHoursAgo
        )
        .slice(0, 3)
        .forEach(cart => {
          alertsList.push({
            id: `cart-${cart.id}`,
            type: "cart_unpaid",
            title: "Carrinho não pago há +24h",
            description: `Carrinho #${cart.bag_number || cart.id.slice(0, 6)} aguardando pagamento`,
            severity: "warning",
            timestamp: cart.created_at,
            actionUrl: `/dashboard/lives/${cart.live_event_id}/backstage`,
          });
        });

      // Waitlist items
      if (waitlist.length > 0) {
        alertsList.push({
          id: "waitlist-alert",
          type: "waitlist",
          title: `${waitlist.length} cliente(s) na lista de espera`,
          description: "Produtos esgotados com demanda",
          severity: "info",
          timestamp: new Date().toISOString(),
        });
      }

      // Low stock products
      if (produtosQuaseEsgotados > 0) {
        alertsList.push({
          id: "low-stock-alert",
          type: "low_stock",
          title: `${produtosQuaseEsgotados} produto(s) quase esgotados`,
          description: "Estoque baixo, considere repor",
          severity: "warning",
          timestamp: new Date().toISOString(),
          actionUrl: "/dashboard?tab=products&filter=baixo-estoque",
        });
      }

      // Stuck orders
      const stuckOrders = allOrdersList.filter(o => {
        const createdAt = new Date(o.created_at);
        return o.status === "pendente" && createdAt < twentyFourHoursAgo;
      });
      if (stuckOrders.length > 0) {
        alertsList.push({
          id: "stuck-orders-alert",
          type: "order_stuck",
          title: `${stuckOrders.length} pedido(s) travado(s)`,
          description: "Pedidos pendentes há mais de 24h",
          severity: "error",
          timestamp: new Date().toISOString(),
          actionUrl: "/dashboard?tab=orders",
        });
      }

      setAlerts(alertsList);

      // Hourly sales with today vs yesterday comparison
      const hours = [];
      for (let i = 8; i <= 22; i++) {
        // Today's orders for this hour
        const hourOrdersToday = orders.filter(o => {
          const hour = new Date(o.created_at).getHours();
          return hour === i;
        });
        const hourTotalToday = hourOrdersToday.reduce((sum, o) => sum + (o.total || 0), 0);
        const hourPagoToday = hourOrdersToday
          .filter(o => o.payment_status === "pago")
          .reduce((sum, o) => sum + (o.total || 0), 0);

        // Yesterday's orders for this hour
        const hourOrdersYesterday = ordersYesterday.filter(o => {
          const hour = new Date(o.created_at).getHours();
          return hour === i;
        });
        const hourTotalYesterday = hourOrdersYesterday.reduce((sum, o) => sum + (o.total || 0), 0);
        const hourPagoYesterday = hourOrdersYesterday
          .filter(o => o.payment_status === "pago")
          .reduce((sum, o) => sum + (o.total || 0), 0);

        hours.push({
          hour: `${i}h`,
          reservado: hourTotalToday,
          pago: hourPagoToday,
          reservadoOntem: hourTotalYesterday,
          pagoOntem: hourPagoYesterday,
        });
      }
      setHourlySales(hours);

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    kpis,
    topCustomers,
    topProducts,
    alerts,
    hourlySales,
    isLoading,
    refetch: fetchData,
  };
}
