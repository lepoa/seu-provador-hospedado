import { AlertTriangle, Brain, Sparkles, TrendingUp, TrendingDown, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardIntelligenceData } from "@/hooks/useDashboardDataV2";

interface DashboardIntelligenceProps {
  intelligence: DashboardIntelligenceData;
}

type AlertLevel = "high" | "medium";

interface StrategicAlert {
  level: AlertLevel;
  text: string;
}

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const classificationLabel: Record<string, string> = {
  strong: "Operação Forte",
  stable: "Operação Estável",
  attention: "Ponto de Atenção",
  risk: "Risco Operacional",
};

const classificationTone: Record<string, string> = {
  strong: "bg-green-100 text-green-700 border-green-200",
  stable: "bg-blue-100 text-blue-700 border-blue-200",
  attention: "bg-amber-100 text-amber-700 border-amber-200",
  risk: "bg-red-100 text-red-700 border-red-200",
};

function generateInsight(intelligence: DashboardIntelligenceData): string[] {
  const { health } = intelligence;
  const phrases: string[] = [];

  if (health.raw.pa_value < 1.2 && health.components.conversion > 80) {
    phrases.push("Conversão forte, mas P.A. abaixo do ideal. Incentive 2a peça por atendimento.");
  }
  if (health.raw.cancel_percent > 15) {
    phrases.push("Cancelamento acima do saudável. Revise promessa de prazo e confirmação de pagamento.");
  }
  if (health.raw.growth_percent < 0) {
    phrases.push("Crescimento negativo no período. Priorize recuperação de receita nas próximas 48h.");
  }
  if (health.raw.pending_rate > 20 || health.raw.pending_orders >= 8) {
    phrases.push("Pendências operacionais elevadas podem impactar experiência e conversão final.");
  }
  if (health.components.recorrencia < 60) {
    phrases.push("Recorrência abaixo do esperado. Ative rotina de recontato para clientes em janela ideal.");
  }

  if (phrases.length === 0) {
    phrases.push("Indicadores estáveis. Mantenha execução e foco em aumento de ticket e recorrência.");
  }

  return phrases.slice(0, 4);
}

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
  if (health.components.conversion < 60) {
    alerts.push({
      level: "medium",
      text: `Eficiência de conversão baixa (${health.raw.conversion_percent.toFixed(1)}%)`,
    });
  }

  return alerts.slice(0, 4);
}

export function DashboardIntelligence({ intelligence }: DashboardIntelligenceProps) {
  const { health, projection } = intelligence;
  const trendPositive = health.trend >= 0;
  const insights = generateInsight(intelligence);
  const alerts = generateAlerts(intelligence);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-purple-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-600" />
                Business Health Score
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-end justify-between">
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
                Tendência: {trendPositive ? "+" : ""}
                {health.trend.toFixed(1)} vs média 7 dias
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                Projeção próximos 7 dias
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-bold">{formatCurrency(projection.projected_7d_revenue)}</div>
              <div className="text-xs text-muted-foreground">
                Média diária: {formatCurrency(projection.average_daily_7d)}
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
              Alertas Estratégicos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.length === 0 ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-green-600" />
                Nenhum alerta crítico no momento
              </div>
            ) : (
              alerts.map((alert, index) => (
                <div key={index} className="text-sm flex items-start gap-2">
                  <span className={alert.level === "high" ? "text-red-600" : "text-amber-600"}>
                    {alert.level === "high" ? "🔴" : "🔶"}
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
            Insight do Dia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {insights.map((line, index) => (
            <p key={index} className="text-sm leading-relaxed text-slate-700">
              {line}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
