import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Sparkles, Camera, ShoppingBag, RefreshCw,
  CreditCard, MessageCircle, Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { BenefitsBar } from "@/components/BenefitsBar";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "@/components/ProductCard";
import { useEffectivePrices } from "@/hooks/useEffectivePrices";
import { useProductAvailableStock } from "@/hooks/useProductAvailableStock";
import { buildWhatsAppLink } from "@/lib/whatsappHelpers";
import { TrendingSection } from "@/components/home/TrendingSection";
import { AILookConsultant } from "@/components/home/AILookConsultant";

// ─── Hero editorial photo ──────────
const HERO_IMAGE = "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&q=80";

// ─── Occasion tags ──────────────────────────────────────────────
const OCCASIONS = [
  "Trabalho",
  "Jantar",
  "Evento",
  "Igreja",
  "Viagem",
  "Dia a dia chic",
];

// ─── Trust badges ───────────────────────────────────────────────
const TRUST_ITEMS = [
  { icon: RefreshCw, label: "Troca fácil", desc: "Sem burocracia" },
  { icon: CreditCard, label: "3x sem juros", desc: "No cartão" },
  { icon: MessageCircle, label: "Suporte WhatsApp", desc: "Resposta rápida" },
  { icon: Truck, label: "Envio Brasil", desc: "Todo o país" },
];

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  images: string[] | null;
  main_image_index: number | null;
  category: string | null;
  stock_by_size: Record<string, number> | null | unknown;
}

