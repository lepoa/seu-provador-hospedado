import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface StockEntry {
  product_id: string;
  size: string;
  stock: number;      // renamed from on_hand to match view
  committed: number;
  reserved: number;
  available: number;
}

/**
 * Hook centralizado para obter estoque disponível de produtos
 * Usa a view product_available_stock que calcula:
 * available = on_hand - committed - reserved (live carts)
 */
export function useProductAvailableStock(productIds?: string[]) {
  const [stockData, setStockData] = useState<Map<string, Map<string, StockEntry>>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStock = useCallback(async () => {
    try {
      setIsLoading(true);
      
      let query = supabase
        .from("product_available_stock")
        .select("*");
      
      if (productIds && productIds.length > 0) {
        query = query.in("product_id", productIds);
      }
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      
      const stockMap = new Map<string, Map<string, StockEntry>>();
      
      (data || []).forEach((entry: StockEntry) => {
        if (!stockMap.has(entry.product_id)) {
          stockMap.set(entry.product_id, new Map());
        }
        stockMap.get(entry.product_id)!.set(entry.size, entry);
      });
      
      setStockData(stockMap);
      setError(null);
    } catch (err) {
      console.error("Error fetching available stock:", err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [productIds?.join(",")]);

  useEffect(() => {
    fetchStock();
    
    // Subscribe to realtime changes
    const channel = supabase
      .channel('stock-changes-view')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_carts' },
        () => fetchStock()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_cart_items' },
        () => fetchStock()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_catalog' },
        () => fetchStock()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => fetchStock()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStock]);

  /**
   * Obter estoque disponível para um produto+tamanho específico
   */
  const getAvailable = useCallback((productId: string, size: string): number => {
    const productStock = stockData.get(productId);
    if (!productStock) return 0;
    const entry = productStock.get(size);
    return entry?.available ?? 0;
  }, [stockData]);

  /**
   * Obter todos os tamanhos com estoque disponível > 0 para um produto
   */
  const getAvailableSizes = useCallback((productId: string): string[] => {
    const productStock = stockData.get(productId);
    if (!productStock) return [];
    
    const sizes: string[] = [];
    productStock.forEach((entry, size) => {
      if (entry.available > 0) {
        sizes.push(size);
      }
    });
    
    // Sort sizes in standard order
    const numericOrder = ["34", "36", "38", "40", "42", "44", "46"];
    const letterOrder = ["PP", "P", "M", "G", "GG"];
    
    return sizes.sort((a, b) => {
      const aNumIdx = numericOrder.indexOf(a);
      const bNumIdx = numericOrder.indexOf(b);
      const aLetIdx = letterOrder.indexOf(a);
      const bLetIdx = letterOrder.indexOf(b);
      
      // Numeric first
      if (aNumIdx !== -1 && bNumIdx !== -1) return aNumIdx - bNumIdx;
      if (aNumIdx !== -1) return -1;
      if (bNumIdx !== -1) return 1;
      
      // Then letter
      if (aLetIdx !== -1 && bLetIdx !== -1) return aLetIdx - bLetIdx;
      if (aLetIdx !== -1) return -1;
      if (bLetIdx !== -1) return 1;
      
      return a.localeCompare(b);
    });
  }, [stockData]);

  /**
   * Verificar se um tamanho está esgotado
   */
  const isSizeOutOfStock = useCallback((productId: string, size: string): boolean => {
    return getAvailable(productId, size) <= 0;
  }, [getAvailable]);

  /**
   * Verificar se um tamanho tem baixo estoque (1-2 unidades)
   */
  const isSizeLowStock = useCallback((productId: string, size: string): boolean => {
    const available = getAvailable(productId, size);
    return available > 0 && available <= 2;
  }, [getAvailable]);

  /**
   * Obter estoque total disponível de um produto (soma de todos os tamanhos)
   */
  const getTotalAvailable = useCallback((productId: string): number => {
    const productStock = stockData.get(productId);
    if (!productStock) return 0;
    
    let total = 0;
    productStock.forEach((entry) => {
      total += entry.available;
    });
    return total;
  }, [stockData]);

  /**
   * Verificar se produto está totalmente esgotado
   */
  const isProductOutOfStock = useCallback((productId: string): boolean => {
    return getTotalAvailable(productId) <= 0;
  }, [getTotalAvailable]);

  /**
   * Obter reservas para um produto+tamanho
   */
  const getReserved = useCallback((productId: string, size: string): number => {
    const productStock = stockData.get(productId);
    if (!productStock) return 0;
    const entry = productStock.get(size);
    return entry?.reserved ?? 0;
  }, [stockData]);

  /**
   * Obter reservas totais para um produto
   */
  const getTotalReserved = useCallback((productId: string): number => {
    const productStock = stockData.get(productId);
    if (!productStock) return 0;
    
    let total = 0;
    productStock.forEach((entry) => {
      total += entry.reserved;
    });
    return total;
  }, [stockData]);

  return {
    stockData,
    isLoading,
    error,
    refresh: fetchStock,
    // Per-size functions
    getAvailable,
    getAvailableSizes,
    isSizeOutOfStock,
    isSizeLowStock,
    getReserved,
    // Per-product functions
    getTotalAvailable,
    getTotalReserved,
    isProductOutOfStock,
  };
}

/**
 * Hook simplificado para um único produto
 */
export function useSingleProductStock(productId: string | undefined) {
  const productIds = useMemo(() => productId ? [productId] : [], [productId]);
  const hook = useProductAvailableStock(productIds);
  
  return {
    ...hook,
    // Convenience methods that auto-pass productId
    available: (size: string) => productId ? hook.getAvailable(productId, size) : 0,
    availableSizes: productId ? hook.getAvailableSizes(productId) : [],
    isOutOfStock: (size: string) => productId ? hook.isSizeOutOfStock(productId, size) : true,
    isLowStock: (size: string) => productId ? hook.isSizeLowStock(productId, size) : false,
    totalAvailable: productId ? hook.getTotalAvailable(productId) : 0,
    isProductOutOfStock: productId ? hook.isProductOutOfStock(productId) : true,
  };
}
