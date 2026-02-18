import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Upload, Camera, Check, Loader2, Sparkles, Package, ShoppingBag,
  MessageCircle, RefreshCw, Eye, ArrowRight, Image, Search, Zap,
  CreditCard, Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { BenefitsBar } from "@/components/BenefitsBar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useImageAnalysis } from "@/hooks/useImageAnalysis";
import { useProductMatcher, type RefinementMode } from "@/hooks/useProductMatcher";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { type MatchedProduct } from "@/lib/productMatcher";
import { buildWhatsAppLink } from "@/lib/whatsappHelpers";

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

// ─── How it works steps ─────────────────────────────────────────
const HOW_IT_WORKS = [
  {
    icon: Camera,
    number: "01",
    title: "Envie sua foto",
    desc: "Print do Instagram, selfie no espelho, foto de revista… qualquer imagem serve.",
  },
  {
    icon: Sparkles,
    number: "02",
    title: "IA identifica a peça",
    desc: "Nossa inteligência artificial analisa cor, modelagem, tecido e estilo em segundos.",
  },
  {
    icon: Search,
    number: "03",
    title: "Encontre peças parecidas",
    desc: "Mostramos opções similares do nosso catálogo, disponíveis no seu tamanho.",
  },
];

const TRUST_ITEMS = [
  { icon: RefreshCw, label: "Troca fácil", desc: "Sem burocracia" },
  { icon: CreditCard, label: "3x sem juros", desc: "No cartão" },
  { icon: MessageCircle, label: "Suporte WhatsApp", desc: "Resposta rápida" },
  { icon: Truck, label: "Envio Brasil", desc: "Todo o país" },
];

