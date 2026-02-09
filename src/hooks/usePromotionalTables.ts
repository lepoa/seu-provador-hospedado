import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PromotionalTable, PromotionalTableInsert, PromotionalTableUpdate, CategoryDiscount, ProductDiscount } from '@/types/promotionalTables';

export function usePromotionalTables() {
  const [tables, setTables] = useState<PromotionalTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTables = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('promotional_tables')
        .select('*')
        .order('priority', { ascending: false });

      if (error) throw error;

      // Parse JSONB fields - handle both string and object cases
      const parseJsonField = (field: any): any[] => {
        if (!field) return [];
        if (Array.isArray(field)) return field;
        if (typeof field === 'string') {
          try {
            const parsed = JSON.parse(field);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
        return [];
      };

      const parsed = (data || []).map((row: any) => ({
        ...row,
        category_discounts: parseJsonField(row.category_discounts),
        product_discounts: parseJsonField(row.product_discounts),
      })) as PromotionalTable[];

      setTables(parsed);
    } catch (err) {
      console.error('Error fetching promotional tables:', err);
      toast.error('Erro ao carregar tabelas promocionais');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const createTable = async (data: PromotionalTableInsert): Promise<boolean> => {
    try {
      const { error } = await supabase.from('promotional_tables').insert({
        ...data,
        category_discounts: JSON.stringify(data.category_discounts),
        product_discounts: JSON.stringify(data.product_discounts),
      });

      if (error) throw error;

      toast.success('Tabela promocional criada!');
      await fetchTables();
      return true;
    } catch (err) {
      console.error('Error creating promotional table:', err);
      toast.error('Erro ao criar tabela promocional');
      return false;
    }
  };

  const updateTable = async (id: string, data: PromotionalTableUpdate): Promise<boolean> => {
    try {
      const updateData: any = { ...data };
      if (data.category_discounts) {
        updateData.category_discounts = JSON.stringify(data.category_discounts);
      }
      if (data.product_discounts) {
        updateData.product_discounts = JSON.stringify(data.product_discounts);
      }

      const { error } = await supabase
        .from('promotional_tables')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast.success('Tabela promocional atualizada!');
      await fetchTables();
      return true;
    } catch (err) {
      console.error('Error updating promotional table:', err);
      toast.error('Erro ao atualizar tabela promocional');
      return false;
    }
  };

  const deleteTable = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('promotional_tables')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Tabela promocional excluída!');
      setTables(prev => prev.filter(t => t.id !== id));
      return true;
    } catch (err) {
      console.error('Error deleting promotional table:', err);
      toast.error('Erro ao excluir tabela promocional');
      return false;
    }
  };

  const toggleActive = async (table: PromotionalTable): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('promotional_tables')
        .update({ is_active: !table.is_active })
        .eq('id', table.id);

      if (error) throw error;

      setTables(prev =>
        prev.map(t =>
          t.id === table.id ? { ...t, is_active: !t.is_active } : t
        )
      );
      toast.success(table.is_active ? 'Tabela desativada' : 'Tabela ativada');
      return true;
    } catch (err) {
      console.error('Error toggling table:', err);
      toast.error('Erro ao atualizar tabela');
      return false;
    }
  };

  return {
    tables,
    isLoading,
    fetchTables,
    createTable,
    updateTable,
    deleteTable,
    toggleActive,
  };
}
