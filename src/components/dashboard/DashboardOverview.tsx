import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/hooks/useDashboardData";
import { DashboardKPICards } from "./DashboardKPICards";
import { DashboardSalesChart } from "./DashboardSalesChart";
import { DashboardOperationsCards } from "./DashboardOperationsCards";
import { DashboardLiveBlock } from "./DashboardLiveBlock";
import { DashboardCustomersBlock } from "./DashboardCustomersBlock";
import { DashboardProductsBlock } from "./DashboardProductsBlock";
import { DashboardAlertsBlock } from "./DashboardAlertsBlock";
import { DashboardInsightsBlock } from "./DashboardInsightsBlock";

export function DashboardOverview() {
  const { kpis, topCustomers, topProducts, alerts, hourlySales, isLoading, refetch } = useDashboardData();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Erro ao carregar dados</p>
        <Button onClick={refetch} variant="outline" className="mt-4">
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Visão Geral</h2>
          <p className="text-sm text-muted-foreground">
            Resumo do seu negócio em tempo real
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refetch}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <DashboardKPICards kpis={kpis} />

      {/* Grid Principal */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Coluna 1 - Gráfico + Operações */}
        <div className="lg:col-span-2 space-y-6">
          <DashboardSalesChart data={hourlySales} />
          <DashboardOperationsCards kpis={kpis} />
        </div>

        {/* Coluna 2 - Live + Insights + Alertas */}
        <div className="space-y-6">
          <DashboardLiveBlock kpis={kpis} />
          <DashboardInsightsBlock />
          <DashboardAlertsBlock alerts={alerts} />
        </div>
      </div>

      {/* Grid Secundário - Clientes + Produtos */}
      <div className="grid md:grid-cols-2 gap-6">
        <DashboardCustomersBlock customers={topCustomers} />
        <DashboardProductsBlock products={topProducts} kpis={kpis} />
      </div>
    </div>
  );
}
