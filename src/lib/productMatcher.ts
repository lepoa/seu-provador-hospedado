import type { ImageAnalysisResult } from "@/hooks/useImageAnalysis";

export interface MatchedProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  sizes: string[];
  stock_by_size: Record<string, number>;
  is_active: boolean;
  category: string | null;
  color: string | null;
  style: string | null;
  occasion: string | null;
  modeling: string | null;
  tags: string[];
  group_key: string | null;
  score: number;
  matchReasons: string[]; // Human-readable reasons in Portuguese
  matchDetails: {
    category: boolean;
    color: boolean;
    style: boolean;
    occasion: boolean;
    modeling: boolean;
    matchingTags: string[];
  };
  /** True when the product matched the analysis but has no stock in the selected sizes */
  outOfStockInSelectedSize?: boolean;
}

export interface MatchResultWithFallback {
  /** The best-matching product from analysis, even if out of stock in selected size */
  identifiedProduct: MatchedProduct | null;
  /** Alternative products that DO have stock in the selected sizes */
  alternatives: MatchedProduct[];
  /** Whether any product in catalog has stock in selected sizes */
  hasStockAvailable: boolean;
}

interface ProductCatalogRow {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  sizes: string[] | null;
  stock_by_size: Record<string, number> | null;
  is_active: boolean | null;
  category: string | null;
  color: string | null;
  style: string | null;
  occasion: string | null;
  modeling: string | null;
  tags: string[] | null;
  group_key: string | null;
}

// Refinement mode types
export type RefinementMode = 
  | "default" 
  | "color" 
  | "modeling" 
  | "elegant" 
  | "casual" 
  | "category";

// Weight configurations for each refinement mode
const WEIGHT_CONFIGS: Record<RefinementMode, {
  category: number;
  color: number;
  modeling: number;
  details: number;
  style: number;
  tagBonus?: string[];
}> = {
  default: {
    category: 35,
    color: 20,
    modeling: 20,
    details: 15,
    style: 10,
  },
  color: {
    category: 25,
    color: 35,
    modeling: 20,
    details: 10,
    style: 10,
  },
  modeling: {
    category: 25,
    color: 20,
    modeling: 35,
    details: 10,
    style: 10,
  },
  elegant: {
    category: 25,
    color: 20,
    modeling: 20,
    details: 10,
    style: 25,
    tagBonus: ["elegante", "alfaiataria", "sofisticado", "clássico", "chic"],
  },
  casual: {
    category: 25,
    color: 20,
    modeling: 20,
    details: 10,
    style: 25,
    tagBonus: ["casual", "dia a dia", "básico", "confortável", "despojado"],
  },
  category: {
    category: 45,
    color: 20,
    modeling: 20,
    details: 10,
    style: 5,
  },
};

export const MIN_SCORE_THRESHOLD = 25;

function normalizeValue(value: string | null | undefined): string {
  if (!value) return "";
  return value.toLowerCase().trim().replace(/[_-]/g, " ");
}

function valuesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const normalA = normalizeValue(a);
  const normalB = normalizeValue(b);
  if (!normalA || !normalB) return false;
  return normalA === normalB;
}

// Color family matching
function colorsAreSimilar(a: string | null | undefined, b: string | null | undefined): boolean {
  if (valuesMatch(a, b)) return true;
  
  const colorFamilies: Record<string, string[]> = {
    neutro: ["preto", "branco", "cinza", "bege", "nude", "off white", "creme", "areia"],
    quente: ["vermelho", "laranja", "amarelo", "dourado", "coral", "terracota", "mostarda"],
    frio: ["azul", "verde", "roxo", "prata", "turquesa", "menta", "lavanda"],
    rosa: ["rosa", "pink", "magenta", "coral", "salmão", "blush"],
    marrom: ["marrom", "caramelo", "chocolate", "café", "terra", "camel"],
    vinho: ["vinho", "bordô", "marsala", "burgundy", "cereja"],
  };
  
  const normalA = normalizeValue(a);
  const normalB = normalizeValue(b);
  
  for (const family of Object.values(colorFamilies)) {
    const hasA = family.some(c => normalA.includes(c));
    const hasB = family.some(c => normalB.includes(c));
    if (hasA && hasB) return true;
  }
  
  return false;
}

