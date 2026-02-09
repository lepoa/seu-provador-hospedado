import { ShoppingBag, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  name: string;
  price: number; // Original price
  effectivePrice?: number; // Price after promotional tables (optional for backward compat)
  imageUrl?: string;
  tags?: string[];
  sizes?: string[];
  badge?: string;
  onAddToLook?: () => void;
  isOutOfStock?: boolean;
  // New: promotional tables discount (calculated centrally)
  hasPromotionalDiscount?: boolean;
  discountPercent?: number;
  // Legacy: product-level discounts (deprecated, kept for backward compat)
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number | null;
}

export function ProductCard({
  name,
  price,
  effectivePrice,
  imageUrl,
  tags = [],
  sizes = [],
  badge,
  onAddToLook,
  isOutOfStock = false,
  hasPromotionalDiscount = false,
  discountPercent = 0,
  discountType,
  discountValue,
}: ProductCardProps) {
  const formatPrice = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  // Determine final price and discount state
  // Priority: effectivePrice (from promotional tables) > legacy discountType/discountValue
  let finalPrice = price;
  let showDiscount = false;
  let discountLabel: string | null = null;

  if (effectivePrice !== undefined && effectivePrice < price) {
    // Promotional tables discount
    finalPrice = effectivePrice;
    showDiscount = true;
    discountLabel = discountPercent > 0 ? `-${discountPercent}%` : `-R$ ${(price - effectivePrice).toFixed(2)}`;
  } else if (discountType && discountValue && discountValue > 0) {
    // Legacy product-level discount
    showDiscount = true;
    if (discountType === 'percentage') {
      finalPrice = price * (1 - discountValue / 100);
      discountLabel = `-${discountValue}%`;
    } else {
      finalPrice = Math.max(0, price - discountValue);
      discountLabel = `-R$ ${discountValue.toFixed(2)}`;
    }
  }

  return (
    <div className={cn("card-product group", isOutOfStock && "opacity-60")}>
      <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
        {showDiscount && discountLabel && (
          <span className="absolute top-2 right-2 z-10 bg-green-600 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <Tag className="h-3 w-3" />
            {discountLabel}
          </span>
        )}
        {badge && <span className="badge-promo">{badge}</span>}
        <img
          src={imageUrl || "/placeholder.svg"}
          alt={name}
          className={cn(
            "w-full h-full object-cover transition-transform duration-500",
            !isOutOfStock && "group-hover:scale-105"
          )}
        />
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/20 to-transparent transition-opacity",
          isOutOfStock ? "opacity-30" : "opacity-0 group-hover:opacity-100"
        )} />
      </div>
      
      <div className="p-3 md:p-4">
        <h3 className="font-medium text-sm md:text-base line-clamp-2 mb-1">{name}</h3>
        
        {sizes.length > 0 && (
          <p className="text-xs text-muted-foreground mb-2">
            Tam: {sizes.slice(0, 4).join(", ")}{sizes.length > 4 ? "..." : ""}
          </p>
        )}
        
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col">
            {showDiscount ? (
              <>
                <span className={cn(
                  "font-semibold text-base md:text-lg text-green-600",
                  isOutOfStock && "text-muted-foreground"
                )}>
                  {formatPrice(finalPrice)}
                </span>
                <span className="text-xs text-muted-foreground line-through">
                  {formatPrice(price)}
                </span>
              </>
            ) : (
              <span className={cn(
                "font-semibold text-base md:text-lg",
                isOutOfStock && "text-muted-foreground"
              )}>
                {formatPrice(price)}
              </span>
            )}
          </div>
          {onAddToLook && !isOutOfStock && (
            <Button size="sm" variant="outline" onClick={onAddToLook} className="gap-1.5">
              <ShoppingBag className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Adicionar</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
