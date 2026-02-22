import { useState, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Edit2,
  Package,
  User,
  Truck,
  Store,
  Bike,
  Clock,
  CheckCircle,
  Gift,
  Trophy,
  AlertTriangle,
  Tag,
  MessageCircle,
  CreditCard,
  Copy,
  DollarSign,
  Banknote,
  ExternalLink,
  Printer,
  MapPin,
  Phone,
  Loader2,
  X,
  ShieldAlert,
  Undo2,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { buildWhatsAppLink, buildLepoaChargeMessage, displayInstagram } from "@/lib/whatsappHelpers";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { copyToClipboard } from "@/lib/clipboardUtils";
import { PaymentValidationSection } from "./PaymentValidationSection";
import { ManualPaymentModal } from "./ManualPaymentModal";
import { RevalidatePaymentModal } from "@/components/RevalidatePaymentModal";
import { DeliveryMethodSection, isDeliveryConfiguredForPayment } from "./DeliveryMethodSection";
import { ShippingDataForm, getMissingShippingFields, ShippingAddressData } from "./ShippingDataForm";
import type { LiveOrderCart, DeliveryMethod, OperationalStatus } from "@/hooks/useLiveOrders";

// Helper: Validate tracking code format (same logic as edge function)
const isCorreiosTracking = (code: string) => /^[A-Z]{2}\d{9}BR$/.test(code);
const isNumericTracking = (code: string) => /^\d{8,20}$/.test(code);
const isValidTrackingCode = (code: string | null | undefined): boolean => {
  if (!code) return false;
  // Never accept Melhor Envio internal IDs
  if (code.startsWith('ORD-') || code.startsWith('ORD')) return false;
  // Must match Correios OR numeric (Jadlog, etc.) format
  return isCorreiosTracking(code) || isNumericTracking(code);
};

interface LiveOrderDetailDrawerProps {
  order: LiveOrderCart | null;
  sellers: { id: string; name: string }[];
  isAdmin: boolean;
  onClose: () => void;
  onAssignSeller: (orderId: string, sellerId: string | null) => Promise<boolean>;
  onMarkAsPaid: (orderId: string, method: string) => Promise<boolean>;
  onMarkAsPaidWithProof: (orderId: string, method: string, proofUrl: string, notes?: string) => Promise<boolean>;
  onMarkAsPosted: (orderId: string) => Promise<boolean>;
  onMarkAsDelivered: (orderId: string) => Promise<boolean>;
  onMarkAsPickedUp: (orderId: string) => Promise<boolean>;
  onGenerateLabel: (orderId: string) => Promise<{ success: boolean; labelUrl?: string; trackingCode?: string; error?: string }>;
  onUpdateDeliveryMethod: (orderId: string, method: DeliveryMethod) => Promise<boolean>;
  onUpdateDeliveryWithShipping: (orderId: string, method: DeliveryMethod, shippingAmount: number, shippingService?: string) => Promise<boolean>;
  onUpdateCustomerZipCode?: (customerId: string, zipCode: string) => Promise<boolean>;
  onRecordCharge?: (orderId: string, channel: 'whatsapp' | 'direct', moveToAwaitingReturn?: boolean) => Promise<boolean>;
  onApprovePayment: (orderId: string) => Promise<boolean>;
  onRejectPayment: (orderId: string, reason: string) => Promise<boolean>;
  onRevertStatus?: (orderId: string, targetStatus: OperationalStatus, reason: string) => Promise<boolean>;
  onTrackingSynced?: (orderId: string, trackingCode: string) => void;
  chargeHistory?: { channel: string; created_at: string; charged_by?: string }[];
}

export function LiveOrderDetailDrawer({
  order,
  sellers,
  isAdmin,
  onClose,
  onAssignSeller,
  onMarkAsPaid,
  onMarkAsPaidWithProof,
  onMarkAsPosted,
  onMarkAsDelivered,
  onMarkAsPickedUp,
  onGenerateLabel,
  onUpdateDeliveryMethod,
  onUpdateDeliveryWithShipping,
  onUpdateCustomerZipCode,
  onRecordCharge,
  onApprovePayment,
  onRejectPayment,
  onRevertStatus,
  onTrackingSynced,
  chargeHistory = [],
}: LiveOrderDetailDrawerProps) {
  const [isGeneratingLabel, setIsGeneratingLabel] = useState(false);
  const [showManualPayment, setShowManualPayment] = useState(false);
  const [showRevalidateModal, setShowRevalidateModal] = useState(false);
  const [showRevertDialog, setShowRevertDialog] = useState(false);
  const [revertReason, setRevertReason] = useState("");
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [shippingDataKey, setShippingDataKey] = useState(0); // Force re-render after save
  const [isSyncingTracking, setIsSyncingTracking] = useState(false);

  if (!order) return null;

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const isPaid = order.status === 'pago';
  const isAwaitingPayment = order.status === 'aguardando_pagamento' || order.status === 'aberto';
  const isAwaitingReturn = order.operational_status === 'aguardando_retorno';
  const isCancelled = order.status === 'cancelado';

  // Calculate hours since creation
  const hoursSinceCreation = (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60);
  const isUrgent = (isAwaitingPayment || isAwaitingReturn) && hoursSinceCreation > 24;

  // Get bag link
  const getBagLink = () => {
    const base = `${window.location.origin}/live-checkout/${order.id}`;
    return order.public_token ? `${base}?token=${order.public_token}` : base;
  };

  // Build sophisticated WhatsApp charge message
  const buildChargeWhatsApp = () => {
    const customer = order.live_customer;
    if (!customer?.whatsapp) return null;

    const link = getBagLink();
    const message = buildLepoaChargeMessage(link);
    return buildWhatsAppLink(customer.whatsapp, message);
  };

  // Copy sophisticated message with link
  const copyChargeMessage = async () => {
    const link = getBagLink();
    const message = buildLepoaChargeMessage(link);
    const success = await copyToClipboard(message);
    if (success) {
      toast.success("Mensagem copiada ✔️");
    } else {
      toast.error("Erro ao copiar. Tente selecionar o texto manualmente.");
    }
  };

  // Register charge action
  const handleRecordCharge = async (channel: 'whatsapp' | 'direct') => {
    if (onRecordCharge) {
      await onRecordCharge(order.id, channel, true);
      toast.success("Cobrança registrada!");
    }
  };

  // Get Instagram profile link
  const getInstagramProfileLink = () => {
    const handle = order.live_customer?.instagram_handle?.replace(/@/g, '').trim();
    return handle ? `https://www.instagram.com/${handle}` : null;
  };

  // Build WhatsApp message
  const buildPaymentWhatsApp = () => {
    const customer = order.live_customer;
    if (!customer?.whatsapp) return null;

    const items = order.items?.filter(i => ['reservado', 'confirmado'].includes(i.status)) || [];
    const itemsList = items.map(i =>
      `• ${i.product?.name} (${(i.variante as any)?.tamanho || '-'}) x${i.qtd}`
    ).join('\n');

    const message = `Olá${customer.nome ? ` ${customer.nome.split(' ')[0]}` : ''}! 🛍️

Vi aqui que sua sacolinha #${order.bag_number} ainda está aguardando pagamento.

Itens reservados:
${itemsList}

Total: ${formatPrice(order.total)}

Posso te ajudar a finalizar? 💕`;

    return buildWhatsAppLink(customer.whatsapp, message);
  };

  // Request address via WhatsApp
  const buildAddressRequestWhatsApp = () => {
    const customer = order.live_customer;
    if (!customer?.whatsapp) return null;

    const message = `Olá${customer.nome ? ` ${customer.nome.split(' ')[0]}` : ''}! 📦

Para enviar seu pedido da sacola #${order.bag_number}, preciso dos dados de entrega:

• Nome completo
• CEP
• Endereço completo (rua, número, complemento)
• Telefone

Pode me enviar? 😊`;

    return buildWhatsAppLink(customer.whatsapp, message);
  };

  // Copy bag link
  const copyBagLink = async () => {
    const base = `${window.location.origin}/sacola/${order.id}`;
    const url = order.public_token ? `${base}?token=${order.public_token}` : base;
    const success = await copyToClipboard(url);
    if (success) {
      toast.success("Link copiado!");
    } else {
      toast.error("Erro ao copiar.");
    }
  };

  // Handle manual payment with proof
  const handleManualPaymentConfirm = async (method: string, proofUrl: string, notes?: string) => {
    const success = await onMarkAsPaidWithProof(order.id, method, proofUrl, notes);
    if (success) {
      setShowManualPayment(false);
    }
    return success;
  };

  // Handle label generation with detailed error handling
  const handleGenerateLabel = async () => {
    setIsGeneratingLabel(true);
    const result = await onGenerateLabel(order.id);
    setIsGeneratingLabel(false);

    if (result.success && result.labelUrl) {
      window.open(result.labelUrl, '_blank');
      toast.success("Etiqueta gerada com sucesso!");
    } else if (result.error) {
      // Check if error contains missing fields info
      if (result.error.includes("incompletos")) {
        setShowShippingForm(true);
        toast.error("Complete os dados de envio para gerar a etiqueta", {
          description: result.error,
          duration: 5000,
        });
      } else {
        toast.error(result.error);
      }
    }
  };

  // Handle sync tracking from Melhor Envio
  const handleSyncTracking = async () => {
    if (!order) return;
    setIsSyncingTracking(true);

    try {
      const { data, error } = await supabase.functions.invoke('sync-live-cart-tracking', {
        body: { cartId: order.id }
      });

      if (error) {
        console.error("Sync tracking error:", error);
        toast.error("Erro ao sincronizar rastreio");
        return;
      }

      if (data.error) {
        if (data.status === 'tracking_not_found') {
          toast.info("Código de rastreio ainda não disponível", {
            description: "Pode levar alguns minutos após a compra da etiqueta. Tente novamente em breve.",
          });
        } else {
          toast.error(data.error);
        }
        return;
      }

      if (data.success && data.tracking_code) {
        toast.success(`Rastreio sincronizado: ${data.tracking_code}`);
        if (onTrackingSynced) {
          onTrackingSynced(order.id, data.tracking_code);
        }
      }
    } catch (err) {
      console.error("Sync tracking error:", err);
      toast.error("Erro ao sincronizar rastreio");
    } finally {
      setIsSyncingTracking(false);
    }
  };


  const handleRevertStatus = async (targetStatus: OperationalStatus) => {
    if (!onRevertStatus) return;
    if (isAdmin && !revertReason.trim()) {
      toast.error("Informe o motivo da reversão");
      return;
    }
    const success = await onRevertStatus(order.id, targetStatus, revertReason);
    if (success) {
      setShowRevertDialog(false);
      setRevertReason("");
    }
  };

  // Get previous status options for revert
  const getRevertOptions = (): OperationalStatus[] => {
    const status = order.operational_status;
    const options: OperationalStatus[] = [];

    // Based on current status, show valid previous states
    if (status === 'entregue' || status === 'retirado') {
      if (order.delivery_method === 'correios') options.push('postado');
      if (order.delivery_method === 'motoboy') options.push('em_rota');
      if (order.delivery_method === 'retirada') options.push('retirada');
    }
    if (status === 'postado') options.push('etiqueta_gerada');
    if (status === 'etiqueta_gerada') options.push('preparar_envio');
    if (status === 'preparar_envio' || status === 'em_rota' || status === 'retirada') options.push('pago');
    if (status === 'pago' && isAdmin) options.push('aguardando_retorno', 'aguardando_pagamento');
    if (status === 'aguardando_retorno') options.push('aguardando_pagamento');

    return options;
  };

  // Get delivery display
  const DeliveryIcon = order.delivery_method === 'correios' ? Truck
    : order.delivery_method === 'motoboy' ? Bike
      : Store;

  const deliveryLabel = order.delivery_method === 'correios' ? 'Correios'
    : order.delivery_method === 'motoboy' ? 'Motoboy'
      : 'Retirada na Loja';

  return (
    <Sheet open={!!order} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col p-0 max-w-[100vw]">
        <SheetHeader className="shrink-0 p-3 sm:p-6 pb-2 sm:pb-4">
          <div className="flex items-start justify-between gap-2 pr-6">
            <SheetTitle className="flex items-center gap-2 flex-wrap min-w-0">
              <Badge variant="secondary" className="text-sm sm:text-lg px-2 sm:px-3 shrink-0">#{order.bag_number}</Badge>
              <span className="text-sm truncate">@{order.live_customer?.instagram_handle}</span>
            </SheetTitle>
          </div>
          {order.live_customer?.nome && (
            <p className="text-sm text-muted-foreground truncate">{order.live_customer.nome}</p>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1 px-3 sm:px-6">
          <div className="space-y-6 pb-6">
            {/* Status & Delivery */}
            <div className="flex flex-wrap gap-2">
              {isCancelled && <Badge variant="destructive">Cancelado</Badge>}
              {isAwaitingPayment && !isAwaitingReturn && (
                <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                  <Clock className="h-3 w-3 mr-1" />
                  Aguardando Pagamento
                </Badge>
              )}
              {isAwaitingReturn && (
                <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50">
                  <Clock className="h-3 w-3 mr-1" />
                  Aguardando Retorno
                </Badge>
              )}
              {isPaid && order.operational_status === 'pago' && (
                <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Pago
                </Badge>
              )}
              {order.operational_status === 'preparar_envio' && (
                <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">Preparar Envio</Badge>
              )}
              {order.operational_status === 'etiqueta_gerada' && (
                <Badge variant="outline" className="border-indigo-300 text-indigo-700 bg-indigo-50">Etiqueta Gerada</Badge>
              )}
              {order.operational_status === 'postado' && (
                <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50">Postado</Badge>
              )}
              {order.operational_status === 'em_rota' && (
                <Badge variant="outline" className="border-cyan-300 text-cyan-700 bg-cyan-50">
                  <Bike className="h-3 w-3 mr-1" />
                  Em Rota
                </Badge>
              )}
              {order.operational_status === 'retirada' && (
                <Badge variant="outline" className="border-teal-300 text-teal-700 bg-teal-50">
                  <Store className="h-3 w-3 mr-1" />
                  Aguardando Retirada
                </Badge>
              )}
              {(order.operational_status === 'entregue' || order.operational_status === 'retirado') && (
                <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Entregue
                </Badge>
              )}
              {order.is_raffle_winner && (
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                  <Trophy className="h-3 w-3 mr-1" />
                  {order.raffle_name || 'Sorteio'}
                </Badge>
              )}
              {isUrgent && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  +{Math.floor(hoursSinceCreation)}h pendente
                </Badge>
              )}
            </div>

            {/* Seller Assignment - Fixed controlled select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Vendedora Responsável</label>
              <Select
                value={order.seller_id || "unassigned"}
                onValueChange={(value) => onAssignSeller(order.id, value === "unassigned" ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar vendedora" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Nenhuma</SelectItem>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Items */}
            <div className="space-y-3">
              <h4 className="font-medium">Itens do Pedido</h4>
              {order.items?.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg border",
                    item.status === 'cancelado' && "opacity-50 bg-muted"
                  )}
                >
                  {item.product?.image_url ? (
                    <img
                      src={item.product.image_url}
                      alt=""
                      className="w-12 h-12 rounded object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.product?.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{(item.variante as any)?.tamanho || '-'}</span>
                      {item.product?.color && <span>• {item.product.color}</span>}
                      <span>• x{item.qtd}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatPrice(item.preco_unitario * item.qtd)}</p>
                    {item.status === 'cancelado' && (
                      <Badge variant="destructive" className="text-xs">Cancelado</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              {order.descontos > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Descontos</span>
                  <span>-{formatPrice(order.descontos)}</span>
                </div>
              )}
              {order.frete > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Frete</span>
                  <span>{formatPrice(order.frete)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total</span>
                <span>{formatPrice(order.total)}</span>
              </div>
            </div>

            <Separator />

            {/* Delivery Method Section - BEFORE payment for admin flow */}
            {(isAwaitingPayment || isAwaitingReturn) && !isCancelled && (
              <DeliveryMethodSection
                orderId={order.id}
                currentMethod={order.delivery_method}
                currentShipping={order.frete}
                currentShippingService={order.shipping_service_name}
                subtotal={order.subtotal}
                discounts={order.descontos}
                isPaid={isPaid}
                isAwaitingPayment={isAwaitingPayment || isAwaitingReturn}
                customerZipCode={order.shipping_address_snapshot?.zip_code}
                customerId={order.live_customer?.client_id}
                orderItems={order.items?.map(i => ({ qtd: i.qtd, product_id: i.product_id })) || []}
                onUpdateDelivery={onUpdateDeliveryWithShipping}
                onUpdateCustomerZip={onUpdateCustomerZipCode}
              />
            )}

            {/* Delivery display for paid orders */}
            {isPaid && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <DeliveryIcon className="h-4 w-4" />
                    Entrega: {deliveryLabel}
                  </h4>
                  <Badge className="bg-green-100 text-green-700 border-green-300">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Confirmada
                  </Badge>
                </div>
                {order.frete > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Frete: {formatPrice(order.frete)}
                  </div>
                )}

                {/* Shipping address for Correios */}
                {order.delivery_method === 'correios' && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2" key={shippingDataKey}>
                    {(() => {
                      const snapshot = order.shipping_address_snapshot as ShippingAddressData | null;
                      const missingFields = getMissingShippingFields(snapshot);
                      const hasAllData = missingFields.length === 0;

                      // Show form if explicitly opened or if data is missing
                      if (showShippingForm || !hasAllData) {
                        return (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-amber-700 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                Completar dados de envio
                              </h4>
                              {hasAllData && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowShippingForm(false)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <ShippingDataForm
                              orderId={order.id}
                              customerId={order.live_customer?.client_id}
                              currentData={snapshot}
                              customerName={order.live_customer?.nome}
                              customerPhone={order.live_customer?.whatsapp}
                              onSaved={() => {
                                setShowShippingForm(false);
                                setShippingDataKey(prev => prev + 1);
                                // Trigger refetch - this will happen via realtime
                              }}
                              onCancel={hasAllData ? () => setShowShippingForm(false) : undefined}
                            />
                            {order.live_customer?.whatsapp && (
                              <div className="pt-2 border-t">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted-foreground w-full"
                                  asChild
                                >
                                  <a
                                    href={buildAddressRequestWhatsApp() || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <MessageCircle className="h-4 w-4 mr-2" />
                                    Solicitar via WhatsApp
                                  </a>
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // Show address data with edit button
                      return (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                              <div className="text-sm">
                                <p className="font-medium">{snapshot?.name || order.live_customer?.nome}</p>
                                <p>{snapshot?.street}, {snapshot?.number}</p>
                                {snapshot?.complement && (
                                  <p>{snapshot.complement}</p>
                                )}
                                <p>{snapshot?.neighborhood}</p>
                                <p>{snapshot?.city}/{snapshot?.state}</p>
                                <p className="font-medium">CEP: {snapshot?.zip_code}</p>
                                {snapshot?.phone && (
                                  <p className="text-muted-foreground">Tel: {snapshot.phone}</p>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0"
                              onClick={() => setShowShippingForm(true)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {/* Tracking Section - Enhanced UI */}
                          {(() => {
                            const hasValidTracking = isValidTrackingCode(order.shipping_tracking_code);
                            const hasLabel = !!order.me_label_url || !!order.me_shipment_id;
                            const showTrackingSection = hasLabel || order.shipping_tracking_code;

                            if (!showTrackingSection) return null;

                            return (
                              <div className="pt-3 mt-3 border-t space-y-2">
                                {hasValidTracking ? (
                                  // Valid tracking - show full info with buttons
                                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                      <Truck className="h-4 w-4 text-purple-600" />
                                      <span className="text-sm font-medium text-purple-800">Código de rastreio</span>
                                    </div>
                                    <p className="font-mono text-lg text-purple-900">{order.shipping_tracking_code}</p>
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1 border-purple-200 text-purple-700 hover:bg-purple-100"
                                        onClick={async () => {
                                          await navigator.clipboard.writeText(order.shipping_tracking_code!);
                                          toast.success("Código copiado!");
                                        }}
                                      >
                                        <Copy className="h-3 w-3" />
                                        Copiar
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1 border-purple-200 text-purple-700 hover:bg-purple-100"
                                        onClick={() => {
                                          window.open(
                                            `https://rastreamento.correios.com.br/app/index.php?objeto=${order.shipping_tracking_code}`,
                                            '_blank'
                                          );
                                        }}
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        Rastrear nos Correios
                                      </Button>
                                    </div>
                                  </div>
                                ) : hasLabel ? (
                                  // Has label but no valid tracking yet - show sync button
                                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                                    <div className="flex items-center gap-2 text-amber-700">
                                      <AlertTriangle className="h-4 w-4" />
                                      <span className="text-sm font-medium">Etiqueta gerada, aguardando rastreio</span>
                                    </div>
                                    <p className="text-xs text-amber-600">
                                      O código de rastreio pode levar alguns minutos para ficar disponível após a compra da etiqueta.
                                    </p>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-100"
                                      onClick={handleSyncTracking}
                                      disabled={isSyncingTracking}
                                    >
                                      {isSyncingTracking ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <RefreshCw className="h-3 w-3" />
                                      )}
                                      Sincronizar Rastreio
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })()}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Payment Validation Section - Shows for manual payments */}
            <PaymentValidationSection
              order={order}
              isAdmin={isAdmin}
              onApprove={onApprovePayment}
              onReject={onRejectPayment}
            />

            {/* Charge History */}
            {chargeHistory.length > 0 && (
              <div className="space-y-2">
                <Separator />
                <h4 className="font-medium text-sm">Histórico de Cobranças</h4>
                <div className="space-y-1">
                  {chargeHistory.map((charge, idx) => (
                    <div key={idx} className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="capitalize">{charge.channel === 'whatsapp' ? '💬 WhatsApp' : '📸 Direct'}</span>
                      <span>•</span>
                      <span>{format(new Date(charge.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Customer Notes - from checkout */}
            {(order.customer_checkout_notes || order.customer_live_notes || order.delivery_notes) && (
              <>
                <Separator />
                <div className="space-y-3">
                  {order.customer_checkout_notes && (
                    <div>
                      <h4 className="font-medium text-sm flex items-center gap-2 text-blue-700 mb-2">
                        <MessageCircle className="h-4 w-4" />
                        Observação do cliente
                      </h4>
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                        {order.customer_checkout_notes}
                      </div>
                    </div>
                  )}
                  {order.customer_live_notes && (
                    <div>
                      <h4 className="font-medium text-sm flex items-center gap-2 text-purple-700 mb-2">
                        <MessageCircle className="h-4 w-4" />
                        Obs. da Live
                      </h4>
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm">
                        {order.customer_live_notes}
                      </div>
                    </div>
                  )}
                  {order.delivery_notes && order.delivery_method === 'motoboy' && (
                    <div>
                      <h4 className="font-medium text-sm flex items-center gap-2 text-amber-700 mb-2">
                        <Bike className="h-4 w-4" />
                        Instruções de entrega
                      </h4>
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                        {order.delivery_notes}
                        {order.delivery_period && (
                          <p className="mt-1 text-xs text-amber-600">
                            Período: {order.delivery_period === 'manha' ? 'Manhã' : order.delivery_period === 'tarde' ? 'Tarde' : 'Qualquer horário'}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Contact */}
            <div className="space-y-2">
              {order.live_customer?.whatsapp && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{order.live_customer.whatsapp}</span>
                </div>
              )}
              {getInstagramProfileLink() && (
                <a
                  href={getInstagramProfileLink()!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  {displayInstagram(order.live_customer?.instagram_handle || '')}
                </a>
              )}
            </div>

            {/* Timestamps */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Criado: {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              <p>Atualizado: {format(new Date(order.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              {order.last_charge_at && (
                <p>Última cobrança: {format(new Date(order.last_charge_at), "dd/MM HH:mm", { locale: ptBR })}</p>
              )}
              {order.label_printed_at && (
                <p>Etiqueta impressa: {format(new Date(order.label_printed_at), "dd/MM HH:mm", { locale: ptBR })}</p>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Actions Footer */}
        <div className="shrink-0 border-t pt-4 space-y-3">
          {/* Awaiting Payment or Awaiting Return - Show charge actions */}
          {(isAwaitingPayment || isAwaitingReturn) && !isCancelled && (
            <>
              {/* Charge actions with sophisticated message */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  {order.live_customer?.whatsapp && (
                    <Button variant="outline" className="flex-1" asChild>
                      <a
                        href={buildChargeWhatsApp() || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        {isAwaitingReturn ? 'Cobrar novamente' : 'Cobrar WhatsApp'}
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" onClick={copyChargeMessage}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Mensagem
                  </Button>
                </div>

                {/* Instagram profile link for Direct */}
                {getInstagramProfileLink() && (
                  <Button variant="outline" className="w-full" asChild>
                    <a
                      href={getInstagramProfileLink()!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir Instagram para Direct
                    </a>
                  </Button>
                )}

                {/* Register charge separately */}
                {onRecordCharge && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => handleRecordCharge('whatsapp')}
                    >
                      Registrar via WhatsApp
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-purple-300 text-purple-700 hover:bg-purple-50"
                      onClick={() => handleRecordCharge('direct')}
                    >
                      Registrar via Direct
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* ETAPA 2: Payment Section - Only enabled after delivery is confirmed */}
              {(() => {
                const deliveryReady = isDeliveryConfiguredForPayment(order.delivery_method, order.frete);

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">ETAPA 2: Confirmar Pagamento</h4>
                      {deliveryReady ? (
                        <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Liberado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-gray-300 text-gray-500 text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Aguardando Etapa 1
                        </Badge>
                      )}
                    </div>

                    {/* Single "Pago" button opens manual payment modal - LOCKED until delivery is confirmed */}
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                      onClick={() => setShowManualPayment(true)}
                      disabled={!deliveryReady}
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Marcar como Pago (com comprovante)
                    </Button>

                    {/* Warning if delivery not confirmed */}
                    {!deliveryReady && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 flex items-center gap-2 text-xs">
                        <ShieldAlert className="h-4 w-4 text-gray-500 shrink-0" />
                        <span className="text-gray-600">
                          Complete a Etapa 1 (Confirmar forma de envio) para liberar o pagamento
                        </span>
                      </div>
                    )}

                    {/* Revalidate from Mercado Pago - always enabled (uses checkout total) */}
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => setShowRevalidateModal(true)}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Revalidar Pagamento MP
                    </Button>
                  </div>
                );
              })()}
            </>
          )}

          {/* POST-PAYMENT LOGISTICS - Based EXCLUSIVELY on operational_status */}
          {isPaid && !isCancelled && order.payment_review_status !== 'pending_review' && (() => {
            const opStatus = order.operational_status;
            const method = order.delivery_method;
            const isFinalStatus = opStatus === 'entregue' || opStatus === 'retirado';

            // If already final, don't show any logistics buttons
            if (isFinalStatus) return null;

            return (
              <div className="space-y-3">
                <Separator />

                {/* CORREIOS FLOW: pago → preparar_envio → etiqueta_gerada → postado → entregue */}
                {method === 'correios' && (
                  <>
                    {/* Status: pago or preparar_envio - Need to generate label first */}
                    {(opStatus === 'pago' || opStatus === 'preparar_envio') && (() => {
                      const snapshot = order.shipping_address_snapshot as ShippingAddressData | null;
                      const missingFields = getMissingShippingFields(snapshot);
                      const canGenerateLabel = missingFields.length === 0;

                      return (
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">
                            Próximo passo: Gerar etiqueta Melhor Envio
                          </div>
                          <Button
                            className="w-full"
                            onClick={handleGenerateLabel}
                            disabled={isGeneratingLabel || !canGenerateLabel}
                          >
                            {isGeneratingLabel ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Tag className="h-4 w-4 mr-2" />
                            )}
                            Gerar Etiqueta
                          </Button>
                          {!canGenerateLabel && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 space-y-2">
                              <div className="text-xs text-amber-700 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Complete os dados de envio acima para gerar a etiqueta
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full border-amber-300 text-amber-700 hover:bg-amber-100"
                                onClick={() => setShowShippingForm(true)}
                              >
                                <Edit2 className="h-3 w-3 mr-2" />
                                Completar dados de envio
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Status: etiqueta_gerada - Can print or mark as posted */}
                    {opStatus === 'etiqueta_gerada' && order.me_label_url && (
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" asChild>
                          <a href={order.me_label_url} target="_blank" rel="noopener noreferrer">
                            <Printer className="h-4 w-4 mr-2" />
                            Imprimir Etiqueta
                          </a>
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={() => onMarkAsPosted(order.id)}
                        >
                          <Truck className="h-4 w-4 mr-2" />
                          Marcar Postado
                        </Button>
                      </div>
                    )}

                    {/* Status: postado - Can mark as delivered ONLY with valid tracking */}
                    {opStatus === 'postado' && (() => {
                      const hasValidTracking = isValidTrackingCode(order.shipping_tracking_code);

                      if (!hasValidTracking) {
                        return (
                          <div className="space-y-2">
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                              <div className="flex items-center gap-2 text-amber-700">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="text-sm font-medium">Aguardando código de rastreio</span>
                              </div>
                              <p className="text-xs text-amber-600">
                                Não é possível marcar como entregue sem um código de rastreio válido.
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-100 w-full"
                                onClick={handleSyncTracking}
                                disabled={isSyncingTracking}
                              >
                                {isSyncingTracking ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3 w-3" />
                                )}
                                Sincronizar Rastreio
                              </Button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <Button
                          className="w-full bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => onMarkAsDelivered(order.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Marcar como Entregue
                        </Button>
                      );
                    })()}
                  </>
                )}

                {/* MOTOBOY FLOW: pago → em_rota → entregue */}
                {method === 'motoboy' && (
                  <>
                    {/* Status: pago - Need to mark as "em rota" first */}
                    {opStatus === 'pago' && (
                      <Button
                        className="w-full"
                        onClick={() => onMarkAsDelivered(order.id)}
                      >
                        <Bike className="h-4 w-4 mr-2" />
                        Marcar Em Rota
                      </Button>
                    )}

                    {/* Status: em_rota - Can mark as delivered */}
                    {opStatus === 'em_rota' && (
                      <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => onMarkAsDelivered(order.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Marcar como Entregue
                      </Button>
                    )}
                  </>
                )}

                {/* RETIRADA FLOW: pago → retirada → entregue */}
                {method === 'retirada' && (
                  <>
                    {/* Status: pago - Need to mark as "aguardando retirada" first */}
                    {opStatus === 'pago' && (
                      <Button
                        className="w-full"
                        onClick={() => onMarkAsPickedUp(order.id)}
                      >
                        <Store className="h-4 w-4 mr-2" />
                        Marcar Aguardando Retirada
                      </Button>
                    )}

                    {/* Status: retirada - Can mark as picked up / delivered */}
                    {opStatus === 'retirada' && (
                      <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => onMarkAsPickedUp(order.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Marcar como Retirado
                      </Button>
                    )}
                  </>
                )}
              </div>
            );
          })()}

          {/* Revert Status - for Admin and Seller with restrictions */}
          {onRevertStatus && getRevertOptions().length > 0 && !isCancelled && (
            <div className="pt-2 border-t border-border/40">
              {!showRevertDialog ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground hover:text-foreground"
                  onClick={() => setShowRevertDialog(true)}
                >
                  <Undo2 className="h-4 w-4 mr-2" />
                  Voltar Status
                </Button>
              ) : (
                <div className="space-y-2">
                  <Label className="text-sm">Voltar para:</Label>
                  <div className="flex flex-wrap gap-2">
                    {getRevertOptions().map((status) => (
                      <Button
                        key={status}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleRevertStatus(status)}
                      >
                        {status.replace(/_/g, ' ')}
                      </Button>
                    ))}
                  </div>
                  {isAdmin && (
                    <Input
                      placeholder="Motivo da reversão (obrigatório para admin)"
                      value={revertReason}
                      onChange={(e) => setRevertReason(e.target.value)}
                      className="text-sm"
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowRevertDialog(false);
                      setRevertReason("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>

      {/* Manual Payment Modal */}
      <ManualPaymentModal
        open={showManualPayment}
        onClose={() => setShowManualPayment(false)}
        orderId={order.id}
        orderTotal={order.total}
        onConfirm={handleManualPaymentConfirm}
      />

      {/* Revalidate Payment Modal */}
      <RevalidatePaymentModal
        open={showRevalidateModal}
        onClose={() => setShowRevalidateModal(false)}
        onSuccess={onClose}
        liveCartId={order.id}
      />
    </Sheet>
  );
}
