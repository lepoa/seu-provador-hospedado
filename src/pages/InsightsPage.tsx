import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  ArrowLeft, RefreshCw, Download, Search, Filter,
  TrendingUp, ShoppingBag, Receipt, BarChart3, Users,
  AlertTriangle, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInsightsData, InsightsFilters, InsightsPeriod, SourceFilter, StatusFilter } from "@/hooks/useInsightsData";
import { InsightsProductTable } from "@/components/insights/InsightsProductTable";
import { InsightsSizeRanking } from "@/components/insights/InsightsSizeRanking";
import { InsightsSellerRanking } from "@/components/insights/InsightsSellerRanking";
import { InsightsAlerts } from "@/components/insights/InsightsAlerts";
import { InsightsProductDrawer } from "@/components/insights/InsightsProductDrawer";
import logoLepoa from "@/assets/logo-lepoa.png";

const InsightsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [filters, setFilters] = useState<InsightsFilters>({
    period: (searchParams.get("period") as InsightsPeriod) || "7d",
    source: (searchParams.get("source") as SourceFilter) || "all",
    status: (searchParams.get("status") as StatusFilter) || "pago",
    sellerId: searchParams.get("seller") || null,
    paymentMethod: null,
    search: searchParams.get("search") || "",
  });

  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "produtos");
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"revenue" | "qty">(
    (searchParams.get("sort") as "revenue" | "qty") || "revenue"
  );

  const {
    kpis,
    productRanking,
    sizeRanking,
    sellerRanking,
    alerts,
    sellers,
    isLoading,
    refetch,
    dateRange,
  } = useInsightsData(filters);

  const updateFilters = (updates: Partial<InsightsFilters>) => {
    setFilters(prev => ({ ...prev, ...updates }));
    
    // Update URL
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, String(value));
      } else {
        newParams.delete(key);
      }
    });
    setSearchParams(newParams);
  };

  const handleExportCSV = () => {
    const sorted = [...productRanking].sort((a, b) => 
      sortBy === "revenue" ? b.revenue - a.revenue : b.qtySold - a.qtySold
    );

    const headers = [
      "Rank", "Produto", "SKU", "Qtd Vendida", "Receita", "Preço Médio",
      "% Live", "Reservados", "Conversão %", "Cancelados", "Cancel %"
    ];

    const rows = sorted.map((p, i) => [
      i + 1,
      p.productName,
      p.productSku || "",
      p.qtySold,
      p.revenue.toFixed(2),
      p.avgPrice.toFixed(2),
      p.percentLive.toFixed(0),
      p.reservedQty,
      p.conversaoRate.toFixed(1),
      p.canceledQty,
      p.cancelamentoRate.toFixed(1),
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ranking-produtos-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const getChangeIndicator = (current: number, previous: number) => {
    if (previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    const isPositive = change > 0;
    return (
      <span className={`text-xs ${isPositive ? "text-green-600" : "text-red-600"}`}>
        {isPositive ? "+" : ""}{change.toFixed(0)}%
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logoLepoa} alt="LE.POÁ" className="h-6 hidden sm:block" />
            <div className="h-6 w-px bg-border hidden sm:block" />
            <h1 className="text-sm sm:text-base font-semibold">Centro de Inteligência</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refetch} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6">
        {/* Filters Bar */}
        <div className="flex flex-wrap gap-2 items-center">
          <Select
            value={filters.period}
            onValueChange={(v) => updateFilters({ period: v as InsightsPeriod })}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="thisMonth">Este mês</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.source}
            onValueChange={(v) => updateFilters({ source: v as SourceFilter })}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas origens</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="catalog">Catálogo</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.status}
            onValueChange={(v) => updateFilters({ status: v as StatusFilter })}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pago">Pagos</SelectItem>
              <SelectItem value="reservado">Reservados</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.sellerId || "all"}
            onValueChange={(v) => updateFilters({ sellerId: v === "all" ? null : v })}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Vendedora" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas vendedoras</SelectItem>
              {sellers.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou SKU..."
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
              className="pl-9"
            />
          </div>
        </div>

        {/* KPIs */}
        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Receipt className="h-3.5 w-3.5" />
                  Receita
                </div>
                <div className="text-lg font-bold">{formatPrice(kpis.receita)}</div>
                {getChangeIndicator(kpis.receita, kpis.receitaPrev)}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Itens vendidos
                </div>
                <div className="text-lg font-bold">{kpis.itensSold}</div>
                {getChangeIndicator(kpis.itensSold, kpis.itensSoldPrev)}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Ticket médio
                </div>
                <div className="text-lg font-bold">{formatPrice(kpis.ticketMedio)}</div>
                {getChangeIndicator(kpis.ticketMedio, kpis.ticketMedioPrev)}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Conversão Live
                </div>
                <div className="text-lg font-bold">{formatPercent(kpis.conversaoLive)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Conversão Catálogo
                </div>
                <div className="text-lg font-bold">{formatPercent(kpis.conversaoCatalog)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Cancelamento
                </div>
                <div className="text-lg font-bold text-red-600">{formatPercent(kpis.cancelamentoRate)}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Channel Split */}
        {kpis && (
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1">
              <span className="w-2 h-2 rounded-full bg-pink-500" />
              Live: {formatPercent(kpis.percentLive)}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Catálogo: {formatPercent(kpis.percentCatalog)}
            </Badge>
          </div>
        )}

        {/* Alerts Banner */}
        {alerts.length > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <span className="font-medium text-amber-800">
                    {alerts.length} alertas ativos
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setActiveTab("alertas")}
                  className="gap-1 text-amber-700"
                >
                  Ver todos <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="produtos" className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="tamanhos" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Tamanhos
            </TabsTrigger>
            <TabsTrigger value="vendedoras" className="gap-2">
              <Users className="h-4 w-4" />
              Vendedoras
            </TabsTrigger>
            <TabsTrigger value="alertas" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alertas
              {alerts.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-[10px]">
                  {alerts.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="produtos" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Ordenar por:</span>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as "revenue" | "qty")}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">Receita</SelectItem>
                    <SelectItem value="qty">Quantidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span className="text-sm text-muted-foreground">
                {productRanking.length} produtos
              </span>
            </div>
            <InsightsProductTable 
              data={productRanking} 
              sortBy={sortBy}
              isLoading={isLoading}
              onProductClick={(name) => setSelectedProduct(name)}
            />
          </TabsContent>

          <TabsContent value="tamanhos" className="mt-4">
            <InsightsSizeRanking data={sizeRanking} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="vendedoras" className="mt-4">
            <InsightsSellerRanking data={sellerRanking} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="alertas" className="mt-4">
            <InsightsAlerts alerts={alerts} onViewProduct={(name) => setSelectedProduct(name)} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Product Drawer */}
      <InsightsProductDrawer
        productName={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        filters={filters}
      />
    </div>
  );
};

export default InsightsPage;
