import { useNavigate } from "react-router-dom";
import { AlertTriangle, Info, Clock, ShoppingCart, Package, Users, ArrowRight, Send, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AlertItem } from "@/hooks/useDashboardData";

interface DashboardAlertsBlockProps {
  alerts: AlertItem[];
}

const getAlertIcon = (type: AlertItem["type"]) => {
  switch (type) {
    case "cart_unpaid":
      return ShoppingCart;
    case "order_stuck":
      return Clock;
    case "waitlist":
      return Users;
    case "low_stock":
      return Package;
    default:
      return AlertTriangle;
  }
};

const getSeverityStyles = (severity: AlertItem["severity"]) => {
  switch (severity) {
    case "error":
      return {
        bg: "bg-red-50 border-red-200 hover:bg-red-100",
        icon: "text-red-600",
        text: "text-red-800",
        badge: "🔴",
      };
    case "warning":
      return {
        bg: "bg-amber-50 border-amber-200 hover:bg-amber-100",
        icon: "text-amber-600",
        text: "text-amber-800",
        badge: "🟡",
      };
    case "info":
      return {
        bg: "bg-blue-50 border-blue-200 hover:bg-blue-100",
        icon: "text-blue-600",
        text: "text-blue-800",
        badge: "🔵",
      };
  }
};

const getActionLabel = (type: AlertItem["type"]) => {
  switch (type) {
    case "cart_unpaid":
      return "Enviar cobrança";
    case "order_stuck":
      return "Resolver";
    case "waitlist":
      return "Ver lista";
    case "low_stock":
      return "Repor estoque";
    default:
      return "Ver";
  }
};

export function DashboardAlertsBlock({ alerts }: DashboardAlertsBlockProps) {
  const navigate = useNavigate();

  if (alerts.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="py-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-3">
            <Info className="h-6 w-6 text-green-600" />
          </div>
          <p className="text-sm font-medium text-green-800">
            Tudo em ordem! 🎉
          </p>
          <p className="text-xs text-green-600 mt-1">
            Nenhum alerta pendente no momento
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Alertas Importantes
          <span className="ml-auto bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {alerts.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((alert) => {
          const Icon = getAlertIcon(alert.type);
          const styles = getSeverityStyles(alert.severity);
          const actionLabel = getActionLabel(alert.type);

          return (
            <div
              key={alert.id}
              className={`${styles.bg} border rounded-lg p-3 flex items-start gap-3 cursor-pointer transition-all group`}
              onClick={() => {
                if (alert.actionUrl) {
                  // Fix any old routes
                  const fixedUrl = alert.actionUrl
                    .replace("/lives/backstage/", "/dashboard/lives/")
                    .replace(/\/dashboard\/lives\/([^/]+)$/, "/dashboard/lives/$1/backstage");
                  navigate(fixedUrl);
                }
              }}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs">{styles.badge}</span>
                <Icon className={`h-5 w-5 ${styles.icon} flex-shrink-0`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${styles.text}`}>
                  {alert.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {alert.description}
                </p>
              </div>
              {alert.actionUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex-shrink-0 text-xs gap-1 ${styles.icon} opacity-60 group-hover:opacity-100 transition-opacity`}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(alert.actionUrl!);
                  }}
                >
                  {actionLabel}
                  <ArrowRight className="h-3 w-3" />
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
