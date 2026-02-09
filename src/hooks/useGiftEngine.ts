import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { GiftRule, OrderGift } from "@/types/gifts";

interface ApplyGiftParams {
  orderId?: string;
  liveCartId?: string;
  cartTotal: number;
  customerId?: string;
  liveEventId?: string;
  channel: "catalog" | "live";
  paymentOrder?: number; // For first_n_paid condition
}

interface AppliedGift {
  giftId: string;
  giftName: string;
  ruleId: string;
  qty: number;
}

interface LiveCartGift {
  id: string;
  gift_id: string;
  gift: {
    id: string;
    name: string;
    image_url: string | null;
    sku: string | null;
  } | null;
  qty: number;
  status: string;
  applied_by_rule_id: string | null;
  applied_by_raffle_id: string | null;
}

export function useGiftEngine() {
  /**
   * Fetch applicable rules for a given context
   */
  const fetchApplicableRules = useCallback(async (params: ApplyGiftParams): Promise<GiftRule[]> => {
    const now = new Date().toISOString();
    
    let query = supabase
      .from("gift_rules")
      .select(`
        *,
        gift:gifts(*)
      `)
      .eq("is_active", true)
      .or(`start_at.is.null,start_at.lte.${now}`)
      .or(`end_at.is.null,end_at.gte.${now}`)
      .order("priority", { ascending: false });

    // Filter by channel scope
    if (params.channel === "catalog") {
      query = query.in("channel_scope", ["catalog_only", "both"]);
    } else {
      query = query.in("channel_scope", ["live_only", "both", "live_specific"]);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error("Error fetching gift rules:", error);
      return [];
    }

    // Filter live_specific rules to match current live
    let rules = (data || []) as GiftRule[];
    if (params.liveEventId) {
      rules = rules.filter(r => {
        if (r.channel_scope === "live_specific") {
          return r.live_event_id === params.liveEventId;
        }
        return true;
      });
    } else {
      // Remove live_specific rules if no live context
      rules = rules.filter(r => r.channel_scope !== "live_specific");
    }

    return rules;
  }, []);

  /**
   * Check if a rule's condition is met
   */
  const checkCondition = useCallback(async (
    rule: GiftRule, 
    params: ApplyGiftParams
  ): Promise<boolean> => {
    switch (rule.condition_type) {
      case "all_purchases":
        return true;

      case "min_value":
        if (!rule.condition_value) return false;
        return params.cartTotal >= rule.condition_value;

      case "first_n_paid":
        if (!rule.condition_value) return false;
        // Check if current awards count is less than N
        return rule.current_awards_count < rule.condition_value;

      case "first_n_reserved":
        if (!rule.condition_value) return false;
        return rule.current_awards_count < rule.condition_value;

      default:
        return false;
    }
  }, []);

  /**
   * Check if customer already received this gift (max_per_customer)
   */
  const checkCustomerLimit = useCallback(async (
    rule: GiftRule,
    customerId: string | undefined,
    liveCartId: string | undefined
  ): Promise<boolean> => {
    if (!rule.max_per_customer) return true;
    if (!customerId && !liveCartId) return true;

    // Count existing gifts from this rule for this customer
    let query = supabase
      .from("order_gifts")
      .select("id", { count: "exact" })
      .eq("applied_by_rule_id", rule.id);

    // For live carts, we need to find the customer
    if (liveCartId) {
      const { data: cart } = await supabase
        .from("live_carts")
        .select("live_customer:live_customers(instagram_handle)")
        .eq("id", liveCartId)
        .single();

      if (cart?.live_customer?.instagram_handle) {
        // Find all carts from this instagram
        const { data: carts } = await supabase
          .from("live_carts")
          .select("id")
          .eq("live_customers.instagram_handle", cart.live_customer.instagram_handle);
        
        if (carts && carts.length > 0) {
          query = query.in("live_cart_id", carts.map(c => c.id));
        }
      }
    }

    const { count } = await query;
    return (count || 0) < rule.max_per_customer;
  }, []);

  /**
   * Check if max total awards has been reached
   */
  const checkTotalLimit = useCallback((rule: GiftRule): boolean => {
    if (!rule.max_total_awards) return true;
    return rule.current_awards_count < rule.max_total_awards;
  }, []);

  /**
   * Apply a gift to an order/cart
   */
  const applyGift = useCallback(async (
    rule: GiftRule,
    params: ApplyGiftParams
  ): Promise<boolean> => {
    const gift = rule.gift;
    if (!gift) return false;

    // Check if gift has stock
    if (!gift.unlimited_stock && gift.stock_qty < rule.gift_qty) {
      console.log(`Gift ${gift.name} out of stock`);
      // TODO: Record out of stock event
      return false;
    }

    try {
      // Insert order_gift
      const { error: insertError } = await supabase
        .from("order_gifts")
        .insert({
          order_id: params.orderId || null,
          live_cart_id: params.liveCartId || null,
          gift_id: gift.id,
          qty: rule.gift_qty,
          status: "pending_separation",
          applied_by_rule_id: rule.id,
        });

      if (insertError) throw insertError;

      // Decrement gift stock
      await supabase.rpc("decrement_gift_stock", {
        p_gift_id: gift.id,
        p_qty: rule.gift_qty,
      });

      // Increment rule awards count
      await supabase.rpc("increment_gift_rule_awards", {
        p_rule_id: rule.id,
        p_qty: 1,
      });

      return true;
    } catch (err) {
      console.error("Error applying gift:", err);
      return false;
    }
  }, []);

  /**
   * Main function: evaluate and apply gifts for a cart/order
   */
  const evaluateAndApplyGifts = useCallback(async (
    params: ApplyGiftParams
  ): Promise<AppliedGift[]> => {
    const appliedGifts: AppliedGift[] = [];
    
    try {
      const rules = await fetchApplicableRules(params);
      
      for (const rule of rules) {
        // Check all conditions
        const conditionMet = await checkCondition(rule, params);
        if (!conditionMet) continue;

        const withinCustomerLimit = await checkCustomerLimit(
          rule, 
          params.customerId, 
          params.liveCartId
        );
        if (!withinCustomerLimit) continue;

        const withinTotalLimit = checkTotalLimit(rule);
        if (!withinTotalLimit) continue;

        // Check if this gift was already applied
        const existingQuery = supabase
          .from("order_gifts")
          .select("id")
          .eq("gift_id", rule.gift_id)
          .eq("applied_by_rule_id", rule.id);
        
        if (params.orderId) {
          existingQuery.eq("order_id", params.orderId);
        } else if (params.liveCartId) {
          existingQuery.eq("live_cart_id", params.liveCartId);
        }

        const { data: existing } = await existingQuery;
        if (existing && existing.length > 0) continue;

        // Apply the gift
        const applied = await applyGift(rule, params);
        if (applied && rule.gift) {
          appliedGifts.push({
            giftId: rule.gift.id,
            giftName: rule.gift.name,
            ruleId: rule.id,
            qty: rule.gift_qty,
          });
        }
      }

      if (appliedGifts.length > 0) {
        toast.success(`🎁 Brinde aplicado: ${appliedGifts.map(g => g.giftName).join(", ")}`);
      }
    } catch (err) {
      console.error("Error evaluating gifts:", err);
    }

    return appliedGifts;
  }, [fetchApplicableRules, checkCondition, checkCustomerLimit, checkTotalLimit, applyGift]);

  /**
   * Remove gifts that no longer qualify (cart value reduced, etc.)
   */
  const reevaluateGifts = useCallback(async (
    params: ApplyGiftParams
  ): Promise<void> => {
    try {
      // Get currently applied rule-based gifts
      let query = supabase
        .from("order_gifts")
        .select(`
          id,
          gift_id,
          applied_by_rule_id,
          gift_rule:gift_rules(*)
        `)
        .not("applied_by_rule_id", "is", null);

      if (params.orderId) {
        query = query.eq("order_id", params.orderId);
      } else if (params.liveCartId) {
        query = query.eq("live_cart_id", params.liveCartId);
      }

      const { data: appliedGifts } = await query;
      if (!appliedGifts || appliedGifts.length === 0) return;

      for (const ag of appliedGifts) {
        const rule = ag.gift_rule as GiftRule | null;
        if (!rule) continue;

        // Re-check condition
        const stillQualifies = await checkCondition(rule, params);
        
        if (!stillQualifies) {
          // Remove the gift
          await supabase
            .from("order_gifts")
            .update({ status: "removed" })
            .eq("id", ag.id);

          // Restore gift stock
          await supabase.rpc("decrement_gift_stock", {
            p_gift_id: ag.gift_id,
            p_qty: -1, // Negative to restore
          });

          toast.info(`Brinde removido (condição não atendida)`);
        }
      }
    } catch (err) {
      console.error("Error reevaluating gifts:", err);
    }
  }, [checkCondition]);

  /**
   * Get gifts applied to an order/cart
   */
  const getAppliedGifts = useCallback(async (
    orderId?: string,
    liveCartId?: string
  ): Promise<OrderGift[]> => {
    let query = supabase
      .from("order_gifts")
      .select(`
        *,
        gift:gifts(*),
        gift_rule:gift_rules(*)
      `)
      .neq("status", "removed");

    if (orderId) {
      query = query.eq("order_id", orderId);
    } else if (liveCartId) {
      query = query.eq("live_cart_id", liveCartId);
    } else {
      return [];
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching applied gifts:", error);
      return [];
    }

    return (data || []) as OrderGift[];
  }, []);

  /**
   * Get gifts for a live cart (for display in UI)
   */
  const getLiveCartGifts = useCallback(async (
    liveCartId: string
  ): Promise<LiveCartGift[]> => {
    const { data, error } = await supabase
      .from("order_gifts")
      .select(`
        id,
        gift_id,
        qty,
        status,
        applied_by_rule_id,
        applied_by_raffle_id,
        gift:gifts(id, name, image_url, sku)
      `)
      .eq("live_cart_id", liveCartId)
      .neq("status", "removed");

    if (error) {
      console.error("Error fetching live cart gifts:", error);
      return [];
    }

    return (data || []) as LiveCartGift[];
  }, []);

  /**
   * Apply a gift manually to a live cart (from raffle or rule)
   */
  const addGiftToLiveCart = useCallback(async (
    liveCartId: string,
    giftId: string,
    source: "rule" | "raffle",
    sourceId: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("order_gifts")
        .insert({
          live_cart_id: liveCartId,
          gift_id: giftId,
          qty: 1,
          status: "pending_separation",
          applied_by_rule_id: source === "rule" ? sourceId : null,
          applied_by_raffle_id: source === "raffle" ? sourceId : null,
        });

      if (error) throw error;

      // Decrement stock
      await supabase.rpc("decrement_gift_stock", {
        p_gift_id: giftId,
        p_qty: 1,
      });

      return true;
    } catch (err) {
      console.error("Error adding gift to cart:", err);
      return false;
    }
  }, []);

  return {
    evaluateAndApplyGifts,
    reevaluateGifts,
    getAppliedGifts,
    getLiveCartGifts,
    addGiftToLiveCart,
  };
}
