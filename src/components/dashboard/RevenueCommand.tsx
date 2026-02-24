import { useState } from "react";
import { ArrowUpRight, Brain, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RevenueCommandAction, RevenueCommandData } from "@/hooks/useDashboardDataV2";

interface RevenueCommandProps {
  data: RevenueCommandData;
}

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

function toComponentKey(tipo: string) {
  return tipo
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "");
}

export function RevenueCommand({ data }: RevenueCommandProps) {
  const [runningAction, setRunningAction] = useState<string | null>(null);

  const handleExecute = async (action: RevenueCommandAction) => {
    const actionKey = toComponentKey(action.tipo);
    setRunningAction(actionKey);

    const { error } = await supabase.rpc("log_dashboard_ai_feedback", {
      p_day: new Date().toISOString().slice(0, 10),
      p_insight_key: "revenue_command",
      p_component: actionKey,
      p_was_useful: null,
      p_action_taken: "execute_now",
      p_revenue_after_7d: null,
    });

    if (error) {
      console.error("[Revenue Command] feedback log error:", error);
    }

    setRunningAction(null);
  };

  return (
    <Card className="border-indigo-100 bg-gradient-to-br from-white to-indigo-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Brain className="h-4 w-4 text-indigo-600" />
          Revenue Command\u2122
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Inteligencia executiva baseada em dados reais da operacao.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="rounded-md border bg-white p-3 space-y-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Receita em espera</div>
            <div className="text-2xl font-bold">{formatCurrency(data.receita_latente)}</div>
            <p className="text-xs text-muted-foreground">Existe receita aguardando decisao.</p>
          </div>

          <div className="lg:col-span-2 rounded-md border bg-white p-3 space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Projecao 30 dias</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Ritmo atual</p>
                <p className="text-lg font-semibold">{formatCurrency(data.projecao_30d_base)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Com ajuste operacional</p>
                <p className="text-lg font-semibold">{formatCurrency(data.projecao_30d_otimizada)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Diferenca projetada</p>
                <p className="text-lg font-semibold text-emerald-600">
                  {formatCurrency(data.diferenca_projetada)}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Receita nao capturada nao e perda. E decisao adiada.
            </p>
          </div>
        </div>

        <div className="rounded-md border bg-white p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-semibold">Acao recomendada nas proximas 24h</h3>
          </div>

          <div className="space-y-2">
            {data.acoes_priorizadas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma acao priorizada no momento. Mantenha o ritmo operacional atual.
              </p>
            ) : (
              data.acoes_priorizadas.map((action, index) => (
                <div
                  key={`${action.tipo}-${index}`}
                  className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{index + 1}</Badge>
                      <p className="text-sm font-semibold">{action.tipo}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Impacto estimado: {formatCurrency(action.impacto_estimado)}
                    </p>
                    <p className="text-xs text-muted-foreground">{action.recomendacao}</p>
                  </div>

                  <Button
                    size="sm"
                    className="gap-2"
                    disabled={runningAction === toComponentKey(action.tipo)}
                    onClick={() => handleExecute(action)}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    Executar agora
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
