import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, Loader2, ShoppingBag, ArrowLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface FavoriteProduct {
  id: string;
  name: string;
  price: number;
  images: string[] | null;
  image_url: string | null;
  category?: string | null;
  sizes?: string[] | null;
  discount_type?: 'percentage' | 'fixed' | null;
  discount_value?: number | null;
}

export default function MeusFavoritos() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { favorites, toggleFavorite, isLoading: favLoading } = useFavorites();
  const [products, setProducts] = useState<FavoriteProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/minha-conta");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const loadFavoriteProducts = async () => {
      if (favorites.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("product_catalog")
          .select("id, name, price, images, image_url, category, sizes, discount_type, discount_value")
          .in("id", favorites)
          .eq("is_active", true);

        if (error) throw error;
        setProducts(data || []);
      } catch (error) {
        console.error("Error loading favorite products:", error);
      } finally {
        setLoading(false);
      }
    };

    if (!favLoading) {
      loadFavoriteProducts();
    }
  }, [favorites, favLoading]);

  const formatPrice = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => navigate("/minha-conta")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <Heart className="h-6 w-6 text-red-500 fill-red-500" />
          </div>
          <div>
            <h1 className="font-serif text-2xl">Meus Favoritos</h1>
            <p className="text-sm text-muted-foreground">
              {products.length} {products.length === 1 ? "produto" : "produtos"}
            </p>
          </div>
        </div>

        {/* Empty State */}
        {products.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="font-serif text-xl mb-2">Nenhum favorito ainda</h2>
            <p className="text-muted-foreground mb-6">
              Explore nosso catálogo e salve seus produtos favoritos
            </p>
            <Link to="/catalogo">
              <Button>
                <ShoppingBag className="h-4 w-4 mr-2" />
                Ver Catálogo
              </Button>
            </Link>
          </div>
        ) : (
          /* Products Grid */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => {
              // Calculate discounted price
              let finalPrice = product.price;
              let hasDiscount = false;
              
              if (product.discount_type && product.discount_value && product.discount_value > 0) {
                hasDiscount = true;
                if (product.discount_type === 'percentage') {
                  finalPrice = product.price * (1 - product.discount_value / 100);
                } else {
                  finalPrice = Math.max(0, product.price - product.discount_value);
                }
              }
              
              const productImage = product.images?.[0] || product.image_url || "/placeholder.svg";
              
              return (
                <div key={product.id} className="card-product group relative">
                  {/* Favorite button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      toggleFavorite(product.id);
                    }}
                    className="absolute top-2 right-2 z-10 p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                  >
                    <Heart className="h-4 w-4 text-red-500 fill-red-500" />
                  </button>

                  <Link to={`/produto/${product.id}`}>
                    <div className="relative aspect-[3/4] overflow-hidden bg-secondary rounded-t-lg">
                      <img
                        src={productImage}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    
                    <div className="p-3">
                      <h3 className="font-medium text-sm line-clamp-2 mb-1">{product.name}</h3>
                      
                      {product.sizes && product.sizes.length > 0 && (
                        <p className="text-xs text-muted-foreground mb-2">
                          Tam: {product.sizes.slice(0, 4).join(", ")}{product.sizes.length > 4 ? "..." : ""}
                        </p>
                      )}
                      
                      <div className="flex flex-col">
                        {hasDiscount ? (
                          <>
                            <span className="font-semibold text-green-600">
                              {formatPrice(finalPrice)}
                            </span>
                            <span className="text-xs text-muted-foreground line-through">
                              {formatPrice(product.price)}
                            </span>
                          </>
                        ) : (
                          <span className="font-semibold">
                            {formatPrice(product.price)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
