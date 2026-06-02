import { useState, useEffect, useMemo } from "react";
import { Loader2, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Radio, Store, Brain, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardDataV2, DashboardFilters } from "@/hooks/useDashboardDataV2";
import { useIsMobile } from "@/hooks/use-mobile";
import { dashboardNavigation } from "@/lib/dashboardNavigation";
import { DashboardFiltersBar } from "./DashboardFilters";
import { DashboardMobileFilters } from "./DashboardMobileFilters";
import { DashboardSellerPerformance } from "./DashboardSellerPerformance";
import { DashboardTopCustomers } from "./DashboardTopCustomers";


// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

const PAID_STATUSES = new Set([
  "pago","confirmado","preparar_envio","etiqueta_gerada","postado","em_rota","retirada","entregue","enviado",
]);

function isPaidOrder(status: string, paymentStatus?: string | null) {
  return PAID_STATUSES.has((status || "").toLowerCase()) || paymentStatus === "approved";
}

const fmtCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtPercent = (v: number) => `${v.toFixed(1)}%`;

const fmtChange = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

// ──────────────────────────────────────────────
// FAIXA 1: KPI PULSE CARDS
// ──────────────────────────────────────────────

function PulseCard({ title, value, variation, onClick }: { title: string; value: string; variation: number; onClick?: () => void }) {
  const isPositive = variation >= 0;
  return (
    <Card
      className={`border-[#cfb98666] bg-white shadow-sm ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4 sm:p-5">
        <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.16em] text-[#786847]">{title}</p>
        <p className="mt-1.5 text-2xl sm:text-3xl font-semibold tracking-tight text-[#102820]">{value}</p>
        {variation !== 0 && (
          <div className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${isPositive ? "text-emerald-700" : "text-red-600"}`}>
            {isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {fmtChange(variation)}
            <span className="text-[#9a8b6e] font-normal hidden sm:inline">vs anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────
// FAIXA 2: ATENÇÃO NECESSÁRIA
// ──────────────────────────────────────────────

interface AttentionItem {
  icon: string;
  severity: "error" | "warning" | "info";
  label: string;
  value: number;
  onClick?: () => void;
}

function AttentionSection({ items, onResolveAll }: { items: AttentionItem[]; onResolveAll: () => void }) {
  if (items.length === 0) {
    return (
      <Card className="border-[#81c784] bg-[#e8f5e9] shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-[#2e7d32]">
            <span className="text-lg">✅</span>
            <span className="font-medium">Tudo em dia! Nenhuma pendência operacional.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const severityBg: Record<string, string> = {
    error: "bg-[#ffcdd2] text-[#b71c1c] border-[#ef9a9a]",
    warning: "bg-[#ffe0b2] text-[#e65100] border-[#ffb74d]",
    info: "bg-[#fff9c4] text-[#f57f17] border-[#fff176]",
  };

  return (
    <Card className="border-[#cfb98666] bg-white shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-[#102820]">
            <AlertTriangle className="h-4 w-4 text-[#e65100]" />
            Atenção Necessária
          </CardTitle>
          <Badge variant="outline" className={items.some(i => i.severity === "error") ? "border-[#ef9a9a] bg-[#ffebee] text-[#b71c1c]" : "border-[#ffb74d] bg-[#fff3e0] text-[#e65100]"}>
            {items.length} {items.length === 1 ? "item" : "itens"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`flex items-center justify-between rounded-md border px-3 py-2.5 ${severityBg[item.severity]} ${item.onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
            onClick={item.onClick}
          >
            <div className="flex items-center gap-2">
              <span>{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </div>
            <span className="text-sm font-semibold">{fmtCurrency(item.value)}</span>
          </div>
        ))}
        <Button className="mt-2 w-full sm:w-auto" onClick={onResolveAll}>
          Ver todas as pendências
        </Button>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────
// FAIXA 3: PERFORMANCE (Top Products + Channels inline)
// ──────────────────────────────────────────────

interface TopProduct { id: string; name: string; revenue: number; quantity: number; }

function TopProductsCard({ products, isLoading }: { products: TopProduct[]; isLoading: boolean }) {
  return (
    <Card className="border-[#cfb98666] bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#102820]">
          <TrendingUp className="h-4 w-4 text-[#8d6f37]" />
          Top Produtos (7 dias)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-[#70624a]">Carregando...</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-[#70624a]">Sem vendas pagas no período.</p>
        ) : (
          products.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border border-[#e3d4b366] px-3 py-2">
              <p className="truncate text-sm text-[#2f2a22]">#{i + 1} {p.name}</p>
              <p className="text-sm font-semibold text-[#102820] whitespace-nowrap ml-2">{fmtCurrency(p.revenue)}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ChannelsSummaryCard({ catalog, live }: { catalog: { pago: number; conversao: number }; live: { pago: number; conversao: number } }) {
  return (
    <Card className="border-[#cfb98666] bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#102820]">
          <Radio className="h-4 w-4 text-[#8d6f37]" />
          Live vs Catálogo
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-[#e3d4b366] p-3">
          <p className="mb-1 flex items-center gap-1 text-xs uppercase tracking-wide text-[#7f6e4a]">
            <Store className="h-3.5 w-3.5" /> Catálogo
          </p>
          <p className="text-lg font-semibold text-[#102820]">{fmtCurrency(catalog.pago)}</p>
          <p className="text-xs text-[#70624a]">Conv. {fmtPercent(catalog.conversao)}</p>
        </div>
        <div className="rounded-md border border-[#e3d4b366] p-3">
          <p className="mb-1 flex items-center gap-1 text-xs uppercase tracking-wide text-[#7f6e4a]">
            <Radio className="h-3.5 w-3.5" /> Live
          </p>
          <p className="text-lg font-semibold text-[#102820]">{fmtCurrency(live.pago)}</p>
          <p className="text-xs text-[#70624a]">Conv. {fmtPercent(live.conversao)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────
// FAIXA 4: INTELIGÊNCIA (Health + Projection)
// ──────────────────────────────────────────────

function IntelligenceSection({ intelligence }: { intelligence: any }) {
  if (!intelligence) return null;
  const { health, projection, operational } = intelligence;
  const trendPositive = health.trend >= 0;

  const classLabel: Record<string, string> = {
    strong: "Operação forte", stable: "Operação estável", attention: "Ponto de atenção", risk: "Risco operacional",
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="border-[#cfb98666] bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#102820]">
            <Brain className="h-4 w-4 text-[#8a6e3a]" />
            Saúde da Operação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div className="text-3xl font-bold text-[#102820]">{Math.round(health.score)} / 100</div>
            <Badge variant="outline" className="border-[#cfb986] bg-[#f5ecd8] text-[#6e5a30]">
              {classLabel[health.classification] || health.classification}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-sm text-[#6d6556]">
            {trendPositive ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
            Tendência: {trendPositive ? "+" : ""}{health.trend.toFixed(1)} vs média 7 dias
          </div>
          <div className="rounded-md border border-[#cfb98666] bg-[#f8f2e4] px-3 py-2">
            <div className="text-xs text-[#6d6556]">Operação hoje</div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-[#102820]">{Math.round(operational.score)} / 100</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#cfb98666] bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#102820]">
            <Sparkles className="h-4 w-4 text-[#8a6e3a]" />
            Projeção Próximos 7 Dias
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-3xl font-bold text-[#102820]">{fmtCurrency(projection.projected_7d_revenue)}</div>
          <div className="text-xs text-[#6d6556]">Média diária: {fmtCurrency(projection.average_daily_7d)}</div>
          {projection.rfv_pending_impact_7d > 0 && (
            <div className="text-xs text-[#6d6556]">Impacto RFV pendente: {fmtCurrency(projection.rfv_pending_impact_7d)}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────
// MAIN: DashboardOverviewV2
// ──────────────────────────────────────────────

export function DashboardOverviewV2() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState<DashboardFilters>({
    period: "7days",
    channel: "all",
    liveEventId: null,
    sellerId: null,
  });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [isTopProductsLoading, setIsTopProductsLoading] = useState(false);

  const {
    kpis, executivePulse, intelligence, channelComparison, sellerPerformance, topCustomers, pendingActions, sellers, liveEvents, isLoading, refetch, dateRange,
  } = useDashboardDataV2(filters);

  // Load top products
  useEffect(() => {
    const load = async () => {
      setIsTopProductsLoading(true);
      try {
        const last7Start = new Date(dateRange.endDate);
        last7Start.setDate(last7Start.getDate() - 6);
        last7Start.setHours(0, 0, 0, 0);
        const last7End = new Date(dateRange.endDate);
        last7End.setHours(23, 59, 59, 999);

        let q = supabase.from("orders").select("id, status, payment_status, live_event_id, seller_id")
          .gte("created_at", last7Start.toISOString()).lte("created_at", last7End.toISOString());
        if (filters.channel === "catalog") q = q.is("live_event_id", null);
        else if (filters.channel === "live") q = q.not("live_event_id", "is", null);
        if (filters.liveEventId) q = q.eq("live_event_id", filters.liveEventId);
        if (filters.sellerId) q = q.eq("seller_id", filters.sellerId);

        const { data: orders } = await q;
        const paidIds = (orders || []).filter(o => isPaidOrder(o.status, o.payment_status)).map(o => o.id);
        if (paidIds.length === 0) { setTopProducts([]); return; }

        const { data: items } = await supabase.from("order_items")
          .select("product_id, product_name, quantity, product_price, subtotal").in("order_id", paidIds);

        const agg = new Map<string, TopProduct>();
        (items || []).forEach(item => {
          const revenue = Number(item.subtotal ?? Number(item.product_price || 0) * Number(item.quantity || 0));
          const qty = Number(item.quantity || 0);
          if (!item.product_id || qty <= 0) return;
          const ex = agg.get(item.product_id);
          if (ex) { ex.revenue += revenue; ex.quantity += qty; }
          else agg.set(item.product_id, { id: item.product_id, name: item.product_name || "Produto", revenue, quantity: qty });
        });
        setTopProducts(Array.from(agg.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5));
      } catch { setTopProducts([]); }
      finally { setIsTopProductsLoading(false); }
    };
    void load();
  }, [dateRange.endDate, filters.channel, filters.liveEventId, filters.sellerId]);

  // Map PendingOrderType → direct status filter URL (op_ filters in OrdersManager)
  const pendingTypeToLink: Record<string, string> = {
    aguardando_pagamento_24h: '/dashboard?tab=orders&status=op_aguardando_pagamento_24h',
    aguardando_retorno_24h: '/dashboard?tab=orders&status=op_aguardando_retorno_24h',
    nao_cobrado: '/dashboard?tab=orders&status=op_pendencias',
    pago_sem_logistica: '/dashboard?tab=orders&status=op_pago_sem_logistica',
    etiqueta_pendente: '/dashboard?tab=orders&status=op_etiqueta_pendente',
    sem_vendedora: '/dashboard?tab=orders&status=op_sem_vendedora',
    urgente: '/dashboard?tab=orders&status=op_pendencias',
  };

  // Build attention items from pending actions + cancels
  const attentionItems = useMemo<AttentionItem[]>(() => {
    if (!kpis) return [];
    const items: AttentionItem[] = [];

    pendingActions.forEach(pa => {
      const link = pendingTypeToLink[pa.type] || dashboardNavigation.pendencias();
      items.push({
        icon: pa.severity === "error" ? "🔴" : pa.severity === "warning" ? "🟠" : "🟡",
        severity: pa.severity as "error" | "warning" | "info",
        label: `${pa.count} ${pa.title.toLowerCase()}`,
        value: pa.value,
        onClick: () => navigate(link),
      });
    });

    if (kpis.cancelados > 0) {
      items.push({
        icon: "🟡",
        severity: "info",
        label: `${kpis.cancelados} cancelamento${kpis.cancelados > 1 ? "s" : ""} no período`,
        value: kpis.cancelados * kpis.ticketMedio.value,
        onClick: () => navigate(dashboardNavigation.cancelados()),
      });
    }

    return items.sort((a, b) => {
      const w: Record<string, number> = { error: 3, warning: 2, info: 1 };
      return (w[b.severity] || 0) - (w[a.severity] || 0) || b.value - a.value;
    }).slice(0, 5);
  }, [kpis, pendingActions, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!kpis || !executivePulse) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Erro ao carregar dados</p>
        <Button onClick={refetch} variant="outline" className="mt-4">Tentar novamente</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold sm:text-xl">Visão Geral</h2>
          <p className="hidden text-xs text-muted-foreground sm:block sm:text-sm">Dados consolidados do seu negócio</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isMobile && (
            <DashboardMobileFilters filters={filters} onFiltersChange={setFilters} sellers={sellers} liveEvents={liveEvents} />
          )}
          <Button variant="outline" size="sm" onClick={refetch} className="h-9 gap-2">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {!isMobile && <DashboardFiltersBar filters={filters} onFiltersChange={setFilters} sellers={sellers} liveEvents={liveEvents} />}

      {/* ═══════════════════════════════════════════════
          FAIXA 1: PAINEL DE COMANDO (6 Pulse Cards)
      ═══════════════════════════════════════════════ */}
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <PulseCard title="Faturamento" value={fmtCurrency(executivePulse.receita7d.value)} variation={executivePulse.receita7d.changePercent}
            onClick={() => navigate(dashboardNavigation.faturamentoPago())} />
          <PulseCard title="Reservado" value={fmtCurrency(kpis.reservado.value)} variation={kpis.reservado.changePercent}
            onClick={() => navigate(dashboardNavigation.reservado())} />
          <PulseCard title="Conversão" value={fmtPercent(executivePulse.conversao.value)} variation={executivePulse.conversao.changePercent}
            onClick={() => navigate(dashboardNavigation.conversao())} />
          <PulseCard title="Ticket Médio" value={fmtCurrency(executivePulse.ticketMedio.value)} variation={executivePulse.ticketMedio.changePercent} />
          <PulseCard title="P.A." value={kpis.pecasAtendimento.value.toFixed(1)} variation={kpis.pecasAtendimento.changePercent} />
          <PulseCard title="Pendências" value={kpis.pendenciasOperacionais.value.toString()} variation={kpis.pendenciasOperacionais.changePercent}
            onClick={() => navigate('/dashboard?tab=orders&status=op_pendencias')} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          FAIXA 2: ATENÇÃO NECESSÁRIA
      ═══════════════════════════════════════════════ */}
      <section>
        <AttentionSection items={attentionItems} onResolveAll={() => navigate('/dashboard?tab=orders&status=op_pendencias')} />
      </section>

      {/* ═══════════════════════════════════════════════
          FAIXA 3: PERFORMANCE
      ═══════════════════════════════════════════════ */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold tracking-wide text-[#6e6148]">Performance</h3>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DashboardSellerPerformance sellers={sellerPerformance} />
          </div>
          <div className="space-y-4">
            <TopProductsCard products={topProducts} isLoading={isTopProductsLoading} />
            {channelComparison && (
              <ChannelsSummaryCard
                catalog={{ pago: channelComparison.catalog.pago, conversao: channelComparison.catalog.conversao }}
                live={{ pago: channelComparison.live.pago, conversao: channelComparison.live.conversao }}
              />
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          FAIXA 4: INTELIGÊNCIA
      ═══════════════════════════════════════════════ */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold tracking-wide text-[#6e6148]">Inteligência</h3>

        <IntelligenceSection intelligence={intelligence} />

        <DashboardTopCustomers customers={topCustomers} />
      </section>


    </div>
  );
}
