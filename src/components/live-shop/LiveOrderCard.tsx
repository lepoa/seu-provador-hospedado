import { useState, useEffect } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Package,
  User,
  Truck,
  Store,
  Bike,
  Clock,
  CheckCircle,
  Trophy,
  AlertTriangle,
  MessageCircle,
  Copy,
  DollarSign,
  Check,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { buildWhatsAppLink, buildLepoaChargeMessage, displayInstagram, getInstagramProfileUrl } from "@/lib/whatsappHelpers";
import { toast } from "sonner";
import type { LiveOrderCart, UrgencyInfo } from "@/hooks/useLiveOrders";

interface LiveOrderCardProps {
  order: LiveOrderCart;
  sellers: { id: string; name: string }[];
  urgency: UrgencyInfo;
  compact?: boolean;
  onSelect: () => void;
  onAssignSeller: (orderId: string, sellerId: string | null) => Promise<boolean>;
  onMarkAsPaid: (orderId: string, method: string) => Promise<boolean>;
  onMarkAsPosted: (orderId: string) => Promise<boolean>;
  onMarkAsDelivered: (orderId: string) => Promise<boolean>;
  onMarkAsPickedUp: (orderId: string) => Promise<boolean>;
  onAdvanceStatus: (orderId: string) => Promise<boolean>;
  onRecordCharge: (orderId: string, channel: 'whatsapp' | 'direct', moveToAwaitingReturn?: boolean) => Promise<boolean>;
  onOpenManualPayment: (orderId: string) => void;
}

