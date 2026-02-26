import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search, Filter, X, AlertCircle, ArrowRight,
  RefreshCw, CreditCard, MessageCircle, Truck, Sparkles, Camera,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/Header";
import { BenefitsBar } from "@/components/BenefitsBar";
import { ProductCard } from "@/components/ProductCard";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useLiveHiddenProducts } from "@/hooks/useLiveStock";
import { useProductAvailableStock } from "@/hooks/useProductAvailableStock";
import { useEffectivePrices } from "@/hooks/useEffectivePrices";
import { buildWhatsAppLink } from "@/lib/whatsappHelpers";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  images: string[] | null;
  main_image_index: number | null;
  category: string | null;
  color: string | null;
  sizes: string[];
  style: string | null;
  tags: string[];
  stock_by_size: Record<string, number> | null | unknown;
  discount_type: "percentage" | "fixed" | null;
  discount_value: number | null;
}

// ─── Constants ──────────────────────────────────────────────────
const CATEGORIES = ["Vestidos", "Blusas", "Calças", "Saias", "Conjuntos", "Acessórios", "Blazers"];
const COLORS = ["Preto", "Branco", "Bege", "Rosa", "Azul", "Verde", "Vermelho", "Marrom", "Cinza", "Estampado"];
const SIZES = ["PP", "P", "M", "G", "GG", "34", "36", "38", "40", "42", "44", "46"];

const OCCASIONS = [
  { label: "Trabalho", query: "trabalho" },
  { label: "Jantar", query: "jantar" },
  { label: "Evento", query: "evento" },
  { label: "Igreja", query: "igreja" },
  { label: "Viagem", query: "viagem" },
  { label: "Dia a dia chic", query: "dia a dia" },
  { label: "Todas as peças", query: "" },
];

const TRUST_ITEMS = [
  { icon: RefreshCw, label: "Troca fácil", desc: "Sem burocracia" },
  { icon: CreditCard, label: "3x sem juros", desc: "No cartão" },
  { icon: MessageCircle, label: "Suporte WhatsApp", desc: "Resposta rápida" },
  { icon: Truck, label: "Envio Brasil", desc: "Todo o país" },
];

