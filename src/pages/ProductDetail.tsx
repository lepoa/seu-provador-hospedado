import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ShoppingBag, Heart, Share2, Package, ChevronLeft, ChevronRight, AlertCircle, Play, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { BenefitsBar } from "@/components/BenefitsBar";
import { ProductCard } from "@/components/ProductCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";
import { getAvailableSizes as getStockSizes, getStockLevel, isLowStock } from "@/components/StockBySize";
import { useSingleProductStock } from "@/hooks/useProductAvailableStock";
import { useSingleProductEffectivePrice } from "@/hooks/useEffectivePrices";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  images: string[] | null;
  video_url: string | null;
  main_image_index: number | null;
  category: string | null;
  color: string | null;
  sizes: string[];
  style: string | null;
  occasion: string | null;
  modeling: string | null;
  tags: string[];
  description: string | null;
  stock_by_size: Record<string, number> | null | unknown;
  discount_type?: 'percentage' | 'fixed' | null;
  discount_value?: number | null;
}

const ProductDetail = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite, isLoading: favoritesLoading } = useFavorites();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Use centralized stock hook that considers live reservations
  const { 
    availableSizes, 
    available, 
    isLowStock: isSizeLowStock, 
    isProductOutOfStock,
    isLoading: stockLoading 
  } = useSingleProductStock(productId);

  // Use effective price from promotional tables
  const {
    effectivePrice,
    originalPrice,
    hasDiscount: hasPromotionalDiscount,
    discountPercent,
    promotionName,
    isLoading: priceLoading
  } = useSingleProductEffectivePrice(productId, 'catalog');

  useEffect(() => {
    async function loadProduct() {
      if (!productId) return;

      try {
        const { data: productData, error: productError } = await supabase
          .from("product_catalog")
          .select("*")
          .eq("id", productId)
          .single();

        if (productError) throw productError;
        setProduct(productData);
        setCurrentImageIndex(productData.main_image_index || 0);

        if (productData) {
          const { data: relatedData, error: relatedError } = await supabase
            .from("product_catalog")
            .select("*")
            .eq("is_active", true)
            .neq("id", productId)
            .or(`category.eq.${productData.category},style.eq.${productData.style}`)
            .limit(4);

          if (!relatedError) {
            setRelatedProducts(relatedData || []);
          }
        }
      } catch (error) {
        console.error("Error loading product:", error);
        toast.error("Produto não encontrado");
      } finally {
        setIsLoading(false);
      }
    }

    loadProduct();
  }, [productId]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  // Get all images
  const allImages = product?.images?.length ? product.images : (product?.image_url ? [product.image_url] : []);

  // Calculate discounted price - use promotional tables first, then fall back to product discount
  const finalPrice = hasPromotionalDiscount 
    ? effectivePrice 
    : (product?.price || 0);
  const showDiscount = hasPromotionalDiscount || (product?.discount_value && product.discount_value > 0);
  const discountLabel = hasPromotionalDiscount 
    ? (discountPercent > 0 ? `-${discountPercent}%` : `-R$ ${((originalPrice || product?.price || 0) - effectivePrice).toFixed(2)}`)
    : null;

  const handleAddToCart = () => {
    if (!product || !productId) return;
    if (!selectedSize) {
      toast.error("Selecione um tamanho");
      return;
    }
    
    // Check available stock from centralized view
    const availableStock = available(selectedSize);
    if (availableStock <= 0) {
      toast.error("Tamanho esgotado no momento");
      return;
    }
    
    // Use the discounted price for the cart
    addItem({
      productId: product.id,
      name: product.name,
      price: finalPrice, // Final discounted price
      originalPrice: product.price, // Original price
      discountPercent: discountPercent,
      size: selectedSize,
      imageUrl: allImages[0] || product.image_url,
    });
    toast.success("Adicionado ao carrinho!");
    navigate("/carrinho");
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: product?.name,
        text: `Confira essa peça linda: ${product?.name}`,
        url: window.location.href,
      });
    } catch {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado!");
    }
  };

  const handleToggleFavorite = async () => {
    if (!user) {
      toast.info("Faça login para salvar favoritos");
      navigate("/entrar");
      return;
    }
    
    if (!productId) return;
    await toggleFavorite(productId);
  };
  
  const productIsFavorite = productId ? isFavorite(productId) : false;

  const nextImage = () => {
    if (allImages.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
      setShowVideo(false);
    }
  };

  const prevImage = () => {
    if (allImages.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
      setShowVideo(false);
    }
  };

  if (isLoading || stockLoading || priceLoading) {
    return (
      <div className="min-h-screen bg-background">
        <BenefitsBar />
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="aspect-[3/4] md:aspect-square bg-secondary rounded-xl mb-6" />
            <div className="h-6 bg-secondary rounded w-3/4 mb-3" />
            <div className="h-8 bg-secondary rounded w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <BenefitsBar />
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="font-serif text-2xl mb-4">Produto não encontrado</h1>
          <Link to="/catalogo">
            <Button variant="outline">Ver catálogo</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <BenefitsBar />
      <Header />

      <main className="container mx-auto px-4 py-6">
        {/* Back Button */}
        <Link
          to="/catalogo"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao catálogo
        </Link>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Product Image Gallery */}
          <div className="space-y-4">
            <div className="relative aspect-[3/4] bg-secondary rounded-xl overflow-hidden">
              {showVideo && product.video_url ? (
                <video 
                  src={product.video_url} 
                  controls 
                  autoPlay
                  className="w-full h-full object-contain bg-black"
                />
              ) : allImages.length > 0 ? (
                <img
                  src={allImages[currentImageIndex]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-16 w-16 text-muted-foreground" />
                </div>
              )}

              {/* Navigation arrows */}
              {allImages.length > 1 && !showVideo && (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-80 hover:opacity-100"
                    onClick={prevImage}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-80 hover:opacity-100"
                    onClick={nextImage}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {(allImages.length > 1 || product.video_url) && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentImageIndex(idx);
                      setShowVideo(false);
                    }}
                    className={`flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                      currentImageIndex === idx && !showVideo
                        ? "border-accent"
                        : "border-transparent"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
                {product.video_url && (
                  <button
                    onClick={() => setShowVideo(true)}
                    className={`flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden border-2 transition-colors bg-black flex items-center justify-center ${
                      showVideo ? "border-accent" : "border-transparent"
                    }`}
                  >
                    <Play className="h-6 w-6 text-white" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Category Badge */}
            {product.category && (
              <span className="inline-block text-xs font-medium text-accent uppercase tracking-wide">
                {product.category}
              </span>
            )}

            <h1 className="font-serif text-3xl md:text-4xl">{product.name}</h1>

            {/* Price with discount display */}
            <div className="flex items-center gap-3">
              {showDiscount ? (
                <>
                  <p className="text-2xl font-semibold text-green-600">{formatPrice(finalPrice)}</p>
                  <p className="text-lg text-muted-foreground line-through">{formatPrice(originalPrice || product.price)}</p>
                  {discountLabel && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {discountLabel}
                    </Badge>
                  )}
                  {promotionName && (
                    <Badge variant="outline" className="text-xs">
                      {promotionName}
                    </Badge>
                  )}
                </>
              ) : (
                <p className="text-2xl font-semibold">{formatPrice(product.price)}</p>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-muted-foreground">{product.description}</p>
            )}

            {/* Details */}
            <div className="space-y-2 text-sm text-muted-foreground">
              {product.color && (
                <p>
                  <span className="font-medium text-foreground">Cor:</span> {product.color}
                </p>
              )}
              {product.style && (
                <p>
                  <span className="font-medium text-foreground">Estilo:</span> {product.style}
                </p>
              )}
              {product.occasion && (
                <p>
                  <span className="font-medium text-foreground">Ocasião:</span> {product.occasion}
                </p>
              )}
              {product.modeling && (
                <p>
                  <span className="font-medium text-foreground">Modelagem:</span> {product.modeling}
                </p>
              )}
            </div>

            {/* Sizes - Using centralized stock view */}
            {availableSizes.length > 0 ? (
              <div>
                <label className="text-sm font-medium mb-3 block">
                  Tamanhos disponíveis
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableSizes.map((size) => {
                    const stockAvailable = available(size);
                    const lowStock = isSizeLowStock(size);
                    
                    return (
                      <div key={size} className="relative">
                        <button
                          onClick={() => setSelectedSize(size === selectedSize ? null : size)}
                          className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                            selectedSize === size
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:border-accent"
                          }`}
                        >
                          {size}
                        </button>
                        {lowStock && (
                          <Badge 
                            variant="destructive" 
                            className="absolute -top-2 -right-2 text-[9px] px-1 py-0"
                          >
                            {stockAvailable}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
                {selectedSize && isSizeLowStock(selectedSize) && (
                  <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Últimas unidades disponíveis!
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-muted-foreground">Produto esgotado</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-4">
              <Button 
                size="lg" 
                onClick={handleAddToCart} 
                className="gap-2"
                disabled={!selectedSize || availableSizes.length === 0 || isProductOutOfStock}
              >
                <ShoppingBag className="h-5 w-5" />
                {availableSizes.length === 0 || isProductOutOfStock
                  ? "Esgotado" 
                  : selectedSize 
                    ? "Comprar agora" 
                    : "Selecione um tamanho"}
              </Button>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className={`flex-1 gap-2 ${productIsFavorite ? 'text-destructive border-destructive' : ''}`}
                  onClick={handleToggleFavorite}
                  disabled={favoritesLoading}
                >
                  <Heart className={`h-5 w-5 ${productIsFavorite ? 'fill-current' : ''}`} />
                  {productIsFavorite ? "Favoritado" : "Favoritar"}
                </Button>
                <Button variant="outline" size="lg" onClick={handleShare} className="gap-2">
                  <Share2 className="h-5 w-5" />
                </Button>
              </div>
            </div>

          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="mt-16">
            <h2 className="font-serif text-2xl mb-6">Você também pode gostar</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {relatedProducts.map((relatedProduct) => (
                <Link key={relatedProduct.id} to={`/produto/${relatedProduct.id}`}>
                  <ProductCard
                    name={relatedProduct.name}
                    price={relatedProduct.price}
                    imageUrl={relatedProduct.images?.[relatedProduct.main_image_index || 0] || relatedProduct.image_url || undefined}
                    sizes={getStockSizes(relatedProduct.stock_by_size)}
                  />
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-border mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 Provador VIP. Feito com ❤️ para lojistas de moda.</p>
        </div>
      </footer>
    </div>
  );
};

export default ProductDetail;
