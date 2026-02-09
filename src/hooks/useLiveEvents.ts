import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { 
  LiveEvent, 
  LiveProduct, 
  LiveEventStatus, 
  CreateLiveEventForm,
  LiveEventKPIs 
} from "@/types/liveShop";

interface LiveEventWithStats extends LiveEvent {
  productsCount: number;
  cartsCount: number;
  totalPaid: number;
}

export function useLiveEvents() {
  const [events, setEvents] = useState<LiveEventWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch events
      const { data: eventsData, error: eventsError } = await supabase
        .from("live_events")
        .select("*")
        .order("data_hora_inicio", { ascending: false });

      if (eventsError) throw eventsError;

      // Fetch stats for each event
      const eventsWithStats = await Promise.all(
        (eventsData || []).map(async (event) => {
          // Get products count
          const { count: productsCount } = await supabase
            .from("live_products")
            .select("*", { count: 'exact', head: true })
            .eq("live_event_id", event.id);

          // Get carts count
          const { count: cartsCount } = await supabase
            .from("live_carts")
            .select("*", { count: 'exact', head: true })
            .eq("live_event_id", event.id);

          // Get total paid
          const { data: paidCarts } = await supabase
            .from("live_carts")
            .select("total")
            .eq("live_event_id", event.id)
            .eq("status", "pago");

          const totalPaid = (paidCarts || []).reduce((sum, cart) => sum + (cart.total || 0), 0);

          return {
            ...event,
            productsCount: productsCount || 0,
            cartsCount: cartsCount || 0,
            totalPaid,
          } as LiveEventWithStats;
        })
      );

      setEvents(eventsWithStats);
    } catch (err: any) {
      console.error("Error fetching live events:", err);
      setError(err.message);
      toast.error("Erro ao carregar lives");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const createEvent = async (form: CreateLiveEventForm): Promise<LiveEvent | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("live_events")
        .insert({
          titulo: form.titulo,
          data_hora_inicio: form.data_hora_inicio,
          observacoes: form.observacoes || null,
          reservation_expiry_minutes: form.reservation_expiry_minutes || 30,
          user_id: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success("Live criada com sucesso!");
      fetchEvents();
      return data as LiveEvent;
    } catch (err: any) {
      console.error("Error creating live event:", err);
      toast.error("Erro ao criar live");
      return null;
    }
  };

  const updateEventStatus = async (eventId: string, status: LiveEventStatus): Promise<boolean> => {
    try {
      const updateData: Partial<LiveEvent> = { status };
      
      // If starting live, record the actual start time
      if (status === 'ao_vivo') {
        updateData.data_hora_inicio = new Date().toISOString();
      }
      
      // If ending live, ONLY record the end time
      // CRITICAL: Do NOT cancel/expire carts or release stock here!
      // Live bags must remain active for 7 days (reservation_expiry_minutes from event).
      // Closing the live only stops NEW orders from being created.
      if (status === 'encerrada') {
        updateData.data_hora_fim = new Date().toISOString();
        // Note: All existing carts/bags remain intact with their reservations.
        // They will expire naturally based on their individual expiration times.
      }

      const { error } = await supabase
        .from("live_events")
        .update(updateData)
        .eq("id", eventId);

      if (error) throw error;
      
      const statusLabels: Record<LiveEventStatus, string> = {
        'planejada': 'Planejada',
        'ao_vivo': 'Ao Vivo',
        'encerrada': 'Encerrada',
        'arquivada': 'Arquivada'
      };
      
      toast.success(`Live ${statusLabels[status]}!`);
      fetchEvents();
      return true;
    } catch (err: any) {
      console.error("Error updating live event status:", err);
      toast.error("Erro ao atualizar status da live");
      return false;
    }
  };

  const deleteEvent = async (eventId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("live_events")
        .delete()
        .eq("id", eventId);

      if (error) throw error;
      
      toast.success("Live excluída com sucesso!");
      fetchEvents();
      return true;
    } catch (err: any) {
      console.error("Error deleting live event:", err);
      toast.error("Erro ao excluir live");
      return false;
    }
  };

  return {
    events,
    isLoading,
    error,
    fetchEvents,
    createEvent,
    updateEventStatus,
    deleteEvent,
  };
}

