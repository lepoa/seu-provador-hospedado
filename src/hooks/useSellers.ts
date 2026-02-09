import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Seller {
  id: string;
  name: string;
  whatsapp: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useSellers() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSellers = async () => {
    const { data, error } = await supabase
      .from("sellers")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error loading sellers:", error);
      return;
    }

    setSellers(data || []);
    setIsLoading(false);
  };

  const loadAllSellers = async () => {
    const { data, error } = await supabase
      .from("sellers")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error loading sellers:", error);
      return;
    }

    setSellers(data || []);
    setIsLoading(false);
  };

  const createSeller = async (seller: { name: string; whatsapp?: string; email?: string }) => {
    const { data, error } = await supabase
      .from("sellers")
      .insert(seller)
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar vendedora");
      throw error;
    }

    setSellers((prev) => [...prev, data]);
    toast.success("Vendedora cadastrada!");
    return data;
  };

  const updateSeller = async (id: string, updates: Partial<Seller>) => {
    const { error } = await supabase
      .from("sellers")
      .update(updates)
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar vendedora");
      throw error;
    }

    setSellers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
    toast.success("Vendedora atualizada!");
  };

  const toggleSellerActive = async (id: string, isActive: boolean) => {
    await updateSeller(id, { is_active: isActive });
  };

  useEffect(() => {
    loadSellers();
  }, []);

  return {
    sellers,
    isLoading,
    loadSellers,
    loadAllSellers,
    createSeller,
    updateSeller,
    toggleSellerActive,
    refetch: loadSellers,
  };
}
