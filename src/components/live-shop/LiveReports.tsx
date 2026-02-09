import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Calendar, Radio, FileText, Download, Package, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiveReports } from "@/hooks/useLiveReports";
import { LiveReportKpiCards } from "./LiveReportKpiCards";
import { LiveReportTopProducts } from "./LiveReportTopProducts";
import { LiveReportCustomerSales } from "./LiveReportCustomerSales";
import { LiveReportSalesChart } from "./LiveReportSalesChart";

export function LiveReports() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { event, kpis, topProducts, customerSales, timelineData, isLoading, refetch } = useLiveReports(eventId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
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
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Live não encontrada</h2>
          <p className="text-muted-foreground mb-4">O evento solicitado não existe.</p>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const statusLabels: Record<string, { label: string; color: string }> = {
    "planejada": { label: "Planejada", color: "bg-blue-100 text-blue-700" },
    "ao_vivo": { label: "Ao Vivo", color: "bg-red-100 text-red-700" },
    "encerrada": { label: "Encerrada", color: "bg-muted text-muted-foreground" },
    "arquivada": { label: "Arquivada", color: "bg-secondary text-secondary-foreground" },
  };

  const status = statusLabels[event.status] || statusLabels.encerrada;

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
                <h1 className="text-lg font-semibold">{event.titulo}</h1>
                <Badge className={status.color}>{status.label}</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(event.data_hora_inicio), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                {event.data_hora_fim && (
                  <> — {format(new Date(event.data_hora_fim), "HH:mm", { locale: ptBR })}</>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              onClick={() => navigate(`/dashboard/lives/${event.id}/pedidos`)}
            >
              <Package className="h-4 w-4 mr-2" />
              Pedidos
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate(`/dashboard/lives/${event.id}/separacao`)}
            >
              <Scissors className="h-4 w-4 mr-2" />
              Separação
            </Button>
            {event.status === "encerrada" && (
              <Button 
                variant="outline"
                onClick={() => navigate(`/dashboard/lives/${event.id}/backstage`)}
              >
                <Radio className="h-4 w-4 mr-2" />
                Backstage
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* KPIs */}
        {kpis && <LiveReportKpiCards kpis={kpis} />}

        {/* Sales Evolution Chart */}
        <LiveReportSalesChart data={timelineData} />

        {/* Charts & Tables */}
        <div className="grid md:grid-cols-2 gap-6">
          <LiveReportTopProducts products={topProducts} />
          <LiveReportCustomerSales sales={customerSales} onRefresh={refetch} />
        </div>

        {/* Summary Section */}
        {kpis && kpis.totalReservado > 0 && (
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl p-6">
            <h3 className="font-semibold text-lg mb-3">Resumo da Live</h3>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Reservado:</span>
                <div className="font-bold text-lg">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(kpis.totalReservado)}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Total Pago:</span>
                <div className="font-bold text-lg text-green-600">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(kpis.totalPago)}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Itens Reservados:</span>
                <div className="font-bold text-lg">{kpis.totalItensReservados} unidades</div>
              </div>
              <div>
                <span className="text-muted-foreground">Taxa de Pagamento:</span>
                <div className="font-bold text-lg">{kpis.taxaPagamento.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
