import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart3,
  ShoppingBag,
  Radio,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Calendar,
  Package,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

interface Order {
  id: string;
  type: "regular" | "live";
  status: string;
  total: number;
  created_at: string;
  source_name: string;
  items: {
    id: string;
    product_name: string;
    product_price: number;
    quantity: number;
    size: string;
    color: string | null;
    image_url: string | null;
  }[];
}

interface CustomerSalesReportProps {
  customerId: string;
  customerPhone: string;
}

export function CustomerSalesReport({
  customerId,
  customerPhone,
}: CustomerSalesReportProps) {
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState("all");

  useEffect(() => {
    loadAllSalesData();
  }, [customerId, customerPhone]);

  const loadAllSalesData = async () => {
    setIsLoading(true);
    try {
      // 1. Load regular orders
      const normalizedPhone = customerPhone?.replace(/\D/g, "");
      
      // By customer_id
      const { data: ordersById } = await supabase
        .from("orders")
        .select(`
          id,
          status,
          total,
          created_at,
          live_event_id,
          items:order_items(
            id,
            product_name,
            product_price,
            quantity,
            size,
            color,
            image_url
          )
        `)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      // By phone (for legacy orders)
      let ordersByPhone: any[] = [];
      if (normalizedPhone) {
        const { data: legacyOrders } = await supabase
          .from("orders")
          .select(`
            id,
            customer_phone,
            status,
            total,
            created_at,
            live_event_id,
            items:order_items(
              id,
              product_name,
              product_price,
              quantity,
              size,
              color,
              image_url
            )
          `)
          .is("customer_id", null)
          .order("created_at", { ascending: false });

        ordersByPhone = (legacyOrders || []).filter((order) => {
          const orderPhone = order.customer_phone?.replace(/\D/g, "");
          return (
            orderPhone === normalizedPhone ||
            orderPhone?.endsWith(normalizedPhone) ||
            normalizedPhone?.endsWith(orderPhone)
          );
        });
      }

      // Merge and deduplicate
      const allRegularOrders = [...(ordersById || []), ...ordersByPhone];
      const uniqueOrderIds = new Set<string>();
      const uniqueOrders = allRegularOrders.filter((o) => {
        if (uniqueOrderIds.has(o.id)) return false;
        uniqueOrderIds.add(o.id);
        return true;
      });

      // 2. Load live carts (that don't have an order_id - to avoid duplicates)
      const { data: liveCustomers } = await supabase
        .from("live_customers")
        .select("id, live_event_id")
        .eq("client_id", customerId);

      let liveCarts: any[] = [];
      if (liveCustomers && liveCustomers.length > 0) {
        const liveCustomerIds = liveCustomers.map((lc) => lc.id);

        const { data: carts } = await supabase
          .from("live_carts")
          .select(`
            id,
            status,
            total,
            created_at,
            order_id,
            live_event:live_events(id, titulo),
            items:live_cart_items(
              id,
              qtd,
              preco_unitario,
              status,
              variante,
              product:product_catalog(id, name, image_url, color)
            )
          `)
          .in("live_customer_id", liveCustomerIds)
          .order("created_at", { ascending: false });

        // Filter out carts that already have linked orders (to avoid duplicates)
        liveCarts = (carts || []).filter((cart) => !cart.order_id);
      }

      // 3. Transform to unified format
      const regularOrdersFormatted: Order[] = uniqueOrders.map((order) => ({
        id: order.id,
        type: order.live_event_id ? "live" : "regular",
        status: order.status,
        total: order.total,
        created_at: order.created_at,
        source_name: order.live_event_id ? "Pedido de Live" : "Loja Online",
        items: (order.items || []).map((item: any) => ({
          id: item.id,
          product_name: item.product_name,
          product_price: item.product_price,
          quantity: item.quantity,
          size: item.size,
          color: item.color,
          image_url: item.image_url,
        })),
      }));

      const liveCartsFormatted: Order[] = liveCarts.map((cart) => ({
        id: cart.id,
        type: "live" as const,
        status: cart.status,
        total: cart.total,
        created_at: cart.created_at,
        source_name: cart.live_event?.titulo || "Live",
        items: (cart.items || []).map((item: any) => ({
          id: item.id,
          product_name: item.product?.name || "Produto",
          product_price: item.preco_unitario,
          quantity: item.qtd,
          size: (item.variante as any)?.tamanho || "",
          color: item.product?.color || (item.variante as any)?.cor || null,
          image_url: item.product?.image_url || null,
        })),
      }));

      // 4. Merge and sort by date
      const combined = [...regularOrdersFormatted, ...liveCartsFormatted].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setAllOrders(combined);
    } catch (error) {
      console.error("Error loading sales data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter by period
  const filteredOrders = useMemo(() => {
    if (periodFilter === "all") return allOrders;

    const now = new Date();
    let startDate: Date;

    switch (periodFilter) {
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "1y":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        return allOrders;
    }

    return allOrders.filter((o) => new Date(o.created_at) >= startDate);
  }, [allOrders, periodFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const paidStatuses = ["pago", "entregue", "enviado"];
    const paidOrders = filteredOrders.filter((o) =>
      paidStatuses.includes(o.status)
    );
    const liveOrders = filteredOrders.filter((o) => o.type === "live");
    const regularOrders = filteredOrders.filter((o) => o.type === "regular");
    const paidLiveOrders = liveOrders.filter((o) =>
      paidStatuses.includes(o.status)
    );
    const paidRegularOrders = regularOrders.filter((o) =>
      paidStatuses.includes(o.status)
    );

    return {
      totalOrders: filteredOrders.length,
      paidOrders: paidOrders.length,
      cancelledOrders: filteredOrders.filter((o) =>
        ["cancelado", "expirado"].includes(o.status)
      ).length,
      pendingOrders: filteredOrders.filter(
        (o) =>
          !paidStatuses.includes(o.status) &&
          !["cancelado", "expirado"].includes(o.status)
      ).length,
      totalRevenue: paidOrders.reduce((sum, o) => sum + o.total, 0),
      avgTicket:
        paidOrders.length > 0
          ? paidOrders.reduce((sum, o) => sum + o.total, 0) / paidOrders.length
          : 0,
      liveRevenue: paidLiveOrders.reduce((sum, o) => sum + o.total, 0),
      regularRevenue: paidRegularOrders.reduce((sum, o) => sum + o.total, 0),
      liveCount: liveOrders.length,
      regularCount: regularOrders.length,
      conversionRate:
        filteredOrders.length > 0
          ? (paidOrders.length / filteredOrders.length) * 100
          : 0,
    };
  }, [filteredOrders]);

  // Most purchased products
  const topProducts = useMemo(() => {
    const productMap: Record<
      string,
      { name: string; qty: number; revenue: number; image_url: string | null }
    > = {};

    const paidStatuses = ["pago", "entregue", "enviado"];
    filteredOrders
      .filter((o) => paidStatuses.includes(o.status))
      .forEach((order) => {
        order.items.forEach((item) => {
          const key = item.product_name;
          if (!productMap[key]) {
            productMap[key] = {
              name: item.product_name,
              qty: 0,
              revenue: 0,
              image_url: item.image_url,
            };
          }
          productMap[key].qty += item.quantity;
          productMap[key].revenue += item.product_price * item.quantity;
        });
      });

    return Object.values(productMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [filteredOrders]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pago":
      case "entregue":
      case "enviado":
        return (
          <Badge className="bg-green-500 text-white gap-1">
            <CheckCircle className="h-3 w-3" />
            {status === "pago" ? "Pago" : status === "enviado" ? "Enviado" : "Entregue"}
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
            Aguardando
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            {status === "pendente" ? "Pendente" : status}
          </Badge>
        );
    }
  };

  const exportToCSV = () => {
    const headers = ["Data", "Tipo", "Origem", "Status", "Total", "Itens"];
    const rows = filteredOrders.map((order) => [
      format(new Date(order.created_at), "dd/MM/yyyy HH:mm"),
      order.type === "live" ? "Live" : "Loja",
      order.source_name,
      order.status,
      order.total.toFixed(2),
      order.items.map((i) => `${i.product_name} x${i.quantity}`).join("; "),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `vendas-cliente-${customerId.slice(0, 8)}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Relatório de Vendas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Relatório de Vendas Consolidado
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo período</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="1y">Último ano</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg">
            <div className="text-3xl font-bold">{stats.paidOrders}</div>
            <div className="text-sm text-muted-foreground">Pedidos Pagos</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
            <div className="text-3xl font-bold text-green-600">
              {formatPrice(stats.totalRevenue)}
            </div>
            <div className="text-sm text-green-600">Receita Total</div>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="text-3xl font-bold">
              {formatPrice(stats.avgTicket)}
            </div>
            <div className="text-sm text-muted-foreground">Ticket Médio</div>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="text-3xl font-bold">
              {stats.conversionRate.toFixed(0)}%
            </div>
            <div className="text-sm text-muted-foreground">Conversão</div>
          </div>
        </div>

        {/* Channel Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Radio className="h-4 w-4" />
              <span className="text-sm font-medium">Lives</span>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-2xl font-bold">{stats.liveCount}</div>
                <div className="text-xs text-muted-foreground">pedidos</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-green-600">
                  {formatPrice(stats.liveRevenue)}
                </div>
                <div className="text-xs text-muted-foreground">receita</div>
              </div>
            </div>
          </div>
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ShoppingBag className="h-4 w-4" />
              <span className="text-sm font-medium">Loja Online</span>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-2xl font-bold">{stats.regularCount}</div>
                <div className="text-xs text-muted-foreground">pedidos</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-green-600">
                  {formatPrice(stats.regularRevenue)}
                </div>
                <div className="text-xs text-muted-foreground">receita</div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Products */}
        {topProducts.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Produtos Mais Comprados
            </h4>
            <div className="space-y-2">
              {topProducts.map((product, idx) => (
                <div
                  key={product.name}
                  className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg"
                >
                  <div className="w-8 h-8 flex items-center justify-center bg-primary/10 rounded-full text-sm font-bold">
                    {idx + 1}
                  </div>
                  <div className="w-10 h-10 bg-muted rounded overflow-hidden shrink-0">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {product.qty}x comprado
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-medium">
                      {formatPrice(product.revenue)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Histórico Completo ({filteredOrders.length})
          </h4>

          {filteredOrders.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">
              Nenhum pedido encontrado no período selecionado.
            </p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="border rounded-lg p-3 space-y-2 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {order.type === "live" ? (
                        <Radio className="h-4 w-4 text-purple-500" />
                      ) : (
                        <ShoppingBag className="h-4 w-4 text-blue-500" />
                      )}
                      <div>
                        <div className="font-medium text-sm">
                          {order.source_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(
                            new Date(order.created_at),
                            "dd/MM/yyyy 'às' HH:mm",
                            { locale: ptBR }
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(order.status)}
                      <div className="font-bold mt-1">
                        {formatPrice(order.total)}
                      </div>
                    </div>
                  </div>

                  {/* Items preview */}
                  <div className="flex flex-wrap gap-1">
                    {order.items.slice(0, 3).map((item) => (
                      <Badge
                        key={item.id}
                        variant="outline"
                        className="text-xs font-normal"
                      >
                        {item.product_name} x{item.quantity}
                      </Badge>
                    ))}
                    {order.items.length > 3 && (
                      <Badge variant="outline" className="text-xs font-normal">
                        +{order.items.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
