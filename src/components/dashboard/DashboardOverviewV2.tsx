import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDashboardDataV2, DashboardFilters } from "@/hooks/useDashboardDataV2";
import { useIsMobile } from "@/hooks/use-mobile";
import { dashboardNavigation } from "@/lib/dashboardNavigation";
import { DashboardFiltersBar } from "./DashboardFilters";
import { DashboardMobileFilters } from "./DashboardMobileFilters";
import { DashboardKPICardsV2 } from "./DashboardKPICardsV2";
import { DashboardExecutiveCommandCenter } from "./DashboardExecutiveCommandCenter";
import { RevenueCommand, RevenueCommandPriority } from "./RevenueCommand";
import { DashboardIntelligence, DashboardRetailPulse } from "./DashboardIntelligence";
import { DashboardChannelComparison } from "./DashboardChannelComparison";
import { DashboardSellerPerformance } from "./DashboardSellerPerformance";
import { DashboardPendingActions } from "./DashboardPendingActions";
import { DashboardTopCustomers } from "./DashboardTopCustomers";
import { DashboardBICards } from "./DashboardBICards";
import { ActionCenter, type ActionCenterType } from "./ActionCenter";

type OverviewTab = "executivo" | "inteligencia";

export function DashboardOverviewV2() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState<DashboardFilters>({
    period: "7days",
    channel: "all",
    liveEventId: null,
    sellerId: null,
  });
  const [actionCenterOpen, setActionCenterOpen] = useState(false);
  const [actionCenterType, setActionCenterType] = useState<ActionCenterType>("conversao");
  const [overviewTab, setOverviewTab] = useState<OverviewTab>("executivo");

  const {
    kpis,
    executivePulse,
    intelligence,
    revenueCommand,
    channelComparison,
    sellerPerformance,
    topCustomers,
    pendingActions,
    sellers,
    liveEvents,
    isLoading,
    refetch,
    dateRange,
  } = useDashboardDataV2(filters);

  const openActionCenter = (type: ActionCenterType) => {
    setActionCenterType(type);
    setActionCenterOpen(true);
  };

  const handleKPIClick = (kpiType: string) => {
    switch (kpiType) {
      case "faturamento":
        navigate(dashboardNavigation.faturamentoPago());
        break;
      case "reservado":
        navigate(dashboardNavigation.reservado());
        break;
      case "conversao":
        navigate(dashboardNavigation.conversao());
        break;
      case "ticket":
        navigate("/dashboard?tab=clientes");
        break;
      case "pa":
        navigate("/dashboard?tab=products");
        break;
      case "pendencias":
        openActionCenter("pendencias");
        break;
      case "pagos":
        navigate(dashboardNavigation.pagos());
        break;
      case "pendentes":
        navigate(dashboardNavigation.pendentes());
        break;
      case "cancelados":
        navigate(dashboardNavigation.cancelados());
        break;
      default:
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Erro ao carregar dados</p>
        <Button onClick={refetch} variant="outline" className="mt-4">
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold sm:text-xl">Visão Geral</h2>
          <p className="hidden text-xs text-muted-foreground sm:block sm:text-sm">Dados consolidados do seu negócio</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isMobile ? (
            <DashboardMobileFilters
              filters={filters}
              onFiltersChange={setFilters}
              sellers={sellers}
              liveEvents={liveEvents}
            />
          ) : null}
          <Button variant="outline" size="sm" onClick={refetch} className="h-9 gap-2">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {!isMobile ? (
        <DashboardFiltersBar
          filters={filters}
          onFiltersChange={setFilters}
          sellers={sellers}
          liveEvents={liveEvents}
        />
      ) : null}

      <Tabs value={overviewTab} onValueChange={(value) => setOverviewTab(value as OverviewTab)} className="space-y-5">
        <TabsList className="h-9">
          <TabsTrigger value="executivo">Resumo Executivo</TabsTrigger>
          <TabsTrigger value="inteligencia">Inteligência</TabsTrigger>
        </TabsList>

        <TabsContent value="executivo" className="space-y-6">
          {executivePulse && intelligence ? (
            <DashboardExecutiveCommandCenter
              pulse={executivePulse}
              kpis={kpis}
              pendingActions={pendingActions}
              channelComparison={channelComparison}
              intelligence={intelligence}
              filters={filters}
              endDate={dateRange.endDate}
              onResolveNow={() => openActionCenter("pendencias")}
            />
          ) : null}

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Demais KPIs</h3>
            <DashboardKPICardsV2 kpis={kpis} onKPIClick={handleKPIClick} />
          </div>
        </TabsContent>

        <TabsContent value="inteligencia" className="space-y-5">
          {revenueCommand ? <RevenueCommand data={revenueCommand} /> : null}
          {intelligence ? <DashboardRetailPulse intelligence={intelligence} /> : null}
          {revenueCommand ? <RevenueCommandPriority data={revenueCommand} onOpenActionCenter={openActionCenter} /> : null}

          <div id="pending-actions">
            <DashboardPendingActions actions={pendingActions} />
          </div>

          <div className="border-t border-border/70 pt-3">
            <h3 className="text-sm font-semibold tracking-wide">Centro de Inteligência</h3>
          </div>

          {intelligence ? (
            <DashboardIntelligence intelligence={intelligence} onOpenActionCenter={openActionCenter} />
          ) : null}

          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">Inteligência Operacional</h3>
            <DashboardBICards />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-10">
            <div className="space-y-4 sm:space-y-6 lg:col-span-7">
              {channelComparison ? (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground sm:mb-3">Catálogo vs Live</h3>
                  <DashboardChannelComparison data={channelComparison} />
                </div>
              ) : null}

              <DashboardSellerPerformance sellers={sellerPerformance} />
            </div>

            <div className="space-y-4 sm:space-y-6 lg:col-span-3">
              <DashboardTopCustomers customers={topCustomers} />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <ActionCenter
        open={actionCenterOpen}
        onOpenChange={setActionCenterOpen}
        type={actionCenterType}
        filters={filters}
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
      />
    </div>
  );
}
