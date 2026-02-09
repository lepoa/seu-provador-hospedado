import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PendenciaType = 
  | 'observacao_cliente'
  | 'ajuste_tamanho'
  | 'troca'
  | 'enviar_opcoes'
  | 'outros';

export type PendenciaStatus = 'aberta' | 'em_andamento' | 'resolvida';
export type PendenciaPriority = 'baixa' | 'media' | 'alta';

export interface Pendencia {
  id: string;
  live_cart_id: string | null;
  live_event_id: string | null;
  live_customer_id: string | null;
  type: PendenciaType;
  title: string;
  description: string | null;
  status: PendenciaStatus;
  priority: PendenciaPriority;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  // Joined data
  live_cart?: {
    bag_number: number | null;
    total: number;
    live_customer?: {
      instagram_handle: string;
      nome: string | null;
    } | null;
  } | null;
  live_event?: {
    titulo: string;
  } | null;
}

export interface PendenciaFilters {
  status: PendenciaStatus | 'all';
  priority: PendenciaPriority | 'all';
  type: PendenciaType | 'all';
  liveEventId: string;
  search: string;
  assignedTo: string;
}

export function usePendencias(liveEventId?: string) {
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<PendenciaFilters>({
    status: 'all',
    priority: 'all',
    type: 'all',
    liveEventId: liveEventId || '',
    search: '',
    assignedTo: '',
  });

  const fetchPendencias = useCallback(async () => {
    setIsLoading(true);
    
    let query = supabase
      .from('live_pendencias')
      .select(`
        *,
        live_cart:live_carts(
          bag_number,
          total,
          live_customer:live_customers(instagram_handle, nome)
        ),
        live_event:live_events(titulo)
      `)
      .order('created_at', { ascending: false });

    if (filters.liveEventId) {
      query = query.eq('live_event_id', filters.liveEventId);
    }
    if (filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters.priority !== 'all') {
      query = query.eq('priority', filters.priority);
    }
    if (filters.type !== 'all') {
      query = query.eq('type', filters.type);
    }
    if (filters.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching pendencias:', error);
      toast.error('Erro ao carregar pendências');
      return;
    }

    // Filter by search locally
    let filtered = (data || []) as unknown as Pendencia[];
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(p => 
        p.title?.toLowerCase().includes(searchLower) ||
        p.description?.toLowerCase().includes(searchLower) ||
        p.live_cart?.live_customer?.instagram_handle?.toLowerCase().includes(searchLower) ||
        p.live_cart?.live_customer?.nome?.toLowerCase().includes(searchLower) ||
        p.live_cart?.bag_number?.toString().includes(searchLower)
      );
    }

    setPendencias(filtered);
    setIsLoading(false);
  }, [filters]);

  useEffect(() => {
    fetchPendencias();
  }, [fetchPendencias]);

  // Create or update pendencia
  const upsertPendencia = async (data: {
    live_cart_id: string;
    live_event_id?: string;
    live_customer_id?: string;
    type?: PendenciaType;
    title: string;
    description: string;
    priority?: PendenciaPriority;
  }) => {
    // Check if pendencia exists for this cart
    const { data: existing } = await supabase
      .from('live_pendencias')
      .select('id')
      .eq('live_cart_id', data.live_cart_id)
      .eq('type', data.type || 'observacao_cliente')
      .maybeSingle();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('live_pendencias')
        .update({
          title: data.title,
          description: data.description,
          priority: data.priority || 'media',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        toast.error('Erro ao atualizar pendência');
        return null;
      }
      toast.success('Pendência atualizada!');
      fetchPendencias();
      return existing.id;
    } else {
      // Create new
      const { data: created, error } = await supabase
        .from('live_pendencias')
        .insert({
          live_cart_id: data.live_cart_id,
          live_event_id: data.live_event_id,
          live_customer_id: data.live_customer_id,
          type: data.type || 'observacao_cliente',
          title: data.title,
          description: data.description,
          priority: data.priority || 'media',
          status: 'aberta',
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating pendencia:', error);
        toast.error('Erro ao criar pendência');
        return null;
      }
      toast.success('Pendência criada!');
      fetchPendencias();
      return created.id;
    }
  };

  // Update status
  const updateStatus = async (id: string, status: PendenciaStatus) => {
    const updates: any = { status };
    if (status === 'resolvida') {
      updates.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('live_pendencias')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar status');
      return false;
    }
    toast.success(`Status atualizado para ${status}`);
    fetchPendencias();
    return true;
  };

  // Assign to user
  const assignTo = async (id: string, userId: string | null) => {
    const { error } = await supabase
      .from('live_pendencias')
      .update({ assigned_to: userId })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atribuir responsável');
      return false;
    }
    toast.success('Responsável atribuído!');
    fetchPendencias();
    return true;
  };

  // Set due date
  const setDueDate = async (id: string, dueDate: string | null) => {
    const { error } = await supabase
      .from('live_pendencias')
      .update({ due_date: dueDate })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao definir prazo');
      return false;
    }
    toast.success('Prazo definido!');
    fetchPendencias();
    return true;
  };

  // Get pendencia for a cart
  const getPendenciaForCart = async (cartId: string): Promise<Pendencia | null> => {
    const { data, error } = await supabase
      .from('live_pendencias')
      .select('*')
      .eq('live_cart_id', cartId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching pendencia:', error);
      return null;
    }
    return data as unknown as Pendencia | null;
  };

  // Count open pendencias
  const countOpen = pendencias.filter(p => p.status === 'aberta').length;
  const countInProgress = pendencias.filter(p => p.status === 'em_andamento').length;

  return {
    pendencias,
    isLoading,
    filters,
    setFilters,
    fetchPendencias,
    upsertPendencia,
    updateStatus,
    assignTo,
    setDueDate,
    getPendenciaForCart,
    countOpen,
    countInProgress,
  };
}
