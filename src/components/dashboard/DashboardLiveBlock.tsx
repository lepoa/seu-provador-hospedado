import { useNavigate } from "react-router-dom";
import { 
  Radio, 
  Eye, 
  FileText, 
  AlertCircle,
  ShoppingBag,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { DashboardKPIs } from "@/hooks/useDashboardData";

interface DashboardLiveBlockProps {
  kpis: DashboardKPIs;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export function DashboardLiveBlock({ kpis }: DashboardLiveBlockProps) {
  const navigate = useNavigate();

  const taxaConversao = kpis.totalReservadoLive > 0 
    ? (kpis.totalPagoLive / kpis.totalReservadoLive) * 100 
    : 0;

  const hasLive = !!kpis.ultimaLiveId;

  return (
    <Card className={hasLive ? "cursor-pointer hover:shadow-md transition-all" : ""}>
      <CardHeader 
        className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg"
        onClick={() => hasLive && navigate(`/dashboard/lives/${kpis.ultimaLiveId}/backstage`)}
      >
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Radio className="h-4 w-4 text-rose-500" />
          Live Shop
          {kpis.liveAtiva && (
            <Badge variant="destructive" className="animate-pulse ml-2">
              🔴 AO VIVO
            </Badge>
          )}
          {hasLive && (
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo da Última Live - Clickable */}
        <div 
          className={`bg-muted/30 rounded-lg p-4 space-y-3 ${hasLive ? "hover:bg-muted/50 cursor-pointer transition-colors" : ""}`}
          onClick={() => hasLive && navigate(`/dashboard/lives/${kpis.ultimaLiveId}/relatorio`)}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Última Live</span>
            <span className="text-sm font-medium flex items-center gap-1">
              {kpis.ultimaLiveTitulo || "—"}
              {hasLive && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Reservado</p>
              <p className="text-lg font-bold text-orange-600">
                {formatCurrency(kpis.totalReservadoLive)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Pago</p>
              <p className="text-lg font-bold text-green-600">
                {formatCurrency(kpis.totalPagoLive)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Conversão</p>
              <p className={`text-lg font-bold ${taxaConversao >= 70 ? "text-green-600" : taxaConversao >= 40 ? "text-amber-600" : "text-red-600"}`}>
                {taxaConversao.toFixed(0)}%
              </p>
            </div>
          </div>

          {/* Progress bar with color coding */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progresso de Pagamento</span>
              <span className={`font-medium ${taxaConversao >= 70 ? "text-green-600" : taxaConversao >= 40 ? "text-amber-600" : "text-red-600"}`}>
                {taxaConversao.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={taxaConversao} 
              className="h-2"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {hasLive && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={() => navigate(`/dashboard/lives/${kpis.ultimaLiveId}/backstage`)}
              >
                <Eye className="h-4 w-4" />
                Backstage
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={() => navigate(`/dashboard/lives/${kpis.ultimaLiveId}/relatorio`)}
              >
                <FileText className="h-4 w-4" />
                Relatório
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-colors"
                onClick={() => navigate(`/dashboard/lives/${kpis.ultimaLiveId}/backstage?tab=pendentes`)}
              >
                <AlertCircle className="h-4 w-4" />
                Pendências
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-colors"
                onClick={() => navigate(`/dashboard?tab=orders&liveId=${kpis.ultimaLiveId}`)}
              >
                <ShoppingBag className="h-4 w-4" />
                Pedidos Live
              </Button>
            </>
          )}
        </div>

        {!hasLive && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Nenhuma live recente</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => navigate("/lives")}
            >
              Criar Nova Live
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
