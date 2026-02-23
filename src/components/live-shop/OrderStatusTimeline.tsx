import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Clock,
  MessageCircle,
  CheckCircle,
  Package,
  Tag,
  Truck,
  Bike,
  Store,
  User,
  AlertTriangle,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusHistoryItem {
  id: string;
  old_status: string | null;
  new_status: string;
  notes: string | null;
  payment_method: string | null;
  created_at: string;
  changed_by: string | null;
}

interface ChargeLogItem {
  id: string;
  channel: string;
  created_at: string;
  charged_by: string | null;
}

interface OrderStatusTimelineProps {
  statusHistory: StatusHistoryItem[];
  chargeLogs: ChargeLogItem[];
  orderCreatedAt: string;
}

export function OrderStatusTimeline({ 
  statusHistory, 
  chargeLogs, 
  orderCreatedAt 
}: OrderStatusTimelineProps) {
  // Combine and sort all events
  const events = [
    ...statusHistory.map(h => ({
      id: `status-${h.id}`,
      type: 'status' as const,
      timestamp: h.created_at,
      data: h,
    })),
    ...chargeLogs.map(c => ({
      id: `charge-${c.id}`,
      type: 'charge' as const,
      timestamp: c.created_at,
      data: c,
    })),
    {
      id: 'creation',
      type: 'creation' as const,
      timestamp: orderCreatedAt,
      data: null,
    }
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'aguardando_pagamento':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'aguardando_retorno':
        return <MessageCircle className="h-4 w-4 text-orange-500" />;
      case 'manter_na_reserva':
        return <Clock className="h-4 w-4 text-amber-600" />;
      case 'pago':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'preparar_envio':
        return <Package className="h-4 w-4 text-blue-500" />;
      case 'etiqueta_gerada':
        return <Tag className="h-4 w-4 text-indigo-500" />;
      case 'postado':
        return <Truck className="h-4 w-4 text-purple-500" />;
      case 'em_rota':
        return <Bike className="h-4 w-4 text-cyan-500" />;
      case 'retirada':
        return <Store className="h-4 w-4 text-teal-500" />;
      case 'entregue':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'aguardando_pagamento': 'Aguardando Pagamento',
      'aguardando_retorno': 'Aguardando Retorno',
      'manter_na_reserva': 'Manter na Reserva',
      'pago': 'Pago',
      'preparar_envio': 'Preparar Envio',
      'etiqueta_gerada': 'Etiqueta Gerada',
      'postado': 'Postado',
      'em_rota': 'Em Rota',
      'retirada': 'Aguardando Retirada',
      'entregue': 'Entregue',
      'cancelado': 'Cancelado',
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-sm flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Histórico
      </h4>
      
      <div className="relative pl-4 border-l-2 border-muted space-y-3">
        {events.map((event, index) => (
          <div 
            key={event.id} 
            className={cn(
              "relative pl-4 py-1",
              index === 0 && "font-medium"
            )}
          >
            {/* Dot on timeline */}
            <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-background border-2 border-primary flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-primary" />
            </div>

            {event.type === 'creation' && (
              <div>
                <p className="text-sm">Sacola criada</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(event.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            )}

            {event.type === 'charge' && (
              <div className="flex items-start gap-2">
                <MessageCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm">
                    Cobrança enviada via {event.data.channel === 'whatsapp' ? 'WhatsApp' : 'Direct'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(event.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            )}

            {event.type === 'status' && (
              <div className="flex items-start gap-2">
                {getStatusIcon(event.data.new_status)}
                <div>
                  <p className="text-sm">
                    {event.data.old_status 
                      ? `${getStatusLabel(event.data.old_status)} → ${getStatusLabel(event.data.new_status)}`
                      : getStatusLabel(event.data.new_status)
                    }
                  </p>
                  {event.data.payment_method && (
                    <p className="text-xs flex items-center gap-1">
                      <CreditCard className="h-3 w-3" />
                      {event.data.payment_method}
                    </p>
                  )}
                  {event.data.notes && (
                    <p className="text-xs text-muted-foreground italic">
                      {event.data.notes}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(event.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
