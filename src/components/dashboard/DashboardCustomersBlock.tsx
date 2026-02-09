import { useNavigate } from "react-router-dom";
import { Users, ArrowRight, Instagram, MessageCircle, ShoppingBag, BookOpen, Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { TopCustomer } from "@/hooks/useDashboardData";

interface DashboardCustomersBlockProps {
  customers: TopCustomer[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
};

export function DashboardCustomersBlock({ customers }: DashboardCustomersBlockProps) {
  const navigate = useNavigate();

  const handleWhatsApp = (e: React.MouseEvent, customer: TopCustomer) => {
    e.stopPropagation();
    // Navigate to profile where WhatsApp is available
    navigate(`/dashboard/clientes/${customer.id}`);
  };

  const handleOrders = (e: React.MouseEvent, customerId: string) => {
    e.stopPropagation();
    navigate(`/dashboard/clientes/${customerId}?tab=pedidos`);
  };

  const handleCatalog = (e: React.MouseEvent, customerId: string) => {
    e.stopPropagation();
    navigate(`/dashboard/clientes/${customerId}?tab=sugestoes`);
  };

  const handleLives = (e: React.MouseEvent, customerId: string) => {
    e.stopPropagation();
    navigate(`/dashboard/clientes/${customerId}?tab=lives`);
  };

  const goToCustomer = (customerId: string) => {
    navigate(`/dashboard/clientes/${customerId}`);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Top Clientes
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1"
            onClick={() => navigate("/dashboard?tab=clientes")}
          >
            Ver todos
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {customers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum cliente ainda
            </p>
          ) : (
            <TooltipProvider>
              {customers.map((customer, index) => (
                <div
                  key={customer.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => goToCustomer(customer.id)}
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                    {index + 1}
                  </div>
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-accent/10 text-accent text-xs">
                      {customer.name?.charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {customer.name || "Sem nome"}
                    </p>
                    {customer.instagram_handle && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Instagram className="h-3 w-3" />
                        @{customer.instagram_handle}
                      </p>
                    )}
                  </div>
                  
                  {/* Quick Action Icons */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => handleWhatsApp(e, customer)}
                          className="p-1.5 rounded-full hover:bg-green-100 text-green-600 transition-colors"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>WhatsApp</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => handleOrders(e, customer.id)}
                          className="p-1.5 rounded-full hover:bg-blue-100 text-blue-600 transition-colors"
                        >
                          <ShoppingBag className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Ver Pedidos</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => handleCatalog(e, customer.id)}
                          className="p-1.5 rounded-full hover:bg-violet-100 text-violet-600 transition-colors"
                        >
                          <BookOpen className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Catálogo Personalizado</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => handleLives(e, customer.id)}
                          className="p-1.5 rounded-full hover:bg-rose-100 text-rose-600 transition-colors"
                        >
                          <Radio className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Histórico de Lives</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-600">
                      {formatCurrency(customer.totalGasto)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {customer.totalPedidos} pedido{customer.totalPedidos !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              ))}
            </TooltipProvider>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
