import { Package, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TopProduct } from "@/hooks/useLiveReports";

interface LiveReportTopProductsProps {
  products: TopProduct[];
}

export function LiveReportTopProducts({ products }: LiveReportTopProductsProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  if (products.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Produtos Mais Vendidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma venda registrada
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxValue = products[0]?.valorTotal || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Produtos Mais Vendidos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {products.slice(0, 10).map((product, index) => (
          <div 
            key={product.productId}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            {/* Ranking */}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              index === 0 ? "bg-amber-100 text-amber-700" :
              index === 1 ? "bg-gray-200 text-gray-700" :
              index === 2 ? "bg-orange-100 text-orange-700" :
              "bg-muted text-muted-foreground"
            }`}>
              {index + 1}
            </div>

            {/* Product Image */}
            <div className="w-10 h-10 rounded-lg bg-secondary overflow-hidden shrink-0">
              {product.productImage ? (
                <img 
                  src={product.productImage} 
                  alt={product.productName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{product.productName}</div>
              <div className="text-xs text-muted-foreground">
                {product.productColor && `${product.productColor} • `}
                {product.quantidadeVendida} {product.quantidadeVendida === 1 ? "unidade" : "unidades"}
              </div>
            </div>

            {/* Value */}
            <div className="text-right shrink-0">
              <div className="font-semibold text-sm">{formatPrice(product.valorTotal)}</div>
              {/* Progress bar */}
              <div className="w-16 h-1 bg-muted rounded-full mt-1">
                <div 
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${(product.valorTotal / maxValue) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
