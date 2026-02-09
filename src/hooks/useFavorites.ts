import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface FavoriteProduct {
  id: string;
  product_id: string;
  created_at: string;
}

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load user's favorites
  const loadFavorites = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("customer_favorites")
        .select("product_id")
        .eq("user_id", user.id);

      if (error) throw error;
      setFavorites(data?.map((f) => f.product_id) || []);
    } catch (error) {
      console.error("Error loading favorites:", error);
    }
  }, [user]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const isFavorite = useCallback(
    (productId: string) => favorites.includes(productId),
    [favorites]
  );

  const toggleFavorite = useCallback(
    async (productId: string): Promise<boolean> => {
      if (!user) {
        return false; // Not logged in
      }

      setIsLoading(true);
      const wasFavorite = favorites.includes(productId);

      try {
        if (wasFavorite) {
          // Remove favorite
          const { error } = await supabase
            .from("customer_favorites")
            .delete()
            .eq("user_id", user.id)
            .eq("product_id", productId);

          if (error) throw error;
          setFavorites((prev) => prev.filter((id) => id !== productId));
          toast.success("Removido dos favoritos");
        } else {
          // Add favorite
          const { error } = await supabase
            .from("customer_favorites")
            .insert({ user_id: user.id, product_id: productId });

          if (error) throw error;
          setFavorites((prev) => [...prev, productId]);
          toast.success("Adicionado aos favoritos ❤️");
        }
        return true;
      } catch (error) {
        console.error("Error toggling favorite:", error);
        toast.error("Erro ao atualizar favoritos");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [user, favorites]
  );

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    isLoading,
    refetch: loadFavorites,
  };
}
