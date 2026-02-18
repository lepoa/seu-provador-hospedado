import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { MessageCircle, ArrowRight, Sparkles, ShoppingBag, Star, Trophy, Heart, CheckCircle2, Palette, Shirt, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { MissionsList } from "@/components/MissionsList";
import { supabase } from "@/integrations/supabase/client";
import { styleProfilesV2, getLevelFromPoints, StyleProfileV2 } from "@/lib/quizDataV2";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";
import { useConfetti } from "@/hooks/useConfetti";
import { useAuth } from "@/hooks/useAuth";
import { useLoyalty } from "@/hooks/useLoyalty";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  tags: string[] | null;
  sizes: string[] | null;
  score?: number;
  category: string | null;
  style: string | null;
  stock_by_size: unknown;
  color: string | null;
}

interface Look {
  name: string;
  products: Product[];
}

interface AIAnalysis {
  styleId: string;
  styleTitle: string;
  styleSubtitle: string;
  description: string;
  tags: string[];
  personalTip: string;
  colorPalette: string[];
  avoidColors: string[];
  keyPieces: string[];
  highlights?: string[];
  valorizes?: string[];
}

const QuizResultV2 = () => {
  const { customerId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { fireConfetti } = useConfetti();
  const { loyalty } = useLoyalty();

  const [customer, setCustomer] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [looks, setLooks] = useState<Look[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCelebrated, setHasCelebrated] = useState(false);
  const [displayPoints, setDisplayPoints] = useState(0);

  // Get data from navigation state
  const aiAnalysis = (location.state as any)?.aiAnalysis as AIAnalysis | null;
  const totalPoints = (location.state as any)?.totalPoints || 0;
  const stateSizeLetter = (location.state as any)?.sizeLetter;
  const stateSizeNumber = (location.state as any)?.sizeNumber;
  const showCelebration = (location.state as any)?.showCelebration;
  const stateProfile = (location.state as any)?.profile as StyleProfileV2 | undefined;

  // Initialize display points from state or loyalty
  useEffect(() => {
    if (totalPoints > 0) {
      setDisplayPoints(totalPoints);
    } else if (loyalty?.currentPoints) {
      setDisplayPoints(loyalty.currentPoints);
    }
  }, [totalPoints, loyalty]);

  // Fire celebration on initial load
  useEffect(() => {
    if (showCelebration && !hasCelebrated && !isLoading) {
      setHasCelebrated(true);
      setTimeout(() => {
        fireConfetti({ type: "celebration" });
      }, 500);
    }
  }, [showCelebration, hasCelebrated, isLoading, fireConfetti]);

  const profile = customer?.style_title
    ? Object.values(styleProfilesV2).find(p => p.title === customer.style_title)
    : aiAnalysis?.styleId
      ? styleProfilesV2[aiAnalysis.styleId]
      : stateProfile || null;

  const { level, title: levelTitle } = getLevelFromPoints(displayPoints);

  // Get highlights and valorizes from AI or profile
  const highlights = aiAnalysis?.highlights || profile?.highlights || [
    "Você valoriza qualidade sobre quantidade",
    "Seu olhar é atraído por cortes impecáveis",
    "Você sabe o poder de uma boa escolha"
  ];

  const valorizes = aiAnalysis?.valorizes || profile?.valorizes || ["estilo", "conforto", "versatilidade"];

  useEffect(() => {
    async function loadData() {
      if (!customerId) return;

      try {
        const { data: customerData, error: customerError } = await supabase
          .from("customers")
          .select("*")
          .eq("id", customerId)
          .single();

        if (customerError) throw customerError;
        setCustomer(customerData);

        const sizeLetter = stateSizeLetter || customerData.size_letter;
        const sizeNumber = stateSizeNumber || customerData.size_number;

        let query = supabase
          .from("product_catalog")
          .select("*")
          .eq("is_active", true);

        const { data: allProducts, error: productsError } = await query.limit(50);

        if (productsError) throw productsError;

        const matchedProducts = (allProducts || []).filter((product: any) => {
          const stockBySize = product.stock_by_size as Record<string, number> | null;
          if (!stockBySize) return false;

          const hasUniversalStock = (stockBySize["UN"] || 0) > 0;
          if (hasUniversalStock) return true;

          if (sizeLetter) {
            const letterStock = stockBySize[sizeLetter] || 0;
            if (letterStock > 0) return true;
          }

          if (sizeNumber) {
            const numberStock = stockBySize[sizeNumber] || 0;
            if (numberStock > 0) return true;
          }

          if (!sizeLetter && !sizeNumber) {
            return Object.values(stockBySize).some(qty => (qty as number) > 0);
          }

          return false;
        });

        const tags = aiAnalysis?.tags || profile?.tags || [];
        const scoredProducts = matchedProducts.map(product => {
          let score = 0;

          if (product.style && tags.includes(product.style)) score += 3;

          const productTags = product.tags || [];
          tags.forEach(tag => {
            if (productTags.some(pt => pt.toLowerCase().includes(tag.toLowerCase()))) {
              score += 1;
            }
          });

          if (product.category && (aiAnalysis?.keyPieces || profile?.keyPieces || [])
            .some(kp => kp.toLowerCase().includes(product.category?.toLowerCase() || ''))) {
            score += 2;
          }

          return { ...product, score };
        }).sort((a, b) => b.score - a.score);

        setProducts(scoredProducts.slice(0, 12));

        const generatedLooks = generateLooks(scoredProducts, aiAnalysis || profile);
        setLooks(generatedLooks);
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Erro ao carregar resultados");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [customerId, aiAnalysis, stateSizeLetter, stateSizeNumber]);

  const generateLooks = (products: Product[], styleData: any): Look[] => {
    if (products.length < 3) return [];

    const looks: Look[] = [];
    const usedProducts = new Set<string>();

    const lookNames = aiAnalysis?.keyPieces?.slice(0, 3).map((piece, i) => `Look ${piece}`) || [
      "Look Principal",
      "Look Alternativo",
      "Look Versátil",
    ];

    for (let i = 0; i < 3 && usedProducts.size < products.length; i++) {
      const lookProducts: Product[] = [];

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
          name: lookNames[i] || `Look ${i + 1}`,
          products: lookProducts,
        });
      }
    }

    return looks;
  };

  const handleAddToCart = (product: Product) => {
    const sizeLetter = stateSizeLetter || customer?.size_letter;
    const sizeNumber = stateSizeNumber || customer?.size_number;

    const stockBySize = (product as any).stock_by_size as Record<string, number> | null;
    let sizeToAdd: string | null = null;

    if (stockBySize) {
      if ((stockBySize["UN"] || 0) > 0) sizeToAdd = "UN";
      else if (sizeLetter && (stockBySize[sizeLetter] || 0) > 0) sizeToAdd = sizeLetter;
      else if (sizeNumber && (stockBySize[sizeNumber] || 0) > 0) sizeToAdd = sizeNumber;
    }

    if (!sizeToAdd) {
      toast.error("Tamanho não disponível");
      return;
    }

    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.price,
      discountPercent: 0,
      size: sizeToAdd,
      imageUrl: product.image_url || undefined,
    });
    toast.success("Adicionado ao carrinho!");
  };

  const generateWhatsAppMessage = () => {
    const styleTitle = aiAnalysis?.styleTitle || profile?.title || "meu estilo";
    return `Olá! 💕 Fiz o quiz do Provador VIP e descobri que sou "${styleTitle}"! 

Ganhei ${displayPoints} pontos e cheguei no nível ${level} (${levelTitle})! 🏆

${aiAnalysis?.description || profile?.description || ""}

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
          <p className="text-muted-foreground">Preparando seu resultado...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
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

      {/* Points & Level Banner */}
      <div className="bg-gradient-to-r from-amber-500/20 via-accent/20 to-amber-500/20 border-b border-amber-500/30">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-4 text-sm animate-slide-in-up">
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500 animate-pulse" />
              <span className="font-bold text-amber-700">{displayPoints} pontos</span>
            </div>
            <div className="w-px h-4 bg-amber-500/30" />
            <div className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-accent" />
              <span className="font-medium">Nível {level}: {levelTitle}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Result Hero */}
      <section className="py-10 md:py-14 bg-gradient-to-b from-secondary/50 to-background">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <div className="animate-bounce-in">
            <span className="text-6xl mb-4 block animate-float">
              {profile?.emoji || "✨"}
            </span>

            {/* Main Style Title */}
            <p className="text-sm text-accent font-medium mb-2 animate-slide-in-up" style={{ animationDelay: "100ms" }}>
              Seu estilo predominante é:
            </p>
            <h1 className="font-serif text-3xl md:text-5xl mb-3 animate-slide-in-up" style={{ animationDelay: "200ms" }}>
              {aiAnalysis?.styleTitle || profile?.title || customer.style_title}
            </h1>
            <p className="text-accent text-lg mb-6 animate-slide-in-up" style={{ animationDelay: "300ms" }}>
              {aiAnalysis?.styleSubtitle || profile?.subtitle}
            </p>

            {/* 3 Highlights About the Client */}
            <div className="bg-card border border-border rounded-2xl p-6 max-w-xl mx-auto mb-6 animate-slide-in-up" style={{ animationDelay: "400ms" }}>
              <div className="space-y-3">
                {highlights.map((highlight, i) => (
                  <div key={i} className="flex items-start gap-3 text-left">
                    <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    <p className="text-foreground">{highlight}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* "Suas melhores escolhas valorizam:" */}
            <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 max-w-lg mx-auto mb-6 animate-slide-in-up" style={{ animationDelay: "500ms" }}>
              <p className="text-sm font-medium text-accent mb-2 flex items-center justify-center gap-2">
                <Shirt className="h-4 w-4" />
                Suas melhores escolhas valorizam:
              </p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {valorizes.map((item, i) => (
                  <span key={i} className="px-3 py-1 bg-card border border-border rounded-full text-sm font-medium">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* AI Personal Tip */}
            {aiAnalysis?.personalTip && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 max-w-lg mx-auto mb-6 animate-slide-in-up" style={{ animationDelay: "600ms" }}>
                <p className="text-sm font-medium text-amber-700 mb-1">💡 Dica da sua consultora</p>
                <p className="text-sm text-amber-900">{aiAnalysis.personalTip}</p>
              </div>
            )}

            {/* Color Palette */}
            {(aiAnalysis?.colorPalette || profile?.colorPalette) && (
              <div className="mt-6 animate-slide-in-up" style={{ animationDelay: "700ms" }}>
                <p className="text-sm text-muted-foreground mb-2 flex items-center justify-center gap-2">
                  <Palette className="h-4 w-4" />
                  Suas cores
                </p>
                <div className="flex items-center justify-center gap-2">
                  {(aiAnalysis?.colorPalette || profile?.colorPalette)?.map((color, i) => (
                    <span key={i} className="px-3 py-1 bg-card border border-border rounded-full text-sm">
                      {color}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Size Badge */}
            {(stateSizeLetter || stateSizeNumber || customer?.size_letter || customer?.size_number) && (
              <div className="mt-4 inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full flex-wrap justify-center">
                <span className="text-sm text-muted-foreground">Seus tamanhos:</span>
                {(stateSizeLetter || customer?.size_letter) && (
                  <span className="font-bold">{stateSizeLetter || customer?.size_letter}</span>
                )}
                {(stateSizeLetter || customer?.size_letter) && (stateSizeNumber || customer?.size_number) && (
                  <span className="text-muted-foreground">e</span>
                )}
                {(stateSizeNumber || customer?.size_number) && (
                  <span className="font-bold">{stateSizeNumber || customer?.size_number}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Looks Section */}
      {looks.length > 0 && (
        <section className="py-10 md:py-14">
          <div className="container mx-auto px-4">
            <h2 className="font-serif text-2xl md:text-3xl text-center mb-2">
              Sugestões de looks pra você
            </h2>
            <p className="text-center text-muted-foreground mb-8">
              Todas as peças têm estoque no seu tamanho 🎉
            </p>

            <div className="space-y-8 max-w-5xl mx-auto">
              {looks.map((look, index) => (
                <div key={index} className="bg-card rounded-2xl p-5 border border-border">
                  <h3 className="font-serif text-xl mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </span>
                    {look.name}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {look.products.map((product) => (
                      <div key={product.id} className="relative group">
                        <Link to={`/produto/${product.id}`}>
                          <ProductCard
                            name={product.name}
                            price={product.price}
                            imageUrl={product.image_url || undefined}
                            sizes={product.sizes || []}
                            badge="Tem no seu tamanho"
                          />
                        </Link>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="absolute bottom-4 right-2 opacity-0 group-hover:opacity-100 transition-opacity gap-1"
                          onClick={() => handleAddToCart(product)}
                        >
                          <Heart className="h-3 w-3" />
                          Quero
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Total do look: <span className="font-semibold text-foreground">
                        {formatPrice(look.products.reduce((sum, p) => sum + p.price, 0))}
                      </span>
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => look.products.forEach(p => handleAddToCart(p))}
                    >
                      <ShoppingBag className="h-4 w-4 mr-1" />
                      Quero esse look
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* More Products */}
      {products.length > 0 && (
        <section className="py-10 md:py-14 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl md:text-3xl">
                Mais peças que combinam com você
              </h2>
              <Link to="/catalogo">
                <Button variant="outline" className="gap-2">
                  Ver catálogo
                  <ArrowRight className="h-4 w-4" />
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
                    sizes={product.sizes || []}
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

      {/* Missions Section - Continue refining your style */}
      <section className="py-10 md:py-14 bg-gradient-to-b from-background to-secondary/30">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="text-center mb-6">
            <p className="text-[10px] tracking-[0.3em] uppercase text-foreground/40 font-medium mb-4">
              Próximo passo
            </p>
            <h2 className="font-serif text-2xl md:text-3xl mb-2">
              Aprofunde seu perfil
            </h2>
            <p className="text-foreground/50 font-light">
              Responda módulos específicos para refinar ainda mais a sua curadoria
            </p>
          </div>

          <MissionsList
            completedMissions={[]}
            currentPoints={displayPoints}
            currentLevel={level}
          />
        </div>
      </section>

      {/* WhatsApp CTA */}
      <section className="py-10 md:py-14">
        <div className="container mx-auto px-4 max-w-md">
          <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
            <div className="text-center mb-6">
              <MessageCircle className="h-10 w-10 mx-auto text-whatsapp mb-3" />
              <h3 className="font-serif text-xl mb-2">
                Fale com sua consultora
              </h3>
              <p className="text-sm text-muted-foreground">
                Receba mais sugestões personalizadas no WhatsApp!
              </p>
            </div>

            <WhatsAppButton
              href={`https://wa.me/5511999999999?text=${encodeURIComponent(generateWhatsAppMessage())}`}
              label="Conversar no WhatsApp"
            />
          </div>

          <div className="mt-6 text-center space-y-2">
            <Link to="/minha-conta">
              <Button variant="ghost" className="gap-2 w-full">
                <Sparkles className="h-4 w-4" />
                Ver minhas sugestões
              </Button>
            </Link>
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

export default QuizResultV2;
