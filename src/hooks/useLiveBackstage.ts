import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { 
  LiveCart, 
  LiveCartItem, 
  LiveCustomer, 
  LiveWaitlist,
  QuickLaunchForm 
} from "@/types/liveShop";

export function useLiveBackstage(eventId: string | undefined, pauseRefetch: boolean = false) {
  const [customers, setCustomers] = useState<LiveCustomer[]>([]);
  const [carts, setCarts] = useState<LiveCart[]>([]);
  const [waitlist, setWaitlist] = useState<LiveWaitlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Use ref to track if component is mounted and avoid stale closures
  const isMountedRef = useRef(true);
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);
  // Use ref for pauseRefetch to avoid closure issues in realtime handlers
  const pauseRefetchRef = useRef(pauseRefetch);
  pauseRefetchRef.current = pauseRefetch;

  const fetchBackstageData = useCallback(async () => {
    if (!eventId) return;

    setIsLoading(true);
    try {
      // Fetch customers
      const { data: customersData, error: customersError } = await supabase
        .from("live_customers")
        .select("*")
        .eq("live_event_id", eventId)
        .order("created_at", { ascending: false });

      if (customersError) throw customersError;
      if (isMountedRef.current) {
        setCustomers((customersData || []) as LiveCustomer[]);
      }

      // Fetch carts with items and customer
      const { data: cartsData, error: cartsError } = await supabase
        .from("live_carts")
        .select(`
          *,
          live_customer:live_customers(*),
          items:live_cart_items(
            *,
            product:product_catalog(id, name, image_url, color)
          )
        `)
        .eq("live_event_id", eventId)
        .order("created_at", { ascending: false });

      if (cartsError) throw cartsError;
      if (isMountedRef.current) {
        setCarts((cartsData || []) as LiveCart[]);
      }

      // Fetch waitlist (all statuses for reporting, filter for active in UI)
      const { data: waitlistData, error: waitlistError } = await supabase
        .from("live_waitlist")
        .select("*")
        .eq("live_event_id", eventId)
        .order("ordem");

      if (waitlistError) throw waitlistError;
      if (isMountedRef.current) {
        setWaitlist((waitlistData || []) as LiveWaitlist[]);
      }

    } catch (err: any) {
      console.error("Error fetching backstage data:", err);
      if (isMountedRef.current) {
        toast.error("Erro ao carregar dados do backstage");
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [eventId]);

  // Initial data fetch
  useEffect(() => {
    isMountedRef.current = true;
    fetchBackstageData();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchBackstageData]);

  // Realtime subscriptions - separate effect with stable dependencies
  useEffect(() => {
    if (!eventId) return;

    // Cleanup previous channels
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel);
    });
    channelsRef.current = [];

    const handleRealtimeUpdate = () => {
      // Skip refetch if paused (e.g., during raffle overlay)
      if (isMountedRef.current && !pauseRefetchRef.current) {
        fetchBackstageData();
      }
    };

    // Play notification sound for payments
    const playPaymentSound = () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Create a pleasant "cha-ching" sound effect
        const playTone = (frequency: number, startTime: number, duration: number, gain: number) => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + startTime);
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0, audioContext.currentTime + startTime);
          gainNode.gain.linearRampToValueAtTime(gain, audioContext.currentTime + startTime + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + startTime + duration);
          
          oscillator.start(audioContext.currentTime + startTime);
          oscillator.stop(audioContext.currentTime + startTime + duration);
        };
        
        // Play a cheerful ascending melody (like a cash register)
        playTone(523.25, 0, 0.15, 0.3);    // C5
        playTone(659.25, 0.1, 0.15, 0.3);  // E5
        playTone(783.99, 0.2, 0.25, 0.4);  // G5
        playTone(1046.5, 0.35, 0.4, 0.5);  // C6
        
      } catch (error) {
        console.log("Could not play notification sound:", error);
      }
    };

    // Handle cart status changes with payment notifications
    const handleCartChange = (payload: any) => {
      if (isMountedRef.current) {
        // Check if this is an UPDATE with status changing to 'pago'
        if (payload.eventType === 'UPDATE' && payload.new?.status === 'pago' && payload.old?.status !== 'pago') {
          // Play notification sound (always play even if paused)
          playPaymentSound();
          
          // Fetch customer info for this cart to show in notification
          supabase
            .from("live_customers")
            .select("instagram_handle, nome")
            .eq("id", payload.new.live_customer_id)
            .single()
            .then(({ data: customer }) => {
              const customerName = customer?.nome || customer?.instagram_handle || 'Cliente';
              const total = payload.new.total || 0;
              const formattedTotal = new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(total);
              
              // Show celebratory toast notification (only if not paused)
              if (!pauseRefetchRef.current) {
                toast.success(
                  `💰 Pagamento Confirmado!\n${customerName} pagou ${formattedTotal}`,
                  {
                    duration: 8000,
                    icon: '🎉',
                    style: {
                      background: '#22c55e',
                      color: 'white',
                      fontWeight: 'bold',
                    },
                  }
                );
              }
            });
        }
        // Only refetch if not paused (e.g., during raffle overlay)
        if (!pauseRefetchRef.current) {
          fetchBackstageData();
        }
      }
    };

    // Subscribe to live_carts changes with payment detection
    const cartsChannel = supabase
      .channel(`live_carts_${eventId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_carts',
          filter: `live_event_id=eq.${eventId}`,
        },
        handleCartChange
      )
      .subscribe();

    // Subscribe to live_cart_items changes
    const itemsChannel = supabase
      .channel(`live_cart_items_${eventId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_cart_items',
        },
        handleRealtimeUpdate
      )
      .subscribe();

    // Subscribe to live_customers changes
    const customersChannel = supabase
      .channel(`live_customers_${eventId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_customers',
          filter: `live_event_id=eq.${eventId}`,
        },
        handleRealtimeUpdate
      )
      .subscribe();

    // Subscribe to live_waitlist changes
    const waitlistChannel = supabase
      .channel(`live_waitlist_${eventId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_waitlist',
          filter: `live_event_id=eq.${eventId}`,
        },
        handleRealtimeUpdate
      )
      .subscribe();

    // Store channels for cleanup
    channelsRef.current = [cartsChannel, itemsChannel, customersChannel, waitlistChannel];

    // Cleanup subscriptions on unmount or eventId change
    return () => {
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
    };
  }, [eventId, fetchBackstageData]);

  // Get or create customer by Instagram handle with normalization
  const getOrCreateCustomer = async (instagramHandle: string): Promise<LiveCustomer | null> => {
    if (!eventId) return null;

    // Normalize handle - remove @, spaces, lowercase
    const handle = instagramHandle
      .replace(/@/g, "")
      .replace(/\s/g, "")
      .toLowerCase()
      .trim();

    if (!handle) {
      toast.error("Instagram inválido");
      return null;
    }

    try {
      // Check if customer exists for this live (normalized comparison)
      const existing = customers.find(c => 
        c.instagram_handle.toLowerCase().replace(/@/g, "").trim() === handle
      );
      
      if (existing) return existing;

      // Check if customer exists in the main CRM by normalized instagram_handle
      const { data: existingCrmCustomer } = await supabase
        .from("customers")
        .select("id, name, phone, email, instagram_handle")
        .or(`instagram_handle.ilike.${handle},instagram_handle.ilike.@${handle}`)
        .is("merged_into_customer_id", null)
        .maybeSingle();

      // Create new live customer, linking to existing CRM customer if found
      const { data, error } = await supabase
        .from("live_customers")
        .insert({
          live_event_id: eventId,
          instagram_handle: handle,
          status: 'ativo',
          client_id: existingCrmCustomer?.id || null,
          nome: existingCrmCustomer?.name || null,
          whatsapp: existingCrmCustomer?.phone || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          // Unique constraint - customer exists, refetch
          await fetchBackstageData();
          return customers.find(c => 
            c.instagram_handle.toLowerCase().replace(/@/g, "").trim() === handle
          ) || null;
        }
        throw error;
      }

      // Show toast if customer was linked
      if (existingCrmCustomer) {
        toast.success(`Cliente ${existingCrmCustomer.name || `@${handle}`} identificado no CRM!`);
      }

      await fetchBackstageData();
      return data as LiveCustomer;
    } catch (err: any) {
      console.error("Error getting/creating customer:", err);
      toast.error("Erro ao buscar/criar cliente");
      return null;
    }
  };

  // Get or create cart for customer
  const getOrCreateCart = async (customerId: string): Promise<LiveCart | null> => {
    if (!eventId) return null;

    // Check if live is still open for new orders
    const { data: eventData } = await supabase
      .from("live_events")
      .select("status")
      .eq("id", eventId)
      .single();
    
    // Block new cart creation if live is ended or archived
    // (existing carts can still be fetched for payment/management)
    const liveIsClosed = eventData?.status === 'encerrada' || eventData?.status === 'arquivada';

    try {
      // Check if cart exists - fetch directly from DB to get latest state
      const { data: existingCart } = await supabase
        .from("live_carts")
        .select(`
          *,
          live_customer:live_customers(*),
          items:live_cart_items(
            *,
            product:product_catalog(id, name, image_url, color)
          )
        `)
        .eq("live_event_id", eventId)
        .eq("live_customer_id", customerId)
        .maybeSingle();
      
      if (existingCart) {
        // If cart was cancelled or expired, reactivate it when adding new items
        if (existingCart.status === 'cancelado' || existingCart.status === 'expirado') {
          const { data: reactivatedCart, error: reactivateError } = await supabase
            .from("live_carts")
            .update({ 
              // Reativar carrinho para que volte ao fluxo de cobrança
              status: 'aguardando_pagamento',
              separation_status: 'pendente',
            })
            .eq("id", existingCart.id)
            .select(`
              *,
              live_customer:live_customers(*),
              items:live_cart_items(
                *,
                product:product_catalog(id, name, image_url, color)
              )
            `)
            .single();
          
          if (reactivateError) {
            console.error("Error reactivating cart:", reactivateError);
            return existingCart as LiveCart;
          } else {
            const customerHandle = existingCart.live_customer?.instagram_handle || 'cliente';
            toast.info(`Carrinho de ${customerHandle} reativado!`);
            fetchBackstageData(); // Refresh in background
            return reactivatedCart as LiveCart;
          }
        }
        return existingCart as LiveCart;
      }

      // Block new cart creation if live is ended
      if (liveIsClosed) {
        toast.error("Live encerrada! Não é possível criar novos carrinhos.");
        return null;
      }

      // Create new cart
      const { data, error } = await supabase
        .from("live_carts")
        .insert({
          live_event_id: eventId,
          live_customer_id: customerId,
          status: 'aberto',
          subtotal: 0,
          descontos: 0,
          frete: 0,
          total: 0,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchBackstageData();
      return data as LiveCart;
    } catch (err: any) {
      console.error("Error getting/creating cart:", err);
      toast.error("Erro ao buscar/criar carrinho");
      return null;
    }
  };

  // Quick launch: add item to customer's cart
  const quickLaunch = async (form: QuickLaunchForm): Promise<boolean> => {
    if (!eventId) return false;

    // Check if live is still open for new orders
    const { data: eventData } = await supabase
      .from("live_events")
      .select("status")
      .eq("id", eventId)
      .single();
    
    if (eventData?.status === 'encerrada' || eventData?.status === 'arquivada') {
      toast.error("Live encerrada! Não é possível adicionar novos itens.");
      return false;
    }
    try {
      // Get or create customer
      const customer = await getOrCreateCustomer(form.instagram_handle);
      if (!customer) return false;

      // Get or create cart
      const cart = await getOrCreateCart(customer.id);
      if (!cart) return false;

      // Get product price
      const { data: product, error: productError } = await supabase
        .from("product_catalog")
        .select("price, stock_by_size")
        .eq("id", form.product_id)
        .single();

      if (productError || !product) {
        toast.error("Produto não encontrado");
        return false;
      }

      // Check for live-specific discount
      const { data: liveProduct } = await supabase
        .from("live_products")
        .select("live_discount_type, live_discount_value")
        .eq("live_event_id", eventId)
        .eq("product_id", form.product_id)
        .maybeSingle();

      // Calculate final price with live discount
      let finalPrice = product.price;
      if (liveProduct?.live_discount_type && liveProduct?.live_discount_value) {
        if (liveProduct.live_discount_type === 'percentage') {
          finalPrice = product.price * (1 - liveProduct.live_discount_value / 100);
        } else if (liveProduct.live_discount_type === 'fixed') {
          finalPrice = Math.max(0, product.price - liveProduct.live_discount_value);
        }
      }

      // Check stock
      const size = form.tamanho || "";
      const currentStock = (product.stock_by_size as Record<string, number>)?.[size] || 0;
      
      // Get reserved stock for this size
      const { data: reservedData } = await supabase
        .rpc("get_live_reserved_stock", { 
          p_product_id: form.product_id, 
          p_size: size 
        });
      
      const reservedStock = reservedData || 0;
      const availableStock = currentStock - reservedStock;

      if (availableStock < form.qtd) {
        toast.error(`Estoque insuficiente! Disponível: ${availableStock}`);
        return false;
      }

      // Get event expiry config
      const { data: eventData } = await supabase
        .from("live_events")
        .select("reservation_expiry_minutes")
        .eq("id", eventId)
        .single();

      const expiryMinutes = eventData?.reservation_expiry_minutes || 30;
      const expirationDate = new Date();
      expirationDate.setMinutes(expirationDate.getMinutes() + expiryMinutes);

      // Add item to cart using idempotent upsert function
      // This prevents duplicate entries and ensures correct stock reservation
      const { data: upsertResult, error: itemError } = await supabase
        .rpc("upsert_live_cart_item", {
          p_live_cart_id: cart.id,
          p_product_id: form.product_id,
          p_variante: {
            cor: form.cor,
            tamanho: form.tamanho,
          },
          p_qtd: form.qtd,
          p_preco_unitario: finalPrice,
          p_expiracao_reserva_em: expirationDate.toISOString(),
        });

      if (itemError) throw itemError;
      
      // Log the action for debugging
      console.log("[quickLaunch] Upsert result:", upsertResult);

      // Update cart totals and mark for reprint if needed
      await updateCartTotals(cart.id);
      await markCartForReprint(cart.id);

      toast.success(`✅ Reservado para ${form.instagram_handle}!`);
      await fetchBackstageData();
      return true;
    } catch (err: any) {
      console.error("Error in quick launch:", err);
      toast.error("Erro ao adicionar item");
      return false;
    }
  };

  // Update cart totals and evaluate gift rules
  const updateCartTotals = async (cartId: string): Promise<void> => {
    try {
      // Get cart details for gift evaluation
      const { data: cart } = await supabase
        .from("live_carts")
        .select("live_event_id, live_customer:live_customers(client_id)")
        .eq("id", cartId)
        .single();

      // Get all items for this cart
      const { data: items } = await supabase
        .from("live_cart_items")
        .select("preco_unitario, qtd, status")
        .eq("live_cart_id", cartId)
        .in("status", ["reservado", "confirmado"]);

      const subtotal = (items || []).reduce((sum, item) => 
        sum + (item.preco_unitario * item.qtd), 0);

      await supabase
        .from("live_carts")
        .update({
          subtotal,
          total: subtotal, // Add discounts/shipping logic later
        })
        .eq("id", cartId);

      // Evaluate and apply gift rules for live carts
      if (cart && eventId) {
        await evaluateGiftRulesForCart(cartId, subtotal, eventId, cart.live_customer?.client_id || undefined);
      }
    } catch (err) {
      console.error("Error updating cart totals:", err);
    }
  };

  // Evaluate gift rules for a live cart
  const evaluateGiftRulesForCart = async (
    cartId: string, 
    cartTotal: number, 
    liveEventId: string,
    customerId?: string
  ): Promise<void> => {
    try {
      const now = new Date().toISOString();
      
      // Fetch applicable rules for live
      const { data: rules } = await supabase
        .from("gift_rules")
        .select(`*, gift:gifts(*)`)
        .eq("is_active", true)
        .in("channel_scope", ["live_only", "both", "live_specific"])
        .or(`start_at.is.null,start_at.lte.${now}`)
        .or(`end_at.is.null,end_at.gte.${now}`)
        .order("priority", { ascending: false });

      if (!rules || rules.length === 0) return;

      // Filter live_specific rules
      const applicableRules = rules.filter(r => {
        if (r.channel_scope === "live_specific") {
          return r.live_event_id === liveEventId;
        }
        return true;
      });

      // Get currently applied gifts for this cart
      const { data: existingGifts } = await supabase
        .from("order_gifts")
        .select("id, gift_id, applied_by_rule_id, status")
        .eq("live_cart_id", cartId)
        .not("applied_by_rule_id", "is", null)
        .neq("status", "removed");

      const appliedRuleIds = new Set((existingGifts || []).map(g => g.applied_by_rule_id));

      for (const rule of applicableRules) {
        const gift = rule.gift;
        if (!gift) continue;

        // Check condition
        let conditionMet = false;
        switch (rule.condition_type) {
          case "all_purchases":
            conditionMet = true;
            break;
          case "min_value":
            conditionMet = rule.condition_value ? cartTotal >= rule.condition_value : false;
            break;
          case "first_n_paid":
          case "first_n_reserved":
            conditionMet = rule.condition_value 
              ? rule.current_awards_count < rule.condition_value 
              : false;
            break;
        }

        // Check limits
        if (rule.max_total_awards && rule.current_awards_count >= rule.max_total_awards) {
          conditionMet = false;
        }

        // Check if already applied
        const alreadyApplied = appliedRuleIds.has(rule.id);

        if (conditionMet && !alreadyApplied) {
          // Check stock
          if (!gift.unlimited_stock && gift.stock_qty < rule.gift_qty) {
            console.log(`Gift ${gift.name} out of stock for rule ${rule.name}`);
            continue;
          }

          // Apply the gift
          const { error: insertError } = await supabase
            .from("order_gifts")
            .insert({
              live_cart_id: cartId,
              gift_id: gift.id,
              qty: rule.gift_qty,
              status: "pending_separation",
              applied_by_rule_id: rule.id,
            });

          if (!insertError) {
            // Decrement stock
            await supabase.rpc("decrement_gift_stock", {
              p_gift_id: gift.id,
              p_qty: rule.gift_qty,
            });

            // Increment awards count
            await supabase.rpc("increment_gift_rule_awards", {
              p_rule_id: rule.id,
              p_qty: 1,
            });

            // Mark cart for reprint if gift was added
            await markCartForReprint(cartId);

            toast.success(`🎁 Brinde aplicado: ${gift.name}`);
          }
        } else if (!conditionMet && alreadyApplied) {
          // Remove gift if condition no longer met (cart value reduced)
          const giftToRemove = existingGifts?.find(g => g.applied_by_rule_id === rule.id);
          if (giftToRemove && giftToRemove.status === "pending_separation") {
            await supabase
              .from("order_gifts")
              .update({ status: "removed" })
              .eq("id", giftToRemove.id);

            // Restore stock
            await supabase.rpc("decrement_gift_stock", {
              p_gift_id: giftToRemove.gift_id,
              p_qty: -rule.gift_qty, // Negative to restore
            });

            // Mark cart for reprint if gift was removed
            await markCartForReprint(cartId);

            toast.info(`Brinde removido: ${gift.name} (condição não atendida)`);
          }
        }
      }
    } catch (err) {
      console.error("Error evaluating gift rules:", err);
    }
  };

  // Mark cart as needing label reprint (ONLY when cart has bag_number AND label was already printed)
  // CRITICAL: needs_label_reprint should only be true if label_printed_at is not null
  const markCartForReprint = async (cartId: string): Promise<void> => {
    try {
      // Check if cart has a bag_number AND has been printed before
      const { data: cart } = await supabase
        .from("live_carts")
        .select("bag_number, label_printed_at")
        .eq("id", cartId)
        .single();

      // Only mark for reprint if a label was ALREADY printed before
      if (cart?.bag_number && cart?.label_printed_at) {
        await supabase
          .from("live_carts")
          .update({ 
            needs_label_reprint: true,
            updated_at: new Date().toISOString() // Force realtime update
          })
          .eq("id", cartId);
      }
    } catch (err) {
      console.error("Error marking cart for reprint:", err);
    }
  };

  // Remove item from cart
  // CRITICAL: If item was already separated, route to cancelItemForSeparation for proper tracking
  const removeCartItem = async (itemId: string): Promise<{ 
    success: boolean; 
    waitlistEntry?: LiveWaitlist;
    productId?: string;
    size?: string;
  }> => {
    try {
      // Get item to find cart and check separation status
      const { data: item } = await supabase
        .from("live_cart_items")
        .select("live_cart_id, product_id, variante, separation_status, qtd")
        .eq("id", itemId)
        .single();

      if (!item) return { success: false };

      // Check if item was already separated (physically in bag)
      const wasSeparated = item.separation_status === 'separado' || item.separation_status === 'retirado_confirmado';

      // If item was separated, use cancellation flow to require physical removal confirmation
      if (wasSeparated) {
        const cancelled = await cancelItemForSeparation(itemId, `Cancelado - retirar ${item.qtd} unidade(s) da sacola`);
        return { success: cancelled, productId: item.product_id };
      }

      // Update item status to removed
      const { error } = await supabase
        .from("live_cart_items")
        .update({ status: 'removido' })
        .eq("id", itemId);

      if (error) throw error;

      // Update cart totals and mark for reprint if needed
      await updateCartTotals(item.live_cart_id);
      await markCartForReprint(item.live_cart_id);

      // Check waitlist for this product/variant
      const variante = item.variante as Record<string, string>;
      const size = variante?.tamanho || '';
      
      const { data: waitlistItems } = await supabase
        .from("live_waitlist")
        .select("*")
        .eq("live_event_id", eventId)
        .eq("product_id", item.product_id)
        .eq("status", "ativa")
        .order("ordem")
        .limit(1);

      const hasWaitlist = waitlistItems && waitlistItems.length > 0;

      if (hasWaitlist) {
        // Show prominent alert for waitlist
        toast.warning(
          `⚠️ Estoque liberado! ${waitlistItems[0].instagram_handle} está na fila para este item.`,
          {
            duration: 8000,
            action: {
              label: "Ver fila",
              onClick: () => {},
            },
          }
        );
      } else {
        toast.success("Item removido do carrinho");
      }

      await fetchBackstageData();
      
      return { 
        success: true, 
        waitlistEntry: hasWaitlist ? waitlistItems[0] as LiveWaitlist : undefined,
        productId: item.product_id,
        size
      };
    } catch (err: any) {
      console.error("Error removing cart item:", err);
      toast.error("Erro ao remover item");
      return { success: false };
    }
  };

  // Reduce item quantity by 1 (removes single unit, not entire item)
  // CRITICAL: If item was already separated, we need to track the cancelled unit for physical removal
  const reduceItemQuantity = async (itemId: string): Promise<boolean> => {
    try {
      // Get current item with separation status
      const { data: item } = await supabase
        .from("live_cart_items")
        .select("live_cart_id, qtd, product_id, variante, separation_status, separation_notes")
        .eq("id", itemId)
        .single();

      if (!item) {
        toast.error("Item não encontrado");
        return false;
      }

      // Check if item was already separated (physically in bag)
      const wasSeparated = item.separation_status === 'separado' || item.separation_status === 'retirado_confirmado';

      if (item.qtd <= 1) {
        // If only 1 unit, use the cancel for separation flow if item was separated
        if (wasSeparated) {
          return await cancelItemForSeparation(itemId, 'Cancelado - retirar 1 unidade da sacola');
        }
        // Otherwise, remove the entire item
        return (await removeCartItem(itemId)).success;
      }

      // If item was separated, we need to:
      // 1. Reduce the quantity (item.qtd - 1)
      // 2. Track that 1 unit needs to be physically removed from the bag
      // We do this by updating separation_notes to track pending removals
      let newNotes = item.separation_notes || '';
      let newSeparationStatus = item.separation_status;
      
      if (wasSeparated) {
        // Parse existing pending_removal count or start at 0
        const pendingMatch = newNotes.match(/pending_removal:(\d+)/);
        const currentPending = pendingMatch ? parseInt(pendingMatch[1], 10) : 0;
        const newPendingCount = currentPending + 1;
        
        // Update or add pending_removal count in notes
        if (pendingMatch) {
          newNotes = newNotes.replace(/pending_removal:\d+/, `pending_removal:${newPendingCount}`);
        } else {
          newNotes = newNotes ? `${newNotes} | pending_removal:${newPendingCount}` : `pending_removal:${newPendingCount}`;
        }
        
        // Mark as needing attention (cancelled items pending removal)
        newSeparationStatus = 'cancelado';
      }

      // Reduce quantity by 1
      const { error } = await supabase
        .from("live_cart_items")
        .update({ 
          qtd: item.qtd - 1,
          separation_notes: wasSeparated ? newNotes : item.separation_notes,
          separation_status: wasSeparated ? newSeparationStatus : item.separation_status,
        })
        .eq("id", itemId);

      if (error) throw error;

      // Update cart totals and mark for reprint if needed
      await updateCartTotals(item.live_cart_id);
      await markCartForReprint(item.live_cart_id);

      // If item was separated, update cart separation_status to 'atencao'
      if (wasSeparated) {
        await supabase
          .from("live_carts")
          .update({ separation_status: 'atencao' })
          .eq("id", item.live_cart_id);
        
        toast.warning("⚠️ 1 unidade cancelada! Retire da sacola física.", {
          duration: 6000,
        });
      } else {
        // Check waitlist for this product/variant
        const variante = item.variante as Record<string, string>;
        const size = variante?.tamanho || '';
        
        const { data: waitlistItems } = await supabase
          .from("live_waitlist")
          .select("*")
          .eq("live_event_id", eventId)
          .eq("product_id", item.product_id)
          .eq("status", "ativa")
          .order("ordem", { ascending: true })
          .limit(1);

        const hasWaitlist = waitlistItems && waitlistItems.length > 0;

        if (hasWaitlist) {
          toast.warning(
            `⚠️ 1 unidade liberada! ${waitlistItems[0].instagram_handle} está na fila.`,
            { duration: 6000 }
          );
        } else {
          toast.success("1 unidade removida do carrinho");
        }
      }

      await fetchBackstageData();
      return true;
    } catch (err: any) {
      console.error("Error reducing item quantity:", err);
      toast.error("Erro ao reduzir quantidade");
      return false;
    }
  };

  // Cancel item for separation (marks for physical removal from bag)
  // This is used when the bag is already separated but customer wants to cancel an item
  const cancelItemForSeparation = async (itemId: string, notes?: string): Promise<boolean> => {
    try {
      // Get item info
      const { data: item } = await supabase
        .from("live_cart_items")
        .select("live_cart_id, product_id, variante, preco_unitario, qtd")
        .eq("id", itemId)
        .single();

      if (!item) {
        toast.error("Item não encontrado");
        return false;
      }

      // Update item with cancelled separation status
      // This keeps the item but marks it for removal in the separation screen
      const { error } = await supabase
        .from("live_cart_items")
        .update({ 
          status: 'cancelado',
          separation_status: 'cancelado',
          separation_notes: notes || 'Cancelado pelo cliente - retirar da sacola'
        })
        .eq("id", itemId);

      if (error) throw error;

      // Update cart totals (subtract the cancelled item value) and mark for reprint
      await updateCartTotals(item.live_cart_id);
      await markCartForReprint(item.live_cart_id);

      // Update cart separation_status to 'atencao' so it shows up in separation
      await supabase
        .from("live_carts")
        .update({ separation_status: 'atencao' })
        .eq("id", item.live_cart_id);

      toast.warning("Item cancelado! Retire da sacola física na separação.", {
        duration: 5000,
      });

      await fetchBackstageData();
      return true;
    } catch (err: any) {
      console.error("Error cancelling item for separation:", err);
      toast.error("Erro ao cancelar item");
      return false;
    }
  };

  // Add to waitlist (enhanced version)
  const addToWaitlist = async (
    productId: string, 
    variante: { cor?: string; tamanho?: string },
    instagramHandle: string,
    whatsapp?: string,
    nome?: string,
    observacao?: string
  ): Promise<boolean> => {
    if (!eventId) return false;

    const handle = instagramHandle.startsWith("@") 
      ? instagramHandle.toLowerCase() 
      : `@${instagramHandle.toLowerCase()}`;

    try {
      const { error } = await supabase
        .from("live_waitlist")
        .insert({
          live_event_id: eventId,
          product_id: productId,
          variante: { ...variante, observacao },
          instagram_handle: handle,
          whatsapp: whatsapp || null,
          status: 'ativa',
        });

      if (error) throw error;

      toast.success(`📋 ${handle} adicionado à lista de espera!`);
      await fetchBackstageData();
      return true;
    } catch (err: any) {
      console.error("Error adding to waitlist:", err);
      toast.error("Erro ao adicionar à lista de espera");
      return false;
    }
  };

  // Skip person in waitlist
  const skipWaitlistEntry = async (waitlistId: string): Promise<void> => {
    try {
      // Mark as skipped (we'll use 'cancelada' status for now)
      await supabase
        .from("live_waitlist")
        .update({ status: 'cancelada' })
        .eq("id", waitlistId);

      toast.info("Pulou para o próximo da fila");
      await fetchBackstageData();
    } catch (err: any) {
      console.error("Error skipping waitlist entry:", err);
      toast.error("Erro ao pular entrada");
    }
  };

  // End waitlist queue for a variation
  const endWaitlistQueue = async (productId: string, tamanho: string): Promise<void> => {
    try {
      // Cancel all active entries for this variation
      const { error } = await supabase
        .from("live_waitlist")
        .update({ status: 'cancelada' })
        .eq("live_event_id", eventId)
        .eq("product_id", productId)
        .eq("status", "ativa")
        .filter("variante->tamanho", "eq", tamanho);

      if (error) throw error;

      toast.info("Fila encerrada para esta variação");
      await fetchBackstageData();
    } catch (err: any) {
      console.error("Error ending waitlist queue:", err);
      toast.error("Erro ao encerrar fila");
    }
  };

  // Get next waitlist entry for a variation
  const getNextWaitlistEntry = (productId: string, tamanho: string): LiveWaitlist | null => {
    return waitlist.find(
      (w) =>
        w.product_id === productId &&
        (w.variante as any)?.tamanho === tamanho &&
        w.status === "ativa"
    ) || null;
  };

  // Get waitlist count for a variation
  const getWaitlistCount = (productId: string, tamanho: string): number => {
    return waitlist.filter(
      (w) =>
        w.product_id === productId &&
        (w.variante as any)?.tamanho === tamanho &&
        w.status === "ativa"
    ).length;
  };

  // Allocate from waitlist
  const allocateFromWaitlist = async (waitlistId: string): Promise<boolean> => {
    try {
      // IMPORTANT: Fetch fresh data from database to avoid stale size issues
      const { data: freshWaitlistItem, error: fetchError } = await supabase
        .from("live_waitlist")
        .select("*")
        .eq("id", waitlistId)
        .single();

      if (fetchError || !freshWaitlistItem) {
        console.error("Error fetching waitlist item:", fetchError);
        toast.error("Erro ao buscar item da lista de espera");
        return false;
      }

      const variante = freshWaitlistItem.variante as { cor?: string; tamanho?: string };
      
      // Try to add to cart with the EXACT size from the waitlist entry
      const success = await quickLaunch({
        instagram_handle: freshWaitlistItem.instagram_handle,
        product_id: freshWaitlistItem.product_id,
        cor: variante?.cor,
        tamanho: variante?.tamanho,
        qtd: 1,
      });

      if (success) {
        // Ensure cart totals are recalculated for the target customer.
        // This avoids cases where the item is inserted but the cart total doesn't update in time.
        try {
          const { data: targetCustomer } = await supabase
            .from("live_customers")
            .select("id")
            .eq("live_event_id", eventId)
            .ilike("instagram_handle", freshWaitlistItem.instagram_handle)
            .maybeSingle();

          if (targetCustomer?.id) {
            const { data: targetCart } = await supabase
              .from("live_carts")
              .select("id")
              .eq("live_event_id", eventId)
              .eq("live_customer_id", targetCustomer.id)
              .maybeSingle();

            if (targetCart?.id) {
              await updateCartTotals(targetCart.id);
            }
          }
        } catch (e) {
          // Non-blocking; quickLaunch already attempted to update totals.
          console.warn("Could not force-recalculate cart totals after waitlist allocation", e);
        }

        // Update waitlist status
        await supabase
          .from("live_waitlist")
          .update({ status: 'atendida' })
          .eq("id", waitlistId);

        toast.success(`✅ Alocado para ${freshWaitlistItem.instagram_handle}!`);
        await fetchBackstageData();
        return true;
      }

      return false;
    } catch (err: any) {
      console.error("Error allocating from waitlist:", err);
      toast.error("Erro ao alocar da lista de espera");
      return false;
    }
  };

  // Check if customer has product ("Ela garantiu?")
  const checkCustomerHasProduct = (
    instagramHandle: string, 
    productId?: string
  ): { found: boolean; status: 'reservado' | 'espera' | 'nao_consta'; details?: string } => {
    const handle = instagramHandle.startsWith("@") 
      ? instagramHandle.toLowerCase() 
      : `@${instagramHandle.toLowerCase()}`;

    // Check carts
    for (const cart of carts) {
      if (cart.live_customer?.instagram_handle.toLowerCase() === handle) {
        const items = cart.items || [];
        const matchingItems = productId 
          ? items.filter(i => i.product_id === productId && ['reservado', 'confirmado'].includes(i.status))
          : items.filter(i => ['reservado', 'confirmado'].includes(i.status));
        
        if (matchingItems.length > 0) {
          const itemNames = matchingItems.map(i => 
            `${i.product?.name} (${i.variante?.tamanho})`).join(", ");
          return {
            found: true,
            status: 'reservado',
            details: itemNames,
          };
        }
      }
    }

    // Check waitlist
    const waitlistMatch = waitlist.find(w => {
      const matchHandle = w.instagram_handle.toLowerCase() === handle;
      const matchProduct = productId ? w.product_id === productId : true;
      return matchHandle && matchProduct;
    });

    if (waitlistMatch) {
      return {
        found: true,
        status: 'espera',
        details: `Posição ${waitlistMatch.ordem} na fila`,
      };
    }

    return { found: false, status: 'nao_consta' };
  };

  // Generate payment link for cart with improved error handling
  const generatePaymentLink = async (cartId: string): Promise<{ success: boolean; checkoutUrl?: string; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('create-live-cart-payment', {
        body: { live_cart_id: cartId },
      });

      if (error) {
        console.error("Error generating payment:", error);
        return { success: false, error: "Erro de conexão ao gerar link" };
      }

      if (data?.success && data?.init_point) {
        if (data.already_exists) {
          toast.info("Link já existia - copiando...");
        } else {
          toast.success("Link de pagamento gerado!");
        }
        await fetchBackstageData();
        return { success: true, checkoutUrl: data.init_point };
      }

      // Handle structured error response
      if (data?.error_code) {
        const errorMsg = data.message || "Erro ao gerar pagamento";
        const actionMsg = data.action ? ` ${data.action}` : "";
        console.error("Payment error:", data);
        return { success: false, error: `${errorMsg}${actionMsg}` };
      }

      return { success: false, error: data?.error || data?.message || "Erro ao gerar pagamento" };
    } catch (err: any) {
      console.error("Error generating payment:", err);
      return { success: false, error: "Erro ao gerar link de pagamento" };
    }
  };

  // Check if cart is in committed state (separated/printed) - requires attention before cancel
  const checkCartCommittedState = async (cartId: string): Promise<boolean> => {
    try {
      const { data } = await supabase.rpc('is_cart_in_committed_state', { p_cart_id: cartId });
      return data === true;
    } catch (err) {
      console.error("Error checking cart committed state:", err);
      return false;
    }
  };

  // Manually update cart status (for in-store or alternative payments)
  // CRITICAL: If cancelling a cart that was already separated/printed, route to ATENÇÃO workflow
  const updateCartStatus = async (
    cartId: string, 
    newStatus: 'aberto' | 'pago' | 'cancelado',
    paymentMethod?: string
  ): Promise<{ success: boolean; requiresAttention?: boolean }> => {
    try {
      // Get current cart to record old status
      const currentCart = carts.find(c => c.id === cartId);
      const oldStatus = currentCart?.status || null;
      
      // ATTENTION WORKFLOW: Check if cancelling a committed cart
      if (newStatus === 'cancelado' && currentCart) {
        const isCommitted = await checkCartCommittedState(cartId);
        
        if (isCommitted) {
          // Cart was already separated/printed - needs physical action first
          // Don't cancel directly, mark for attention instead
          const items = currentCart.items || [];
          const activeItems = items.filter(i => ['reservado', 'confirmado'].includes(i.status));
          
          // Log attention for each active item
          for (const item of activeItems) {
            const variante = item.variante as Record<string, string>;
            await supabase.rpc('log_live_attention', {
              p_cart_id: cartId,
              p_attention_type: 'cancellation',
              p_product_id: item.product_id,
              p_product_name: item.product?.name || 'Produto',
              p_size: variante?.tamanho || null,
              p_quantity: item.qtd,
              p_origin_bag_number: currentCart.bag_number || null,
              p_payload: { reason: 'cart_cancellation', item_id: item.id }
            });
            
            // Mark item for cancellation tracking
            await supabase
              .from("live_cart_items")
              .update({ 
                status: 'cancelado',
                separation_status: 'cancelado',
                separation_notes: 'Cancelado - RETIRAR DA SACOLA FÍSICA'
              })
              .eq("id", item.id);
          }
          
          // Update cart to attention status (not cancelled yet)
          await supabase
            .from("live_carts")
            .update({ 
              separation_status: 'atencao',
              needs_label_reprint: currentCart.label_printed_at ? true : false
            })
            .eq("id", cartId);
          
          toast.warning(
            "⚠️ Sacola requer atenção física! Itens marcados para retirada na separação.", 
            { duration: 6000 }
          );
          
          await fetchBackstageData();
          return { success: true, requiresAttention: true };
        }
      }
      
      const updateData: Record<string, any> = { status: newStatus };
      
      // If marking as paid, create official order, decrement stock, and update items
      if (newStatus === 'pago' && currentCart) {
        // Update cart items to confirmed
        await supabase
          .from("live_cart_items")
          .update({ status: 'confirmado' })
          .eq("live_cart_id", cartId)
          .in("status", ['reservado']);

        // Get customer and items from current cart data
        const customer = currentCart.live_customer;
        const items = currentCart.items || [];
        
        const customerPhone = customer?.whatsapp || "";
        const customerName = customer?.nome || customer?.instagram_handle || "Cliente Live";
        
        // Create official order
        const { data: newOrder, error: orderError } = await supabase
          .from("orders")
          .insert({
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_address: "Pagamento manual - verificar endereço",
            total: currentCart.total || 0,
            status: "pago",
            payment_status: "approved",
            delivery_method: (currentCart.frete || 0) > 0 ? "shipping" : "pickup",
            shipping_fee: currentCart.frete || 0,
            live_event_id: currentCart.live_event_id,
          })
          .select()
          .single();

        if (orderError) {
          console.error("Failed to create order from live cart:", orderError);
        } else if (newOrder) {
          console.log(`Created order ${newOrder.id} from manual live cart payment`);

          // Get active items for order and stock decrement
          const activeItems = items.filter((item) => 
            item.status === "reservado" || item.status === "confirmado"
          );

          // Create order items
          const orderItems = activeItems.map((item) => ({
            order_id: newOrder.id,
            product_id: item.product_id,
            product_name: item.product?.name || "Produto",
            product_price: item.preco_unitario,
            quantity: item.qtd,
            size: (item.variante as any)?.tamanho || "",
            color: item.product?.color || null,
            image_url: item.product?.image_url || null,
          }));

          if (orderItems.length > 0) {
            const { error: itemsError } = await supabase
              .from("order_items")
              .insert(orderItems);

            if (itemsError) {
              console.error("Failed to create order items:", itemsError);
            }
          }

          // CRITICAL: Decrement stock for live cart items on manual payment
          console.log(`Decrementing stock for ${activeItems.length} live cart items (manual payment)`);
          for (const item of activeItems) {
            const size = (item.variante as any)?.tamanho || "";
            if (!size) continue;

            // Get current stock
            const { data: product } = await supabase
              .from("product_catalog")
              .select("stock_by_size")
              .eq("id", item.product_id)
              .single();

            if (product?.stock_by_size) {
              const stockBySize = product.stock_by_size as Record<string, number>;
              const currentStock = stockBySize[size] || 0;
              const newStock = Math.max(0, currentStock - item.qtd);

              // Update stock
              await supabase
                .from("product_catalog")
                .update({
                  stock_by_size: {
                    ...stockBySize,
                    [size]: newStock,
                  },
                })
                .eq("id", item.product_id);

              console.log(`Stock updated: ${item.product_id} size ${size}: ${currentStock} -> ${newStock}`);
            }
          }

          // Link order to live cart
          updateData.order_id = newOrder.id;
        }
      }

      // If cancelling (non-committed cart), release the reservations by updating item status
      if (newStatus === 'cancelado' && currentCart) {
        await supabase
          .from("live_cart_items")
          .update({ status: 'cancelado' })
          .eq("live_cart_id", cartId)
          .in("status", ['reservado', 'confirmado']);
        
        // Also update separation_status
        updateData.separation_status = 'cancelado';
        
        console.log(`Released reservations for cancelled cart ${cartId}`);
      }

      const { error } = await supabase
        .from("live_carts")
        .update(updateData)
        .eq("id", cartId);

      if (error) throw error;

      // Record status change in history
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from("live_cart_status_history")
        .insert({
          live_cart_id: cartId,
          old_status: oldStatus,
          new_status: newStatus,
          payment_method: paymentMethod || null,
          changed_by: user?.id || null,
          notes: paymentMethod ? `Pagamento manual via ${paymentMethod}` : null,
        });

      const statusMessages: Record<string, string> = {
        pago: paymentMethod ? `Pagamento via ${paymentMethod} confirmado!` : "Pagamento confirmado!",
        cancelado: "Carrinho cancelado e estoque liberado",
        aberto: "Carrinho reaberto",
      };

      toast.success(statusMessages[newStatus] || "Status atualizado!");
      await fetchBackstageData();
      return { success: true };
    } catch (err: any) {
      console.error("Error updating cart status:", err);
      toast.error("Erro ao atualizar status do carrinho");
      return { success: false };
    }
  };

  // Fetch cart status history
  const fetchCartStatusHistory = async (cartId: string) => {
    try {
      const { data, error } = await supabase
        .from("live_cart_status_history")
        .select("*")
        .eq("live_cart_id", cartId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err: any) {
      console.error("Error fetching cart history:", err);
      return [];
    }
  };

  return {
    customers,
    carts,
    waitlist,
    isLoading,
    fetchBackstageData,
    getOrCreateCustomer,
    getOrCreateCart,
    quickLaunch,
    removeCartItem,
    reduceItemQuantity,
    cancelItemForSeparation,
    addToWaitlist,
    allocateFromWaitlist,
    skipWaitlistEntry,
    endWaitlistQueue,
    getNextWaitlistEntry,
    getWaitlistCount,
    checkCustomerHasProduct,
    updateCartTotals,
    generatePaymentLink,
    updateCartStatus,
    fetchCartStatusHistory,
  };
}
