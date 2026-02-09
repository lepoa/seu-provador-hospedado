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

        const productsWithStock = products.map(p => ({
          ...p,
          stock_by_size: typeof p.stock_by_size === 'object' ? p.stock_by_size as Record<string, number> : null
        }));

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
