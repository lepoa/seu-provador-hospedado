import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  CheckCircle,
  ShoppingBag,
  Target,
  CreditCard,
  Package,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { LiveReportKPIsV2 } from "@/hooks/useLiveReportsV2";

interface LiveReportOverviewProps {
  kpis: LiveReportKPIsV2;
}

export function LiveReportOverview({ kpis }: LiveReportOverviewProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatPercent = (value: number | null) => {
    if (value === null) return null;
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const renderComparison = (value: number | null, isPercentagePoint = false) => {
    if (value === null) return null;
    
    const isPositive = value > 0;
    const isNeutral = Math.abs(value) < 0.5;
    
    if (isNeutral) {
      return (
        <span className="text-xs text-muted-foreground ml-1">
          (=)
        </span>
      );
    }

    return (
      <span className={`inline-flex items-center gap-0.5 text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {isPercentagePoint ? `${value > 0 ? '+' : ''}${value.toFixed(1)}pp` : formatPercent(value)}
      </span>
    );
  };

  const cards = [
    {
      title: "Total Reservado",
      value: formatCurrency(kpis.totalReservado),
      comparison: kpis.comparison.totalReservado,
      icon: DollarSign,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      highlight: true,
      highlightColor: "border-blue-200 bg-gradient-to-br from-blue-50 to-white",
    },
    {
      title: "Total Pago",
      value: formatCurrency(kpis.totalPago),
      comparison: kpis.comparison.totalPago,
      icon: CheckCircle,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      highlight: true,
      highlightColor: "border-green-200 bg-gradient-to-br from-green-50 to-white",
    },
    {
      title: "Pedidos Ativos",
      value: kpis.pedidosAtivos.toString(),
      comparison: kpis.comparison.pedidosAtivos,
      icon: ShoppingBag,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
    },
    {
      title: "Taxa de Conversão",
      value: `${kpis.taxaConversao.toFixed(1)}%`,
      comparison: kpis.comparison.taxaConversao,
      isPercentagePoint: true,
      icon: Target,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
    },
    {
      title: "Ticket Médio",
      value: formatCurrency(kpis.ticketMedio),
      comparison: kpis.comparison.ticketMedio,
      icon: CreditCard,
      iconBg: "bg-teal-100",
      iconColor: "text-teal-600",
    },
    {
      title: "P.A. (Peças/Atend.)",
      value: kpis.pecasPorAtendimento.toFixed(1),
      comparison: kpis.comparison.pecasPorAtendimento,
      icon: Package,
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Visão Geral</h2>
        {kpis.previousLive && (
          <span className="text-xs text-muted-foreground">
            Comparado com: {kpis.previousLive.titulo}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card, index) => (
          <Card 
            key={index} 
            className={`relative overflow-hidden ${card.highlight ? `border-2 ${card.highlightColor}` : ''}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className={`p-2 rounded-lg ${card.iconBg}`}>
                  <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline gap-1 flex-wrap">
                  <span className={`text-xl font-bold ${card.highlight ? (index === 0 ? 'text-blue-700' : 'text-green-700') : ''}`}>
                    {card.value}
                  </span>
                  {renderComparison(card.comparison, card.isPercentagePoint)}
                </div>
                <p className="text-xs text-muted-foreground">{card.title}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
