import { useState, useEffect } from "react";
import {
  Send,
  MessageCircle,
  Copy,
  ExternalLink,
  Instagram,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildWhatsAppLink, buildLepoaChargeMessage, displayInstagram, getInstagramProfileUrl } from "@/lib/whatsappHelpers";
import { toast } from "sonner";
import { WhatsAppFallbackModal } from "@/components/WhatsAppFallbackModal";
import type { LiveOrderCart } from "@/hooks/useLiveOrders";

interface MassChargeModalProps {
  open: boolean;
  onClose: () => void;
  orders: LiveOrderCart[];
  onRecordCharge: (orderId: string, channel: 'whatsapp' | 'direct', moveToAwaitingReturn?: boolean) => Promise<boolean>;
}

export function MassChargeModal({
  open,
  onClose,
  orders,
  onRecordCharge,
}: MassChargeModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [channel, setChannel] = useState<'whatsapp' | 'direct'>('whatsapp');
  const [isSending, setIsSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [copiedIndices, setCopiedIndices] = useState<Set<number>>(new Set());
  const [chargedIndices, setChargedIndices] = useState<Set<number>>(new Set());
  
  // WhatsApp fallback modal state
  const [fallbackModal, setFallbackModal] = useState<{
    open: boolean;
    message: string;
    phone: string;
  }>({ open: false, message: "", phone: "" });

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelected(new Set(orders.map(o => o.id)));
      setCopiedIndices(new Set());
      setChargedIndices(new Set());
      setSentCount(0);
    }
  }, [open, orders]);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const toggleSelect = (orderId: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelected(newSelected);
  };

  const selectAll = () => {
    if (selected.size === orders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(orders.map(o => o.id)));
    }
  };

  const selectedOrders = orders.filter(o => selected.has(o.id));

  // Build bag link
  const getBagLink = (order: LiveOrderCart) => {
    const base = `${window.location.origin}/live-checkout/${order.id}`;
    return (order as any).public_token ? `${base}?token=${(order as any).public_token}` : base;
  };

  // Build sophisticated LE.POÁ message
  const buildMessage = (order: LiveOrderCart) => {
    return buildLepoaChargeMessage(getBagLink(order), order.bag_number || undefined);
  };

  // Handle WhatsApp send - opens one by one
  const handleWhatsAppSend = async () => {
    const ordersToSend = selectedOrders.filter(o => o.live_customer?.whatsapp);
    
    if (ordersToSend.length === 0) {
      toast.error("Nenhum pedido selecionado tem WhatsApp");
      return;
    }

    setIsSending(true);
    setSentCount(0);

    for (let i = 0; i < ordersToSend.length; i++) {
      const order = ordersToSend[i];
      const message = buildMessage(order);
      const link = buildWhatsAppLink(order.live_customer!.whatsapp!, message);
      
      try {
        window.open(link, '_blank');
      } catch (e) {
        // If popup blocked, show fallback modal
        setFallbackModal({
          open: true,
          message,
          phone: order.live_customer!.whatsapp!,
        });
      }
      
      await onRecordCharge(order.id, 'whatsapp', true);
      setSentCount(i + 1);

      // Wait between opens to avoid popup blocker
      if (i < ordersToSend.length - 1) {
        await new Promise(r => setTimeout(r, 600));
      }
    }

    setIsSending(false);
    toast.success(`${ordersToSend.length} cobranças registradas!`);
    // DON'T close the modal automatically
  };

  // Handle individual Direct copy - ONLY copy, don't record charge or close modal
  const handleCopyMessage = async (order: LiveOrderCart, index: number) => {
    const message = buildMessage(order);
    await navigator.clipboard.writeText(message);
    
    // Mark as copied visually (but don't record charge yet)
    setCopiedIndices(prev => new Set([...prev, index]));
    
    toast.success("Mensagem copiada!");
    // DON'T close the modal
  };

  // Copy bag link only
  const handleCopyLink = async (order: LiveOrderCart) => {
    const link = getBagLink(order);
    await navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
    // DON'T close the modal
  };

  // Handle recording the charge separately (after sending)
  const handleRecordDirectCharge = async (order: LiveOrderCart, index: number) => {
    await onRecordCharge(order.id, 'direct', true);
    setChargedIndices(prev => new Set([...prev, index]));
    toast.success("Cobrança registrada!");
    // DON'T close the modal
  };

  // Count progress
  const chargedCount = chargedIndices.size;
  const totalWithWhatsApp = orders.filter(o => o.live_customer?.whatsapp).length;

  return (
    <>
      <Dialog open={open} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Cobrar Pendentes
              <Badge variant="secondary">{orders.length} pedidos</Badge>
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Envie cobranças elegantes com link de pagamento. O modal <strong>não fecha</strong> ao copiar.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={channel} onValueChange={(v) => setChannel(v as 'whatsapp' | 'direct')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="whatsapp" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                WhatsApp ({totalWithWhatsApp})
              </TabsTrigger>
              <TabsTrigger value="direct" className="flex items-center gap-2">
                <Instagram className="h-4 w-4" />
                Direct ({orders.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="whatsapp" className="mt-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
                <p className="font-medium mb-1">💬 Via WhatsApp</p>
                <p className="text-emerald-700">
                  Abre o WhatsApp para cada cliente selecionado. Se bloqueado, copie a mensagem manualmente.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="direct" className="mt-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-800">
                <p className="font-medium mb-1">📸 Via Direct Instagram</p>
                <p className="text-purple-700">
                  Para cada cliente: copie a mensagem → abra o perfil → envie → clique em "Registrar".
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {channel === 'whatsapp' && (
            <>
              {/* Selection for WhatsApp */}
              <div className="flex items-center gap-2 py-2 border-b mt-2">
                <Checkbox 
                  checked={selected.size === orders.length}
                  onCheckedChange={selectAll}
                />
                <span className="text-sm font-medium">
                  Selecionar todos ({selected.size}/{orders.length})
                </span>
                <span className="ml-auto text-sm text-muted-foreground">
                  Total: {formatPrice(selectedOrders.reduce((s, o) => s + o.total, 0))}
                </span>
              </div>

              {/* WhatsApp Order list */}
              <ScrollArea className="flex-1 min-h-[200px] max-h-[300px]">
                <div className="space-y-2 pr-4">
                  {orders.map((order) => {
                    const hasWhatsApp = !!order.live_customer?.whatsapp;
                    
                    return (
                      <div 
                        key={order.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          !hasWhatsApp ? 'opacity-50 bg-muted' : 'hover:bg-muted/50'
                        }`}
                      >
                        <Checkbox 
                          checked={selected.has(order.id)}
                          onCheckedChange={() => toggleSelect(order.id)}
                          disabled={!hasWhatsApp}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              #{order.bag_number}
                            </Badge>
                            <span className="font-medium truncate">
                              {displayInstagram(order.live_customer?.instagram_handle || '')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            {hasWhatsApp ? (
                              <span className="text-emerald-600">✓ WhatsApp</span>
                            ) : (
                              <span className="text-rose-600">Sem WhatsApp</span>
                            )}
                            {order.charge_attempts > 0 && (
                              <span>• {order.charge_attempts}x cobrada</span>
                            )}
                          </div>
                        </div>
                        <span className="font-bold text-sm">{formatPrice(order.total)}</span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* WhatsApp Actions */}
              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  {sentCount > 0 && `${sentCount} enviadas`}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onClose}>
                    Fechar
                  </Button>
                  <Button 
                    onClick={handleWhatsAppSend}
                    disabled={isSending || selectedOrders.filter(o => o.live_customer?.whatsapp).length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isSending ? (
                      <>Enviando {sentCount}/{selectedOrders.filter(o => o.live_customer?.whatsapp).length}...</>
                    ) : (
                      <>
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Abrir WhatsApp ({selectedOrders.filter(o => o.live_customer?.whatsapp).length})
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}

          {channel === 'direct' && (
            <>
              {/* Direct - Individual cards for each customer */}
              <ScrollArea className="flex-1 min-h-[200px] max-h-[400px] mt-2">
                <div className="space-y-3 pr-4">
                  {orders.map((order, index) => {
                    const handle = order.live_customer?.instagram_handle || '';
                    const isCopied = copiedIndices.has(index);
                    const isCharged = chargedIndices.has(index);
                    const profileUrl = getInstagramProfileUrl(handle);
                    
                    return (
                      <div 
                        key={order.id}
                        className={`p-4 rounded-lg border ${
                          isCharged ? 'bg-emerald-50 border-emerald-200' : 
                          isCopied ? 'bg-amber-50 border-amber-200' : 'bg-background'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-xs">
                                #{order.bag_number}
                              </Badge>
                              <span className="font-semibold">
                                {displayInstagram(handle)}
                              </span>
                              {isCharged && (
                                <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                                  <Check className="h-3 w-3 mr-1" />
                                  Registrada
                                </Badge>
                              )}
                              {isCopied && !isCharged && (
                                <Badge className="bg-amber-100 text-amber-700 text-xs">
                                  Copiada
                                </Badge>
                              )}
                            </div>
                            {order.live_customer?.nome && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {order.live_customer.nome}
                              </p>
                            )}
                            {/* Instagram profile link - CLICKABLE */}
                            {profileUrl && (
                              <a
                                href={profileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                {profileUrl}
                              </a>
                            )}
                          </div>
                          <span className="font-bold">{formatPrice(order.total)}</span>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="flex-1"
                              onClick={() => handleCopyMessage(order, index)}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Copiar mensagem
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="flex-1"
                              onClick={() => handleCopyLink(order)}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Só link
                            </Button>
                            {profileUrl && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                asChild
                              >
                                <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                          {!isCharged && (
                            <Button 
                              size="sm"
                              variant="secondary"
                              className="w-full border-amber-300 text-amber-700 hover:bg-amber-100"
                              onClick={() => handleRecordDirectCharge(order, index)}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Registrar cobrança
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Direct Actions */}
              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  {chargedCount > 0 && `${chargedCount} de ${orders.length} registradas`}
                </span>
                <Button variant="outline" onClick={onClose}>
                  Fechar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* WhatsApp Fallback Modal */}
      <WhatsAppFallbackModal
        isOpen={fallbackModal.open}
        onClose={() => setFallbackModal({ ...fallbackModal, open: false })}
        message={fallbackModal.message}
        phone={fallbackModal.phone}
      />
    </>
  );
}
