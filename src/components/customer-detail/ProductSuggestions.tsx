import { useState } from "react";
import { Sparkles, Package, Copy, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  sizes: string[] | null;
  style: string | null;
  category: string | null;
  occasion: string | null;
  tags: string[] | null;
}

interface ProductSuggestionsProps {
  customer: {
    name: string | null;
    style_title: string | null;
    size_letter: string | null;
    size_number: string | null;
  };
  catalogProducts: Product[];
}

export function ProductSuggestions({ customer, catalogProducts }: ProductSuggestionsProps) {
  const sizeFilter = [customer.size_letter, customer.size_number, "UN", "Único"].filter(Boolean);
  const styleKeywords = customer.style_title?.toLowerCase() || "";

  // Filter and score products
  const getSuggestions = () => {
    if (!customer.size_letter && !customer.size_number) {
      return [];
    }

    const scored = catalogProducts
      .filter((p) => {
        // Must have stock in customer's size
        if (!p.stock_by_size) return false;
        const stock = p.stock_by_size as Record<string, number>;
        
        return sizeFilter.some((size) => {
          if (!size) return false;
          const sizeKey = Object.keys(stock).find(
            (k) => k.toLowerCase() === size.toLowerCase()
          );
          return sizeKey && stock[sizeKey] > 0;
        });
      })
      .map((p) => {
        let score = 0;
        const productText = `${p.name} ${p.style || ""} ${p.occasion || ""} ${p.tags?.join(" ") || ""}`.toLowerCase();

        // Style matching
        if (styleKeywords.includes("elegante") && productText.includes("elegante")) score += 3;
        if (styleKeywords.includes("romântic") && productText.includes("romântic")) score += 3;
        if (styleKeywords.includes("moderno") && productText.includes("moderno")) score += 3;
        if (styleKeywords.includes("clássic") && productText.includes("clássic")) score += 3;
        if (styleKeywords.includes("minimal") && productText.includes("minimal")) score += 3;
        if (styleKeywords.includes("casual") && productText.includes("casual")) score += 2;
        if (styleKeywords.includes("sofistic") && productText.includes("sofistic")) score += 2;

        // Add some randomness for variety
        score += Math.random() * 2;

        return { product: p, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    return scored.map((s) => s.product);
  };

  const suggestions = getSuggestions();

  const getProductImage = (product: Product) => {
    if (product.images && product.images.length > 0) {
      const mainIndex = product.main_image_index || 0;
      return product.images[mainIndex] || product.images[0];
    }
    return product.image_url;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const getStockInSize = (product: Product) => {
    if (!product.stock_by_size) return 0;
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

  const copySuggestionMessage = (product: Product) => {
    const sizes = [customer.size_letter, customer.size_number].filter(Boolean).join(" / ");
    const message = `Oi ${customer.name || ""}! Chegou uma peça que tem muito a ver com você 💛\n\n*${product.name}*\n${formatPrice(product.price)}\n\nNo seu tamanho (${sizes}). Quer que eu te mostre? 🛍️`;
    navigator.clipboard.writeText(message);
    toast.success("Mensagem copiada!");
  };

  if (!customer.size_letter && !customer.size_number) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="py-8 text-center text-muted-foreground">
          <Sparkles className="h-12 w-12 mx-auto mb-4 text-amber-500" />
          <p>Cliente não informou tamanho.</p>
          <p className="text-sm">
            Envie o quiz para descobrir o tamanho e estilo dela.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum produto com estoque no tamanho da cliente.</p>
          <p className="text-sm mt-1">
            Tamanhos buscados: {sizeFilter.join(", ")}
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
          Sugestões perfeitas pra ela
          <Badge variant="secondary" className="ml-2">
            {sizeFilter.filter((s) => s && s !== "UN" && s !== "Único").join(" / ")}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {suggestions.map((product) => (
            <div 
              key={product.id} 
              className="group bg-secondary/30 rounded-lg overflow-hidden hover:bg-secondary/50 transition-colors"
            >
              {/* Product image */}
              <div className="aspect-square relative">
                {getProductImage(product) ? (
                  <img
                    src={getProductImage(product)!}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-secondary flex items-center justify-center">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                
                {/* Stock badge */}
                <Badge 
                  variant="secondary" 
                  className="absolute top-2 right-2 text-xs bg-white/90"
                >
                  {getStockInSize(product)} em estoque
                </Badge>
              </div>

              {/* Product info */}
              <div className="p-3 space-y-2">
                <p className="font-medium text-sm line-clamp-2">{product.name}</p>
                <p className="text-primary font-bold">{formatPrice(product.price)}</p>
                
                {/* Action button */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full gap-1 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    copySuggestionMessage(product);
                  }}
                >
                  <Copy className="h-3 w-3" />
                  Copiar sugestão
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
