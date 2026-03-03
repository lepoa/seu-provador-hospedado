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

function normalizeField(input: unknown): { value: string | null; confidence: number } {
  if (!input || typeof input !== "object") {
    return { value: null, confidence: 0 };
  }

  const value = (input as Record<string, unknown>).value;
  const confidence = (input as Record<string, unknown>).confidence;

  return {
    value: typeof value === "string" ? value : null,
    confidence: typeof confidence === "number" && Number.isFinite(confidence) ? confidence : 0,
  };
}

function normalizeTags(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.filter((tag): tag is string => typeof tag === "string");
  }
  if (typeof input === "string") {
    return input.trim() ? [input.trim()] : [];
  }
  if (input && typeof input === "object") {
    return Object.values(input as Record<string, unknown>).filter(
      (tag): tag is string => typeof tag === "string"
    );
  }
  return [];
}

function normalizeAnalysis(analysis: ImageAnalysisResult): ImageAnalysisResult {
  return {
    categoria: normalizeField(analysis.categoria),
    cor: normalizeField(analysis.cor),
    estilo: normalizeField(analysis.estilo),
    ocasiao: normalizeField(analysis.ocasiao),
    modelagem: normalizeField(analysis.modelagem),
    tags_extras: normalizeTags((analysis as { tags_extras?: unknown }).tags_extras),
    resumo_visual:
      typeof (analysis as { resumo_visual?: unknown }).resumo_visual === "string"
        ? (analysis as { resumo_visual: string }).resumo_visual
        : undefined,
  };
}

const RELAXED_FALLBACK_ANALYSIS: ImageAnalysisResult = {
  categoria: { value: null, confidence: 0 },
  cor: { value: null, confidence: 0 },
  estilo: { value: null, confidence: 0 },
  ocasiao: { value: null, confidence: 0 },
  modelagem: { value: null, confidence: 0 },
  tags_extras: [],
};

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
        const { data: rawProducts, error } = await supabase
          .from("product_catalog")
          .select("*");

        if (error) {
          if (import.meta.env.DEV) {
            console.error("[product-matcher] Error fetching products:", error);
          }
          setResult(empty);
          return empty;
        }

        const products = (rawProducts || []).filter((product) => product.is_active !== false);

        if (!products || products.length === 0) {
          if (import.meta.env.DEV) {
            console.error("[product-matcher] No active products available.");
          }
          setResult(empty);
          return empty;
        }

        // Prefer normalized available stock from view (same source used in admin).
        const { data: stockRows, error: stockError } = await supabase
          .from("public_product_stock")
          .select("product_id, size, available")
          .gt("available", 0);

        if (stockError && import.meta.env.DEV) {
          console.error("[product-matcher] Error fetching public_product_stock:", stockError);
        }

        const availableByProduct = new Map<string, Record<string, number>>();
        (stockRows || []).forEach((row) => {
          if (!row.product_id || !row.size) return;
          const size = String(row.size).trim();
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

        const normalizedAnalysis = normalizeAnalysis(analysis);
        let matchResult = findMatchingProductsWithFallback(productsWithStock, normalizedAnalysis, options);

        // Last-resort fallback for demos/production stability: never return blank while catalog exists.
        if (!matchResult.identifiedProduct && matchResult.alternatives.length === 0) {
          matchResult = findMatchingProductsWithFallback(
            productsWithStock,
            RELAXED_FALLBACK_ANALYSIS,
            options
          );
        }

        if (
          import.meta.env.DEV &&
          !matchResult.identifiedProduct &&
          matchResult.alternatives.length === 0
        ) {
          console.error("[product-matcher] Matcher returned empty result.", {
            products: products.length,
            stockRows: stockRows?.length || 0,
            options,
            analysis: normalizedAnalysis,
          });
        }

        setResult(matchResult);
        return matchResult;
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("[product-matcher] Error finding matches:", err);
        }
        setResult(empty);
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