export function LiveOrderCard({
  order,
  sellers,
  urgency,
  compact = false,
  onSelect,
  onAssignSeller,
  onMarkAsPaid,
  onMarkAsPosted,
  onMarkAsDelivered,
  onMarkAsPickedUp,
  onAdvanceStatus,
  onRecordCharge,
  onOpenManualPayment,
}: LiveOrderCardProps) {
  const [localSellerId, setLocalSellerId] = useState<string | null>(order.seller_id);

  // Sync local state with order.seller_id when it changes
  useEffect(() => {
    setLocalSellerId(order.seller_id);
  }, [order.seller_id]);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const isPaid = order.status === 'pago';
  const isAwaitingPayment = order.status === 'aguardando_pagamento' || order.status === 'aberto' || 
    order.operational_status === 'aguardando_pagamento';
  const isAwaitingReturn = order.operational_status === 'aguardando_retorno';
  const isCancelled = order.status === 'cancelado';
  const isFinal = order.operational_status === 'entregue' || order.operational_status === 'retirado';
  const needsValidation = order.payment_review_status === 'pending_review';

  // Use provided urgency
  const isUrgent = urgency.isUrgent;

  // Get bag link
  const getBagLink = () => {
    const base = `${window.location.origin}/live-checkout/${order.id}`;
    return order.public_token ? `${base}?token=${order.public_token}` : base;
  };

  // Get charge status display - with clear hours
  const getChargeInfo = () => {
    if (isPaid) return null;
    if (!order.last_charge_at) {
      const hoursSinceCreation = (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreation > 24) {
        return { text: `Nunca cobrada (+${Math.floor(hoursSinceCreation)}h)`, needsCharge: true };
      }
      return { text: 'Nunca cobrada', needsCharge: true };
    }
    
    const hoursSinceLastCharge = (Date.now() - new Date(order.last_charge_at).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastCharge > 24) {
      return { text: `Cobrar novamente (+${Math.floor(hoursSinceLastCharge)}h)`, needsCharge: true };
    }
    
    return { 
      text: `Cobrada ${formatDistanceToNow(new Date(order.last_charge_at), { locale: ptBR, addSuffix: true })}`, 
      needsCharge: false 
    };
  };

  // Get delivery icon
  const DeliveryIcon = order.delivery_method === 'correios' ? Truck 
    : order.delivery_method === 'motoboy' ? Bike 
    : Store;

  // Get status display - CLEAN, ELEGANT, MINIMAL
  const getStatusInfo = () => {
    if (isCancelled) return { label: 'Cancelado', color: 'text-muted-foreground bg-muted border-muted' };
    if (isFinal) return { label: 'Entregue ✓', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    if (needsValidation) return { label: 'Validar Pagamento', color: 'text-violet-700 bg-violet-50 border-violet-200' };
    if (isAwaitingReturn) return { label: 'Aguardando Retorno', color: 'text-orange-700 bg-orange-50 border-orange-200' };
    if (isAwaitingPayment && !isPaid) return { label: 'Aguardando Pagamento', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    
    if (isPaid) {
      if (order.operational_status === 'preparar_envio') {
        return { label: 'Preparar Envio', color: 'text-blue-700 bg-blue-50 border-blue-200' };
      }
      if (order.operational_status === 'etiqueta_gerada') {
        return { label: 'Etiqueta Gerada', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' };
      }
      if (order.operational_status === 'postado') {
        return { label: 'Postado', color: 'text-purple-700 bg-purple-50 border-purple-200' };
      }
      if (order.operational_status === 'em_rota') {
        return { label: 'Em Rota', color: 'text-cyan-700 bg-cyan-50 border-cyan-200' };
      }
      if (order.operational_status === 'retirada') {
        return { label: 'Aguardando Retirada', color: 'text-teal-700 bg-teal-50 border-teal-200' };
      }
      return { label: 'Pago', color: 'text-green-700 bg-green-50 border-green-200' };
    }
    return null;
  };

  // Copy link with sophisticated message
  const copyLinkWithMessage = async () => {
    const link = getBagLink();
    const message = buildLepoaChargeMessage(link, order.bag_number || undefined);
    await navigator.clipboard.writeText(message);
    toast.success("Mensagem copiada com link!");
  };

  // Open WhatsApp with sophisticated message - SEPARATE from registering charge
  const openWhatsApp = () => {
    const customer = order.live_customer;
    if (!customer?.whatsapp) {
      toast.error("Cliente sem WhatsApp cadastrado");
      return;
    }
    const link = getBagLink();
    const message = buildLepoaChargeMessage(link, order.bag_number || undefined);
    const whatsappLink = buildWhatsAppLink(customer.whatsapp, message);
    window.open(whatsappLink, '_blank');
  };

  // Register charge SEPARATELY (moves to aguardando_retorno)
  const handleRegisterCharge = async () => {
    const channel = order.live_customer?.whatsapp ? 'whatsapp' : 'direct';
    const success = await onRecordCharge(order.id, channel, true);
    if (success) {
      toast.success("Cobrança registrada → Aguardando retorno");
    }
  };

  // Handle seller change
  const handleSellerChange = async (value: string) => {
    const sellerId = value === "unassigned" ? null : value;
    setLocalSellerId(sellerId);
    await onAssignSeller(order.id, sellerId);
  };

  const chargeInfo = getChargeInfo();
  const statusInfo = getStatusInfo();
  const instagramDisplay = displayInstagram(order.live_customer?.instagram_handle || '');
  const instagramUrl = getInstagramProfileUrl(order.live_customer?.instagram_handle || '');

  // Calculate time in current status
  const getTimeInStatus = () => {
    const hours = (Date.now() - new Date(order.updated_at).getTime()) / (1000 * 60 * 60);
    if (hours < 1) return `${Math.floor(hours * 60)}min`;
    if (hours < 24) return `${Math.floor(hours)}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  if (compact) {
    return (
      <Card 
        className={cn(
          "p-3 cursor-pointer hover:shadow-sm transition-all border-border/60",
          isUrgent && "border-l-2 border-l-amber-500",
          isCancelled && "opacity-50"
        )}
        onClick={onSelect}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-mono text-muted-foreground">#{order.bag_number}</span>
            <span className="font-medium text-sm truncate">{instagramDisplay}</span>
          </div>
          <DeliveryIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>

        <div className="flex items-center justify-between">
          <span className="font-semibold">{formatPrice(order.total)}</span>
          {statusInfo && (
            <Badge variant="outline" className={cn("text-xs", statusInfo.color)}>
              {statusInfo.label}
            </Badge>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card 
      className={cn(
        "p-3 sm:p-4 transition-all border-border/60",
        isUrgent && "border-l-4 border-l-amber-500 bg-amber-50/20",
        chargeInfo?.needsCharge && !isPaid && !isAwaitingReturn && "border-l-4 border-l-rose-400",
        isCancelled && "opacity-50 bg-muted/30"
      )}
    >
      {/* Header Row - Mobile optimized */}
      <div className="flex items-start justify-between gap-2 sm:gap-4 mb-2 sm:mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs sm:text-sm font-mono text-muted-foreground shrink-0">#{order.bag_number}</span>
          <div className="flex items-center gap-1 min-w-0">
            <span className="font-semibold text-sm sm:text-base truncate">{instagramDisplay}</span>
            {instagramUrl && (
              <a 
                href={instagramUrl}
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-blue-600 shrink-0"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        <div className="shrink-0">
          {statusInfo && (
            <Badge variant="outline" className={cn("text-[10px] sm:text-xs font-medium", statusInfo.color)}>
              {statusInfo.label}
            </Badge>
          )}
        </div>
      </div>

      {/* Info Row - wrap on mobile */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3 text-xs sm:text-sm">
        {/* Delivery Method */}
        <div className="flex items-center gap-1 text-muted-foreground">
          <DeliveryIcon className="h-3.5 w-3.5" />
          <span className="text-[10px] sm:text-xs">
            {order.delivery_method === 'correios' ? 'Correios' 
              : order.delivery_method === 'motoboy' ? 'Motoboy' 
              : 'Retirada'}
          </span>
        </div>

        {/* Seller Assignment - compact on mobile */}
        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
          <Select
            value={localSellerId || "unassigned"}
            onValueChange={handleSellerChange}
          >
            <SelectTrigger className="h-6 sm:h-7 w-auto min-w-[70px] sm:min-w-[90px] text-[10px] sm:text-xs border-dashed bg-transparent px-1.5">
              <User className="h-3 w-3 mr-0.5 text-muted-foreground" />
              <SelectValue placeholder="Resp." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Sem responsável</SelectItem>
              {sellers.map((seller) => (
                <SelectItem key={seller.id} value={seller.id}>
                  {seller.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Time in status */}
        <span className="text-[10px] sm:text-xs text-muted-foreground">{getTimeInStatus()}</span>

        {/* Urgency Badge */}
        {isUrgent && urgency.reason && (
          <Badge variant="destructive" className="text-[10px] sm:text-xs h-5">
            <AlertTriangle className="h-3 w-3 mr-0.5" />
            <span className="hidden sm:inline">{urgency.reason}</span>
          </Badge>
        )}

        {/* Charge info */}
        {chargeInfo && !isPaid && (
          <span className={cn("text-[10px] sm:text-xs", chargeInfo.needsCharge ? "text-rose-600 font-medium" : "text-muted-foreground")}>
            {chargeInfo.text}
          </span>
        )}

        {/* Raffle winner */}
        {order.is_raffle_winner && (
          <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300 h-5">
            <Trophy className="h-3 w-3" />
          </Badge>
        )}
      </div>

      {/* Action Bar - Stack actions on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 sm:pt-3 border-t border-border/40">
        <span className="text-lg sm:text-xl font-bold tracking-tight">{formatPrice(order.total)}</span>

        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {/* Awaiting Payment Actions */}
          {(isAwaitingPayment || isAwaitingReturn) && !isPaid && !isCancelled && (
            <>
              {/* WhatsApp Charge Button */}
              {order.live_customer?.whatsapp && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 sm:h-8 text-xs flex-1 sm:flex-none min-w-0"
                  onClick={openWhatsApp}
                  title="Abrir WhatsApp com mensagem"
                >
                  <MessageCircle className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">{isAwaitingReturn ? 'Reenviar' : 'Cobrar'}</span>
                </Button>
              )}
              
              {/* Copy link + message */}
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 sm:h-8 text-xs"
                onClick={copyLinkWithMessage}
                title="Copiar mensagem com link"
              >
                <Copy className="h-3.5 w-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Copiar</span>
              </Button>

              {/* Register charge */}
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 sm:h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={handleRegisterCharge}
                title="Registrar cobrança"
              >
                <Check className="h-3.5 w-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Registrar</span>
              </Button>
              
              {/* Manual payment */}
              <Button 
                variant="default" 
                size="sm" 
                className="h-9 sm:h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                onClick={() => onOpenManualPayment(order.id)}
                title="Marcar como pago"
              >
                <DollarSign className="h-3.5 w-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Pago</span>
              </Button>
            </>
          )}

          {/* Paid Actions - Advance status (ONLY when payment is validated or not manual) */}
          {isPaid && !isFinal && !isCancelled && !needsValidation && (
            <Button 
              variant="default" 
              size="sm" 
              className="h-9 sm:h-8 text-xs"
              onClick={() => onAdvanceStatus(order.id)}
              title="Avançar para próximo status"
            >
              <ChevronRight className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Avançar</span>
            </Button>
          )}

          {/* View Details */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-9 sm:h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={onSelect}
          >
            Detalhes
            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
