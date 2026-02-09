import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, Package, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
}

const PedidoSucesso = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get("order_id");
  
  const [isLoading, setIsLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);

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
        
        const { data: itemsData } = await supabase
          .from("order_items")
          .select("*")
          .eq("order_id", orderId);
        
        setItems(itemsData || []);
      }
    } catch (error) {
      console.error("Error loading order:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getWhatsAppUrl = () => {
    const message = encodeURIComponent(
      `Oi! Sou ${order?.customer_name || "cliente"}. Acabei de fazer o pagamento do pedido #${orderId?.slice(0, 8).toUpperCase()}. Total: ${formatPrice(order?.total || 0)}. Aguardo confirmação! 💛`
    );
    return `https://wa.me/5562991223519?text=${message}`;
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
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6 animate-fade-in">
          <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        
        <h1 className="font-serif text-2xl mb-2">Pagamento confirmado! 🎉</h1>
        <p className="text-muted-foreground mb-6">
          Seu pedido foi pago com sucesso. Em breve você receberá atualizações pelo WhatsApp.
        </p>
        
        <Card className="mb-6 text-left">
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Pedido</span>
              <span className="font-mono font-bold text-accent">
                #{orderId.slice(0, 8).toUpperCase()}
              </span>
            </div>
            
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground mb-2">Itens</p>
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm py-1">
                  <span>{item.product_name} ({item.size}) x{item.quantity}</span>
                  <span>{formatPrice(item.product_price * item.quantity)}</span>
                </div>
              ))}
            </div>
            
            {order.shipping_fee > 0 && (
              <div className="flex justify-between text-sm border-t pt-2">
                <span>Frete</span>
                <span>{formatPrice(order.shipping_fee)}</span>
              </div>
            )}
            
            <div className="flex justify-between font-medium text-lg border-t pt-2">
              <span>Total pago</span>
              <span className="text-green-600">{formatPrice(order.total)}</span>
            </div>
          </CardContent>
        </Card>
        
        <a
          href={getWhatsAppUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#20BD5A] text-white font-medium py-3 px-4 rounded-xl transition-colors mb-4"
        >
          <MessageCircle className="h-5 w-5" />
          Confirmar no WhatsApp
        </a>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/conta/meus-pedidos")} className="flex-1">
            Ver meus pedidos
          </Button>
          <Button variant="outline" onClick={() => navigate("/")} className="flex-1">
            Voltar ao início
          </Button>
        </div>
      </main>
    </div>
  );
};

export default PedidoSucesso;
