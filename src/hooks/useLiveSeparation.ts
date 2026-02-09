import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { 
  SeparationBag, 
  SeparationItem, 
  ProductSeparationGroup, 
  SeparationKPIs,
  SeparationItemStatus,
  SeparationBagStatus,
  SeparationFilter,
  SeparationSort,
  AttentionRequirement,
  ReallocationInfo
} from "@/types/separation";

export function useLiveSeparation(eventId: string | undefined) {
  const [bags, setBags] = useState<SeparationBag[]>([]);
  const [productGroups, setProductGroups] = useState<ProductSeparationGroup[]>([]);
  const [kpis, setKpis] = useState<SeparationKPIs>({
    totalBags: 0,
    bagsSeparated: 0,
    bagsPending: 0,
    bagsAttention: 0,
    bagsCancelled: 0,
    itemsCancelled: 0,
    separationPercentage: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingBags, setIsGeneratingBags] = useState(false);
  
  const isMountedRef = useRef(true);
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);

  // Fetch all separation data
  const fetchSeparationData = useCallback(async () => {
    if (!eventId) return;

    setIsLoading(true);
    try {
      // Fetch carts with items, customer, gifts, AND attention logs
      // Include ALL carts (including cancelled) so we have full post-live history
      const { data: cartsData, error: cartsError } = await supabase
        .from("live_carts")
        .select(`
          *,
          live_customer:live_customers(id, instagram_handle, nome, whatsapp),
          items:live_cart_items(
            *,
            product:product_catalog(id, name, image_url, color, sku)
          ),
          gifts:order_gifts(
            id,
            gift_id,
            qty,
            status,
            separation_confirmed,
            applied_by_rule_id,
            applied_by_raffle_id,
            gift:gifts(id, name, image_url, sku)
          ),
          attention_logs:live_attention_log(
            id,
            attention_type,
            product_id,
            product_name,
            size,
            quantity,
            origin_bag_number,
            destination_bag_number,
            destination_instagram,
            payload,
            resolved_at,
            resolved_by,
            created_at
          )
        `)
        .eq("live_event_id", eventId)
        .order("bag_number", { ascending: true, nullsFirst: false });

      if (cartsError) throw cartsError;

      // ATTENTION WORKFLOW FIX:
      // If a bag became empty (all items cancelled/removed), we need to check if it was in a "committed" state
      // (separated or label printed). If so, we should NOT auto-cancel - we need to trigger ATENÇÃO workflow first.
      // 
      // We only auto-cancel for carts that:
      // - already have a bag_number (entered separation flow)
      // - had items historically
      // - are NOT paid
      // - have 0 active items (reservado/confirmado)
      // - AND were NOT in a committed state (no label printed, not separated)
      const cartsToCancel = (cartsData || [])
        .filter((cart: any) => !!cart.bag_number)
        .filter((cart: any) => Array.isArray(cart.items) && cart.items.length > 0)
        .filter((cart: any) => cart.status !== 'cancelado' && cart.status !== 'pago')
        .filter((cart: any) => {
          const activeItems = (cart.items || []).filter((it: any) => ['reservado', 'confirmado'].includes(it.status));
          return activeItems.length === 0;
        })
        // NEW: Only auto-cancel if bag was NOT in committed state
        .filter((cart: any) => {
          const hasLabelPrinted = !!cart.label_printed_at;
          const wasSeparated = cart.separation_status === 'separado';
          const hadLabelGenerated = cart.status === 'etiqueta_gerada' || cart.operational_status === 'etiqueta_gerada';
          const wasCommitted = hasLabelPrinted || wasSeparated || hadLabelGenerated;
          
          // If it was committed, DON'T auto-cancel - let it go through attention workflow
          return !wasCommitted;
        })
        .map((cart: any) => cart.id);

      if (cartsToCancel.length > 0) {
        await Promise.all(
          cartsToCancel.map((cartId: string) =>
            supabase
              .from('live_carts')
              .update({ status: 'cancelado', separation_status: 'cancelado' })
              .eq('id', cartId)
              .neq('status', 'pago')
          )
        );
      }

      // Transform data into SeparationBag format
      const transformedBags: SeparationBag[] = (cartsData || []).map((cart: any) => {
        // Determine if the bag/cart was already in a "committed" state (separated or label printed)
        // This is critical for triggering ATENÇÃO when items are removed
        const labelPrintedAt = cart.label_printed_at || null;
        const bagHasLabel = !!labelPrintedAt;
        const bagSeparationStatus = cart.separation_status;
        const bagWasInCommittedState = bagHasLabel || 
          bagSeparationStatus === 'separado' || 
          cart.status === 'etiqueta_gerada' ||
          cart.operational_status === 'etiqueta_gerada';
        
        // For separation, include items even if cart is 'expirado' (up to 7 days)
        // Only exclude truly 'removido' items (manually removed during live)
        const items: SeparationItem[] = (cart.items || [])
          // Do NOT drop items that were already separated and later removed/cancelled.
          // We only hide 'removido' items when they never entered the separation flow.
          .filter((item: any) => {
            if (item.status !== 'removido') return true;
            // Keep if it already has a meaningful separation status
            return ['separado', 'cancelado', 'retirado_confirmado'].includes(item.separation_status);
          })
          .map((item: any) => {
            // An item is cancelled if either:
            // 1. separation_status is 'cancelado'
            // 2. cart item status is 'cancelado' OR 'removido' (removed after being separated)
            const cartItemCancelled = item.status === 'cancelado' || item.status === 'removido';
            const separationCancelled = item.separation_status === 'cancelado';
            const wasAlreadySeparated = item.separation_status === 'separado' || item.separation_status === 'retirado_confirmado';
            
            // Parse removed_confirmed_count from notes if available
            let removedConfirmedCount = 0;
            if (item.separation_notes) {
              const match = item.separation_notes.match(/removed_confirmed:(\d+)/);
              if (match) {
                removedConfirmedCount = parseInt(match[1], 10);
              }
            }
            
            // Parse pending_removal count from notes (set when quantity is reduced on already-separated item)
            let pendingRemovalFromQuantityReduction = 0;
            if (item.separation_notes) {
              const pendingMatch = item.separation_notes.match(/pending_removal:(\d+)/);
              if (pendingMatch) {
                pendingRemovalFromQuantityReduction = parseInt(pendingMatch[1], 10);
              }
            }
            
            // Determine effective separation status:
            // If cart item was cancelled BUT separation wasn't updated yet, treat as cancelled
            // This handles the case where an already-separated item gets cancelled
            let effectiveStatus: SeparationItemStatus = (item.separation_status || 'em_separacao') as SeparationItemStatus;
            if (cartItemCancelled && !separationCancelled && effectiveStatus !== 'retirado_confirmado') {
              // Item was cancelled in cart but separation status wasn't updated
              // This is a newly cancelled item that needs removal confirmation
              effectiveStatus = 'cancelado';
            }
            
            // Also treat as needing attention if there are pending removals from quantity reduction
            if (pendingRemovalFromQuantityReduction > 0 && effectiveStatus !== 'retirado_confirmado') {
              effectiveStatus = 'cancelado';
            }
            
            // Calculate total pending removals: 
            // For fully cancelled items: quantity - removedConfirmedCount
            // For partially cancelled (qty reduced): pendingRemovalFromQuantityReduction - removedConfirmedCount
            // The removedConfirmedCount applies to the pending removal count
            const effectivePendingRemoval = pendingRemovalFromQuantityReduction > 0 
              ? Math.max(0, pendingRemovalFromQuantityReduction - removedConfirmedCount)
              : 0;
            
            // CRITICAL FIX: An item needs attention if:
            // 1. It was already marked as separated (separation_status = separado)
            // 2. OR the bag already had a label printed (bagHasLabel)
            // 3. OR the bag was in a committed state (etiqueta_gerada, etc.)
            // AND the item is now cancelled/removed
            const needsAttentionDueToCommittedState = bagWasInCommittedState && cartItemCancelled;
            
            return {
              id: item.id,
              bagId: cart.id,
              bagNumber: cart.bag_number || 0,
              productId: item.product_id,
              productName: item.product?.name || 'Produto',
              productImage: item.product?.image_url || null,
              color: item.variante?.cor || item.product?.color || null,
              size: item.variante?.tamanho || null,
              quantity: item.qtd,
              unitPrice: item.preco_unitario,
              status: effectiveStatus,
              notes: item.separation_notes || null,
              instagramHandle: cart.live_customer?.instagram_handle || '@unknown',
              cartItemStatus: item.status,
              removedConfirmedCount,
              pendingRemovalFromQuantityReduction, // New: track units cancelled via qty reduction
              // Flag to indicate this was previously separated (for UI indication)
              // FIXED: Now also triggers when bag had label or was in committed state
              wasSeparatedBeforeCancellation: (wasAlreadySeparated && cartItemCancelled) || 
                pendingRemovalFromQuantityReduction > 0 ||
                needsAttentionDueToCommittedState,
            };
          });

        // Add gift items to the separation list
        const giftItems: SeparationItem[] = (cart.gifts || [])
          .filter((g: any) => g.status !== 'removed')
          .map((g: any) => ({
            id: `gift-${g.id}`,
            bagId: cart.id,
            bagNumber: cart.bag_number || 0,
            productId: g.gift_id,
            productName: `🎁 ${g.gift?.name || 'Brinde'}`,
            productImage: g.gift?.image_url || null,
            color: null,
            size: null,
            quantity: g.qty,
            unitPrice: 0,
            status: (g.separation_confirmed ? 'separado' : 'em_separacao') as SeparationItemStatus,
            notes: null,
            instagramHandle: cart.live_customer?.instagram_handle || '@unknown',
            cartItemStatus: g.status,
            removedConfirmedCount: 0,
            isGift: true,
            giftSource: g.applied_by_raffle_id ? 'raffle' : (g.applied_by_rule_id ? 'rule' : null),
          }));

        const allItems = [...items, ...giftItems];

        const hasCancelledItems = allItems.some(i =>
          i.status === 'cancelado' || i.cartItemStatus === 'cancelado' || i.cartItemStatus === 'removido'
        );
        const hasUnseparatedItems = allItems.some(i => 
          i.status === 'em_separacao' && !['cancelado', 'removido'].includes(i.cartItemStatus)
        );
        
        // Calculate pending removal count for cancelled items
        let pendingRemovalCount = 0;
        allItems.forEach(item => {
          if (item.pendingRemovalFromQuantityReduction && item.pendingRemovalFromQuantityReduction > 0) {
            const pendingFromReduction = Math.max(0, item.pendingRemovalFromQuantityReduction - item.removedConfirmedCount);
            pendingRemovalCount += pendingFromReduction;
          } 
          else if (item.status === 'cancelado' || item.cartItemStatus === 'cancelado' || item.cartItemStatus === 'removido') {
            const pending = item.quantity - item.removedConfirmedCount;
            if (pending > 0) pendingRemovalCount += pending;
          }
        });
        
        // needsReprintLabel: only true if label was printed before (label_printed_at exists) AND needs_label_reprint is true
        // Note: labelPrintedAt is already defined at the top of this map function
        const needsReprintLabel = labelPrintedAt && cart.needs_label_reprint === true;
        
        // Build attention requirements from both item state AND database logs
        const attentionRequirements: AttentionRequirement[] = [];
        
        // First: Add attention from database logs (canonical source)
        const dbAttentionLogs = (cart.attention_logs || []) as any[];
        dbAttentionLogs.forEach((log: any) => {
          if (!log.resolved_at) {
            const reallocationInfo: ReallocationInfo = {
              itemId: log.payload?.item_id || log.id,
              productName: log.product_name || 'Produto',
              productImage: null,
              color: null,
              size: log.size,
              quantity: log.quantity || 1,
              originBagId: cart.id,
              originBagNumber: log.origin_bag_number || cart.bag_number || 0,
              destinationBagId: log.destination_bag_number ? 'pending' : null,
              destinationBagNumber: log.destination_bag_number,
              destinationInstagram: log.destination_instagram,
              createdAt: log.created_at,
              removedFromOriginConfirmed: false,
              placedInDestinationConfirmed: false,
            };
            
            attentionRequirements.push({
              type: log.attention_type as any,
              reallocationInfo,
              description: log.attention_type === 'cancellation' 
                ? 'Pedido cancelado - retirar itens da sacola'
                : log.attention_type === 'reallocation'
                ? `Peça realocada para Sacola #${log.destination_bag_number}`
                : 'Peça cancelada - retirar da sacola',
              resolved: false,
            });
          }
        });
        
        // Second: Add attention from item state (for items cancelled after separation)
        allItems.forEach(item => {
          const wasSeparated = item.wasSeparatedBeforeCancellation;
          const isCancelled = item.status === 'cancelado' || item.cartItemStatus === 'cancelado' || item.cartItemStatus === 'removido';
          const hasPartialCancellation = (item.pendingRemovalFromQuantityReduction ?? 0) > 0;
          
          // Only add if not already tracked in DB logs
          const alreadyInLogs = dbAttentionLogs.some((log: any) => 
            log.payload?.item_id === item.id && !log.resolved_at
          );
          
          if (!alreadyInLogs && (wasSeparated || hasPartialCancellation) && (isCancelled || hasPartialCancellation)) {
            const totalToRemove = hasPartialCancellation 
              ? (item.pendingRemovalFromQuantityReduction ?? 0)
              : item.quantity;
            const pendingRemoval = Math.max(0, totalToRemove - item.removedConfirmedCount);
            
            if (pendingRemoval > 0) {
              let destinationBagId: string | null = null;
              let destinationBagNumber: number | null = null;
              let destinationInstagram: string | null = null;
              
              if (item.notes) {
                const reallocationMatch = item.notes.match(/reallocation:([^:]+):(\d+):([^|]+)/);
                if (reallocationMatch) {
                  destinationBagId = reallocationMatch[1] === 'null' ? null : reallocationMatch[1];
                  destinationBagNumber = parseInt(reallocationMatch[2], 10) || null;
                  destinationInstagram = reallocationMatch[3]?.trim() || null;
                }
              }
              
              const reallocationInfo: ReallocationInfo = {
                itemId: item.id,
                productName: item.productName,
                productImage: item.productImage,
                color: item.color,
                size: item.size,
                quantity: pendingRemoval,
                originBagId: cart.id,
                originBagNumber: cart.bag_number || 0,
                destinationBagId,
                destinationBagNumber,
                destinationInstagram,
                createdAt: cart.updated_at || cart.created_at,
                removedFromOriginConfirmed: false,
                placedInDestinationConfirmed: false,
              };
              
              attentionRequirements.push({
                type: destinationBagId ? 'reallocation' : (hasPartialCancellation ? 'quantity_reduction' : 'cancellation'),
                reallocationInfo,
                description: destinationBagId 
                  ? `Peça realocada para Sacola #${destinationBagNumber}` 
                  : 'Peça cancelada - retirar da sacola',
                resolved: false,
              });
            }
          }
        });
        
        const hasUnresolvedAttention = attentionRequirements.some(r => !r.resolved);
        const isBlocked = hasUnresolvedAttention; // Bag is blocked when there are unresolved attention requirements
        
        // ATTENTION WORKFLOW FIX: Check for attention requirements BEFORE checking for cancelled status
        // This ensures bags that need attention don't skip to "cancelado" directly
        let bagStatus: SeparationBagStatus = 'em_separacao';
        if (hasUnresolvedAttention || pendingRemovalCount > 0) {
          // PRIORITY: Attention takes precedence over cancelled
          bagStatus = 'atencao';
        } else if (cart.separation_status === 'cancelado' || cart.status === 'cancelado') {
          // Only mark as cancelled if there are no pending attention requirements
          bagStatus = 'cancelado';
        } else if (!hasUnseparatedItems && allItems.length > 0) {
          bagStatus = 'separado';
        } else if (cart.separation_status === 'pendente') {
          bagStatus = 'pendente';
        }

        return {
          id: cart.id,
          bagNumber: cart.bag_number || 0,
          instagramHandle: cart.live_customer?.instagram_handle || '@unknown',
          customerName: cart.live_customer?.nome || null,
          totalItems: allItems.reduce((sum, i) => sum + i.quantity, 0),
          totalValue: cart.total || 0,
          status: bagStatus,
          items: allItems,
          hasCancelledItems,
          hasUnseparatedItems,
          cartStatus: cart.status,
          createdAt: cart.created_at,
          needsReprintLabel,
          pendingRemovalCount,
          labelPrintedAt,
          attentionRequirements,
          hasUnresolvedAttention,
          isBlocked,
        };
      });

      // Filter only bags with bag_number assigned
      const activeBags = transformedBags.filter(b => b.bagNumber > 0);

      if (isMountedRef.current) {
        setBags(activeBags);
        
        // Calculate product groups
        const groups = calculateProductGroups(activeBags);
        setProductGroups(groups);
        
        // Calculate KPIs
        const calculatedKpis = calculateKPIs(activeBags);
        setKpis(calculatedKpis);
      }
    } catch (err: any) {
      console.error("Error fetching separation data:", err);
      if (isMountedRef.current) {
        toast.error("Erro ao carregar dados de separação");
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [eventId]);

  // Calculate product groups for "By Product" mode
  const calculateProductGroups = (bags: SeparationBag[]): ProductSeparationGroup[] => {
    const groupMap = new Map<string, ProductSeparationGroup>();

    bags.forEach(bag => {
      bag.items.forEach(item => {
        // Create unique key for product + color + size combination
        const key = `${item.productId}_${item.color || ''}_${item.size || ''}`;
        
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            productId: item.productId,
            productName: item.productName,
            productImage: item.productImage,
            color: item.color,
            size: item.size,
            sku: null,
            totalNeeded: 0,
            totalSeparated: 0,
            totalPending: 0,
            totalCancelled: 0,
            bags: [],
          });
        }

        const group = groupMap.get(key)!;
        
        // Add to bag list
        group.bags.push({
          bagId: bag.id,
          bagNumber: bag.bagNumber,
          instagramHandle: bag.instagramHandle,
          itemId: item.id,
          quantity: item.quantity,
          status: item.status,
        });

        // Update totals
        if (item.status === 'separado' || item.status === 'retirado_confirmado') {
          group.totalSeparated += item.quantity;
        } else if (item.status === 'cancelado') {
          group.totalCancelled += item.quantity;
        } else {
          group.totalPending += item.quantity;
        }
        group.totalNeeded += item.quantity;
      });
    });

    // Sort groups by product name, then by size
    return Array.from(groupMap.values()).sort((a, b) => {
      const nameCompare = a.productName.localeCompare(b.productName);
      if (nameCompare !== 0) return nameCompare;
      return (a.size || '').localeCompare(b.size || '');
    });
  };

  // Calculate KPIs
  const calculateKPIs = (bags: SeparationBag[]): SeparationKPIs => {
    const totalBags = bags.length;
    const bagsSeparated = bags.filter(b => b.status === 'separado').length;
    const bagsPending = bags.filter(b => b.status === 'em_separacao' || b.status === 'pendente').length;
    const bagsAttention = bags.filter(b => b.status === 'atencao').length;
    const bagsCancelled = bags.filter(b => b.status === 'cancelado').length;
    
    let itemsCancelled = 0;
    bags.forEach(bag => {
      bag.items.forEach(item => {
        if (item.status === 'cancelado') {
          itemsCancelled += item.quantity;
        }
      });
    });

    // Calculate progress excluding cancelled bags
    const activeBags = totalBags - bagsCancelled;
    const separationPercentage = activeBags > 0 
      ? Math.round((bagsSeparated / activeBags) * 100) 
      : 0;

    return {
      totalBags,
      bagsSeparated,
      bagsPending,
      bagsAttention,
      bagsCancelled,
      itemsCancelled,
      separationPercentage,
    };
  };

  // Generate bag numbers for all carts without one
  const generateBagNumbers = async (): Promise<boolean> => {
    if (!eventId) return false;
    
    setIsGeneratingBags(true);
    try {
      // First check if there are ANY carts for this event (include expirado for separation)
      const { data: allActiveCarts, error: activeError } = await supabase
        .from("live_carts")
        .select("id, bag_number")
        .eq("live_event_id", eventId)
        .neq("status", "cancelado");

      if (activeError) throw activeError;

      // No carts at all (only cancelled ones)
      if (!allActiveCarts || allActiveCarts.length === 0) {
        toast.warning("Não há carrinhos nesta live para separar. Somente carrinhos cancelados não são incluídos.");
        setIsGeneratingBags(false);
        return false;
      }

      // Get carts without bag numbers, ordered by creation
      // Include expirado carts for separation (up to 7 days)
      const { data: cartsWithoutBag, error: fetchError } = await supabase
        .from("live_carts")
        .select("id, created_at, status")
        .eq("live_event_id", eventId)
        .is("bag_number", null)
        .neq("status", "cancelado")
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;

      if (!cartsWithoutBag || cartsWithoutBag.length === 0) {
        // All active carts already have bag numbers
        toast.info("Todas as sacolas ativas já foram numeradas");
        await fetchSeparationData();
        return true;
      }

      // Get current max bag number
      const { data: maxBagData } = await supabase
        .from("live_carts")
        .select("bag_number")
        .eq("live_event_id", eventId)
        .not("bag_number", "is", null)
        .order("bag_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextBagNumber = (maxBagData?.bag_number || 0) + 1;

      // Assign bag numbers sequentially
      for (const cart of cartsWithoutBag) {
        await supabase
          .from("live_carts")
          .update({ 
            bag_number: nextBagNumber,
            separation_status: 'em_separacao'
          })
          .eq("id", cart.id);
        
        // Also set all items to em_separacao
        await supabase
          .from("live_cart_items")
          .update({ separation_status: 'em_separacao' })
          .eq("live_cart_id", cart.id)
          .is("separation_status", null);

        nextBagNumber++;
      }

      toast.success(`${cartsWithoutBag.length} sacolas criadas!`);
      await fetchSeparationData();
      return true;
    } catch (err: any) {
      console.error("Error generating bag numbers:", err);
      toast.error("Erro ao gerar sacolas");
      return false;
    } finally {
      setIsGeneratingBags(false);
    }
  };

  // Mark item as separated (supports both products and gifts)
  const markItemSeparated = async (itemId: string): Promise<boolean> => {
    try {
      // Check if this is a gift item (IDs start with "gift-")
      const isGift = itemId.startsWith('gift-');
      
      if (isGift) {
        // Extract the actual order_gifts ID
        const giftId = itemId.replace('gift-', '');
        
        const { error } = await supabase
          .from("order_gifts")
          .update({ separation_confirmed: true })
          .eq("id", giftId);

        if (error) throw error;
      } else {
        // Regular product item
        const { error } = await supabase
          .from("live_cart_items")
          .update({ separation_status: 'separado' })
          .eq("id", itemId);

        if (error) throw error;
      }

      // Check if all items in the bag are separated
      const item = bags.flatMap(b => b.items).find(i => i.id === itemId);
      if (item) {
        await updateBagStatusIfComplete(item.bagId);
      }

      await fetchSeparationData();
      return true;
    } catch (err: any) {
      console.error("Error marking item separated:", err);
      toast.error("Erro ao marcar item como separado");
      return false;
    }
  };

  // Mark item as cancelled/to remove
  const markItemCancelled = async (itemId: string, notes?: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("live_cart_items")
        .update({ 
          separation_status: 'cancelado',
          separation_notes: notes || 'Retirar do pedido'
        })
        .eq("id", itemId);

      if (error) throw error;

      // Update bag status to attention
      const item = bags.flatMap(b => b.items).find(i => i.id === itemId);
      if (item) {
        await supabase
          .from("live_carts")
          .update({ separation_status: 'atencao' })
          .eq("id", item.bagId);
      }

      toast.warning("Item marcado para retirar");
      await fetchSeparationData();
      return true;
    } catch (err: any) {
      console.error("Error marking item cancelled:", err);
      toast.error("Erro ao marcar item como cancelado");
      return false;
    }
  };

  // Confirm unit was physically removed from bag (supports partial confirmation)
  const confirmItemRemoved = async (itemId: string, confirmedCount?: number): Promise<boolean> => {
    try {
      const item = bags.flatMap(b => b.items).find(i => i.id === itemId);
      if (!item) return false;
      
      // Calculate new confirmed count
      const newConfirmedCount = confirmedCount !== undefined 
        ? confirmedCount 
        : item.quantity; // If not specified, confirm all units
      
      // Determine total units that need removal
      // For partial cancellation: use pendingRemovalFromQuantityReduction
      // For full cancellation: use item.quantity
      const totalToRemove = (item.pendingRemovalFromQuantityReduction && item.pendingRemovalFromQuantityReduction > 0)
        ? item.pendingRemovalFromQuantityReduction
        : item.quantity;
      
      // Preserve existing notes (like pending_removal count) and update confirmed count
      let existingNotes = item.notes || '';
      // Update or add removed_confirmed count
      if (existingNotes.includes('removed_confirmed:')) {
        existingNotes = existingNotes.replace(/removed_confirmed:\d+/, `removed_confirmed:${newConfirmedCount}`);
      } else {
        existingNotes = existingNotes 
          ? `${existingNotes} | removed_confirmed:${newConfirmedCount}` 
          : `removed_confirmed:${newConfirmedCount}`;
      }
      
      // If all units are confirmed, mark as fully confirmed
      const allConfirmed = newConfirmedCount >= totalToRemove;
      
      const { error } = await supabase
        .from("live_cart_items")
        .update({ 
          separation_status: allConfirmed ? 'retirado_confirmado' : 'cancelado',
          separation_notes: existingNotes
        })
        .eq("id", itemId);

      if (error) throw error;

      // Check if bag status should be updated
      if (item) {
        await updateBagStatusIfComplete(item.bagId);
      }

      if (allConfirmed) {
        toast.success("Retirada confirmada");
      }
      await fetchSeparationData();
      return true;
    } catch (err: any) {
      console.error("Error confirming item removed:", err);
      toast.error("Erro ao confirmar retirada");
      return false;
    }
  };

  // Mark all items in a bag as separated (including gifts)
  const markBagSeparated = async (bagId: string): Promise<boolean> => {
    try {
      // Mark all product items as separated
      const { error: itemsError } = await supabase
        .from("live_cart_items")
        .update({ separation_status: 'separado' })
        .eq("live_cart_id", bagId)
        .in("separation_status", ['em_separacao', null]);

      if (itemsError) throw itemsError;

      // Mark all gift items as separated
      const { error: giftsError } = await supabase
        .from("order_gifts")
        .update({ separation_confirmed: true })
        .eq("live_cart_id", bagId)
        .eq("separation_confirmed", false);

      if (giftsError) throw giftsError;

      // Update bag status
      await supabase
        .from("live_carts")
        .update({ separation_status: 'separado' })
        .eq("id", bagId);

      toast.success("Sacola marcada como separada");
      await fetchSeparationData();
      return true;
    } catch (err: any) {
      console.error("Error marking bag separated:", err);
      toast.error("Erro ao marcar sacola como separada");
      return false;
    }
  };

  // Mark all items for a specific product as separated
  const markAllProductItemsSeparated = async (
    productId: string, 
    color: string | null, 
    size: string | null
  ): Promise<boolean> => {
    try {
      // Find all matching items
      const matchingItems = bags.flatMap(b => b.items).filter(item => 
        item.productId === productId &&
        item.color === color &&
        item.size === size &&
        item.status === 'em_separacao'
      );

      if (matchingItems.length === 0) {
        toast.info("Não há itens pendentes para este produto");
        return true;
      }

      // Update all matching items
      const itemIds = matchingItems.map(i => i.id);
      const { error } = await supabase
        .from("live_cart_items")
        .update({ separation_status: 'separado' })
        .in("id", itemIds);

      if (error) throw error;

      // Update bag statuses
      const affectedBagIds = [...new Set(matchingItems.map(i => i.bagId))];
      for (const bagId of affectedBagIds) {
        await updateBagStatusIfComplete(bagId);
      }

      toast.success(`${matchingItems.length} itens marcados como separados`);
      await fetchSeparationData();
      return true;
    } catch (err: any) {
      console.error("Error marking all product items separated:", err);
      toast.error("Erro ao marcar itens como separados");
      return false;
    }
  };

  // Update bag status if all items are separated (including gifts)
  const updateBagStatusIfComplete = async (bagId: string): Promise<void> => {
    try {
      // Check product items
      const { data: items } = await supabase
        .from("live_cart_items")
        .select("separation_status, status")
        .eq("live_cart_id", bagId)
        // keep 'removido' items, because they can represent cancellations after separation
        .neq("status", "expirado");

      // Check gift items
      const { data: gifts } = await supabase
        .from("order_gifts")
        .select("separation_confirmed, status")
        .eq("live_cart_id", bagId)
        .neq("status", "removed");

      if (!items) return;

      // If the cart has items but none are active anymore, cancel the bag/cart.
      const activeItems = items.filter(i => ['reservado', 'confirmado'].includes(i.status));
      const activeGifts = (gifts || []).filter(g => g.status !== 'removed');
      
      if (items.length > 0 && activeItems.length === 0 && activeGifts.length === 0) {
        await supabase
          .from('live_carts')
          .update({ status: 'cancelado', separation_status: 'cancelado' })
          .eq('id', bagId)
          .neq('status', 'pago');
        return;
      }

      // Check pending status for products
      const hasPendingProducts = activeItems.some(i =>
        i.separation_status === 'em_separacao' || 
        i.separation_status === null
      );
      
      // Check pending status for gifts (separation_confirmed = false means pending)
      const hasPendingGifts = activeGifts.some(g => !g.separation_confirmed);
      
      const hasPending = hasPendingProducts || hasPendingGifts;
      
      const hasCancelled = items.some(i =>
        i.separation_status === 'cancelado' || ['cancelado', 'removido'].includes(i.status)
      );

      let newStatus = 'em_separacao';
      if (hasCancelled) {
        newStatus = 'atencao';
      } else if (!hasPending) {
        newStatus = 'separado';
      }

      await supabase
        .from("live_carts")
        .update({ separation_status: newStatus })
        .eq("id", bagId);
    } catch (err) {
      console.error("Error updating bag status:", err);
    }
  };

  // Mark label as printed (set label_printed_at and reset needs_label_reprint)
  const markLabelPrinted = async (bagId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("live_carts")
        .update({ 
          label_printed_at: new Date().toISOString(),
          needs_label_reprint: false 
        })
        .eq("id", bagId);

      if (error) throw error;
      await fetchSeparationData();
      return true;
    } catch (err: any) {
      console.error("Error marking label printed:", err);
      toast.error("Erro ao registrar impressão de etiqueta");
      return false;
    }
  };

  // Mark multiple labels as printed (for batch print)
  const markLabelsAsPrinted = async (bagIds: string[]): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("live_carts")
        .update({ 
          label_printed_at: new Date().toISOString(),
          needs_label_reprint: false 
        })
        .in("id", bagIds);

      if (error) throw error;
      await fetchSeparationData();
      return true;
    } catch (err: any) {
      console.error("Error marking labels printed:", err);
      toast.error("Erro ao registrar impressões");
      return false;
    }
  };

  // Auto-generate bag number for a cart that doesn't have one
  const autoGenerateBagNumber = async (cartId: string): Promise<void> => {
    if (!eventId) return;
    
    try {
      // Get current max bag number
      const { data: maxBagData } = await supabase
        .from("live_carts")
        .select("bag_number")
        .eq("live_event_id", eventId)
        .not("bag_number", "is", null)
        .order("bag_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextBagNumber = (maxBagData?.bag_number || 0) + 1;

      await supabase
        .from("live_carts")
        .update({ 
          bag_number: nextBagNumber,
          separation_status: 'em_separacao'
        })
        .eq("id", cartId)
        .is("bag_number", null); // Only if still null

      // Set all items to em_separacao
      await supabase
        .from("live_cart_items")
        .update({ separation_status: 'em_separacao' })
        .eq("live_cart_id", cartId)
        .is("separation_status", null);
    } catch (err) {
      console.error("Error auto-generating bag number:", err);
    }
  };

  // Initial data fetch
  useEffect(() => {
    isMountedRef.current = true;
    fetchSeparationData();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchSeparationData]);

  // Realtime subscriptions with auto bag generation
  useEffect(() => {
    if (!eventId) return;

    // Cleanup previous channels
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel);
    });
    channelsRef.current = [];

    const handleRealtimeUpdate = async (payload: any) => {
      if (!isMountedRef.current) return;
      
      // Auto-generate bag number for new carts or carts that became eligible
      if (payload?.table === 'live_carts' && payload?.new) {
        const cart = payload.new;
        // Eligible: not cancelled, has items, no bag_number yet
        if (
          cart.live_event_id === eventId &&
          cart.bag_number === null &&
          cart.status !== 'cancelado'
        ) {
          await autoGenerateBagNumber(cart.id);
        }
      }
      
      fetchSeparationData();
    };

    // Subscribe to live_carts changes
    const cartsChannel = supabase
      .channel(`separation_carts_${eventId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_carts',
          filter: `live_event_id=eq.${eventId}`,
        },
        handleRealtimeUpdate
      )
      .subscribe();

    // Subscribe to live_cart_items changes
    const itemsChannel = supabase
      .channel(`separation_items_${eventId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_cart_items',
        },
        () => {
          if (isMountedRef.current) {
            fetchSeparationData();
          }
        }
      )
      .subscribe();

    channelsRef.current = [cartsChannel, itemsChannel];

    return () => {
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
    };
  }, [eventId, fetchSeparationData]);

  // Filter and sort bags
  const filterBags = (filter: SeparationFilter, sort: SeparationSort, search: string): SeparationBag[] => {
    let filtered = [...bags];

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(bag => 
        bag.instagramHandle.toLowerCase().includes(searchLower) ||
        bag.bagNumber.toString().includes(searchLower) ||
        bag.customerName?.toLowerCase().includes(searchLower) ||
        bag.items.some(item => 
          item.productName.toLowerCase().includes(searchLower)
        )
      );
    }

    // Apply status filter
    switch (filter) {
      case 'pending':
        filtered = filtered.filter(b => b.status === 'em_separacao' || b.status === 'pendente');
        break;
      case 'separated':
        filtered = filtered.filter(b => b.status === 'separado');
        break;
      case 'cancelled':
        filtered = filtered.filter(b => b.status === 'cancelado');
        break;
      case 'attention':
        filtered = filtered.filter(b => b.status === 'atencao');
        break;
    }

    // Apply sort
    switch (sort) {
      case 'bag_number':
        filtered.sort((a, b) => a.bagNumber - b.bagNumber);
        break;
      case 'instagram':
        filtered.sort((a, b) => a.instagramHandle.localeCompare(b.instagramHandle));
        break;
      case 'status':
        const statusOrder = { pendente: 0, em_separacao: 1, atencao: 2, separado: 3, cancelado: 4 };
        filtered.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
        break;
    }

    return filtered;
  };

  // Filter product groups
  const filterProductGroups = (search: string): ProductSeparationGroup[] => {
    if (!search.trim()) return productGroups;

    const searchLower = search.toLowerCase();
    return productGroups.filter(group =>
      group.productName.toLowerCase().includes(searchLower) ||
      group.color?.toLowerCase().includes(searchLower) ||
      group.size?.toLowerCase().includes(searchLower) ||
      group.sku?.toLowerCase().includes(searchLower)
    );
  };

  // Resolve a reallocation attention requirement
  // This confirms that the item was physically removed from the origin bag
  // and (if applicable) placed in the destination bag
  const resolveReallocation = async (
    reallocation: ReallocationInfo,
    removedFromOriginConfirmed: boolean,
    placedInDestinationConfirmed: boolean
  ): Promise<boolean> => {
    try {
      if (!removedFromOriginConfirmed) {
        toast.error("Confirme que retirou a peça da sacola original");
        return false;
      }
      
      // If there's a destination and it's not confirmed yet
      if (reallocation.destinationBagId && !placedInDestinationConfirmed) {
        toast.error("Confirme que colocou a peça na nova sacola");
        return false;
      }
      
      // Mark the item as fully resolved (retirado_confirmado)
      const item = bags.flatMap(b => b.items).find(i => i.id === reallocation.itemId);
      if (!item) return false;
      
      // Update the notes to mark reallocation as resolved
      let existingNotes = item.notes || '';
      
      // Update removed_confirmed count to full quantity
      const totalToRemove = (item.pendingRemovalFromQuantityReduction && item.pendingRemovalFromQuantityReduction > 0)
        ? item.pendingRemovalFromQuantityReduction
        : item.quantity;
      
      if (existingNotes.includes('removed_confirmed:')) {
        existingNotes = existingNotes.replace(/removed_confirmed:\d+/, `removed_confirmed:${totalToRemove}`);
      } else {
        existingNotes = existingNotes 
          ? `${existingNotes} | removed_confirmed:${totalToRemove}` 
          : `removed_confirmed:${totalToRemove}`;
      }
      
      // Add reallocation_resolved marker
      if (!existingNotes.includes('reallocation_resolved')) {
        existingNotes = existingNotes 
          ? `${existingNotes} | reallocation_resolved:${new Date().toISOString()}`
          : `reallocation_resolved:${new Date().toISOString()}`;
      }
      
      const { error } = await supabase
        .from("live_cart_items")
        .update({ 
          separation_status: 'retirado_confirmado',
          separation_notes: existingNotes
        })
        .eq("id", reallocation.itemId);

      if (error) throw error;

      // Update bag status
      await updateBagStatusIfComplete(reallocation.originBagId);
      
      // Also set needs_label_reprint if label was already printed
      const bag = bags.find(b => b.id === reallocation.originBagId);
      if (bag?.labelPrintedAt) {
        await supabase
          .from("live_carts")
          .update({ needs_label_reprint: true })
          .eq("id", reallocation.originBagId);
      }

      toast.success("Realocação confirmada");
      await fetchSeparationData();
      return true;
    } catch (err: any) {
      console.error("Error resolving reallocation:", err);
      toast.error("Erro ao confirmar realocação");
      return false;
    }
  };

  return {
    bags,
    productGroups,
    kpis,
    isLoading,
    isGeneratingBags,
    fetchSeparationData,
    generateBagNumbers,
    markItemSeparated,
    markItemCancelled,
    confirmItemRemoved,
    markBagSeparated,
    markAllProductItemsSeparated,
    markLabelPrinted,
    markLabelsAsPrinted,
    filterBags,
    filterProductGroups,
    resolveReallocation,
  };
}
