import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Radio, ShoppingCart, CheckCircle, XCircle, Clock, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

interface LiveCartHistory {
  id: string;
  status: string;
  subtotal: number;
  total: number;
  created_at: string;
  updated_at: string;
  live_event: {
    id: string;
    titulo: string;
    data_hora_inicio: string;
    status: string;
  } | null;
  items: {
    id: string;
    qtd: number;
    preco_unitario: number;
    status: string;
    variante: { cor?: string; tamanho?: string };
    product: {
      id: string;
      name: string;
      image_url: string | null;
    } | null;
  }[];
}

interface CustomerLiveHistoryProps {
  customerId: string;
}

export function CustomerLiveHistory({ customerId }: CustomerLiveHistoryProps) {
  const [liveHistory, setLiveHistory] = useState<LiveCartHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLiveHistory();
  }, [customerId]);

  const loadLiveHistory = async () => {
    setIsLoading(true);
    try {
      // Find live_customers linked to this customer
      const { data: liveCustomers, error: lcError } = await supabase
        .from("live_customers")
        .select("id, live_event_id")
        .eq("client_id", customerId);

      if (lcError) throw lcError;

      if (!liveCustomers || liveCustomers.length === 0) {
        setLiveHistory([]);
        setIsLoading(false);
        return;
      }

      // Get all carts for these live customers
      const liveCustomerIds = liveCustomers.map(lc => lc.id);
      
      const { data: carts, error: cartsError } = await supabase
        .from("live_carts")
        .select(`
          id,
          status,
          subtotal,
          total,
          created_at,
          updated_at,
          live_event:live_events(id, titulo, data_hora_inicio, status),
          items:live_cart_items(
            id,
            qtd,
            preco_unitario,
            status,
            variante,
            product:product_catalog(id, name, image_url)
          )
        `)
        .in("live_customer_id", liveCustomerIds)
        .order("created_at", { ascending: false });

      if (cartsError) throw cartsError;

      setLiveHistory((carts || []) as unknown as LiveCartHistory[]);
    } catch (error) {
      console.error("Error loading live history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pago":
        return (
          <Badge className="bg-green-500 text-white gap-1">
            <CheckCircle className="h-3 w-3" />
            Pago
          </Badge>
        );
      case "cancelado":
      case "expirado":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            {status === "cancelado" ? "Cancelado" : "Expirado"}
          </Badge>
        );
      case "aguardando_pagamento":
        return (
          <Badge className="bg-amber-500 text-white gap-1">
            <Clock className="h-3 w-3" />
            Aguardando Pagamento
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <ShoppingCart className="h-3 w-3" />
            {status === "aberto" ? "Aberto" : status}
          </Badge>
        );
    }
  };

  // Calculate stats
  const stats = {
    totalLives: new Set(liveHistory.map(h => h.live_event?.id)).size,
    totalCarts: liveHistory.length,
    paid: liveHistory.filter(h => h.status === "pago").length,
    cancelled: liveHistory.filter(h => ["cancelado", "expirado"].includes(h.status)).length,
    pending: liveHistory.filter(h => !["pago", "cancelado", "expirado"].includes(h.status)).length,
    totalPaid: liveHistory.filter(h => h.status === "pago").reduce((sum, h) => sum + h.total, 0),
    totalReserved: liveHistory.reduce((sum, h) => sum + h.total, 0),
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Histórico de Lives
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (liveHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Histórico de Lives
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Esta cliente ainda não participou de nenhuma live.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-5 w-5" />
          Histórico de Lives
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <div className="text-2xl font-bold">{stats.totalLives}</div>
            <div className="text-xs text-muted-foreground">Lives participadas</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-center border border-green-200">
            <div className="text-2xl font-bold text-green-600">{stats.paid}</div>
            <div className="text-xs text-green-600">Carrinhos pagos</div>
          </div>
          <div className="p-3 bg-red-50 rounded-lg text-center border border-red-200">
            <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
            <div className="text-xs text-red-600">Cancelados/Expirados</div>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg text-center border border-amber-200">
            <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
            <div className="text-xs text-amber-600">Pendentes</div>
          </div>
        </div>

        {/* Revenue Summary */}
        <div className="flex gap-4 p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg">
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">Total Reservado</div>
            <div className="text-xl font-bold">{formatPrice(stats.totalReserved)}</div>
          </div>
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">Total Pago</div>
            <div className="text-xl font-bold text-green-600">{formatPrice(stats.totalPaid)}</div>
          </div>
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">Taxa de Conversão</div>
            <div className="text-xl font-bold">
              {stats.totalCarts > 0 
                ? `${Math.round((stats.paid / stats.totalCarts) * 100)}%` 
                : "—"}
            </div>
          </div>
        </div>

        {/* Cart History List */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground">Carrinhos</h4>
          
          {liveHistory.map((cart) => (
            <div
              key={cart.id}
              className="border rounded-lg p-4 space-y-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-primary" />
                    <span className="font-medium">
                      {cart.live_event?.titulo || "Live"}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {cart.live_event?.data_hora_inicio
                      ? format(new Date(cart.live_event.data_hora_inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : format(new Date(cart.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                </div>
                <div className="text-right">
                  {getStatusBadge(cart.status)}
                  <div className="text-lg font-bold mt-1">{formatPrice(cart.total)}</div>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                {(cart.items || []).slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center gap-3 text-sm">
                    <div className="w-10 h-10 bg-muted rounded overflow-hidden shrink-0">
                      {item.product?.image_url ? (
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{item.product?.name || "Produto"}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.variante?.tamanho && `Tam: ${item.variante.tamanho}`}
                        {item.variante?.cor && ` • ${item.variante.cor}`}
                        {` • Qtd: ${item.qtd}`}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {formatPrice(item.preco_unitario * item.qtd)}
                    </div>
                  </div>
                ))}
                {(cart.items?.length || 0) > 3 && (
                  <div className="text-xs text-muted-foreground text-center">
                    + {cart.items.length - 3} outros itens
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
