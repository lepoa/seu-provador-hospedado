import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LiveEvent } from "@/types/liveShop";
import type { LiveReportKPIs, TopProduct, TimelineDataPoint } from "./useLiveReports";

export interface LiveEventSummary {
  id: string;
  titulo: string;
  data_hora_inicio: string;
  data_hora_fim: string | null;
  status: string;
  totalReservado: number;
  totalPago: number;
  totalCarrinhos: number;
  carrinhosPagos: number;
}

export function useLiveReportsByPeriod(startDate: Date | undefined, endDate: Date | undefined) {
  const [events, setEvents] = useState<LiveEventSummary[]>([]);
  const [kpis, setKpis] = useState<LiveReportKPIs | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [timelineData, setTimelineData] = useState<TimelineDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchReportData = useCallback(async () => {
    if (!startDate || !endDate) return;

    setIsLoading(true);
    try {
      // Adjust endDate to include the full day
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch events in the date range
      const { data: eventsData, error: eventsError } = await supabase
        .from("live_events")
        .select("*")
        .gte("data_hora_inicio", startDate.toISOString())
        .lte("data_hora_inicio", endOfDay.toISOString())
        .order("data_hora_inicio", { ascending: false });

      if (eventsError) throw eventsError;
      if (!eventsData || eventsData.length === 0) {
        setEvents([]);
        setKpis(null);
        setTopProducts([]);
        setTimelineData([]);
        setIsLoading(false);
        return;
      }

      const eventIds = eventsData.map(e => e.id);

      // Fetch all carts for these events
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
        .in("live_event_id", eventIds);

      if (cartsError) throw cartsError;

      const carts = cartsData || [];

      // Group carts by event
      const cartsByEvent = new Map<string, typeof carts>();
      carts.forEach(cart => {
        const existing = cartsByEvent.get(cart.live_event_id) || [];
        existing.push(cart);
        cartsByEvent.set(cart.live_event_id, existing);
      });

      // Build event summaries
      const eventSummaries: LiveEventSummary[] = eventsData.map(event => {
        const eventCarts = cartsByEvent.get(event.id) || [];
        const carrinhosAtivos = eventCarts.filter(c => !["cancelado", "expirado"].includes(c.status));
        const carrinhosPagos = eventCarts.filter(c => c.status === "pago");
        
        return {
          id: event.id,
          titulo: event.titulo,
          data_hora_inicio: event.data_hora_inicio,
          data_hora_fim: event.data_hora_fim,
          status: event.status,
          totalReservado: carrinhosAtivos.reduce((sum, c) => sum + c.total, 0),
          totalPago: carrinhosPagos.reduce((sum, c) => sum + c.total, 0),
          totalCarrinhos: eventCarts.length,
          carrinhosPagos: carrinhosPagos.length,
        };
      });
      setEvents(eventSummaries);

      // Calculate consolidated KPIs
      const carrinhosPagos = carts.filter(c => c.status === "pago");
      const carrinhosAguardando = carts.filter(c => c.status === "aguardando_pagamento" || c.status === "em_confirmacao");
      const carrinhosAbertos = carts.filter(c => c.status === "aberto");
      const carrinhosAtivos = carts.filter(c => !["cancelado", "expirado"].includes(c.status));
      
      const totalReservado = carrinhosAtivos.reduce((sum, c) => sum + c.total, 0);
      const totalPago = carrinhosPagos.reduce((sum, c) => sum + c.total, 0);
      
      let totalItensReservados = 0;
      carrinhosAtivos.forEach(cart => {
        (cart.items || []).forEach((item: any) => {
          if (["reservado", "confirmado"].includes(item.status)) {
            totalItensReservados += item.qtd;
          }
        });
      });
      
      let totalItensPagos = 0;
      carrinhosPagos.forEach(cart => {
        (cart.items || []).forEach((item: any) => {
          if (item.status === "confirmado") {
            totalItensPagos += item.qtd;
          }
        });
      });

      // Total duration in minutes across all events
      let totalDuracaoMinutos = 0;
      eventsData.forEach(event => {
        if (event.data_hora_fim && event.data_hora_inicio) {
          totalDuracaoMinutos += Math.round(
            (new Date(event.data_hora_fim).getTime() - new Date(event.data_hora_inicio).getTime()) / 60000
          );
        }
      });

      const calculatedKpis: LiveReportKPIs = {
        totalReservado,
        totalItensReservados,
        ticketMedioReservado: carrinhosAtivos.length > 0 ? totalReservado / carrinhosAtivos.length : 0,
        totalPago,
        totalItensPagos,
        ticketMedioPago: carrinhosPagos.length > 0 ? totalPago / carrinhosPagos.length : 0,
        totalCarrinhos: carts.length,
        carrinhosAbertos: carrinhosAbertos.length,
        carrinhosAguardando: carrinhosAguardando.length,
        carrinhosPagos: carrinhosPagos.length,
        taxaConversao: carts.length > 0 ? (carrinhosPagos.length / carts.length) * 100 : 0,
        taxaPagamento: totalReservado > 0 ? (totalPago / totalReservado) * 100 : 0,
        duracaoMinutos: totalDuracaoMinutos,
        vendasPorHora: totalDuracaoMinutos > 0 ? (totalReservado / (totalDuracaoMinutos / 60)) : totalReservado,
      };
      setKpis(calculatedKpis);

      // Calculate top products across all events
      const productMap = new Map<string, TopProduct>();
      
      carrinhosPagos.forEach(cart => {
        (cart.items || []).forEach((item: any) => {
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

      // Calculate timeline data by day
      const dayMap = new Map<string, { reservado: number; pago: number }>();
      
      carts.forEach(cart => {
        const isPago = cart.status === "pago";
        const isAtivo = !["cancelado", "expirado"].includes(cart.status);
        
        if (!isAtivo) return;
        
        const dayKey = new Date(cart.created_at).toISOString().split('T')[0];
        const existing = dayMap.get(dayKey) || { reservado: 0, pago: 0 };
        existing.reservado += cart.total;
        if (isPago) {
          existing.pago += cart.total;
        }
        dayMap.set(dayKey, existing);
      });

      // Sort days and build cumulative timeline
      const sortedDays = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      
      let reservadoAcumulado = 0;
      let pagoAcumulado = 0;
      
      const timeline: TimelineDataPoint[] = sortedDays.map(([day, values]) => {
        reservadoAcumulado += values.reservado;
        pagoAcumulado += values.pago;
        
        const date = new Date(day);
        const time = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
        
        return {
          time,
          timestamp: date.getTime(),
          reservadoAcumulado,
          pagoAcumulado,
          reservadoMomento: values.reservado,
        };
      });

      setTimelineData(timeline);

    } catch (err: any) {
      console.error("Error fetching period report data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (startDate && endDate) {
      fetchReportData();
    }
  }, [fetchReportData, startDate, endDate]);

  return {
    events,
    kpis,
    topProducts,
    timelineData,
    isLoading,
    totalEvents: events.length,
    refetch: fetchReportData,
  };
}
