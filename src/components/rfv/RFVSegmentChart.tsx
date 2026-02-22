import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface Props {
    distribution: Record<string, number>;
    total: number;
}

const SEGMENT_COLORS: Record<string, string> = {
    campeao: "#a855f7",
    fiel: "#3b82f6",
    promissor: "#22c55e",
    atencao: "#f59e0b",
    hibernando: "#94a3b8",
    risco: "#ef4444",
    novo: "#06b6d4",
};

const SEGMENT_LABELS: Record<string, string> = {
    campeao: "🏆 Campeão",
    fiel: "💎 Fiel",
    promissor: "🌱 Promissor",
    atencao: "👀 Atenção",
    hibernando: "😴 Hibernando",
    risco: "🔴 Em Risco",
    novo: "✨ Novo",
};

export function RFVSegmentChart({ distribution, total }: Props) {
    const data = Object.entries(distribution)
        .map(([key, value]) => ({
            name: SEGMENT_LABELS[key] || key,
            value,
            color: SEGMENT_COLORS[key] || "#9ca3af",
        }))
        .sort((a, b) => b.value - a.value);

    return (
        <Card className="border-purple-100">
            <CardHeader>
                <CardTitle className="text-base">Distribuição dos Segmentos RFV</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={{ strokeWidth: 1 }}
                        >
                            {data.map((entry, index) => (
                                <Cell key={index} fill={entry.color} stroke="white" strokeWidth={2} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value: number) => [`${value} clientes`, "Quantidade"]}
                        />
                    </PieChart>
                </ResponsiveContainer>
                <div className="text-center text-sm text-muted-foreground mt-2">
                    {total} clientes na base ativa
                </div>
            </CardContent>
        </Card>
    );
}
