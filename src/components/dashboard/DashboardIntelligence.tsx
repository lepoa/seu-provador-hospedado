import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Brain,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardIntelligenceData } from "@/hooks/useDashboardDataV2";

interface DashboardIntelligenceProps {
  intelligence: DashboardIntelligenceData;
}

type AlertLevel = "high" | "medium";
type ComponentKey = keyof DashboardIntelligenceData["health"]["components"];
type FeedbackAction = "generate_rfv_task" | "export_impacted_list" | "marked_reviewed";

interface StrategicAlert {
  level: AlertLevel;
  text: string;
}

interface BriefingTemplate {
  title: string;
  cause: string;
  impact: string;
  action: string;
}

interface BriefingCard extends BriefingTemplate {
  component: ComponentKey;
  score: number;
  insightKey: string;
}

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const classificationLabel: Record<string, string> = {
  strong: "Operacao Forte",
  stable: "Operacao Estavel",
  attention: "Ponto de Atencao",
  risk: "Risco Operacional",
};

const classificationTone: Record<string, string> = {
  strong: "bg-green-100 text-green-700 border-green-200",
  stable: "bg-blue-100 text-blue-700 border-blue-200",
  attention: "bg-amber-100 text-amber-700 border-amber-200",
  risk: "bg-red-100 text-red-700 border-red-200",
};

const stabilityLabel: Record<string, string> = {
  stable: "Estavel",
  oscillating: "Oscilante",
  unstable: "Instavel",
};

const operationalLabel: Record<string, string> = {
  strong: "Forte",
  attention: "Atencao",
  critical: "Critico",
};

