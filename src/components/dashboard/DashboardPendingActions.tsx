import { useNavigate } from "react-router-dom";
import { 
  Clock, 
  MessageSquare, 
  Truck, 
  UserX,
  ArrowRight,
  AlertTriangle,
  Package,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PendingAction } from "@/hooks/useDashboardDataV2";
import { cn } from "@/lib/utils";
import { dashboardNavigation } from "@/lib/dashboardNavigation";

interface DashboardPendingActionsProps {
  actions: PendingAction[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const actionConfig: Record<PendingAction["type"], { icon: React.ElementType; getRoute: () => string }> = {
  aguardando_pagamento_24h: { icon: Clock, getRoute: dashboardNavigation.aguardandoPagamento24h },
  aguardando_retorno_24h: { icon: RotateCcw, getRoute: dashboardNavigation.aguardandoRetorno24h },
  nao_cobrado: { icon: MessageSquare, getRoute: dashboardNavigation.naoCobrado },
  pago_sem_logistica: { icon: Truck, getRoute: dashboardNavigation.pagoSemLogistica },
  etiqueta_pendente: { icon: Package, getRoute: dashboardNavigation.etiquetaPendente },
  sem_vendedora: { icon: UserX, getRoute: dashboardNavigation.semVendedora },
  urgente: { icon: AlertTriangle, getRoute: dashboardNavigation.urgente },
};

export function DashboardPendingActions({ actions }: DashboardPendingActionsProps) {
  const navigate = useNavigate();

  if (actions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Pendências Operacionais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              ✓ Nenhuma pendência no momento
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Pendências Operacionais
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {actions.map(action => {
            const config = actionConfig[action.type];
            const Icon = config.icon;
            
            return (
              <div
                key={action.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors group",
                  action.severity === "error" ? "bg-destructive/5 hover:bg-destructive/10" :
                  action.severity === "warning" ? "bg-amber-50 hover:bg-amber-100" :
                  "bg-muted/50 hover:bg-muted"
                )}
                onClick={() => navigate(config.getRoute())}
              >
                <Icon className={cn(
                  "h-4 w-4 shrink-0",
                  action.severity === "error" ? "text-destructive" :
                  action.severity === "warning" ? "text-amber-600" :
                  "text-muted-foreground"
                )} />
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{action.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {action.count} pedido{action.count > 1 ? "s" : ""} • {formatCurrency(action.value)}
                  </p>
                </div>

                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
