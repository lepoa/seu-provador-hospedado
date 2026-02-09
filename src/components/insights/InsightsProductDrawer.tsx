import { useState, useEffect } from "react";
import { X, ExternalLink, Package, TrendingUp, Users, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { InsightsFilters } from "@/hooks/useInsightsData";
import { subDays, startOfDay, endOfDay, startOfMonth, subMonths, endOfMonth, format } from "date-fns";

interface InsightsProductDrawerProps {
  productName: string | null;
  isOpen: boolean;
  onClose: () => void;
  filters: InsightsFilters;
}

interface DrilldownData {
  // Summary
  totalSold: number;
  totalRevenue: number;
  liveSold: number;
  catalogSold: number;
  liveRevenue: number;
  catalogRevenue: number;
  
  // By size
  bySizeData: {
    size: string;
    sold: number;
    reserved: number;
    canceled: number;
    stock: number;
  }[];
  
  // By seller
  bySellerData: {
    name: string;
    sold: number;
    revenue: number;
  }[];
  
  // By payment method
  byPaymentData: {
    method: string;
    count: number;
    total: number;
  }[];
  
  // Daily trend
  dailyData: {
    date: string;
    sold: number;
    revenue: number;
  }[];
}

const PAID_STATUSES = ['pago', 'preparar_envio', 'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue'];

export function InsightsProductDrawer({ productName, isOpen, onClose, filters }: InsightsProductDrawerProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<DrilldownData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (productName && isOpen) {
      loadDrilldownData();
    }
  }, [productName, isOpen, filters]);

  const getDateRange = () => {
    const now = new Date();
    switch (filters.period) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "7d":
        return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
      case "30d":
        return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
      case "thisMonth":
        return { start: startOfMonth(now), end: endOfDay(now) };
      default:
        return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    }
  };

  const loadDrilldownData = async () => {
    if (!productName) return;
    setIsLoading(true);

    try {
      const { start, end } = getDateRange();

      // Fetch orders with items that match this product
      const { data: orders } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      // Fetch sellers
      const { data: sellers } = await supabase.from("sellers").select("id, name");
      const sellerMap = new Map<string, string>();
      (sellers || []).forEach(s => sellerMap.set(s.id, s.name));

      // Filter to orders containing this product
      const relevantOrders = (orders || []).filter(order => {
        const items = order.order_items || [];
        return items.some((item: any) => item.product_name === productName);
      });

      // Calculate metrics
      let totalSold = 0, totalRevenue = 0;
      let liveSold = 0, catalogSold = 0;
      let liveRevenue = 0, catalogRevenue = 0;
      
      const sizeMap = new Map<string, { sold: number; reserved: number; canceled: number }>();
      const sellerSalesMap = new Map<string, { sold: number; revenue: number }>();
      const paymentMap = new Map<string, { count: number; total: number }>();
      const dailyMap = new Map<string, { sold: number; revenue: number }>();

      relevantOrders.forEach(order => {
        const isPaid = PAID_STATUSES.includes(order.status);
        const isReserved = order.status === 'aguardando_pagamento';
        const isCanceled = order.status === 'cancelado';
        const isLive = !!order.live_event_id;
        const dateKey = format(new Date(order.created_at), "yyyy-MM-dd");

        const items = order.order_items || [];
        items.forEach((item: any) => {
          if (item.product_name !== productName) return;

          const qty = item.quantity || 0;
          const revenue = (item.product_price || 0) * qty;
          const size = item.size || 'N/A';

          // Size breakdown
          const sizeEntry = sizeMap.get(size) || { sold: 0, reserved: 0, canceled: 0 };
          if (isPaid) sizeEntry.sold += qty;
          if (isReserved) sizeEntry.reserved += qty;
          if (isCanceled) sizeEntry.canceled += qty;
          sizeMap.set(size, sizeEntry);

          if (isPaid) {
            totalSold += qty;
            totalRevenue += revenue;

            if (isLive) {
              liveSold += qty;
              liveRevenue += revenue;
            } else {
              catalogSold += qty;
              catalogRevenue += revenue;
            }

            // Seller breakdown
            if (order.seller_id) {
              const sellerName = sellerMap.get(order.seller_id) || 'Desconhecido';
              const sellerEntry = sellerSalesMap.get(sellerName) || { sold: 0, revenue: 0 };
              sellerEntry.sold += qty;
              sellerEntry.revenue += revenue;
              sellerSalesMap.set(sellerName, sellerEntry);
            }

            // Daily trend
            const dailyEntry = dailyMap.get(dateKey) || { sold: 0, revenue: 0 };
            dailyEntry.sold += qty;
            dailyEntry.revenue += revenue;
            dailyMap.set(dateKey, dailyEntry);
          }
        });

        // Payment method (from order level - approximation)
        if (isPaid) {
          const method = 'Mercado Pago'; // Simplified - would need paid_method field
          const pmEntry = paymentMap.get(method) || { count: 0, total: 0 };
          pmEntry.count += 1;
          pmEntry.total += order.total || 0;
          paymentMap.set(method, pmEntry);
        }
      });

      setData({
        totalSold,
        totalRevenue,
        liveSold,
        catalogSold,
        liveRevenue,
        catalogRevenue,
        bySizeData: Array.from(sizeMap.entries()).map(([size, stats]) => ({
          size,
          sold: stats.sold,
          reserved: stats.reserved,
          canceled: stats.canceled,
          stock: 0, // Would need product_available_stock lookup
        })),
        bySellerData: Array.from(sellerSalesMap.entries())
          .map(([name, stats]) => ({ name, sold: stats.sold, revenue: stats.revenue }))
          .sort((a, b) => b.revenue - a.revenue),
        byPaymentData: Array.from(paymentMap.entries())
          .map(([method, stats]) => ({ method, count: stats.count, total: stats.total })),
        dailyData: Array.from(dailyMap.entries())
          .map(([date, stats]) => ({ date, sold: stats.sold, revenue: stats.revenue }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      });
    } catch (error) {
      console.error("Error loading drilldown data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd/MM");
  };

  const handleViewOrders = (status: string) => {
    const params = new URLSearchParams();
    params.set("tab", "orders");
    params.set("status", status);
    params.set("search", productName || "");
    navigate(`/dashboard?${params.toString()}`);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <span className="truncate">{productName}</span>
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="mt-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Total Vendido</p>
                  <p className="text-lg font-bold">{data.totalSold} peças</p>
                  <p className="text-sm text-green-600">{formatPrice(data.totalRevenue)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Live vs Catálogo</p>
                  <div className="flex gap-2 mt-1">
                    <Badge className="bg-pink-100 text-pink-700 border-0">
                      Live: {data.liveSold}
                    </Badge>
                    <Badge className="bg-blue-100 text-blue-700 border-0">
                      Cat: {data.catalogSold}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="tamanhos">
              <TabsList className="w-full">
                <TabsTrigger value="tamanhos" className="flex-1">Tamanhos</TabsTrigger>
                <TabsTrigger value="vendedoras" className="flex-1">Vendedoras</TabsTrigger>
                <TabsTrigger value="acoes" className="flex-1">Ações</TabsTrigger>
              </TabsList>

              <TabsContent value="tamanhos" className="mt-4 space-y-2">
                {data.bySizeData.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">Sem dados de tamanho</p>
                ) : (
                  data.bySizeData.map((size, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <Badge variant="outline" className="font-mono">{size.size}</Badge>
                      <div className="flex gap-4 text-sm">
                        <span className="text-green-600">Vendido: {size.sold}</span>
                        {size.reserved > 0 && (
                          <span className="text-amber-600">Reservado: {size.reserved}</span>
                        )}
                        {size.canceled > 0 && (
                          <span className="text-red-600">Cancelado: {size.canceled}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="vendedoras" className="mt-4 space-y-2">
                {data.bySellerData.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">Sem vendas por vendedora</p>
                ) : (
                  data.bySellerData.map((seller, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        {i === 0 && <span className="text-yellow-600">🏆</span>}
                        <span className="font-medium">{seller.name}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">{seller.sold} peças • </span>
                        <span className="text-green-600 font-medium">{formatPrice(seller.revenue)}</span>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="acoes" className="mt-4 space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => handleViewOrders("pago")}
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver pedidos pagos
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => handleViewOrders("aguardando_pagamento")}
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver reservas (cobrar)
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => handleViewOrders("cancelado")}
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver cancelados
                </Button>
              </TabsContent>
            </Tabs>

            {/* Daily Mini Chart */}
            {data.dailyData.length > 1 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Evolução Diária
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-1 h-16">
                    {data.dailyData.map((day, i) => {
                      const maxSold = Math.max(...data.dailyData.map(d => d.sold), 1);
                      const height = (day.sold / maxSold) * 100;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div 
                            className="w-full bg-primary rounded-t"
                            style={{ height: `${height}%`, minHeight: day.sold > 0 ? 4 : 0 }}
                          />
                          <span className="text-[10px] text-muted-foreground">{formatDate(day.date)}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
