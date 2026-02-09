import { useNavigate, useParams } from "react-router-dom";
import { 
  Clock, 
  Send, 
  Package, 
  Tag, 
  User, 
  Shield,
  AlertTriangle,
  Lightbulb,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionableInsight } from "@/hooks/useLiveReportsV2";

interface LiveReportInsightsProps {
  insights: ActionableInsight[];
}

export function LiveReportInsights({ insights }: LiveReportInsightsProps) {
  const navigate = useNavigate();
  const { eventId } = useParams();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getIcon = (iconName: string) => {
    const icons: Record<string, typeof Clock> = {
      clock: Clock,
      send: Send,
      package: Package,
      tag: Tag,
      user: User,
      shield: Shield,
    };
    return icons[iconName] || AlertTriangle;
  };

  const getSeverityClasses = (severity: string) => {
    switch (severity) {
      case 'danger':
        return {
          bg: 'bg-red-50 hover:bg-red-100',
          border: 'border-red-200',
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
          textColor: 'text-red-700',
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 hover:bg-amber-100',
          border: 'border-amber-200',
          iconBg: 'bg-amber-100',
          iconColor: 'text-amber-600',
          textColor: 'text-amber-700',
        };
      default:
        return {
          bg: 'bg-blue-50 hover:bg-blue-100',
          border: 'border-blue-200',
          iconBg: 'bg-blue-100',
          iconColor: 'text-blue-600',
          textColor: 'text-blue-700',
        };
    }
  };

  const handleInsightClick = (insight: ActionableInsight) => {
    if (!eventId) return;
    navigate(`/dashboard/lives/${eventId}/pedidos?filter=${insight.filterKey}`);
  };

  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Insights Acionáveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-green-600">Tudo em ordem!</p>
            <p className="text-xs mt-1">Nenhuma pendência identificada</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Lightbulb className="h-4 w-4" />
          Insights Acionáveis
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {insights.length} pendência(s)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((insight) => {
          const Icon = getIcon(insight.icon);
          const classes = getSeverityClasses(insight.severity);
          
          return (
            <button
              key={insight.key}
              onClick={() => handleInsightClick(insight)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${classes.bg} ${classes.border} group`}
            >
              <div className={`p-2 rounded-lg ${classes.iconBg}`}>
                <Icon className={`h-4 w-4 ${classes.iconColor}`} />
              </div>
              <div className="flex-1 text-left">
                <p className={`text-sm font-medium ${classes.textColor}`}>
                  {insight.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {insight.count} pedido(s) • {formatCurrency(insight.value)}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
