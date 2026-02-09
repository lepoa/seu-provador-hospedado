import { Crown, AlertTriangle, TrendingUp, Users, DollarSign, Target, ShoppingBag, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SellerPerformance, SellerBadge } from "@/hooks/useLiveReportsV2";

interface LiveReportSellerPerformanceProps {
  sellers: SellerPerformance[];
}

export function LiveReportSellerPerformance({ sellers }: LiveReportSellerPerformanceProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-yellow-100">
            <Crown className="h-4 w-4 text-yellow-600" />
          </div>
        );
      case 2:
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
            2º
          </div>
        );
      case 3:
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
            3º
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-muted-foreground text-xs font-bold">
            {rank}º
          </div>
        );
    }
  };

  const getBadgeConfig = (badge: SellerBadge) => {
    switch (badge) {
      case 'maior_faturamento':
        return {
          icon: DollarSign,
          label: 'Maior Faturamento',
          className: 'bg-green-100 text-green-700 border-green-300',
        };
      case 'maior_conversao':
        return {
          icon: Target,
          label: 'Maior Conversão',
          className: 'bg-blue-100 text-blue-700 border-blue-300',
        };
      case 'mais_pedidos':
        return {
          icon: ShoppingBag,
          label: 'Mais Pedidos',
          className: 'bg-purple-100 text-purple-700 border-purple-300',
        };
      case 'melhor_performance':
        return {
          icon: Award,
          label: 'Melhor Performance',
          className: 'bg-yellow-100 text-yellow-700 border-yellow-300',
        };
      case 'attention':
        return {
          icon: AlertTriangle,
          label: 'Atenção',
          className: 'border-red-300 text-red-600 bg-red-50',
        };
    }
  };

  const renderBadges = (badges: SellerBadge[]) => {
    if (badges.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1">
        {badges.map((badge) => {
          const config = getBadgeConfig(badge);
          const Icon = config.icon;
          return (
            <Badge key={badge} className={`${config.className} gap-1 text-[10px] px-1.5 py-0.5`}>
              <Icon className="h-3 w-3" />
              <span className="hidden sm:inline">{config.label}</span>
            </Badge>
          );
        })}
      </div>
    );
  };

  // Sort by value for main view
  const sortedByValue = [...sellers].filter(s => s.valorPago > 0);
  const sellersWithNoSales = sellers.filter(s => s.valorPago === 0);

  if (sellers.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Performance por Vendedora
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma vendedora atribuída ainda</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Performance por Vendedora
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground cursor-help underline decoration-dotted">
                  ℹ️ Critérios dos badges
                </span>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <div className="space-y-1 text-xs">
                  <p><strong>Maior Faturamento:</strong> Maior valor pago</p>
                  <p><strong>Mais Pedidos:</strong> Maior nº de pedidos pagos</p>
                  <p><strong>Maior Conversão:</strong> Maior % conversão (base mínima: ≥3 pedidos OU ≥R$300 reservado)</p>
                  <p><strong>Melhor Performance:</strong> Score ponderado (45% valor + 35% conversão + 20% pedidos)</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Vendedora</TableHead>
                <TableHead className="text-center">Pedidos</TableHead>
                <TableHead className="text-right">Valor Pago</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Ticket Médio</TableHead>
                <TableHead className="text-center hidden md:table-cell">Conversão</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedByValue.map((seller) => (
                <TableRow 
                  key={seller.sellerId || 'none'} 
                  className={seller.rank <= 3 ? "bg-muted/20" : ""}
                >
                  <TableCell className="text-center">
                    {getRankBadge(seller.rank)}
                  </TableCell>
                  <TableCell>
                    <span className={`font-medium ${!seller.sellerId ? 'text-muted-foreground italic' : ''}`}>
                      {seller.sellerName}
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {seller.pedidos}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-bold text-green-600">
                      {formatCurrency(seller.valorPago)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center hidden sm:table-cell">
                    {formatCurrency(seller.ticketMedio)}
                  </TableCell>
                  <TableCell className="text-center hidden md:table-cell">
                    <span className={`font-medium ${seller.taxaConversao >= 70 ? 'text-green-600' : seller.taxaConversao >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                      {seller.taxaConversao.toFixed(0)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {renderBadges(seller.badges)}
                  </TableCell>
                </TableRow>
              ))}
              {sellersWithNoSales.length > 0 && (
                <TableRow className="bg-muted/10">
                  <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-2">
                    {sellersWithNoSales.length} vendedora(s) sem vendas pagas nesta live
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
