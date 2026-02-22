import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Full status flow per business requirements
export type OperationalStatus =
  | 'aguardando_pagamento'   // Initial
  | 'aguardando_retorno'     // Customer was contacted, waiting response
  | 'pago'                   // Payment confirmed
  | 'preparar_envio'         // Paid and ready for logistics
  | 'etiqueta_gerada'        // Shipping label created (Correios)
  | 'postado'                // Shipped (Correios)
  | 'em_rota'                // In transit (Motoboy)
  | 'retirada'               // Ready for pickup
  | 'retirado'               // Picked up (alias of entregue for retirada)
  | 'entregue'               // FINAL - Delivered (any method)
  | 'pendencia_dados'         // Missing shipping data
  | 'aguardando_validacao_pagamento'; // New status for manual payment review


export type DeliveryMethod = 'retirada' | 'motoboy' | 'correios';
export type DeliveryPeriod = 'manha' | 'tarde' | 'qualquer';
export type PaymentReviewStatus = 'none' | 'pending_review' | 'approved' | 'rejected';

export interface LiveOrderCart {
  id: string;
  live_event_id: string;
  live_customer_id: string;
  status: string;
  operational_status: OperationalStatus;
  subtotal: number;
  descontos: number;
  frete: number;
  total: number;
  bag_number: number | null;
  seller_id: string | null;
  delivery_method: DeliveryMethod;
  delivery_period: DeliveryPeriod | null;
  delivery_notes: string | null;
  shipping_address_snapshot: any;
  me_shipment_id: string | null;
  me_label_url: string | null;
  shipping_tracking_code: string | null;
  shipping_service_name: string | null;
  separation_status: string | null;
  is_raffle_winner: boolean | null;
  raffle_name: string | null;
  needs_label_reprint: boolean | null;
  label_printed_at: string | null;
  // Charge tracking
  last_charge_at: string | null;
  charge_attempts: number;
  charge_channel: string | null;
  charge_by_user: string | null;
  // Payment tracking
  paid_method: string | null;
  paid_at: string | null;
  paid_by_user: string | null;
  payment_proof_url: string | null;
  payment_review_status: PaymentReviewStatus;
  // Payment validation (admin)
  validated_at: string | null;
  validated_by_user_id: string | null;
  rejection_reason: string | null;
  // Customer notes
  customer_checkout_notes: string | null;
  customer_live_notes: string | null;
  created_at: string;
  updated_at: string;
  public_token: string | null;
  live_customer?: {
    id: string;
    instagram_handle: string;
    nome: string | null;
    whatsapp: string | null;
    client_id: string | null;
  };
  items?: {
    id: string;
    product_id: string;
    variante: any;
    qtd: number;
    preco_unitario: number;
    status: string;
    separation_status: string | null;
    product?: {
      id: string;
      name: string;
      image_url: string | null;
      color: string | null;
      sku: string | null;
    };
  }[];
  seller?: {
    id: string;
    name: string;
  };
}

// Urgency checks with clear thresholds
export interface UrgencyInfo {
  isUrgent: boolean;
  reason: string | null;
  hoursOverdue: number;
}

export interface LiveOrderFilters {
  search: string;
  status: string;
  deliveryMethod: string;
  sellerId: string;
  urgentOnly: boolean;
  needsCharge: boolean;
  pendingProof: boolean;
}