export function useLiveEvent(eventId: string | undefined) {
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [products, setProducts] = useState<LiveProduct[]>([]);
  const [kpis, setKPIs] = useState<LiveEventKPIs>({
    totalPlanejado: { itens: 0, valor: 0 },
    totalReservado: { itens: 0, valor: 0 },
    totalVendido: { itens: 0, valor: 0 },
    totalEmAberto: { itens: 0, valor: 0 },
    percentualPago: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchEvent = useCallback(async () => {
    if (!eventId) return;
    
    setIsLoading(true);
    try {
      // Fetch event
      const { data: eventData, error: eventError } = await supabase
        .from("live_events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData as LiveEvent);

      // Fetch products with full product data
      const { data: productsData, error: productsError } = await supabase
        .from("live_products")
        .select(`
          *,
          product:product_catalog(
            id, name, image_url, images, price, color, 
            stock_by_size, category, sku, group_key
          )
        `)
        .eq("live_event_id", eventId)
        .order("prioridade_ordem");

      if (productsError) throw productsError;
      
      // CRITICAL: Fetch REAL available stock from the unified view
      // This ensures Live shows the same availability as Catalog
      const productIds = (productsData || []).map((p: any) => p.product_id).filter(Boolean);
      let availableStockMap: Record<string, Record<string, number>> = {};
      
      if (productIds.length > 0) {
        const { data: stockData, error: stockError } = await supabase
          .from("product_available_stock")
          .select("product_id, size, available")
          .in("product_id", productIds);
        
        if (!stockError && stockData) {
          // Build map: product_id -> { size -> available }
          stockData.forEach((entry: any) => {
            if (!availableStockMap[entry.product_id]) {
              availableStockMap[entry.product_id] = {};
            }
            // Only include sizes with available > 0
            if (entry.available > 0) {
              availableStockMap[entry.product_id][entry.size] = entry.available;
            }
          });
        }
      }
      
      // Merge available stock into products - REPLACE stock_by_size with available stock
      const productsWithAvailable = (productsData || []).map((lp: any) => {
        const available = availableStockMap[lp.product_id] || {};
        return {
          ...lp,
          product: lp.product ? {
            ...lp.product,
            // CRITICAL: Replace stock_by_size with available stock
            // This ensures UI shows only available sizes
            available_by_size: available,
          } : null,
        };
      });
      
      setProducts(productsWithAvailable as LiveProduct[]);

      // Calculate KPIs
      await calculateKPIs(eventId);

    } catch (err: any) {
      console.error("Error fetching live event:", err);
      toast.error("Erro ao carregar live");
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  const calculateKPIs = async (eventId: string) => {
    try {
      // Get all carts for this event
      const { data: cartsData } = await supabase
        .from("live_carts")
        .select(`
          *,
          items:live_cart_items(*)
        `)
        .eq("live_event_id", eventId);

      const carts = cartsData || [];
      
      let totalReservadoItens = 0;
      let totalReservadoValor = 0;
      let totalVendidoItens = 0;
      let totalVendidoValor = 0;
      let totalEmAbertoItens = 0;
      let totalEmAbertoValor = 0;

      carts.forEach((cart: any) => {
        const items = cart.items || [];
        const cartTotal = items.reduce((sum: number, item: any) => 
          sum + (item.preco_unitario * item.qtd), 0);
        const cartItens = items.reduce((sum: number, item: any) => sum + item.qtd, 0);

        if (cart.status === 'pago') {
          totalVendidoItens += cartItens;
          totalVendidoValor += cartTotal;
        } else if (['aberto', 'em_confirmacao', 'aguardando_pagamento'].includes(cart.status)) {
          const reservedItems = items.filter((i: any) => 
            ['reservado', 'confirmado'].includes(i.status));
          const reservedTotal = reservedItems.reduce((sum: number, item: any) => 
            sum + (item.preco_unitario * item.qtd), 0);
          const reservedItens = reservedItems.reduce((sum: number, item: any) => 
            sum + item.qtd, 0);
          
          totalReservadoItens += reservedItens;
          totalReservadoValor += reservedTotal;
          totalEmAbertoItens += reservedItens;
          totalEmAbertoValor += reservedTotal;
        }
      });

      // Get planned products
      const { data: plannedProducts } = await supabase
        .from("live_products")
        .select(`
          *,
          product:product_catalog(price, stock_by_size)
        `)
        .eq("live_event_id", eventId);

      let totalPlanejadoItens = 0;
      let totalPlanejadoValor = 0;

      (plannedProducts || []).forEach((lp: any) => {
        const stock = lp.product?.stock_by_size || {};
        const totalStock = lp.limite_unidades_live || 
          Object.values(stock).reduce((sum: number, qty: any) => sum + (qty || 0), 0);
        const price = lp.product?.price || 0;
        
        totalPlanejadoItens += totalStock as number;
        totalPlanejadoValor += (totalStock as number) * price;
      });

      const totalCarrinho = totalVendidoItens + totalEmAbertoItens;
      const percentualPago = totalCarrinho > 0 
        ? Math.round((totalVendidoItens / totalCarrinho) * 100) 
        : 0;

      setKPIs({
        totalPlanejado: { itens: totalPlanejadoItens, valor: totalPlanejadoValor },
        totalReservado: { itens: totalReservadoItens, valor: totalReservadoValor },
        totalVendido: { itens: totalVendidoItens, valor: totalVendidoValor },
        totalEmAberto: { itens: totalEmAbertoItens, valor: totalEmAbertoValor },
        percentualPago,
      });
    } catch (err) {
      console.error("Error calculating KPIs:", err);
    }
  };

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const addProduct = async (productId: string, config: {
    visibilidade: LiveProduct['visibilidade'];
    bloquear_desde_planejamento: boolean;
    limite_unidades_live?: number | null;
    live_discount_type?: 'percentage' | 'fixed' | null;
    live_discount_value?: number | null;
    stock_reservations?: Record<string, number>;
    reserve_all?: boolean;
  }): Promise<boolean> => {
    if (!eventId) return false;

    try {
      // Get current max order
      const maxOrder = products.reduce((max, p) => 
        Math.max(max, p.prioridade_ordem), 0);

      // Fetch REAL availability for snapshot (never use on_hand / stock_by_size)
      const { data: availableRows, error: availableError } = await supabase
        .from("product_available_stock")
        .select("size, available")
        .eq("product_id", productId);

      if (availableError) {
        console.error("[useLiveEvent.addProduct] Error fetching availability:", availableError);
      }

      const availableBySize: Record<string, number> = {};
      (availableRows || []).forEach((row: any) => {
        const available = Number(row.available || 0);
        if (available > 0) availableBySize[row.size] = available;
      });

      // Determine snapshot_variantes
      // - If manual reservations provided, keep them (but strip zeros)
      // - Otherwise snapshot the REAL availability (available > 0)
      let snapshotVariantes: Record<string, number> = {};
      let limiteUnidades: number | null = null;

      const cleanedReservations = Object.fromEntries(
        Object.entries(config.stock_reservations || {}).filter(([, qty]) => Number(qty || 0) > 0)
      ) as Record<string, number>;

      if (Object.keys(cleanedReservations).length > 0) {
        snapshotVariantes = cleanedReservations;
        limiteUnidades = Object.values(snapshotVariantes).reduce((sum, qty) => sum + (qty || 0), 0);
      } else {
        snapshotVariantes = availableBySize; // may be {}

        if (config.reserve_all) {
          limiteUnidades = Object.values(snapshotVariantes).reduce((sum, qty) => sum + (qty || 0), 0);
        } else {
          limiteUnidades = config.limite_unidades_live ?? null;
        }
      }

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log("[useLiveEvent.addProduct] snapshot_variantes source", {
          productId,
          snapshot_variantes: snapshotVariantes,
          limite_unidades_live: limiteUnidades,
          reserve_all: config.reserve_all,
        });
      }
      const { error } = await supabase
        .from("live_products")
        .insert({
          live_event_id: eventId,
          product_id: productId,
          prioridade_ordem: maxOrder + 1,
          visibilidade: config.visibilidade,
          bloquear_desde_planejamento: config.bloquear_desde_planejamento,
          limite_unidades_live: limiteUnidades,
          snapshot_variantes: snapshotVariantes,
          live_discount_type: config.live_discount_type || null,
          live_discount_value: config.live_discount_value || null,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error("Este produto já está na live");
          return false;
        }
        throw error;
      }

      toast.success("Produto adicionado à live!");
      fetchEvent();
      return true;
    } catch (err: any) {
      console.error("Error adding product to live:", err);
      toast.error("Erro ao adicionar produto");
      return false;
    }
  };

  const removeProduct = async (liveProductId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("live_products")
        .delete()
        .eq("id", liveProductId);

      if (error) throw error;

      toast.success("Produto removido da live!");
      fetchEvent();
      return true;
    } catch (err: any) {
      console.error("Error removing product from live:", err);
      toast.error("Erro ao remover produto");
      return false;
    }
  };

  const updateProductOrder = async (orderedIds: string[]): Promise<boolean> => {
    try {
      const updates = orderedIds.map((id, index) => 
        supabase
          .from("live_products")
          .update({ prioridade_ordem: index })
          .eq("id", id)
      );

      await Promise.all(updates);
      fetchEvent();
      return true;
    } catch (err: any) {
      console.error("Error updating product order:", err);
      toast.error("Erro ao reordenar produtos");
      return false;
    }
  };

  return {
    event,
    products,
    kpis,
    isLoading,
    fetchEvent,
    addProduct,
    removeProduct,
    updateProductOrder,
  };
}
