import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Camera, ShoppingBag, Clock, CheckCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";

interface PrintRequest {
  id: string;
  created_at: string;
  image_path: string;
  size: string | null;
  status: string | null;
  linked_product_id: string | null;
  linked_product?: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    sizes: string[] | null;
  } | null;
}

export default function MeusPrints() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { addItem } = useCart();
  const [prints, setPrints] = useState<PrintRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/minha-conta");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadPrints();
    }
  }, [user]);

  const loadPrints = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("print_requests")
      .select("id, created_at, image_path, size, status, linked_product_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Fetch linked products
      const printsWithProducts = await Promise.all(
        data.map(async (print) => {
          if (print.linked_product_id) {
            const { data: product } = await supabase
              .from("product_catalog")
              .select("id, name, price, image_url, sizes")
              .eq("id", print.linked_product_id)
              .single();
            return { ...print, linked_product: product };
          }
          return { ...print, linked_product: null };
        })
      );
      setPrints(printsWithProducts);
    }
    setIsLoading(false);
  };

  const getImageUrl = (path: string) => {
    const { data } = supabase.storage.from("prints").getPublicUrl(path);
    return data.publicUrl;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const handleAddToCart = (print: PrintRequest) => {
    if (!print.linked_product || !print.size) return;

    addItem({
      productId: print.linked_product.id,
      name: print.linked_product.name,
      price: print.linked_product.price,
      originalPrice: print.linked_product.price,
      discountPercent: 0,
      size: print.size,
      imageUrl: print.linked_product.image_url || undefined,
    });

    toast.success("Produto adicionado ao carrinho!");
    navigate("/carrinho");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-2xl">Meus Prints</h1>
          <Link to="/enviar-print">
            <Button size="sm" className="gap-2">
              <Camera className="h-4 w-4" />
              Enviar novo
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : prints.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                Você ainda não enviou nenhum print
              </p>
              <Link to="/enviar-print" className="text-accent hover:underline">
                Enviar print do story →
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {prints.map((print) => (
              <Card key={print.id}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Print image */}
                    <div className="w-20 h-24 bg-stone-50 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={getImageUrl(print.image_path)}
                        alt="Print enviado"
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm text-muted-foreground">
                          {formatDate(print.created_at)}
                        </span>
                        {print.linked_product ? (
                          <Badge className="bg-green-100 text-green-800 border-0 gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Encontrado
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 border-0 gap-1">
                            <Clock className="h-3 w-3" />
                            Em análise
                          </Badge>
                        )}
                      </div>

                      {print.size && (
                        <p className="text-sm mb-2">
                          Tamanho: <span className="font-medium">{print.size}</span>
                        </p>
                      )}

                      {print.linked_product && (
                        <div className="flex items-center gap-3 p-2 bg-secondary/50 rounded-lg">
                          {print.linked_product.image_url && (
                            <div className="w-12 h-14 bg-stone-50 rounded overflow-hidden">
                              <img
                                src={print.linked_product.image_url}
                                alt={print.linked_product.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {print.linked_product.name}
                            </p>
                            <p className="text-sm text-accent">
                              {formatPrice(print.linked_product.price)}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAddToCart(print)}
                            className="gap-1"
                          >
                            <ShoppingBag className="h-4 w-4" />
                            Comprar
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
