import { useState, useEffect } from "react";
import {
  Package,
  Minus,
  X,
  AlertCircle,
  Trophy,
  XCircle,
  Printer,
  ClipboardList,
  Clock,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { LiveCart, LiveProduct } from "@/types/liveShop";
import { CartStatusHistory } from "./CartStatusHistory";
import { usePendencias, Pendencia } from "@/hooks/usePendencias";

interface BackstageCartModalProps {
  cart: LiveCart | null;
  onClose: () => void;
  onRemoveItem: (itemId: string) => Promise<{ success: boolean; waitlistEntry?: any; productId?: string }>;
  onReduceQuantity: (itemId: string) => Promise<boolean>;
  onCancelCart: (cartId: string) => Promise<void>;
  products: LiveProduct[];
  onWaitlistOffer: (waitlistItem: any, product: LiveProduct) => void;
  cartHistory: any[];
  historyLoading: boolean;
}

export function BackstageCartModal({
  cart,
  onClose,
  onRemoveItem,
  onReduceQuantity,
  onCancelCart,
  products,
  onWaitlistOffer,
  cartHistory,
  historyLoading,
}: BackstageCartModalProps) {
  const [notes, setNotes] = useState(cart?.customer_live_notes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPendencia, setIsSavingPendencia] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [existingPendencia, setExistingPendencia] = useState<Pendencia | null>(null);

  const { upsertPendencia, getPendenciaForCart } = usePendencias();

  // Sync state when cart changes and load existing pendencia
  useEffect(() => {
    if (cart) {
      setNotes(cart.customer_live_notes || "");
      // Load existing pendencia for this cart
      getPendenciaForCart(cart.id).then(setExistingPendencia);
    }
  }, [cart?.id, cart?.customer_live_notes]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const handleSaveNotes = async () => {
    if (!cart) return;
    setIsSaving(true);
    
    const { error } = await supabase
      .from("live_carts")
      .update({
        customer_live_notes: notes,
      })
      .eq("id", cart.id);

    setIsSaving(false);
    
    if (error) {
      toast.error("Erro ao salvar observações");
    } else {
      toast.success("Observações salvas!");
    }
  };

  const handleSaveAndCreatePendencia = async () => {
    if (!cart) return;
    setIsSavingPendencia(true);

    // First save the notes
    const { error } = await supabase
      .from("live_carts")
      .update({ customer_live_notes: notes })
      .eq("id", cart.id);

    if (error) {
      toast.error("Erro ao salvar observações");
      setIsSavingPendencia(false);
      return;
    }

    // Create or update pendencia
    const bagNumber = cart.bag_number ? `#${String(cart.bag_number).padStart(3, '0')}` : '';
    const customerHandle = cart.live_customer?.instagram_handle || 'cliente';
    
    await upsertPendencia({
      live_cart_id: cart.id,
      live_event_id: cart.live_event_id,
      live_customer_id: cart.live_customer_id,
      type: 'observacao_cliente',
      title: `Observação ${bagNumber} @${customerHandle}`,
      description: notes,
      priority: 'media',
    });

    // Refresh pendencia state
    const updated = await getPendenciaForCart(cart.id);
    setExistingPendencia(updated);
    
    setIsSavingPendencia(false);
  };

  const handleCancelCart = async () => {
    if (!cart) return;
    if (confirm("Tem certeza que deseja cancelar este carrinho?")) {
      setIsCancelling(true);
      await onCancelCart(cart.id);
      setIsCancelling(false);
      onClose();
    }
  };

  if (!cart) return null;

  const activeItems = (cart.items || []).filter(i => 
    ['reservado', 'confirmado', 'expirado'].includes(i.status)
  );
  const cancelledItems = (cart.items || []).filter(i => i.status === 'cancelado');
  const bagNumber = cart.bag_number;
  const needsReprint = cart.needs_label_reprint;
  const isEditable = cart.status !== 'pago' && cart.status !== 'cancelado';

  // Pendencia status display
  const getPendenciaStatusBadge = () => {
    if (!existingPendencia) return null;
    switch (existingPendencia.status) {
      case 'aberta':
        return <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-xs"><Clock className="h-3 w-3 mr-1" />Pendência Aberta</Badge>;
      case 'em_andamento':
        return <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 text-xs"><AlertCircle className="h-3 w-3 mr-1" />Em Andamento</Badge>;
      case 'resolvida':
        return <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Resolvida</Badge>;
    }
  };

  return (
    <Dialog open={!!cart} onOpenChange={() => onClose()}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
        {/* Fixed Header */}
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 flex-wrap text-base sm:text-lg">
            <span className="truncate">Carrinho de {cart.live_customer?.instagram_handle}</span>
            {cart.is_raffle_winner && (
              <Badge className="bg-amber-500 text-white gap-1 shrink-0 text-xs">
                <Trophy className="h-3 w-3" />
                Ganhadora
              </Badge>
            )}
            {needsReprint && (
              <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 shrink-0 text-xs">
                <Printer className="h-3 w-3" />
                Reimprimir
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 min-h-0">
          <div className="space-y-4">
            {/* Warning for carts with bag label already printed */}
          {bagNumber && isEditable && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-amber-800">
                    Sacola #{String(bagNumber).padStart(3, '0')} já tem etiqueta
                  </span>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Se modificar itens, reimprima a etiqueta.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Items - Mobile optimized */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Itens do pedido:</Label>
            {activeItems.map(item => (
              <div 
                key={item.id}
                className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-muted/30 rounded-lg"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-secondary rounded overflow-hidden shrink-0">
                  {item.product?.image_url ? (
                    <img 
                      src={item.product.image_url} 
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{item.product?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Tam: {(item.variante as any)?.tamanho} • Qtd: {item.qtd}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-medium text-sm">{formatPrice(item.preco_unitario * item.qtd)}</div>
                  {isEditable && (
                    <div className="flex gap-1 justify-end mt-1">
                      {item.qtd > 1 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground h-7 w-7 p-0 hover:text-foreground"
                              onClick={() => onReduceQuantity(item.id)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remover 1 unidade</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground h-7 w-7 p-0 hover:text-foreground"
                            onClick={async () => {
                              const result = await onRemoveItem(item.id);
                              if (result.success && result.waitlistEntry) {
                                const product = products.find(p => p.product_id === result.productId);
                                if (product) {
                                  onWaitlistOffer(result.waitlistEntry, product);
                                }
                              }
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {item.qtd > 1 ? `Remover todas ${item.qtd} unidades` : 'Remover (devolve ao estoque)'}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Cancelled Items */}
            {cancelledItems.length > 0 && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Itens cancelados - retirar da sacola</span>
                </div>
                {cancelledItems.map(item => (
                  <div 
                    key={item.id}
                    className="flex items-center gap-2 p-2 bg-amber-100/50 rounded mt-1"
                  >
                    <div className="w-8 h-8 bg-secondary rounded overflow-hidden shrink-0 opacity-60">
                      {item.product?.image_url ? (
                        <img 
                          src={item.product.image_url} 
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-amber-800 truncate line-through">
                        {item.product?.name}
                      </div>
                      <div className="text-xs text-amber-600">
                        Tam: {(item.variante as any)?.tamanho} • Qtd: {item.qtd}
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-xs shrink-0">
                      Retirar
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total */}
          <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
            <span className="font-medium">Total</span>
            <span className="text-xl font-bold">
              {formatPrice(activeItems.reduce((sum, i) => sum + i.preco_unitario * i.qtd, 0))}
            </span>
          </div>

          {/* Current Status */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">Status atual:</span>
            <Badge className={
              cart.status === 'pago' 
                ? 'bg-green-100 text-green-700' 
                : cart.status === 'cancelado'
                  ? 'bg-red-100 text-red-700'
                  : ['aguardando_pagamento', 'em_confirmacao', 'expirado'].includes(cart.status)
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700'
            }>
              {cart.status === 'pago' && '✅ Pago'}
              {cart.status === 'aberto' && '🛒 Aberto'}
              {cart.status === 'aguardando_pagamento' && '⏳ Aguardando pagamento'}
              {cart.status === 'cancelado' && '❌ Cancelado'}
              {cart.status === 'expirado' && '⏳ Aguardando pagamento'}
              {cart.status === 'em_confirmacao' && '🔄 Confirmando'}
            </Badge>
          </div>

          {/* Status History - only show if there are entries */}
          {cartHistory.length > 0 && (
            <CartStatusHistory history={cartHistory} isLoading={historyLoading} />
          )}

          {/* Observações da Cliente Section - Enhanced */}
          <div className="space-y-3 pt-4 border-t">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Observações da Cliente
                </Label>
                {getPendenciaStatusBadge()}
              </div>
              <Textarea
                placeholder="Ex: blusa branca • presente • look viagem"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[60px] text-sm resize-none"
                style={{ height: 'auto', minHeight: '60px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 150)}px`;
                }}
              />
            </div>

            {/* Action Buttons for Notes */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="default"
                className="flex-1 h-11"
                onClick={handleSaveAndCreatePendencia}
                disabled={isSavingPendencia || !notes.trim()}
              >
                {isSavingPendencia ? "Salvando..." : existingPendencia ? "Atualizar Pendência" : "Salvar e Criar Pendência"}
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={handleSaveNotes}
                disabled={isSaving}
              >
                {isSaving ? "Salvando..." : "Salvar apenas no pedido"}
              </Button>
            </div>

            {/* Raffle Winner Section - Read only display when marked as winner */}
            {cart?.is_raffle_winner && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Ganhadora de Sorteio</span>
                </div>
                {cart.raffle_name && (
                  <p className="text-xs text-amber-700 mt-1">{cart.raffle_name}</p>
                )}
                {cart.raffle_prize && (
                  <p className="text-xs text-amber-600 mt-0.5">🎁 {cart.raffle_prize}</p>
                )}
              </div>
            )}
          </div>

          {/* Cancel Cart Button */}
          {isEditable && (
            <Button 
              variant="outline"
              className="w-full gap-1 text-destructive border-destructive/20 hover:bg-destructive/10 h-11"
              disabled={isCancelling}
              onClick={handleCancelCart}
            >
              <XCircle className="h-4 w-4" />
              Cancelar Carrinho
            </Button>
          )}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
