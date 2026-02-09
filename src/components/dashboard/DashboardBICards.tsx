import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, DollarSign, AlertTriangle, Zap, Package, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";

interface TopProduct {
  name: string;
  sku: string | null;
  qty: number;
  revenue: number;
}

interface RiskItem {
  name: string;
  type: "baixa_conversao" | "alto_cancelamento" | "ruptura";
  value: string;
}

const PAID_STATUSES = ['pago', 'preparar_envio', 'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue'];

export function DashboardBICards() {
  const navigate = useNavigate();
  const [topByQty, setTopByQty] = useState<TopProduct[]>([]);
  const [topByRevenue, setTopByRevenue] = useState<TopProduct[]>([]);
  const [riskItems, setRiskItems] = useState<RiskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const startDate = subDays(new Date(), 7);
      
      const { data: orders } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .gte("created_at", startDate.toISOString());

      if (!orders) return;

      // Build product aggregations
      const productMap = new Map<string, {
        name: string;
        sku: string | null;
        qtySold: number;
        revenue: number;
        reservedQty: number;
        canceledQty: number;
      }>();

      orders.forEach(order => {
        const isPaid = PAID_STATUSES.includes(order.status);
        const isReserved = order.status === 'aguardando_pagamento';
        const isCanceled = order.status === 'cancelado';

        const items = order.order_items || [];
        items.forEach((item: any) => {
          const key = item.product_name || 'Unknown';
          const existing = productMap.get(key) || {
            name: item.product_name || 'Unknown',
            sku: item.product_sku,
            qtySold: 0,
            revenue: 0,
            reservedQty: 0,
            canceledQty: 0,
          };

          if (isPaid) {
            existing.qtySold += item.quantity || 0;
            existing.revenue += (item.product_price || 0) * (item.quantity || 0);
          }
          if (isReserved) {
            existing.reservedQty += item.quantity || 0;
          }
          if (isCanceled) {
            existing.canceledQty += item.quantity || 0;
          }

          productMap.set(key, existing);
        });
      });

      const products = Array.from(productMap.values());

      // Top 5 by quantity
      const byQty = [...products]
        .filter(p => p.qtySold > 0)
        .sort((a, b) => b.qtySold - a.qtySold)
        .slice(0, 5)
        .map(p => ({ name: p.name, sku: p.sku, qty: p.qtySold, revenue: p.revenue }));
      setTopByQty(byQty);

      // Top 5 by revenue
      const byRevenue = [...products]
        .filter(p => p.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
        .map(p => ({ name: p.name, sku: p.sku, qty: p.qtySold, revenue: p.revenue }));
      setTopByRevenue(byRevenue);

      // Risk items
      const risks: RiskItem[] = [];
      products.forEach(p => {
        const total = p.qtySold + p.reservedQty + p.canceledQty;
        if (total === 0) return;

        const conversaoRate = (p.qtySold / total) * 100;
        const cancelRate = (p.canceledQty / total) * 100;

        if (p.reservedQty > 3 && conversaoRate < 30) {
          risks.push({
            name: p.name,
            type: "baixa_conversao",
            value: `${conversaoRate.toFixed(0)}% conversão, ${p.reservedQty} reservados`,
          });
        }

        if (cancelRate > 30 && p.canceledQty > 2) {
          risks.push({
            name: p.name,
            type: "alto_cancelamento",
            value: `${cancelRate.toFixed(0)}% cancelamento`,
          });
        }
      });

      setRiskItems(risks.slice(0, 5));

    } catch (error) {
      console.error("Error loading BI cards:", error);
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

  const handleNavigateToInsights = (initialSort?: string) => {
    const params = new URLSearchParams();
    if (initialSort) params.set("sort", initialSort);
    navigate(`/dashboard/insights?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-48 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Top 5 by Quantity */}
      <Card 
        className="cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => handleNavigateToInsights("qty")}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-500" />
            Top 5 Peças (Qtd)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {topByQty.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem vendas no período</p>
          ) : (
            topByQty.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                  <span className="truncate">{p.name}</span>
                </div>
                <Badge variant="secondary" className="shrink-0 ml-2">{p.qty}</Badge>
              </div>
            ))
          )}
          <Button variant="ghost" size="sm" className="w-full mt-2 gap-1">
            Ver ranking completo <ChevronRight className="h-3 w-3" />
          </Button>
        </CardContent>
      </Card>

      {/* Top 5 by Revenue */}
      <Card 
        className="cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => handleNavigateToInsights("revenue")}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            Top 5 Peças (Receita)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {topByRevenue.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem vendas no período</p>
          ) : (
            topByRevenue.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                  <span className="truncate">{p.name}</span>
                </div>
                <span className="font-medium text-green-600 shrink-0 ml-2">
                  {formatPrice(p.revenue)}
                </span>
              </div>
            ))
          )}
          <Button variant="ghost" size="sm" className="w-full mt-2 gap-1">
            Ver ranking completo <ChevronRight className="h-3 w-3" />
          </Button>
        </CardContent>
      </Card>

      {/* Operational Risk */}
      <Card 
        className="cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => handleNavigateToInsights("risk")}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Risco Operacional
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {riskItems.length === 0 ? (
            <div className="text-center py-4">
              <Badge className="bg-green-100 text-green-700 border-0">Tudo OK</Badge>
              <p className="text-xs text-muted-foreground mt-2">Nenhum alerta ativo</p>
            </div>
          ) : (
            riskItems.map((r, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={
                      r.type === "baixa_conversao" 
                        ? "border-amber-300 text-amber-700 text-[10px]"
                        : "border-red-300 text-red-700 text-[10px]"
                    }
                  >
                    {r.type === "baixa_conversao" ? "Conversão" : "Cancelamento"}
                  </Badge>
                </div>
                <p className="text-xs truncate">{r.name}</p>
                <p className="text-[10px] text-muted-foreground">{r.value}</p>
              </div>
            ))
          )}
          <Button variant="ghost" size="sm" className="w-full mt-2 gap-1">
            Ver todos alertas <ChevronRight className="h-3 w-3" />
          </Button>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-purple-500" />
            Ações Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full justify-start gap-2"
            onClick={() => navigate("/dashboard?tab=orders&status=aguardando_pagamento")}
          >
            <TrendingUp className="h-4 w-4 text-amber-500" />
            Cobrar reservas
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full justify-start gap-2"
            onClick={() => navigate("/dashboard?tab=products&filter=low_stock")}
          >
            <Package className="h-4 w-4 text-blue-500" />
            Repor estoque
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full justify-start gap-2"
            onClick={() => handleNavigateToInsights("risk")}
          >
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Ver alertas
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            className="w-full justify-start gap-2 mt-2"
            onClick={() => handleNavigateToInsights()}
          >
            <TrendingUp className="h-4 w-4" />
            Centro de Inteligência
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
