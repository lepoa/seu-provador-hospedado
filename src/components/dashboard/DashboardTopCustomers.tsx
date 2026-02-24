import { useNavigate } from "react-router-dom";
import { Users, ArrowRight, Instagram } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TopCustomer } from "@/hooks/useDashboardDataV2";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DashboardTopCustomersProps {
  customers: TopCustomer[];
}

const sanitizeLabel = (value: string) => {
  const collapsedEscapes = value.replace(/\\\\u/g, "\\u");
  return collapsedEscapes.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function DashboardTopCustomers({ customers }: DashboardTopCustomersProps) {
  const navigate = useNavigate();

  if (customers.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Melhores Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum cliente encontrado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Melhores Clientes
          </CardTitle>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            onClick={() => navigate("/clientes/ranking")}
          >
            Ver todos <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {customers.map((customer, index) => (
            <div
              key={customer.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/dashboard/clientes/${customer.id}`)}
            >
              <span className="text-xs text-muted-foreground w-6">#{index + 1}</span>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {sanitizeLabel(customer.name || customer.instagram_handle || "Cliente")}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {customer.instagram_handle && (
                    <span className="flex items-center gap-1">
                      <Instagram className="h-3 w-3" />@{customer.instagram_handle.replace("@", "")}
                    </span>
                  )}
                  <span>• {customer.totalPedidos} pedido{customer.totalPedidos !== 1 ? "s" : ""}</span>
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm font-semibold text-primary">{formatCurrency(customer.totalGasto)}</p>
                {customer.ultimaCompra && (
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(customer.ultimaCompra), { addSuffix: true, locale: ptBR })}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
