import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface Props {
    distribution: Record<string, number>;
    total: number;
}

const CHANNEL_CONFIG: Record<string, { label: string; color: string }> = {
    live_only: { label: "🎥 Live Only", color: "#ef4444" },
    site_only: { label: "🛒 Site Only", color: "#3b82f6" },
    hybrid: { label: "🔀 Hybrid", color: "#a855f7" },
};

export function RFVChannelChart({ distribution, total }: Props) {
    const data = Object.entries(distribution)
        .map(([key, value]) => ({
            name: CHANNEL_CONFIG[key]?.label || key,
            value,
            color: CHANNEL_CONFIG[key]?.color || "#9ca3af",
        }))
        .sort((a, b) => b.value - a.value);

    return (
        <Card className="border-purple-100">
            <CardHeader>
                <CardTitle className="text-base">Distribuição por Canal de Compra</CardTitle>
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
