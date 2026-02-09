/**
 * Centralized stock calculation utilities for layered inventory model
 * 
 * Stock Model:
 * - erp_stock_by_size: Stock from last ERP import
 * - committed_by_size: Paid orders not yet synced to ERP
 * - live reservations: Active reservations from live shop (from live_cart_items)
 * 
 * Available = erp_stock - committed - live_reserved
 * 
 * Note: We still keep stock_by_size for backward compatibility (it mirrors erp_stock)
 */

export interface StockData {
  stock_by_size?: Record<string, number> | null;
  erp_stock_by_size?: Record<string, number> | null;
  committed_by_size?: Record<string, number> | null;
}

/**
 * Get ERP stock for a specific size
 * Falls back to stock_by_size for backward compatibility
 */
export function getErpStock(product: StockData, size: string): number {
  // Prefer erp_stock_by_size if available, otherwise use stock_by_size
  const erpStock = product.erp_stock_by_size as Record<string, number> | null;
  const regularStock = product.stock_by_size as Record<string, number> | null;
  
  if (erpStock && Object.keys(erpStock).length > 0) {
    return erpStock[size] || 0;
  }
  
  return regularStock?.[size] || 0;
}

/**
 * Get committed quantity for a specific size
 */
export function getCommittedQty(product: StockData, size: string): number {
  const committed = product.committed_by_size as Record<string, number> | null;
  return committed?.[size] || 0;
}

/**
 * Calculate available stock for a product/size
 * Available = ERP_stock - committed - live_reserved
 * 
 * @param product Product data with stock fields
 * @param size Size to check
 * @param liveReservedQty Quantity reserved in active lives (from useLiveReservedStock hook)
 */
export function calculateAvailableStock(
  product: StockData,
  size: string,
  liveReservedQty: number = 0
): number {
  const erpStock = getErpStock(product, size);
  const committed = getCommittedQty(product, size);
  
  const available = erpStock - committed - liveReservedQty;
  return Math.max(0, available);
}

/**
 * Calculate total available stock across all sizes
 */
export function calculateTotalAvailable(
  product: StockData,
  liveReservedBySize: Record<string, number> = {}
): number {
  const erpStock = product.erp_stock_by_size as Record<string, number> | null;
  const regularStock = product.stock_by_size as Record<string, number> | null;
  const committed = product.committed_by_size as Record<string, number> | null;
  
  const stockSource = (erpStock && Object.keys(erpStock).length > 0) ? erpStock : (regularStock || {});
  
  let total = 0;
  for (const size of Object.keys(stockSource)) {
    const erpQty = stockSource[size] || 0;
    const committedQty = committed?.[size] || 0;
    const reservedQty = liveReservedBySize[size] || 0;
    total += Math.max(0, erpQty - committedQty - reservedQty);
  }
  
  return total;
}

/**
 * Check if a product/size is out of stock (considering all layers)
 */
export function isOutOfStockLayered(
  product: StockData,
  size: string,
  liveReservedQty: number = 0
): boolean {
  return calculateAvailableStock(product, size, liveReservedQty) <= 0;
}

/**
 * Check if a product/size has low stock (2 or less available)
 */
export function isLowStockLayered(
  product: StockData,
  size: string,
  liveReservedQty: number = 0
): boolean {
  const available = calculateAvailableStock(product, size, liveReservedQty);
  return available > 0 && available <= 2;
}

/**
 * Prepare committed_by_size update when a payment is approved
 * Returns the new committed_by_size object
 */
export function incrementCommitted(
  currentCommitted: Record<string, number> | null,
  size: string,
  quantity: number
): Record<string, number> {
  const committed = { ...(currentCommitted || {}) };
  committed[size] = (committed[size] || 0) + quantity;
  return committed;
}

/**
 * Reconcile committed_by_size after ERP import
 * When ERP stock decreases, reduce committed by that delta (ERP caught up)
 * 
 * @param prevErpStock Previous ERP stock by size
 * @param newErpStock New ERP stock by size
 * @param currentCommitted Current committed by size
 * @returns New committed by size after reconciliation
 */
export function reconcileCommittedAfterImport(
  prevErpStock: Record<string, number> | null,
  newErpStock: Record<string, number>,
  currentCommitted: Record<string, number> | null
): Record<string, number> {
  const committed = { ...(currentCommitted || {}) };
  const prev = prevErpStock || {};
  
  for (const size of Object.keys(newErpStock)) {
    const prevQty = prev[size] || 0;
    const newQty = newErpStock[size] || 0;
    const delta = newQty - prevQty;
    
    // If ERP stock decreased, it means ERP recorded those sales
    // So we can reduce our committed count
    if (delta < 0) {
      const reduction = Math.abs(delta);
      committed[size] = Math.max(0, (committed[size] || 0) - reduction);
    }
    // If delta > 0 (ERP stock increased), don't touch committed
    // This could be new inventory arriving
  }
  
  // Clean up zeros
  for (const size of Object.keys(committed)) {
    if (committed[size] === 0) {
      delete committed[size];
    }
  }
  
  return committed;
}

/**
 * Calculate stock_by_size (what to display/use) from ERP and committed
 * This is for backward compatibility with existing code
 * stock_by_size = erp_stock - committed
 */
export function calculateDisplayStock(
  erpStock: Record<string, number> | null,
  committed: Record<string, number> | null
): Record<string, number> {
  const erp = erpStock || {};
  const comm = committed || {};
  const result: Record<string, number> = {};
  
  for (const size of Object.keys(erp)) {
    const erpQty = erp[size] || 0;
    const committedQty = comm[size] || 0;
    result[size] = Math.max(0, erpQty - committedQty);
  }
  
  return result;
}
