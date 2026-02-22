import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TrendingProduct {
    product_id: string;
    name: string;
    price: number;
    image_url: string | null;
    images: string[] | null;
    main_image_index: number | null;
    quantity_sold: number;
}

export function useTrendingProducts() {
    const [trendingProducts, setTrendingProducts] = useState<TrendingProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchTrending() {
            try {
                const { data, error } = await (supabase.rpc as any)("get_weekly_trending_products");
                if (error) throw error;
                setTrendingProducts(data || []);
            } catch (err) {
                console.error("Error fetching trending products:", err);
            } finally {
                setIsLoading(false);
            }
        }

        fetchTrending();
    }, []);

    return { trendingProducts, isLoading };
}
