import { User, Phone, Mail, Calendar, CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { buildWhatsAppLink } from "@/lib/whatsappHelpers";

interface CustomerHeaderProps {
  customer: {
    id: string;
    phone: string;
    name: string | null;
    email: string | null;
    style_title: string | null;
    size_letter: string | null;
    size_number: string | null;
    created_at: string;
    total_orders: number;
    total_spent: number;
    last_order_at: string | null;
  };
  hasQuiz: boolean;
  hasPrints: boolean;
}

export function CustomerHeader({ customer, hasQuiz, hasPrints }: CustomerHeaderProps) {
  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 13 && digits.startsWith("55")) {
      return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    return phone;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const isComplete = !!customer.name && !!customer.phone && !!customer.email;
  const statusLabel = isComplete ? "Cadastro completo" : "Cadastro incompleto";

  // WhatsApp message
  const whatsappMessage = `Oi ${customer.name || ""}! 👋 Sou da Lepoa, tudo bem?`;

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      {/* Score badges row */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Badge variant="outline" className="gap-1">
          🛍️ {customer.total_orders} pedido{customer.total_orders !== 1 ? "s" : ""}
        </Badge>
        <Badge variant="outline" className="gap-1 text-primary">
          💰 {formatPrice(customer.total_spent)}
        </Badge>
        {customer.last_order_at && (
          <Badge variant="outline" className="gap-1">
            📅 Última compra: {formatDate(customer.last_order_at)}
          </Badge>
        )}
        <Badge variant={hasQuiz ? "default" : "secondary"} className="gap-1">
          {hasQuiz ? "✓ Quiz respondido" : "⏳ Sem quiz"}
        </Badge>
        {hasPrints && (
          <Badge variant="outline" className="gap-1">
            📷 Enviou prints
          </Badge>
        )}
      </div>

      {/* Main header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center shrink-0">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl">
                {customer.name || "Cliente sem nome"}
              </h1>
              {isComplete ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                {formatPhone(customer.phone)}
              </span>
              {customer.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {customer.email}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Desde {formatDate(customer.created_at)}
              </span>
            </div>

            {/* Style and size badges */}
            <div className="flex flex-wrap gap-2 pt-1">
              {customer.style_title && (
                <Badge variant="default" className="gap-1">
                  ✨ {customer.style_title}
                </Badge>
              )}
              {(customer.size_letter || customer.size_number) && (
                <Badge variant="secondary">
                  Tam. {[customer.size_letter, customer.size_number].filter(Boolean).join(" / ")}
                </Badge>
              )}
            </div>

            <p className={`text-xs ${isComplete ? "text-green-600" : "text-amber-600"}`}>
              {statusLabel}
            </p>
          </div>
        </div>

        {/* WhatsApp button */}
        <div className="flex items-center gap-2">
          <WhatsAppButton
            href={buildWhatsAppLink(whatsappMessage, customer.phone)}
            variant="primary"
            className="w-auto"
          />
        </div>
      </div>
    </div>
  );
}
