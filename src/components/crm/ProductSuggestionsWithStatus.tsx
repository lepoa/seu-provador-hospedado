import { useState } from "react";
import { 
  Sparkles, 
  Eye, 
  Send, 
  ThumbsUp, 
  ThumbsDown, 
  Copy, 
  MessageCircle,
  Package,
  Flame,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  images: string[] | null;
  main_image_index: number | null;
  stock_by_size: Record<string, number> | null;
  color: string | null;
  style: string | null;
  category: string | null;
}

interface Suggestion {
  id: string;
  product_id: string;
  status: string;
  score: number;
  reasons: string[];
  product?: Product;
}

interface ProductSuggestionsWithStatusProps {
  customerId: string;
  customer: {
    name: string | null;
    phone: string;
    style_title: string | null;
    size_letter: string | null;
    size_number: string | null;
  };
  suggestions: Suggestion[];
  onRefresh: () => void;
}

const STATUS_CONFIG = {
  nova: { label: "Nova", icon: Flame, color: "bg-orange-100 text-orange-700 border-orange-300" },
  mostrei: { label: "Já mostrei", icon: Eye, color: "bg-blue-100 text-blue-700 border-blue-300" },
  enviei: { label: "Já enviei", icon: Send, color: "bg-purple-100 text-purple-700 border-purple-300" },
  gostou: { label: "Gostou", icon: ThumbsUp, color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  nao_gostou: { label: "Não gostou", icon: ThumbsDown, color: "bg-red-100 text-red-700 border-red-300" },
};

export function ProductSuggestionsWithStatus({
  customerId,
  customer,
  suggestions,
  onRefresh,
}: ProductSuggestionsWithStatusProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const sizeFilter = [customer.size_letter, customer.size_number, "UN", "Único"].filter(Boolean);

  const updateStatus = async (suggestionId: string, newStatus: string) => {
    setUpdatingId(suggestionId);
    try {
      const { error } = await supabase
        .from("customer_product_suggestions")
        .update({ status: newStatus })
        .eq("id", suggestionId);

      if (error) throw error;
      onRefresh();
      toast.success(`Status atualizado para "${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG].label}"`);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status");
    } finally {
      setUpdatingId(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const getProductImage = (product?: Product) => {
    if (!product) return null;
    if (product.images && product.images.length > 0) {
      const mainIndex = product.main_image_index || 0;
      return product.images[mainIndex] || product.images[0];
    }
    return product.image_url;
  };

  const getStockInSize = (product?: Product) => {
    if (!product?.stock_by_size) return 0;
    const stock = product.stock_by_size as Record<string, number>;
    let total = 0;
    sizeFilter.forEach((size) => {
      if (!size) return;
      const sizeKey = Object.keys(stock).find(
        (k) => k.toLowerCase() === size.toLowerCase()
      );
      if (sizeKey) {
        total += stock[sizeKey] || 0;
      }
    });
    return total;
  };

  const copySuggestionMessage = (suggestion: Suggestion) => {
    const product = suggestion.product;
    if (!product) return;

    const sizes = [customer.size_letter, customer.size_number].filter(Boolean).join("/");
    const reasonsText = suggestion.reasons?.length > 0 
      ? `\n\nEssa peça combina com você porque: ${suggestion.reasons.slice(0, 2).join(", ")}.`
      : "";
    
    const productUrl = `${window.location.origin}/produto/${product.id}`;
    
    const message = `Oi${customer.name ? `, ${customer.name}` : ""} 💛

Separei essa peça porque combina MUITO com seu estilo${customer.style_title ? ` ${customer.style_title}` : ""} e fica perfeita no seu tamanho ${sizes}.${reasonsText}

*${product.name}*
${formatPrice(product.price)}

Link: ${productUrl}

Me conta o que achou! ✨`;

    navigator.clipboard.writeText(message);
    toast.success("Mensagem copiada!");
  };

  const sendWhatsApp = (suggestion: Suggestion) => {
    copySuggestionMessage(suggestion);
    const phone = customer.phone.replace(/\D/g, "");
    const whatsappNumber = phone.startsWith("55") ? phone : `55${phone}`;
    window.open(`https://wa.me/${whatsappNumber}`, "_blank");
  };

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma sugestão disponível ainda.</p>
          <p className="text-sm mt-1">
            Sugestões são geradas automaticamente baseadas no perfil da cliente.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Sugestões de Produtos
          <Badge variant="secondary" className="ml-2">
            {suggestions.length} sugestões
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suggestions.map((suggestion) => {
            const product = suggestion.product;
            const status = suggestion.status as keyof typeof STATUS_CONFIG;
            const StatusIcon = STATUS_CONFIG[status]?.icon || Flame;
            const stockInSize = getStockInSize(product);

            return (
              <div
                key={suggestion.id}
                className="bg-secondary/30 rounded-lg overflow-hidden border border-border"
              >
                {/* Product image */}
                <div className="aspect-square relative">
                  {getProductImage(product) ? (
                    <img
                      src={getProductImage(product)!}
                      alt={product?.name || "Produto"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}

                  {/* Status badge */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${STATUS_CONFIG[status]?.color || "bg-gray-100"}`}
                        disabled={updatingId === suggestion.id}
                      >
                        {updatingId === suggestion.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <StatusIcon className="h-3 w-3" />
                        )}
                        {STATUS_CONFIG[status]?.label || "Nova"}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <DropdownMenuItem
                          key={key}
                          onClick={() => updateStatus(suggestion.id, key)}
                        >
                          <config.icon className="h-4 w-4 mr-2" />
                          {config.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Stock badge */}
                  <Badge
                    variant="secondary"
                    className="absolute top-2 right-2 text-xs bg-white/90"
                  >
                    {stockInSize} em estoque
                  </Badge>
                </div>

                {/* Product info */}
                <div className="p-3 space-y-2">
                  <p className="font-medium text-sm line-clamp-2">{product?.name}</p>
                  <p className="text-primary font-bold">{product ? formatPrice(product.price) : "-"}</p>

                  {/* Match reasons */}
                  {suggestion.reasons && suggestion.reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {suggestion.reasons.slice(0, 2).map((reason, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1 text-xs"
                      onClick={() => copySuggestionMessage(suggestion)}
                    >
                      <Copy className="h-3 w-3" />
                      Copiar
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 gap-1 text-xs bg-[#25D366] hover:bg-[#128C7E] text-white"
                      onClick={() => sendWhatsApp(suggestion)}
                    >
                      <MessageCircle className="h-3 w-3" />
                      Enviar
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
