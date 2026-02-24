import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, GaugeCircle } from "lucide-react";
import type { RFVPerformanceInsights } from "@/hooks/useRFVData";

interface Props {
  insights: RFVPerformanceInsights;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  pos_compra: "Pos-venda",
  preventivo: "Preventivo",
  reativacao: "Reativacao",
  vip: "VIP",
  migrar_canal: "Migrar canal",
  post_sale: "Pos-venda",
  preventive: "Preventivo",
  reactivation: "Reativacao",
  channel_migration: "Migrar canal",
};

const SEGMENT_LABELS: Record<string, string> = {
  A: "A",
  B: "B",
  C: "C",
  D: "D",
  E: "E",
  unknown: "N/A",
};

export function RFVPerformanceInsights({ insights }: Props) {
  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const conversionByType = insights.conversion_by_type.map((item) => ({
    name: TASK_TYPE_LABELS[item.task_type] || item.task_type,
    rate: Number(item.rate || 0),
    total: Number(item.total || 0),
    converted: Number(item.converted || 0),
  }));

  const conversionBySegment = insights.segment_conversion.map((item) => ({
    name: SEGMENT_LABELS[item.segment_ak] || item.segment_ak,
    rate: Number(item.rate || 0),
    total: Number(item.total || 0),
    converted: Number(item.converted || 0),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-emerald-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Banknote className="h-4 w-4 text-emerald-600" />
              Receita 30d
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(insights.last_30d_revenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Receita atribuida a tarefas convertidas</p>
          </CardContent>
        </Card>

        <Card className="border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <GaugeCircle className="h-4 w-4 text-blue-600" />
              Eficiencia do motor %
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.impact_analysis.efficiency_percent.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Real {formatCurrency(insights.impact_analysis.real)} / Estimado{" "}
              {formatCurrency(insights.impact_analysis.estimated)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="border-purple-100">
          <CardHeader>
            <CardTitle className="text-base">Conversao por tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={conversionByType}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === "rate" ? [`${Number(value).toFixed(1)}%`, "Taxa"] : [value, name]
                  }
                />
                <Bar dataKey="rate" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-orange-100">
          <CardHeader>
            <CardTitle className="text-base">Conversao por segmento</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={conversionBySegment}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === "rate" ? [`${Number(value).toFixed(1)}%`, "Taxa"] : [value, name]
                  }
                />
                <Bar dataKey="rate" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
