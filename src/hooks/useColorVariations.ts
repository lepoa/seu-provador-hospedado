import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ColorVariation {
  id: string;
  name: string;
  color: string | null;
  price: number;
  image_url: string | null;
  sizes: string[];
  is_active: boolean;
}

export function useColorVariations() {
  const [isLoading, setIsLoading] = useState(false);
  const [variations, setVariations] = useState<ColorVariation[]>([]);

  const fetchVariations = useCallback(
    async (groupKey: string | null, excludeProductId?: string, customerSize?: string | null): Promise<ColorVariation[]> => {
      if (!groupKey) {
        setVariations([]);
        return [];
      }

      setIsLoading(true);

      try {
        let query = supabase
          .from("product_catalog")
          .select("id, name, color, price, image_url, sizes, is_active")
          .eq("group_key", groupKey)
          .eq("is_active", true);

        if (excludeProductId) {
          query = query.neq("id", excludeProductId);
        }

        const { data, error } = await query;

        if (error) {
          console.error("Error fetching color variations:", error);
          return [];
        }

        if (!data || data.length === 0) {
          setVariations([]);
          return [];
        }

        // Filter by size if specified
        let filteredData = data.map(p => ({
          ...p,
          sizes: p.sizes || [],
        }));

        if (customerSize) {
          const normalizedSize = customerSize.toLowerCase().trim();
          filteredData = filteredData.filter(p => 
            p.sizes.some(s => s.toLowerCase().trim() === normalizedSize)
          );
        }

        setVariations(filteredData);
        return filteredData;
      } catch (err) {
        console.error("Error finding color variations:", err);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearVariations = useCallback(() => {
    setVariations([]);
  }, []);

  return {
    isLoading,
    variations,
    fetchVariations,
    clearVariations,
  };
}
