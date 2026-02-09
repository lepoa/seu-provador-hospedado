import { useNavigate } from "react-router-dom";
import { 
  CreditCard, 
  Package, 
  Truck, 
  Store, 
  XCircle,
  ArrowRight,
  Send,
  Clipboard
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DashboardKPIs } from "@/hooks/useDashboardData";

interface DashboardOperationsCardsProps {
  kpis: DashboardKPIs;
}

export function DashboardOperationsCards({ kpis }: DashboardOperationsCardsProps) {
  const navigate = useNavigate();

  const operationCards = [
    {
      icon: CreditCard,
      label: "Aguardando Pagamento",
      count: kpis.pedidosAguardandoPagamento,
      bgClass: "bg-amber-50 border-amber-200 hover:bg-amber-100 hover:shadow-lg",
      iconClass: "text-amber-600",
      priority: kpis.pedidosAguardandoPagamento > 0 ? "warning" : "normal",
      action: "Enviar cobrança",
      onClick: () => navigate("/dashboard?tab=orders&filter=aguardando"),
    },
    {
      icon: Package,
      label: "Para Separar",
      count: kpis.pedidosParaSeparar,
      bgClass: "bg-blue-50 border-blue-200 hover:bg-blue-100 hover:shadow-lg",
      iconClass: "text-blue-600",
      priority: kpis.pedidosParaSeparar > 0 ? "action" : "normal",
      action: "Separar agora",
      onClick: () => navigate("/dashboard?tab=orders&filter=separar"),
    },
    {
      icon: Truck,
      label: "Para Envio",
      count: kpis.pedidosParaEnvio,
      bgClass: "bg-violet-50 border-violet-200 hover:bg-violet-100 hover:shadow-lg",
      iconClass: "text-violet-600",
      priority: kpis.pedidosParaEnvio > 0 ? "action" : "normal",
      action: "Preparar envio",
      onClick: () => navigate("/dashboard?tab=orders&filter=envio"),
    },
    {
      icon: Store,
      label: "Retirada em Loja",
      count: kpis.pedidosRetirada,
      bgClass: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100 hover:shadow-lg",
      iconClass: "text-emerald-600",
      priority: kpis.pedidosRetirada > 0 ? "action" : "normal",
      action: "Separar retirada",
      onClick: () => navigate("/dashboard?tab=orders&filter=retirada"),
    },
    {
      icon: XCircle,
      label: "Cancelados",
      count: kpis.pedidosCancelados,
      bgClass: "bg-red-50 border-red-200 hover:bg-red-100 hover:shadow-lg",
      iconClass: "text-red-600",
      priority: kpis.pedidosCancelados > 0 ? "error" : "normal",
      action: "Devolver estoque",
      onClick: () => navigate("/dashboard?tab=orders&filter=cancelado"),
    },
  ];

  const getPriorityBadge = (priority: string, count: number) => {
    if (count === 0) return null;
    
    switch (priority) {
      case "error":
        return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">🔴 Ação</Badge>;
      case "warning":
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-600">🟡 Pendente</Badge>;
      case "action":
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-400 text-blue-600">📦 Fazer</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
          <Package className="h-4 w-4" />
          Operação & Logística
          <span className="text-xs text-muted-foreground ml-auto">
            Clique para agir →
          </span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {operationCards.map((card) => (
            <button
              key={card.label}
              onClick={card.onClick}
              className={`${card.bgClass} border rounded-xl p-4 text-left transition-all group cursor-pointer hover:scale-[1.02]`}
            >
              <div className="flex items-center justify-between mb-2">
                <card.icon className={`h-5 w-5 ${card.iconClass}`} />
                <ArrowRight className={`h-4 w-4 ${card.iconClass} opacity-0 group-hover:opacity-100 transition-opacity`} />
              </div>
              <p className={`text-2xl font-bold ${card.iconClass}`}>
                {card.count}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {card.label}
              </p>
              
              {/* Priority Badge */}
              <div className="mt-2">
                {getPriorityBadge(card.priority, card.count)}
              </div>
              
              {/* Action hint on hover */}
              {card.count > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  → {card.action}
                </p>
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
