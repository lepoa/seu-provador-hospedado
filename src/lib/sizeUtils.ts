// Standardized size ordering utilities

// Fixed order for all sizes - NUMERIC FIRST, then LETTER
export const NUMERIC_SIZES_ORDER = ["34", "36", "38", "40", "42", "44", "46"];
export const LETTER_SIZES_ORDER = ["PP", "P", "M", "G", "GG"];
export const ALL_SIZES_ORDER = [...NUMERIC_SIZES_ORDER, ...LETTER_SIZES_ORDER];

/**
 * Sort sizes according to the standardized order:
 * - Numeric sizes: 34, 36, 38, 40, 42, 44, 46
 * - Letter sizes: PP, P, M, G, GG
 * - Numeric sizes always come before letter sizes
 */
export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const indexA = ALL_SIZES_ORDER.indexOf(a);
    const indexB = ALL_SIZES_ORDER.indexOf(b);
    
    // If both are in the standard order, sort by their position
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    
    // If only one is in the standard order, prioritize it
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    
    // For unknown sizes, sort alphabetically
    return a.localeCompare(b);
  });
}

/**
 * Get total stock across all sizes
 */
export function getTotalStock(stock: Record<string, number> | null | unknown): number {
  if (!stock || typeof stock !== 'object') return 0;
  const stockObj = stock as Record<string, number>;
  return Object.values(stockObj).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
}

/**
 * Check if product is out of stock (total stock = 0)
 */
export function isOutOfStock(stock: Record<string, number> | null | unknown): boolean {
  return getTotalStock(stock) === 0;
}

/**
 * Get available sizes with stock > 0, sorted in standard order
 */
export function getAvailableSizesSorted(stock: Record<string, number> | null | unknown): string[] {
  if (!stock || typeof stock !== 'object') return [];
  const stockObj = stock as Record<string, number>;
  
  const availableSizes = Object.entries(stockObj)
    .filter(([_, qty]) => typeof qty === 'number' && qty > 0)
    .map(([size]) => size);
  
  return sortSizes(availableSizes);
}

/**
 * Get all sizes (even with 0 stock), sorted in standard order
 */
export function getAllSizesSorted(stock: Record<string, number> | null | unknown): string[] {
  if (!stock || typeof stock !== 'object') return [];
  const stockObj = stock as Record<string, number>;
  
  const allSizes = Object.keys(stockObj);
  return sortSizes(allSizes);
}
