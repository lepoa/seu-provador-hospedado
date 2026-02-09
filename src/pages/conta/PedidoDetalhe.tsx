import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Package, Truck, Loader2, AlertTriangle, Timer, ExternalLink, Copy, FileText, CreditCard, X } from "lucide-react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { copyToClipboard } from "@/lib/clipboardUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { buildWhatsAppLink, buildOrderDetailMessage } from "@/lib/whatsappHelpers";
import { getCustomerStatusDisplay, isValidTrackingCode } from "@/lib/orderStatusMapping";

interface Order {
  id: string;
  created_at: string;
  status: string;
  total: number;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  payment_link: string | null;
  tracking_code: string | null;
  me_label_url: string | null;
  delivery_method: string | null;
  mp_preference_id: string | null;
  mp_checkout_url: string | null;
  reserved_until: string | null;
}

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_price: number;
  size: string;
  quantity: number;
  color: string | null;
  image_url: string | null;
}

export default function PedidoDetalhe() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [expiryCountdown, setExpiryCountdown] = useState<string | null>(null);

useEffect(() => {
    if (!authLoading && !user) {
      navigate("/minha-conta");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      loadOrder();
    }
  }, [user, id]);

  // CRITICAL: Always fetch fresh data - never use cached/stale data
  const loadOrder = async () => {
    if (!user || !id) return;

    // Force fresh fetch with no-cache to ensure consistency with list view
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (orderError || !orderData) {
      toast.error("Pedido não encontrado");
      navigate("/meus-pedidos");
      return;
    }

    // Use orders.status as the SINGLE source of truth (same as list view)
    setOrder(orderData);

    const { data: itemsData } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", id);

    setItems(itemsData || []);
    setIsLoading(false);
  };

  // Countdown timer for reservation expiry
  useEffect(() => {
    if (!order?.reserved_until || order.status !== "aguardando_pagamento") {
      setExpiryCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const expiry = new Date(order.reserved_until!);
      const diff = expiry.getTime() - now.getTime();

      if (diff <= 0) {
        setExpiryCountdown("expirado");
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setExpiryCountdown(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [order?.reserved_until, order?.status]);

  const handleCancel = async () => {
    if (!order) return;

    setIsCancelling(true);
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelado" })
      .eq("id", order.id);

    if (error) {
      toast.error("Erro ao cancelar pedido");
    } else {
      toast.success("Pedido cancelado");
      setOrder({ ...order, status: "cancelado" });
    }
    setIsCancelling(false);
  };

  // Handle "Pay Now" - use existing URL or create new preference
  const handlePayNow = async () => {
    if (!order) return;

    // If we have a valid checkout URL, just open it
    if (order.mp_checkout_url) {
      window.open(order.mp_checkout_url, "_blank");
      return;
    }

    // Otherwise, create a new preference (fallback)
    setIsCreatingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-mp-preference", {
        body: { order_id: order.id, payer_email: user?.email || "" },
      });

      if (error) {
        console.error("MP preference error:", error);
        toast.error("Erro ao criar link de pagamento. Tente novamente.");
        return;
      }

      if (data?.error_code || data?.error) {
        toast.error(data.error || "Erro ao gerar pagamento");
        return;
      }

      if (data?.init_point) {
        // Update local state with new URL
        setOrder({ ...order, mp_checkout_url: data.init_point, mp_preference_id: data.preference_id });
        window.open(data.init_point, "_blank");
      } else {
        toast.error("Link de pagamento não disponível");
      }
    } catch (err) {
      console.error("Payment error:", err);
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setIsCreatingPayment(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const getOrderNumber = (orderId: string) => orderId.slice(0, 8).toUpperCase();

  const getWhatsAppUrl = () => {
    if (!order) return "";
    
    const orderItems = items.map((item) => ({
      name: item.product_name,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
    }));
    
    const message = buildOrderDetailMessage(
      getOrderNumber(order.id),
      orderItems,
      formatPrice(order.total)
    );

    return buildWhatsAppLink(message);
  };

  // Check if payment is allowed
  const isReservationExpired = order?.reserved_until 
    ? new Date(order.reserved_until) < new Date() 
    : false;
  
  const canPay = order?.status === "aguardando_pagamento" && !isReservationExpired;
  const canCancel = order && (order.status === "pendente" || order.status === "aguardando_pagamento") && !isReservationExpired;

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  // Use centralized status mapping
  const status = getCustomerStatusDisplay(order.status, order.tracking_code);
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/meus-pedidos")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>

        {/* Order Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-serif text-2xl mb-1">
              Pedido #{getOrderNumber(order.id)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatDate(order.created_at)}
            </p>
          </div>
          <Badge className={`${status.color} border-0 gap-1`}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </Badge>
        </div>

        {/* Tracking Code - show for orders with VALID tracking */}
        {isValidTrackingCode(order.tracking_code) && (
          <Card className="mb-4 border-purple-200 bg-purple-50 dark:bg-purple-950/20">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Truck className="h-5 w-5 text-purple-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Código de rastreio</p>
                    <p className="font-mono text-lg text-purple-900 dark:text-purple-100">{order.tracking_code}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-100"
                    onClick={async () => {
                      const success = await copyToClipboard(order.tracking_code!);
                      if (success) {
                        toast.success("Código copiado!");
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    Copiar código
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2 bg-purple-600 hover:bg-purple-700"
                    onClick={() => {
                      window.open(
                        `https://rastreamento.correios.com.br/app/index.php?objeto=${order.tracking_code}`,
                        '_blank'
                      );
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Rastrear nos Correios
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Etiqueta gerada but no valid tracking yet */}
        {order.status === 'etiqueta_gerada' && !isValidTrackingCode(order.tracking_code) && (
          <Card className="mb-4 border-purple-200 bg-purple-50 dark:bg-purple-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-purple-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-purple-800 dark:text-purple-200">
                    Pedido em preparação para envio
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    O código de rastreio estará disponível em breve.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Items */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Itens do pedido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.product_name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-16 h-16 bg-secondary rounded-lg flex items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium">{item.product_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Tamanho: {item.size}
                    {item.color && ` • Cor: ${item.color}`}
                  </p>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm text-muted-foreground">
                      Qtd: {item.quantity}
                    </span>
                    <span className="font-medium">
                      {formatPrice(item.product_price * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            <Separator />

            <div className="flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span className="text-accent">{formatPrice(order.total)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Address */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Endereço de entrega
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{order.customer_name}</p>
            <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
            <p className="text-sm mt-2">{order.customer_address}</p>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Reservation Expired Warning */}
          {order.status === "aguardando_pagamento" && isReservationExpired && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Reserva expirada
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Os itens podem ter sido liberados para outros clientes. 
                      Entre em contato para verificar disponibilidade.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reservation Timer */}
          {order.status === "aguardando_pagamento" && expiryCountdown && expiryCountdown !== "expirado" && (
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-orange-600" />
                    <span className="text-sm text-orange-700 dark:text-orange-300">
                      Reserva expira em:
                    </span>
                  </div>
                  <span className="font-mono font-bold text-orange-800 dark:text-orange-200">
                    {expiryCountdown}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pay Now Button */}
          {canPay && (
            <Button 
              className="w-full gap-2" 
              onClick={handlePayNow}
              disabled={isCreatingPayment}
            >
              {isCreatingPayment ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              {isCreatingPayment ? "Gerando link..." : "Pagar agora"}
            </Button>
          )}

          {/* Legacy payment_link support */}
          {!canPay && order.payment_link && (order.status === "pendente") && (
            <Button className="w-full gap-2" asChild>
              <a href={order.payment_link} target="_blank" rel="noopener noreferrer">
                <CreditCard className="h-4 w-4" />
                Pagar agora
              </a>
            </Button>
          )}

          <WhatsAppButton 
            href={getWhatsAppUrl()} 
            label={order.status === "cancelado" ? "Falar com a loja mesmo assim" : "Falar no WhatsApp"}
            showMicrocopy={order.status !== "cancelado"}
          />

          {canCancel && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="w-full text-destructive hover:text-destructive gap-2">
                  <X className="h-4 w-4" />
                  Cancelar pedido
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar pedido?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. O pedido será cancelado permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    disabled={isCancelling}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    {isCancelling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Confirmar cancelamento"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </main>
    </div>
  );
}
