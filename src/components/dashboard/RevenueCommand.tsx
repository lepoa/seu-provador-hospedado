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
  return collapsedEscapes.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
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
    <Card className="mb-10 border-[#cfb98666] bg-white shadow-sm">
      <CardHeader className="pb-6 pt-7">
        <CardTitle className="flex items-center gap-2 text-3xl font-semibold tracking-tight text-[#102820] sm:text-4xl">
          <Brain className="h-6 w-6 text-[#b18a40]" />
          Revenue Command
        </CardTitle>
        <p className="text-sm text-[#6d6556]">Inteligência executiva baseada em dados reais da operação.</p>
      </CardHeader>

      <CardContent className="space-y-5 pb-7">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-2 rounded-xl border border-[#cfb98666] bg-[#faf4e7] p-6">
            <div className="text-xs uppercase tracking-wide text-[#6d6556]">Receita em espera</div>
            <div className="text-5xl font-bold tracking-tight text-[#102820] md:text-6xl">
              {formatCurrency(data.receita_latente)}
            </div>
            <p className="text-sm text-[#6d6556]">Existe receita aguardando decisão.</p>
          </div>

          <div className="space-y-3 rounded-xl border border-[#cfb98666] bg-white p-6 lg:col-span-2">
            <div className="text-xs uppercase tracking-wide text-[#6d6556]">Projeção 30 dias</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-[#6d6556]">Ritmo atual</p>
                <p className="text-lg font-semibold text-[#102820] md:text-xl">{formatCurrency(data.projecao_30d_base)}</p>
              </div>
              <div>
                <p className="text-xs text-[#6d6556]">Com ajuste operacional</p>
                <p className="text-lg font-semibold text-[#102820] md:text-xl">{formatCurrency(data.projecao_30d_otimizada)}</p>
              </div>
              <div>
                <p className="text-xs text-[#6d6556]">Diferença projetada</p>
                <p className="text-lg font-semibold text-[#b18a40] md:text-xl">{formatCurrency(data.diferenca_projetada)}</p>
              </div>
            </div>
            <p className="text-xs text-[#6d6556]">Receita não capturada não é perda. É decisão adiada.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RevenueCommandPriority({ data, onOpenActionCenter }: RevenueCommandPriorityProps) {
  const { runningAction, handleExecute } = useRevenueCommandActions(onOpenActionCenter);

  return (
    <Card className="border-[#cfb98666] bg-[#f8f2e4] shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-xl font-semibold text-[#102820]">
          <Sparkles className="h-5 w-5 text-[#b18a40]" />
          Prioridade de hoje
        </CardTitle>
        <p className="text-xs text-[#6d6556]">3 ações com maior impacto estimado para as próximas 24h.</p>
      </CardHeader>

      <CardContent>
        <div className="space-y-3 rounded-lg border border-[#cfb98666] bg-white p-6">
          {data.acoes_priorizadas.length === 0 ? (
            <p className="text-sm text-[#6d6556]">Nenhuma ação priorizada no momento. Mantenha o ritmo operacional atual.</p>
          ) : (
            data.acoes_priorizadas.slice(0, 3).map((action, index) => (
              <div
                key={`${action.tipo}-${index}`}
                className="flex flex-col gap-3 rounded-md border border-[#cfb98666] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{index + 1}</Badge>
                    <p className="truncate text-sm font-semibold text-[#102820]">{sanitizeLabel(action.tipo)}</p>
                  </div>
                  <p className="text-xs text-[#6d6556]">{sanitizeLabel(action.recomendacao)}</p>
                </div>

                <div className="flex flex-col items-end gap-2 sm:min-w-[220px]">
                  <p className="text-xs text-[#6d6556]">
                    Impacto estimado <span className="font-semibold text-[#102820]">{formatCurrency(action.impacto_estimado)}</span>
                  </p>
                  <Button
                    size="lg"
                    className="relative z-10 h-11 min-w-[180px] cursor-pointer gap-2 border border-[#b18a40] bg-[#102820] text-[#f3e5c1] hover:bg-[#123129]"
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
            <Button type="button" variant="link" className="h-auto px-0 text-sm" onClick={() => onOpenActionCenter("conversao")}>
              Ver todas
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
