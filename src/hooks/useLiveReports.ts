import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LiveEvent, LiveCart, LiveCartItem } from "@/types/liveShop";

export interface LiveReportKPIs {
  // Reservas (total da live)
  totalReservado: number;
  totalItensReservados: number;
  ticketMedioReservado: number;
  
  // Vendas confirmadas (pagas)
  totalPago: number;
  totalItensPagos: number;
  ticketMedioPago: number;
  
  // Carrinhos
  totalCarrinhos: number;
  carrinhosAbertos: number;
  carrinhosAguardando: number;
  carrinhosPagos: number;

  // Conversão
  taxaConversao: number; // carrinhos pagos / total carrinhos
  taxaPagamento: number; // valor pago / valor total reservado

  // Tempo
  duracaoMinutos: number;
  vendasPorHora: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  productImage: string | null;
  productColor: string | null;
  quantidadeVendida: number;
  valorTotal: number;
}

export interface CustomerSale {
  customerId: string;
  cartId: string;
  instagram: string;
  nome: string | null;
  whatsapp: string | null;
  valorTotal: number;
  itens: number;
  activeItens?: number;
  status: string;
  items: any[];
  mpCheckoutUrl: string | null;
  publicToken: string | null;
}

export interface TimelineDataPoint {
  time: string;
  timestamp: number;
  reservadoAcumulado: number;
  pagoAcumulado: number;
  reservadoMomento: number;
}

