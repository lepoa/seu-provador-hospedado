import { useState } from "react";
import { 
  DollarSign, 
  Target, 
  ShoppingBag, 
  Receipt,
  ArrowUpDown,
  Crown,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import type { SellerPerformance, SellerBadge } from "@/hooks/useDashboardDataV2";
import { cn } from "@/lib/utils";

interface DashboardSellerPerformanceProps {
  sellers: SellerPerformance[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

type SortKey = "valorPago" | "conversao" | "pedidosPagos" | "ticketMedio";

const badgeConfig: Record<SellerBadge, { icon: React.ElementType; label: string; color: string }> = {
  maior_faturamento: { icon: DollarSign, label: "Maior Faturamento", color: "bg-primary/10 text-primary border-primary/30" },
  maior_conversao: { icon: Target, label: "Maior Conversão", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  mais_pedidos: { icon: ShoppingBag, label: "Mais Pedidos", color: "bg-blue-50 text-blue-700 border-blue-200" },
  maior_ticket: { icon: Receipt, label: "Maior Ticket", color: "bg-violet-50 text-violet-700 border-violet-200" },
  velocidade: { icon: Crown, label: "Mais Rápida", color: "bg-amber-50 text-amber-700 border-amber-200" },
};

export function DashboardSellerPerformance({ sellers }: DashboardSellerPerformanceProps) {
  const [sortKey, setSortKey] = useState<SortKey>("valorPago");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sortedSellers = [...sellers].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortAsc ? diff : -diff;
  });

  const renderBadges = (badges: SellerBadge[]) => {
    if (badges.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-1">
        {badges.map(badge => {
          const config = badgeConfig[badge];
          const Icon = config.icon;
          return (
            <TooltipProvider key={badge}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className={cn("text-xs gap-1 border", config.color)}>
                    <Icon className="h-3 w-3" />
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{config.label}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    );
  };

  const SortButton = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-auto p-0 font-medium hover:bg-transparent",
        sortKey === sortKeyName ? "text-foreground" : "text-muted-foreground"
      )}
      onClick={() => handleSort(sortKeyName)}
    >
      {label}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  if (sellers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Performance por Vendedora</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma vendedora com pedidos no período.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Performance por Vendedora</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground cursor-help hidden sm:inline">
                  ℹ️ Critérios
                </span>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <div className="text-xs space-y-1">
                  <p><strong>Maior Faturamento:</strong> maior valor pago (R$)</p>
                  <p><strong>Maior Conversão:</strong> maior % (base mín. 3 pedidos ou R$300)</p>
                  <p><strong>Mais Pedidos:</strong> maior quantidade de pedidos pagos</p>
                  <p><strong>Maior Ticket:</strong> maior ticket médio</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[150px]">Vendedora</TableHead>
                <TableHead className="text-right">Reservados</TableHead>
                <TableHead className="text-right">Pagos</TableHead>
                <TableHead className="text-right">
                  <SortButton label="Conversão" sortKeyName="conversao" />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton label="Valor Pago" sortKeyName="valorPago" />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton label="Ticket" sortKeyName="ticketMedio" />
                </TableHead>
                <TableHead className="w-[120px]">Destaques</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSellers.map((seller, index) => (
                <TableRow key={seller.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{index + 1}.</span>
                      {seller.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {seller.pedidosReservados}
                  </TableCell>
                  <TableCell className="text-right">
                    {seller.pedidosPagos}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn(
                      seller.conversao >= 70 ? "text-primary font-medium" : 
                      seller.conversao < 50 ? "text-amber-600" : ""
                    )}>
                      {formatPercent(seller.conversao)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(seller.valorPago)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(seller.ticketMedio)}
                  </TableCell>
                  <TableCell>
                    {renderBadges(seller.badges)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {sortedSellers.map((seller, index) => (
            <div 
              key={seller.id}
              className="p-3 rounded-lg border bg-card/50"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{index + 1}.</span>
                  <span className="font-medium text-sm">{seller.name}</span>
                </div>
                {renderBadges(seller.badges)}
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reservados:</span>
                  <span>{seller.pedidosReservados}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pagos:</span>
                  <span>{seller.pedidosPagos}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Conversão:</span>
                  <span className={cn(
                    seller.conversao >= 70 ? "text-primary font-medium" : 
                    seller.conversao < 50 ? "text-amber-600" : ""
                  )}>
                    {formatPercent(seller.conversao)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ticket:</span>
                  <span>{formatCurrency(seller.ticketMedio)}</span>
                </div>
              </div>
              
              <div className="mt-2 pt-2 border-t flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Total Pago</span>
                <span className="font-semibold text-primary">{formatCurrency(seller.valorPago)}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
