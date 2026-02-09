import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  History,
  ArrowRight,
  CreditCard,
  Banknote,
  Store,
  CheckCircle,
  XCircle,
  ShoppingCart,
  Clock,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StatusHistoryEntry {
  id: string;
  live_cart_id: string;
  old_status: string | null;
  new_status: string;
  payment_method: string | null;
  notes: string | null;
  changed_by: string | null;
  created_at: string;
}

interface CartStatusHistoryProps {
  history: StatusHistoryEntry[];
  isLoading?: boolean;
}

export function CartStatusHistory({ history, isLoading }: CartStatusHistoryProps) {
  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), "dd/MM 'às' HH:mm", { locale: ptBR });
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; icon: React.ElementType }> = {
      aberto: { label: "Aberto", color: "bg-blue-100 text-blue-700", icon: ShoppingCart },
      em_confirmacao: { label: "Confirmando", color: "bg-amber-100 text-amber-700", icon: Clock },
      aguardando_pagamento: { label: "Aguardando", color: "bg-orange-100 text-orange-700", icon: Clock },
      pago: { label: "Pago", color: "bg-green-100 text-green-700", icon: CheckCircle },
      cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700", icon: XCircle },
      expirado: { label: "Expirado", color: "bg-gray-100 text-gray-600", icon: Clock },
    };
    return configs[status] || { label: status, color: "bg-gray-100 text-gray-600", icon: History };
  };

  const getPaymentMethodIcon = (method: string | null) => {
    if (!method) return CreditCard;
    const lower = method.toLowerCase();
    if (lower.includes("dinheiro")) return Banknote;
    if (lower.includes("loja")) return Store;
    if (lower.includes("pix")) return CreditCard;
    return CreditCard;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (history.length === 0) {
    return null; // Hide completely when no history
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <History className="h-4 w-4" />
        Histórico de Status
      </div>
      
      <div className="space-y-2">
        {history.map((entry, index) => {
          const newConfig = getStatusConfig(entry.new_status);
          const oldConfig = entry.old_status ? getStatusConfig(entry.old_status) : null;
          const PaymentIcon = getPaymentMethodIcon(entry.payment_method);

          return (
            <div
              key={entry.id}
              className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/50 text-sm"
            >
              {/* Timeline indicator */}
              <div className="flex flex-col items-center shrink-0">
                <div className={`w-2 h-2 rounded-full ${
                  entry.new_status === 'pago' ? 'bg-green-500' : 
                  entry.new_status === 'cancelado' ? 'bg-red-500' : 'bg-primary'
                }`} />
                {index < history.length - 1 && (
                  <div className="w-0.5 h-full bg-border mt-1" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                {/* Status change */}
                <div className="flex items-center gap-2 flex-wrap">
                  {oldConfig && (
                    <>
                      <Badge variant="outline" className={`${oldConfig.color} text-xs`}>
                        {oldConfig.label}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </>
                  )}
                  <Badge variant="outline" className={`${newConfig.color} text-xs`}>
                    {newConfig.label}
                  </Badge>
                  
                  {/* Payment method */}
                  {entry.payment_method && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <PaymentIcon className="h-3 w-3" />
                      {entry.payment_method}
                    </span>
                  )}
                </div>

                {/* Notes */}
                {entry.notes && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {entry.notes}
                  </p>
                )}

                {/* Timestamp */}
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDateTime(entry.created_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