// ─── Main Component ─────────────────────────────────────────────
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
    setSelectedLetterSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const toggleNumberSize = (size: string) => {
    setSelectedNumberSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
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
        await supabase.from("print_requests").insert({
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
    if (!analysisResult) return;

    const newMode = refinementMode === mode ? "default" : mode;
    setRefinementMode(newMode);

    const matchResult = await findMatches(analysisResult, {
      letterSizes: selectedLetterSizes,
      numberSizes: selectedNumberSizes,
      refinementMode: newMode,
    });

    if (!matchResult.identifiedProduct && matchResult.alternatives.length === 0) {
      toast.info("Não encontrei produtos com esse filtro nos seus tamanhos");
    }
  };

  const handleAddToCart = (product: MatchedProduct) => {
    const availableSize = [...selectedLetterSizes, ...selectedNumberSizes].find((size) => {
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
    if (letterText && numberText) sizeText = `${letterText} / ${numberText}`;
    else if (letterText) sizeText = letterText;
    else if (numberText) sizeText = numberText;
    else sizeText = "não informado";

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

  const getAnalysisSummary = () => {
    if (!analysisResult) return "";
    const result = analysisResult as any;
    if (result.resumo_visual) return result.resumo_visual;

    const parts: string[] = [];
    if (result.categoria?.value) parts.push(result.categoria.value);
    if (result.cor?.value) parts.push(`em tom ${result.cor.value}`);
    if (result.decote?.value) parts.push(`com decote ${result.decote.value}`);
    if (result.estilo?.value) parts.push(`e vibe ${result.estilo.value}`);

    return parts.length > 0 ? `Parece ${parts.join(" ")}` : "Peça identificada";
  };

  // Scroll to tool section
  const scrollToTool = () => {
    document.getElementById("buscar-foto-tool")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <BenefitsBar />
      <Header />

      {/* ═══ 1. HERO SECTION ═══ */}
      <section className="py-14 md:py-20 px-5 text-center">
        <div className="max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 text-accent text-xs tracking-[0.2em] uppercase font-medium mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Inteligência Artificial
          </span>
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl leading-[1.15] mb-4">
            Viu um look e{" "}
            <span className="text-accent italic">
              quer encontrar
              <br className="hidden sm:block" />
              peça parecida?
            </span>
          </h1>
          <p className="text-muted-foreground font-light text-sm md:text-base max-w-lg mx-auto leading-relaxed mb-8">
            Envie qualquer foto — print do Instagram, selfie no espelho,
            inspiração do Pinterest — e a nossa IA encontra opções
            similares no seu tamanho em segundos.
          </p>
          <button
            onClick={scrollToTool}
            className="px-12 py-4 bg-foreground text-background text-xs tracking-[0.25em] uppercase font-medium transition-all duration-500 hover:bg-accent hover:text-white"
          >
            Enviar minha foto
          </button>
          <p className="text-[11px] text-muted-foreground mt-4 tracking-wide">
            Grátis · Sem cadastro · Resultado em segundos
          </p>
        </div>
      </section>

      {/* ═══ 2. HOW IT WORKS ═══ */}
      <section className="py-14 md:py-20 px-5 bg-secondary/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10 md:mb-14">
            <span className="text-xs tracking-[0.2em] uppercase text-accent font-medium">
              Como funciona
            </span>
            <h2 className="font-serif text-2xl md:text-3xl mt-2 mb-3">
              3 passos simples, resultado incrível.
            </h2>
            <p className="text-muted-foreground text-sm font-light max-w-md mx-auto">
              A ferramenta mais inteligente para encontrar looks que você ama.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {HOW_IT_WORKS.map((item) => (
              <div
                key={item.number}
                className="relative text-center group"
              >
                <div className="w-16 h-16 rounded-full bg-card border-2 border-border flex items-center justify-center mx-auto mb-5 shadow-sm group-hover:shadow-md group-hover:border-accent/40 transition-all duration-300">
                  <item.icon className="h-7 w-7 text-accent" />
                </div>
                <span className="text-[10px] tracking-[0.2em] uppercase text-accent font-semibold">
                  Passo {item.number}
                </span>
                <h3 className="font-serif text-lg mt-1 mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground font-light leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 3. SOCIAL PROOF / USE CASES ═══ */}
      <section className="py-14 md:py-20 px-5">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-xs tracking-[0.2em] uppercase text-accent font-medium">
            Funciona com tudo
          </span>
          <h2 className="font-serif text-2xl md:text-3xl mt-2 mb-3">
            Qualquer foto, a gente encontra.
          </h2>
          <p className="text-muted-foreground text-sm font-light mb-10 max-w-md mx-auto">
            Não precisa ser foto profissional. Vale qualquer inspiração.
          </p>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-4 md:gap-x-8">
            {[
              "Print do Instagram",
              "Selfie no espelho",
              "Foto do Pinterest",
              "Screenshot de série",
              "Foto de revista",
              "Look de amiga",
            ].map((item) => (
              <span
                key={item}
                className="font-serif text-base md:text-lg text-foreground/60"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 4. THE TOOL (functional area) ═══ */}
      <section id="buscar-foto-tool" className="py-14 md:py-20 px-5 bg-[hsl(35,30%,94%)]/60">
        <div className="max-w-lg mx-auto">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-3 mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-3">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300
                    ${step >= s
                      ? "bg-foreground text-background"
                      : "border-2 border-foreground/20 text-foreground/40"
                    }
                  `}
                >
                  {step > s ? <Check className="h-4 w-4" /> : s}
                </div>
                {s < 3 && (
                  <div
                    className={`w-8 h-px transition-colors duration-300 ${step > s ? "bg-foreground" : "bg-foreground/15"
                      }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Upload & Analyze */}
          {step === 1 && (
            <div className="animate-fade-in space-y-6">
              <div className="text-center mb-2">
                <h3 className="font-serif text-xl mb-1">Envie sua foto</h3>
                <p className="text-sm text-muted-foreground font-light">
                  Print, selfie, inspiração — qualquer imagem funciona.
                </p>
              </div>

              <div
                className="border-2 border-dashed border-foreground/15 rounded-xl p-8 text-center cursor-pointer hover:border-accent/50 transition-all duration-300 bg-card/50"
                onClick={() => document.getElementById("file-input")?.click()}
              >
                {preview ? (
                  <div className="relative">
                    <img
                      src={preview}
                      alt="Preview"
                      className="max-h-64 mx-auto rounded-lg shadow-sm"
                    />
                    <button
                      className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors tracking-wide"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setPreview(null);
                        clearAnalysis();
                        clearMatches();
                      }}
                    >
                      Trocar imagem
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-full bg-secondary/60 flex items-center justify-center mx-auto mb-3">
                      <Image className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground font-light">
                      Clique para enviar ou arraste sua imagem
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1 tracking-wide">
                      JPG, PNG ou WEBP
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
                <button
                  onClick={handleAnalyzeImage}
                  disabled={isAnalyzing}
                  className="w-full px-10 py-3.5 bg-foreground text-background text-xs tracking-[0.25em] uppercase font-medium transition-all duration-500 hover:bg-accent hover:text-white disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Identificando peça...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Identificar e buscar
                    </span>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Step 2: Size Selection */}
          {step === 2 && (
            <div className="animate-fade-in space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                  <Check className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-serif text-xl mb-1">Peça identificada!</h3>
                <p className="text-sm text-muted-foreground font-light">
                  Selecione seu tamanho para ver as opções disponíveis.
                </p>
              </div>

              {/* Letter Sizes */}
              <div>
                <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-medium mb-3 text-center">
                  Tamanhos letras <span className="text-accent">(pode marcar mais de um)</span>
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {LETTER_SIZES.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleLetterSize(s)}
                      className={`w-12 h-12 rounded-full border-2 font-medium text-sm transition-all duration-200 ${selectedLetterSizes.includes(s)
                          ? "border-foreground bg-foreground text-background"
                          : "border-foreground/20 bg-card hover:border-foreground/40"
                        }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Number Sizes */}
              <div>
                <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-medium mb-3 text-center">
                  Numeração <span className="text-accent">(pode marcar mais de um)</span>
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {NUMBER_SIZES.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleNumberSize(s)}
                      className={`w-12 h-12 rounded-full border-2 font-medium text-sm transition-all duration-200 ${selectedNumberSizes.includes(s)
                          ? "border-foreground bg-foreground text-background"
                          : "border-foreground/20 bg-card hover:border-foreground/40"
                        }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected summary */}
              {hasSelectedSize ? (
                <div className="border border-accent/30 rounded-xl p-3 text-center bg-accent/5">
                  <p className="text-sm">
                    Buscando tamanhos: <span className="font-medium text-accent">{displaySize}</span>
                  </p>
                </div>
              ) : (
                <div className="border border-foreground/10 rounded-xl p-3 text-center">
                  <p className="text-sm text-muted-foreground font-light">
                    Selecione pelo menos um tamanho
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 border border-foreground/20 text-foreground text-xs tracking-[0.15em] uppercase font-medium transition-all duration-300 hover:border-foreground/40"
                >
                  Voltar
                </button>
                <button
                  onClick={handleFindProducts}
                  disabled={!hasSelectedSize || isMatching}
                  className="flex-1 px-6 py-3 bg-foreground text-background text-xs tracking-[0.25em] uppercase font-medium transition-all duration-500 hover:bg-accent hover:text-white disabled:opacity-50"
                >
                  {isMatching ? (
                    <span className="inline-flex items-center gap-2 justify-center">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Buscando...
                    </span>
                  ) : (
                    "Buscar sugestões"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {step === 3 && (
            <div className="animate-fade-in space-y-6">
              {/* Analysis Summary */}
              <div className="border border-foreground/10 rounded-xl p-4 bg-card/50">
                <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-medium mb-1">
                  O que a IA identificou
                </p>
                <p className="text-sm font-medium italic font-serif">
                  "{getAnalysisSummary()}"
                </p>
              </div>

              {/* Identified product — out of stock */}
              {identifiedProduct && identifiedProduct.outOfStockInSelectedSize && (
                <div className="space-y-4">
                  <div className="border border-amber-300/50 bg-amber-50/50 rounded-xl p-4">
                    <p className="text-sm text-foreground font-light">
                      Encontramos uma peça muito parecida, mas no seu tamanho ela está esgotada.
                      {alternatives.length > 0 && (
                        <span className="font-medium">
                          {" "}Veja opções similares abaixo.
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-medium mb-2">
                      Peça identificada
                    </p>
                    <ResultProductCard
                      product={identifiedProduct}
                      onView={() => navigate(`/produto/${identifiedProduct.id}`)}
                      onBuy={() => navigate(`/produto/${identifiedProduct.id}`)}
                      outOfStock
                    />
                  </div>
                </div>
              )}

              {/* Products with stock */}
              {(alternatives.length > 0 || (identifiedProduct && !identifiedProduct.outOfStockInSelectedSize)) && (
                <div className="space-y-4">
                  <div className="text-center border border-accent/20 bg-accent/5 rounded-xl p-4">
                    <Sparkles className="h-5 w-5 text-accent mx-auto mb-2" />
                    <p className="font-serif text-lg">
                      {identifiedProduct?.outOfStockInSelectedSize
                        ? "Opções similares no seu tamanho"
                        : "Sugestões no seu tamanho"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1 tracking-wide">
                      {(identifiedProduct && !identifiedProduct.outOfStockInSelectedSize ? 1 : 0) + alternatives.length}{" "}
                      {(identifiedProduct && !identifiedProduct.outOfStockInSelectedSize ? 1 : 0) + alternatives.length === 1
                        ? "opção encontrada"
                        : "opções encontradas"}{" "}
                      com estoque em {displaySize}
                    </p>
                  </div>

                  {/* Identified product with stock */}
                  {identifiedProduct && !identifiedProduct.outOfStockInSelectedSize && (
                    <div>
                      <p className="text-[10px] tracking-[0.15em] uppercase text-accent font-medium mb-2 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Peça mais provável
                      </p>
                      <ResultProductCard
                        product={identifiedProduct}
                        onView={() => navigate(`/produto/${identifiedProduct.id}`)}
                        onBuy={() => handleAddToCart(identifiedProduct)}
                      />
                    </div>
                  )}

                  {/* Alternatives grid */}
                  {alternatives.length > 0 && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        {alternatives.slice(0, 6).map((product) => (
                          <ResultProductCard
                            key={product.id}
                            product={product}
                            onView={() => navigate(`/produto/${product.id}`)}
                            onBuy={() => handleAddToCart(product)}
                          />
                        ))}
                      </div>

                      {alternatives.length > 6 && (
                        <Link to="/catalogo">
                          <button className="w-full px-6 py-3 border border-foreground/20 text-foreground text-xs tracking-[0.15em] uppercase font-medium transition-all duration-300 hover:border-accent hover:text-accent">
                            Ver mais opções no catálogo
                          </button>
                        </Link>
                      )}
                    </>
                  )}

                  {/* Refinement chips */}
                  <div className="border-t border-foreground/8 pt-4">
                    <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-medium mb-3 text-center">
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

              {/* No products found */}
              {!identifiedProduct && alternatives.length === 0 && (
                <div className="space-y-4">
                  <div className="text-center border border-foreground/10 rounded-xl p-6">
                    <Package className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="font-serif text-lg mb-1">Nenhuma peça encontrada</p>
                    <p className="text-sm text-muted-foreground font-light">
                      {selectedLetterSizes.length > 0 && selectedNumberSizes.length === 0
                        ? "Tente selecionar também os tamanhos numéricos (34-46)."
                        : selectedNumberSizes.length > 0 && selectedLetterSizes.length === 0
                          ? "Tente selecionar também os tamanhos letras (PP-GG)."
                          : "Me chama no WhatsApp que te ajudo a achar algo especial!"}
                    </p>
                  </div>

                  <button
                    onClick={() => setStep(2)}
                    className="w-full px-6 py-3 border border-foreground/20 text-foreground text-xs tracking-[0.15em] uppercase font-medium transition-all duration-300 hover:border-foreground/40"
                  >
                    Alterar tamanhos
                  </button>

                  <Link to="/catalogo">
                    <button className="w-full px-6 py-3 border border-foreground/20 text-foreground text-xs tracking-[0.15em] uppercase font-medium transition-all duration-300 hover:border-accent hover:text-accent">
                      Ver catálogo completo
                    </button>
                  </Link>
                </div>
              )}

              {/* WhatsApp CTA */}
              <a
                href={getWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 w-full font-medium py-3.5 px-4 rounded-xl text-xs tracking-wide uppercase transition-all duration-300 ${!identifiedProduct && alternatives.length === 0
                    ? "bg-[#25D366] hover:bg-[#20BD5A] text-white"
                    : "border border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/5"
                  }`}
              >
                <MessageCircle className="h-4 w-4" />
                Falar no WhatsApp
              </a>

              {/* Reset */}
              <button
                onClick={handleReset}
                className="w-full text-xs tracking-wide text-muted-foreground hover:text-foreground transition-colors py-2 inline-flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Buscar outra foto
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ═══ 5. TRUST BADGES ═══ */}
      <section className="py-14 md:py-20 px-5">
        <div className="max-w-4xl mx-auto text-center">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {TRUST_ITEMS.map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-3 group">
                <div className="w-14 h-14 rounded-full bg-card border border-border flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:border-accent/40 transition-all duration-300">
                  <item.icon className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 6. FINAL CTA ═══ */}
      <section className="py-16 md:py-24 px-5 bg-secondary/30">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-px h-12 bg-accent/40 mx-auto mb-6" />
          <h2 className="font-serif text-3xl md:text-4xl mb-4 italic">
            Pronta para se sentir incrível?
          </h2>
          <p className="text-muted-foreground font-light mb-8 max-w-md mx-auto">
            Monte seu provador VIP em 2 minutos e receba sugestões
            personalizadas direto no seu WhatsApp.
          </p>
          <Link to="/meu-estilo">
            <button className="px-12 py-4 bg-foreground text-background text-xs tracking-[0.25em] uppercase font-medium transition-all duration-500 hover:bg-accent hover:text-white">
              Quero meu provador VIP
            </button>
          </Link>
          <p className="text-[11px] text-muted-foreground mt-6 tracking-wide">
            Gratuito · Leva menos de 2 minutos
          </p>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-border py-10 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <p className="font-serif text-lg mb-1">LE.POÁ</p>
              <p className="text-xs text-muted-foreground">Curadoria de moda feminina • Anápolis, GO</p>
            </div>
            <div className="flex items-center gap-5 text-sm text-muted-foreground">
              <Link to="/catalogo" className="hover:text-foreground transition-colors">Catálogo</Link>
              <Link to="/meu-estilo" className="hover:text-foreground transition-colors">Provador VIP</Link>
              <Link to="/enviar-print" className="hover:text-foreground transition-colors">Buscar por foto</Link>
              <a
                href={buildWhatsAppLink("Olá! Gostaria de saber mais sobre a LE.POÁ 🌸")}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                WhatsApp
              </a>
            </div>
          </div>
          <div className="border-t border-border mt-6 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} LE.POÁ. Todos os direitos reservados.
            </p>
            <Link
              to="/area-lojista"
              className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              Área do Lojista
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

// ─── Product Card Sub-Component ─────────────────────────────────
function ResultProductCard({
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
    <Card className={`overflow-hidden border-foreground/10 ${outOfStock ? "ring-1 ring-amber-300/50" : ""}`}>
      <div
        className="w-full aspect-[3/4] bg-secondary/30 flex items-center justify-center cursor-pointer relative"
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
          <Badge className="absolute top-2 left-2 bg-foreground/80 text-background text-[9px] px-1.5 py-0.5 tracking-wider">
            Esgotado no seu tam
          </Badge>
        ) : (
          <Badge className="absolute top-2 left-2 bg-green-600/90 text-white text-[9px] px-1.5 py-0.5 tracking-wider">
            ✓ No seu tamanho
          </Badge>
        )}
      </div>
      <CardContent className="p-3 space-y-2">
        <h4 className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h4>

        {/* Match reasons */}
        {product.matchReasons.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-[9px] text-muted-foreground tracking-wide">Parecido por:</span>
            {product.matchReasons.slice(0, 2).map((reason) => (
              <Badge
                key={reason}
                variant="secondary"
                className="text-[9px] px-1.5 py-0 tracking-wide"
              >
                {reason}
              </Badge>
            ))}
          </div>
        )}

        <p className="font-semibold text-accent text-sm">
          {formatPrice(product.price)}
        </p>

        <div className="flex gap-2">
          <button
            onClick={onView}
            className="flex-1 text-[10px] tracking-wide uppercase py-2 border border-foreground/15 hover:border-foreground/30 transition-colors inline-flex items-center justify-center gap-1"
          >
            <Eye className="h-3 w-3" />
            Ver
          </button>
          {outOfStock ? (
            <button
              onClick={onView}
              className="flex-1 text-[10px] tracking-wide uppercase py-2 bg-secondary text-foreground/70 inline-flex items-center justify-center gap-1"
            >
              <Eye className="h-3 w-3" />
              Tamanhos
            </button>
          ) : (
            <button
              onClick={onBuy}
              className="flex-1 text-[10px] tracking-wide uppercase py-2 bg-foreground text-background hover:bg-accent transition-colors inline-flex items-center justify-center gap-1"
            >
              <ShoppingBag className="h-3 w-3" />
              Comprar
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Refinement Chip Sub-Component ──────────────────────────────
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
      className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-200 tracking-wide ${active
          ? "bg-foreground text-background border-foreground"
          : "border-foreground/15 text-foreground/70 hover:border-foreground/30"
        } ${isLoading ? "opacity-50" : ""}`}
    >
      {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : label}
    </button>
  );
}

export default PrintStory;
