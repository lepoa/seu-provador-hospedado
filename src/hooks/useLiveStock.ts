import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface HiddenProductInfo {
  productId: string;
  liveTitle: string;
  visibility: 'exclusivo_live' | 'catalogo_e_live';
}

/**
 * Hook to get products hidden by active lives (EXCLUSIVO_LIVE)
 * Used to filter catalog display
 */
export function useLiveHiddenProducts() {
  const [hiddenProductIds, setHiddenProductIds] = useState<Set<string>>(new Set());
  const [hiddenInfo, setHiddenInfo] = useState<HiddenProductInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHiddenProducts = useCallback(async () => {
    try {
      // Get products that should be hidden from catalog
      // 1. EXCLUSIVO_LIVE + live is AO_VIVO
      // 2. EXCLUSIVO_LIVE + bloquear_desde_planejamento + live is PLANEJADA
      const { data, error } = await supabase
        .from("live_products")
        .select(`
          product_id,
          visibilidade,
          bloquear_desde_planejamento,
          live_event:live_events(id, titulo, status)
        `)
        .eq("visibilidade", "exclusivo_live");

      if (error) throw error;

      const hidden: HiddenProductInfo[] = [];
      const hiddenIds = new Set<string>();

      (data || []).forEach((lp: any) => {
        const liveStatus = lp.live_event?.status;
        const shouldHide = 
          liveStatus === 'ao_vivo' || 
          (liveStatus === 'planejada' && lp.bloquear_desde_planejamento);

        if (shouldHide) {
          hiddenIds.add(lp.product_id);
          hidden.push({
            productId: lp.product_id,
            liveTitle: lp.live_event?.titulo || 'Live',
            visibility: lp.visibilidade,
          });
        }
      });

      setHiddenProductIds(hiddenIds);
      setHiddenInfo(hidden);
    } catch (err) {
      console.error("Error fetching hidden products:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHiddenProducts();
  }, [fetchHiddenProducts]);

  const isProductHidden = useCallback((productId: string): boolean => {
    return hiddenProductIds.has(productId);
  }, [hiddenProductIds]);

  const getHiddenReason = useCallback((productId: string): string | null => {
    const info = hiddenInfo.find(h => h.productId === productId);
    return info ? `Exclusivo da live "${info.liveTitle}"` : null;
  }, [hiddenInfo]);

  return {
    hiddenProductIds,
    hiddenInfo,
    isLoading,
    isProductHidden,
    getHiddenReason,
    refresh: fetchHiddenProducts,
  };
}

/**
 * Hook to get reserved stock for products from live carts
 * Used to calculate available stock in catalog
 * 
 * CRITICAL: Stock is reserved until:
 * 1. Cart is cancelled/expired (reservation released)
 * 2. Cart is paid AND stock_decremented_at is set (stock permanently decremented)
 * 
 * This ensures:
 * - Active reservations block stock on catalog
 * - Paid carts waiting for stock decrement still block stock
 * - Cancelled/expired carts don't block stock
 */
export function useLiveReservedStock() {
  const [reservedStock, setReservedStock] = useState<Record<string, Record<string, number>>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchReservedStock = useCallback(async () => {
    try {
      // Get all reserved items from carts that haven't had stock decremented yet
      // This includes: aberto, em_confirmacao, aguardando_pagamento, pago (before decrement)
      const { data, error } = await supabase
        .from("live_cart_items")
        .select(`
          product_id,
          variante,
          qtd,
          status,
          live_cart:live_carts(
            status,
            stock_decremented_at,
            live_event:live_events(status)
          )
        `)
        .in("status", ["reservado", "confirmado"]);

      if (error) throw error;

      const stockMap: Record<string, Record<string, number>> = {};

      (data || []).forEach((item: any) => {
        const cartStatus = item.live_cart?.status;
        const stockDecrementedAt = item.live_cart?.stock_decremented_at;
        
        // Skip cancelled/expired carts - they don't reserve stock
        if (['cancelado', 'expirado'].includes(cartStatus)) {
          return;
        }
        
        // Skip carts where stock has already been decremented
        // (these are paid carts that have been processed)
        if (stockDecrementedAt) {
          return;
        }
        
        // All other carts reserve stock:
        // - aberto, em_confirmacao, aguardando_pagamento (pre-payment)
        // - pago but stock_decremented_at IS NULL (waiting for decrement)
        const productId = item.product_id;
        const size = item.variante?.tamanho || '';
        
        if (!stockMap[productId]) stockMap[productId] = {};
        stockMap[productId][size] = (stockMap[productId][size] || 0) + item.qtd;
      });

      setReservedStock(stockMap);
    } catch (err) {
      console.error("Error fetching reserved stock:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservedStock();
    
    // Subscribe to realtime changes for live_carts and live_cart_items
    const channel = supabase
      .channel('live-stock-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_carts' },
        () => fetchReservedStock()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_cart_items' },
        () => fetchReservedStock()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReservedStock]);

  const getReservedForProduct = useCallback((productId: string): Record<string, number> => {
    return reservedStock[productId] || {};
  }, [reservedStock]);

  const getReservedForSize = useCallback((productId: string, size: string): number => {
    return reservedStock[productId]?.[size] || 0;
  }, [reservedStock]);

  const getAvailableStock = useCallback((
    productId: string, 
    size: string, 
    totalStock: number
  ): number => {
    const reserved = getReservedForSize(productId, size);
    return Math.max(0, totalStock - reserved);
  }, [getReservedForSize]);

  return {
    reservedStock,
    isLoading,
    getReservedForProduct,
    getReservedForSize,
    getAvailableStock,
    refresh: fetchReservedStock,
  };
}
