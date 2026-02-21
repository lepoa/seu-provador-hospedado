import { Link } from "react-router-dom";
import { Flame, ChevronRight, ChevronLeft } from "lucide-react";
import { useTrendingProducts } from "@/hooks/useTrendingProducts";
import { ProductCard } from "@/components/ProductCard";
import { useEffectivePrices } from "@/hooks/useEffectivePrices";
import { useProductAvailableStock } from "@/hooks/useProductAvailableStock";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";

export function TrendingSection() {
    const { trendingProducts, isLoading } = useTrendingProducts();

    const productIds = trendingProducts.map((p) => p.product_id);

    const {
        getEffectivePrice,
        getOriginalPrice,
        hasDiscount,
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

    if (isLoading) {
        return (
            <section className="py-14 px-5">
                <div className="max-w-6xl mx-auto">
                    <div className="h-8 bg-secondary animate-pulse w-48 mb-8 rounded" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="aspect-[3/4] bg-secondary animate-pulse rounded-xl" />
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    if (trendingProducts.length === 0) {
        return (
            <section className="py-14 px-5 border-y border-dashed border-accent/20 bg-accent/5">
                <div className="max-w-6xl mx-auto text-center opacity-40">
                    <Flame className="h-6 w-6 mx-auto mb-2" />
                    <p className="text-sm">O carrossel de tendências aparecerá aqui assim que houver pedidos pagos.</p>
                </div>
            </section>
        );
    }

    const getMainImage = (p: any) => {
        if (p.images?.length) return p.images[p.main_image_index || 0] || p.images[0];
        return p.image_url || undefined;
    };

    return (
        <section className="py-14 md:py-20 px-5 overflow-hidden">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                    <div className="text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                            <span className="bg-secondary text-primary text-[10px] font-bold px-4 py-1.5 rounded-full flex items-center gap-2 uppercase tracking-[0.2em] border border-gold/20 shadow-sm">
                                <Flame className="h-3.5 w-3.5 text-gold" />
                                Escolha do Personal Stylist
                            </span>
                        </div>
                        <h2 className="font-serif text-4xl md:text-5xl font-medium text-primary leading-tight mb-4">
                            Coleção em <span className="italic">Destaque</span>
                        </h2>
                        <p className="text-muted-foreground text-sm md:text-lg font-light max-w-lg">
                            Peças curadas estrategicamente para elevar seu guarda-roupa.
                        </p>
                    </div>
                </div>

                <Carousel
                    opts={{
                        align: "start",
                        loop: true,
                    }}
                    className="w-full relative"
                >
                    <CarouselContent className="-ml-4">
                        {trendingProducts.map((product) => (
                            <CarouselItem key={product.product_id} className="pl-4 basis-1/2 md:basis-1/3 lg:basis-1/4">
                                <Link to={`/produto/${product.product_id}`} className="block h-full group">
                                    <ProductCard
                                        name={product.name}
                                        price={getOriginalPrice(product.product_id, product.price)}
                                        effectivePrice={getEffectivePrice(product.product_id, product.price)}
                                        imageUrl={getMainImage(product)}
                                        sizes={getAvailableSizes(product.product_id)}
                                        isOutOfStock={isProductOutOfStock(product.product_id)}
                                        hasPromotionalDiscount={hasDiscount(product.product_id)}
                                        discountPercent={getDiscountPercent(product.product_id)}
                                    />
                                </Link>
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <div className="absolute -top-16 right-12 hidden md:flex gap-2">
                        <CarouselPrevious className="static translate-y-0" />
                        <CarouselNext className="static translate-y-0" />
                    </div>
                </Carousel>
            </div>
        </section>
    );
}
