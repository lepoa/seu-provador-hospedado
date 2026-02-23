import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import type { RFVSummary } from "@/hooks/useRFVData";

interface Props {
  summary: RFVSummary;
}

export function RFVKPICards({ summary }: Props) {
  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const kpis = [
    {
      label: "Clientes criticos hoje",
      value: summary.criticalToday.toString(),
      icon: AlertTriangle,
      color: "from-red-500 to-rose-600",
      detail: "reativacao imediata",
    },
    {
      label: "Janela ideal hoje",
      value: summary.idealWindowToday.toString(),
      icon: CalendarClock,
      color: "from-blue-500 to-indigo-600",
      detail: "clientes no timing certo",
    },
    {
      label: "Pos-vendas do dia",
      value: summary.postSalesToday.toString(),
      icon: Clock,
      color: "from-amber-500 to-orange-600",
      detail: "follow-up D+3",
    },
    {
      label: "Receita potencial 7 dias",
      value: formatCurrency(summary.potentialRevenue7d),
      icon: Banknote,
      color: "from-emerald-500 to-teal-600",
      detail: "impacto estimado",
    },
    {
      label: "Tarefas em aberto",
      value: summary.pendingTasks.toString(),
      icon: Zap,
      color: "from-purple-500 to-violet-600",
      detail: `${summary.tasksByPriority.critical || 0} criticas`,
    },
    {
      label: "Taxa de execucao",
      value: `${summary.executionRate.toFixed(0)}%`,
      icon: CheckCircle2,
      color: "from-cyan-500 to-blue-600",
      detail: "ultimos 30 dias",
    },
    {
      label: "Taxa de conversao",
      value: `${summary.conversionRate.toFixed(0)}%`,
      icon: TrendingUp,
      color: "from-pink-500 to-rose-600",
      detail: "tarefas -> venda",
    },
    {
      label: "Clientes analisados",
      value: summary.totalCustomers.toString(),
      icon: Users,
      color: "from-slate-500 to-gray-700",
      detail: "base RFV ativa",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg bg-gradient-to-br ${kpi.color}`}>
                <kpi.icon className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
            </div>
            <div className="text-xl font-bold">{kpi.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{kpi.detail}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

