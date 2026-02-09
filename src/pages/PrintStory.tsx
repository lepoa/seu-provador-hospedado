import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Camera, Check, Loader2, Sparkles, Package, ShoppingBag, MessageCircle, RefreshCw, Eye, Frown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useImageAnalysis } from "@/hooks/useImageAnalysis";
import { useProductMatcher, type RefinementMode } from "@/hooks/useProductMatcher";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { type MatchedProduct } from "@/lib/productMatcher";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);
}

const LETTER_SIZES = ["PP", "P", "M", "G", "GG"];
const NUMBER_SIZES = ["34", "36", "38", "40", "42", "44", "46"];

const REFINEMENT_OPTIONS: { mode: RefinementMode; label: string }[] = [
  { mode: "color", label: "Mais parecido com a COR" },
  { mode: "modeling", label: "Mais parecido com a MODELAGEM" },
  { mode: "category", label: "Mais parecido com a CATEGORIA" },
  { mode: "elegant", label: "Mais elegante" },
  { mode: "casual", label: "Mais casual" },
];

const PrintStory = () => {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();
  
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  
  // Multi-select for sizes
  const [selectedLetterSizes, setSelectedLetterSizes] = useState<string[]>([]);
  const [selectedNumberSizes, setSelectedNumberSizes] = useState<string[]>([]);
  
  const [refinementMode, setRefinementMode] = useState<RefinementMode>("default");
  
  const { isAnalyzing, analysisResult, analyzeImage, clearAnalysis } = useImageAnalysis();
  const { isLoading: isMatching, identifiedProduct, alternatives, hasStockAvailable, findMatches, clearMatches } = useProductMatcher();

  // Combined size for display
  const displaySize = [...selectedLetterSizes, ...selectedNumberSizes].join(" / ") || "";
  const hasSelectedSize = selectedLetterSizes.length > 0 || selectedNumberSizes.length > 0;

  const toggleLetterSize = (size: string) => {
    setSelectedLetterSizes(prev => 
      prev.includes(size) 
        ? prev.filter(s => s !== size)
        : [...prev, size]
    );
  };

  const toggleNumberSize = (size: string) => {
    setSelectedNumberSizes(prev => 
      prev.includes(size) 
        ? prev.filter(s => s !== size)
        : [...prev, size]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
      clearAnalysis();
      clearMatches();
      setRefinementMode("default");
    }
  };

  const handleAnalyzeImage = async () => {
    if (!preview) {
      toast.error("Envie uma imagem primeiro");
      return;
    }
    const analysis = await analyzeImage(preview);
    if (analysis) {
      setStep(2);
    }
  };

  const handleFindProducts = async () => {
    if (!analysisResult || !file) return;
    
    // Save the print request to database
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("prints")
        .upload(fileName, file);

      if (!uploadError) {
        await supabase
          .from("print_requests")
          .insert({
            image_path: fileName,
            size: displaySize || null,
            user_id: user?.id || null,
            status: "pending",
          });
      }
    } catch (error) {
      console.error("Error saving print request:", error);
    }

    const matchResult = await findMatches(analysisResult, {
      letterSizes: selectedLetterSizes,
      numberSizes: selectedNumberSizes,
      refinementMode: "default",
    });
    setStep(3);
  };

  const handleRefineSearch = async (mode: RefinementMode) => {
    if (!analysisResult) {
      console.log("No analysis result for refinement");
      return;
    }
    
    const newMode = refinementMode === mode ? "default" : mode;
    console.log(`Refinement mode: ${refinementMode} -> ${newMode}`);
    setRefinementMode(newMode);
    
    const matchResult = await findMatches(analysisResult, {
      letterSizes: selectedLetterSizes,
      numberSizes: selectedNumberSizes,
      refinementMode: newMode,
    });
    
    console.log(`Refinement found ${matchResult.alternatives.length} alternatives`);
    
    if (!matchResult.identifiedProduct && matchResult.alternatives.length === 0) {
      toast.info("Não encontrei produtos com esse filtro nos seus tamanhos");
    }
  };

  const handleAddToCart = (product: MatchedProduct) => {
    // Pick the first available size from selected sizes
    const availableSize = [...selectedLetterSizes, ...selectedNumberSizes].find(size => {
      const stock = product.stock_by_size[size] || product.stock_by_size[size.toUpperCase()];
      return stock && stock > 0;
    }) || selectedLetterSizes[0] || selectedNumberSizes[0] || "";
    
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.price,
      discountPercent: 0,
      size: availableSize,
      imageUrl: product.image_url,
    });
    toast.success("Adicionado ao carrinho!");
    navigate("/carrinho");
  };

  const getWhatsAppUrl = () => {
    const letterText = selectedLetterSizes.length > 0 ? selectedLetterSizes.join(", ") : "";
    const numberText = selectedNumberSizes.length > 0 ? selectedNumberSizes.join(", ") : "";
    
    let sizeText = "";
    if (letterText && numberText) {
      sizeText = `${letterText} / ${numberText}`;
    } else if (letterText) {
      sizeText = letterText;
    } else if (numberText) {
      sizeText = numberText;
    } else {
      sizeText = "não informado";
    }
    
    const message = encodeURIComponent(
      `Oi! Usei o Buscar por Foto no Provador VIP 💛\nMeu tamanho é: ${sizeText}\nPode me ajudar a achar uma peça parecida?`
    );
    return `https://wa.me/5562991223519?text=${message}`;
  };

  const handleReset = () => {
    setStep(1);
    setFile(null);
    setPreview(null);
    setSelectedLetterSizes([]);
    setSelectedNumberSizes([]);
    setRefinementMode("default");
    clearAnalysis();
    clearMatches();
  };

  // Get analysis summary text
  const getAnalysisSummary = () => {
    if (!analysisResult) return "";
    
    const result = analysisResult as any;
    if (result.resumo_visual) {
      return result.resumo_visual;
    }
    
    const parts: string[] = [];
    
    if (result.categoria?.value) {
      parts.push(result.categoria.value);
    }
    if (result.cor?.value) {
      parts.push(`em tom ${result.cor.value}`);
    }
    if (result.decote?.value) {
      parts.push(`com decote ${result.decote.value}`);
    }
    if (result.estilo?.value) {
      parts.push(`e vibe ${result.estilo.value}`);
    }
    
    return parts.length > 0 
      ? `Parece ${parts.join(" ")}` 
      : "Peça identificada";
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-lg">
        <div className="text-center mb-8">
          <Camera className="h-10 w-10 mx-auto text-accent mb-3" />
          <h1 className="font-serif text-2xl md:text-3xl mb-2">
            Buscar por foto
          </h1>
          <p className="text-muted-foreground text-sm">
            Envie qualquer foto (print, espelho ou inspiração). A gente encontra opções parecidas disponíveis no seu tamanho.
          </p>
        </div>

        {/* Step 1: Upload & Analyze */}
        {step === 1 && (
          <div className="animate-fade-in space-y-6">
            <div 
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-accent transition-colors"
              onClick={() => document.getElementById("file-input")?.click()}
            >
              {preview ? (
                <div className="relative">
                  <img 
                    src={preview} 
                    alt="Preview" 
                    className="max-h-64 mx-auto rounded-lg"
                  />
                  <Button 
                    size="sm" 
                    variant="secondary"
                    className="mt-4"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setPreview(null);
                      clearAnalysis();
                      clearMatches();
                    }}
                  >
                    Trocar imagem
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Clique para enviar ou arraste sua imagem
                  </p>
                </>
              )}
              <input
                id="file-input"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {preview && (
              <Button
                onClick={handleAnalyzeImage}
                disabled={isAnalyzing}
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Identificando peça...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Identificar e buscar no catálogo
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Step 2: Size Selection (Multi-select) */}
        {step === 2 && (
          <div className="animate-fade-in space-y-6">
            <div className="text-center">
              <Check className="h-8 w-8 mx-auto text-green-500 mb-2" />
              <p className="font-medium mb-1">Peça identificada!</p>
              <p className="text-sm text-muted-foreground">
                Pra eu te mostrar opções reais, selecione seu tamanho (letras e/ou número).
              </p>
            </div>

            {/* Letter Sizes - Multi-select */}
            <div>
              <p className="text-sm text-muted-foreground mb-3 text-center">
                Tamanhos letras <span className="text-xs">(pode marcar mais de um)</span>
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {LETTER_SIZES.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleLetterSize(s)}
                    className={`w-12 h-12 rounded-xl border-2 font-medium transition-all duration-200 ${
                      selectedLetterSizes.includes(s)
                        ? "border-accent bg-accent text-accent-foreground shadow-lg"
                        : "border-border bg-card hover:border-accent/50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Number Sizes - Multi-select */}
            <div>
              <p className="text-sm text-muted-foreground mb-3 text-center">
                Numeração <span className="text-xs">(pode marcar mais de um)</span>
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {NUMBER_SIZES.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleNumberSize(s)}
                    className={`w-12 h-12 rounded-xl border-2 font-medium transition-all duration-200 ${
                      selectedNumberSizes.includes(s)
                        ? "border-accent bg-accent text-accent-foreground shadow-lg"
                        : "border-border bg-card hover:border-accent/50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected summary */}
            {hasSelectedSize ? (
              <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 text-center">
                <p className="text-sm font-medium">
                  Buscando tamanhos: <span className="text-accent">{displaySize}</span>
                </p>
              </div>
            ) : (
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <p className="text-sm text-muted-foreground">
                  Selecione pelo menos um tamanho para continuar
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button 
                onClick={handleFindProducts} 
                disabled={!hasSelectedSize || isMatching}
                className="flex-1"
              >
                {isMatching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  "Buscar sugestões"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && (
          <div className="animate-fade-in space-y-6">
            
            {/* Block 1: Analysis Summary */}
            <div className="bg-stone-50 dark:bg-stone-900 rounded-xl p-4 border">
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                O que eu entendi da sua foto
              </p>
              <p className="text-sm font-medium">
                "{getAnalysisSummary()}"
              </p>
            </div>

            {/* Block 2: Identified product (out of stock in selected size) */}
            {identifiedProduct && identifiedProduct.outOfStockInSelectedSize && (
              <div className="space-y-4">
                <div className="bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
                  <p className="text-sm text-foreground">
                    Encontramos uma peça muito parecida com a da foto, mas no seu tamanho ela está esgotada. 
                    Mesmo assim você pode ver o produto e, se quiser, comprar em outra numeração.
                  </p>
                  {alternatives.length > 0 && (
                    <p className="text-sm text-foreground mt-2 font-medium">
                      Enquanto isso, aqui estão algumas opções similares disponíveis no seu tamanho.
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Peça identificada</p>
                  <ProductCard
                    product={identifiedProduct}
                    onView={() => navigate(`/produto/${identifiedProduct.id}`)}
                    onBuy={() => navigate(`/produto/${identifiedProduct.id}`)}
                    outOfStock
                  />
                </div>
              </div>
            )}

            {/* Block 3: Products with stock */}
            {(alternatives.length > 0 || (identifiedProduct && !identifiedProduct.outOfStockInSelectedSize)) && (
              <div className="space-y-4">
                <div className="bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 text-center">
                  <Sparkles className="h-6 w-6 text-amber-600 dark:text-amber-400 mx-auto mb-2" />
                  <p className="font-medium text-foreground">
                    {identifiedProduct?.outOfStockInSelectedSize
                      ? "Opções similares disponíveis no seu tamanho"
                      : "Sugestões disponíveis no seu tamanho"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(identifiedProduct && !identifiedProduct.outOfStockInSelectedSize ? 1 : 0) + alternatives.length}{" "}
                    {(identifiedProduct && !identifiedProduct.outOfStockInSelectedSize ? 1 : 0) + alternatives.length === 1 ? "opção encontrada" : "opções encontradas"} com estoque em {displaySize}
                  </p>
                </div>

                {/* If identified product HAS stock, show it prominently */}
                {identifiedProduct && !identifiedProduct.outOfStockInSelectedSize && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Peça mais provável
                    </p>
                    <ProductCard
                      product={identifiedProduct}
                      onView={() => navigate(`/produto/${identifiedProduct.id}`)}
                      onBuy={() => handleAddToCart(identifiedProduct)}
                    />
                  </div>
                )}

                {/* Alternative products grid */}
                {alternatives.length > 0 && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {alternatives.slice(0, 6).map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onView={() => navigate(`/produto/${product.id}`)}
                          onBuy={() => handleAddToCart(product)}
                        />
                      ))}
                    </div>

                    {alternatives.length > 6 && (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => navigate("/catalogo")}
                      >
                        Ver mais opções no catálogo
                      </Button>
                    )}
                  </>
                )}

                {/* Refinement chips */}
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-3 text-center uppercase tracking-wide">
                    Refinar busca
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {REFINEMENT_OPTIONS.map(({ mode, label }) => (
                      <RefinementChip
                        key={mode}
                        label={label}
                        active={refinementMode === mode}
                        onClick={() => handleRefineSearch(mode)}
                        isLoading={isMatching && refinementMode === mode}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* No products found at all */}
            {!identifiedProduct && alternatives.length === 0 && (
              <div className="space-y-4">
                <div className="bg-yellow-50/80 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-4 text-center">
                  <Package className="h-8 w-8 text-yellow-600 dark:text-yellow-400 mx-auto mb-2" />
                  <p className="font-medium text-foreground mb-1">
                    Não encontrei peças no seu tamanho
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedLetterSizes.length > 0 && selectedNumberSizes.length === 0 ? (
                      <>Tente selecionar também os tamanhos numéricos (34-46) — nosso estoque costuma ter mais opções nessa grade.</>
                    ) : selectedNumberSizes.length > 0 && selectedLetterSizes.length === 0 ? (
                      <>Tente selecionar também os tamanhos letras (PP-GG) — algumas peças usam essa grade.</>
                    ) : (
                      <>Me chama no WhatsApp que te ajudo a achar algo especial!</>
                    )}
                  </p>
                </div>
                
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setStep(2)}
                >
                  Alterar tamanhos selecionados
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate("/catalogo")}
                >
                  Ver catálogo completo
                </Button>
              </div>
            )}

            {/* WhatsApp CTA - Always visible */}
            <a
              href={getWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-center gap-2 w-full font-medium py-3 px-4 rounded-xl transition-colors ${
                !identifiedProduct && alternatives.length === 0 
                  ? "bg-[#25D366] hover:bg-[#20BD5A] text-white"
                  : "border border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10"
              }`}
            >
              <MessageCircle className="h-5 w-5" />
              Falar com a gente no WhatsApp
            </a>

            {/* Reset button */}
            <Button 
              variant="ghost" 
              onClick={handleReset}
              className="w-full text-muted-foreground"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Buscar outra foto
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

// Product card component
function ProductCard({
  product,
  onView,
  onBuy,
  outOfStock,
}: {
  product: MatchedProduct;
  onView: () => void;
  onBuy: () => void;
  outOfStock?: boolean;
}) {
  return (
    <Card className={`overflow-hidden ${outOfStock ? "ring-1 ring-amber-300 dark:ring-amber-700" : ""}`}>
      <div 
        className="w-full aspect-[3/4] bg-stone-50 flex items-center justify-center cursor-pointer relative"
        onClick={onView}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <Package className="h-8 w-8 text-muted-foreground" />
        )}
        
        {outOfStock ? (
          <Badge 
            className="absolute top-2 left-2 bg-amber-500 text-white text-[9px] px-1.5 py-0.5"
          >
            Esgotado no seu tamanho
          </Badge>
        ) : (
          <Badge 
            className="absolute top-2 left-2 bg-green-500 text-white text-[9px] px-1.5 py-0.5"
          >
            ✓ No seu tamanho
          </Badge>
        )}
      </div>
      <CardContent className="p-3 space-y-2">
        <h4 className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h4>
        
        {/* Match reasons badges */}
        {product.matchReasons.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] text-muted-foreground">Parecido por:</span>
            {product.matchReasons.slice(0, 2).map((reason) => (
              <Badge 
                key={reason} 
                variant="secondary" 
                className="text-[10px] px-1.5 py-0"
              >
                {reason}
              </Badge>
            ))}
          </div>
        )}
        
        <p className="font-bold text-accent text-sm">
          {formatPrice(product.price)}
        </p>
        
        <div className="flex gap-2">
          <Button 
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            onClick={onView}
          >
            <Eye className="h-3 w-3 mr-1" />
            Ver peça
          </Button>
          {outOfStock ? (
            <Button 
              size="sm"
              variant="secondary"
              className="flex-1 text-xs"
              onClick={onView}
            >
              <Eye className="h-3 w-3 mr-1" />
              Ver tamanhos
            </Button>
          ) : (
            <Button 
              size="sm"
              className="flex-1 text-xs"
              onClick={onBuy}
            >
              <ShoppingBag className="h-3 w-3 mr-1" />
              Comprar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Refinement chip component
function RefinementChip({
  label,
  active,
  onClick,
  isLoading,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  isLoading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
        active
          ? "bg-accent text-accent-foreground border-accent"
          : "bg-card border-border hover:border-accent/50"
      } ${isLoading ? "opacity-50" : ""}`}
    >
      {isLoading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        label
      )}
    </button>
  );
}

export default PrintStory;
