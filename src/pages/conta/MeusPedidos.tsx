import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Package } from "lucide-react";
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { buildOrderShortMessage, buildWhatsAppLink } from "@/lib/whatsappHelpers";
import { getCustomerStatusDisplay } from "@/lib/orderStatusMapping";

interface Order {
  id: string;
  created_at: string;
  status: string;
  total: number;
  customer_name: string;
  tracking_code: string | null;
  items_count?: number;
  type?: "regular" | "live";
}

export default function MeusPedidos() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/minha-conta");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user]);

  const loadOrders = async () => {
    if (!user) return;

    try {
      const { data: regularOrders, error: regularError } = await supabase
        .from("orders")
        .select("id, created_at, status, total, customer_name, tracking_code")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (regularError) throw regularError;

      const { data: liveOrders, error: liveError } = await (supabase.from("live_carts") as any)
        .select("id, created_at, status, total")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (liveError && liveError.code !== "PGRST100") {
        console.error("Error fetching live orders:", liveError);
      }

      const processedRegularOrders = await Promise.all(
        (regularOrders || []).map(async (order) => {
          const { count } = await supabase
            .from("order_items")
            .select("*", { count: "exact", head: true })
            .eq("order_id", order.id);
          return { ...order, items_count: count || 0, type: "regular" as const };
        })
      );

      const processedLiveOrders: Order[] = (liveOrders || []).map((order) => ({
        id: order.id,
        created_at: order.created_at,
        status: order.status,
        total: order.total,
        customer_name: user?.user_metadata?.name || "Cliente",
        tracking_code: null,
        items_count: 1,
        type: "live" as const,
      }));

      const allOrders = [...processedRegularOrders, ...processedLiveOrders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setOrders(allOrders);
    } catch (error) {
      console.error("Error loading orders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f8f3e8]">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="mb-6 h-8 w-48" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f3e8]">
      <Header />

      <main className="container mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 rounded-2xl border border-[#ccb487]/45 bg-[#fffaf0] p-5 shadow-sm">
          <h1 className="font-serif text-2xl text-[#13261f]">Meus Pedidos e Lives</h1>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <Card className="border-[#ccb487]/45 bg-[#fffaf0] shadow-sm">
            <CardContent className="py-12 text-center">
              <Package className="mx-auto mb-4 h-12 w-12 text-[#7c7467]" />
              <p className="mb-4 text-sm font-medium text-[#6f6759]">Você ainda não fez nenhum pedido</p>
              <Link to="/catalogo" className="font-medium text-[#8a672d] hover:underline">
                Conferir peças →
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const status = getCustomerStatusDisplay(order.status, order.tracking_code);
              const StatusIcon = status.icon;
              const orderNumber = order.id.slice(0, 8).toUpperCase();
              const whatsAppUrl = buildWhatsAppLink(buildOrderShortMessage(orderNumber));

              return (
                <Card
                  key={order.id}
                  className="border-[#d4bf98] bg-[#fffaf0] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(17,37,31,0.10)]"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Link to={`/meus-pedidos/${order.id}`} className="flex-1">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Pedido #{orderNumber}</span>
                            <Badge className={`${status.color} gap-1 border-0`}>
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(order.created_at)} • {order.items_count} {order.items_count === 1 ? "item" : "itens"}
                          </p>
                          <p className="font-semibold text-[#13261f]">{formatPrice(order.total)}</p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2">
                        <WhatsAppButton href={whatsAppUrl} variant="circle" />
                        <Link to={`/meus-pedidos/${order.id}`}>
                          <ChevronRight className="h-5 w-5 text-[#746d61]" />
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
