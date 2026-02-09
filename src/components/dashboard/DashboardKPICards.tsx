import { useNavigate } from "react-router-dom";
import { 
  DollarSign, 
  ShoppingBag, 
  Target, 
  Clock, 
  Radio, 
  CreditCard,
  TrendingUp,
  Users,
  ArrowRight
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DashboardKPIs } from "@/hooks/useDashboardData";

interface DashboardKPICardsProps {
  kpis: DashboardKPIs;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

interface KPICardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  gradient: string;
  iconClass: string;
  textClass: string;
  onClick?: () => void;
}

function KPICard({ icon: Icon, label, value, gradient, iconClass, textClass, onClick }: KPICardProps) {
  return (
    <Card 
      className={`${gradient} transition-all cursor-pointer group hover:shadow-md hover:scale-[1.02]`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <Icon className={`h-5 w-5 ${iconClass}`} />
          <div className="flex items-center gap-1">
            <span className={`text-xs font-medium ${iconClass}`}>{label}</span>
            <ArrowRight className={`h-3 w-3 ${iconClass} opacity-0 group-hover:opacity-100 transition-opacity`} />
          </div>
        </div>
        <p className={`text-2xl font-bold mt-2 ${textClass}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export function DashboardKPICards({ kpis }: DashboardKPICardsProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      {/* Linha 1 - Vendas Hoje */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Hoje
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            icon={DollarSign}
            label="Faturamento"
            value={formatCurrency(kpis.faturamentoHoje)}
            gradient="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200"
            iconClass="text-emerald-600"
            textClass="text-emerald-700"
            onClick={() => navigate("/dashboard?tab=orders&filter=pagos")}
          />

          <KPICard
            icon={ShoppingBag}
            label="Pedidos"
            value={kpis.pedidosHoje}
            gradient="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200"
            iconClass="text-blue-600"
            textClass="text-blue-700"
            onClick={() => navigate("/dashboard?tab=orders")}
          />

          <KPICard
            icon={Target}
            label="Ticket Médio"
            value={formatCurrency(kpis.ticketMedio)}
            gradient="bg-gradient-to-br from-violet-50 to-violet-100/50 border-violet-200"
            iconClass="text-violet-600"
            textClass="text-violet-700"
            onClick={() => navigate("/dashboard?tab=clientes")}
          />

          <KPICard
            icon={Clock}
            label="Pendentes"
            value={kpis.pedidosPendentes}
            gradient="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200"
            iconClass="text-amber-600"
            textClass="text-amber-700"
            onClick={() => navigate("/dashboard?tab=orders&filter=aguardando")}
          />
        </div>
      </div>

      {/* Linha 2 - Live */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Radio className="h-4 w-4" />
          Live Shop
          {kpis.liveAtiva && (
            <Badge variant="destructive" className="animate-pulse">
              🔴 AO VIVO
            </Badge>
          )}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            icon={Radio}
            label="Última Live"
            value={kpis.ultimaLiveTitulo || "Nenhuma"}
            gradient="bg-gradient-to-br from-rose-50 to-rose-100/50 border-rose-200"
            iconClass="text-rose-600"
            textClass="text-rose-700 text-sm truncate"
            onClick={() => kpis.ultimaLiveId && navigate(`/dashboard/lives/${kpis.ultimaLiveId}/backstage`)}
          />

          <KPICard
            icon={ShoppingBag}
            label="Reservado"
            value={formatCurrency(kpis.totalReservadoLive)}
            gradient="bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200"
            iconClass="text-orange-600"
            textClass="text-orange-700"
            onClick={() => kpis.ultimaLiveId && navigate(`/dashboard/lives/${kpis.ultimaLiveId}/relatorio`)}
          />

          <KPICard
            icon={CreditCard}
            label="Pago"
            value={formatCurrency(kpis.totalPagoLive)}
            gradient="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200"
            iconClass="text-green-600"
            textClass="text-green-700"
            onClick={() => kpis.ultimaLiveId && navigate(`/dashboard/lives/${kpis.ultimaLiveId}/relatorio`)}
          />

          <KPICard
            icon={Users}
            label="Clientes Hoje"
            value={kpis.clientesNovosHoje}
            gradient="bg-gradient-to-br from-cyan-50 to-cyan-100/50 border-cyan-200"
            iconClass="text-cyan-600"
            textClass="text-cyan-700"
            onClick={() => navigate("/dashboard?tab=clientes")}
          />
        </div>
      </div>
    </div>
  );
}
