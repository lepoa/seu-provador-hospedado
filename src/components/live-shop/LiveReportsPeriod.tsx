import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ArrowLeft, 
  Calendar, 
  BarChart3, 
  Filter,
  Radio,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  GitCompare,
  Download,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useLiveReportsByPeriod, LiveEventSummary } from "@/hooks/useLiveReportsByPeriod";
import { LiveReportKpiCards } from "./LiveReportKpiCards";
import { LiveReportTopProducts } from "./LiveReportTopProducts";
import { LiveReportSalesChart } from "./LiveReportSalesChart";
import { LiveReportsPeriodComparison } from "./LiveReportsPeriodComparison";
import { exportPeriodReportToCSV, exportPeriodReportToExcel } from "@/lib/exportUtils";

type PeriodPreset = "7d" | "30d" | "thisMonth" | "lastMonth" | "thisYear" | "custom";

type ComparisonType = "previousPeriod" | "previousMonth" | "previousYear" | "custom";

function getComparisonDates(
  startDate: Date,
  endDate: Date,
  comparisonType: ComparisonType
): { start: Date; end: Date } {
  const periodLength = endDate.getTime() - startDate.getTime();
  
  switch (comparisonType) {
    case "previousPeriod":
      return {
        start: new Date(startDate.getTime() - periodLength - 86400000),
        end: new Date(startDate.getTime() - 86400000),
      };
    case "previousMonth":
      return {
        start: subMonths(startDate, 1),
        end: subMonths(endDate, 1),
      };
    case "previousYear":
      return {
        start: subYears(startDate, 1),
        end: subYears(endDate, 1),
      };
    default:
      return {
        start: subMonths(startDate, 1),
        end: subMonths(endDate, 1),
      };
  }
}

function getComparisonLabel(type: ComparisonType): string {
  switch (type) {
    case "previousPeriod": return "Período anterior";
    case "previousMonth": return "Mês anterior";
    case "previousYear": return "Ano anterior";
    default: return "Período anterior";
  }
}

