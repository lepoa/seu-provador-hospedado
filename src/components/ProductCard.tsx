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
  showSizes?: boolean;
  discountBadgeVariant?: "default" | "subtle";
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
  showSizes = true,
  discountBadgeVariant = "default",
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
    <div
      className={cn(
        "group overflow-hidden rounded-2xl border border-[#d2ba8966] bg-[#fffdf8] shadow-[0_8px_24px_rgba(16,40,32,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(16,40,32,0.10)]",
        isOutOfStock && "opacity-60"
      )}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-[#f5f0e4]">
        {showDiscount && discountLabel && (
          <span
            className={cn(
              "absolute right-2 top-2 z-10 flex items-center rounded-full border text-[10px]",
              discountBadgeVariant === "subtle"
                ? "gap-0.5 border-[#cbb48a] bg-[#f8f2e6]/95 px-1.5 py-0.5 font-medium text-[#7a6744]"
                : "gap-1 border-[#c19a54] bg-[#f6ebd5] px-2 py-1 font-bold text-[#6f572e]"
            )}
          >
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
          "absolute inset-0 bg-gradient-to-t from-[#102820]/30 via-transparent to-transparent transition-opacity",
          isOutOfStock ? "opacity-30" : "opacity-0 group-hover:opacity-100"
        )} />
      </div>
      
      <div className="p-3 md:p-4">
        <h3 className="mb-1 line-clamp-2 text-sm font-medium text-[#1d1b18] md:text-base">{name}</h3>
        
        {showSizes && sizes.length > 0 && (
          <p className="mb-2 text-xs text-[#6d6658]">
            Tam: {sizes.slice(0, 4).join(", ")}{sizes.length > 4 ? "..." : ""}
          </p>
        )}
        
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col">
            {showDiscount ? (
              <>
                <span className={cn(
                  "text-base font-semibold text-[#6f572e] md:text-lg",
                  isOutOfStock && "text-muted-foreground"
                )}>
                  {formatPrice(finalPrice)}
                </span>
                <span className="text-xs text-[#88806e] line-through">
                  {formatPrice(price)}
                </span>
              </>
            ) : (
              <span className={cn(
                "text-base font-semibold text-[#102820] md:text-lg",
                isOutOfStock && "text-muted-foreground"
              )}>
                {formatPrice(price)}
              </span>
            )}
          </div>
          {onAddToLook && !isOutOfStock && (
            <Button
              size="sm"
              variant="outline"
              onClick={onAddToLook}
              className="gap-1.5 border-[#c7aa6b] bg-[#f8f1df] text-[#2f2a22] hover:border-[#b8944e] hover:bg-[#f2e6cc]"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Adicionar</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
