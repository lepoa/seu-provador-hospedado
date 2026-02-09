import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ShoppingBag, MessageCircle, Loader2, Heart, Sparkles, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  image: string | null;
  color: string | null;
  sizes?: string[];
}

interface Catalog {
  id: string;
  title: string;
  intro_text: string | null;
  products: CatalogProduct[];
  created_at: string;
  customer_id: string;
}

const CatalogView = () => {
  const { link } = useParams<{ link: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, items: cartItems } = useCart();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [addedToCart, setAddedToCart] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (link) {
      loadCatalog();
    }
  }, [link]);

  // Load user favorites if authenticated
  useEffect(() => {
    if (user && catalog) {
      loadFavorites();
    }
  }, [user, catalog]);

  const loadCatalog = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("customer_catalogs")
        .select("*")
        .eq("public_link", link)
        .maybeSingle();

      if (fetchError) throw fetchError;
      
      if (!data) {
        setError("Catálogo não encontrado");
        return;
      }

      // Load full product data to get sizes
      const productIds = ((data.products as unknown as CatalogProduct[]) || []).map(p => p.id);
      
      if (productIds.length > 0) {
        const { data: productsData } = await supabase
          .from("product_catalog")
          .select("id, stock_by_size")
          .in("id", productIds);

        const sizeMap: Record<string, string[]> = {};
        (productsData || []).forEach(p => {
          const stockBySize = p.stock_by_size as Record<string, number> | null;
          if (stockBySize) {
            sizeMap[p.id] = Object.entries(stockBySize)
              .filter(([_, qty]) => (qty as number) > 0)
              .map(([size]) => size);
          }
        });

        const enrichedProducts = ((data.products as unknown as CatalogProduct[]) || []).map(p => ({
          ...p,
          sizes: sizeMap[p.id] || [],
        }));

        setCatalog({
          id: data.id,
          title: data.title,
          intro_text: data.intro_text,
          products: enrichedProducts,
          created_at: data.created_at,
          customer_id: data.customer_id,
        });
      } else {
        setCatalog({
          id: data.id,
          title: data.title,
          intro_text: data.intro_text,
          products: (data.products as unknown as CatalogProduct[]) || [],
          created_at: data.created_at,
          customer_id: data.customer_id,
        });
      }
    } catch (err) {
      console.error("Error loading catalog:", err);
      setError("Erro ao carregar catálogo");
    } finally {
      setIsLoading(false);
    }
  };

  const loadFavorites = async () => {
    if (!user) return;
    
    // Check localStorage for favorites for this catalog
    const storedFavorites = localStorage.getItem(`catalog_favorites_${catalog?.id}`);
    if (storedFavorites) {
      setFavorites(new Set(JSON.parse(storedFavorites)));
    }
  };

  const handleToggleFavorite = async (productId: string) => {
    const newFavorites = new Set(favorites);
    
    if (favorites.has(productId)) {
      newFavorites.delete(productId);
      toast.success("Removido dos favoritos");
    } else {
      newFavorites.add(productId);
      toast.success("Adicionado aos favoritos! 💕");
      
      // Save to database if user is authenticated and catalog has customer_id
      if (user && catalog?.customer_id) {
        try {
          // Check if suggestion already exists
          const { data: existing } = await supabase
            .from("customer_product_suggestions")
            .select("id, status")
            .eq("customer_id", catalog.customer_id)
            .eq("product_id", productId)
            .maybeSingle();

          if (existing) {
            // Update status to indicate customer liked it
            await supabase
              .from("customer_product_suggestions")
              .update({ status: "gostou" })
              .eq("id", existing.id);
          } else {
            // Create new suggestion with "gostou" status
            await supabase
              .from("customer_product_suggestions")
              .insert({
                customer_id: catalog.customer_id,
                product_id: productId,
                status: "gostou",
                score: 100,
                reasons: [{ type: "favorited_in_catalog", label: "Favoritou no catálogo" }],
              });
          }
        } catch (err) {
          console.error("Error saving favorite:", err);
        }
      }
    }
    
    setFavorites(newFavorites);
    localStorage.setItem(`catalog_favorites_${catalog?.id}`, JSON.stringify(Array.from(newFavorites)));
  };

  const handleAddToCart = (product: CatalogProduct) => {
    const selectedSize = selectedSizes[product.id];
    
    if (!selectedSize) {
      toast.error("Selecione um tamanho");
      return;
    }

    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.price,
      discountPercent: 0,
      size: selectedSize,
      imageUrl: product.image,
    });

    setAddedToCart(prev => new Set(prev).add(product.id));
    toast.success("Adicionado ao carrinho! 🛍️");

    // Reset after 2 seconds
    setTimeout(() => {
      setAddedToCart(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }, 2000);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !catalog) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white flex items-center justify-center">
        <div className="text-center px-4">
          <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h1 className="text-xl font-serif mb-2">
            {error || "Catálogo não encontrado"}
          </h1>
          <p className="text-muted-foreground">
            Este link pode ter expirado ou não está mais disponível.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-100">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="font-serif text-lg">Provador VIP</h1>
            {cartItemCount > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => navigate("/carrinho")}
              >
                <ShoppingBag className="h-4 w-4" />
                <span>{cartItemCount}</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Title & Intro */}
        <div className="text-center mb-8">
          <Badge variant="secondary" className="mb-4 gap-1">
            <Sparkles className="h-3 w-3" />
            Seleção exclusiva
          </Badge>
          <h1 className="font-serif text-2xl md:text-3xl mb-4">
            {catalog.title}
          </h1>
          {catalog.intro_text && (
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {catalog.intro_text}
            </p>
          )}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          {catalog.products.map((product, index) => (
            <div
              key={product.id || index}
              className="bg-white rounded-xl overflow-hidden border border-stone-100 shadow-sm"
            >
              {/* Product Image */}
              <div className="aspect-[4/5] relative bg-stone-100">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                
                {/* Favorite button */}
                <button 
                  className={`absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    favorites.has(product.id)
                      ? "bg-red-500 text-white"
                      : "bg-white/80 backdrop-blur-sm hover:bg-white text-stone-400 hover:text-red-500"
                  }`}
                  onClick={() => handleToggleFavorite(product.id)}
                >
                  <Heart className={`h-5 w-5 ${favorites.has(product.id) ? "fill-current" : ""}`} />
                </button>

                {/* Color badge */}
                {product.color && (
                  <Badge
                    variant="secondary"
                    className="absolute bottom-3 left-3 text-xs bg-white/90"
                  >
                    {product.color}
                  </Badge>
                )}
              </div>

              {/* Product Info */}
              <div className="p-4 space-y-4">
                <div>
                  <p className="font-medium text-lg">{product.name}</p>
                  <p className="text-primary font-bold text-xl">{formatPrice(product.price)}</p>
                </div>

                {/* Size Selector */}
                {product.sizes && product.sizes.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Tamanhos disponíveis:</p>
                    <div className="flex flex-wrap gap-2">
                      {product.sizes.map(size => (
                        <button
                          key={size}
                          onClick={() => setSelectedSizes(prev => ({ ...prev, [product.id]: size }))}
                          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                            selectedSizes[product.id] === size
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-stone-200 hover:border-primary"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add to Cart Button */}
                <Button 
                  className="w-full gap-2"
                  onClick={() => handleAddToCart(product)}
                  disabled={!product.sizes || product.sizes.length === 0}
                  variant={addedToCart.has(product.id) ? "secondary" : "default"}
                >
                  {addedToCart.has(product.id) ? (
                    <>
                      <Check className="h-4 w-4" />
                      Adicionado!
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Adicionar ao carrinho
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Favorites Summary */}
        {favorites.size > 0 && (
          <div className="mb-4 p-4 bg-red-50 rounded-xl border border-red-100">
            <div className="flex items-center gap-2 text-red-700">
              <Heart className="h-4 w-4 fill-current" />
              <span className="font-medium">{favorites.size} peça(s) favoritada(s)</span>
            </div>
            <p className="text-xs text-red-600 mt-1">
              Sua consultora verá suas peças preferidas!
            </p>
          </div>
        )}

        {/* WhatsApp CTA */}
        <div className="sticky bottom-4">
          <Button
            size="lg"
            className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white gap-2 shadow-lg"
            asChild
          >
            <a
              href="https://wa.me/5562991223519?text=Oi!%20Vi%20o%20catálogo%20que%20você%20preparou%20pra%20mim%20e%20adorei!%20%F0%9F%92%9B"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-5 w-5" />
              Falar sobre essas peças
            </a>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default CatalogView;
