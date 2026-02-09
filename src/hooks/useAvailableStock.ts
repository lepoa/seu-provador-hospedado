import { useMemo, useCallback } from "react";
import { useLiveReservedStock } from "@/hooks/useLiveStock";
import { 
  calculateAvailableStock, 
  calculateTotalAvailable,
  isOutOfStockLayered,
  isLowStockLayered,
  StockData
} from "@/lib/stockCalculation";

/**
 * Hook that provides calculated available stock considering all layers:
 * - ERP stock
 * - Committed (paid but not synced to ERP)
 * - Live reservations
 */
export function useAvailableStock() {
  const { 
    getReservedForProduct, 
    getReservedForSize,
    isLoading: reservedLoading,
    refresh: refreshReserved,
  } = useLiveReservedStock();

  /**
   * Get available stock for a specific product/size
   */
  const getAvailable = useCallback((
    product: StockData,
    productId: string,
    size: string
  ): number => {
    const reserved = getReservedForSize(productId, size);
    return calculateAvailableStock(product, size, reserved);
  }, [getReservedForSize]);

  /**
   * Get total available stock for a product across all sizes
   */
  const getTotalAvailable = useCallback((
    product: StockData,
    productId: string
  ): number => {
    const reservedBySize = getReservedForProduct(productId);
    return calculateTotalAvailable(product, reservedBySize);
  }, [getReservedForProduct]);

  /**
   * Check if product/size is out of stock
   */
  const isOutOfStock = useCallback((
    product: StockData,
    productId: string,
    size: string
  ): boolean => {
    const reserved = getReservedForSize(productId, size);
    return isOutOfStockLayered(product, size, reserved);
  }, [getReservedForSize]);

  /**
   * Check if product/size has low stock (<=2)
   */
  const isLowStock = useCallback((
    product: StockData,
    productId: string,
    size: string
  ): boolean => {
    const reserved = getReservedForSize(productId, size);
    return isLowStockLayered(product, size, reserved);
  }, [getReservedForSize]);

  /**
   * Get available sizes for a product (sizes with stock > 0)
   */
  const getAvailableSizes = useCallback((
    product: StockData,
    productId: string
  ): string[] => {
    const erpStock = product.erp_stock_by_size as Record<string, number> | null;
    const regularStock = product.stock_by_size as Record<string, number> | null;
    const stockSource = (erpStock && Object.keys(erpStock).length > 0) ? erpStock : (regularStock || {});
    
    const reservedBySize = getReservedForProduct(productId);
    
    return Object.keys(stockSource).filter(size => {
      const available = calculateAvailableStock(product, size, reservedBySize[size] || 0);
      return available > 0;
    });
  }, [getReservedForProduct]);

  return {
    getAvailable,
    getTotalAvailable,
    isOutOfStock,
    isLowStock,
    getAvailableSizes,
    isLoading: reservedLoading,
    refresh: refreshReserved,
  };
}