export function useLiveOrders(eventId: string | undefined) {
  const [orders, setOrders] = useState<LiveOrderCart[]>([]);
  const [sellers, setSellers] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch current user for auto-assignment
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    getUser();
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!eventId) return;

    setIsLoading(true);
    try {
      const { data: cartsData, error: cartsError } = await supabase
        .from("live_carts")
        .select(`
          *,
          live_customer:live_customers(*),
          items:live_cart_items(
            *,
            product:product_catalog(id, name, image_url, color, sku)
          ),
          seller:sellers(id, name)
        `)
        .eq("live_event_id", eventId)
        .order("created_at", { ascending: false });

      if (cartsError) throw cartsError;
      if (isMountedRef.current) {
        setOrders((cartsData || []) as LiveOrderCart[]);
      }

      // Fetch sellers for dropdown
      const { data: sellersData } = await supabase
        .from("sellers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (isMountedRef.current && sellersData) {
        setSellers(sellersData);
      }

    } catch (err: any) {
      console.error("Error fetching orders:", err);
      if (isMountedRef.current) {
        toast.error("Erro ao carregar pedidos");
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [eventId]);

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;
    fetchOrders();
    return () => { isMountedRef.current = false; };
  }, [fetchOrders]);

  // Real-time subscription
  useEffect(() => {
    if (!eventId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`live_orders_${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_carts', filter: `live_event_id=eq.${eventId}` },
        () => {
          if (isMountedRef.current) fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_cart_items' },
        () => {
          if (isMountedRef.current) fetchOrders();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [eventId, fetchOrders]);

  // Helper: Calculate urgency for an order
  const getOrderUrgency = useCallback((order: LiveOrderCart): UrgencyInfo => {
    const now = Date.now();
    const hoursSinceCreation = (now - new Date(order.created_at).getTime()) / (1000 * 60 * 60);
    const hoursSincePaid = order.paid_at
      ? (now - new Date(order.paid_at).getTime()) / (1000 * 60 * 60)
      : 0;
    const hoursSinceLastCharge = order.last_charge_at
      ? (now - new Date(order.last_charge_at).getTime()) / (1000 * 60 * 60)
      : null;

    // Check urgency based on status and thresholds
    const status = order.operational_status || order.status;

    // Awaiting payment: > 24h without charge or never charged
    if (status === 'aguardando_pagamento' || status === 'aberto') {
      if (!order.last_charge_at && hoursSinceCreation > 24) {
        return { isUrgent: true, reason: 'Nunca cobrado +24h', hoursOverdue: hoursSinceCreation - 24 };
      }
      if (hoursSinceLastCharge && hoursSinceLastCharge > 24) {
        return { isUrgent: true, reason: 'Cobrar novamente +24h', hoursOverdue: hoursSinceLastCharge - 24 };
      }
    }

    // Awaiting return: > 24h without new contact
    if (status === 'aguardando_retorno') {
      if (hoursSinceLastCharge && hoursSinceLastCharge > 24) {
        return { isUrgent: true, reason: 'Sem retorno +24h', hoursOverdue: hoursSinceLastCharge - 24 };
      }
    }

    // Paid but not advanced: > 12h stuck
    if (status === 'pago' && hoursSincePaid > 12) {
      return { isUrgent: true, reason: 'Pago +12h sem avanço', hoursOverdue: hoursSincePaid - 12 };
    }

    // Label generated but not posted: > 24h
    if (status === 'etiqueta_gerada') {
      const hoursSinceLabel = order.label_printed_at
        ? (now - new Date(order.label_printed_at).getTime()) / (1000 * 60 * 60)
        : hoursSincePaid;
      if (hoursSinceLabel > 24) {
        return { isUrgent: true, reason: 'Etiqueta +24h sem postar', hoursOverdue: hoursSinceLabel - 24 };
      }
    }

    // In transit: > 8h without delivered
    if (status === 'em_rota') {
      const hoursSinceRoute = hoursSincePaid; // Approximate
      if (hoursSinceRoute > 8) {
        return { isUrgent: true, reason: 'Em rota +8h', hoursOverdue: hoursSinceRoute - 8 };
      }
    }

    return { isUrgent: false, reason: null, hoursOverdue: 0 };
  }, []);

  // KPIs computed from orders - extended with new statuses
  // Excludes cancelled orders and gifts from sales counts
  const kpis = useMemo(() => {
    const activeOrders = orders.filter(o => o.status !== 'cancelado');
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    // Helper to calculate order value (excluding gifts)
    const getOrderValue = (o: LiveOrderCart) => {
      const productTotal = o.items?.reduce((itemSum, item) => {
        if (item.preco_unitario === 0) return itemSum;
        if (['reservado', 'confirmado'].includes(item.status)) {
          return itemSum + (item.preco_unitario * item.qtd);
        }
        return itemSum;
      }, 0) || 0;
      return productTotal + (o.frete || 0) - (o.descontos || 0);
    };

    // Count orders needing charge (pending > 24h since last charge or never charged)
    const needsChargeCount = activeOrders.filter(o => {
      const status = o.operational_status || o.status;
      if (status === 'pago' || o.status === 'pago') return false;
      if (!o.last_charge_at) return true;
      return new Date(o.last_charge_at).getTime() < oneDayAgo;
    }).length;

    // Count urgent orders
    const urgentCount = activeOrders.filter(o => getOrderUrgency(o).isUrgent).length;

    // Calculate total paid - only TRULY paid orders (pago status and beyond)
    const paidStatuses = ['pago', 'preparar_envio', 'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue', 'retirado'];
    const trulyPaidOrders = activeOrders.filter(o =>
      o.status === 'pago' || paidStatuses.includes(o.operational_status || '')
    );

    // Total pago excludes gifts (brindes) - only count actual product sales
    const totalPago = trulyPaidOrders.reduce((sum, o) => sum + getOrderValue(o), 0);

    // Orders by status for value calculations
    const awaitingPaymentOrders = activeOrders.filter(o =>
      (o.operational_status === 'aguardando_pagamento' || o.status === 'aguardando_pagamento' || o.status === 'aberto') &&
      o.operational_status !== 'aguardando_retorno'
    );
    const awaitingReturnOrders = activeOrders.filter(o => o.operational_status === 'aguardando_retorno');
    const paidOnlyOrders = activeOrders.filter(o => o.status === 'pago' &&
      !['preparar_envio', 'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue'].includes(o.operational_status || '')
    );
    const prepareShippingOrders = activeOrders.filter(o => o.operational_status === 'preparar_envio');
    const deliveredOrders = activeOrders.filter(o => o.operational_status === 'entregue' || o.operational_status === 'retirado');
    const validationOrders = activeOrders.filter(o => o.operational_status === 'aguardando_validacao_pagamento');


    return {
      aguardandoPagamento: awaitingPaymentOrders.length,
      aguardandoRetorno: awaitingReturnOrders.length,
      pago: paidOnlyOrders.length,
      prepararEnvio: prepareShippingOrders.length,
      etiquetaGerada: activeOrders.filter(o => o.operational_status === 'etiqueta_gerada').length,
      postado: activeOrders.filter(o => o.operational_status === 'postado').length,
      emRota: activeOrders.filter(o => o.operational_status === 'em_rota').length,
      retirada: activeOrders.filter(o => o.operational_status === 'retirada' ||
        (o.delivery_method === 'retirada' && o.status === 'pago' && o.operational_status !== 'entregue')
      ).length,
      motoboy: activeOrders.filter(o => o.delivery_method === 'motoboy' && o.status === 'pago' &&
        !['entregue'].includes(o.operational_status || '')
      ).length,
      entregue: deliveredOrders.length,
      pendencias: activeOrders.filter(o => o.operational_status === 'pendencia_dados').length,
      semResponsavel: activeOrders.filter(o => !o.seller_id && o.status !== 'cancelado').length,
      needsCharge: needsChargeCount,
      urgentCount,
      pendingProof: activeOrders.filter(o => o.payment_review_status === 'pending_review').length,
      totalPago,
      totalPedidos: activeOrders.length,
      // Values per status
      valorAguardandoPagamento: awaitingPaymentOrders.reduce((sum, o) => sum + getOrderValue(o), 0),
      valorAguardandoRetorno: awaitingReturnOrders.reduce((sum, o) => sum + getOrderValue(o), 0),
      valorPago: paidOnlyOrders.reduce((sum, o) => sum + getOrderValue(o), 0),
      valorPrepararEnvio: prepareShippingOrders.reduce((sum, o) => sum + getOrderValue(o), 0),
      valorEntregue: deliveredOrders.reduce((sum, o) => sum + getOrderValue(o), 0),
      aguardandoValidacao: validationOrders.length,
      valorAguardandoValidacao: validationOrders.reduce((sum, o) => sum + getOrderValue(o), 0),
    };

  }, [orders, getOrderUrgency]);

  // Filter orders
  const filterOrders = useCallback((filters: LiveOrderFilters): LiveOrderCart[] => {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    return orders.filter(order => {
      // Exclude cancelled
      if (order.status === 'cancelado') return false;

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          order.live_customer?.instagram_handle.toLowerCase().includes(searchLower) ||
          order.live_customer?.nome?.toLowerCase().includes(searchLower) ||
          order.bag_number?.toString().includes(searchLower) ||
          order.items?.some(item =>
            item.product?.sku?.toLowerCase().includes(searchLower) ||
            item.product?.name.toLowerCase().includes(searchLower)
          );
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status && filters.status !== 'all') {
        if (filters.status === 'aguardando_pagamento') {
          if (order.status !== 'aguardando_pagamento' && order.status !== 'aberto') return false;
        } else if (filters.status === 'pago') {
          if (order.status !== 'pago') return false;
        } else if (order.operational_status !== filters.status) {
          return false;
        }
      }

      // Delivery method filter
      if (filters.deliveryMethod && filters.deliveryMethod !== 'all') {
        if (order.delivery_method !== filters.deliveryMethod) return false;
      }

      // Seller filter
      if (filters.sellerId) {
        if (filters.sellerId === 'none' && order.seller_id) return false;
        if (filters.sellerId !== 'none' && order.seller_id !== filters.sellerId) return false;
      }

      // Urgent filter (pending > 24h)
      if (filters.urgentOnly) {
        const createdAt = new Date(order.created_at);
        const hoursAgo = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        if (hoursAgo < 24 || order.status === 'pago') return false;
      }

      // Needs charge filter
      if (filters.needsCharge) {
        if (order.status === 'pago') return false;
        if (order.last_charge_at && new Date(order.last_charge_at).getTime() >= oneDayAgo) return false;
      }

      // Pending proof filter
      if (filters.pendingProof) {
        if (order.payment_review_status !== 'pending_review') return false;
      }

      return true;
    });
  }, [orders]);

  // Actions - with optimistic updates
  const assignSeller = useCallback(async (orderId: string, sellerId: string | null) => {
    // Optimistic update
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, seller_id: sellerId, seller: sellerId ? sellers.find(s => s.id === sellerId) : undefined } : o
    ));

    const { data, error } = await supabase
      .from("live_carts")
      .update({ seller_id: sellerId, updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .select(`*, seller:sellers(id, name)`)
      .single();

    if (error) {
      toast.error("Erro ao atribuir vendedora");
      fetchOrders(); // Revert on error
      return false;
    }

    // Update with confirmed data
    if (data) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...data } as LiveOrderCart : o));
    }

    toast.success(sellerId ? "Vendedora atribuída" : "Vendedora removida");
    return true;
  }, [sellers, fetchOrders]);

  const updateOperationalStatus = useCallback(async (orderId: string, status: OperationalStatus) => {
    const { error } = await supabase
      .from("live_carts")
      .update({ operational_status: status, updated_at: new Date().toISOString() })
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao atualizar status");
      return false;
    }
    toast.success("Status atualizado");
    return true;
  }, []);

  const updateDeliveryMethod = useCallback(async (orderId: string, method: DeliveryMethod) => {
    const { error } = await supabase
      .from("live_carts")
      .update({ delivery_method: method, updated_at: new Date().toISOString() })
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao atualizar método de entrega");
      return false;
    }
    toast.success("Método de entrega atualizado");
    return true;
  }, []);

  // Update delivery method WITH shipping amount and recalculate total
  // This is used for admin manual payment flow where delivery must be set first
  const updateDeliveryWithShipping = useCallback(async (
    orderId: string,
    method: DeliveryMethod,
    shippingAmount: number,
    shippingServiceName?: string
  ) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      toast.error("Pedido não encontrado");
      return false;
    }

    // Block if already paid
    if (order.status === 'pago') {
      toast.error("Não é possível alterar entrega de pedido já pago");
      return false;
    }

    // Calculate new total
    const newTotal = order.subtotal - order.descontos + shippingAmount;

    const updateData: Record<string, any> = {
      delivery_method: method,
      frete: shippingAmount,
      total: newTotal,
      updated_at: new Date().toISOString()
    };

    // Add shipping service name if provided (for Correios)
    if (shippingServiceName) {
      updateData.shipping_service_name = shippingServiceName;
    }

    const { error } = await supabase
      .from("live_carts")
      .update(updateData)
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao atualizar entrega");
      return false;
    }

    // Update local state optimistically
    setOrders(prev => prev.map(o =>
      o.id === orderId ? {
        ...o,
        delivery_method: method,
        frete: shippingAmount,
        total: newTotal,
        shipping_service_name: shippingServiceName || o.shipping_service_name
      } as LiveOrderCart : o
    ));

    toast.success("Entrega configurada!");
    return true;
  }, [orders]);

  // Update customer ZIP code for future orders
  const updateCustomerZipCode = useCallback(async (customerId: string, zipCode: string) => {
    const { error } = await supabase
      .from("customers")
      .update({
        zip_code: zipCode,
        updated_at: new Date().toISOString()
      })
      .eq("id", customerId);

    if (error) {
      console.error("Error updating customer ZIP:", error);
      return false;
    }

    console.log("[useLiveOrders] Customer ZIP updated:", customerId, zipCode);
    return true;
  }, []);

  const updateDeliveryDetails = useCallback(async (orderId: string, period: DeliveryPeriod | null, notes: string | null) => {
    const { error } = await supabase
      .from("live_carts")
      .update({
        delivery_period: period,
        delivery_notes: notes,
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao atualizar detalhes de entrega");
      return false;
    }
    toast.success("Detalhes de entrega atualizados");
    return true;
  }, []);

  // Apply stock effects after payment (idempotent RPC)
  const applyPaidEffects = useCallback(async (liveCartId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('apply_live_cart_paid_effects', {
        p_live_cart_id: liveCartId
      });

      if (error) {
        console.error('[applyPaidEffects] RPC error:', error);
        return false;
      }

      console.log('[applyPaidEffects] Result:', data);

      // Parse JSON response safely
      const result = typeof data === 'object' ? data as Record<string, unknown> : null;
      if (result?.success) {
        if (result.already_processed) {
          console.log('[applyPaidEffects] Stock already decremented (idempotent)');
        } else {
          console.log('[applyPaidEffects] Stock decremented:', result.items_count, 'items');
        }
        return true;
      }

      return false;
    } catch (err) {
      console.error('[applyPaidEffects] Exception:', err);
      return false;
    }
  }, []);

  // Mark as paid - for Mercado Pago (automatic) payments only
  // Manual payments MUST use markAsPaidWithProof with mandatory proof upload
  // CRITICAL: Order of operations matters due to DB trigger:
  // 1. First confirm items (so trigger finds them)
  // 2. Then update cart status (triggers stock decrement)
  const markAsPaid = useCallback(async (orderId: string, paymentMethod: string) => {
    // Manual methods require proof - redirect to proper flow
    const manualMethods = ['rede', 'pix_itau', 'pix_rede', 'link_rede', 'dinheiro', 'pix', 'cartao'];
    if (manualMethods.includes(paymentMethod.toLowerCase())) {
      toast.error("Pagamento manual requer comprovante. Use o botão 'Pago' no card do pedido.");
      return false;
    }

    const order = orders.find(o => o.id === orderId);

    // STEP 1: Update item statuses to 'confirmado' FIRST
    // This MUST happen before updating cart status
    const { error: itemsError } = await supabase
      .from("live_cart_items")
      .update({ status: 'confirmado' })
      .eq("live_cart_id", orderId)
      .eq("status", 'reservado');

    if (itemsError) {
      console.error('[markAsPaid] Failed to confirm items:', itemsError);
    }

    // STEP 2: Update cart status to 'pago' (triggers on_live_cart_paid)
    const { error } = await supabase
      .from("live_carts")
      .update({
        status: 'pago',
        operational_status: 'pago',
        paid_method: paymentMethod,
        paid_at: new Date().toISOString(),
        paid_by_user: currentUserId,
        payment_review_status: 'approved', // Auto-approve gateway payments
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao marcar como pago");
      return false;
    }

    // STEP 3: Log status change
    await supabase.from("live_cart_status_history").insert({
      live_cart_id: orderId,
      old_status: order?.operational_status || 'aguardando_pagamento',
      new_status: 'pago',
      payment_method: paymentMethod,
      changed_by: currentUserId,
    });

    // STEP 4: Fallback - Apply stock effects (idempotent)
    const stockResult = await applyPaidEffects(orderId);
    if (!stockResult) {
      console.warn('[markAsPaid] Stock decrement may have failed for:', orderId);
    }

    toast.success("Pagamento confirmado!");
    return true;
  }, [currentUserId, orders, applyPaidEffects]);

  // Mark as paid with MANDATORY proof for manual payments
  // Methods: REDE, Pix Itaú, Pix REDE, Link REDE, Dinheiro
  // CRITICAL: Order of operations matters due to DB trigger:
  // 1. First confirm items (so trigger finds them)
  // 2. Then update cart status (triggers stock decrement)
  // 3. Manual RPC call as fallback
  const markAsPaidWithProof = useCallback(async (
    orderId: string,
    paymentMethod: string,
    proofUrl: string,
    notes?: string
  ) => {
    // MANDATORY: proof URL must be provided
    if (!proofUrl || proofUrl.trim() === '') {
      toast.error("Comprovante obrigatório para pagamento manual");
      return false;
    }

    // MANDATORY: method must be one of the allowed manual methods
    const allowedMethods = ['rede', 'pix_itau', 'pix_rede', 'link_rede', 'dinheiro'];
    if (!allowedMethods.includes(paymentMethod.toLowerCase())) {
      toast.error("Método de pagamento inválido");
      return false;
    }

    const order = orders.find(o => o.id === orderId);

    // STEP 1: Update item statuses to 'confirmado' FIRST
    // This MUST happen before updating cart status, so the DB trigger
    // (on_live_cart_paid) finds items to process
    const { error: itemsError } = await supabase
      .from("live_cart_items")
      .update({ status: 'confirmado' })
      .eq("live_cart_id", orderId)
      .eq("status", 'reservado');

    if (itemsError) {
      console.error('[markAsPaidWithProof] Failed to confirm items:', itemsError);
      toast.error("Erro ao confirmar itens do carrinho");
      return false;
    }

    // STEP 2: Update cart status to 'pago' (this triggers on_live_cart_paid)
    const { error } = await supabase
      .from("live_carts")
      .update({
        status: 'pago',
        operational_status: 'pago',
        paid_method: paymentMethod,
        paid_at: new Date().toISOString(),
        paid_by_user: currentUserId,
        payment_proof_url: proofUrl,
        payment_review_status: 'pending_review',
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao marcar como pago");
      return false;
    }

    // STEP 3: Log status change with notes
    await supabase.from("live_cart_status_history").insert({
      live_cart_id: orderId,
      old_status: order?.operational_status || 'aguardando_pagamento',
      new_status: 'pago',
      payment_method: paymentMethod,
      changed_by: currentUserId,
      notes: notes || `Pagamento manual (${paymentMethod}) com comprovante`,
    });

    // STEP 4: Fallback - call stock effects manually (idempotent)
    // The trigger should have handled it, but this ensures it runs
    const stockResult = await applyPaidEffects(orderId);
    if (!stockResult) {
      console.warn('[markAsPaidWithProof] Stock decrement may have failed for:', orderId);
    }

    toast.success("Pagamento registrado (pendente validação)");
    return true;
  }, [currentUserId, orders, applyPaidEffects]);

  // Approve manual payment - ADMIN ONLY
  const approveManualPayment = useCallback(async (orderId: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("live_carts")
      .update({
        payment_review_status: 'approved',
        validated_at: now,
        validated_by_user_id: currentUserId,
        updated_at: now
      })
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao aprovar pagamento");
      return false;
    }

    // Log validation
    await supabase.from("live_cart_status_history").insert({
      live_cart_id: orderId,
      old_status: 'pago',
      new_status: 'pago',
      notes: 'Pagamento manual validado pelo admin',
      changed_by: currentUserId,
    });

    // Ensure stock effects are applied (idempotent - safe to call again)
    const stockResult = await applyPaidEffects(orderId);
    if (!stockResult) {
      console.warn('[approveManualPayment] Stock decrement may have failed for:', orderId);
    }

    toast.success("Pagamento validado!");
    return true;
  }, [currentUserId, applyPaidEffects]);

  // Reject manual payment - ADMIN ONLY
  const rejectManualPayment = useCallback(async (orderId: string, reason: string) => {
    if (!reason.trim()) {
      toast.error("Motivo da rejeição é obrigatório");
      return false;
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("live_carts")
      .update({
        status: 'aguardando_pagamento',
        operational_status: 'aguardando_retorno',
        payment_review_status: 'rejected',
        rejection_reason: reason,
        validated_at: now,
        validated_by_user_id: currentUserId,
        // Don't clear proof - keep for audit
        updated_at: now
      })
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao rejeitar pagamento");
      return false;
    }

    // Log rejection
    await supabase.from("live_cart_status_history").insert({
      live_cart_id: orderId,
      old_status: 'pago',
      new_status: 'aguardando_retorno',
      notes: `Pagamento rejeitado: ${reason}`,
      changed_by: currentUserId,
    });

    // Revert item statuses
    await supabase
      .from("live_cart_items")
      .update({ status: 'reservado' })
      .eq("live_cart_id", orderId)
      .eq("status", 'confirmado');

    toast.success("Pagamento rejeitado. Vendedora pode cobrar novamente.");
    return true;
  }, [currentUserId]);

  // Record charge - SEPARATED from opening WhatsApp/Direct
  // This only records the charge and updates status
  const recordCharge = useCallback(async (orderId: string, channel: 'whatsapp' | 'direct') => {
    const now = new Date().toISOString();

    // Get current attempts
    const order = orders.find(o => o.id === orderId);
    const attempts = (order?.charge_attempts || 0) + 1;

    // Update cart with charge info AND move to aguardando_retorno
    const updateData: Record<string, any> = {
      last_charge_at: now,
      charge_attempts: attempts,
      charge_channel: channel,
      charge_by_user: currentUserId,
      operational_status: 'aguardando_retorno', // Always move to awaiting return when charge is recorded
      updated_at: now,
    };

    const { error } = await supabase
      .from("live_carts")
      .update(updateData)
      .eq("id", orderId);

    if (error) {
      console.error("Error recording charge:", error);
      toast.error("Erro ao registrar cobrança");
      return false;
    }

    // Log charge in history
    await supabase.from("live_charge_logs").insert({
      live_cart_id: orderId,
      charged_by: currentUserId,
      channel,
    });

    // Log status change
    await supabase.from("live_cart_status_history").insert({
      live_cart_id: orderId,
      old_status: order?.operational_status || 'aguardando_pagamento',
      new_status: 'aguardando_retorno',
      notes: `Cobrança registrada via ${channel}`,
      changed_by: currentUserId,
    });

    // Update local state optimistically
    setOrders(prev => prev.map(o =>
      o.id === orderId ? {
        ...o,
        last_charge_at: now,
        charge_attempts: attempts,
        charge_channel: channel,
        operational_status: 'aguardando_retorno'
      } as LiveOrderCart : o
    ));

    toast.success("Cobrança registrada! Status: Aguardando retorno");
    return true;
  }, [orders, currentUserId]);

  // Advance to next logical status with BLOCKING RULES
  const advanceStatus = useCallback(async (orderId: string): Promise<boolean> => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return false;

    // BLOCK: Cannot advance if payment is pending validation
    if (order.payment_review_status === 'pending_review') {
      toast.error("Pagamento aguardando validação do admin. Não é possível avançar.");
      return false;
    }

    const currentStatus = order.operational_status || 'aguardando_pagamento';
    let nextStatus: OperationalStatus | null = null;

    // BLOCKING RULES: Enforce proper status transitions
    // Correios: can only be "Entregue" if "Postado" + has tracking
    if (order.delivery_method === 'correios' && currentStatus === 'postado') {
      if (!order.shipping_tracking_code) {
        toast.error("Correios: necessário código de rastreio para marcar entregue");
        return false;
      }
      nextStatus = 'entregue';
    }
    // Correios: can only be "Postado" if has label/tracking
    else if (order.delivery_method === 'correios' && currentStatus === 'etiqueta_gerada') {
      if (!order.me_label_url && !order.shipping_tracking_code) {
        toast.error("Correios: necessário gerar etiqueta primeiro");
        return false;
      }
      nextStatus = 'postado';
    }
    // Motoboy: can only be "Entregue" if "em_rota"
    else if (order.delivery_method === 'motoboy' && currentStatus !== 'em_rota' && currentStatus === 'pago') {
      nextStatus = 'em_rota'; // Must go through em_rota first
    }
    else if (order.delivery_method === 'motoboy' && currentStatus === 'em_rota') {
      nextStatus = 'entregue';
    }
    // Retirada: can only be "Entregue" if "retirada" status
    else if (order.delivery_method === 'retirada' && currentStatus !== 'retirada' && currentStatus === 'pago') {
      nextStatus = 'retirada'; // Must go through retirada first
    }
    else if (order.delivery_method === 'retirada' && currentStatus === 'retirada') {
      nextStatus = 'entregue';
    }
    // General status flow
    else {
      switch (currentStatus) {
        case 'pago':
          if (order.delivery_method === 'correios') {
            nextStatus = 'preparar_envio';
          } else if (order.delivery_method === 'motoboy') {
            nextStatus = 'em_rota';
          } else {
            nextStatus = 'retirada';
          }
          break;
        case 'preparar_envio':
          // Can only advance if we generate label first
          toast.info("Gere a etiqueta Melhor Envio primeiro");
          return false;
        case 'postado':
          nextStatus = 'entregue';
          break;
        default:
          toast.error("Não é possível avançar deste status");
          return false;
      }
    }

    if (!nextStatus) return false;

    const { error } = await supabase
      .from("live_carts")
      .update({
        operational_status: nextStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao avançar status");
      return false;
    }

    // Log status change
    await supabase.from("live_cart_status_history").insert({
      live_cart_id: orderId,
      old_status: currentStatus,
      new_status: nextStatus,
      changed_by: currentUserId,
    });

    // Optimistic update
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, operational_status: nextStatus } as LiveOrderCart : o
    ));

    toast.success(`Status atualizado para ${nextStatus.replace(/_/g, ' ')}`);
    return true;
  }, [orders, currentUserId]);

  // Revert to previous status - with audit logging
  // Admin can revert any status; Seller can only revert 1 step (not validated payments)
  const revertStatus = useCallback(async (
    orderId: string,
    targetStatus: OperationalStatus,
    reason: string,
    isAdmin: boolean
  ): Promise<boolean> => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return false;

    // SELLER RESTRICTIONS
    if (!isAdmin) {
      // Sellers cannot revert validated payments
      if (order.payment_review_status === 'approved' &&
        ['pago', 'preparar_envio', 'etiqueta_gerada'].includes(targetStatus)) {
        toast.error("Apenas admin pode reverter pagamentos validados");
        return false;
      }
      // Sellers can only go back 1 step
      const statusOrder: OperationalStatus[] = [
        'aguardando_pagamento', 'aguardando_retorno', 'pago', 'preparar_envio',
        'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue'
      ];
      const currentIdx = statusOrder.indexOf(order.operational_status);
      const targetIdx = statusOrder.indexOf(targetStatus);
      if (currentIdx - targetIdx > 1) {
        toast.error("Vendedora pode voltar apenas 1 etapa");
        return false;
      }
    }

    // ADMIN: Reason is required
    if (isAdmin && !reason.trim()) {
      toast.error("Admin deve informar motivo para reversão");
      return false;
    }

    const now = new Date().toISOString();
    const updateData: Record<string, any> = {
      operational_status: targetStatus,
      updated_at: now,
    };

    // If reverting from paid status, may need to adjust cart status
    if (['aguardando_pagamento', 'aguardando_retorno'].includes(targetStatus)) {
      updateData.status = 'aguardando_pagamento';
    }

    const { error } = await supabase
      .from("live_carts")
      .update(updateData)
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao reverter status");
      return false;
    }

    // Log the reversion with reason
    await supabase.from("live_cart_status_history").insert({
      live_cart_id: orderId,
      old_status: order.operational_status,
      new_status: targetStatus,
      notes: `REVERSÃO: ${reason || 'Sem motivo informado'}`,
      changed_by: currentUserId,
    });

    // Optimistic update
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, operational_status: targetStatus, ...updateData } as LiveOrderCart : o
    ));

    toast.success(`Status revertido para ${targetStatus.replace(/_/g, ' ')}`);
    return true;
  }, [orders, currentUserId]);

  const generateShippingLabel = useCallback(async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return { success: false, error: "Pedido não encontrado" };

    // Check if we have address data
    if (!order.shipping_address_snapshot) {
      await supabase.from("live_carts").update({
        operational_status: 'pendencia_dados'
      }).eq("id", orderId);
      return { success: false, error: "Dados de envio pendentes" };
    }

    try {
      const { data, error } = await supabase.functions.invoke('generate-shipping-label', {
        body: { cartId: orderId }
      });

      if (error) throw error;

      return { success: true, labelUrl: data.label_url, trackingCode: data.tracking_code };
    } catch (err: any) {
      toast.error("Erro ao gerar etiqueta");
      return { success: false, error: err.message };
    }
  }, [orders]);

  const markAsPosted = useCallback(async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);

    // Check separation status
    if (order?.separation_status !== 'separado') {
      toast.error("Pedido precisa ser separado antes de postar");
      return false;
    }

    const { error } = await supabase
      .from("live_carts")
      .update({
        operational_status: 'postado',
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao marcar como postado");
      return false;
    }
    toast.success("Pedido marcado como postado");
    return true;
  }, [orders]);

  // Mark as delivered - respects intermediate status for motoboy
  // Flow: pago → em_rota → entregue
  const markAsDelivered = useCallback(async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      toast.error("Pedido não encontrado");
      return false;
    }

    const currentStatus = order.operational_status;
    let nextStatus: OperationalStatus;
    let successMessage: string;

    // Determine next status based on current status and delivery method
    if (order.delivery_method === 'motoboy') {
      if (currentStatus === 'pago') {
        // First transition: pago → em_rota
        nextStatus = 'em_rota';
        successMessage = "Pedido em rota de entrega";
      } else if (currentStatus === 'em_rota') {
        // Second transition: em_rota → entregue
        nextStatus = 'entregue';
        successMessage = "Pedido entregue!";
      } else {
        toast.error("Status atual não permite esta ação");
        return false;
      }
    } else if (order.delivery_method === 'correios') {
      // For correios: can only mark as delivered from postado
      if (currentStatus !== 'postado') {
        toast.error("Correios: pedido precisa estar postado para marcar entregue");
        return false;
      }
      nextStatus = 'entregue';
      successMessage = "Pedido entregue!";
    } else {
      toast.error("Use 'Marcar como Retirado' para pedidos de retirada");
      return false;
    }

    const { error } = await supabase
      .from("live_carts")
      .update({
        operational_status: nextStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao atualizar status");
      return false;
    }

    // Log status change
    await supabase.from("live_cart_status_history").insert({
      live_cart_id: orderId,
      old_status: currentStatus,
      new_status: nextStatus,
      changed_by: currentUserId,
    });

    // Optimistic update
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, operational_status: nextStatus } as LiveOrderCart : o
    ));

    toast.success(successMessage);
    return true;
  }, [orders, currentUserId]);

  // Mark as picked up - respects intermediate status for retirada
  // Flow: pago → retirada → entregue/retirado
  const markAsPickedUp = useCallback(async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      toast.error("Pedido não encontrado");
      return false;
    }

    if (order.delivery_method !== 'retirada') {
      toast.error("Ação só disponível para pedidos de retirada na loja");
      return false;
    }

    const currentStatus = order.operational_status;
    let nextStatus: OperationalStatus;
    let successMessage: string;

    if (currentStatus === 'pago') {
      // First transition: pago → retirada (awaiting pickup)
      nextStatus = 'retirada';
      successMessage = "Pedido aguardando retirada";
    } else if (currentStatus === 'retirada') {
      // Second transition: retirada → entregue (picked up = delivered for this flow)
      nextStatus = 'entregue';
      successMessage = "Pedido retirado pelo cliente!";
    } else {
      toast.error("Status atual não permite esta ação");
      return false;
    }

    const { error } = await supabase
      .from("live_carts")
      .update({
        operational_status: nextStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao atualizar status");
      return false;
    }

    // Log status change
    await supabase.from("live_cart_status_history").insert({
      live_cart_id: orderId,
      old_status: currentStatus,
      new_status: nextStatus,
      changed_by: currentUserId,
    });

    // Optimistic update
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, operational_status: nextStatus } as LiveOrderCart : o
    ));

    toast.success(successMessage);
    return true;
  }, [orders, currentUserId]);

  // Get orders needing charge
  const ordersNeedingCharge = useMemo(() => {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    return orders.filter(o => {
      if (o.status === 'pago' || o.status === 'cancelado') return false;
      if (!o.last_charge_at) return true;
      return new Date(o.last_charge_at).getTime() < oneDayAgo;
    });
  }, [orders]);

  // Fetch charge history for a specific order
  const fetchChargeHistory = useCallback(async (orderId: string) => {
    const { data, error } = await supabase
      .from("live_charge_logs")
      .select("channel, created_at, charged_by")
      .eq("live_cart_id", orderId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Error fetching charge history:", error);
      return [];
    }

    return data || [];
  }, []);

  // Update tracking code after sync
  const updateTrackingCode = useCallback((orderId: string, trackingCode: string) => {
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, shipping_tracking_code: trackingCode } as LiveOrderCart : o
    ));
  }, []);

  return {
    orders,
    sellers,
    kpis,
    isLoading,
    currentUserId,
    filterOrders,
    ordersNeedingCharge,
    getOrderUrgency,
    assignSeller,
    updateOperationalStatus,
    updateDeliveryMethod,
    updateDeliveryWithShipping,
    updateCustomerZipCode,
    updateDeliveryDetails,
    markAsPaid,
    markAsPaidWithProof,
    approveManualPayment,
    rejectManualPayment,
    applyPaidEffects,
    recordCharge,
    advanceStatus,
    revertStatus,
    generateShippingLabel,
    markAsPosted,
    markAsDelivered,
    markAsPickedUp,
    fetchChargeHistory,
    updateTrackingCode,
    refetch: fetchOrders,
  };
}
