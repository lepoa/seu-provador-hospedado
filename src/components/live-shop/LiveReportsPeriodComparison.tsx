import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveReportKPIs } from "@/hooks/useLiveReports";

interface ComparisonData {
  current: LiveReportKPIs | null;
  previous: LiveReportKPIs | null;
  currentEvents: number;
  previousEvents: number;
  currentLabel: string;
  previousLabel: string;
}

interface LiveReportsPeriodComparisonProps {
  data: ComparisonData;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);
}

function calculateVariation(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function VariationBadge({ variation, inverted = false }: { variation: number; inverted?: boolean }) {
  const isPositive = inverted ? variation < 0 : variation > 0;
  const isNeutral = Math.abs(variation) < 0.5;
  
  if (isNeutral) {
    return (
      <Badge variant="secondary" className="gap-1 text-xs">
        <Minus className="h-3 w-3" />
        0%
      </Badge>
    );
  }
  
  return (
    <Badge 
      variant="secondary"
      className={cn(
        "gap-1 text-xs",
        isPositive 
          ? "bg-green-100 text-green-700 hover:bg-green-100" 
          : "bg-red-100 text-red-700 hover:bg-red-100"
      )}
    >
      {isPositive ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      {variation > 0 ? "+" : ""}{variation.toFixed(1)}%
    </Badge>
  );
}

interface ComparisonRowProps {
  label: string;
  currentValue: number | string;
  previousValue: number | string;
  variation: number;
  formatAsPrice?: boolean;
  formatAsPercent?: boolean;
  inverted?: boolean;
}

function ComparisonRow({ 
  label, 
  currentValue, 
  previousValue, 
  variation,
  formatAsPrice = false,
  formatAsPercent = false,
  inverted = false,
}: ComparisonRowProps) {
  const formatValue = (val: number | string) => {
    if (typeof val === "string") return val;
    if (formatAsPrice) return formatPrice(val);
    if (formatAsPercent) return `${val.toFixed(1)}%`;
    return val.toLocaleString("pt-BR");
  };
  
  return (
    <div className="grid grid-cols-4 gap-2 py-2 border-b last:border-0 items-center">
      <div className="text-sm text-muted-foreground font-medium">{label}</div>
      <div className="text-right font-semibold">{formatValue(currentValue)}</div>
      <div className="text-right text-muted-foreground">{formatValue(previousValue)}</div>
      <div className="flex justify-end">
        <VariationBadge variation={variation} inverted={inverted} />
      </div>
    </div>
  );
}

export function LiveReportsPeriodComparison({ data }: LiveReportsPeriodComparisonProps) {
  const { current, previous, currentEvents, previousEvents, currentLabel, previousLabel } = data;
  
  if (!current || !previous) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Selecione dois períodos com dados para visualizar a comparação.
        </CardContent>
      </Card>
    );
  }
  
  const comparisons = [
    {
      label: "Total de Lives",
      current: currentEvents,
      previous: previousEvents,
      variation: calculateVariation(currentEvents, previousEvents),
    },
    {
      label: "Faturamento Pago",
      current: current.totalPago,
      previous: previous.totalPago,
      variation: calculateVariation(current.totalPago, previous.totalPago),
      formatAsPrice: true,
    },
    {
      label: "Total Reservado",
      current: current.totalReservado,
      previous: previous.totalReservado,
      variation: calculateVariation(current.totalReservado, previous.totalReservado),
      formatAsPrice: true,
    },
    {
      label: "Ticket Médio",
      current: current.ticketMedioPago,
      previous: previous.ticketMedioPago,
      variation: calculateVariation(current.ticketMedioPago, previous.ticketMedioPago),
      formatAsPrice: true,
    },
    {
      label: "Total de Carrinhos",
      current: current.totalCarrinhos,
      previous: previous.totalCarrinhos,
      variation: calculateVariation(current.totalCarrinhos, previous.totalCarrinhos),
    },
    {
      label: "Carrinhos Pagos",
      current: current.carrinhosPagos,
      previous: previous.carrinhosPagos,
      variation: calculateVariation(current.carrinhosPagos, previous.carrinhosPagos),
    },
    {
      label: "Itens Vendidos",
      current: current.totalItensPagos,
      previous: previous.totalItensPagos,
      variation: calculateVariation(current.totalItensPagos, previous.totalItensPagos),
    },
    {
      label: "Taxa de Conversão",
      current: current.taxaConversao,
      previous: previous.taxaConversao,
      variation: calculateVariation(current.taxaConversao, previous.taxaConversao),
      formatAsPercent: true,
    },
    {
      label: "Taxa de Pagamento",
      current: current.taxaPagamento,
      previous: previous.taxaPagamento,
      variation: calculateVariation(current.taxaPagamento, previous.taxaPagamento),
      formatAsPercent: true,
    },
    {
      label: "Horas de Live",
      current: (current.duracaoMinutos / 60).toFixed(1) + "h",
      previous: (previous.duracaoMinutos / 60).toFixed(1) + "h",
      variation: calculateVariation(current.duracaoMinutos, previous.duracaoMinutos),
    },
  ];
  
  // Calculate summary
  const revenueGrowth = calculateVariation(current.totalPago, previous.totalPago);
  const conversionGrowth = calculateVariation(current.taxaConversao, previous.taxaConversao);
  
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={cn(
          "border-2",
          revenueGrowth > 0 ? "border-green-200 bg-green-50/50" : 
          revenueGrowth < 0 ? "border-red-200 bg-red-50/50" : "border-muted"
        )}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Crescimento Faturamento</p>
                <p className={cn(
                  "text-2xl font-bold",
                  revenueGrowth > 0 ? "text-green-600" : 
                  revenueGrowth < 0 ? "text-red-600" : ""
                )}>
                  {revenueGrowth > 0 ? "+" : ""}{revenueGrowth.toFixed(1)}%
                </p>
              </div>
              {revenueGrowth > 0 ? (
                <TrendingUp className="h-8 w-8 text-green-500" />
              ) : revenueGrowth < 0 ? (
                <TrendingDown className="h-8 w-8 text-red-500" />
              ) : (
                <Minus className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {formatPrice(current.totalPago)} vs {formatPrice(previous.totalPago)}
            </p>
          </CardContent>
        </Card>
        
        <Card className={cn(
          "border-2",
          conversionGrowth > 0 ? "border-green-200 bg-green-50/50" : 
          conversionGrowth < 0 ? "border-red-200 bg-red-50/50" : "border-muted"
        )}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Evolução da Conversão</p>
                <p className={cn(
                  "text-2xl font-bold",
                  conversionGrowth > 0 ? "text-green-600" : 
                  conversionGrowth < 0 ? "text-red-600" : ""
                )}>
                  {conversionGrowth > 0 ? "+" : ""}{conversionGrowth.toFixed(1)}%
                </p>
              </div>
              {conversionGrowth > 0 ? (
                <TrendingUp className="h-8 w-8 text-green-500" />
              ) : conversionGrowth < 0 ? (
                <TrendingDown className="h-8 w-8 text-red-500" />
              ) : (
                <Minus className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {current.taxaConversao.toFixed(1)}% vs {previous.taxaConversao.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Comparando</p>
                <p className="text-lg font-semibold">{currentLabel}</p>
                <p className="text-sm text-muted-foreground">vs {previousLabel}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Detailed Comparison Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Comparativo Detalhado
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Header */}
          <div className="grid grid-cols-4 gap-2 py-2 border-b-2 text-sm font-medium text-muted-foreground">
            <div>Métrica</div>
            <div className="text-right">{currentLabel}</div>
            <div className="text-right">{previousLabel}</div>
            <div className="text-right">Variação</div>
          </div>
          
          {/* Rows */}
          {comparisons.map((item, index) => (
            <ComparisonRow
              key={index}
              label={item.label}
              currentValue={item.current}
              previousValue={item.previous}
              variation={item.variation}
              formatAsPrice={item.formatAsPrice}
              formatAsPercent={item.formatAsPercent}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
