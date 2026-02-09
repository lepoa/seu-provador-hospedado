// Discount calculation utilities

export type DiscountType = 'percentage' | 'fixed' | null;

export interface DiscountConfig {
  discountType: DiscountType;
  discountValue: number | null;
}

/**
 * Calculate the final price after applying a discount
 */
export function calculateDiscountedPrice(
  originalPrice: number,
  discountType: DiscountType,
  discountValue: number | null
): number {
  if (!discountType || !discountValue || discountValue <= 0) {
    return originalPrice;
  }

  if (discountType === 'percentage') {
    return originalPrice * (1 - discountValue / 100);
  } else if (discountType === 'fixed') {
    return Math.max(0, originalPrice - discountValue);
  }

  return originalPrice;
}

/**
 * Check if a product has an active discount
 */
export function hasDiscount(
  discountType: DiscountType,
  discountValue: number | null
): boolean {
  return !!(discountType && discountValue && discountValue > 0);
}

/**
 * Format discount label for display
 */
export function getDiscountLabel(
  discountType: DiscountType,
  discountValue: number | null
): string | null {
  if (!hasDiscount(discountType, discountValue)) return null;
  
  if (discountType === 'percentage') {
    return `-${discountValue}%`;
  } else if (discountType === 'fixed') {
    return `-R$ ${discountValue?.toFixed(2)}`;
  }
  
  return null;
}
