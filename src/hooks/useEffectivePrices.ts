import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface EffectivePriceData {
  product_id: string;
  original_price: number;
  effective_price: number;
  promotion_id: string | null;
  promotion_name: string | null;
  discount_type: string | null;
  discount_value: number | null;
  discount_source: string | null;
  debug_info: {
    checked_at: string;
    channel: string;
    product_discount: {
      type: string | null;
      value: number | null;
    };
    promotional_discount: {
      promotion_id: string;
      promotion_name: string;
      type: string;
      value: number;
      source: string;
      priority: number;
    } | null;
    active_promotions_count: number;
  };
}

interface UseEffectivePricesOptions {
  channel?: 'catalog' | 'live' | 'all';
  productIds?: string[];
  enabled?: boolean;
}

/**
 * Hook to get effective prices for products applying promotional tables
 */
export function useEffectivePrices(options: UseEffectivePricesOptions = {}) {
  const { channel = 'catalog', productIds, enabled = true } = options;

  // Normalize IDs into a stable key so this hook does not refetch on every render.
  const stableProductIdsKey = useMemo(() => {
    if (!productIds || productIds.length === 0) return '';
    const uniqueSorted = Array.from(new Set(productIds.filter(Boolean))).sort();
    return uniqueSorted.join(',');
  }, [productIds?.join(',')]);
  
  const [priceData, setPriceData] = useState<Map<string, EffectivePriceData>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Call the RPC function
      const rpcProductIds = stableProductIdsKey ? stableProductIdsKey.split(',') : null;
      const { data, error: rpcError } = await supabase.rpc('get_products_effective_prices', {
        p_channel: channel,
        p_product_ids: rpcProductIds
      });

      if (rpcError) {
        console.error('[useEffectivePrices] RPC error:', rpcError);
        setError(rpcError.message);
        return;
      }

      // Build a map for fast lookup
      const priceMap = new Map<string, EffectivePriceData>();
      (data || []).forEach((item: EffectivePriceData) => {
        priceMap.set(item.product_id, item);
      });

      setPriceData(priceMap);
    } catch (err) {
      console.error('[useEffectivePrices] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [channel, stableProductIdsKey, enabled]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Get effective price for a specific product
  const getEffectivePrice = useCallback((productId: string, fallbackPrice: number): number => {
    const data = priceData.get(productId);
    return data?.effective_price ?? fallbackPrice;
  }, [priceData]);

  // Get original price for a specific product
  const getOriginalPrice = useCallback((productId: string, fallbackPrice: number): number => {
    const data = priceData.get(productId);
    return data?.original_price ?? fallbackPrice;
  }, [priceData]);

  // Check if product has any discount
  const hasDiscount = useCallback((productId: string): boolean => {
    const data = priceData.get(productId);
    if (!data) return false;
    return data.effective_price < data.original_price;
  }, [priceData]);

  // Get discount percentage
  const getDiscountPercent = useCallback((productId: string): number => {
    const data = priceData.get(productId);
    if (!data || data.effective_price >= data.original_price) return 0;
    return Math.round(((data.original_price - data.effective_price) / data.original_price) * 100);
  }, [priceData]);

  // Get discount label
  const getDiscountLabel = useCallback((productId: string): string | null => {
    const data = priceData.get(productId);
    if (!data || !data.discount_type || data.effective_price >= data.original_price) return null;
    
    if (data.discount_type === 'percentage' && data.discount_value) {
      return `-${data.discount_value}%`;
    } else if (data.discount_type === 'fixed' && data.discount_value) {
      return `-R$ ${data.discount_value.toFixed(2)}`;
    }
    return null;
  }, [priceData]);

  // Get promotion info for a product
  const getPromotionInfo = useCallback((productId: string): EffectivePriceData | null => {
    return priceData.get(productId) || null;
  }, [priceData]);

  // Get all data as array
  const allPriceData = useMemo(() => Array.from(priceData.values()), [priceData]);

  return {
    priceData,
    allPriceData,
    isLoading,
    error,
    refetch: fetchPrices,
    getEffectivePrice,
    getOriginalPrice,
    hasDiscount,
    getDiscountPercent,
    getDiscountLabel,
    getPromotionInfo,
  };
}

/**
 * Hook for a single product's effective price
 */
export function useSingleProductEffectivePrice(productId: string | undefined, channel: 'catalog' | 'live' = 'catalog') {
  const [data, setData] = useState<EffectivePriceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!productId) {
      setIsLoading(false);
      return;
    }

    async function fetchPrice() {
      try {
        setIsLoading(true);
        const { data: result, error } = await supabase.rpc('get_products_effective_prices', {
          p_channel: channel,
          p_product_ids: [productId]
        });

        if (error) {
          console.error('[useSingleProductEffectivePrice] Error:', error);
          return;
        }

        if (result && result.length > 0) {
          setData(result[0] as EffectivePriceData);
        }
      } catch (err) {
        console.error('[useSingleProductEffectivePrice] Error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPrice();
  }, [productId, channel]);

  const hasDiscount = data ? data.effective_price < data.original_price : false;
  const discountPercent = hasDiscount && data 
    ? Math.round(((data.original_price - data.effective_price) / data.original_price) * 100)
    : 0;

  return {
    data,
    isLoading,
    effectivePrice: data?.effective_price ?? 0,
    originalPrice: data?.original_price ?? 0,
    hasDiscount,
    discountPercent,
    promotionName: data?.promotion_name ?? null,
    discountSource: data?.discount_source ?? null,
  };
}
