import { useState } from "react";
import { Loader2, RefreshCw, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardDataV2, DashboardFilters } from "@/hooks/useDashboardDataV2";
import { DashboardFiltersBar } from "./DashboardFilters";
import { DashboardMobileFilters } from "./DashboardMobileFilters";
import { DashboardKPICardsV2 } from "./DashboardKPICardsV2";
import { RevenueCommand } from "./RevenueCommand";
import { DashboardIntelligence } from "./DashboardIntelligence";
import { DashboardChannelComparison } from "./DashboardChannelComparison";
import { DashboardSellerPerformance } from "./DashboardSellerPerformance";
import { DashboardPendingActions } from "./DashboardPendingActions";
import { DashboardTopCustomers } from "./DashboardTopCustomers";
import { DashboardBICards } from "./DashboardBICards";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { dashboardNavigation } from "@/lib/dashboardNavigation";

export function DashboardOverviewV2() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState<DashboardFilters>({
    period: "7days",
    channel: "all",
    liveEventId: null,
    sellerId: null,
  });

  const {
    kpis,
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
  } = useDashboardDataV2(filters);

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
        navigate(dashboardNavigation.pendencias());
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
  
  // Handle seller click from performance table
  const handleSellerClick = (sellerId: string) => {
    navigate(dashboardNavigation.sellerOrders(sellerId));
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
      <div className="text-center py-20">
        <p className="text-muted-foreground">Erro ao carregar dados</p>
        <Button onClick={refetch} variant="outline" className="mt-4">
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold truncate">Visão Geral</h2>
          <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
            Dados consolidados do seu negócio
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile Filters */}
          {isMobile ? (
            <DashboardMobileFilters
              filters={filters}
              onFiltersChange={setFilters}
              sellers={sellers}
              liveEvents={liveEvents}
            />
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            className="gap-2 h-9"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Desktop Filters */}
      {!isMobile && (
        <DashboardFiltersBar
          filters={filters}
          onFiltersChange={setFilters}
          sellers={sellers}
          liveEvents={liveEvents}
        />
      )}

      {/* KPI Cards */}
      {revenueCommand && <RevenueCommand data={revenueCommand} />}
      {intelligence && <DashboardIntelligence intelligence={intelligence} />}
      <DashboardKPICardsV2 kpis={kpis} onKPIClick={handleKPIClick} />

      {/* BI Intelligence Cards */}
      <div className="mt-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Inteligência Operacional</h3>
        <DashboardBICards />
      </div>

      {/* Main Grid: Stack on mobile, 70/30 on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 sm:gap-6">
        {/* Left Column (70%) */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-6">
          {/* Channel Comparison */}
          {channelComparison && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2 sm:mb-3">Catálogo vs Live</h3>
              <DashboardChannelComparison data={channelComparison} />
            </div>
          )}

          {/* Seller Performance */}
          <DashboardSellerPerformance sellers={sellerPerformance} />
        </div>

        {/* Right Column (30%) */}
        <div className="lg:col-span-3 space-y-4 sm:space-y-6">
          {/* Pending Actions */}
          <div id="pending-actions">
            <DashboardPendingActions actions={pendingActions} />
          </div>

          {/* Top Customers */}
          <DashboardTopCustomers customers={topCustomers} />
        </div>
      </div>
    </div>
  );
}