const operationalTone: Record<string, string> = {
  strong: "bg-green-100 text-green-700 border-green-200",
  attention: "bg-amber-100 text-amber-700 border-amber-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

const briefingByComponent: Record<ComponentKey, BriefingTemplate> = {
  conversion: {
    title: "Conversao abaixo do esperado",
    cause: "Muitos pedidos reservados nao estao virando pago no periodo.",
    impact: "Reduz receita realizada e pressiona caixa do dia.",
    action: "Reforcar follow-up de pagamento e remover travas no checkout.",
  },
  ticket: {
    title: "Ticket medio com espaco de ganho",
    cause: "Pedidos pagos estao com valor abaixo da referencia historica.",
    impact: "Receita cresce mais devagar mesmo com volume constante.",
    action: "Aplicar sugestao de combinacao e vitrine premium no atendimento.",
  },
  pa: {
    title: "Pecas por atendimento em queda",
    cause: "Clientes estao fechando compra com poucas pecas por pedido.",
    impact: "Margem e faturamento por cliente ficam comprimidos.",
    action: "Ativar oferta de segunda peca com argumento de uso completo.",
  },
  cancel: {
    title: "Cancelamento acima do saudavel",
    cause: "Taxa de cancelamento saiu da faixa segura no periodo filtrado.",
    impact: "Pode reduzir receita e afetar confianca da operacao.",
    action: "Revisar prazo prometido e confirmacao ativa de pagamento.",
  },
  pendencias: {
    title: "Pendencias operacionais elevadas",
    cause: "Ha acumulado de pedidos aguardando acao operacional.",
    impact: "Atrasos aumentam risco de cancelamento e perda de experiencia.",
    action: "Priorizar fila pendente por impacto e SLA de resposta.",
  },
  growth: {
    title: "Crescimento desacelerando",
    cause: "Receita atual perdeu ritmo versus periodo imediatamente anterior.",
    impact: "Menor previsibilidade para as proximas semanas.",
    action: "Executar campanha curta de recuperacao com foco em base ativa.",
  },
  recorrencia: {
    title: "Recorrencia abaixo da meta",
    cause: "Score de recorrencia medio dos clientes esta abaixo do ideal.",
    impact: "LTV reduz e custo de aquisicao pesa mais no resultado.",
    action: "Disparar rotina RFV para janela preventiva e reativacao.",
  },
};

function generateAlerts(intelligence: DashboardIntelligenceData): StrategicAlert[] {
  const { health } = intelligence;
  const alerts: StrategicAlert[] = [];

  if (health.raw.cancel_percent > 15) {
    alerts.push({
      level: "high",
      text: `Cancelamento em ${health.raw.cancel_percent.toFixed(1)}% (acima de 15%)`,
    });
  }
  if (health.raw.pa_value < 1.2) {
    alerts.push({
      level: "medium",
      text: `P.A. em ${health.raw.pa_value.toFixed(2)} (abaixo de 1.20)`,
    });
  }
  if (health.raw.pending_rate > 20) {
    alerts.push({
      level: "medium",
      text: `Pendencias em ${health.raw.pending_rate.toFixed(1)}% dos pedidos`,
    });
  }
  if (health.stability_classification === "unstable") {
    alerts.push({
      level: "medium",
      text: `Volatilidade alta (${health.volatility_index.toFixed(1)} pontos/dia)`,
    });
  }

  return alerts.slice(0, 4);
}

function generateBriefingCards(intelligence: DashboardIntelligenceData): BriefingCard[] {
  const sorted = (Object.entries(intelligence.health.components) as Array<[ComponentKey, number]>).sort(
    (a, b) => a[1] - b[1]
  );

  return sorted.slice(0, 2).map(([component, score]) => ({
    ...briefingByComponent[component],
    component,
    score,
    insightKey: `briefing_${component}`,
  }));
}

export function DashboardIntelligence({ intelligence }: DashboardIntelligenceProps) {
  const { health, projection, operational } = intelligence;
  const trendPositive = health.trend >= 0;
  const alerts = useMemo(() => generateAlerts(intelligence), [intelligence]);
  const briefingCards = useMemo(() => generateBriefingCards(intelligence), [intelligence]);
  const [runningAction, setRunningAction] = useState<string | null>(null);

  const handleFeedbackAction = async (card: BriefingCard, action: FeedbackAction) => {
    const actionKey = `${card.component}:${action}`;
    setRunningAction(actionKey);

    const { error } = await supabase.rpc("log_dashboard_ai_feedback", {
      p_day: new Date().toISOString().slice(0, 10),
      p_insight_key: card.insightKey,
      p_component: card.component,
      p_was_useful: action === "marked_reviewed" ? true : null,
      p_action_taken: action,
      p_revenue_after_7d: null,
    });

    if (error) {
      console.error("[Dashboard Intelligence] feedback log error:", error);
    }

    setRunningAction(null);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-purple-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-600" />
                Retail Pulse™
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div className="text-3xl font-bold">{Math.round(health.score)} / 100</div>
                <Badge variant="outline" className={classificationTone[health.classification]}>
                  {classificationLabel[health.classification]}
                </Badge>
              </div>

              <div className="text-sm text-muted-foreground flex items-center gap-1">
                {trendPositive ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                Tendencia: {trendPositive ? "+" : ""}
                {health.trend.toFixed(1)} vs media 7 dias
              </div>

              <div className="text-xs text-muted-foreground">
                Volatilidade 7d: {health.volatility_index.toFixed(1)} ({stabilityLabel[health.stability_classification]})
              </div>

              <div className="rounded-md border bg-slate-50 px-3 py-2">
                <div className="text-xs text-muted-foreground">Operacao Hoje</div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <div className="text-lg font-semibold">{Math.round(operational.score)} / 100</div>
                  <Badge variant="outline" className={operationalTone[operational.classification]}>
                    {operationalLabel[operational.classification]}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                Projecao proximos 7 dias
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-bold">{formatCurrency(projection.projected_7d_revenue)}</div>
              <div className="text-xs text-muted-foreground">
                Media diaria: {formatCurrency(projection.average_daily_7d)}
              </div>
              <div className="text-xs text-muted-foreground">
                Impacto RFV pendente: {formatCurrency(projection.rfv_pending_impact_7d)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-amber-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Alertas Estrategicos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.length === 0 ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-green-600" />
                Nenhum alerta critico no momento
              </div>
            ) : (
              alerts.map((alert, index) => (
                <div key={index} className="text-sm flex items-start gap-2">
                  <span className={alert.level === "high" ? "text-red-600" : "text-amber-600"}>
                    {alert.level === "high" ? "!" : "-"}
                  </span>
                  <span>{alert.text}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <Brain className="h-4 w-4 text-slate-600" />
            Briefing Inteligente
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {briefingCards.map((card) => (
            <div key={card.insightKey} className="rounded-md border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-800">{card.title}</h4>
                <Badge variant="outline" className="text-xs">
                  {card.score.toFixed(0)}/100
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>Causa detectada:</strong> {card.cause}
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Impacto estimado:</strong> {card.impact}
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Acao recomendada:</strong> {card.action}
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={runningAction === `${card.component}:generate_rfv_task`}
                  onClick={() => handleFeedbackAction(card, "generate_rfv_task")}
                >
                  Gerar tarefa RFV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={runningAction === `${card.component}:export_impacted_list`}
                  onClick={() => handleFeedbackAction(card, "export_impacted_list")}
                >
                  Exportar lista impactada
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={runningAction === `${card.component}:marked_reviewed`}
                  onClick={() => handleFeedbackAction(card, "marked_reviewed")}
                >
                  Marcar como revisado
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
