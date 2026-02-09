import { 
  DollarSign, 
  ShoppingBag, 
  Target, 
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  Clock,
  Info,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DashboardKPIsV2, MainKPI } from "@/hooks/useDashboardDataV2";
import { cn } from "@/lib/utils";

interface DashboardKPICardsV2Props {
  kpis: DashboardKPIsV2;
  onKPIClick: (kpiType: string) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`;
};

const formatNumber = (value: number, decimals = 1) => {
  return value.toFixed(decimals);
};

interface KPICardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  kpi: MainKPI;
  tooltip: string;
  onClick: () => void;
  variant?: "default" | "success" | "warning" | "muted";
}

function KPICard({ icon: Icon, label, value, kpi, tooltip, onClick, variant = "default" }: KPICardProps) {
  const isPositive = kpi.changePercent > 0;
  const isNegative = kpi.changePercent < 0;
  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : null;

  const bgClass = {
    default: "bg-card hover:bg-card/80",
    success: "bg-primary/5 hover:bg-primary/10 border-primary/20",
    warning: "bg-amber-50 hover:bg-amber-100/50 border-amber-200",
    muted: "bg-muted/50 hover:bg-muted",
  }[variant];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card 
            className={cn(
              "cursor-pointer transition-all group border min-h-[100px]",
              bgClass
            )}
            onClick={onClick}
          >
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                  <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                    {label}
                  </span>
                </div>
                <Info className="h-3 w-3 text-muted-foreground/50 shrink-0 hidden sm:block" />
              </div>
              
              <p className="text-lg sm:text-2xl font-semibold text-foreground tracking-tight truncate">
                {value}
              </p>
              
              {TrendIcon && kpi.changePercent !== 0 && (
                <div className={cn(
                  "flex items-center gap-1 mt-1 text-[10px] sm:text-xs font-medium",
                  isPositive ? "text-primary" : "text-destructive"
                )}>
                  <TrendIcon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{isPositive ? "+" : ""}{formatPercent(kpi.changePercent)}</span>
                  <span className="text-muted-foreground font-normal hidden sm:inline">vs anterior</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function DashboardKPICardsV2({ kpis, onKPIClick }: DashboardKPICardsV2Props) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Main KPIs Row - 2 cols mobile, 3 cols tablet, 6 cols desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        <KPICard
          icon={DollarSign}
          label="Faturamento"
          value={formatCurrency(kpis.faturamentoPago.value)}
          kpi={kpis.faturamentoPago}
          tooltip="Soma de pedidos com pagamento confirmado. Exclui brindes (R$0)."
          onClick={() => onKPIClick("faturamento")}
          variant="success"
        />

        <KPICard
          icon={ShoppingBag}
          label="Reservado"
          value={formatCurrency(kpis.reservado.value)}
          kpi={kpis.reservado}
          tooltip="Soma de pedidos ativos (não cancelados), independente de pagamento."
          onClick={() => onKPIClick("reservado")}
        />

        <KPICard
          icon={Target}
          label="Conversão"
          value={formatPercent(kpis.conversao.value)}
          kpi={kpis.conversao}
          tooltip="Pago ÷ Reservado (em R$). Mede eficiência de fechamento."
          onClick={() => onKPIClick("conversao")}
        />

        <KPICard
          icon={DollarSign}
          label="Ticket"
          value={formatCurrency(kpis.ticketMedio.value)}
          kpi={kpis.ticketMedio}
          tooltip="Faturamento Pago ÷ Nº de pedidos pagos."
          onClick={() => onKPIClick("ticket")}
        />

        <KPICard
          icon={Package}
          label="P.A."
          value={formatNumber(kpis.pecasAtendimento.value)}
          kpi={kpis.pecasAtendimento}
          tooltip="Peças por Atendimento: itens pagos (sem brinde) ÷ nº de pedidos pagos."
          onClick={() => onKPIClick("pa")}
        />

        <KPICard
          icon={AlertTriangle}
          label="Pendências"
          value={kpis.pendenciasOperacionais.value.toString()}
          kpi={kpis.pendenciasOperacionais}
          tooltip="Pedidos que exigem ação imediata (cobrar, postar, validar, etc.)."
          onClick={() => onKPIClick("pendencias")}
          variant={kpis.pendenciasOperacionais.value > 0 ? "warning" : "muted"}
        />
      </div>

      {/* Secondary KPIs Row - Horizontal scroll on mobile, grid on larger screens */}
      <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 sm:grid sm:grid-cols-3 md:grid-cols-5 sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0">
        <Card className="bg-card/50 cursor-pointer hover:bg-card transition-colors shrink-0 w-[140px] sm:w-auto" onClick={() => onKPIClick("pagos")}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Pagos</span>
              <span className="text-base sm:text-lg font-semibold text-primary">{kpis.pedidosPagos}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 cursor-pointer hover:bg-card transition-colors shrink-0 w-[140px] sm:w-auto" onClick={() => onKPIClick("pendentes")}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Pendentes</span>
              <span className="text-base sm:text-lg font-semibold text-amber-600">{kpis.pedidosPendentes}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 cursor-pointer hover:bg-card transition-colors shrink-0 w-[140px] sm:w-auto" onClick={() => onKPIClick("cancelados")}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Cancelados</span>
              <span className="text-base sm:text-lg font-semibold text-destructive">{kpis.cancelados}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 shrink-0 w-[140px] sm:w-auto">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">Tempo</span>
              </div>
              <span className="text-base sm:text-lg font-semibold">{kpis.tempoMedioPagamento.toFixed(0)}h</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 shrink-0 w-[140px] sm:w-auto">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Cancelam.</span>
              <span className={cn(
                "text-base sm:text-lg font-semibold",
                kpis.taxaCancelamento > 10 ? "text-destructive" : "text-muted-foreground"
              )}>
                {formatPercent(kpis.taxaCancelamento)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
