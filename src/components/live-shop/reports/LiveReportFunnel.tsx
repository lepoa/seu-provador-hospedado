import { useNavigate, useParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FunnelStage } from "@/hooks/useLiveReportsV2";

interface LiveReportFunnelProps {
  funnel: FunnelStage[];
}

export function LiveReportFunnel({ funnel }: LiveReportFunnelProps) {
  const navigate = useNavigate();
  const { eventId } = useParams();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getColorClasses = (color: string, isActive: boolean) => {
    const colors: Record<string, { bg: string; text: string; border: string; light: string }> = {
      blue: { bg: 'bg-blue-500', text: 'text-blue-700', border: 'border-blue-300', light: 'bg-blue-50' },
      amber: { bg: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-300', light: 'bg-amber-50' },
      green: { bg: 'bg-green-500', text: 'text-green-700', border: 'border-green-300', light: 'bg-green-50' },
      purple: { bg: 'bg-purple-500', text: 'text-purple-700', border: 'border-purple-300', light: 'bg-purple-50' },
      indigo: { bg: 'bg-indigo-500', text: 'text-indigo-700', border: 'border-indigo-300', light: 'bg-indigo-50' },
      emerald: { bg: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-emerald-300', light: 'bg-emerald-50' },
    };
    return colors[color] || colors.blue;
  };

  const handleStageClick = (stageKey: string) => {
    if (!eventId) return;
    
    // Map stage keys to filter parameters
    const filterMap: Record<string, string> = {
      'reservado': 'all',
      'cobrado': 'cobrado',
      'pago': 'pago',
      'separado': 'separado',
      'enviado': 'postado',
      'entregue': 'entregue',
    };

    const filter = filterMap[stageKey] || 'all';
    navigate(`/dashboard/lives/${eventId}/pedidos?status=${filter}`);
  };

  // Calculate widths based on count ratio
  const maxCount = Math.max(...funnel.map(s => s.count), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Funil da Live</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {funnel.map((stage, index) => {
          const colors = getColorClasses(stage.color, true);
          const widthPercent = Math.max((stage.count / maxCount) * 100, 10);
          const showConversion = index > 0 && funnel[index - 1].count > 0;
          
          return (
            <div key={stage.key} className="space-y-1">
              {/* Conversion arrow from previous stage */}
              {showConversion && (
                <div className="flex items-center justify-center gap-1 py-1">
                  <div className="h-px flex-1 bg-muted" />
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${stage.conversionFromPrevious >= 70 ? 'border-green-300 text-green-600' : stage.conversionFromPrevious >= 40 ? 'border-amber-300 text-amber-600' : 'border-red-300 text-red-600'}`}
                  >
                    {stage.conversionFromPrevious.toFixed(0)}%
                  </Badge>
                  <div className="h-px flex-1 bg-muted" />
                </div>
              )}
              
              {/* Stage bar */}
              <button
                onClick={() => handleStageClick(stage.key)}
                className={`w-full group relative overflow-hidden rounded-lg border ${colors.border} ${colors.light} hover:shadow-md transition-all`}
                style={{ width: `${widthPercent}%`, minWidth: '200px', marginLeft: 'auto', marginRight: 'auto' }}
              >
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-8 rounded-full ${colors.bg}`} />
                    <div className="text-left">
                      <p className={`font-medium text-sm ${colors.text}`}>{stage.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(stage.value)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xl font-bold ${colors.text}`}>
                      {stage.count}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </button>
            </div>
          );
        })}

        {/* Legend */}
        <div className="pt-3 border-t text-xs text-muted-foreground text-center">
          Clique em uma etapa para filtrar os pedidos
        </div>
      </CardContent>
    </Card>
  );
}