// Check if product has stock in any of the customer's selected sizes
function hasStockInSizes(
  stockBySize: Record<string, number> | null,
  letterSizes: string[],
  numberSizes: string[]
): boolean {
  if (!stockBySize) return false;
  
  // Check for "Tamanho Único" (UN/U) - always available
  if ((stockBySize["UN"] && stockBySize["UN"] > 0) || 
      (stockBySize["U"] && stockBySize["U"] > 0)) {
    return true;
  }
  
  // Check all selected letter sizes
  for (const size of letterSizes) {
    const normalizedSize = size.toUpperCase().trim();
    if (stockBySize[normalizedSize] && stockBySize[normalizedSize] > 0) {
      return true;
    }
  }
  
  // Check all selected number sizes
  for (const size of numberSizes) {
    const normalizedSize = size.trim();
    if (stockBySize[normalizedSize] && stockBySize[normalizedSize] > 0) {
      return true;
    }
  }
  
  return false;
}

export function calculateProductScore(
  product: ProductCatalogRow,
  analysis: ImageAnalysisResult,
  mode: RefinementMode = "default"
): { score: number; matchDetails: MatchedProduct["matchDetails"]; matchReasons: string[] } {
  const weights = WEIGHT_CONFIGS[mode];
  let score = 0;
  const matchReasons: string[] = [];
  const matchDetails: MatchedProduct["matchDetails"] = {
    category: false,
    color: false,
    style: false,
    occasion: false,
    modeling: false,
    matchingTags: [],
  };

  // Category match
  if (valuesMatch(product.category, analysis.categoria?.value)) {
    score += weights.category;
    matchDetails.category = true;
    matchReasons.push("categoria");
  }

  // Color match (uses family matching)
  if (colorsAreSimilar(product.color, analysis.cor?.value)) {
    score += weights.color;
    matchDetails.color = true;
    matchReasons.push("cor");
  }

  // Modeling match
  if (valuesMatch(product.modeling, analysis.modelagem?.value)) {
    score += weights.modeling;
    matchDetails.modeling = true;
    matchReasons.push("modelagem");
  }

  // Style match
  if (valuesMatch(product.style, analysis.estilo?.value)) {
    score += weights.style;
    matchDetails.style = true;
    matchReasons.push("estilo");
  }

  // Occasion match (bonus, not in main weights)
  if (valuesMatch(product.occasion, analysis.ocasiao?.value)) {
    matchDetails.occasion = true;
  }

  // Tags/details matching
  const analysisTags = analysis.tags_extras || [];
  const productTags = product.tags || [];
  
  let tagMatchCount = 0;
  const maxTagMatches = 3;
  
  for (const analysisTag of analysisTags) {
    if (tagMatchCount >= maxTagMatches) break;
    
    const normalizedAnalysisTag = normalizeValue(analysisTag);
    for (const productTag of productTags) {
      const normalizedProductTag = normalizeValue(productTag);
      if (normalizedAnalysisTag && normalizedProductTag && 
          (normalizedAnalysisTag.includes(normalizedProductTag) || 
           normalizedProductTag.includes(normalizedAnalysisTag))) {
        tagMatchCount++;
        matchDetails.matchingTags.push(productTag);
        break;
      }
    }
  }
  
  if (tagMatchCount > 0) {
    score += Math.round((tagMatchCount / maxTagMatches) * weights.details);
    matchReasons.push("detalhes");
  }

  // Tag bonus for elegant/casual modes
  if (weights.tagBonus && productTags.length > 0) {
    const hasBonus = weights.tagBonus.some(bonus => 
      productTags.some(tag => normalizeValue(tag).includes(normalizeValue(bonus)))
    );
    if (hasBonus) {
      score += 10; // Bonus points
    }
  }

  return { score, matchDetails, matchReasons };
}

export interface FindMatchesOptions {
  letterSizes: string[];
  numberSizes: string[];
  limit?: number;
  refinementMode?: RefinementMode;
}

