import { Card, CardContent } from "@/components/ui/card";
import { Users, Target, TrendingUp, ArrowUpRight, Clock, Percent, Banknote, BarChart3 } from "lucide-react";
import type { RFVSummary } from "@/hooks/useRFVData";

interface Props {
    summary: RFVSummary;
}

export function RFVKPICards({ summary }: Props) {
    const formatCurrency = (v: number) =>
        v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const kpis = [
        {
            label: "Clientes Analisados",
            value: summary.totalCustomers.toString(),
            icon: Users,
            color: "from-purple-500 to-purple-600",
            detail: `${summary.channelDistribution.hybrid || 0} híbridos`,
        },
        {
            label: "Tarefas Pendentes",
            value: summary.pendingTasks.toString(),
            icon: Target,
            color: "from-red-500 to-orange-500",
            detail: `${summary.tasksByPriority.critico || 0} críticas`,
        },
        {
            label: "Taxa de Execução",
            value: `${summary.executionRate.toFixed(0)}%`,
            icon: Percent,
            color: "from-emerald-500 to-teal-500",
            detail: "últimos 30 dias",
        },
        {
            label: "Taxa de Conversão",
            value: `${summary.conversionRate.toFixed(0)}%`,
            icon: ArrowUpRight,
            color: "from-blue-500 to-indigo-500",
            detail: "últimos 30 dias",
        },
        {
            label: "Ticket Médio",
            value: formatCurrency(summary.avgTicket),
            icon: TrendingUp,
            color: "from-pink-500 to-rose-500",
            detail: "da base ativa",
        },
        {
            label: "Ciclo Médio",
            value: summary.avgRecurrency > 0 ? `${summary.avgRecurrency.toFixed(0)}d` : "—",
            icon: Clock,
            color: "from-amber-500 to-yellow-500",
            detail: "entre compras",
        },
        {
            label: "Receita Copiloto",
            value: formatCurrency(summary.totalRevenue || 0),
            icon: Banknote,
            color: "from-green-500 to-emerald-600",
            detail: "atribuição direta",
        },
        {
            label: "ROI (por tarefa)",
            value: formatCurrency(summary.roi || 0),
            icon: BarChart3,
            color: "from-violet-500 to-purple-600",
            detail: "retorno médio",
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
