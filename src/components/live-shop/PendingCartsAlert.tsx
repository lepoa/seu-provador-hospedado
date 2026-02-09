import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Clock,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { LiveCart } from "@/types/liveShop";

interface PendingCartsAlertProps {
  carts: LiveCart[];
  onCartClick: (cart: LiveCart) => void;
  onSendWhatsApp: (cart: LiveCart, e: React.MouseEvent) => void;
  onDismiss?: (cartId: string) => void;
}

export function PendingCartsAlert({
  carts,
  onCartClick,
  onSendWhatsApp,
  onDismiss,
}: PendingCartsAlertProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Filter carts that are pending for more than 24 hours
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const pendingCarts = carts.filter((cart) => {
    // Only include carts with pending statuses
    const isPending = ["aberto", "aguardando_pagamento", "em_confirmacao"].includes(cart.status);
    if (!isPending) return false;

    // Check if cart is older than 24 hours
    const createdAt = new Date(cart.created_at);
    const isOld = createdAt < twentyFourHoursAgo;

    // Don't show dismissed carts
    const isDismissed = dismissedIds.has(cart.id);

    return isOld && !isDismissed;
  });

  const handleDismiss = (cartId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds((prev) => new Set([...prev, cartId]));
    onDismiss?.(cartId);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const getTimeAgo = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: ptBR,
    });
  };

  if (pendingCarts.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-amber-100/50 transition-colors">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-amber-800">
                {pendingCarts.length} carrinho{pendingCarts.length !== 1 ? "s" : ""} pendente{pendingCarts.length !== 1 ? "s" : ""} há +24h
              </span>
              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                Ação necessária
              </Badge>
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-amber-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-amber-600" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-2">
            <p className="text-sm text-amber-700 mb-3">
              Estes carrinhos estão aguardando pagamento. Considere entrar em contato ou cancelar para liberar o estoque.
            </p>
            
            {pendingCarts.map((cart) => {
              const customer = cart.live_customer;
              const itemCount = (cart.items || []).filter(
                (i) => ["reservado", "confirmado"].includes(i.status)
              ).length;

              return (
                <div
                  key={cart.id}
                  className="flex items-center justify-between gap-3 p-3 bg-white rounded-lg border border-amber-200 hover:border-amber-300 transition-colors cursor-pointer"
                  onClick={() => onCartClick(cart)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        @{customer?.instagram_handle || "desconhecido"}
                      </span>
                      {customer?.nome && (
                        <span className="text-xs text-muted-foreground truncate">
                          ({customer.nome.split(" ")[0]})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3" />
                      <span>{getTimeAgo(cart.created_at)}</span>
                      <span>•</span>
                      <span>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
                      <span>•</span>
                      <span className="font-medium text-amber-700">{formatPrice(cart.total)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {customer?.whatsapp && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={(e) => onSendWhatsApp(cart, e)}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-muted-foreground hover:text-foreground"
                      onClick={(e) => handleDismiss(cart.id, e)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
