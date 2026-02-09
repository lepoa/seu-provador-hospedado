import { useState, useEffect } from "react";
import { 
  Users, 
  CheckCircle, 
  Clock, 
  XCircle, 
  MessageCircle, 
  ExternalLink,
  CreditCard,
  Package,
  Copy,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CustomerSale } from "@/hooks/useLiveReports";
import { CartStatusHistory } from "./CartStatusHistory";

interface LiveReportCustomerSalesProps {
  sales: CustomerSale[];
  onRefresh?: () => void;
}

export function LiveReportCustomerSales({ sales, onRefresh }: LiveReportCustomerSalesProps) {
  const [selectedSale, setSelectedSale] = useState<CustomerSale | null>(null);
  const [cartHistory, setCartHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  // Importante: no Backstage, carrinhos "expirado" são tratados como "Aguardando pagamento" para fins operacionais.
  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
    "pago": { label: "Pago", variant: "default", icon: CheckCircle },
    "aguardando_pagamento": { label: "Aguardando", variant: "secondary", icon: Clock },
    "aberto": { label: "Aberto", variant: "outline", icon: Clock },
    "em_confirmacao": { label: "Confirmando", variant: "secondary", icon: Clock },
    "cancelado": { label: "Cancelado", variant: "destructive", icon: XCircle },
    "expirado": { label: "Aguardando pagamento", variant: "secondary", icon: Clock },
  };

  // Load cart history when modal opens
  useEffect(() => {
    if (selectedSale) {
      setHistoryLoading(true);
      supabase
        .from("live_cart_status_history")
        .select("*")
        .eq("live_cart_id", selectedSale.cartId)
        .order("created_at", { ascending: true })
        .then(({ data }) => {
          setCartHistory(data || []);
          setHistoryLoading(false);
        });
    } else {
      setCartHistory([]);
    }
  }, [selectedSale?.cartId]);

  // Generate checkout link
  const getLiveCheckoutUrl = (cartId: string, publicToken?: string | null) => {
    const baseUrl = window.location.origin;
    return publicToken ? `${baseUrl}/live-checkout/${cartId}?token=${publicToken}` : `${baseUrl}/live-checkout/${cartId}`;
  };

  // Build WhatsApp charge message
  const buildChargeMessage = (sale: CustomerSale) => {
    const customerName = sale.nome || sale.instagram;
    const checkoutUrl = sale.mpCheckoutUrl || getLiveCheckoutUrl(sale.cartId, sale.publicToken);
    
    let message = `Oi${customerName ? ` ${customerName.split(' ')[0]}` : ''}! 💛\n\n`;
    message += `Vi aqui que seu pedido da live ainda está aguardando pagamento.\n\n`;
    
    sale.items.forEach(item => {
      const size = (item.variante as any)?.tamanho || '';
      const color = (item.variante as any)?.cor || item.product?.color || '';
      message += `• ${item.product?.name || 'Produto'}`;
      if (size) message += ` - Tam: ${size}`;
      if (color) message += ` (${color})`;
      message += ` - ${formatPrice(item.preco_unitario)}\n`;
    });
    
    message += `\n💰 Total: ${formatPrice(sale.valorTotal)}\n\n`;
    message += `Ainda quer garantir? Finalize por aqui:\n${checkoutUrl}\n\n`;
    message += `Me avisa se precisar de ajuda! 💚`;
    
    return message;
  };

  // Send WhatsApp message
  const handleSendWhatsApp = (sale: CustomerSale) => {
    const phone = sale.whatsapp?.replace(/\D/g, '') || '';
    const message = buildChargeMessage(sale);
    
    if (phone) {
      const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    } else {
      navigator.clipboard.writeText(message);
      toast.success("Mensagem copiada! Envie pelo Instagram DM.");
    }
  };

  // Generate new payment link with improved error handling
  const handleGeneratePayment = async (cartId: string) => {
    setPaymentLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-live-cart-payment', {
        body: { live_cart_id: cartId },
      });

      if (error) throw error;

      if (data?.success && data?.init_point) {
        // Check if link already existed
        if (data.already_exists) {
          toast.info("Link já existia - abrindo...");
        } else {
          toast.success("Link de pagamento gerado!");
        }
        window.open(data.init_point, '_blank');
        onRefresh?.();
      } else if (data?.error_code) {
        // Handle structured error from backend
        const errorMsg = data.message || "Erro ao gerar pagamento";
        const actionMsg = data.action ? ` ${data.action}` : "";
        toast.error(`${errorMsg}${actionMsg}`);
        console.error("Payment generation error:", data);
      } else {
        toast.error(data?.error || data?.message || "Erro ao gerar pagamento");
      }
    } catch (err: any) {
      console.error("Error generating payment:", err);
      // Try to parse structured error
      const errorData = err?.context?.json || err?.data;
      if (errorData?.error_code) {
        toast.error(errorData.message || "Erro ao gerar link de pagamento");
      } else {
        toast.error("Erro de conexão ao gerar link");
      }
    } finally {
      setPaymentLoading(false);
    }
  };

  // Copy checkout link
  const handleCopyLink = (sale: CustomerSale) => {
    const url = getLiveCheckoutUrl(sale.cartId, sale.publicToken);
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  if (sales.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Vendas por Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Nenhum carrinho registrado
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Vendas por Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sales.map((sale, index) => {
            const status = statusConfig[sale.status] || statusConfig.aberto;
            const StatusIcon = status.icon;

            return (
              <div 
                key={`${sale.customerId}-${index}`}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => setSelectedSale(sale)}
              >
                {/* Avatar/Initial */}
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-primary">
                    {sale.instagram.replace("@", "").charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Customer Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{sale.instagram}</div>
                  <div className="text-xs text-muted-foreground">
                    {sale.nome || "—"} • {sale.itens} {sale.itens === 1 ? "item" : "itens"}
                  </div>
                </div>

                {/* Status & Value */}
                <div className="text-right shrink-0">
                  <div className="font-semibold">{formatPrice(sale.valorTotal)}</div>
                  <Badge variant={status.variant} className="text-xs mt-1">
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {status.label}
                  </Badge>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Customer Detail Modal */}
      <Dialog
        open={!!selectedSale}
        onOpenChange={(open) => {
          if (!open) setSelectedSale(null);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">
                  {selectedSale?.instagram.replace("@", "").charAt(0).toUpperCase()}
                </span>
              </div>
              {selectedSale?.instagram}
            </DialogTitle>
          </DialogHeader>

          {selectedSale && (
            <div className="space-y-4">
              {/* Customer Info */}
              {selectedSale.nome && (
                <div className="text-sm text-muted-foreground">
                  {selectedSale.nome}
                  {selectedSale.whatsapp && ` • ${selectedSale.whatsapp}`}
                </div>
              )}

              {/* Items */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Itens do Carrinho</div>
                {selectedSale.items.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    Nenhum item no carrinho
                  </div>
                ) : (
                  selectedSale.items.map((item: any) => {
                    const itemStatus = item.status;
                    const isInactive = ["expirado", "removido", "cancelado"].includes(itemStatus);
                    
                    return (
                      <div 
                        key={item.id}
                        className={`flex items-center gap-3 p-2 rounded-lg ${isInactive ? 'bg-muted/20 opacity-70' : 'bg-muted/30'}`}
                      >
                        <div className="w-10 h-10 bg-secondary rounded overflow-hidden shrink-0">
                          {item.product?.image_url ? (
                            <img 
                              src={item.product.image_url} 
                              alt={item.product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground m-auto mt-3" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate flex items-center gap-2">
                            {item.product?.name}
                            {isInactive && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground">
                                {itemStatus === 'expirado' ? 'Expirado' : itemStatus === 'removido' ? 'Removido' : 'Cancelado'}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Tam: {(item.variante as any)?.tamanho} • Qtd: {item.qtd}
                          </div>
                        </div>
                        <div className={`font-medium text-sm ${isInactive ? 'line-through text-muted-foreground' : ''}`}>
                          {formatPrice(item.preco_unitario * item.qtd)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Total */}
              <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                <span className="font-medium">Total</span>
                <span className="text-xl font-bold">{formatPrice(selectedSale.valorTotal)}</span>
              </div>

              {/* Current Status */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Status atual:</span>
                 <Badge className={
                   selectedSale.status === 'pago'
                     ? 'bg-green-100 text-green-700'
                     : selectedSale.status === 'cancelado'
                       ? 'bg-red-100 text-red-700'
                       : ['aguardando_pagamento', 'em_confirmacao', 'expirado'].includes(selectedSale.status)
                         ? 'bg-amber-100 text-amber-700'
                         : 'bg-blue-100 text-blue-700'
                 }>
                  {selectedSale.status === 'pago' && '✅ Pago'}
                  {selectedSale.status === 'aberto' && '🛒 Aberto'}
                  {selectedSale.status === 'aguardando_pagamento' && '⏳ Aguardando'}
                  {selectedSale.status === 'cancelado' && '❌ Cancelado'}
                   {selectedSale.status === 'expirado' && '⏳ Aguardando pagamento'}
                  {selectedSale.status === 'em_confirmacao' && '🔄 Confirmando'}
                </Badge>
              </div>

              {/* Status History */}
              <CartStatusHistory history={cartHistory} isLoading={historyLoading} />

              {/* Actions for pending carts - show for any non-paid, non-cancelled status */}
              {!['pago', 'cancelado'].includes(selectedSale.status) && (
                <div className="space-y-3 pt-4 border-t mt-4">
                  <div className="text-sm font-medium">Cobrar cliente</div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      className="gap-1.5"
                      onClick={() => handleCopyLink(selectedSale)}
                    >
                      <Copy className="h-4 w-4" />
                      Copiar Link
                    </Button>
                    <Button 
                      variant="outline" 
                      className="gap-1.5 text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => handleSendWhatsApp(selectedSale)}
                    >
                      <MessageCircle className="h-4 w-4" />
                      {selectedSale.whatsapp ? 'WhatsApp' : 'Copiar Msg'}
                    </Button>
                  </div>

                  {selectedSale.mpCheckoutUrl ? (
                    <Button 
                      variant="outline"
                      className="w-full gap-1.5 text-blue-600"
                      onClick={() => window.open(selectedSale.mpCheckoutUrl!, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Abrir Link Mercado Pago
                    </Button>
                  ) : (
                    <Button 
                      className="w-full gap-1.5"
                      onClick={() => handleGeneratePayment(selectedSale.cartId)}
                      disabled={paymentLoading}
                    >
                      {paymentLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      Gerar Link Mercado Pago
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
