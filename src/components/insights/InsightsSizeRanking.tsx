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
import { SizeRanking } from "@/hooks/useInsightsData";

interface InsightsSizeRankingProps {
  data: SizeRanking[];
  isLoading: boolean;
}

export function InsightsSizeRanking({ data, isLoading }: InsightsSizeRankingProps) {
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

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
        Nenhum dado de tamanho encontrado
      </div>
    );
  }

  // Calculate totals for percentage
  const totalQty = data.reduce((sum, s) => sum + s.qtySold, 0);
  const totalRevenue = data.reduce((sum, s) => sum + s.revenue, 0);

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Tamanho</TableHead>
            <TableHead className="text-right">Qtd Vendida</TableHead>
            <TableHead className="text-right">% do Total</TableHead>
            <TableHead className="text-right">Receita</TableHead>
            <TableHead className="text-right">Reservados</TableHead>
            <TableHead className="text-right">Cancelados</TableHead>
            <TableHead className="text-right">Estoque</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((size, index) => {
            const qtyPercent = totalQty > 0 ? (size.qtySold / totalQty) * 100 : 0;
            
            return (
              <TableRow key={index}>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-sm">
                    {size.size}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {size.qtySold}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(qtyPercent, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-10">
                      {qtyPercent.toFixed(1)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium text-green-600">
                  {formatPrice(size.revenue)}
                </TableCell>
                <TableCell className="text-right">
                  {size.reservedQty > 0 ? (
                    <span className="text-amber-600 font-medium">{size.reservedQty}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {size.canceledQty > 0 ? (
                    <span className="text-red-600">{size.canceledQty}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {size.stockAvailable > 0 ? (
                    <Badge 
                      className={
                        size.stockAvailable < 5 
                          ? "bg-red-100 text-red-700 border-0"
                          : size.stockAvailable < 15
                            ? "bg-amber-100 text-amber-700 border-0"
                            : "bg-green-100 text-green-700 border-0"
                      }
                    >
                      {size.stockAvailable}
                    </Badge>
                  ) : (
                    <Badge className="bg-muted text-muted-foreground border-0">0</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
