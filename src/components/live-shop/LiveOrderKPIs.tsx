import { 
  Clock, 
  CheckCircle, 
  Package, 
  Ticket, 
  Truck, 
  Store, 
  Bike, 
  AlertTriangle,
  Users,
  MessageCircle,
  RotateCcw,
  CheckCheck,
  AlertCircle,
  DollarSign,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KPIs {
  aguardandoPagamento: number;
  aguardandoRetorno: number;
  pago: number;
  prepararEnvio: number;
  etiquetaGerada: number;
  postado: number;
  emRota: number;
  retirada: number;
  motoboy: number;
  entregue: number;
  pendencias: number;
  semResponsavel: number;
  needsCharge: number;
  urgentCount: number;
  pendingProof: number;
  totalPago: number;
  totalPedidos: number;
  // Values for each status
  valorAguardandoPagamento?: number;
  valorAguardandoRetorno?: number;
  valorPago?: number;
  valorPrepararEnvio?: number;
  valorEntregue?: number;
}

interface LiveOrderKPIsProps {
  kpis: KPIs;
  activeFilter: string;
  onFilterClick: (status: string) => void;
}

export function LiveOrderKPIs({ kpis, activeFilter, onFilterClick }: LiveOrderKPIsProps) {
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatCompact = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toFixed(0);
  };

  // Main flow statuses - clean, minimal design
  const primaryCards = [
    {
      label: "Aguardando Pgto",
      value: kpis.aguardandoPagamento,
      valorTotal: kpis.valorAguardandoPagamento || 0,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
      activeBg: "bg-amber-100",
      filter: "aguardando_pagamento",
    },
    {
      label: "Aguardando Retorno",
      value: kpis.aguardandoRetorno,
      valorTotal: kpis.valorAguardandoRetorno || 0,
      icon: RotateCcw,
      color: "text-orange-600",
      bg: "bg-orange-50",
      border: "border-orange-200",
      activeBg: "bg-orange-100",
      filter: "aguardando_retorno",
    },
    {
      label: "Pago",
      value: kpis.pago,
      valorTotal: kpis.valorPago || 0,
      icon: CheckCircle,
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-200",
      activeBg: "bg-green-100",
      filter: "pago",
    },
    {
      label: "Preparar Envio",
      value: kpis.prepararEnvio,
      valorTotal: kpis.valorPrepararEnvio || 0,
      icon: Package,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
      activeBg: "bg-blue-100",
      filter: "preparar_envio",
    },
    {
      label: "Etiqueta Gerada",
      value: kpis.etiquetaGerada,
      icon: Ticket,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      border: "border-indigo-200",
      activeBg: "bg-indigo-100",
      filter: "etiqueta_gerada",
    },
    {
      label: "Postado",
      value: kpis.postado,
      icon: Truck,
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "border-purple-200",
      activeBg: "bg-purple-100",
      filter: "postado",
    },
    {
      label: "Em Rota",
      value: kpis.emRota,
      icon: Bike,
      color: "text-cyan-600",
      bg: "bg-cyan-50",
      border: "border-cyan-200",
      activeBg: "bg-cyan-100",
      filter: "em_rota",
    },
    {
      label: "Entregue ✓",
      value: kpis.entregue,
      valorTotal: kpis.valorEntregue || 0,
      icon: CheckCheck,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      activeBg: "bg-emerald-100",
      filter: "entregue",
    },
  ];

  // Action-oriented secondary cards
  const secondaryCards = [
    {
      label: "Retirada",
      value: kpis.retirada,
      icon: Store,
      color: "text-teal-600",
      bg: "bg-teal-50",
      border: "border-teal-200",
      filter: "retirada",
    },
    {
      label: "Validar Pgto",
      value: kpis.pendingProof,
      icon: DollarSign,
      color: "text-violet-600",
      bg: "bg-violet-50",
      border: "border-violet-200",
      filter: "pending_proof",
      highlight: kpis.pendingProof > 0,
    },
    {
      label: "Urgentes",
      value: kpis.urgentCount,
      icon: AlertCircle,
      color: "text-rose-600",
      bg: "bg-rose-50",
      border: "border-rose-200",
      filter: "urgent",
      highlight: kpis.urgentCount > 0,
    },
    {
      label: "Cobrar",
      value: kpis.needsCharge,
      icon: MessageCircle,
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-200",
      filter: "needs_charge",
      highlight: kpis.needsCharge > 0,
    },
  ];

  return (
    <div className="space-y-3 w-full max-w-full overflow-x-hidden">
      {/* Main KPI Cards - Horizontal scroll on mobile with proper containment */}
      <div className="scroll-container-x">
        <div className="flex sm:grid sm:grid-cols-4 md:grid-cols-8 gap-2 w-max sm:w-full">
          {primaryCards.map((card) => {
            const isActive = activeFilter === card.filter;
            return (
              <Card
                key={card.label}
                className={cn(
                  "p-2 sm:p-3 cursor-pointer transition-all hover:shadow-md border shrink-0 w-[80px] sm:w-auto",
                  isActive ? card.activeBg : card.bg,
                  card.border,
                  isActive && "ring-2 ring-offset-1 ring-primary/50"
                )}
                onClick={() => onFilterClick(card.filter)}
              >
                <div className="flex flex-col items-center text-center">
                  <card.icon className={cn("h-4 w-4 sm:h-5 sm:w-5 mb-1", card.color)} />
                  <span className={cn("text-lg sm:text-2xl font-bold", card.color)}>
                    {card.value}
                  </span>
                  <span className="text-[9px] sm:text-xs text-muted-foreground leading-tight line-clamp-2">
                    {card.label}
                  </span>
                  {card.valorTotal !== undefined && card.valorTotal > 0 && (
                    <span className="text-[9px] sm:text-xs font-medium text-muted-foreground mt-0.5 hidden sm:block">
                      {formatPrice(card.valorTotal)}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Secondary Row - 2x2 on mobile, 4 cols on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {secondaryCards.map((card) => {
          const isActive = activeFilter === card.filter;
          return (
            <Card
              key={card.label}
              className={cn(
                "p-2 cursor-pointer transition-all hover:shadow-md border flex items-center gap-2",
                isActive ? "bg-primary/10" : card.bg,
                card.border,
                card.highlight && !isActive && "ring-2 ring-offset-1 ring-red-300",
                isActive && "ring-2 ring-offset-1 ring-primary/50"
              )}
              onClick={() => onFilterClick(card.filter)}
            >
              <card.icon className={cn("h-4 w-4 shrink-0", card.color)} />
              <span className={cn("font-bold text-lg", card.color)}>
                {card.value}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {card.label}
              </span>
            </Card>
          );
        })}
      </div>

      {/* Summary Row - Stack on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-gradient-to-r from-primary/5 via-transparent to-transparent rounded-lg px-3 sm:px-4 py-2 border border-border/40">
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          <button
            onClick={() => onFilterClick('none')}
            className={cn(
              "flex items-center gap-2 hover:underline transition-colors text-sm",
              activeFilter === 'none' && "font-medium text-primary"
            )}
          >
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>
              <span className="font-medium">{kpis.semResponsavel}</span>{" "}
              <span className="text-muted-foreground">sem resp.</span>
            </span>
          </button>

          <button
            onClick={() => onFilterClick('all')}
            className={cn(
              "text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors",
              activeFilter === 'all' && "font-medium text-primary"
            )}
          >
            Todos ({kpis.totalPedidos})
          </button>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-sm text-muted-foreground">Total Pago: </span>
          <span className="text-base sm:text-lg font-bold text-green-600">
            {formatPrice(kpis.totalPago)}
          </span>
        </div>
      </div>
    </div>
  );
}
