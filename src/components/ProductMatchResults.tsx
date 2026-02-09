import { Check, Package, AlertCircle, Star, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { MatchedProduct } from "@/lib/productMatcher";
import { MIN_SCORE_THRESHOLD } from "@/lib/productMatcher";

interface ProductMatchResultsProps {
  products: MatchedProduct[];
  customerSize?: string | null;
  onLinkProduct?: (productId: string) => void;
  linkedProductId?: string | null;
  showLinkAction?: boolean;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);
}

function ProductCard({
  product,
  isBestMatch,
  onLink,
  isLinked,
  showLinkAction,
}: {
  product: MatchedProduct;
  isBestMatch?: boolean;
  onLink?: () => void;
  isLinked?: boolean;
  showLinkAction?: boolean;
}) {
  const hasExactMatch = product.score >= MIN_SCORE_THRESHOLD;

  return (
    <Card className={`overflow-hidden transition-all ${isBestMatch ? "ring-2 ring-accent shadow-lg" : ""} ${isLinked ? "ring-2 ring-green-500" : ""}`}>
      <div className="relative">
        <div className="w-full aspect-[4/5] bg-stone-50 flex items-center justify-center">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <Package className="h-10 w-10 text-muted-foreground" />
          )}
        </div>
        
        {isBestMatch && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-accent text-accent-foreground">
              <Star className="h-3 w-3 mr-1" />
              Mais provável
            </Badge>
          </div>
        )}

        {isLinked && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-green-500 text-white">
              <Check className="h-3 w-3 mr-1" />
              Vinculado
            </Badge>
          </div>
        )}

        {!product.is_active && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Badge variant="secondary">Inativo</Badge>
          </div>
        )}
      </div>

      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm line-clamp-2">{product.name}</h4>
          <Badge variant="outline" className="shrink-0 text-xs">
            {product.score} pts
          </Badge>
        </div>

        <p className="font-semibold text-accent">{formatPrice(product.price)}</p>

        {product.sizes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.sizes.slice(0, 5).map((size) => (
              <Badge key={size} variant="secondary" className="text-xs px-1.5 py-0">
                {size}
              </Badge>
            ))}
            {product.sizes.length > 5 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                +{product.sizes.length - 5}
              </Badge>
            )}
          </div>
        )}

        {/* Match indicators */}
        <div className="flex flex-wrap gap-1 text-xs">
          {product.matchDetails.category && (
            <Badge variant="outline" className="text-green-600 border-green-300 text-xs px-1.5 py-0">
              categoria ✓
            </Badge>
          )}
          {product.matchDetails.color && (
            <Badge variant="outline" className="text-green-600 border-green-300 text-xs px-1.5 py-0">
              cor ✓
            </Badge>
          )}
          {product.matchDetails.style && (
            <Badge variant="outline" className="text-green-600 border-green-300 text-xs px-1.5 py-0">
              estilo ✓
            </Badge>
          )}
        </div>

        {showLinkAction && onLink && (
          <Button
            size="sm"
            variant={isLinked ? "secondary" : "default"}
            className="w-full mt-2"
            onClick={onLink}
            disabled={isLinked}
          >
            {isLinked ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                Vinculado
              </>
            ) : (
              <>
                <Link2 className="h-3 w-3 mr-1" />
                Vincular ao print
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function ProductMatchResults({
  products,
  customerSize,
  onLinkProduct,
  linkedProductId,
  showLinkAction = false,
}: ProductMatchResultsProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-8 px-4 bg-muted/50 rounded-xl">
        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h4 className="font-medium mb-2">Nenhum produto encontrado</h4>
        <p className="text-sm text-muted-foreground">
          {customerSize 
            ? `Não encontramos produtos no tamanho ${customerSize}. Tente sem filtro de tamanho.`
            : "Cadastre produtos no catálogo para ver sugestões."}
        </p>
      </div>
    );
  }

  const bestMatch = products[0];
  const similarProducts = products.slice(1);
  const hasBestMatchAboveThreshold = bestMatch.score >= MIN_SCORE_THRESHOLD;

  return (
    <div className="space-y-4">
      {/* Warning if no exact match */}
      {!hasBestMatchAboveThreshold && (
        <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
          <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-200 text-sm">
              Não encontramos exatamente essa peça
            </p>
            <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-1">
              {customerSize 
                ? `Mas aqui estão os mais parecidos no tamanho ${customerSize}!`
                : "Mas aqui estão os produtos mais parecidos do catálogo!"}
            </p>
          </div>
        </div>
      )}

      {/* Best match */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
          <Star className="h-4 w-4" />
          {hasBestMatchAboveThreshold ? "Produto mais provável" : "Melhor correspondência"}
        </h4>
        <ProductCard
          product={bestMatch}
          isBestMatch
          onLink={onLinkProduct ? () => onLinkProduct(bestMatch.id) : undefined}
          isLinked={linkedProductId === bestMatch.id}
          showLinkAction={showLinkAction}
        />
      </div>

      {/* Similar products */}
      {similarProducts.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            Produtos similares ({similarProducts.length})
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {similarProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onLink={onLinkProduct ? () => onLinkProduct(product.id) : undefined}
                isLinked={linkedProductId === product.id}
                showLinkAction={showLinkAction}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
