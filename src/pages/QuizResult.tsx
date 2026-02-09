import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { MessageCircle, ArrowRight, Sparkles, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { supabase } from "@/integrations/supabase/client";
import { styleProfiles } from "@/lib/quizData";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  tags: string[];
  sizes: string[];
  category: string | null;
  style: string | null;
}

interface Look {
  name: string;
  products: Product[];
}

const QuizResult = () => {
  const { customerId } = useParams();
  const [customer, setCustomer] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [looks, setLooks] = useState<Look[]>([]);
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  const profile = customer?.style_title 
    ? Object.values(styleProfiles).find(p => p.title === customer.style_title)
    : null;

  useEffect(() => {
    async function loadData() {
      if (!customerId) return;

      try {
        // Load customer data
        const { data: customerData, error: customerError } = await supabase
          .from("customers")
          .select("*")
          .eq("id", customerId)
          .single();

        if (customerError) throw customerError;
        setCustomer(customerData);

        // Find matching profile
        const matchedProfile = Object.values(styleProfiles).find(
          p => p.title === customerData.style_title
        );

        // Load products matching profile tags and customer size
        if (matchedProfile) {
          // Get products that match the style profile
          let query = supabase
            .from("product_catalog")
            .select("*")
            .eq("is_active", true);

          // Try to match by tags OR style
          const { data: productsData, error: productsError } = await query
            .or(`style.eq.${matchedProfile.id},tags.cs.{${matchedProfile.tags.join(",")}}`)
            .limit(12);

          if (productsError) throw productsError;

          // If we got products, filter by size if customer has one
          let matchedProducts = productsData || [];
          
          // If customer has a size preference, prioritize products with that size
          if (customerData.size && matchedProducts.length > 0) {
            const withSize = matchedProducts.filter(p => 
              p.sizes?.includes(customerData.size)
            );
            const withoutSize = matchedProducts.filter(p => 
              !p.sizes?.includes(customerData.size)
            );
            matchedProducts = [...withSize, ...withoutSize];
          }

          // If not enough products with tags, get more general products
          if (matchedProducts.length < 6) {
            const { data: moreProducts } = await supabase
              .from("product_catalog")
              .select("*")
              .eq("is_active", true)
              .not("id", "in", `(${matchedProducts.map(p => `"${p.id}"`).join(",") || '""'})`)
              .limit(12 - matchedProducts.length);
            
            if (moreProducts) {
              matchedProducts = [...matchedProducts, ...moreProducts];
            }
          }

          setProducts(matchedProducts.slice(0, 12));

          // Generate looks from products (3 looks with 2-3 products each)
          const generatedLooks = generateLooks(matchedProducts, matchedProfile);
          setLooks(generatedLooks);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Erro ao carregar resultados");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [customerId]);

  const generateLooks = (products: Product[], profile: typeof styleProfiles.elegante): Look[] => {
    if (products.length < 3) return [];

    const looks: Look[] = [];
    const usedProducts = new Set<string>();

    // Look names based on profile
    const lookNames: Record<string, string[]> = {
      elegante: ["Look Executivo", "Power Look", "Elegância Clássica"],
      classica: ["Look Atemporal", "Clássico Moderno", "Essencial Chic"],
      minimal: ["Look Clean", "Minimalismo Chic", "Básico Essencial"],
      romantica: ["Look Romântico", "Delicadeza Floral", "Feminino Suave"],
    };

    const names = lookNames[profile.id] || ["Look 1", "Look 2", "Look 3"];

    // Try to create 3 looks
    for (let i = 0; i < 3 && usedProducts.size < products.length; i++) {
      const lookProducts: Product[] = [];
      
      // Add 2-3 products per look
      for (const product of products) {
        if (!usedProducts.has(product.id) && lookProducts.length < 3) {
          lookProducts.push(product);
          usedProducts.add(product.id);
        }
        if (lookProducts.length >= 2 && (lookProducts.length >= 3 || usedProducts.size >= products.length - 2)) {
          break;
        }
      }

      if (lookProducts.length >= 2) {
        looks.push({
          name: names[i],
          products: lookProducts,
        });
      }
    }

    return looks;
  };

  const handleSavePhone = async () => {
    if (!phone || phone.length < 10) {
      toast.error("Digite um telefone válido");
      return;
    }

    setIsSavingPhone(true);
    try {
      const { error } = await supabase
        .from("customers")
        .update({ phone })
        .eq("id", customerId);

      if (error) throw error;
      toast.success("Telefone salvo! Abrindo WhatsApp...");
    } catch (error) {
      console.error("Error saving phone:", error);
      toast.error("Erro ao salvar telefone");
    } finally {
      setIsSavingPhone(false);
    }
  };

  const generateWhatsAppMessage = () => {
    if (!profile) return "";
    return `Olá! 💕 Fiz o quiz do Provador VIP e sou "${profile.title}"! 

${profile.description}

Quero ver mais looks que combinam com meu estilo! ✨`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="h-8 w-8 animate-pulse-soft mx-auto mb-4 text-accent" />
          <p className="text-muted-foreground">Analisando seu estilo...</p>
        </div>
      </div>
    );
  }

  if (!customer || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Resultado não encontrado</p>
          <Link to="/quiz">
            <Button>Fazer o quiz novamente</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Result Hero */}
      <section className="py-12 md:py-16 bg-gradient-to-b from-secondary/50 to-background">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <div className="animate-scale-in">
            <span className="text-6xl mb-4 block">{profile.emoji}</span>
            <h1 className="font-serif text-3xl md:text-5xl mb-3">
              {profile.title}
            </h1>
            <p className="text-accent text-lg mb-6">{profile.subtitle}</p>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {profile.description}
            </p>
          </div>
        </div>
      </section>

      {/* Looks Section */}
      {looks.length > 0 && (
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <h2 className="font-serif text-2xl md:text-3xl text-center mb-8">
              Looks montados para você
            </h2>
            
            <div className="space-y-10 max-w-5xl mx-auto">
              {looks.map((look, index) => (
                <div key={index} className="bg-card rounded-2xl p-6 border border-border">
                  <h3 className="font-serif text-xl mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </span>
                    {look.name}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {look.products.map((product) => (
                      <Link key={product.id} to={`/produto/${product.id}`}>
                        <ProductCard
                          name={product.name}
                          price={product.price}
                          imageUrl={product.image_url || undefined}
                          sizes={product.sizes}
                        />
                      </Link>
                    ))}
                  </div>
                  <div className="mt-4 text-right">
                    <p className="text-sm text-muted-foreground">
                      Total do look: <span className="font-semibold text-foreground">
                        {formatPrice(look.products.reduce((sum, p) => sum + p.price, 0))}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* More Recommendations */}
      {products.length > 0 && (
        <section className="py-12 md:py-16 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-serif text-2xl md:text-3xl">
                Mais peças que combinam
              </h2>
              <Link to="/catalogo">
                <Button variant="outline" className="gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Ver catálogo
                </Button>
              </Link>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {products.slice(0, 8).map((product) => (
                <Link key={product.id} to={`/produto/${product.id}`}>
                  <ProductCard
                    name={product.name}
                    price={product.price}
                    imageUrl={product.image_url || undefined}
                    sizes={product.sizes}
                    badge="Combina com você"
                  />
                </Link>
              ))}
            </div>

            {products.length === 0 && (
              <p className="text-center text-muted-foreground">
                Estamos preparando looks especiais para você!
              </p>
            )}
          </div>
        </section>
      )}

      {/* WhatsApp CTA */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 max-w-md">
          <div className="bg-card rounded-2xl p-6 md:p-8 border border-border shadow-sm">
            <div className="text-center mb-6">
              <MessageCircle className="h-10 w-10 mx-auto text-whatsapp mb-3" />
              <h3 className="font-serif text-xl mb-2">
                Receba seus looks no WhatsApp
              </h3>
              <p className="text-sm text-muted-foreground">
                Uma consultora vai enviar mais opções personalizadas para você!
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Seu WhatsApp
                </label>
                <Input
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-center text-lg"
                />
              </div>

              {phone.length >= 10 && (
                <WhatsAppButton
                  href={`https://wa.me/55${phone.replace(/\D/g, "")}?text=${encodeURIComponent(generateWhatsAppMessage())}`}
                  label="Abrir WhatsApp"
                />
              )}
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link to="/quiz">
              <Button variant="ghost" className="gap-2">
                <ArrowRight className="h-4 w-4 rotate-180" />
                Refazer o quiz
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default QuizResult;
