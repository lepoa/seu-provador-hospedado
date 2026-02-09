import { AlertTriangle, TrendingDown, XCircle, Eye, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OperationalAlert } from "@/hooks/useInsightsData";
import { useNavigate } from "react-router-dom";

interface InsightsAlertsProps {
  alerts: OperationalAlert[];
  onViewProduct: (productName: string) => void;
}

export function InsightsAlerts({ alerts, onViewProduct }: InsightsAlertsProps) {
  const navigate = useNavigate();

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getAlertIcon = (type: OperationalAlert["type"]) => {
    switch (type) {
      case "baixa_conversao":
        return <TrendingDown className="h-5 w-5" />;
      case "alto_cancelamento":
        return <XCircle className="h-5 w-5" />;
      case "ruptura":
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const getAlertColor = (type: OperationalAlert["type"], severity: OperationalAlert["severity"]) => {
    if (severity === "error") {
      return "border-red-200 bg-red-50";
    }
    switch (type) {
      case "baixa_conversao":
        return "border-amber-200 bg-amber-50";
      case "alto_cancelamento":
        return "border-red-200 bg-red-50";
      case "ruptura":
        return "border-orange-200 bg-orange-50";
      default:
        return "border-muted";
    }
  };

  const getAlertTextColor = (type: OperationalAlert["type"]) => {
    switch (type) {
      case "baixa_conversao":
        return "text-amber-700";
      case "alto_cancelamento":
        return "text-red-700";
      case "ruptura":
        return "text-orange-700";
    }
  };

  const getAlertTitle = (type: OperationalAlert["type"]) => {
    switch (type) {
      case "baixa_conversao":
        return "Baixa Conversão";
      case "alto_cancelamento":
        return "Alto Cancelamento";
      case "ruptura":
        return "Risco de Ruptura";
    }
  };

  // Group alerts by type
  const groupedAlerts = alerts.reduce((acc, alert) => {
    if (!acc[alert.type]) {
      acc[alert.type] = [];
    }
    acc[alert.type].push(alert);
    return acc;
  }, {} as Record<string, OperationalAlert[]>);

  if (alerts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <AlertTriangle className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-lg font-medium text-green-700">Tudo OK!</h3>
        <p className="text-muted-foreground mt-1">
          Nenhum alerta operacional ativo no momento
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(groupedAlerts).map(([type, typeAlerts]) => (
          <Card key={type} className={getAlertColor(type as OperationalAlert["type"], "warning")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={getAlertTextColor(type as OperationalAlert["type"])}>
                  {getAlertIcon(type as OperationalAlert["type"])}
                </span>
                <span className={`font-medium ${getAlertTextColor(type as OperationalAlert["type"])}`}>
                  {getAlertTitle(type as OperationalAlert["type"])}
                </span>
              </div>
              <p className="text-2xl font-bold">{typeAlerts.length}</p>
              <p className="text-sm text-muted-foreground">produtos afetados</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed List */}
      <div className="space-y-3">
        {alerts.map((alert) => (
          <Card key={alert.id} className={getAlertColor(alert.type, alert.severity)}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className={getAlertTextColor(alert.type)}>
                    {getAlertIcon(alert.type)}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{alert.productName}</span>
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] ${
                          alert.severity === "error" 
                            ? "border-red-300 text-red-700" 
                            : "border-amber-300 text-amber-700"
                        }`}
                      >
                        {alert.severity === "error" ? "Crítico" : "Atenção"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                    {alert.type === "baixa_conversao" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Valor em reserva: <span className="font-medium">{formatPrice(alert.value)}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewProduct(alert.productName)}
                    className="gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    Detalhes
                  </Button>
                  {alert.type === "baixa_conversao" && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => navigate(`/dashboard?tab=orders&status=aguardando_pagamento&search=${encodeURIComponent(alert.productName)}`)}
                      className="gap-1"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Ver reservas
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
