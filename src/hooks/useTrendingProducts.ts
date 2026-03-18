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
                // Try fetching actual trending items
                const { data, error } = await (supabase.rpc as any)("get_weekly_trending_products");
                if (error) throw error;
                
                if (data && data.length > 0) {
                    setTrendingProducts(data);
                } else {
                    // Fallback: If no sales, get highest stock items to show curatorship
                    const { data: fallbackData, error: fallbackError } = await supabase
                        .from('product_catalog')
                        .select('id, name, price, image_url, images, main_image_index, stock_quantity')
                        .eq('is_active', true)
                        .order('stock_quantity', { ascending: false, nullsFirst: false })
                        .limit(10);
                        
                    if (!fallbackError && fallbackData) {
                        const mappedFallback = fallbackData.map((item: any) => ({
                            product_id: item.id,
                            name: item.name,
                            price: item.price,
                            image_url: item.image_url,
                            images: item.images,
                            main_image_index: item.main_image_index,
                            quantity_sold: 0 // placeholder for fallback items
                        }));
                        setTrendingProducts(mappedFallback);
                    } else {
                        // If stock_quantity fails (e.g., column misnamed), try a basic fallback
                        const { data: secondFallback } = await supabase
                            .from('product_catalog')
                            .select('id, name, price, image_url, images, main_image_index')
                            .eq('is_active', true)
                            .order('created_at', { ascending: false })
                            .limit(10);
                            
                        if (secondFallback) {
                            const mappedSecondFallback = secondFallback.map((item: any) => ({
                                product_id: item.id,
                                name: item.name,
                                price: item.price,
                                image_url: item.image_url,
                                images: item.images,
                                main_image_index: item.main_image_index,
                                quantity_sold: 0
                            }));
                            setTrendingProducts(mappedSecondFallback);
                        }
                    }
                }
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