// ─── Main Component ─────────────────────────────────────────────
const Index = () => {
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load 4 most-recent products as "best sellers" placeholder
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("product_catalog")
          .select("id, name, price, image_url, images, main_image_index, category, stock_by_size")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(4);
        setBestSellers(data || []);
      } catch (e) {
        console.error("Error loading products:", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const productIds = useMemo(() => bestSellers.map((p) => p.id), [bestSellers]);

  const {
    getEffectivePrice,
    getOriginalPrice,
    hasDiscount: hasPromotionalDiscount,
    getDiscountPercent,
  } = useEffectivePrices({
    channel: "catalog",
    productIds: productIds.length > 0 ? productIds : undefined,
    enabled: productIds.length > 0,
  });

  const {
    getAvailableSizes,
    isProductOutOfStock,
  } = useProductAvailableStock(productIds.length > 0 ? productIds : undefined);

  const getMainImage = (p: Product) => {
    if (p.images?.length) return p.images[p.main_image_index || 0] || p.images[0];
    return p.image_url || undefined;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ═══ Top Benefits Strip ═══ */}
      <BenefitsBar />

      <Header />

      {/* ═══ 1. HERO SECTION ═══ */}
      <section className="relative overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0 z-0 text-safe">
          <img
            src={HERO_IMAGE}
            alt="LE.POÁ Editorial"
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(40,33%,98%)]/95 via-[hsl(40,33%,98%)]/80 to-transparent md:from-[hsl(40,33%,98%)]/90 md:via-[hsl(40,33%,98%)]/60" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-5 py-16 md:py-28 lg:py-36">
          <div className="max-w-xl animate-fade-in">
            <span className="inline-flex items-center gap-2 text-accent text-xs tracking-[0.2em] uppercase font-bold mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              Curadoria de moda feminina
            </span>

            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] mb-5 text-foreground">
              Nunca mais fique<br />
              sem saber<br />
              <span className="text-accent italic font-black">o que vestir.</span>
            </h1>

            <p className="text-base md:text-lg text-foreground/90 leading-relaxed mb-8 max-w-md font-medium">
              Curadoria estratégica para o trabalho, jantares e
              ocasiões especiais. Peças escolhidas a dedo para
              mulheres que não têm tempo a perder.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/meu-estilo">
                <button className="w-full sm:w-auto px-10 py-4 bg-foreground text-background text-xs tracking-[0.25em] uppercase font-medium transition-all duration-500 hover:bg-accent hover:text-white">
                  Fazer meu provador VIP
                </button>
              </Link>
              <Link to="/enviar-print">
                <button className="w-full sm:w-auto px-10 py-4 border border-foreground/30 text-foreground text-xs tracking-[0.25em] uppercase font-medium transition-all duration-500 hover:border-accent hover:text-accent font-medium">
                  Buscar look por foto
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 2. THREE ACTION CARDS ═══ */}
      <section className="py-14 md:py-20 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 md:mb-14">
            <h2 className="font-serif text-2xl md:text-3xl mb-3">Como podemos te ajudar?</h2>
            <p className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto font-medium">
              Escolha como quer começar. Em poucos minutos a gente te
              ajuda a encontrar o look perfeito.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 md:gap-6">
            <ActionCard
              to="/meu-estilo"
              icon={<Sparkles className="h-7 w-7" />}
              title="Provador VIP"
              subtitle="Quiz em 2 minutos"
              description="Responda perguntas rápidas e receba sugestões no seu estilo e tamanho."
              accent
            />
            <ActionCard
              to="/enviar-print"
              icon={<Camera className="h-7 w-7" />}
              title="Buscar por Foto"
              subtitle="Envie print ou inspiração"
              description="Viu um look nos Stories? Mande a foto e a gente encontra peças parecidas."
            />
            <ActionCard
              to="/catalogo"
              icon={<ShoppingBag className="h-7 w-7" />}
              title="Catálogo Completo"
              subtitle="Todas as peças"
              description="Navegue por toda a coleção, filtre por tamanho, cor e categoria."
            />
          </div>
        </div>
      </section>

      {/* ═══ 3. TRENDING SECTION (DYNAMIC) ═══ */}
      <TrendingSection />

      {/* ═══ 4. AI LOOK CONSULTANT ═══ */}
      <AILookConsultant />

      {/* ═══ 5. BEST SELLERS placeholder (optional) ═══ */}
      <section className="py-14 md:py-20 px-5 bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between mb-8 md:mb-10">
            <div>
              <span className="text-xs tracking-[0.2em] uppercase text-accent font-bold">Destaques</span>
              <h2 className="font-serif text-2xl md:text-3xl mt-1">Lançamentos Recentes</h2>
            </div>
            <Link to="/catalogo">
              <Button variant="ghost" className="gap-1.5 text-sm hover:text-accent font-bold">
                Ver todos
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[3/4] bg-secondary rounded-xl mb-3" />
                  <div className="h-4 bg-secondary rounded w-3/4 mb-2" />
                  <div className="h-4 bg-secondary rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {bestSellers.map((product) => (
                <Link key={product.id} to={`/produto/${product.id}`} className="group">
                  <ProductCard
                    name={product.name}
                    price={getOriginalPrice(product.id, product.price)}
                    effectivePrice={getEffectivePrice(product.id, product.price)}
                    imageUrl={getMainImage(product)}
                    sizes={getAvailableSizes(product.id)}
                    isOutOfStock={isProductOutOfStock(product.id)}
                    hasPromotionalDiscount={hasPromotionalDiscount(product.id)}
                    discountPercent={getDiscountPercent(product.id)}
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ═══ 6. OCCASION CHIPS ═══ */}
      <section className="py-14 md:py-20 px-5">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-xs tracking-[0.2em] uppercase text-accent font-bold">Para cada momento</span>
          <h2 className="font-serif text-2xl md:text-3xl mt-2 mb-3">
            Qual ocasião você precisa<br className="hidden sm:block" /> se vestir hoje?
          </h2>
          <p className="text-muted-foreground text-sm mb-10 max-w-md mx-auto font-medium">
            Conte pra gente e a nossa curadoria encontra opções perfeitas para você.
          </p>

          <div className="flex flex-wrap justify-center gap-x-8 gap-y-5">
            {OCCASIONS.map((occ) => (
              <Link
                key={occ}
                to={`/catalogo?occasion=${encodeURIComponent(occ)}`}
                className="group relative"
              >
                <span className="font-serif text-lg md:text-xl text-foreground transition-colors duration-300 group-hover:text-accent font-medium">
                  {occ}
                </span>
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-accent transition-all duration-500 group-hover:w-full" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 7. TRUST / AUTHORITY ═══ */}
      <section className="py-14 md:py-20 px-5 bg-[hsl(35,30%,94%)]/60">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-xs tracking-[0.2em] uppercase text-accent font-bold">
            Por que escolher a LE.POÁ
          </span>
          <h2 className="font-serif text-2xl md:text-3xl mt-2 mb-3">
            Mais de 8 anos vestindo mulheres reais.
          </h2>
          <p className="text-muted-foreground text-sm mb-10 max-w-md mx-auto font-medium">
            Não somos só uma loja. Somos sua parceira de estilo para cada momento da sua vida.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {TRUST_ITEMS.map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-3 group">
                <div className="w-14 h-14 rounded-full bg-card border border-border flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:border-accent/40 transition-all duration-300">
                  <item.icon className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground font-medium">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 8. FINAL CTA ═══ */}
      <section className="py-16 md:py-24 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-px h-12 bg-accent/40 mx-auto mb-6" />
          <h2 className="font-serif text-3xl md:text-4xl mb-4 italic font-bold">
            Pronta para se sentir incrível?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto font-medium text-base">
            Monte seu provador VIP em 2 minutos e receba sugestões
            personalizadas direto no seu WhatsApp.
          </p>
          <Link to="/meu-estilo">
            <button className="px-12 py-4 bg-foreground text-background text-xs tracking-[0.25em] uppercase font-bold transition-all duration-500 hover:bg-accent hover:text-white">
              Quero meu provador VIP
            </button>
          </Link>
          <p className="text-[11px] text-muted-foreground mt-6 tracking-wide font-medium">
            Gratuito · Leva menos de 2 minutos
          </p>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-border py-10 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <p className="font-serif text-xl mb-1 font-bold">LE.POÁ</p>
              <p className="text-xs text-muted-foreground font-medium">Curadoria de moda feminina • Anápolis, GO</p>
            </div>

            <div className="flex items-center gap-5 text-sm text-muted-foreground font-medium">
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
            <p className="text-xs text-muted-foreground font-medium">
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

// ─── Action Card Sub-Component ──────────────────────────────────
function ActionCard({
  to,
  icon,
  title,
  subtitle,
  description,
  accent = false,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  accent?: boolean;
}) {
  return (
    <Link to={to} className="group">
      <div
        className={`
          relative overflow-hidden rounded-2xl p-7 md:p-8 h-full
          border-2 transition-all duration-300
          hover:shadow-xl hover:-translate-y-1
          ${accent
            ? "border-accent/30 bg-accent/5 hover:border-accent/60"
            : "border-border bg-card hover:border-accent/30"
          }
        `}
      >
        <div
          className={`
            inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5
            transition-colors duration-300
            ${accent ? "bg-accent/15 text-accent" : "bg-secondary text-foreground/70 group-hover:bg-accent/10 group-hover:text-accent"}
          `}
        >
          {icon}
        </div>

        <p className="text-[10px] tracking-[0.2em] uppercase text-accent font-bold mb-1.5">
          {subtitle}
        </p>
        <h3 className="font-serif text-xl mb-2 font-bold">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed font-medium">{description}</p>

        <div className="mt-5 inline-flex items-center gap-1.5 text-sm text-accent font-bold group-hover:gap-2.5 transition-all duration-300">
          Começar
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}

export default Index;