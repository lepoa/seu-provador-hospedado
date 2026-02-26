import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Brain, ShieldAlert, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardIntelligenceData } from "@/hooks/useDashboardDataV2";
import { actionCenterTypeFromText, type ActionCenterType } from "./ActionCenter";

interface DashboardIntelligenceProps {
  intelligence: DashboardIntelligenceData;
  onOpenActionCenter: (type: ActionCenterType) => void;
}

interface DashboardRetailPulseProps {
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
  strong: "Operação forte",
  stable: "Operação estável",
  attention: "Ponto de atenção",
  risk: "Risco operacional",
};

const classificationTone: Record<string, string> = {
  strong: "border-[#cfb986] bg-[#f5ecd8] text-[#6e5a30]",
  stable: "border-[#cfb986] bg-[#f5ecd8] text-[#6e5a30]",
  attention: "border-[#c2ab7a] bg-[#f8f0de] text-[#7a6336]",
  risk: "border-[#b99b63] bg-[#efe4cc] text-[#6b4f2b]",
};

const stabilityLabel: Record<string, string> = {
  stable: "Estável",
  oscillating: "Oscilante",
  unstable: "Instável",
};

const operationalLabel: Record<string, string> = {
  strong: "Forte",
  attention: "Atenção",
  critical: "Crítico",
};

const operationalTone: Record<string, string> = {
  strong: "border-[#cfb986] bg-[#f5ecd8] text-[#6e5a30]",
  attention: "border-[#c2ab7a] bg-[#f8f0de] text-[#7a6336]",
  critical: "border-[#b99b63] bg-[#efe4cc] text-[#6b4f2b]",
};

