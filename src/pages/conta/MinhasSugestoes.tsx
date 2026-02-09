import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, Star, Trophy, Gift, ChevronRight, RefreshCw, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductCard } from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getLevelFromPoints } from "@/lib/quizDataV2";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  sizes: string[] | null;
  stock_by_size: unknown;
}

interface QuizResponse {
  question: string;
  answer: string;
  points: number;
}

export default function MinhasSugestoes() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [quizData, setQuizData] = useState<{
    styleTitle: string | null;
    sizeLetter: string | null;
    sizeNumber: string | null;
    totalPoints: number;
    responses: QuizResponse[];
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/minha-conta");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadSuggestions();
    }
  }, [user]);

  const loadSuggestions = async () => {
    if (!user) return;

    try {
      // Get user profile with quiz data
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // Get customer record linked to user
      const { data: customers } = await supabase
        .from("customers")
        .select("id, style_title, size_letter, size_number")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const customer = customers?.[0];
      let responses: QuizResponse[] = [];
      let totalPoints = profile?.quiz_points || 0;

      if (customer) {
        // Get quiz responses
        const { data: quizResponses } = await supabase
          .from("quiz_responses")
          .select("question, answer, points")
          .eq("customer_id", customer.id)
          .order("question_number");

        if (quizResponses) {
          responses = quizResponses;
          // Use profile points if available, otherwise calculate
          if (!totalPoints) {
            totalPoints = quizResponses.reduce((sum, r) => sum + (r.points || 0), 0);
          }
        }
      }

      // Use profile data if available, otherwise fall back to customer data
      const sizeLetter = profile?.size_letter || customer?.size_letter;
      const sizeNumber = profile?.size_number || customer?.size_number;
      const styleTitle = profile?.style_title || customer?.style_title;

      setQuizData({
        styleTitle,
        sizeLetter,
        sizeNumber,
        totalPoints,
        responses,
      });

      // Get product suggestions based on style and size
      const { data: products } = await supabase
        .from("product_catalog")
        .select("*")
        .eq("is_active", true)
        .limit(20);

      // Filter by stock in size or UN (universal)
      const filtered = (products || []).filter(p => {
        const stockBySize = p.stock_by_size as Record<string, number> | null;
        if (!stockBySize) return false;
        
        // Check universal size
        if ((stockBySize["UN"] || 0) > 0) return true;
        
        // Check letter size
        if (sizeLetter && (stockBySize[sizeLetter] || 0) > 0) return true;
        
        // Check number size
        if (sizeNumber && (stockBySize[sizeNumber] || 0) > 0) return true;
        
        // If no size preference, include products with any stock
        if (!sizeLetter && !sizeNumber) {
          return Object.values(stockBySize).some(qty => (qty as number) > 0);
        }
        
        return false;
      });

      setSuggestions(filtered.slice(0, 8));
    } catch (error) {
      console.error("Error loading suggestions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshSuggestions = async () => {
    setIsGenerating(true);
    await loadSuggestions();
    toast.success("Sugestões atualizadas!");
    setIsGenerating(false);
  };

  const { level, title: levelTitle } = getLevelFromPoints(quizData?.totalPoints || 0);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid gap-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-2xl">Sugestões pra mim</h1>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefreshSuggestions}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Atualizar</span>
          </Button>
        </div>

        {/* Points Card */}
        {quizData && quizData.totalPoints > 0 && (
          <Card className="mb-6 bg-gradient-to-r from-amber-500/10 via-accent/10 to-amber-500/10 border-amber-500/30">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-accent flex items-center justify-center">
                    <Trophy className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">Nível {level}: {levelTitle}</p>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      <span>{quizData.totalPoints} pontos acumulados</span>
                    </div>
                  </div>
                </div>
                {quizData.styleTitle && (
                  <div className="text-right hidden sm:block">
                    <p className="text-sm text-muted-foreground">Seu estilo</p>
                    <p className="font-medium">{quizData.styleTitle}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Quiz Data */}
        {(!quizData || !quizData.styleTitle) && (
          <Card className="mb-6">
            <CardContent className="py-8 text-center">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-accent" />
              <h2 className="font-serif text-xl mb-2">Descubra seu estilo!</h2>
              <p className="text-muted-foreground mb-4">
                Faça o quiz de estilo e receba sugestões personalizadas de looks
              </p>
              <Link to="/quiz">
                <Button className="gap-2">
                  <Gift className="h-4 w-4" />
                  Fazer o Quiz
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Size Preference */}
        {(quizData?.sizeLetter || quizData?.sizeNumber) && (
          <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground flex-wrap">
            <span>Mostrando peças nos tamanhos</span>
            {quizData.sizeLetter && (
              <span className="font-bold text-foreground bg-secondary px-2 py-0.5 rounded">
                {quizData.sizeLetter}
              </span>
            )}
            {quizData.sizeLetter && quizData.sizeNumber && <span>e</span>}
            {quizData.sizeNumber && (
              <span className="font-bold text-foreground bg-secondary px-2 py-0.5 rounded">
                {quizData.sizeNumber}
              </span>
            )}
          </div>
        )}

        {/* Product Suggestions */}
        {suggestions.length > 0 ? (
          <div>
            <h2 className="font-serif text-xl mb-4">Peças que combinam com você</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {suggestions.map((product) => (
                <Link key={product.id} to={`/produto/${product.id}`}>
                  <ProductCard
                    name={product.name}
                    price={product.price}
                    imageUrl={product.image_url || undefined}
                    sizes={product.sizes || []}
                    badge="Pra você"
                  />
                </Link>
              ))}
            </div>
          </div>
        ) : (quizData?.sizeLetter || quizData?.sizeNumber) ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                Ainda não temos peças nos seus tamanhos no momento.
              </p>
              <Link to="/catalogo" className="mt-4 inline-block">
                <Button variant="outline">Ver catálogo completo</Button>
              </Link>
            </CardContent>
          </Card>
        ) : null}

        {/* Mini Quiz Teaser */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="h-4 w-4 text-accent" />
              Mini-Quiz Semanal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Responda mini-quizzes toda semana para ganhar mais pontos e melhorar suas sugestões!
            </p>
            <Button variant="outline" className="gap-2" disabled>
              <Star className="h-4 w-4" />
              Em breve
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