// ─── Component ──────────────────────────────────────────────────
const Catalog = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedOccasion, setSelectedOccasion] = useState<string>("");
  const [sortBy, setSortBy] = useState("recent");

  // Read occasion from URL on mount
  useEffect(() => {
    const occasion = searchParams.get("occasion") || "";
    setSelectedOccasion(occasion);
  }, [searchParams]);

  // Live Shop integration
  const { isProductHidden } = useLiveHiddenProducts();

  // Centralized stock
  const productIds = useMemo(() => products.map((p) => p.id), [products]);
  const {
    getAvailable,
    getAvailableSizes: getAvailableSizesFromView,
    getTotalAvailable,
    isProductOutOfStock: checkProductOutOfStock,
    isSizeLowStock,
  } = useProductAvailableStock(productIds.length > 0 ? productIds : undefined);

  // Promotional prices
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

  useEffect(() => {
    async function loadProducts() {
      try {
        const { data, error } = await supabase
          .from("product_catalog")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setProducts(data || []);
      } catch (error) {
        console.error("Error loading products:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    let result = products;

    // Hide live-exclusive products
    result = result.filter((p) => !isProductHidden(p.id));

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.category?.toLowerCase().includes(searchLower)
      );
    }

    // Occasion filter (searches in tags, style, category, name)
    if (selectedOccasion) {
      const occLower = selectedOccasion.toLowerCase();
      result = result.filter(
        (p) =>
          p.tags?.some((t) => t.toLowerCase().includes(occLower)) ||
          p.style?.toLowerCase().includes(occLower) ||
          p.category?.toLowerCase().includes(occLower) ||
          p.name.toLowerCase().includes(occLower)
      );
    }

    // Category filter
    if (selectedCategory) {
      result = result.filter((p) => p.category === selectedCategory);
    }

    // Color filter
    if (selectedColor) {
      result = result.filter((p) => p.color === selectedColor);
    }

    // Size filter (multi-select: product must have stock in at least one selected size)
    if (selectedSizes.length > 0) {
      result = result.filter((p) =>
        selectedSizes.some((size) => getAvailable(p.id, size) > 0)
      );
    }

    // Sort
    switch (sortBy) {
      case "price_asc":
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      case "name":
        result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        break;
    }

    // Out-of-stock always last
    result = [...result].sort((a, b) => {
      const aOut = getTotalAvailable(a.id) <= 0;
      const bOut = getTotalAvailable(b.id) <= 0;
      if (aOut && !bOut) return 1;
      if (!aOut && bOut) return -1;
      return 0;
    });

    return result;
  }, [
    products, search, selectedCategory, selectedColor, selectedSizes,
    sortBy, selectedOccasion, isProductHidden, getAvailable, getTotalAvailable,
  ]);

  const activeFiltersCount = [selectedCategory, selectedColor].filter(Boolean).length + (selectedSizes.length > 0 ? 1 : 0);

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedColor(null);
    setSelectedSizes([]);
    setSearch("");
    setSelectedOccasion("");
  };

  const getProductDisplaySizes = (product: Product): string[] =>
    getAvailableSizesFromView(product.id);

  const hasLowStock = (product: Product): boolean => {
    const sizes = getAvailableSizesFromView(product.id);
    return sizes.some((s) => isSizeLowStock(product.id, s));
  };

  const isProductOutOfStock = (product: Product): boolean =>
    checkProductOutOfStock(product.id);

  const getMainImage = (product: Product): string | undefined => {
    if (product.images && product.images.length > 0) {
      const index = product.main_image_index || 0;
      return product.images[index] || product.images[0];
    }
    return product.image_url || undefined;
  };

  const handleOccasionClick = (query: string) => {
    setSelectedOccasion(query);
    if (query) {
      setSearchParams({ occasion: query });
    } else {
      setSearchParams({});
    }
  };

  // Split products into two halves for the mid-grid editorial section
  const midPoint = Math.ceil(filteredProducts.length / 2);
  const firstHalf = filteredProducts.slice(0, midPoint);
  const secondHalf = filteredProducts.slice(midPoint);

  // ─── Render a product card ─────────────────────────────────────
  const renderProduct = (product: Product) => {
    const outOfStock = isProductOutOfStock(product);
    const lowStock = !outOfStock && hasLowStock(product);

    return (
      <Link key={product.id} to={`/produto/${product.id}`}>
        <div className="relative group">
          {outOfStock ? (
            <Badge
              variant="secondary"
              className="absolute top-3 left-3 z-10 text-[10px] tracking-wider uppercase bg-muted/90 text-muted-foreground backdrop-blur-sm"
            >
              Esgotado
            </Badge>
          ) : lowStock ? (
            <Badge
              className="absolute top-3 left-3 z-10 text-[10px] tracking-wider uppercase bg-foreground/90 text-background backdrop-blur-sm"
            >
              Últimas unidades
            </Badge>
          ) : null}
          <ProductCard
            name={product.name}
            price={getOriginalPrice(product.id, product.price)}
            effectivePrice={getEffectivePrice(product.id, product.price)}
            imageUrl={getMainImage(product)}
            sizes={getProductDisplaySizes(product)}
            isOutOfStock={outOfStock}
            hasPromotionalDiscount={hasPromotionalDiscount(product.id)}
            discountPercent={getDiscountPercent(product.id)}
          />
        </div>
      </Link>
    );
  };

  // ─── Filter select (reusable) ──────────────────────────────────
  const FilterSelect = ({
    value,
    onChange,
    placeholder,
    options,
    width = "w-[140px]",
  }: {
    value: string | null;
    onChange: (v: string | null) => void;
    placeholder: string;
    options: string[];
    width?: string;
  }) => (
    <Select
      value={value || "_all"}
      onValueChange={(v) => onChange(v === "_all" ? null : v)}
    >
      <SelectTrigger
        className={`${width} border-[#ccb487] bg-[#fffaf0] text-xs tracking-wide text-[#2a2926] shadow-sm transition-colors hover:border-[#b99653]`}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="border-[#cfb887] bg-[#fffdf7]">
        <SelectItem value="_all">{placeholder}</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f3e8] text-[#171614]">
      <BenefitsBar />
      <Header />

      {/* ═══ 1. HERO BANNER ═══ */}
      <section className="border-b border-[#ccb487]/30 py-14 px-5 text-center md:py-20">
        <div className="max-w-2xl mx-auto">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#a37d38]">
            Coleção completa
          </span>
          <h1 className="mt-3 mb-4 font-serif text-3xl leading-[1.15] text-[#12241e] md:text-4xl lg:text-5xl">
            Curadoria pensada para{" "}
            <span className="italic text-[#b28a40]">mulheres que não{" "}
              <br className="hidden sm:block" />têm tempo a perder.</span>
          </h1>
          <p className="mx-auto max-w-lg text-sm font-medium leading-relaxed text-[#6e675a] md:text-base">
            Cada peça foi escolhida a dedo para valorizar seu corpo,
            simplificar suas manhãs e fazer você se sentir incrível
            do escritório ao jantar.
          </p>
        </div>
      </section>

      {/* ═══ 2. OCCASION CHIPS ═══ */}
      <section className="px-5 pb-10 pt-10 md:pb-14 md:pt-14">
        <div className="max-w-3xl mx-auto">
          <p className="mb-6 text-center text-xs font-semibold tracking-[0.15em] uppercase text-[#7d7568]">
            Para qual ocasião?
          </p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-4 md:gap-x-8">
            {OCCASIONS.map((occ) => (
              <button
                key={occ.query || "all"}
                onClick={() => handleOccasionClick(occ.query)}
                className="group relative"
              >
                <span
                  className={`
                    font-serif text-base md:text-lg transition-colors duration-300
                    ${selectedOccasion === occ.query
                      ? "text-[#171614]"
                      : "text-[#171614]/55 hover:text-[#171614]/85"
                    }
                  `}
                >
                  {occ.label}
                </span>
                <span
                  className={`
                    absolute -bottom-1 left-0 h-px bg-[#b28a40] transition-all duration-500
                    ${selectedOccasion === occ.query ? "w-full" : "w-0 group-hover:w-full"}
                  `}
                />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 3. FILTERS & SEARCH ═══ */}
      <section className="border-y border-[#ccb487]/35 bg-[#f3ecdd]">
        <div className="max-w-6xl mx-auto px-5 py-4">
          <div className="flex flex-col md:flex-row gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 w-full md:w-auto">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#85775f]" />
              <Input
                placeholder="Buscar por nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 rounded-xl border-[#ccb487] bg-[#fffaf0] pl-10 text-sm text-[#25231f] shadow-sm placeholder:text-[#8b7f69] focus-visible:ring-[#c4a062]"
              />
            </div>

            <div className="flex gap-2 items-center">
              {/* Mobile Filters */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-[#c5ab78] bg-[#fff7e8] text-xs text-[#2f2a22] hover:bg-[#f3e6cb] md:hidden"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    Filtros
                    {activeFiltersCount > 0 && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#a37d38] text-[10px] text-[#fff8e8]">
                        {activeFiltersCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="border-l-[#ccb487]/40 bg-[#f8f2e5]">
                  <SheetHeader>
                    <SheetTitle className="font-serif text-[#15251f]">Filtros</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-6 mt-6">
                    <div>
                      <label className="mb-2 block text-[10px] font-semibold tracking-[0.15em] uppercase text-[#7d7568]">
                        Categoria
                      </label>
                      <FilterSelect
                        value={selectedCategory}
                        onChange={setSelectedCategory}
                        placeholder="Todas"
                        options={CATEGORIES}
                        width="w-full"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-semibold tracking-[0.15em] uppercase text-[#7d7568]">
                        Cor
                      </label>
                      <FilterSelect
                        value={selectedColor}
                        onChange={setSelectedColor}
                        placeholder="Todas"
                        options={COLORS}
                        width="w-full"
                      />
                    </div>
                    <div>
                      <label className="mb-3 block text-[10px] font-semibold tracking-[0.15em] uppercase text-[#7d7568]">
                        Tamanho
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {SIZES.map((size) => (
                          <button
                            key={size}
                            onClick={() => toggleSize(size)}
                            className={`
                              px-3 py-1.5 text-xs tracking-wide border rounded-full transition-all duration-200
                              ${selectedSizes.includes(size)
                                ? "border-[#a37d38] bg-[#15251f] text-[#f8f1de]"
                                : "border-[#cdbd9d] text-[#5f594e] hover:border-[#aa8847]"
                              }
                            `}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                    {activeFiltersCount > 0 && (
                      <Button
                        variant="ghost"
                        onClick={clearFilters}
                        className="w-full text-xs tracking-wide text-[#6f6759] hover:bg-[#ece0c6] hover:text-[#3e372c]"
                      >
                        Limpar filtros
                      </Button>
                    )}
                  </div>
                </SheetContent>
              </Sheet>

              {/* Desktop Filters */}
              <div className="hidden md:flex gap-2">
                <FilterSelect value={selectedCategory} onChange={setSelectedCategory} placeholder="Categoria" options={CATEGORIES} />
                <FilterSelect value={selectedColor} onChange={setSelectedColor} placeholder="Cor" options={COLORS} width="w-[110px]" />

                {/* Size multi-select popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[#ccb487] bg-[#fffaf0] px-3 text-xs tracking-wide text-[#2f2a22] shadow-sm transition-colors hover:border-[#b99653]">
                      {selectedSizes.length > 0
                        ? `${selectedSizes.length} tam.`
                        : "Tamanho"
                      }
                      <ChevronDown className="h-3.5 w-3.5 text-[#7f725b]" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto border-[#ccb487]/60 bg-[#fffcf6] p-3">
                    <p className="mb-2 text-[10px] font-semibold tracking-[0.15em] uppercase text-[#7d7568]">Tamanho</p>
                    <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                      {SIZES.map((size) => (
                        <button
                          key={size}
                          onClick={() => toggleSize(size)}
                          className={`
                            px-2.5 py-1 text-xs tracking-wide border rounded-full transition-all duration-200
                            ${selectedSizes.includes(size)
                              ? "border-[#a37d38] bg-[#15251f] text-[#f8f1de]"
                              : "border-[#cdbd9d] text-[#5f594e] hover:border-[#aa8847]"
                            }
                          `}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                    {selectedSizes.length > 0 && (
                      <button
                        onClick={() => setSelectedSizes([])}
                        className="mt-2 text-[10px] text-[#7d7568] transition-colors hover:text-[#3f392e]"
                      >
                        Limpar tamanhos
                      </button>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[138px] border-[#ccb487] bg-[#fffaf0] text-xs tracking-wide text-[#2f2a22] shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[#cfb887] bg-[#fffdf7]">
                  <SelectItem value="recent">Mais recentes</SelectItem>
                  <SelectItem value="price_asc">Menor preço</SelectItem>
                  <SelectItem value="price_desc">Maior preço</SelectItem>
                  <SelectItem value="name">A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters Tags */}
          {(activeFiltersCount > 0 || selectedOccasion) && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-[#ccb487]/35 pt-3">
              {selectedOccasion && (
                <button
                  onClick={() => handleOccasionClick("")}
                  className="inline-flex items-center gap-1 rounded-full border border-[#b99653]/45 px-3 py-1 text-[11px] tracking-wide text-[#8a672d] transition-colors hover:bg-[#eee0c5]"
                >
                  {selectedOccasion}
                  <X className="h-3 w-3" />
                </button>
              )}
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="inline-flex items-center gap-1 rounded-full border border-[#ccb487] px-3 py-1 text-[11px] tracking-wide text-[#5f594e] transition-colors hover:bg-[#ece0c6]"
                >
                  {selectedCategory}
                  <X className="h-3 w-3" />
                </button>
              )}
              {selectedColor && (
                <button
                  onClick={() => setSelectedColor(null)}
                  className="inline-flex items-center gap-1 rounded-full border border-[#ccb487] px-3 py-1 text-[11px] tracking-wide text-[#5f594e] transition-colors hover:bg-[#ece0c6]"
                >
                  {selectedColor}
                  <X className="h-3 w-3" />
                </button>
              )}
              {selectedSizes.map((size) => (
                <button
                  key={size}
                  onClick={() => toggleSize(size)}
                  className="inline-flex items-center gap-1 rounded-full border border-[#ccb487] px-3 py-1 text-[11px] tracking-wide text-[#5f594e] transition-colors hover:bg-[#ece0c6]"
                >
                  Tam {size}
                  <X className="h-3 w-3" />
                </button>
              ))}
              <button
                onClick={clearFilters}
                className="text-[11px] tracking-wide text-[#746d61] transition-colors hover:text-[#40392d]"
              >
                Limpar todos
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ═══ Results Count ═══ */}
      <div className="max-w-6xl mx-auto px-5 pt-6 pb-2">
        <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#7d7568]">
          {filteredProducts.length} {filteredProducts.length === 1 ? "peça" : "peças"}
          {selectedOccasion ? ` para ${selectedOccasion}` : ""}
        </p>
      </div>

      {/* ═══ 4. PRODUCT GRID — FIRST HALF ═══ */}
      <main className="max-w-6xl mx-auto px-5 py-6">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="mb-3 aspect-[3/4] rounded-xl bg-[#e9ddc6]" />
                <div className="mb-2 h-3 w-3/4 rounded bg-[#e9ddc6]" />
                <div className="h-3 w-1/2 rounded bg-[#e9ddc6]" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <p className="mb-2 font-serif text-xl text-[#14261f]">Nenhuma peça encontrada</p>
            <p className="mb-6 text-sm font-medium text-[#6f685a]">
              Tente remover alguns filtros ou explorar outra ocasião.
            </p>
            <Button
              variant="outline"
              onClick={clearFilters}
              className="border-[#c5ab78] bg-[#fff7e8] text-xs tracking-wide text-[#2f2a22] hover:bg-[#f3e6cb]"
            >
              Limpar filtros
            </Button>
          </div>
        ) : (
          <>
            {/* First half */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {firstHalf.map(renderProduct)}
            </div>

            {/* ═══ 5. EDITORIAL MID-SECTION ═══ */}
            {filteredProducts.length > 3 && (
              <section className="my-12 border-y border-[#ccb487]/35 bg-[#f4ebda]/70 py-12 md:my-16 md:py-16">
                <div className="max-w-2xl mx-auto text-center">
                  <div className="mx-auto mb-6 h-10 w-px bg-[#c7aa6a]/70" />
                  <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#a37d38]">
                    Precisa de ajuda?
                  </span>
                  <h2 className="mt-2 mb-3 font-serif text-2xl italic text-[#11251f] md:text-3xl">
                    Não sabe o que vestir?{" "}
                    <br className="hidden sm:block" />
                    A gente resolve.
                  </h2>
                  <p className="mx-auto mb-8 max-w-md text-sm font-medium leading-relaxed text-[#6f685a]">
                    Responda 5 perguntas sobre seu estilo e tamanho. Em 2
                    minutos a gente monta um provador personalizado e envia
                    sugestões direto no seu WhatsApp.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link to="/meu-estilo">
                      <button className="bg-[#11251f] px-10 py-3.5 text-xs font-medium uppercase tracking-[0.25em] text-[#f3e5c1] transition-colors duration-300 hover:bg-[#183229]">
                        Fazer meu provador VIP
                      </button>
                    </Link>
                    <Link to="/enviar-print">
                      <button className="border border-[#b99653]/55 bg-[#f9f3e3] px-10 py-3.5 text-xs font-medium uppercase tracking-[0.25em] text-[#2f2a22] transition-colors duration-300 hover:bg-[#f2e6cc]">
                        Buscar look por foto
                      </button>
                    </Link>
                  </div>
                </div>
              </section>
            )}

            {/* Second half */}
            {secondHalf.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {secondHalf.map(renderProduct)}
              </div>
            )}
          </>
        )}
      </main>

      {/* ═══ 6. TRUST BADGES ═══ */}
      <section className="bg-[#f2ead9] py-14 px-5 md:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#a37d38]">
            Por que escolher a LE.POÁ
          </span>
          <h2 className="mt-2 mb-3 font-serif text-2xl text-[#11251f] md:text-3xl">
            Mais de 8 anos vestindo mulheres reais.
          </h2>
          <p className="mx-auto mb-10 max-w-md text-sm font-medium text-[#6f685a]">
            Não somos só uma loja. Somos sua parceira de estilo para cada momento da sua vida.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {TRUST_ITEMS.map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-3 group">
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

      {/* ═══ 7. FINAL CTA ═══ */}
      <section className="py-16 md:py-24 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mx-auto mb-6 h-12 w-px bg-[#c7aa6a]/70" />
          <h2 className="mb-4 font-serif text-3xl italic text-[#11251f] md:text-4xl">
            Pronta para se sentir incrível?
          </h2>
          <p className="mx-auto mb-8 max-w-md text-sm font-medium text-[#6f685a] md:text-base">
            Monte seu provador VIP em 2 minutos e receba sugestões
            personalizadas direto no seu WhatsApp.
          </p>
          <Link to="/meu-estilo">
            <button className="bg-[#11251f] px-12 py-4 text-xs font-medium uppercase tracking-[0.25em] text-[#f3e5c1] transition-colors duration-300 hover:bg-[#183229]">
              Quero meu provador VIP
            </button>
          </Link>
          <p className="mt-6 text-[11px] font-medium tracking-wide text-[#7c7467]">
            Gratuito · Leva menos de 2 minutos
          </p>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-[#d7c4a1]/80 py-10 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <p className="mb-1 font-serif text-lg text-[#11251f]">LE.POÁ</p>
              <p className="text-xs font-medium text-[#6f685a]">Curadoria de moda feminina • Anápolis, GO</p>
            </div>

            <div className="flex items-center gap-5 text-sm font-medium text-[#6f685a]">
              <Link to="/catalogo" className="transition-colors hover:text-[#1f1d1a]">Catálogo</Link>
              <Link to="/meu-estilo" className="transition-colors hover:text-[#1f1d1a]">Provador VIP</Link>
              <Link to="/enviar-print" className="transition-colors hover:text-[#1f1d1a]">Buscar por foto</Link>
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
            <p className="text-xs font-medium text-[#7c7467]">
              © {new Date().getFullYear()} LE.POÁ. Todos os direitos reservados.
            </p>
            <Link
              to="/area-lojista"
              className="text-[10px] text-[#7c7467]/70 transition-colors hover:text-[#5f594e]"
            >
              Área do Lojista
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Catalog;