export function findMatchingProducts(
  products: ProductCatalogRow[],
  analysis: ImageAnalysisResult,
  options: FindMatchesOptions
): MatchedProduct[] {
  const { letterSizes, numberSizes, limit = 9, refinementMode = "default" } = options;
  
  const scoredProducts: MatchedProduct[] = [];

  for (const product of products) {
    // CRITICAL: Skip products without stock in customer's sizes
    if (!hasStockInSizes(product.stock_by_size, letterSizes, numberSizes)) {
      continue;
    }
    
    // Skip inactive products
    if (!product.is_active) {
      continue;
    }

    const { score, matchDetails, matchReasons } = calculateProductScore(
      product, 
      analysis, 
      refinementMode
    );

    scoredProducts.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      sizes: product.sizes || [],
      stock_by_size: product.stock_by_size || {},
      is_active: product.is_active ?? true,
      category: product.category,
      color: product.color,
      style: product.style,
      occasion: product.occasion,
      modeling: product.modeling,
      tags: product.tags || [],
      group_key: product.group_key,
      score,
      matchReasons,
      matchDetails,
    });
  }

  // Sort by score descending
  scoredProducts.sort((a, b) => b.score - a.score);

  return scoredProducts.slice(0, limit);
}

// Helper to check if any products have stock
export function hasAnyProductsInStock(
  products: ProductCatalogRow[],
  letterSizes: string[],
  numberSizes: string[]
): boolean {
  return products.some(p => 
    p.is_active && hasStockInSizes(p.stock_by_size, letterSizes, numberSizes)
  );
}

/**
 * Enhanced matching: returns the best identified product (even if out of stock)
 * plus alternatives that have stock in the selected sizes.
 */
export function findMatchingProductsWithFallback(
  products: ProductCatalogRow[],
  analysis: ImageAnalysisResult,
  options: FindMatchesOptions
): MatchResultWithFallback {
  const { letterSizes, numberSizes, limit = 9, refinementMode = "default" } = options;

  // Score ALL active products regardless of stock
  const allScored: (MatchedProduct & { _hasStock: boolean })[] = [];

  for (const product of products) {
    if (!product.is_active) continue;

    const hasStock = hasStockInSizes(product.stock_by_size, letterSizes, numberSizes);
    const { score, matchDetails, matchReasons } = calculateProductScore(
      product, analysis, refinementMode
    );

    allScored.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      sizes: product.sizes || [],
      stock_by_size: product.stock_by_size || {},
      is_active: product.is_active ?? true,
      category: product.category,
      color: product.color,
      style: product.style,
      occasion: product.occasion,
      modeling: product.modeling,
      tags: product.tags || [],
      group_key: product.group_key,
      score,
      matchReasons,
      matchDetails,
      outOfStockInSelectedSize: !hasStock,
      _hasStock: hasStock,
    });
  }

  // Sort all by score descending
  allScored.sort((a, b) => b.score - a.score);

  // The identified product is the highest-scoring one (regardless of stock)
  const bestOverall = allScored.length > 0 ? allScored[0] : null;

  // Alternatives: only products WITH stock, excluding the identified product
  const withStock = allScored.filter(p => p._hasStock);
  const hasStockAvailable = withStock.length > 0;

  let identifiedProduct: MatchedProduct | null = null;
  let alternatives: MatchedProduct[] = [];

  if (bestOverall) {
    // Strip internal field
    const { _hasStock, ...identified } = bestOverall;
    identifiedProduct = identified;

    if (bestOverall._hasStock) {
      // Identified product has stock → it's the top result, alternatives are the rest with stock
      alternatives = withStock
        .filter(p => p.id !== bestOverall.id)
        .slice(0, limit - 1)
        .map(({ _hasStock: _, ...p }) => p);
    } else {
      // Identified product is out of stock → alternatives are all with stock
      alternatives = withStock
        .slice(0, limit)
        .map(({ _hasStock: _, ...p }) => p);
    }
  }

  return { identifiedProduct, alternatives, hasStockAvailable };
}
