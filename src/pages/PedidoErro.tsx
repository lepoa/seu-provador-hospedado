import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { XCircle, Loader2, Package, MessageCircle, RefreshCw, CreditCard, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
}

const PedidoErro = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get("order_id");
  const liveCartId = searchParams.get("live_cart_id");
  
  const [isLoading, setIsLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [liveCart, setLiveCart] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        if (orderId) {
          const { data } = await supabase
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .single();
          if (data) setOrder(data);
        }
        if (liveCartId) {
          const { data } = await supabase
            .from("live_carts")
            .select("id, total, mp_checkout_url, bag_number, status")
            .eq("id", liveCartId)
            .single();
          if (data) setLiveCart(data);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [orderId, liveCartId]);

  const displayTotal = order?.total || liveCart?.total || 0;
  const displayRef = orderId?.slice(0, 8).toUpperCase() || (liveCart?.bag_number ? `Sacola #${liveCart.bag_number}` : liveCartId?.slice(0, 8).toUpperCase());
  const checkoutUrl = order?.mp_checkout_url || liveCart?.mp_checkout_url;

  const getWhatsAppUrl = () => {
    const name = order?.customer_name || "cliente";
    const ref = displayRef || "pedido";
    const message = encodeURIComponent(
      `Oi! Sou ${name}. Tive um problema no pagamento do pedido ${ref}. Pode me ajudar? 💛`
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

  if (!orderId && !liveCartId) {
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
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6 animate-fade-in">
          <XCircle className="h-10 w-10 text-destructive" />
        </div>
        
        <h1 className="font-serif text-2xl mb-2">Pagamento não aprovado</h1>
        <p className="text-muted-foreground mb-6">
          O Mercado Pago recusou o pagamento por motivos de segurança. Isso acontece às vezes — não se preocupe!
        </p>
        
        {displayTotal > 0 && (
          <Card className="mb-6">
            <CardContent className="p-6">
              {displayRef && (
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-muted-foreground">Pedido</span>
                  <span className="font-mono font-bold text-accent">#{displayRef}</span>
                </div>
              )}
              <div className="flex justify-between font-medium text-lg border-t pt-4">
                <span>Total</span>
                <span>{formatPrice(displayTotal)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Friendly suggestions */}
        <Card className="mb-6 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="p-5 text-left">
            <div className="flex items-center gap-2 mb-3 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium">O que você pode fazer:</span>
            </div>
            <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-300">
              <li className="flex items-start gap-2">
                <span className="font-bold mt-0.5">1.</span>
                <span><strong>Tente pagar com PIX</strong> — é mais rápido e raramente é recusado.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold mt-0.5">2.</span>
                <span>Use outro cartão de crédito ou débito.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold mt-0.5">3.</span>
                <span>Verifique se os dados do cartão estão corretos.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold mt-0.5">4.</span>
                <span>Entre em contato com o banco se o problema persistir.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
        
        {checkoutUrl && (
          <Button 
            onClick={() => window.open(checkoutUrl, "_blank")}
            className="w-full mb-3"
            size="lg"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Tentar pagar novamente (PIX/outro cartão)
          </Button>
        )}
        
        <a
          href={getWhatsAppUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#20BD5A] text-white font-medium py-3 px-4 rounded-xl transition-colors mb-3"
        >
          <MessageCircle className="h-5 w-5" />
          Pedir ajuda no WhatsApp
        </a>
        
        <Button variant="outline" onClick={() => navigate("/")} className="w-full">
          Voltar ao início
        </Button>
      </main>
    </div>
  );
};

export default PedidoErro;
