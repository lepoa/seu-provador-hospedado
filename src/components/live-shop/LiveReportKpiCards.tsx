import { 
  DollarSign, 
  ShoppingCart, 
  Package, 
  TrendingUp, 
  Target,
  CreditCard,
  CheckCircle,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { LiveReportKPIs } from "@/hooks/useLiveReports";

interface LiveReportKpiCardsProps {
  kpis: LiveReportKPIs;
}

export function LiveReportKpiCards({ kpis }: LiveReportKpiCardsProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  };

  const cards = [
    {
      title: "Total Reservado",
      value: formatPrice(kpis.totalReservado),
      subtitle: `${kpis.totalItensReservados} itens em ${kpis.totalCarrinhos - kpis.carrinhosPagos} carrinhos`,
      icon: ShoppingCart,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      highlight: true,
    },
    {
      title: "Total Pago",
      value: formatPrice(kpis.totalPago),
      subtitle: `${kpis.carrinhosPagos} vendas confirmadas`,
      icon: CheckCircle,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
    },
    {
      title: "Ticket Médio",
      value: formatPrice(kpis.ticketMedioReservado),
      subtitle: "Por carrinho",
      icon: CreditCard,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
    },
    {
      title: "Taxa de Conversão",
      value: `${kpis.taxaConversao.toFixed(1)}%`,
      subtitle: `${kpis.carrinhosPagos} de ${kpis.totalCarrinhos} carrinhos`,
      icon: Target,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
    },
    {
      title: "Vendas por Hora",
      value: formatPrice(kpis.vendasPorHora),
      subtitle: kpis.duracaoMinutos > 0 ? formatDuration(kpis.duracaoMinutos) : "Duração não registrada",
      icon: TrendingUp,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
    },
    {
      title: "Taxa de Pagamento",
      value: `${kpis.taxaPagamento.toFixed(1)}%`,
      subtitle: "Valor pago vs. reservado",
      icon: DollarSign,
      iconBg: "bg-teal-100",
      iconColor: "text-teal-600",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Main KPIs - Reservado vs Pago */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="relative overflow-hidden border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 rounded-lg bg-blue-100">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                <Clock className="h-3 w-3" />
                <span>{kpis.carrinhosAbertos + kpis.carrinhosAguardando} pendentes</span>
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-blue-700">{formatPrice(kpis.totalReservado)}</div>
            <div className="text-sm font-medium text-blue-600 mt-1">Total Reservado na Live</div>
            <div className="text-xs text-muted-foreground mt-1">
              {kpis.totalItensReservados} itens • {kpis.totalCarrinhos} carrinhos
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 rounded-lg bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                <CheckCircle className="h-3 w-3" />
                <span>{kpis.carrinhosPagos} pagos</span>
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-green-700">{formatPrice(kpis.totalPago)}</div>
            <div className="text-sm font-medium text-green-600 mt-1">Total Pago</div>
            <div className="text-xs text-muted-foreground mt-1">
              {kpis.totalItensPagos} itens confirmados • Ticket médio: {formatPrice(kpis.ticketMedioPago)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.slice(2).map((card, index) => (
          <Card key={index} className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className={`p-2 rounded-lg ${card.iconBg}`}>
                  <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                </div>
              </div>
              <div className="text-2xl font-bold tracking-tight">{card.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{card.title}</div>
              <div className="text-xs text-muted-foreground/70 mt-0.5">{card.subtitle}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
