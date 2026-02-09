import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Clock, Loader2, Package, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
}

const PedidoPendente = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get("order_id");
  
  const [isLoading, setIsLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    if (orderId) {
      loadOrder();
    } else {
      setIsLoading(false);
    }
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const { data: orderData } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();
      
      if (orderData) {
        setOrder(orderData);
      }
    } catch (error) {
      console.error("Error loading order:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getWhatsAppUrl = () => {
    const message = encodeURIComponent(
      `Oi! Sou ${order?.customer_name || "cliente"}. Meu pagamento do pedido #${orderId?.slice(0, 8).toUpperCase()} está pendente. Pode me ajudar? 💛`
    );
    return `https://wa.me/5562991223519?text=${message}`;
  };

  const handleRetryPayment = () => {
    if (order?.mp_checkout_url) {
      window.open(order.mp_checkout_url, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!orderId || !order) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 max-w-lg text-center">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="font-serif text-2xl mb-2">Pedido não encontrado</h1>
          <Button onClick={() => navigate("/")}>Voltar ao início</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-12 max-w-lg text-center">
        <div className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mx-auto mb-6 animate-fade-in">
          <Clock className="h-10 w-10 text-yellow-600 dark:text-yellow-400" />
        </div>
        
        <h1 className="font-serif text-2xl mb-2">Pagamento pendente</h1>
        <p className="text-muted-foreground mb-6">
          Seu pagamento está sendo processado. Assim que for confirmado, você receberá uma notificação.
        </p>
        
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-muted-foreground">Pedido</span>
              <span className="font-mono font-bold text-accent">
                #{orderId.slice(0, 8).toUpperCase()}
              </span>
            </div>
            
            <div className="flex justify-between font-medium text-lg border-t pt-4">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </CardContent>
        </Card>
        
        {order.mp_checkout_url && (
          <Button 
            onClick={handleRetryPayment}
            className="w-full mb-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar pagar novamente
          </Button>
        )}
        
        <a
          href={getWhatsAppUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full border border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10 font-medium py-3 px-4 rounded-xl transition-colors mb-4"
        >
          <MessageCircle className="h-5 w-5" />
          Falar no WhatsApp
        </a>
        
        <Button variant="outline" onClick={() => navigate("/conta/meus-pedidos")} className="w-full">
          Ver meus pedidos
        </Button>
      </main>
    </div>
  );
};

export default PedidoPendente;
