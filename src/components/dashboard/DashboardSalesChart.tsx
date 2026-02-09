import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Line } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { HourlySale } from "@/hooks/useDashboardData";
import { useMemo } from "react";

interface DashboardSalesChartProps {
  data: HourlySale[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(value);
};

const legendLabels: Record<string, string> = {
  pago: "Pago Hoje",
  reservado: "Reservado Hoje",
  pagoOntem: "Pago Ontem",
  reservadoOntem: "Reservado Ontem",
};

export function DashboardSalesChart({ data }: DashboardSalesChartProps) {
  const comparison = useMemo(() => {
    const totalHoje = data.reduce((sum, h) => sum + h.pago, 0);
    const totalOntem = data.reduce((sum, h) => sum + h.pagoOntem, 0);
    const diff = totalOntem > 0 ? ((totalHoje - totalOntem) / totalOntem) * 100 : 0;
    return { totalHoje, totalOntem, diff };
  }, [data]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Vendas ao Longo do Dia
          </CardTitle>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Hoje:</span>
              <span className="font-semibold">{formatCurrency(comparison.totalHoje)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Ontem:</span>
              <span className="font-medium text-muted-foreground">{formatCurrency(comparison.totalOntem)}</span>
            </div>
            {comparison.totalOntem > 0 && (
              <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${
                comparison.diff > 0 
                  ? "bg-green-100 text-green-700" 
                  : comparison.diff < 0 
                    ? "bg-red-100 text-red-700" 
                    : "bg-gray-100 text-gray-600"
              }`}>
                {comparison.diff > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : comparison.diff < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                {Math.abs(comparison.diff).toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPago" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorReservado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="hour" 
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickLine={false}
                axisLine={{ stroke: "#e5e7eb" }}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickFormatter={(value) => `R$${value}`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  legendLabels[name] || name
                ]}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              <Legend 
                verticalAlign="top"
                align="right"
                wrapperStyle={{ fontSize: "11px", paddingBottom: "8px" }}
                formatter={(value) => legendLabels[value] || value}
              />
              {/* Today's data as filled areas */}
              <Area
                type="monotone"
                dataKey="reservado"
                stroke="#f97316"
                strokeWidth={2}
                fill="url(#colorReservado)"
              />
              <Area
                type="monotone"
                dataKey="pago"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#colorPago)"
              />
              {/* Yesterday's data as dashed lines for comparison */}
              <Line
                type="monotone"
                dataKey="reservadoOntem"
                stroke="#fdba74"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="pagoOntem"
                stroke="#86efac"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
