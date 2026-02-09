import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LiveEvent } from "@/types/liveShop";

// Main KPIs with comparison to previous live
export interface LiveReportKPIsV2 {
  // Current live metrics
  totalReservado: number;
  totalPago: number;
  pedidosAtivos: number;
  taxaConversao: number; // % pago/reservado
  ticketMedio: number;
  pecasPorAtendimento: number;
  
  // Comparison with previous live (percentage change)
  comparison: {
    totalReservado: number | null;
    totalPago: number | null;
    pedidosAtivos: number | null;
    taxaConversao: number | null;
    ticketMedio: number | null;
    pecasPorAtendimento: number | null;
  };
  
  // Previous live reference
  previousLive: {
    id: string;
    titulo: string;
  } | null;
}

// Funnel stage data
export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  value: number;
  conversionFromPrevious: number; // % conversion from previous stage
  color: string;
}

// Seller badge types
export type SellerBadge = 'maior_faturamento' | 'maior_conversao' | 'mais_pedidos' | 'melhor_performance' | 'attention';

// Seller performance
export interface SellerPerformance {
  sellerId: string | null;
  sellerName: string;
  pedidos: number;
  valorReservado: number;
  valorPago: number;
  ticketMedio: number;
  taxaConversao: number;
  rank: number;
  badges: SellerBadge[];
  performanceScore: number;
}

// Actionable insights
export interface ActionableInsight {
  key: string;
  label: string;
  count: number;
  value: number;
  severity: 'warning' | 'danger' | 'info';
  filterKey: string;
  icon: string;
}

// Timeline data for charts
export interface TimelineDataPoint {
  time: string;
  timestamp: number;
  reservadoAcumulado: number;
  pagoAcumulado: number;
  reservadoMomento: number;
}

// Top product
export interface TopProduct {
  productId: string;
  productName: string;
  productImage: string | null;
  productColor: string | null;
  quantidadeVendida: number;
  valorTotal: number;
}

// Customer sale
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

