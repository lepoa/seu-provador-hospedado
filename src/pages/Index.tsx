import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Camera,
  CreditCard,
  MessageCircle,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Truck,
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

const HERO_IMAGE = "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&q=80";

const OCCASIONS = ["Trabalho", "Jantar", "Evento", "Igreja", "Viagem", "Dia a dia chic"];

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

interface RankedProductMetrics {
  rank: number;
  revenue: number;
  quantity: number;
}

const Index = () => {
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [rankingByProductId, setRankingByProductId] = useState<Record<string, RankedProductMetrics>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isFirstLoad = true;

    const loadBestSellers = async () => {
      if (isFirstLoad) {
        setIsLoading(true);
      }

      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: paidOrders, error: ordersError } = await supabase
          .from("orders")
          .select("id")
          .gte("created_at", sevenDaysAgo.toISOString())
          .or("status.eq.pago,status.eq.entregue,status.eq.Pago,status.eq.Entregue");

        if (ordersError) {
          throw ordersError;
        }

        const orderIds = (paidOrders || []).map((order) => order.id);
        if (orderIds.length === 0) {
          setBestSellers([]);
          setRankingByProductId({});
          return;
        }

        const { data: orderItems, error: itemsError } = await supabase
          .from("order_items")
          .select("product_id, quantity, product_price, subtotal")
          .in("order_id", orderIds);

        if (itemsError) {
          throw itemsError;
        }

        const productRankingMap = new Map<string, { revenue: number; quantity: number }>();
        (orderItems || []).forEach((item) => {
          const quantity = Number(item.quantity || 0);
          const revenue = Number(item.subtotal ?? (item.product_price || 0) * quantity);
          if (!item.product_id || quantity <= 0 || revenue < 0) {
            return;
          }

          const existing = productRankingMap.get(item.product_id);
          if (existing) {
            existing.quantity += quantity;
            existing.revenue += revenue;
          } else {
            productRankingMap.set(item.product_id, { quantity, revenue });
          }
        });

        const rankedProducts = Array.from(productRankingMap.entries())
          .sort(([, a], [, b]) => b.revenue - a.revenue || b.quantity - a.quantity)
          .slice(0, 8);

        if (rankedProducts.length === 0) {
          setBestSellers([]);
          setRankingByProductId({});
          return;
        }

        const rankedIds = rankedProducts.map(([productId]) => productId);
        const rankingMap: Record<string, RankedProductMetrics> = {};
        rankedProducts.forEach(([productId, metrics], index) => {
          rankingMap[productId] = {
            rank: index + 1,
            revenue: metrics.revenue,
            quantity: metrics.quantity,
          };
        });

        const { data: products, error: productsError } = await supabase
          .from("product_catalog")
          .select("id, name, price, image_url, images, main_image_index, category, stock_by_size")
          .in("id", rankedIds)
          .eq("is_active", true);

        if (productsError) {
          throw productsError;
        }

        const productById = new Map((products || []).map((product) => [product.id, product]));
        const orderedProducts = rankedIds
          .map((productId) => productById.get(productId))
          .filter((product): product is Product => Boolean(product));

        setBestSellers(orderedProducts);
        setRankingByProductId(rankingMap);
      } catch (e) {
        console.error("Error loading products:", e);
      } finally {
        if (isFirstLoad) {
          setIsLoading(false);
          isFirstLoad = false;
        }
      }
    };

    void loadBestSellers();
    const refreshInterval = window.setInterval(() => {
      void loadBestSellers();
    }, 1000 * 60 * 60 * 6);

    return () => {
      window.clearInterval(refreshInterval);
    };
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

  const { getAvailableSizes, isProductOutOfStock } = useProductAvailableStock(
    productIds.length > 0 ? productIds : undefined
  );

  const getMainImage = (p: Product) => {
    if (p.images?.length) {
      return p.images[p.main_image_index || 0] || p.images[0];
    }
    return p.image_url || undefined;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f3e8] text-[#151515]">
      <BenefitsBar />
      <Header />

      <section className="relative overflow-hidden border-b border-[#c8ad76]/30">
        <div className="absolute inset-0 z-0 text-safe">
          <img src={HERO_IMAGE} alt="LE.POÁ Editorial" className="h-full w-full object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#f8f3e8]/95 via-[#f8f3e8]/85 to-transparent md:from-[#f8f3e8]/94 md:via-[#f8f3e8]/70" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-5 py-16 md:py-28 lg:py-36">
          <div className="max-w-xl animate-fade-in">
            <span className="mb-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#a37d38]">
              <Sparkles className="h-3.5 w-3.5" />
              Curadoria de moda feminina
            </span>

            <h1 className="mb-5 font-serif text-4xl font-bold leading-[1.08] text-[#11251f] md:text-5xl lg:text-6xl">
              Nunca mais fique
              <br />
              sem saber
              <br />
              <span className="font-black italic text-[#b28a40]">o que vestir.</span>
            </h1>

            <p className="mb-8 max-w-md text-base font-medium leading-relaxed text-[#322f29] md:text-lg">
              Curadoria estratégica para o trabalho, jantares e ocasiões especiais. Peças escolhidas a dedo para
              mulheres que não têm tempo a perder.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Link to="/meu-estilo">
                <button className="w-full rounded-md border border-[#b8944e] bg-[#11251f] px-10 py-4 text-xs font-medium uppercase tracking-[0.25em] text-[#f3e5c1] transition-colors duration-300 hover:bg-[#183229] sm:w-auto">
                  Fazer meu provador VIP
                </button>
              </Link>
              <Link to="/enviar-print">
                <button className="w-full rounded-md border border-[#c7aa6b] bg-[#f9f3e3] px-10 py-4 text-xs font-medium uppercase tracking-[0.25em] text-[#2f2a22] transition-colors duration-300 hover:border-[#b4924c] hover:bg-[#f2e6cc] sm:w-auto">
                  Buscar look por foto
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-14 md:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center md:mb-14">
            <h2 className="mb-3 font-serif text-2xl text-[#11251f] md:text-3xl">Como podemos te ajudar?</h2>
            <p className="mx-auto max-w-lg text-sm font-medium text-[#6f685a] md:text-base">
              Escolha como quer começar. Em poucos minutos a gente te ajuda a encontrar o look perfeito.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3 md:gap-6">
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

      <TrendingSection />

      <section className="bg-[#f2ead9] px-5 py-14 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-end justify-between md:mb-10">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a37d38]">Ranking real</span>
              <h2 className="mt-1 font-serif text-2xl text-[#11251f] md:text-3xl">Mais Vendidos da Semana</h2>
              <p className="mt-2 text-sm font-medium text-[#6f685a]">
                Atualizado automaticamente com base no faturamento dos últimos 7 dias.
              </p>
            </div>
            <Link to="/catalogo">
              <Button
                variant="ghost"
                className="gap-1.5 text-sm font-semibold text-[#6f572e] hover:bg-[#ece0c6] hover:text-[#5a4525]"
              >
                Ver todos
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className={`${i >= 4 ? "hidden md:block" : ""} animate-pulse`}>
                  <div className="mb-3 aspect-[3/4] rounded-xl bg-[#e9ddc6]" />
                  <div className="mb-2 h-4 w-3/4 rounded bg-[#e9ddc6]" />
                  <div className="h-4 w-1/2 rounded bg-[#e9ddc6]" />
                </div>
              ))}
            </div>
          ) : bestSellers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#c8ad76]/45 bg-[#fffaf0] px-6 py-10 text-center">
              <p className="text-sm font-medium text-[#6f685a]">
                Ainda não há vendas suficientes para gerar o ranking da semana.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              {bestSellers.map((product, index) => {
                const ranking = rankingByProductId[product.id];
                const isTopOne = ranking?.rank === 1;

                return (
                  <div
                    key={product.id}
                    className={`relative rounded-2xl transition-all duration-300 ${index >= 4 ? "hidden md:block" : ""} ${
                      isTopOne
                        ? "shadow-[0_0_0_1px_rgba(193,154,84,0.55),0_14px_28px_rgba(193,154,84,0.24)]"
                        : "shadow-[0_10px_24px_rgba(16,40,32,0.08)]"
                    }`}
                  >
                    <span className="absolute left-3 top-3 z-10 rounded-full border border-[#c19a54] bg-[#f6e7c7] px-2.5 py-1 text-[11px] font-bold text-[#5f4725]">
                      #{ranking?.rank ?? "-"}
                    </span>
                    <Link to={`/produto/${product.id}`} className="group block">
                      <ProductCard
                        name={product.name}
                        price={getOriginalPrice(product.id, product.price)}
                        effectivePrice={getEffectivePrice(product.id, product.price)}
                        imageUrl={getMainImage(product)}
                        sizes={getAvailableSizes(product.id)}
                        showSizes={false}
                        isOutOfStock={isProductOutOfStock(product.id)}
                        hasPromotionalDiscount={hasPromotionalDiscount(product.id)}
                        discountPercent={getDiscountPercent(product.id)}
                        discountBadgeVariant="subtle"
                      />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="px-5 py-14 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a37d38]">Para cada momento</span>
          <h2 className="mt-2 mb-3 font-serif text-2xl text-[#11251f] md:text-3xl">
            Qual ocasião você precisa
            <br className="hidden sm:block" />
            se vestir hoje?
          </h2>
          <p className="mx-auto mb-10 max-w-md text-sm font-medium text-[#6f685a]">
            Conte pra gente e a nossa curadoria encontra opções perfeitas para você.
          </p>

          <div className="flex flex-wrap justify-center gap-x-8 gap-y-5">
            {OCCASIONS.map((occ) => (
              <Link key={occ} to={`/catalogo?occasion=${encodeURIComponent(occ)}`} className="group relative">
                <span className="font-serif text-lg font-medium text-[#22211e] transition-colors duration-300 group-hover:text-[#a37d38] md:text-xl">
                  {occ}
                </span>
                <span className="absolute -bottom-1 left-0 h-px w-0 bg-[#b28a40] transition-all duration-500 group-hover:w-full" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f2ead9] px-5 py-14 md:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a37d38]">Por que escolher a LE.POÁ</span>
          <h2 className="mt-2 mb-3 font-serif text-2xl text-[#11251f] md:text-3xl">Mais de 8 anos vestindo mulheres reais.</h2>
          <p className="mx-auto mb-10 max-w-md text-sm font-medium text-[#6f685a]">
            Não somos só uma loja. Somos sua parceira de estilo para cada momento da sua vida.
          </p>

          <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
            {TRUST_ITEMS.map((item) => (
              <div key={item.label} className="group flex flex-col items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#d8c4a0] bg-[#fffaf0] shadow-sm transition-all duration-300 group-hover:border-[#b99653] group-hover:shadow-md">
                  <item.icon className="h-6 w-6 text-[#a37d38]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1e1d1a]">{item.label}</p>
                  <p className="text-xs font-medium text-[#6f685a]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-6 h-12 w-px bg-[#c8ad76]/60" />
          <h2 className="mb-4 font-serif text-3xl font-bold italic text-[#11251f] md:text-4xl">Pronta para se sentir incrível?</h2>
          <p className="mx-auto mb-8 max-w-md text-base font-medium text-[#6f685a]">
            Monte seu provador VIP em 2 minutos e receba sugestões personalizadas direto no seu WhatsApp.
          </p>
          <Link to="/meu-estilo">
            <button className="bg-[#11251f] px-12 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-[#f3e5c1] transition-colors duration-300 hover:bg-[#183229]">
              Quero meu provador VIP
            </button>
          </Link>
          <p className="mt-6 text-[11px] font-medium tracking-wide text-[#7c7467]">Gratuito · Leva menos de 2 minutos</p>
        </div>
      </section>

      <footer className="border-t border-[#d7c4a1]/80 px-5 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="text-center md:text-left">
              <p className="mb-1 font-serif text-xl font-bold text-[#11251f]">LE.POÁ</p>
              <p className="text-xs font-medium text-[#6f685a]">Curadoria de moda feminina • Anápolis, GO</p>
            </div>

            <div className="flex items-center gap-5 text-sm font-medium text-[#6f685a]">
              <Link to="/catalogo" className="transition-colors hover:text-[#1f1d1a]">
                Catálogo
              </Link>
              <Link to="/meu-estilo" className="transition-colors hover:text-[#1f1d1a]">
                Provador VIP
              </Link>
              <Link to="/enviar-print" className="transition-colors hover:text-[#1f1d1a]">
                Buscar por foto
              </Link>
              <a
                href={buildWhatsAppLink("Olá! Gostaria de saber mais sobre a LE.POÁ 🌸")}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-[#1f1d1a]"
              >
                WhatsApp
              </a>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-[#d7c4a1]/60 pt-6 sm:flex-row">
            <p className="text-xs font-medium text-[#7c7467]">© {new Date().getFullYear()} LE.POÁ. Todos os direitos reservados.</p>
            <Link to="/area-lojista" className="text-[10px] text-[#7c7467]/70 transition-colors hover:text-[#5f594e]">
              Área do Lojista
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

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
        className={`relative h-full overflow-hidden rounded-2xl border p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(17,37,31,0.12)] md:p-8 ${
          accent
            ? "border-[#b99653]/45 bg-gradient-to-br from-[#fffaf0] to-[#f7ebd2]"
            : "border-[#d9c4a1]/65 bg-[#fffcf6] hover:border-[#b99653]/45"
        }`}
      >
        <div
          className={`mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl transition-colors duration-300 ${
            accent
              ? "bg-[#d9bd86]/35 text-[#8a672d]"
              : "bg-[#efe2c8] text-[#5f594e] group-hover:bg-[#e5d2ac] group-hover:text-[#8a672d]"
          }`}
        >
          {icon}
        </div>

        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a37d38]">{subtitle}</p>
        <h3 className="mb-2 font-serif text-xl font-bold text-[#191816]">{title}</h3>
        <p className="text-sm font-medium leading-relaxed text-[#6f685a]">{description}</p>

        <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#8a672d] transition-all duration-300 group-hover:gap-2.5">
          Começar
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}

export default Index;
