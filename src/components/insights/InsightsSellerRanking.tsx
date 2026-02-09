import { Loader2, Trophy, Star, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SellerRanking } from "@/hooks/useInsightsData";

interface InsightsSellerRankingProps {
  data: SellerRanking[];
  isLoading: boolean;
}

export function InsightsSellerRanking({ data, isLoading }: InsightsSellerRankingProps) {
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

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
        Nenhuma vendedora encontrada no período
      </div>
    );
  }

  // Find top performers
  const topRevenue = data.reduce((max, s) => s.revenue > max.revenue ? s : max, data[0]);
  const topConversao = data.filter(s => s.ordersCount >= 3).reduce((max, s) => 
    s.conversaoRate > max.conversaoRate ? s : max, data[0]);
  const topQty = data.reduce((max, s) => s.qtySold > max.qtySold ? s : max, data[0]);

  return (
    <div className="space-y-6">
      {/* Top Performers Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-600" />
              Maior Faturamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-lg">{topRevenue.name}</p>
            <p className="text-green-600 font-medium">{formatPrice(topRevenue.revenue)}</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Maior Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-lg">{topConversao.name}</p>
            <p className="text-blue-600 font-medium">{formatPercent(topConversao.conversaoRate)}</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-purple-600" />
              Mais Peças
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-lg">{topQty.name}</p>
            <p className="text-purple-600 font-medium">{topQty.qtySold} peças</p>
          </CardContent>
        </Card>
      </div>

      {/* Full Ranking Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">#</TableHead>
              <TableHead>Vendedora</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Peças</TableHead>
              <TableHead className="text-right">Pedidos</TableHead>
              <TableHead className="text-right">Conversão</TableHead>
              <TableHead className="text-right">Cancelamento</TableHead>
              <TableHead>Top 3 Produtos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((seller, index) => (
              <TableRow key={seller.id}>
                <TableCell className="font-mono text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{seller.name}</span>
                    {seller.id === topRevenue.id && (
                      <Badge className="bg-yellow-100 text-yellow-700 border-0 text-[10px]">
                        💰 Top
                      </Badge>
                    )}
                    {seller.id === topConversao.id && seller.id !== topRevenue.id && (
                      <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px]">
                        📈 Conversão
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium text-green-600">
                  {formatPrice(seller.revenue)}
                </TableCell>
                <TableCell className="text-right">
                  {seller.qtySold}
                </TableCell>
                <TableCell className="text-right">
                  {seller.ordersCount}
                </TableCell>
                <TableCell className="text-right">
                  <span className={
                    seller.conversaoRate >= 70 ? "text-green-600 font-medium" :
                    seller.conversaoRate >= 40 ? "text-amber-600" : "text-red-600"
                  }>
                    {formatPercent(seller.conversaoRate)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {seller.cancelamentoRate > 0 ? (
                    <span className={seller.cancelamentoRate > 20 ? "text-red-600" : "text-muted-foreground"}>
                      {formatPercent(seller.cancelamentoRate)}
                    </span>
                  ) : (
                    <span className="text-green-600">0%</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {seller.topProducts.slice(0, 3).map((p, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] truncate max-w-[100px]">
                        {p.name} ({p.qty})
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
