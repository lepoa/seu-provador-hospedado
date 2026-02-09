import { useNavigate } from "react-router-dom";
import { Package, ArrowRight, AlertTriangle, TrendingUp, Snowflake, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TopProduct, DashboardKPIs } from "@/hooks/useDashboardData";

interface DashboardProductsBlockProps {
  products: TopProduct[];
  kpis: DashboardKPIs;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export function DashboardProductsBlock({ products, kpis }: DashboardProductsBlockProps) {
  const navigate = useNavigate();

  const stockAlerts = [
    {
      icon: TrendingUp,
      label: "Mais vendidos",
      count: products.length,
      color: "emerald",
      action: "Ver lista",
      onClick: () => navigate("/dashboard?tab=products"),
    },
    {
      icon: AlertTriangle,
      label: "Quase esgotados",
      count: kpis.produtosQuaseEsgotados,
      color: "amber",
      action: "Repor estoque",
      onClick: () => navigate("/dashboard?tab=products&filter=baixo-estoque"),
    },
    {
      icon: Snowflake,
      label: "Parados (+30d)",
      count: kpis.produtosParados,
      color: "blue",
      action: "Ver parados",
      onClick: () => navigate("/dashboard?tab=products&filter=parados"),
    },
    {
      icon: XCircle,
      label: "Esgotados",
      count: kpis.produtosEsgotados,
      color: "red",
      action: "Ver histórico",
      onClick: () => navigate("/dashboard?tab=products&filter=esgotados"),
    },
  ];

  const colorClasses: Record<string, { bg: string; hover: string }> = {
    emerald: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", hover: "hover:bg-emerald-100 hover:shadow-md" },
    amber: { bg: "bg-amber-50 text-amber-700 border-amber-200", hover: "hover:bg-amber-100 hover:shadow-md" },
    blue: { bg: "bg-blue-50 text-blue-700 border-blue-200", hover: "hover:bg-blue-100 hover:shadow-md" },
    red: { bg: "bg-red-50 text-red-700 border-red-200", hover: "hover:bg-red-100 hover:shadow-md" },
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            Produtos
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1"
            onClick={() => navigate("/dashboard?tab=products")}
          >
            Ver todos
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stock Alerts - Fully Interactive */}
        <div className="grid grid-cols-4 gap-2">
          {stockAlerts.map((alert) => (
            <button
              key={alert.label}
              onClick={alert.onClick}
              className={`${colorClasses[alert.color].bg} ${colorClasses[alert.color].hover} border rounded-lg p-2 text-center transition-all cursor-pointer group hover:scale-[1.02]`}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <alert.icon className="h-4 w-4" />
                <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-lg font-bold">{alert.count}</p>
              <p className="text-[10px] leading-tight">{alert.label}</p>
            </button>
          ))}
        </div>

        {/* Top Products - Clickable */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">🔥 Mais Vendidos</p>
          <div className="space-y-2">
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                Nenhuma venda ainda
              </p>
            ) : (
              products.slice(0, 5).map((product, index) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/dashboard?tab=products&productId=${product.id}`)}
                >
                  <span className="text-xs font-bold text-muted-foreground w-4">
                    #{index + 1}
                  </span>
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-10 h-10 rounded-lg object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{product.name}</p>
                    {product.color && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {product.color}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <p className="text-sm font-bold text-emerald-600">
                        {formatCurrency(product.valorTotal)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product.quantidadeVendida}x
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