const briefingByComponent: Record<ComponentKey, BriefingTemplate> = {
  conversion: {
    title: "Conversão abaixo do esperado",
    cause: "Muitos pedidos reservados não estão virando pagos no período.",
    impact: "Reduz receita realizada e pressiona caixa do dia.",
    action: "Reforçar follow-up de pagamento e remover travas no checkout.",
  },
  ticket: {
    title: "Ticket médio com espaço de ganho",
    cause: "Pedidos pagos estão com valor abaixo da referência histórica.",
    impact: "Receita cresce mais devagar mesmo com volume constante.",
    action: "Aplicar sugestão de combinação e vitrine premium no atendimento.",
  },
  pa: {
    title: "Peças por atendimento em queda",
    cause: "Clientes estão fechando compra com poucas peças por pedido.",
    impact: "Margem e faturamento por cliente ficam comprimidos.",
    action: "Ativar oferta de segunda peça com argumento de uso completo.",
  },
  cancel: {
    title: "Cancelamento acima do saudável",
    cause: "Taxa de cancelamento saiu da faixa segura no período filtrado.",
    impact: "Pode reduzir receita e afetar confiança da operação.",
    action: "Revisar prazo prometido e confirmação ativa de pagamento.",
  },
  pendencias: {
    title: "Pendências operacionais elevadas",
    cause: "Há acumulado de pedidos aguardando ação operacional.",
    impact: "Atrasos aumentam risco de cancelamento e perda de experiência.",
    action: "Priorizar fila pendente por impacto e SLA de resposta.",
  },
  growth: {
    title: "Crescimento desacelerando",
    cause: "Receita atual perdeu ritmo versus período imediatamente anterior.",
    impact: "Menor previsibilidade para as próximas semanas.",
    action: "Executar campanha curta de recuperação com foco em base ativa.",
  },
  recorrencia: {
    title: "Recorrência abaixo da meta",
    cause: "Score de recorrência médio dos clientes está abaixo do ideal.",
    impact: "LTV reduz e custo de aquisição pesa mais no resultado.",
    action: "Disparar rotina RFV para janela preventiva e reativação.",
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
      text: `Pendências em ${health.raw.pending_rate.toFixed(1)}% dos pedidos`,
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

export function DashboardIntelligence({ intelligence, onOpenActionCenter }: DashboardIntelligenceProps) {
  const navigate = useNavigate();
  const alerts = useMemo(() => generateAlerts(intelligence), [intelligence]);
  const briefingCards = useMemo(() => generateBriefingCards(intelligence), [intelligence]);
  const [runningAction, setRunningAction] = useState<string | null>(null);

  const handleFeedbackAction = async (card: BriefingCard, action: FeedbackAction) => {
    const actionKey = `${card.component}:${action}`;
    setRunningAction(actionKey);

    if (action === "generate_rfv_task") {
      navigate("/dashboard/rfv");
    } else {
      onOpenActionCenter(actionCenterTypeFromText(card.component));
    }

    try {
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
    } catch (err) {
      console.error("[Dashboard Intelligence] feedback request failed:", err);
    } finally {
      setRunningAction(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-[#cfb98666]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-[#6d6556]">
            <AlertTriangle className="h-4 w-4 text-[#b18a40]" />
            Alertas estratégicos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-[#6d6556]">
              <ShieldAlert className="h-4 w-4 text-[#b18a40]" />
              Nenhum alerta crítico no momento
            </div>
          ) : (
            alerts.map((alert, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <span className={alert.level === "high" ? "text-[#7b5f2e]" : "text-[#a07a3d]"}>
                  {alert.level === "high" ? "!" : "-"}
                </span>
                <span>{alert.text}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-[#cfb98666]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-[#6d6556]">
            <Brain className="h-4 w-4 text-[#8a6e3a]" />
            Briefing Inteligente
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {briefingCards.map((card) => (
            <div key={card.insightKey} className="space-y-2 rounded-md border border-[#cfb98666] p-3">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold text-[#102820]">{card.title}</h4>
                <Badge variant="outline" className="text-xs">
                  {card.score.toFixed(0)}/100
                </Badge>
              </div>
              <p className="text-xs text-[#6d6556]">
                <strong>Causa detectada:</strong> {card.cause}
              </p>
              <p className="text-xs text-[#6d6556]">
                <strong>Impacto estimado:</strong> {card.impact}
              </p>
              <p className="text-xs text-[#6d6556]">
                <strong>Ação recomendada:</strong> {card.action}
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

export function DashboardRetailPulse({ intelligence }: DashboardRetailPulseProps) {
  const { health, projection, operational } = intelligence;
  const trendPositive = health.trend >= 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="border-[#cfb98666] shadow-sm lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-[#6d6556]">
            <Brain className="h-4 w-4 text-[#8a6e3a]" />
            Retail Pulse
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div className="text-3xl font-bold text-[#102820]">{Math.round(health.score)} / 100</div>
            <Badge variant="outline" className={classificationTone[health.classification]}>
              {classificationLabel[health.classification]}
            </Badge>
          </div>

          <div className="flex items-center gap-1 text-sm text-[#6d6556]">
            {trendPositive ? <TrendingUp className="h-4 w-4 text-[#b18a40]" /> : <TrendingDown className="h-4 w-4 text-[#7b5f2e]" />}
            Tendência: {trendPositive ? "+" : ""}
            {health.trend.toFixed(1)} vs média 7 dias
          </div>

          <div className="text-xs text-[#6d6556]">
            Volatilidade 7d: {health.volatility_index.toFixed(1)} ({stabilityLabel[health.stability_classification]})
          </div>

          <div className="rounded-md border border-[#cfb98666] bg-[#f8f2e4] px-3 py-2">
            <div className="text-xs text-[#6d6556]">Operação hoje</div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-[#102820]">{Math.round(operational.score)} / 100</div>
              <Badge variant="outline" className={operationalTone[operational.classification]}>
                {operationalLabel[operational.classification]}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#cfb98666] shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-[#6d6556]">
            <Sparkles className="h-4 w-4 text-[#8a6e3a]" />
            Projeção próximos 7 dias
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-3xl font-bold text-[#102820]">{formatCurrency(projection.projected_7d_revenue)}</div>
          <div className="text-xs text-[#6d6556]">Média diária: {formatCurrency(projection.average_daily_7d)}</div>
          <div className="text-xs text-[#6d6556]">Impacto RFV pendente: {formatCurrency(projection.rfv_pending_impact_7d)}</div>
        </CardContent>
      </Card>
    </div>
  );
}
