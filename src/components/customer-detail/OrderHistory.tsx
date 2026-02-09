import { useState } from "react";
import { ShoppingBag, Calendar, Package, ChevronDown, ChevronUp, Truck, Store, Bike, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface OrderItem {
  id: string;
  product_name: string;
  product_price: number;
  size: string;
  quantity: number;
  color: string | null;
  image_url: string | null;
}

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  status: string;
  total: number;
  created_at: string;
  delivery_method: string | null;
  shipping_service: string | null;
  tracking_code: string | null;
  customer_notes: string | null;
  items: OrderItem[];
}

interface OrderHistoryProps {
  orders: Order[];
}

export function OrderHistory({ orders }: OrderHistoryProps) {
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const toggleOrder = (orderId: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const getStatusConfig = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pendente: { label: "Pendente", variant: "secondary" },
      aguardando_pagamento: { label: "Aguardando Pagamento", variant: "outline" },
      pago: { label: "Pago", variant: "default" },
      enviado: { label: "Enviado", variant: "default" },
      entregue: { label: "Entregue", variant: "default" },
      cancelado: { label: "Cancelado", variant: "destructive" },
    };
    return statusMap[status] || { label: status, variant: "secondary" as const };
  };

  const getDeliveryIcon = (method: string | null) => {
    switch (method) {
      case "motoboy":
        return <Bike className="h-4 w-4" />;
      case "pickup":
        return <Store className="h-4 w-4" />;
      default:
        return <Truck className="h-4 w-4" />;
    }
  };

  const getDeliveryLabel = (method: string | null, service: string | null) => {
    switch (method) {
      case "motoboy":
        return "Motoboy";
      case "pickup":
        return "Retirada na loja";
      default:
        return service || "Correios";
    }
  };

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum pedido encontrado para esta cliente.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" />
          Histórico de Pedidos ({orders.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {orders.map((order) => {
          const isExpanded = expandedOrders.has(order.id);
          const statusConfig = getStatusConfig(order.status);

          return (
            <Collapsible key={order.id} open={isExpanded}>
              <div className="border rounded-lg overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button
                    onClick={() => toggleOrder(order.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(order.created_at)}
                        </p>
                      </div>
                      <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-primary">{formatPrice(order.total)}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                          {getDeliveryIcon(order.delivery_method)}
                          {getDeliveryLabel(order.delivery_method, order.shipping_service)}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t p-4 bg-muted/30 space-y-3">
                    {/* Order items */}
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.product_name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-secondary rounded flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.color && `${item.color} • `}
                            Tam. {item.size} • Qtd. {item.quantity}
                          </p>
                        </div>
                        <p className="font-medium text-sm">
                          {formatPrice(item.product_price * item.quantity)}
                        </p>
                      </div>
                    ))}

                    {/* Tracking code */}
                    {order.tracking_code && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          Código de rastreio: <span className="font-mono font-medium">{order.tracking_code}</span>
                        </p>
                      </div>
                    )}

                    {/* Customer Notes */}
                    {order.customer_notes && (
                      <div className="pt-2 border-t">
                        <div className="flex items-center gap-1 text-xs font-medium text-blue-700 mb-1">
                          <MessageCircle className="h-3 w-3" />
                          Observação do cliente:
                        </div>
                        <div className="text-xs bg-blue-50 border border-blue-200 rounded p-2">
                          {order.customer_notes}
                        </div>
                      </div>
                    )}

                    {/* Address */}
                    {order.customer_address && (
                      <div className="text-xs text-muted-foreground pt-2 border-t">
                        <p className="font-medium">Endereço:</p>
                        <p>{order.customer_address}</p>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
