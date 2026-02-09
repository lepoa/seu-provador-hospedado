import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductRanking } from "@/hooks/useInsightsData";

interface InsightsProductTableProps {
  data: ProductRanking[];
  sortBy: "revenue" | "qty";
  isLoading: boolean;
  onProductClick: (productName: string) => void;
}

export function InsightsProductTable({ 
  data, 
  sortBy, 
  isLoading,
  onProductClick 
}: InsightsProductTableProps) {
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const sorted = [...data].sort((a, b) => 
    sortBy === "revenue" ? b.revenue - a.revenue : b.qtySold - a.qtySold
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum produto encontrado no período
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">#</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Preço Médio</TableHead>
              <TableHead className="text-right">% Live</TableHead>
              <TableHead className="text-right">Reservados</TableHead>
              <TableHead className="text-right">Conversão</TableHead>
              <TableHead className="text-right">Cancelados</TableHead>
              <TableHead className="text-center">Risco</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((product, index) => (
              <TableRow 
                key={index}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onProductClick(product.productName)}
              >
                <TableCell className="font-mono text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell>
                  <div className="min-w-0">
                    <p className="font-medium truncate max-w-[200px]">{product.productName}</p>
                    {product.productSku && (
                      <p className="text-xs text-muted-foreground font-mono">{product.productSku}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {product.qtySold}
                </TableCell>
                <TableCell className="text-right font-medium text-green-600">
                  {formatPrice(product.revenue)}
                </TableCell>
                <TableCell className="text-right">
                  {formatPrice(product.avgPrice)}
                </TableCell>
                <TableCell className="text-right">
                  {product.percentLive > 0 ? (
                    <Badge variant="outline" className="border-pink-200 text-pink-700 text-xs">
                      {formatPercent(product.percentLive)}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {product.reservedQty > 0 ? (
                    <div>
                      <span className="font-medium text-amber-600">{product.reservedQty}</span>
                      <p className="text-[10px] text-muted-foreground">
                        {formatPrice(product.reservedValue)}
                      </p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <span className={
                    product.conversaoRate >= 70 ? "text-green-600" :
                    product.conversaoRate >= 40 ? "text-amber-600" : "text-red-600"
                  }>
                    {formatPercent(product.conversaoRate)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {product.canceledQty > 0 ? (
                    <div>
                      <span className="text-red-600">{product.canceledQty}</span>
                      <p className="text-[10px] text-muted-foreground">
                        {formatPercent(product.cancelamentoRate)}
                      </p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Badge 
                    className={
                      product.riskLevel === "critical" 
                        ? "bg-red-100 text-red-700 border-0"
                        : product.riskLevel === "warning"
                          ? "bg-amber-100 text-amber-700 border-0"
                          : "bg-green-100 text-green-700 border-0"
                    }
                  >
                    {product.riskLevel === "critical" ? "Crítico" :
                     product.riskLevel === "warning" ? "Atenção" : "OK"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
