import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Gift, GiftRule, CreateGiftForm, CreateGiftRuleForm } from "@/types/gifts";

export function useGifts() {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [rules, setRules] = useState<GiftRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGifts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("gifts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGifts(data || []);
    } catch (err) {
      console.error("Error fetching gifts:", err);
      toast.error("Erro ao carregar brindes");
    }
  }, []);

  const fetchRules = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("gift_rules")
        .select(`
          *,
          gift:gifts(*),
          live_event:live_events(id, titulo)
        `)
        .order("priority", { ascending: false });

      if (error) throw error;
      setRules((data || []) as GiftRule[]);
    } catch (err) {
      console.error("Error fetching gift rules:", err);
      toast.error("Erro ao carregar regras de brindes");
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchGifts(), fetchRules()]);
    setIsLoading(false);
  }, [fetchGifts, fetchRules]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // CRUD for Gifts
  const createGift = async (data: CreateGiftForm): Promise<Gift | null> => {
    try {
      const { data: gift, error } = await supabase
        .from("gifts")
        .insert({
          name: data.name,
          image_url: data.image_url || null,
          description: data.description || null,
          stock_qty: data.unlimited_stock ? 0 : data.stock_qty,
          unlimited_stock: data.unlimited_stock,
          is_active: data.is_active,
          start_at: data.start_at || null,
          end_at: data.end_at || null,
          require_manual_confirm: data.require_manual_confirm,
          cost: data.cost || null,
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success("Brinde criado com sucesso!");
      fetchGifts();
      return gift;
    } catch (err) {
      console.error("Error creating gift:", err);
      toast.error("Erro ao criar brinde");
      return null;
    }
  };

  const updateGift = async (id: string, data: Partial<CreateGiftForm>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("gifts")
        .update({
          name: data.name,
          image_url: data.image_url,
          description: data.description,
          stock_qty: data.unlimited_stock ? 0 : data.stock_qty,
          unlimited_stock: data.unlimited_stock,
          is_active: data.is_active,
          start_at: data.start_at || null,
          end_at: data.end_at || null,
          require_manual_confirm: data.require_manual_confirm,
          cost: data.cost,
        })
        .eq("id", id);

      if (error) throw error;
      
      toast.success("Brinde atualizado!");
      fetchGifts();
      return true;
    } catch (err) {
      console.error("Error updating gift:", err);
      toast.error("Erro ao atualizar brinde");
      return false;
    }
  };

  const toggleGiftActive = async (id: string, isActive: boolean): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("gifts")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;
      
      setGifts(prev => prev.map(g => g.id === id ? { ...g, is_active: !isActive } : g));
      toast.success(isActive ? "Brinde desativado" : "Brinde ativado");
      return true;
    } catch (err) {
      console.error("Error toggling gift:", err);
      toast.error("Erro ao atualizar brinde");
      return false;
    }
  };

  const deleteGift = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("gifts")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      setGifts(prev => prev.filter(g => g.id !== id));
      toast.success("Brinde excluído");
      return true;
    } catch (err) {
      console.error("Error deleting gift:", err);
      toast.error("Erro ao excluir brinde");
      return false;
    }
  };

  // CRUD for Rules
  const createRule = async (data: CreateGiftRuleForm): Promise<GiftRule | null> => {
    try {
      const { data: rule, error } = await supabase
        .from("gift_rules")
        .insert({
          name: data.name,
          is_active: data.is_active,
          channel_scope: data.channel_scope,
          live_event_id: data.live_event_id || null,
          start_at: data.start_at || null,
          end_at: data.end_at || null,
          priority: data.priority,
          condition_type: data.condition_type,
          condition_value: data.condition_value || null,
          gift_id: data.gift_id,
          gift_qty: data.gift_qty,
          max_per_customer: data.max_per_customer || null,
          max_total_awards: data.max_total_awards || null,
        })
        .select(`*, gift:gifts(*), live_event:live_events(id, titulo)`)
        .single();

      if (error) throw error;
      
      toast.success("Regra criada com sucesso!");
      fetchRules();
      return rule as GiftRule;
    } catch (err) {
      console.error("Error creating rule:", err);
      toast.error("Erro ao criar regra");
      return null;
    }
  };

  const updateRule = async (id: string, data: Partial<CreateGiftRuleForm>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("gift_rules")
        .update({
          name: data.name,
          is_active: data.is_active,
          channel_scope: data.channel_scope,
          live_event_id: data.live_event_id || null,
          start_at: data.start_at || null,
          end_at: data.end_at || null,
          priority: data.priority,
          condition_type: data.condition_type,
          condition_value: data.condition_value,
          gift_id: data.gift_id,
          gift_qty: data.gift_qty,
          max_per_customer: data.max_per_customer,
          max_total_awards: data.max_total_awards,
        })
        .eq("id", id);

      if (error) throw error;
      
      toast.success("Regra atualizada!");
      fetchRules();
      return true;
    } catch (err) {
      console.error("Error updating rule:", err);
      toast.error("Erro ao atualizar regra");
      return false;
    }
  };

  const toggleRuleActive = async (id: string, isActive: boolean): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("gift_rules")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;
      
      setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: !isActive } : r));
      toast.success(isActive ? "Regra desativada" : "Regra ativada");
      return true;
    } catch (err) {
      console.error("Error toggling rule:", err);
      toast.error("Erro ao atualizar regra");
      return false;
    }
  };

  const deleteRule = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("gift_rules")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      setRules(prev => prev.filter(r => r.id !== id));
      toast.success("Regra excluída");
      return true;
    } catch (err) {
      console.error("Error deleting rule:", err);
      toast.error("Erro ao excluir regra");
      return false;
    }
  };

  return {
    gifts,
    rules,
    isLoading,
    fetchAll,
    fetchGifts,
    fetchRules,
    // Gift CRUD
    createGift,
    updateGift,
    toggleGiftActive,
    deleteGift,
    // Rule CRUD
    createRule,
    updateRule,
    toggleRuleActive,
    deleteRule,
  };
}

// Hook for fetching active gifts (for selects, etc.)
export function useActiveGifts() {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchActiveGifts = async () => {
      try {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from("gifts")
          .select("*")
          .eq("is_active", true)
          .or(`start_at.is.null,start_at.lte.${now}`)
          .or(`end_at.is.null,end_at.gte.${now}`)
          .order("name");

        if (error) throw error;
        setGifts(data || []);
      } catch (err) {
        console.error("Error fetching active gifts:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveGifts();
  }, []);

  return { gifts, isLoading };
}
