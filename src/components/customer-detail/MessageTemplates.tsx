import { Copy, MessageCircle, Sparkles, Package, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface MessageTemplatesProps {
  customer: {
    name: string | null;
    size_letter: string | null;
    size_number: string | null;
  };
  quizLink: string;
  lastOrderId?: string;
  lastOrderStatus?: string;
}

export function MessageTemplates({ 
  customer, 
  quizLink, 
  lastOrderId, 
  lastOrderStatus 
}: MessageTemplatesProps) {
  const customerName = customer.name || "";
  const sizes = [customer.size_letter, customer.size_number].filter(Boolean).join(" / ");

  const templates = [
    {
      id: "quiz-invite",
      icon: <Sparkles className="h-4 w-4" />,
      title: "Convite para Quiz",
      description: "Enviar link do quiz de estilo",
      message: `Oi ${customerName}! ✨ Fizemos uma consultoria rápida no Provador VIP. Quer descobrir seu estilo e receber sugestões no seu tamanho? Responde em 2 min: ${quizLink}`,
    },
    {
      id: "product-suggestion",
      icon: <Package className="h-4 w-4" />,
      title: "Sugestão de Produto",
      description: "Avisar sobre peça nova",
      message: `Oi ${customerName}! Chegou uma peça que tem muito a ver com você 💛${sizes ? ` No seu tamanho (${sizes}).` : ""} Quer que eu te mostre? 🛍️`,
    },
    {
      id: "order-status",
      icon: <Truck className="h-4 w-4" />,
      title: "Status do Pedido",
      description: "Atualização de pedido",
      message: lastOrderId 
        ? `Oi ${customerName}! Sobre o pedido #${lastOrderId.slice(0, 8).toUpperCase()}, ele está como: ${translateStatus(lastOrderStatus || "pendente")}. Se quiser, posso te atualizar por aqui! 📦`
        : `Oi ${customerName}! Sobre seu pedido, ele está em andamento. Se quiser, posso te atualizar por aqui! 📦`,
    },
  ];

  const copyMessage = (message: string, title: string) => {
    navigator.clipboard.writeText(message);
    toast.success(`${title} copiada!`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Mensagens Prontas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {templates.map((template) => (
          <div 
            key={template.id}
            className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  {template.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{template.title}</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {template.description}
                  </p>
                  <p className="text-sm text-muted-foreground bg-secondary/50 p-2 rounded text-ellipsis overflow-hidden">
                    {template.message.length > 120 
                      ? template.message.slice(0, 120) + "..." 
                      : template.message
                    }
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1"
                onClick={() => copyMessage(template.message, template.title)}
              >
                <Copy className="h-4 w-4" />
                Copiar
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function translateStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pendente: "Pendente",
    aguardando_pagamento: "Aguardando Pagamento",
    pago: "Pago ✅",
    enviado: "Enviado 📦",
    entregue: "Entregue ✅",
    cancelado: "Cancelado",
  };
  return statusMap[status] || status;
}
