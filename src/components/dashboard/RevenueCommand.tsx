import { useState } from "react";
import { ArrowUpRight, Brain, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RevenueCommandAction, RevenueCommandData } from "@/hooks/useDashboardDataV2";
import { actionCenterTypeFromText, type ActionCenterType } from "./ActionCenter";

interface RevenueCommandProps {
  data: RevenueCommandData;
}

interface RevenueCommandPriorityProps {
  data: RevenueCommandData;
  onOpenActionCenter: (type: ActionCenterType) => void;
}

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const sanitizeLabel = (value: string) => {
  if (!value) return "";
  const collapsedEscapes = value.replace(/\\\\u/g, "\\u");
  return collapsedEscapes.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
};

function toComponentKey(tipo: string) {
  return tipo
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "");
}

function useRevenueCommandActions(onOpenActionCenter: (type: ActionCenterType) => void) {
  const [runningAction, setRunningAction] = useState<string | null>(null);

  const handleExecute = async (action: RevenueCommandAction) => {
    const normalizedType = sanitizeLabel(action.tipo);
    const actionKey = toComponentKey(normalizedType);
    const actionType = actionCenterTypeFromText(normalizedType);
    onOpenActionCenter(actionType);
    setRunningAction(actionKey);

    try {
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
    } catch (err) {
      console.error("[Revenue Command] feedback request failed:", err);
    } finally {
      setRunningAction(null);
    }
  };

  return { runningAction, handleExecute };
}

export function RevenueCommand({ data }: RevenueCommandProps) {
  return (
    <Card className="mb-8 border-indigo-200 bg-gradient-to-br from-white via-indigo-50/50 to-indigo-100/60 shadow-md">
      <CardHeader className="pb-5">
        <CardTitle className="text-2xl font-semibold flex items-center gap-2">
          <Brain className="h-5 w-5 text-indigo-700" />
          Revenue Command™
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Inteligência executiva baseada em dados reais da operação.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-lg border bg-white p-5 space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Receita em espera</div>
            <div className="text-5xl md:text-6xl font-bold tracking-tight text-indigo-900">
              {formatCurrency(data.receita_latente)}
            </div>
            <p className="text-sm text-muted-foreground/80">Existe receita aguardando decisão.</p>
          </div>

          <div className="lg:col-span-2 rounded-lg border bg-white p-5 space-y-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Projeção 30 dias</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Ritmo atual</p>
                <p className="text-lg md:text-xl font-semibold">{formatCurrency(data.projecao_30d_base)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Com ajuste operacional</p>
                <p className="text-lg md:text-xl font-semibold">{formatCurrency(data.projecao_30d_otimizada)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Diferença projetada</p>
                <p className="text-lg md:text-xl font-semibold text-emerald-600">
                  {formatCurrency(data.diferenca_projetada)}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground/80">
              Receita não capturada não é perda. É decisão adiada.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RevenueCommandPriority({ data, onOpenActionCenter }: RevenueCommandPriorityProps) {
  const { runningAction, handleExecute } = useRevenueCommandActions(onOpenActionCenter);

  return (
    <Card className="border-indigo-300 bg-gradient-to-br from-indigo-50/80 to-violet-50/70 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-700" />
          Prioridade de hoje
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          3 ações com maior impacto estimado para as próximas 24h.
        </p>
      </CardHeader>

      <CardContent>
        <div className="rounded-lg border bg-white p-6 space-y-3">
          {data.acoes_priorizadas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma ação priorizada no momento. Mantenha o ritmo operacional atual.
            </p>
          ) : (
            data.acoes_priorizadas.slice(0, 3).map((action, index) => (
              <div
                key={`${action.tipo}-${index}`}
                className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{index + 1}</Badge>
                    <p className="text-sm font-semibold truncate">{sanitizeLabel(action.tipo)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{sanitizeLabel(action.recomendacao)}</p>
                </div>

                <div className="flex flex-col items-end gap-2 sm:min-w-[220px]">
                  <p className="text-xs text-muted-foreground">
                    Impacto estimado <span className="font-semibold text-foreground">{formatCurrency(action.impacto_estimado)}</span>
                  </p>
                  <Button
                    size="lg"
                    className="gap-2 min-w-[180px] h-11 relative z-10 pointer-events-auto cursor-pointer"
                    disabled={runningAction === toComponentKey(action.tipo)}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleExecute(action);
                    }}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    Executar agora
                  </Button>
                </div>
              </div>
            ))
          )}
          {data.acoes_priorizadas.length > 3 ? (
            <Button
              type="button"
              variant="link"
              className="px-0 h-auto text-sm"
              onClick={() => onOpenActionCenter("conversao")}
            >
              Ver todas
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
