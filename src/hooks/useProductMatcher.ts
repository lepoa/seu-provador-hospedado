import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ImageAnalysisResult } from "@/hooks/useImageAnalysis";
import { 
  findMatchingProductsWithFallback, 
  type MatchedProduct, 
  type MatchResultWithFallback,
  type FindMatchesOptions,
  type RefinementMode 
} from "@/lib/productMatcher";

export function useProductMatcher() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MatchResultWithFallback>({
    identifiedProduct: null,
    alternatives: [],
    hasStockAvailable: true,
  });

  const findMatches = useCallback(
    async (
      analysis: ImageAnalysisResult, 
      options: FindMatchesOptions
    ): Promise<MatchResultWithFallback> => {
      setIsLoading(true);
      const empty: MatchResultWithFallback = { identifiedProduct: null, alternatives: [], hasStockAvailable: false };
      setResult({ identifiedProduct: null, alternatives: [], hasStockAvailable: true });

      try {
        const { data: products, error } = await supabase
          .from("product_catalog")
          .select("id, name, price, image_url, sizes, stock_by_size, is_active, category, color, style, occasion, modeling, tags, group_key")
          .eq("is_active", true);

        if (error) {
          console.error("Error fetching products:", error);
          return empty;
        }

        if (!products || products.length === 0) {
          setResult(empty);
          return empty;
        }

        // Prefer normalized available stock from view (same source used in admin).
        const { data: stockRows } = await supabase
          .from("public_product_stock")
          .select("product_id, size, available")
          .gt("available", 0);

        const availableByProduct = new Map<string, Record<string, number>>();
        (stockRows || []).forEach((row) => {
          if (!row.product_id || !row.size) return;
          const size = row.size.trim();
          const qty = Number(row.available ?? 0);
          if (!Number.isFinite(qty) || qty <= 0) return;

          if (!availableByProduct.has(row.product_id)) {
            availableByProduct.set(row.product_id, {});
          }
          availableByProduct.get(row.product_id)![size] = qty;
        });

        const productsWithStock = products.map(p => {
          const fallbackStock =
            typeof p.stock_by_size === "object" && p.stock_by_size
              ? (p.stock_by_size as Record<string, number>)
              : null;
          const viewStock = availableByProduct.get(p.id) || null;

          return {
          ...p,
          stock_by_size: viewStock || fallbackStock
        };
        });

        const matchResult = findMatchingProductsWithFallback(productsWithStock, analysis, options);
        setResult(matchResult);
        return matchResult;
      } catch (err) {
        console.error("Error finding matches:", err);
        return empty;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearMatches = useCallback(() => {
    setResult({ identifiedProduct: null, alternatives: [], hasStockAvailable: true });
  }, []);

  return {
    isLoading,
    identifiedProduct: result.identifiedProduct,
    alternatives: result.alternatives,
    hasStockAvailable: result.hasStockAvailable,
    findMatches,
    clearMatches,
  };
}

export type { RefinementMode };