export function useLiveReportsV2(eventId: string | undefined) {
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [previousEvent, setPreviousEvent] = useState<LiveEvent | null>(null);
  const [kpis, setKpis] = useState<LiveReportKPIsV2 | null>(null);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [sellerPerformance, setSellerPerformance] = useState<SellerPerformance[]>([]);
  const [insights, setInsights] = useState<ActionableInsight[]>([]);
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

      // Fetch previous live for comparison
      const { data: previousLiveData } = await supabase
        .from("live_events")
        .select("*")
        .lt("data_hora_inicio", eventData.data_hora_inicio)
        .order("data_hora_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();

      setPreviousEvent(previousLiveData as LiveEvent | null);

      // Fetch all carts with items for current live
      const { data: cartsData, error: cartsError } = await supabase
        .from("live_carts")
        .select(`
          *,
          live_customer:live_customers(*),
          items:live_cart_items(
            *,
            product:product_catalog(id, name, image_url, color)
          ),
          seller:sellers(id, name)
        `)
        .eq("live_event_id", eventId);

      if (cartsError) throw cartsError;
      const carts = cartsData || [];

      // Fetch previous live carts for comparison
      let previousCarts: any[] = [];
      if (previousLiveData) {
        const { data: prevCartsData } = await supabase
          .from("live_carts")
          .select(`
            *,
            items:live_cart_items(*)
          `)
          .eq("live_event_id", previousLiveData.id);
        previousCarts = prevCartsData || [];
      }

      // Fetch sellers
      const { data: sellersData } = await supabase
        .from("sellers")
        .select("id, name")
        .eq("is_active", true);
      const sellers = sellersData || [];

      // Calculate current live metrics
      // IMPORTANT: Use subtotal (products only) for sales metrics, NOT total (which includes shipping)
      const carrinhosAtivos = carts.filter(c => c.status !== "cancelado");
      const carrinhosPagos = carts.filter(c => c.status === "pago");
      
      // Sales metrics use SUBTOTAL (products only, excludes shipping)
      const totalReservado = carrinhosAtivos.reduce((sum, c) => sum + (c.subtotal || 0), 0);
      const totalPago = carrinhosPagos.reduce((sum, c) => sum + (c.subtotal || 0), 0);
      const pedidosAtivos = carrinhosAtivos.length;
      const taxaConversao = totalReservado > 0 ? (totalPago / totalReservado) * 100 : 0;
      const ticketMedio = carrinhosPagos.length > 0 ? totalPago / carrinhosPagos.length : 0;
      
      // Pieces per attendance (excluding gifts)
      let totalPecas = 0;
      carrinhosPagos.forEach(cart => {
        (cart.items || []).forEach((item: any) => {
          if (item.status === "confirmado") {
            totalPecas += item.qtd;
          }
        });
      });
      const pecasPorAtendimento = carrinhosPagos.length > 0 ? totalPecas / carrinhosPagos.length : 0;

      // Calculate previous live metrics for comparison
      let comparison: LiveReportKPIsV2['comparison'] = {
        totalReservado: null,
        totalPago: null,
        pedidosAtivos: null,
        taxaConversao: null,
        ticketMedio: null,
        pecasPorAtendimento: null,
      };

      if (previousCarts.length > 0) {
        const prevAtivos = previousCarts.filter(c => c.status !== "cancelado");
        const prevPagos = previousCarts.filter(c => c.status === "pago");
        
        // Use subtotal for comparison metrics too
        const prevTotalReservado = prevAtivos.reduce((sum, c) => sum + (c.subtotal || 0), 0);
        const prevTotalPago = prevPagos.reduce((sum, c) => sum + (c.subtotal || 0), 0);
        const prevPedidosAtivos = prevAtivos.length;
        const prevTaxaConversao = prevTotalReservado > 0 ? (prevTotalPago / prevTotalReservado) * 100 : 0;
        const prevTicketMedio = prevPagos.length > 0 ? prevTotalPago / prevPagos.length : 0;
        
        let prevTotalPecas = 0;
        prevPagos.forEach(cart => {
          (cart.items || []).forEach((item: any) => {
            if (item.status === "confirmado") {
              prevTotalPecas += item.qtd;
            }
          });
        });
        const prevPecasPorAtendimento = prevPagos.length > 0 ? prevTotalPecas / prevPagos.length : 0;

        // Calculate percentage changes
        comparison = {
          totalReservado: prevTotalReservado > 0 ? ((totalReservado - prevTotalReservado) / prevTotalReservado) * 100 : null,
          totalPago: prevTotalPago > 0 ? ((totalPago - prevTotalPago) / prevTotalPago) * 100 : null,
          pedidosAtivos: prevPedidosAtivos > 0 ? ((pedidosAtivos - prevPedidosAtivos) / prevPedidosAtivos) * 100 : null,
          taxaConversao: prevTaxaConversao > 0 ? taxaConversao - prevTaxaConversao : null, // absolute difference for percentages
          ticketMedio: prevTicketMedio > 0 ? ((ticketMedio - prevTicketMedio) / prevTicketMedio) * 100 : null,
          pecasPorAtendimento: prevPecasPorAtendimento > 0 ? ((pecasPorAtendimento - prevPecasPorAtendimento) / prevPecasPorAtendimento) * 100 : null,
        };
      }

      setKpis({
        totalReservado,
        totalPago,
        pedidosAtivos,
        taxaConversao,
        ticketMedio,
        pecasPorAtendimento,
        comparison,
        previousLive: previousLiveData ? { id: previousLiveData.id, titulo: previousLiveData.titulo } : null,
      });

      // Build funnel stages
      const funnelStages: FunnelStage[] = [];
      
      // Stage 1: Reservado (all non-cancelled)
      const reservados = carrinhosAtivos;
      funnelStages.push({
        key: 'reservado',
        label: 'Reservado',
        count: reservados.length,
        value: totalReservado,
        conversionFromPrevious: 100,
        color: 'blue',
      });

      // Stage 2: Cobrado (charge_attempts > 0)
      const cobrados = carrinhosAtivos.filter(c => (c.charge_attempts || 0) > 0);
      const cobraValor = cobrados.reduce((sum, c) => sum + (c.subtotal || 0), 0);
      funnelStages.push({
        key: 'cobrado',
        label: 'Cobrado',
        count: cobrados.length,
        value: cobraValor,
        conversionFromPrevious: reservados.length > 0 ? (cobrados.length / reservados.length) * 100 : 0,
        color: 'amber',
      });

      // Stage 3: Pago
      funnelStages.push({
        key: 'pago',
        label: 'Pago',
        count: carrinhosPagos.length,
        value: totalPago,
        conversionFromPrevious: cobrados.length > 0 ? (carrinhosPagos.length / cobrados.length) * 100 : 0,
        color: 'green',
      });

      // Stage 4: Separado
      const separados = carrinhosPagos.filter(c => 
        c.separation_status === 'separado' || 
        ['etiqueta_gerada', 'postado', 'em_rota', 'entregue', 'retirado'].includes(c.operational_status || '')
      );
      const separadoValor = separados.reduce((sum, c) => sum + (c.subtotal || 0), 0);
      funnelStages.push({
        key: 'separado',
        label: 'Separado',
        count: separados.length,
        value: separadoValor,
        conversionFromPrevious: carrinhosPagos.length > 0 ? (separados.length / carrinhosPagos.length) * 100 : 0,
        color: 'purple',
      });

      // Stage 5: Enviado/Retirado
      const enviados = carrinhosPagos.filter(c => 
        ['postado', 'em_rota', 'entregue', 'retirado'].includes(c.operational_status || '')
      );
      const enviadoValor = enviados.reduce((sum, c) => sum + (c.subtotal || 0), 0);
      funnelStages.push({
        key: 'enviado',
        label: 'Enviado/Retirado',
        count: enviados.length,
        value: enviadoValor,
        conversionFromPrevious: separados.length > 0 ? (enviados.length / separados.length) * 100 : 0,
        color: 'indigo',
      });

      // Stage 6: Entregue (includes 'entregue' AND 'retirado' as both are final delivery states)
      const entregues = carrinhosPagos.filter(c => 
        c.operational_status === 'entregue' || c.operational_status === 'retirado'
      );
      const entregueValor = entregues.reduce((sum, c) => sum + (c.subtotal || 0), 0);
      funnelStages.push({
        key: 'entregue',
        label: 'Entregue',
        count: entregues.length,
        value: entregueValor,
        conversionFromPrevious: enviados.length > 0 ? (entregues.length / enviados.length) * 100 : 100,
        color: 'emerald',
      });

      setFunnel(funnelStages);

      // Calculate seller performance
      const sellerMap = new Map<string | null, { pedidos: number; valorPago: number; valorReservado: number; pecas: number }>();
      
      carrinhosAtivos.forEach(cart => {
        const sellerId = cart.seller_id || null;
        const existing = sellerMap.get(sellerId) || { pedidos: 0, valorPago: 0, valorReservado: 0, pecas: 0 };
        // Use subtotal for seller performance metrics
        existing.valorReservado += cart.subtotal || 0;
        
        if (cart.status === 'pago') {
          existing.pedidos += 1;
          existing.valorPago += cart.subtotal || 0;
          (cart.items || []).forEach((item: any) => {
            if (item.status === 'confirmado') existing.pecas += item.qtd;
          });
        }
        
        sellerMap.set(sellerId, existing);
      });

      const performanceList: SellerPerformance[] = [];
      sellerMap.forEach((data, sellerId) => {
        const seller = sellers.find(s => s.id === sellerId);
        performanceList.push({
          sellerId,
          sellerName: seller?.name || 'Sem vendedora',
          pedidos: data.pedidos,
          valorReservado: data.valorReservado,
          valorPago: data.valorPago,
          ticketMedio: data.pedidos > 0 ? data.valorPago / data.pedidos : 0,
          taxaConversao: data.valorReservado > 0 ? (data.valorPago / data.valorReservado) * 100 : 0,
          rank: 0,
          badges: [],
          performanceScore: 0,
        });
      });

      // Sort by value and assign ranks
      performanceList.sort((a, b) => b.valorPago - a.valorPago);
      performanceList.forEach((p, i) => {
        p.rank = i + 1;
      });

      // Find sellers with activity for badge calculation
      const activeSellers = performanceList.filter(s => s.valorPago > 0);
      
      if (activeSellers.length > 0) {
        // Badge: Maior Faturamento (highest valorPago)
        const maxFaturamento = Math.max(...activeSellers.map(s => s.valorPago));
        const topFaturamento = activeSellers.find(s => s.valorPago === maxFaturamento);
        if (topFaturamento) {
          topFaturamento.badges.push('maior_faturamento');
        }

        // Badge: Mais Pedidos Pagos (highest pedidos count)
        const maxPedidos = Math.max(...activeSellers.map(s => s.pedidos));
        const topPedidos = activeSellers.find(s => s.pedidos === maxPedidos);
        if (topPedidos) {
          topPedidos.badges.push('mais_pedidos');
        }

        // Badge: Maior Conversão (highest conversion with minimum base)
        // Minimum base: >=3 orders OR >=R$300 reserved
        const eligibleForConversion = activeSellers.filter(
          s => s.pedidos >= 3 || s.valorReservado >= 300
        );
        if (eligibleForConversion.length > 0) {
          const maxConversao = Math.max(...eligibleForConversion.map(s => s.taxaConversao));
          const topConversao = eligibleForConversion.find(s => s.taxaConversao === maxConversao);
          if (topConversao && topConversao.taxaConversao > 0) {
            topConversao.badges.push('maior_conversao');
          }
        }

        // Calculate performance score for all active sellers
        const maxValorPago = Math.max(...activeSellers.map(s => s.valorPago), 1);
        const maxPedidosCount = Math.max(...activeSellers.map(s => s.pedidos), 1);

        activeSellers.forEach(seller => {
          const normValor = seller.valorPago / maxValorPago;
          const normConversao = seller.taxaConversao / 100;
          const normPedidos = seller.pedidos / maxPedidosCount;
          
          // Score = 0.45*valor + 0.35*conversao + 0.20*pedidos
          seller.performanceScore = (0.45 * normValor) + (0.35 * normConversao) + (0.20 * normPedidos);
        });

        // Badge: Melhor Performance Geral (highest weighted score)
        if (activeSellers.length >= 2) {
          const sortedByScore = [...activeSellers].sort((a, b) => b.performanceScore - a.performanceScore);
          const topPerformance = sortedByScore[0];
          // Only give this badge if winner doesn't already have all other badges
          if (topPerformance.badges.length < 3 && topPerformance.performanceScore > 0.5) {
            topPerformance.badges.push('melhor_performance');
          }
        }
      }

      // Badge: Atenção (low conversion with significant reserved value but no paid orders)
      performanceList.forEach(seller => {
        if (seller.taxaConversao < 30 && seller.valorReservado > 200 && seller.pedidos === 0) {
          seller.badges.push('attention');
        }
      });

      setSellerPerformance(performanceList);

      // Calculate actionable insights
      const now = Date.now();
      const h24 = 24 * 60 * 60 * 1000;
      const h12 = 12 * 60 * 60 * 1000;

      const insightsList: ActionableInsight[] = [];

      // Aguardando retorno > 24h
      const aguardandoRetorno = carrinhosAtivos.filter(c => {
        if (c.status !== 'aguardando_pagamento' || (c.charge_attempts || 0) === 0) return false;
        const lastCharge = c.last_charge_at ? new Date(c.last_charge_at).getTime() : 0;
        return (now - lastCharge) > h24;
      });
      if (aguardandoRetorno.length > 0) {
        insightsList.push({
          key: 'aguardando_retorno_24h',
          label: 'Aguardando retorno >24h',
          count: aguardandoRetorno.length,
          value: aguardandoRetorno.reduce((sum, c) => sum + (c.subtotal || 0), 0),
          severity: 'danger',
          filterKey: 'aguardando_retorno',
          icon: 'clock',
        });
      }

      // Não cobrados
      const naoCobrados = carrinhosAtivos.filter(c => 
        c.status === 'aguardando_pagamento' && (c.charge_attempts || 0) === 0
      );
      if (naoCobrados.length > 0) {
        insightsList.push({
          key: 'nao_cobrados',
          label: 'Pedidos não cobrados',
          count: naoCobrados.length,
          value: naoCobrados.reduce((sum, c) => sum + (c.subtotal || 0), 0),
          severity: 'warning',
          filterKey: 'needs_charge',
          icon: 'send',
        });
      }

      // Pagos sem logística
      const pagosSemLogistica = carrinhosPagos.filter(c => 
        !c.operational_status || c.operational_status === 'aguardando_pagamento' || c.operational_status === 'pago'
      );
      if (pagosSemLogistica.length > 0) {
        const old = pagosSemLogistica.filter(c => {
          const paidAt = c.paid_at ? new Date(c.paid_at).getTime() : new Date(c.updated_at).getTime();
          return (now - paidAt) > h12;
        });
        if (old.length > 0) {
          insightsList.push({
            key: 'pagos_sem_logistica',
            label: 'Pagos sem logística iniciada',
            count: old.length,
            value: old.reduce((sum, c) => sum + (c.subtotal || 0), 0),
            severity: 'warning',
            filterKey: 'preparar_envio',
            icon: 'package',
          });
        }
      }

      // Etiquetas pendentes (correios)
      const etiquetasPendentes = carrinhosPagos.filter(c => 
        c.delivery_method === 'correios' && 
        (!c.operational_status || !['etiqueta_gerada', 'postado', 'entregue'].includes(c.operational_status))
      );
      if (etiquetasPendentes.length > 0) {
        insightsList.push({
          key: 'etiquetas_pendentes',
          label: 'Etiquetas pendentes',
          count: etiquetasPendentes.length,
          value: etiquetasPendentes.reduce((sum, c) => sum + (c.subtotal || 0), 0),
          severity: 'info',
          filterKey: 'correios',
          icon: 'tag',
        });
      }

      // Sem vendedora
      const semVendedora = carrinhosAtivos.filter(c => !c.seller_id);
      if (semVendedora.length > 0) {
        insightsList.push({
          key: 'sem_vendedora',
          label: 'Pedidos sem vendedora',
          count: semVendedora.length,
          value: semVendedora.reduce((sum, c) => sum + (c.subtotal || 0), 0),
          severity: 'info',
          filterKey: 'none',
          icon: 'user',
        });
      }

      // Pagamento pendente de validação
      const pendingValidation = carrinhosAtivos.filter(c => c.payment_review_status === 'pending_review');
      if (pendingValidation.length > 0) {
        insightsList.push({
          key: 'pending_validation',
          label: 'Pagamentos pendentes de validação',
          count: pendingValidation.length,
          value: pendingValidation.reduce((sum, c) => sum + (c.subtotal || 0), 0),
          severity: 'danger',
          filterKey: 'pending_proof',
          icon: 'shield',
        });
      }

      setInsights(insightsList);

      // Calculate top products
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
      setTopProducts(Array.from(productMap.values()).sort((a, b) => b.valorTotal - a.valorTotal));

      // Customer sales
      const visibleItemStatuses = ["reservado", "confirmado", "expirado", "removido", "cancelado"];
      const activeItemStatuses = ["reservado", "confirmado"];
      
      const customerSalesData: CustomerSale[] = carts
        .filter(c => c.live_customer && c.status !== 'cancelado')
        .map(cart => {
          const displayItems = (cart.items || []).filter((i: any) => visibleItemStatuses.includes(i.status));
          const activeItems = (cart.items || []).filter((i: any) => activeItemStatuses.includes(i.status));
          
          return {
            customerId: cart.live_customer_id,
            cartId: cart.id,
            instagram: cart.live_customer?.instagram_handle || "",
            nome: cart.live_customer?.nome || null,
            whatsapp: cart.live_customer?.whatsapp || null,
            valorTotal: cart.total,
            itens: displayItems.length,
            activeItens: activeItems.length,
            status: cart.status,
            items: displayItems,
            mpCheckoutUrl: cart.mp_checkout_url || null,
            publicToken: (cart as any).public_token || null,
          };
        })
        .sort((a, b) => b.valorTotal - a.valorTotal);
      setCustomerSales(customerSalesData);

      // Timeline data
      const allItems: { timestamp: number; valor: number; isPago: boolean }[] = [];
      carts.forEach(cart => {
        const isPago = cart.status === "pago";
        (cart.items || []).forEach((item: any) => {
          if (["reservado", "confirmado", "expirado"].includes(item.status)) {
            const timestamp = new Date(item.reservado_em).getTime();
            allItems.push({ timestamp, valor: item.preco_unitario * item.qtd, isPago });
          }
        });
      });
      allItems.sort((a, b) => a.timestamp - b.timestamp);

      let reservadoAcumulado = 0;
      let pagoAcumulado = 0;
      const timeline: TimelineDataPoint[] = allItems.map(item => {
        reservadoAcumulado += item.valor;
        if (item.isPago) pagoAcumulado += item.valor;
        const date = new Date(item.timestamp);
        return {
          time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          timestamp: item.timestamp,
          reservadoMomento: item.valor,
          reservadoAcumulado,
          pagoAcumulado,
        };
      });
      setTimelineData(timeline);

    } catch (err) {
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

  // Real-time subscriptions
  useEffect(() => {
    if (!eventId) return;

    channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
    channelsRef.current = [];
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        fetchReportData({ silent: hasLoadedOnceRef.current });
      }, 350);
    };

    const cartsChannel = supabase
      .channel(`live_reports_v2_carts_${eventId}_${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_carts", filter: `live_event_id=eq.${eventId}` }, scheduleRefresh)
      .subscribe();

    const itemsChannel = supabase
      .channel(`live_reports_v2_items_${eventId}_${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_cart_items" }, scheduleRefresh)
      .subscribe();

    channelsRef.current = [cartsChannel, itemsChannel];

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
    previousEvent,
    kpis,
    funnel,
    sellerPerformance,
    insights,
    topProducts,
    customerSales,
    timelineData,
    isLoading,
    refetch: fetchReportData,
  };
}
