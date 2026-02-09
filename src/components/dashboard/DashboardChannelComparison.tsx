import { useNavigate } from "react-router-dom";
import { Store, Radio, ArrowRight, Users, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { ChannelComparison } from "@/hooks/useDashboardDataV2";
import { dashboardNavigation } from "@/lib/dashboardNavigation";

interface DashboardChannelComparisonProps {
  data: ChannelComparison;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

interface MetricRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
}

function MetricRow({ label, value, highlight, icon, onClick }: MetricRowProps) {
  return (
    <div 
      className={`flex items-center justify-between py-2 border-b border-border/30 last:border-0 ${onClick ? 'cursor-pointer hover:bg-muted/50 -mx-1 px-1 rounded transition-colors' : ''}`}
      onClick={onClick}
    >
      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className={`text-sm font-medium ${highlight ? "text-primary" : ""}`}>{value}</span>
    </div>
  );
}

export function DashboardChannelComparison({ data }: DashboardChannelComparisonProps) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      {/* Catalog Card - Brown/neutral theme */}
      <Card 
        className="cursor-pointer hover:shadow-md transition-all group bg-gradient-to-br from-stone-50 to-stone-100/50 border-stone-200"
        onClick={() => navigate(dashboardNavigation.catalogAll())}
      >
        <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-stone-200/60">
                <Store className="h-4 w-4 text-stone-600" />
              </div>
              <CardTitle className="text-sm sm:text-base font-semibold text-stone-700">Catálogo</CardTitle>
            </div>
            <ArrowRight className="h-4 w-4 text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </CardHeader>
        <CardContent className="pt-0 p-3 sm:p-6 sm:pt-0">
          <div 
            className="mb-3 sm:mb-4 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              navigate(dashboardNavigation.catalogPagos());
            }}
          >
            <p className="text-xl sm:text-2xl font-semibold text-stone-800">{formatCurrency(data.catalog.pago)}</p>
            <p className="text-[10px] sm:text-xs text-stone-500">Faturamento Pago</p>
          </div>
          <div className="space-y-0.5 text-sm">
            <MetricRow 
              label="Pedidos Pagos" 
              value={data.catalog.pedidosPagos.toString()} 
              onClick={() => navigate(dashboardNavigation.catalogPagos())}
            />
            <MetricRow label="Ticket Médio" value={formatCurrency(data.catalog.ticket)} />
            <MetricRow label="Conversão" value={formatPercent(data.catalog.conversao)} />
            <MetricRow 
              label="Clientes" 
              value={data.catalog.clientesAtivos.toString()} 
              icon={<Users className="h-3 w-3" />}
            />
          </div>
          <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-stone-200">
            <span className="text-[10px] sm:text-xs text-stone-500 flex items-center gap-1">
              <ArrowRight className="h-3 w-3" /> Ver pedidos
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Live Card - Primary/accent theme */}
      <Card 
        className="cursor-pointer hover:shadow-md transition-all group bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20"
        onClick={() => navigate(dashboardNavigation.liveAll())}
      >
        <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/15">
                <Radio className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-sm sm:text-base font-semibold text-foreground">Live Shop</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {data.live.lotesPendentes > 0 && (
                <Badge 
                  variant="outline" 
                  className="text-[10px] sm:text-xs border-amber-300 text-amber-700 bg-amber-50 px-1.5 py-0 cursor-pointer hover:bg-amber-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(dashboardNavigation.livePendentes());
                  }}
                >
                  {data.live.lotesPendentes} a cobrar
                </Badge>
              )}
              <ArrowRight className="h-4 w-4 text-primary/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 p-3 sm:p-6 sm:pt-0">
          <div className="mb-3 sm:mb-4 flex items-end gap-3 sm:gap-4">
            <div 
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                navigate(dashboardNavigation.livePagos());
              }}
            >
              <p className="text-xl sm:text-2xl font-semibold text-primary">{formatCurrency(data.live.pago)}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Faturamento Pago</p>
            </div>
            <div 
              className="text-right cursor-pointer hover:opacity-80 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                navigate(dashboardNavigation.livePendentes());
              }}
            >
              <p className="text-xs sm:text-sm text-muted-foreground">{formatCurrency(data.live.reservado)}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Reservado</p>
            </div>
          </div>
          
          {/* Progress bar for payment completion */}
          <div className="mb-2 sm:mb-3">
            <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground mb-1">
              <span>Pagamento</span>
              <span className="font-medium">{formatPercent(data.live.progressoPagamento)}</span>
            </div>
            <Progress value={data.live.progressoPagamento} className="h-1.5 sm:h-2" />
          </div>

          <div className="space-y-0.5 text-sm">
            <MetricRow 
              label="Pedidos Pagos" 
              value={data.live.pedidosPagos.toString()} 
              onClick={() => navigate(dashboardNavigation.livePagos())}
            />
            <MetricRow label="Ticket Médio" value={formatCurrency(data.live.ticket)} />
            <MetricRow 
              label="Conversão" 
              value={formatPercent(data.live.conversao)} 
              icon={<TrendingUp className="h-3 w-3" />}
            />
          </div>
          <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-primary/10">
            <span className="text-[10px] sm:text-xs text-primary/70 flex items-center gap-1">
              <ArrowRight className="h-3 w-3" /> Ver pedidos
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