export function useLiveReports(eventId: string | undefined) {
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [kpis, setKpis] = useState<LiveReportKPIs | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [customerSales, setCustomerSales] = useState<CustomerSale[]>([]);
  const [timelineData, setTimelineData] = useState<TimelineDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const hasLoadedOnceRef = useRef(false);
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const refreshTimerRef = useRef<number | null>(null);

  const fetchReportData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!eventId) return;

    if (!opts?.silent) {
      setIsLoading(true);
    }
    try {
      // Fetch event data
      const { data: eventData, error: eventError } = await supabase
        .from("live_events")
        .select("*")
        .eq("id", eventId)
        .maybeSingle();

      if (eventError) throw eventError;
      if (!eventData) {
        setIsLoading(false);
        return;
      }
      setEvent(eventData as LiveEvent);

      // Fetch all carts with items
      const { data: cartsData, error: cartsError } = await supabase
        .from("live_carts")
        .select(`
          *,
          live_customer:live_customers(*),
          items:live_cart_items(
            *,
            product:product_catalog(id, name, image_url, color)
          )
        `)
        .eq("live_event_id", eventId);

      if (cartsError) throw cartsError;

      const carts = (cartsData || []) as LiveCart[];

      // Calculate KPIs
      const carrinhosPagos = carts.filter(c => c.status === "pago");
      const carrinhosAguardando = carts.filter(c => c.status === "aguardando_pagamento" || c.status === "em_confirmacao");
      const carrinhosAbertos = carts.filter(c => c.status === "aberto");
      
      // Total reservado: inclui carrinhos expirados (ainda são reservas), exclui apenas cancelados
      // IMPORTANT: Use subtotal (products only), NOT total (which includes shipping/frete)
      const carrinhosAtivos = carts.filter(c => c.status !== "cancelado");
      const totalReservado = carrinhosAtivos.reduce((sum, c) => sum + (c.subtotal || 0), 0);
      
      // Total pago - use subtotal for products-only value
      const totalPago = carrinhosPagos.reduce((sum, c) => sum + (c.subtotal || 0), 0);
      
      // Itens reservados (todos os itens ativos)
      let totalItensReservados = 0;
      carrinhosAtivos.forEach(cart => {
        (cart.items || []).forEach(item => {
          if (["reservado", "confirmado"].includes(item.status)) {
            totalItensReservados += item.qtd;
          }
        });
      });
      
      // Itens pagos/confirmados
      let totalItensPagos = 0;
      carrinhosPagos.forEach(cart => {
        (cart.items || []).forEach(item => {
          if (item.status === "confirmado") {
            totalItensPagos += item.qtd;
          }
        });
      });

      // Calculate actual duration - use end time if finished, otherwise use now
      const startTime = new Date(eventData.data_hora_inicio).getTime();
      const endTime = eventData.data_hora_fim 
        ? new Date(eventData.data_hora_fim).getTime()
        : (eventData.status === 'ao_vivo' ? Date.now() : startTime);
      const duracaoMinutos = Math.max(1, Math.round((endTime - startTime) / 60000));

      // Calculate sales per hour based on PAID amounts only (not reservations)
      const hoursElapsed = duracaoMinutos / 60;
      const vendasPorHora = hoursElapsed > 0 ? totalPago / hoursElapsed : 0;

      // Calculate shipping metrics separately (for optional display)
      const totalFreteArrecadado = carrinhosPagos.reduce((sum, c) => sum + (c.frete || 0), 0);
      const freteMedio = carrinhosPagos.length > 0 ? totalFreteArrecadado / carrinhosPagos.length : 0;

      const calculatedKpis: LiveReportKPIs = {
        // Reservas (products only, excludes shipping)
        totalReservado,
        totalItensReservados,
        ticketMedioReservado: carrinhosAtivos.length > 0 ? totalReservado / carrinhosAtivos.length : 0,
        
        // Pagos (products only, excludes shipping)
        totalPago,
        totalItensPagos,
        ticketMedioPago: carrinhosPagos.length > 0 ? totalPago / carrinhosPagos.length : 0,
        
        // Carrinhos
        totalCarrinhos: carts.length,
        carrinhosAbertos: carrinhosAbertos.length,
        carrinhosAguardando: carrinhosAguardando.length,
        carrinhosPagos: carrinhosPagos.length,
        
        // Conversão
        taxaConversao: carts.length > 0 ? (carrinhosPagos.length / carts.length) * 100 : 0,
        taxaPagamento: totalReservado > 0 ? (totalPago / totalReservado) * 100 : 0,
        
        // Tempo
        duracaoMinutos,
        vendasPorHora,
      };
      setKpis(calculatedKpis);

      // Calculate top products
      const productMap = new Map<string, TopProduct>();
      
      carrinhosPagos.forEach(cart => {
        (cart.items || []).forEach(item => {
          if (item.status === "confirmado" && item.product) {
            const existing = productMap.get(item.product_id);
            if (existing) {
              existing.quantidadeVendida += item.qtd;
              existing.valorTotal += item.preco_unitario * item.qtd;
            } else {
              productMap.set(item.product_id, {
                productId: item.product_id,
                productName: item.product.name,
                productImage: item.product.image_url,
                productColor: item.product.color,
                quantidadeVendida: item.qtd,
                valorTotal: item.preco_unitario * item.qtd,
              });
            }
          }
        });
      });

      const sortedProducts = Array.from(productMap.values())
        .sort((a, b) => b.valorTotal - a.valorTotal);
      setTopProducts(sortedProducts);

      // Calculate customer sales
      // Include all items except "substituido" for display purposes (expired/canceled carts should still show items)
      const visibleItemStatuses = ["reservado", "confirmado", "expirado", "removido", "cancelado"];
      const activeItemStatuses = ["reservado", "confirmado"];
      
      const customerSalesData: CustomerSale[] = carts
        .filter(c => c.live_customer)
        .map(cart => {
          // For display: show all items that were part of the cart (even if expired/removed)
          const displayItems = (cart.items || []).filter(i => visibleItemStatuses.includes(i.status));
          // For counting active items (KPIs): only reservado/confirmado
          const activeItems = (cart.items || []).filter(i => activeItemStatuses.includes(i.status));
          
          return {
            customerId: cart.live_customer_id,
            cartId: cart.id,
            instagram: cart.live_customer?.instagram_handle || "",
            nome: cart.live_customer?.nome || null,
            whatsapp: cart.live_customer?.whatsapp || null,
            valorTotal: cart.total,
            itens: displayItems.length, // Show total items for display
            activeItens: activeItems.length, // Active items for actions
            status: cart.status,
            items: displayItems, // Show all relevant items in modal
            mpCheckoutUrl: cart.mp_checkout_url || null,
            publicToken: (cart as any).public_token || null,
          };
        })
        .sort((a, b) => b.valorTotal - a.valorTotal);
      setCustomerSales(customerSalesData);

      // Calculate timeline data
      const allItems: { timestamp: number; valor: number; isPago: boolean }[] = [];
      
      carts.forEach(cart => {
        const isPago = cart.status === "pago";
        (cart.items || []).forEach(item => {
          // Include expirado items in timeline for historical accuracy
          if (["reservado", "confirmado", "expirado"].includes(item.status)) {
            const timestamp = new Date(item.reservado_em).getTime();
            allItems.push({
              timestamp,
              valor: item.preco_unitario * item.qtd,
              isPago,
            });
          }
        });
      });

      // Sort by timestamp
      allItems.sort((a, b) => a.timestamp - b.timestamp);

      // Build cumulative timeline
      let reservadoAcumulado = 0;
      let pagoAcumulado = 0;
      
      const timeline: TimelineDataPoint[] = allItems.map(item => {
        reservadoAcumulado += item.valor;
        if (item.isPago) {
          pagoAcumulado += item.valor;
        }
        
        const date = new Date(item.timestamp);
        const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        
        return {
          time,
          timestamp: item.timestamp,
          reservadoAcumulado,
          pagoAcumulado,
          reservadoMomento: item.valor,
        };
      });

      setTimelineData(timeline);

    } catch (err: any) {
      console.error("Error fetching report data:", err);
    } finally {
      hasLoadedOnceRef.current = true;
      if (!opts?.silent) {
        setIsLoading(false);
      }
    }
  }, [eventId]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Auto-refresh (realtime) for the report dashboard
  useEffect(() => {
    if (!eventId) return;

    // cleanup previous
    channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
    channelsRef.current = [];
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        // Only do silent refresh after the first load (avoid stuck loading state)
        fetchReportData({ silent: hasLoadedOnceRef.current });
      }, 350);
    };

    const cartsChannel = supabase
      .channel(`live_reports_carts_${eventId}_${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_carts",
          filter: `live_event_id=eq.${eventId}`,
        },
        scheduleRefresh
      )
      .subscribe();

    // live_cart_items doesn't have event_id, so we refresh on any change (debounced)
    const itemsChannel = supabase
      .channel(`live_reports_items_${eventId}_${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_cart_items",
        },
        scheduleRefresh
      )
      .subscribe();

    const historyChannel = supabase
      .channel(`live_reports_history_${eventId}_${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_cart_status_history",
        },
        scheduleRefresh
      )
      .subscribe();

    channelsRef.current = [cartsChannel, itemsChannel, historyChannel];

    return () => {
      channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
      channelsRef.current = [];
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [eventId, fetchReportData]);

  return {
    event,
    kpis,
    topProducts,
    customerSales,
    timelineData,
    isLoading,
    refetch: fetchReportData,
  };
}
