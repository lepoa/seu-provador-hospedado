import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  Radio,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type {
  ChannelComparison,
  DashboardFilters,
  DashboardIntelligenceData,
  DashboardKPIsV2,
  ExecutivePulse,
  PendingAction,
} from "@/hooks/useDashboardDataV2";
import { dashboardNavigation } from "@/lib/dashboardNavigation";

const PAID_STATUSES = new Set([
  "pago",
  "confirmado",
  "preparar_envio",
  "etiqueta_gerada",
  "postado",
  "em_rota",
  "retirada",
  "entregue",
  "enviado",
]);

interface DashboardExecutiveCommandCenterProps {
  pulse: ExecutivePulse;
  kpis: DashboardKPIsV2;
  pendingActions: PendingAction[];
  channelComparison: ChannelComparison | null;
  intelligence: DashboardIntelligenceData | null;
  filters: DashboardFilters;
  endDate: Date;
  onResolveNow: () => void;
}

interface TopProduct7d {
  id: string;
  name: string;
  revenue: number;
  quantity: number;
}

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const formatChange = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;

function isPaidOrder(status: string, paymentStatus?: string | null) {
  return PAID_STATUSES.has((status || "").toLowerCase()) || paymentStatus === "approved";
}

function PulseCard({
  title,
  value,
  variation,
}: {
  title: string;
  value: string;
  variation: number;
}) {
  const isPositive = variation >= 0;

  return (
    <Card className="border-[#cfb98666] bg-white shadow-sm">
      <CardContent className="p-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#786847]">{title}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-[#102820]">{value}</p>
        <div className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold ${isPositive ? "text-emerald-700" : "text-red-600"}`}>
          {isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {formatChange(variation)}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardExecutiveCommandCenter({
  pulse,
  kpis,
  pendingActions,
  channelComparison,
  intelligence,
  filters,
  endDate,
  onResolveNow,
}: DashboardExecutiveCommandCenterProps) {
  const navigate = useNavigate();
  const [topProducts, setTopProducts] = useState<TopProduct7d[]>([]);
  const [isTopProductsLoading, setIsTopProductsLoading] = useState(false);

  useEffect(() => {
    const loadTopProducts = async () => {
      setIsTopProductsLoading(true);
      try {
        const last7Start = new Date(endDate);
        last7Start.setDate(last7Start.getDate() - 6);
        last7Start.setHours(0, 0, 0, 0);
        const last7End = new Date(endDate);
        last7End.setHours(23, 59, 59, 999);

        let ordersQuery = supabase
          .from("orders")
          .select("id, status, payment_status, live_event_id, seller_id")
          .gte("created_at", last7Start.toISOString())
          .lte("created_at", last7End.toISOString());

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

        const { data: orders, error: ordersError } = await ordersQuery;
        if (ordersError) throw ordersError;

        const paidOrderIds = (orders || [])
          .filter((order) => isPaidOrder(order.status, order.payment_status))
          .map((order) => order.id);

        if (paidOrderIds.length === 0) {
          setTopProducts([]);
          return;
        }

        const { data: items, error: itemsError } = await supabase
          .from("order_items")
          .select("product_id, product_name, quantity, product_price, subtotal")
          .in("order_id", paidOrderIds);

        if (itemsError) throw itemsError;

        const aggregate = new Map<string, TopProduct7d>();
        (items || []).forEach((item) => {
          const revenue = Number(item.subtotal ?? Number(item.product_price || 0) * Number(item.quantity || 0));
          const quantity = Number(item.quantity || 0);
          if (!item.product_id || quantity <= 0) return;

          const existing = aggregate.get(item.product_id);
          if (existing) {
            existing.revenue += revenue;
            existing.quantity += quantity;
          } else {
            aggregate.set(item.product_id, {
              id: item.product_id,
              name: item.product_name || "Produto",
              revenue,
              quantity,
            });
          }
        });

        const sorted = Array.from(aggregate.values())
          .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity)
          .slice(0, 3);

        setTopProducts(sorted);
      } catch (error) {
        console.error("[Dashboard Executive] top products error:", error);
        setTopProducts([]);
      } finally {
        setIsTopProductsLoading(false);
      }
    };

    void loadTopProducts();
  }, [endDate, filters.channel, filters.liveEventId, filters.sellerId]);

  const riskSummary = useMemo(() => {
    const pendingValue = pendingActions.reduce((sum, item) => sum + item.value, 0);
    const estimatedCancel = kpis.cancelados * kpis.ticketMedio.value;
    const estimatedUnpaid = kpis.pedidosPendentes * kpis.ticketMedio.value;
    const estimatedImpact = pendingValue + estimatedCancel + estimatedUnpaid;

    const severityScore =
      pendingActions.filter((item) => item.severity === "error").length * 3 +
      pendingActions.filter((item) => item.severity === "warning").length +
      (kpis.taxaCancelamento >= 15 ? 2 : 0) +
      (kpis.pedidosPendentes >= 10 ? 2 : 0);

    const status = severityScore >= 4 ? "Crítico" : severityScore > 0 ? "Atenção" : "OK";
    const badgeClass =
      status === "Crítico"
        ? "border-red-200 bg-red-50 text-red-700"
        : status === "Atenção"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700";

    const items = [
      ...pendingActions.map((item) => ({
        label: item.title,
        value: item.value,
        weight: item.severity === "error" ? 3 : item.severity === "warning" ? 2 : 1,
      })),
      ...(kpis.cancelados > 0
        ? [{ label: "Cancelamentos no período", value: estimatedCancel, weight: kpis.taxaCancelamento >= 15 ? 2 : 1 }]
        : []),
      ...(kpis.pedidosPendentes > 0
        ? [{ label: "Reservas não pagas", value: estimatedUnpaid, weight: 1 }]
        : []),
    ]
      .sort((a, b) => b.weight - a.weight || b.value - a.value)
      .slice(0, 3);

    return { status, badgeClass, estimatedImpact, items };
  }, [kpis.cancelados, kpis.pedidosPendentes, kpis.taxaCancelamento, kpis.ticketMedio.value, pendingActions]);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-[#6e6148]">Pulso do Negócio</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <PulseCard title="Receita hoje" value={formatCurrency(pulse.receitaHoje.value)} variation={pulse.receitaHoje.changePercent} />
          <PulseCard title="Receita últimos 7 dias" value={formatCurrency(pulse.receita7d.value)} variation={pulse.receita7d.changePercent} />
          <PulseCard title="Conversão" value={formatPercent(pulse.conversao.value)} variation={pulse.conversao.changePercent} />
          <PulseCard title="Ticket médio" value={formatCurrency(pulse.ticketMedio.value)} variation={pulse.ticketMedio.changePercent} />
        </div>
      </section>

      <section>
        <Card className="border-[#cfb98666] bg-white shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-[#102820]">
                <AlertTriangle className="h-4 w-4 text-[#8d6f37]" />
                Zona de Risco
              </CardTitle>
              <Badge variant="outline" className={riskSummary.badgeClass}>
                {riskSummary.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-[#d8c49a66] bg-[#faf5e9] p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[#7f6e4a]">Impacto estimado</p>
              <p className="mt-1 text-2xl font-semibold text-[#102820]">{formatCurrency(riskSummary.estimatedImpact)}</p>
            </div>

            <div className="space-y-2">
              {riskSummary.items.length === 0 ? (
                <p className="text-sm text-[#70624a]">Sem itens críticos no momento.</p>
              ) : (
                riskSummary.items.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="flex items-center justify-between rounded-md border border-[#e3d4b366] px-3 py-2">
                    <p className="text-sm text-[#2f2a22]">{item.label}</p>
                    <p className="text-sm font-semibold text-[#102820]">{formatCurrency(item.value)}</p>
                  </div>
                ))
              )}
            </div>

            <Button className="w-full sm:w-auto" onClick={onResolveNow}>
              Resolver agora
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold tracking-wide text-[#6e6148]">Performance</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card className="border-[#cfb98666] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#102820]">
                <TrendingUp className="h-4 w-4 text-[#8d6f37]" />
                Top Produtos (7 dias)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isTopProductsLoading ? (
                <p className="text-sm text-[#70624a]">Carregando...</p>
              ) : topProducts.length === 0 ? (
                <p className="text-sm text-[#70624a]">Sem vendas pagas no período.</p>
              ) : (
                topProducts.map((product, index) => (
                  <div key={product.id} className="flex items-center justify-between rounded-md border border-[#e3d4b366] px-3 py-2">
                    <p className="truncate text-sm text-[#2f2a22]">
                      #{index + 1} {product.name}
                    </p>
                    <p className="text-sm font-semibold text-[#102820]">{formatCurrency(product.revenue)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

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
                <p className="text-lg font-semibold text-[#102820]">{formatCurrency(channelComparison?.catalog.pago || 0)}</p>
                <p className="text-xs text-[#70624a]">Conv. {formatPercent(channelComparison?.catalog.conversao || 0)}</p>
              </div>
              <div className="rounded-md border border-[#e3d4b366] p-3">
                <p className="mb-1 flex items-center gap-1 text-xs uppercase tracking-wide text-[#7f6e4a]">
                  <Radio className="h-3.5 w-3.5" /> Live
                </p>
                <p className="text-lg font-semibold text-[#102820]">{formatCurrency(channelComparison?.live.pago || 0)}</p>
                <p className="text-xs text-[#70624a]">Conv. {formatPercent(channelComparison?.live.conversao || 0)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#cfb98666] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#102820]">
                <Users className="h-4 w-4 text-[#8d6f37]" />
                Novos Clientes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-3xl font-semibold text-[#102820]">{kpis.novosClientes.value}</p>
              <p className={`text-xs font-semibold ${kpis.novosClientes.changePercent >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {formatChange(kpis.novosClientes.changePercent)} vs período anterior
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => navigate("/dashboard?tab=clientes")}
              >
                Ver clientes
              </Button>
            </CardContent>
          </Card>

          <Card className="border-[#cfb98666] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#102820]">
                <Clock3 className="h-4 w-4 text-[#8d6f37]" />
                Recompra / RFV
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-3xl font-semibold text-[#102820]">
                {Math.round(intelligence?.health.components.recorrencia || 0)}
              </p>
              <p className="text-xs text-[#70624a]">Score de recorrência atual</p>
              <p className="text-xs text-[#70624a]">
                Impacto RFV 7d: {formatCurrency(intelligence?.projection.rfv_pending_impact_7d || 0)}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => navigate("/dashboard/rfv")}
              >
                Abrir RFV
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
