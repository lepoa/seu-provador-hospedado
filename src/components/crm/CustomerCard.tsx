import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Phone, 
  Sparkles, 
  ShoppingBag, 
  MessageCircle,
  User,
  Check,
  AlertCircle,
  Eye,
  BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface CustomerCardProps {
  customer: {
    id: string;
    phone: string;
    name: string | null;
    email: string | null;
    style_title: string | null;
    size_letter: string | null;
    size_number: string | null;
    total_orders: number;
    total_spent: number;
    last_order_at: string | null;
    created_at: string;
    address_line?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
    document?: string | null; // CPF
  };
  onOpenCatalog?: (customerId: string) => void;
}

export function CustomerCard({ customer, onOpenCatalog }: CustomerCardProps) {
  const navigate = useNavigate();

  // Calculate completion percentage
  const fields = [
    customer.name,
    customer.phone,
    customer.email,
    customer.size_letter || customer.size_number,
    customer.address_line,
    customer.city,
    customer.zip_code,
  ];
  const filledFields = fields.filter(Boolean).length;
  const completionPercentage = Math.round((filledFields / fields.length) * 100);
  const isComplete = completionPercentage === 100;

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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const formatDate = (date: string | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  };

  const getInitials = () => {
    if (customer.name) {
      return customer.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    }
    return customer.phone?.slice(-2) || "?";
  };

  const whatsappNumber = customer.phone.replace(/\D/g, "");
  const whatsappLink = `https://wa.me/${whatsappNumber.startsWith("55") ? whatsappNumber : `55${whatsappNumber}`}`;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Header: Avatar + Name + Status */}
        <div className="flex items-start gap-3 mb-3">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-primary">
              {getInitials()}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium text-sm line-clamp-1">
                  {customer.name || "Sem nome"}
                </h3>
                <div className="flex items-center gap-1 text-muted-foreground text-xs mt-0.5">
                  <Phone className="h-3 w-3" />
                  <span>{formatPhone(customer.phone)}</span>
                </div>
              </div>

              {/* Status badge */}
              {isComplete ? (
                <Badge variant="default" className="bg-emerald-500 text-xs gap-0.5 flex-shrink-0">
                  <Check className="h-3 w-3" />
                  Completo
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs gap-0.5 flex-shrink-0">
                  <AlertCircle className="h-3 w-3" />
                  {completionPercentage}%
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Style & Size badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {customer.style_title && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Sparkles className="h-3 w-3" />
              {customer.style_title}
            </Badge>
          )}
          {(customer.size_letter || customer.size_number) && (
            <Badge variant="outline" className="text-xs">
              {[customer.size_letter, customer.size_number].filter(Boolean).join(" / ")}
            </Badge>
          )}
        </div>

        {/* Stats: Orders & Spent */}
        <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
          <div className="bg-secondary/50 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
              <ShoppingBag className="h-3 w-3" />
              <span>Pedidos</span>
            </div>
            <p className="font-semibold">{customer.total_orders || 0}</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-2 text-center col-span-2">
            <div className="text-muted-foreground mb-0.5">Total gasto</div>
            <p className="font-semibold text-primary">
              {customer.total_spent > 0 ? formatPrice(customer.total_spent) : "—"}
            </p>
          </div>
        </div>

        {/* Last order */}
        {customer.last_order_at && (
          <p className="text-xs text-muted-foreground mb-3">
            Última compra: {formatDate(customer.last_order_at)}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            className="flex-1 bg-[#25D366] hover:bg-[#128C7E] text-white gap-1"
            asChild
          >
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </a>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => navigate(`/dashboard/clientes/${customer.id}`)}
          >
            <Eye className="h-3.5 w-3.5" />
            Perfil
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => onOpenCatalog?.(customer.id)}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Catálogo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