// Helper components to keep the main render clean
function AdditionalStats({ 
  totalEvents, 
  kpis, 
  formatPrice 
}: { 
  totalEvents: number; 
  kpis: any; 
  formatPrice: (price: number) => string;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Radio className="h-4 w-4" />
            Total de Lives
          </div>
          <div className="text-2xl font-bold">{totalEvents}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <DollarSign className="h-4 w-4" />
            Média por Live
          </div>
          <div className="text-2xl font-bold">
            {formatPrice(kpis ? kpis.totalPago / totalEvents : 0)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <ShoppingCart className="h-4 w-4" />
            Carrinhos/Live
          </div>
          <div className="text-2xl font-bold">
            {kpis ? (kpis.totalCarrinhos / totalEvents).toFixed(1) : 0}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <TrendingUp className="h-4 w-4" />
            Horas de Live
          </div>
          <div className="text-2xl font-bold">
            {kpis ? (kpis.duracaoMinutos / 60).toFixed(1) : 0}h
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EventsList({ 
  events, 
  statusLabels, 
  formatPrice,
  navigate,
}: { 
  events: LiveEventSummary[];
  statusLabels: Record<string, { label: string; color: string }>;
  formatPrice: (price: number) => string;
  navigate: (path: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          Lives no Período
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
        {events.map((event) => {
          const status = statusLabels[event.status] || statusLabels.encerrada;
          
          return (
            <div 
              key={event.id}
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/dashboard/lives/${event.id}/relatorio`)}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{event.titulo}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(event.data_hora_inicio), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="font-semibold text-green-600">{formatPrice(event.totalPago)}</div>
                <div className="text-xs text-muted-foreground">
                  {event.carrinhosPagos}/{event.totalCarrinhos} pagos
                </div>
              </div>

              <Badge className={status.color}>{status.label}</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function LiveReportsPeriod() {
  const navigate = useNavigate();
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("30d");
  const [startDate, setStartDate] = useState<Date | undefined>(() => subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date | undefined>(() => new Date());
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [comparisonType, setComparisonType] = useState<ComparisonType>("previousPeriod");
  const [activeTab, setActiveTab] = useState<"overview" | "comparison">("overview");

  const { events, kpis, topProducts, timelineData, isLoading, totalEvents } = useLiveReportsByPeriod(startDate, endDate);
  
  // Calculate comparison dates
  const comparisonDates = startDate && endDate 
    ? getComparisonDates(startDate, endDate, comparisonType)
    : { start: undefined, end: undefined };
  
  // Fetch comparison data
  const { 
    kpis: comparisonKpis, 
    totalEvents: comparisonTotalEvents,
    isLoading: isComparisonLoading,
  } = useLiveReportsByPeriod(
    comparisonEnabled ? comparisonDates.start : undefined,
    comparisonEnabled ? comparisonDates.end : undefined
  );

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const handlePresetChange = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    const now = new Date();
    
    switch (preset) {
      case "7d":
        setStartDate(subDays(now, 7));
        setEndDate(now);
        break;
      case "30d":
        setStartDate(subDays(now, 30));
        setEndDate(now);
        break;
      case "thisMonth":
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        break;
      case "lastMonth":
        const lastMonth = subMonths(now, 1);
        setStartDate(startOfMonth(lastMonth));
        setEndDate(endOfMonth(lastMonth));
        break;
      case "thisYear":
        setStartDate(startOfYear(now));
        setEndDate(endOfYear(now));
        break;
      case "custom":
        break;
    }
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    "planejada": { label: "Planejada", color: "bg-blue-100 text-blue-700" },
    "ao_vivo": { label: "Ao Vivo", color: "bg-red-100 text-red-700" },
    "encerrada": { label: "Encerrada", color: "bg-muted text-muted-foreground" },
    "arquivada": { label: "Arquivada", color: "bg-secondary text-secondary-foreground" },
  };
  
  const currentPeriodLabel = startDate && endDate 
    ? `${format(startDate, "dd/MM", { locale: ptBR })} - ${format(endDate, "dd/MM", { locale: ptBR })}`
    : "Período atual";
    
  const comparisonPeriodLabel = comparisonDates.start && comparisonDates.end
    ? `${format(comparisonDates.start, "dd/MM", { locale: ptBR })} - ${format(comparisonDates.end, "dd/MM", { locale: ptBR })}`
    : getComparisonLabel(comparisonType);

  const handleExportCSV = () => {
    if (!startDate || !endDate) return;
    exportPeriodReportToCSV({
      events,
      kpis,
      topProducts,
      startDate,
      endDate,
    });
  };

  const handleExportExcel = () => {
    if (!startDate || !endDate) return;
    exportPeriodReportToExcel({
      events,
      kpis,
      topProducts,
      startDate,
      endDate,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h1 className="text-lg font-semibold">Relatório de Lives por Período</h1>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {startDate && endDate && (
                  <>
                    <Calendar className="h-3.5 w-3.5" />
                    {format(startDate, "dd/MM/yyyy", { locale: ptBR })} — {format(endDate, "dd/MM/yyyy", { locale: ptBR })}
                    <span className="text-primary font-medium">({totalEvents} lives)</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Export Button */}
          {totalEvents > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV}>
                  <FileText className="h-4 w-4 mr-2" />
                  CSV (.csv)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filtrar Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={periodPreset} onValueChange={(v) => handlePresetChange(v as PeriodPreset)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="thisMonth">Este mês</SelectItem>
                  <SelectItem value="lastMonth">Mês passado</SelectItem>
                  <SelectItem value="thisYear">Este ano</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>

              {periodPreset === "custom" && (
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[140px] justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "dd/MM/yyyy") : "Início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>

                  <span className="text-muted-foreground">até</span>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[140px] justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "dd/MM/yyyy") : "Fim"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Comparison Toggle */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Switch 
                  id="comparison-mode"
                  checked={comparisonEnabled}
                  onCheckedChange={(checked) => {
                    setComparisonEnabled(checked);
                    if (checked) setActiveTab("comparison");
                    else setActiveTab("overview");
                  }}
                />
                <Label htmlFor="comparison-mode" className="flex items-center gap-2 cursor-pointer">
                  <GitCompare className="h-4 w-4 text-primary" />
                  Comparar com outro período
                </Label>
              </div>
              
              {comparisonEnabled && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Comparar com:</span>
                  <Select 
                    value={comparisonType} 
                    onValueChange={(v) => setComparisonType(v as ComparisonType)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="previousPeriod">Período anterior</SelectItem>
                      <SelectItem value="previousMonth">Mesmo período mês anterior</SelectItem>
                      <SelectItem value="previousYear">Mesmo período ano anterior</SelectItem>
                    </SelectContent>
                  </Select>
                  {comparisonDates.start && comparisonDates.end && (
                    <Badge variant="secondary" className="text-xs">
                      {format(comparisonDates.start, "dd/MM", { locale: ptBR })} - {format(comparisonDates.end, "dd/MM", { locale: ptBR })}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {isLoading || (comparisonEnabled && isComparisonLoading) ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <Skeleton className="h-96" />
              <Skeleton className="h-96" />
            </div>
          </div>
        ) : totalEvents === 0 ? (
          <Card className="py-12">
            <CardContent className="text-center">
              <Radio className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Nenhuma live encontrada</h2>
              <p className="text-muted-foreground mb-4">
                Não há lives registradas no período selecionado.
              </p>
              <Button variant="outline" onClick={() => handlePresetChange("thisYear")}>
                Ver todo o ano
              </Button>
            </CardContent>
          </Card>
        ) : comparisonEnabled ? (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "overview" | "comparison")}>
            <TabsList className="mb-4">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="comparison">
                <GitCompare className="h-4 w-4 mr-1" />
                Comparativo
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="comparison">
              <LiveReportsPeriodComparison
                data={{
                  current: kpis,
                  previous: comparisonKpis,
                  currentEvents: totalEvents,
                  previousEvents: comparisonTotalEvents,
                  currentLabel: currentPeriodLabel,
                  previousLabel: comparisonPeriodLabel,
                }}
              />
            </TabsContent>
            
            <TabsContent value="overview">
              <div className="space-y-6">
                {kpis && <LiveReportKpiCards kpis={kpis} />}
                <AdditionalStats 
                  totalEvents={totalEvents} 
                  kpis={kpis} 
                  formatPrice={formatPrice} 
                />
                <LiveReportSalesChart data={timelineData} />
                <div className="grid md:grid-cols-2 gap-6">
                  <LiveReportTopProducts products={topProducts} />
                  <EventsList 
                    events={events} 
                    statusLabels={statusLabels} 
                    formatPrice={formatPrice}
                    navigate={navigate}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <>
            {/* KPIs */}
            {kpis && <LiveReportKpiCards kpis={kpis} />}

            {/* Additional Stats */}
            <AdditionalStats 
              totalEvents={totalEvents} 
              kpis={kpis} 
              formatPrice={formatPrice} 
            />

            {/* Sales Evolution Chart */}
            <LiveReportSalesChart data={timelineData} />

            {/* Charts & Tables */}
            <div className="grid md:grid-cols-2 gap-6">
              <LiveReportTopProducts products={topProducts} />
              
              <EventsList 
                events={events} 
                statusLabels={statusLabels} 
                formatPrice={formatPrice}
                navigate={navigate}
              />
            </div>

            {/* Summary */}
            {kpis && kpis.totalReservado > 0 && (
              <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl p-6">
                <h3 className="font-semibold text-lg mb-3">Resumo do Período</h3>
                <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total de Lives:</span>
                    <div className="font-bold text-lg">{totalEvents}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Reservado:</span>
                    <div className="font-bold text-lg">{formatPrice(kpis.totalReservado)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Pago:</span>
                    <div className="font-bold text-lg text-green-600">{formatPrice(kpis.totalPago)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Itens Vendidos:</span>
                    <div className="font-bold text-lg">{kpis.totalItensPagos} unidades</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Taxa de Pagamento:</span>
                    <div className="font-bold text-lg">{kpis.taxaPagamento.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
