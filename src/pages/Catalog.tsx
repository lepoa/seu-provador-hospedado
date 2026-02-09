import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, Filter, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/Header";
import { BenefitsBar } from "@/components/BenefitsBar";
import { ProductCard } from "@/components/ProductCard";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getAvailableSizes, isLowStock } from "@/components/StockBySize";
import { getTotalStock, isOutOfStock, getAvailableSizesSorted } from "@/lib/sizeUtils";
import { useLiveHiddenProducts } from "@/hooks/useLiveStock";
import { useProductAvailableStock } from "@/hooks/useProductAvailableStock";
import { useEffectivePrices } from "@/hooks/useEffectivePrices";

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
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number | null;
}

const CATEGORIES = ["Vestidos", "Blusas", "Calças", "Saias", "Conjuntos", "Acessórios", "Blazers"];
const COLORS = ["Preto", "Branco", "Bege", "Rosa", "Azul", "Verde", "Vermelho", "Marrom", "Cinza", "Estampado"];
const SIZES = ["PP", "P", "M", "G", "GG", "34", "36", "38", "40", "42", "44", "46"];

const Catalog = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("recent");

  // Live Shop integration - hide exclusive products and track reserved stock
  const { isProductHidden, isLoading: hiddenLoading } = useLiveHiddenProducts();
  
  // Centralized stock hook - uses view that calculates on_hand - committed - reserved
  const productIds = useMemo(() => products.map(p => p.id), [products]);
  const { 
    getAvailable, 
    getAvailableSizes: getAvailableSizesFromView, 
    getTotalAvailable,
    isProductOutOfStock: checkProductOutOfStock,
    isSizeLowStock,
    isLoading: stockLoading 
  } = useProductAvailableStock(productIds.length > 0 ? productIds : undefined);

  // Promotional tables - get effective prices
  const { 
    getEffectivePrice, 
    getOriginalPrice, 
    hasDiscount: hasPromotionalDiscount,
    getDiscountPercent,
    isLoading: pricesLoading 
  } = useEffectivePrices({ 
    channel: 'catalog', 
    productIds: productIds.length > 0 ? productIds : undefined,
    enabled: productIds.length > 0
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

    // Filter out products hidden by active lives (EXCLUSIVO_LIVE)
    result = result.filter(p => !isProductHidden(p.id));

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.category?.toLowerCase().includes(searchLower)
      );
    }

    // Category filter
    if (selectedCategory) {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Color filter
    if (selectedColor) {
      result = result.filter(p => p.color === selectedColor);
    }

    // Size filter - filter by available stock from centralized view
    if (selectedSize) {
      result = result.filter(p => {
        const availableStock = getAvailable(p.id, selectedSize);
        return availableStock > 0;
      });
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

    // ALWAYS sort out-of-stock products to the end (after other sorting)
    // Uses centralized view for accurate stock calculation
    result = [...result].sort((a, b) => {
      const aAvailable = getTotalAvailable(a.id);
      const bAvailable = getTotalAvailable(b.id);
      
      const aOutOfStock = aAvailable <= 0;
      const bOutOfStock = bAvailable <= 0;
      
      if (aOutOfStock && !bOutOfStock) return 1;
      if (!aOutOfStock && bOutOfStock) return -1;
      return 0;
    });

    return result;
  }, [products, search, selectedCategory, selectedColor, selectedSize, sortBy, isProductHidden, getAvailable, getTotalAvailable]);

  const activeFiltersCount = [selectedCategory, selectedColor, selectedSize].filter(Boolean).length;

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedColor(null);
    setSelectedSize(null);
    setSearch("");
  };

  // Get available sizes for display on product card (from centralized view)
  const getProductDisplaySizes = (product: Product): string[] => {
    return getAvailableSizesFromView(product.id);
  };

  // Check if product has any low stock sizes (from centralized view)
  const hasLowStock = (product: Product): boolean => {
    const availableSizes = getAvailableSizesFromView(product.id);
    return availableSizes.some(size => isSizeLowStock(product.id, size));
  };

  // Check if product is out of stock (from centralized view)
  const isProductOutOfStock = (product: Product): boolean => {
    return checkProductOutOfStock(product.id);
  };

  // Get main image
  const getMainImage = (product: Product): string | undefined => {
    if (product.images && product.images.length > 0) {
      const index = product.main_image_index || 0;
      return product.images[index] || product.images[0];
    }
    return product.image_url || undefined;
  };

  return (
    <div className="min-h-screen bg-background">
      <BenefitsBar />
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl md:text-4xl mb-2">
            Nossas Peças
          </h1>
          <p className="text-muted-foreground">
            Explore nossa coleção e encontre seu estilo
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            {/* Mobile Filters */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="md:hidden gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros
                  {activeFiltersCount > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Filtros</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 mt-6">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Categoria</label>
                    <Select
                      value={selectedCategory || "_all"}
                      onValueChange={(v) => setSelectedCategory(v === "_all" ? null : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">Todas</SelectItem>
                        {CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Cor</label>
                    <Select
                      value={selectedColor || "_all"}
                      onValueChange={(v) => setSelectedColor(v === "_all" ? null : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">Todas</SelectItem>
                        {COLORS.map(color => (
                          <SelectItem key={color} value={color}>{color}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Tamanho</label>
                    <Select
                      value={selectedSize || "_all"}
                      onValueChange={(v) => setSelectedSize(v === "_all" ? null : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">Todos</SelectItem>
                        {SIZES.map(size => (
                          <SelectItem key={size} value={size}>{size}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {activeFiltersCount > 0 && (
                    <Button variant="ghost" onClick={clearFilters} className="w-full">
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            {/* Desktop Filters */}
            <div className="hidden md:flex gap-2">
              <Select
                value={selectedCategory || "_all"}
                onValueChange={(v) => setSelectedCategory(v === "_all" ? null : v)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todas</SelectItem>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedColor || "_all"}
                onValueChange={(v) => setSelectedColor(v === "_all" ? null : v)}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Cor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todas</SelectItem>
                  {COLORS.map(color => (
                    <SelectItem key={color} value={color}>{color}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedSize || "_all"}
                onValueChange={(v) => setSelectedSize(v === "_all" ? null : v)}
              >
                <SelectTrigger className="w-[110px]">
                  <SelectValue placeholder="Tamanho" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todos</SelectItem>
                  {SIZES.map(size => (
                    <SelectItem key={size} value={size}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Mais recentes</SelectItem>
                <SelectItem value="price_asc">Menor preço</SelectItem>
                <SelectItem value="price_desc">Maior preço</SelectItem>
                <SelectItem value="name">A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filters Tags */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="inline-flex items-center gap-1 px-3 py-1 bg-secondary text-sm rounded-full hover:bg-secondary/80"
              >
                {selectedCategory}
                <X className="h-3 w-3" />
              </button>
            )}
            {selectedColor && (
              <button
                onClick={() => setSelectedColor(null)}
                className="inline-flex items-center gap-1 px-3 py-1 bg-secondary text-sm rounded-full hover:bg-secondary/80"
              >
                {selectedColor}
                <X className="h-3 w-3" />
              </button>
            )}
            {selectedSize && (
              <button
                onClick={() => setSelectedSize(null)}
                className="inline-flex items-center gap-1 px-3 py-1 bg-secondary text-sm rounded-full hover:bg-secondary/80"
              >
                Tam {selectedSize}
                <X className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={clearFilters}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Limpar todos
            </button>
          </div>
        )}

        {/* Results Count */}
        <p className="text-sm text-muted-foreground mb-6">
          {filteredProducts.length} {filteredProducts.length === 1 ? "produto" : "produtos"}
        </p>

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/4] bg-secondary rounded-xl mb-3" />
                <div className="h-4 bg-secondary rounded w-3/4 mb-2" />
                <div className="h-4 bg-secondary rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">
              Nenhum produto encontrado com esses filtros.
            </p>
            <Button variant="outline" onClick={clearFilters}>
              Limpar filtros
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {filteredProducts.map((product) => {
              const productOutOfStock = isProductOutOfStock(product);
              const productHasLowStock = !productOutOfStock && hasLowStock(product);
              
              return (
                <Link key={product.id} to={`/produto/${product.id}`}>
                  <div className="relative">
                    {productOutOfStock ? (
                      <Badge 
                        variant="secondary" 
                        className="absolute top-2 left-2 z-10 text-[10px] bg-muted text-muted-foreground"
                      >
                        Esgotado
                      </Badge>
                    ) : productHasLowStock && (
                      <Badge 
                        variant="destructive" 
                        className="absolute top-2 left-2 z-10 text-[10px]"
                      >
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Últimas unidades
                      </Badge>
                    )}
                    <ProductCard
                      name={product.name}
                      price={getOriginalPrice(product.id, product.price)}
                      effectivePrice={getEffectivePrice(product.id, product.price)}
                      imageUrl={getMainImage(product)}
                      sizes={getProductDisplaySizes(product)}
                      isOutOfStock={productOutOfStock}
                      hasPromotionalDiscount={hasPromotionalDiscount(product.id)}
                      discountPercent={getDiscountPercent(product.id)}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-border mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 Provador VIP. Feito com ❤️ para lojistas de moda.</p>
        </div>
      </footer>
    </div>
  );
};

export default Catalog;
