import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

// Tier configuration - Rolling 12 months
export const LOYALTY_TIERS = {
  poa: { name: "Poá", minPoints: 0, maxPoints: 999, multiplier: 1.0 },
  classica: { name: "Clássica", minPoints: 1000, maxPoints: 2999, multiplier: 1.1 },
  icone: { name: "Ícone", minPoints: 3000, maxPoints: 5999, multiplier: 1.2 },
  poa_black: { name: "Poá Black", minPoints: 6000, maxPoints: Infinity, multiplier: 1.3 },
} as const;

// Redemption discount tiers
export const REDEMPTION_DISCOUNTS = [
  { points: 500, value: 25 },
  { points: 1000, value: 60 },
  { points: 2000, value: 150 },
] as const;

// Redemption limit: max 20% of order total
export const MAX_REDEMPTION_PERCENT = 0.20;

export type LoyaltyTier = keyof typeof LOYALTY_TIERS;

export interface LoyaltyData {
  id: string;
  currentPoints: number;
  lifetimePoints: number;
  annualPoints: number;
  currentTier: LoyaltyTier;
  weeklyMissionPoints: number;
  weeklyMissionResetAt: string | null;
}

export interface PointTransaction {
  id: string;
  type: string;
  points: number;
  description: string | null;
  orderId: string | null;
  missionId: string | null;
  rewardId: string | null;
  expiresAt: string | null;
  expired: boolean;
  multiplier: number;
  basePoints: number | null;
  createdAt: string;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  type: string;
  pointsCost: number;
  discountValue: number | null;
  minTier: LoyaltyTier;
  stockQty: number | null;
  unlimitedStock: boolean;
  isActive: boolean;
  isFeatured: boolean;
}

export interface RewardRedemption {
  id: string;
  rewardId: string;
  pointsSpent: number;
  couponCode: string;
  rewardType: string;
  discountValue: number | null;
  status: string;
  expiresAt: string;
  createdAt: string;
  reward?: LoyaltyReward;
}

// Mission limits - Monthly cap of 200 Poás
const MONTHLY_MISSION_LIMIT = 200;

// Fixed missions (one-time)
export const FIXED_MISSIONS = {
  basic_profile: { name: "Perfil Básico", points: 150, oneTime: true },
  preferences: { name: "Preferências de Estilo", points: 150, oneTime: true },
  measurements: { name: "Minhas Medidas", points: 200, oneTime: true },
  prints_photos: { name: "Meus Prints/Fotos", points: 150, oneTime: true },
} as const;

// Recurring missions (monthly)
export const RECURRING_MISSIONS = {
  update_style: { name: "Atualizar Estilo", points: 80, interval: "monthly" },
  post_purchase_feedback: { name: "Feedback Pós-Compra", points: 50, interval: "monthly" },
  occasion_month: { name: "Ocasião do Mês", points: 50, interval: "monthly" },
} as const;

export function useLoyalty() {
  const { user } = useAuth();
  const [loyalty, setLoyalty] = useState<LoyaltyData | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate tier info
  const getTierInfo = useCallback((tier: LoyaltyTier) => {
    return LOYALTY_TIERS[tier];
  }, []);

  // Get next tier
  const getNextTier = useCallback((currentTier: LoyaltyTier): LoyaltyTier | null => {
    const tiers: LoyaltyTier[] = ["poa", "classica", "icone", "poa_black"];
    const currentIndex = tiers.indexOf(currentTier);
    if (currentIndex < tiers.length - 1) {
      return tiers[currentIndex + 1];
    }
    return null;
  }, []);

  // Calculate progress to next tier
  const getProgressToNextTier = useCallback((annualPoints: number, currentTier: LoyaltyTier) => {
    const nextTier = getNextTier(currentTier);
    if (!nextTier) return { progress: 100, pointsNeeded: 0, nextTierName: null };

    const currentTierInfo = LOYALTY_TIERS[currentTier];
    const nextTierInfo = LOYALTY_TIERS[nextTier];
    
    const pointsInTier = annualPoints - currentTierInfo.minPoints;
    const tierRange = nextTierInfo.minPoints - currentTierInfo.minPoints;
    const progress = Math.min((pointsInTier / tierRange) * 100, 100);
    const pointsNeeded = Math.max(nextTierInfo.minPoints - annualPoints, 0);

    return { progress, pointsNeeded, nextTierName: nextTierInfo.name };
  }, [getNextTier]);

  // Check monthly mission limit (changed from weekly)
  const canEarnMissionPoints = useCallback((currentMonthlyPoints: number) => {
    return currentMonthlyPoints < MONTHLY_MISSION_LIMIT;
  }, []);

  const getMissionPointsRemaining = useCallback((currentMonthlyPoints: number) => {
    return Math.max(MONTHLY_MISSION_LIMIT - currentMonthlyPoints, 0);
  }, []);

  // Calculate max redeemable points for an order (20% limit)
  const getMaxRedeemablePoints = useCallback((orderTotal: number) => {
    const maxDiscount = orderTotal * MAX_REDEMPTION_PERCENT;
    // Find the highest discount tier that doesn't exceed the limit
    const applicableDiscounts = REDEMPTION_DISCOUNTS.filter(d => d.value <= maxDiscount);
    if (applicableDiscounts.length === 0) return { maxPoints: 0, maxDiscount: 0 };
    const best = applicableDiscounts[applicableDiscounts.length - 1];
    return { maxPoints: best.points, maxDiscount: best.value };
  }, []);

  // Fetch loyalty data
  const fetchLoyalty = useCallback(async () => {
    if (!user) {
      setLoyalty(null);
      setIsLoading(false);
      return;
    }

    try {
      // Get or create loyalty record
      let { data, error } = await supabase
        .from("customer_loyalty")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!data && !error) {
        // Create new loyalty record
        const { data: newData, error: insertError } = await supabase
          .from("customer_loyalty")
          .insert({ user_id: user.id })
          .select()
          .single();

        if (insertError) throw insertError;
        data = newData;
      }

      if (data) {
        setLoyalty({
          id: data.id,
          currentPoints: data.current_points,
          lifetimePoints: data.lifetime_points,
          annualPoints: data.annual_points,
          currentTier: data.current_tier as LoyaltyTier,
          weeklyMissionPoints: data.weekly_mission_points,
          weeklyMissionResetAt: data.weekly_mission_reset_at,
        });
      }
    } catch (error) {
      console.error("Error fetching loyalty:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("point_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setTransactions(
        (data || []).map((t) => ({
          id: t.id,
          type: t.type,
          points: t.points,
          description: t.description,
          orderId: t.order_id,
          missionId: t.mission_id,
          rewardId: t.reward_id,
          expiresAt: t.expires_at,
          expired: t.expired,
          multiplier: t.multiplier || 1,
          basePoints: t.base_points,
          createdAt: t.created_at,
        }))
      );
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  }, [user]);

  // Fetch rewards
  const fetchRewards = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("loyalty_rewards")
        .select("*")
        .eq("is_active", true)
        .order("points_cost", { ascending: true });

      if (error) throw error;

      setRewards(
        (data || []).map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          imageUrl: r.image_url,
          type: r.type,
          pointsCost: r.points_cost,
          discountValue: r.discount_value,
          minTier: r.min_tier as LoyaltyTier,
          stockQty: r.stock_qty,
          unlimitedStock: r.unlimited_stock,
          isActive: r.is_active,
          isFeatured: r.is_featured,
        }))
      );
    } catch (error) {
      console.error("Error fetching rewards:", error);
    }
  }, []);

  // Fetch redemptions
  const fetchRedemptions = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("reward_redemptions")
        .select("*, loyalty_rewards(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setRedemptions(
        (data || []).map((r) => ({
          id: r.id,
          rewardId: r.reward_id,
          pointsSpent: r.points_spent,
          couponCode: r.coupon_code,
          rewardType: r.reward_type,
          discountValue: r.discount_value,
          status: r.status,
          expiresAt: r.expires_at,
          createdAt: r.created_at,
          reward: r.loyalty_rewards ? {
            id: r.loyalty_rewards.id,
            name: r.loyalty_rewards.name,
            description: r.loyalty_rewards.description,
            imageUrl: r.loyalty_rewards.image_url,
            type: r.loyalty_rewards.type,
            pointsCost: r.loyalty_rewards.points_cost,
            discountValue: r.loyalty_rewards.discount_value,
            minTier: r.loyalty_rewards.min_tier as LoyaltyTier,
            stockQty: r.loyalty_rewards.stock_qty,
            unlimitedStock: r.loyalty_rewards.unlimited_stock,
            isActive: r.loyalty_rewards.is_active,
            isFeatured: r.loyalty_rewards.is_featured,
          } : undefined,
        }))
      );
    } catch (error) {
      console.error("Error fetching redemptions:", error);
    }
  }, [user]);

  // Check if reward is redeemable
  const canRedeemReward = useCallback((reward: LoyaltyReward) => {
    if (!loyalty) return { canRedeem: false, reason: "Faça login para resgatar" };
    
    // Check points
    if (loyalty.currentPoints < reward.pointsCost) {
      return { 
        canRedeem: false, 
        reason: `Faltam ${reward.pointsCost - loyalty.currentPoints} pontos` 
      };
    }

    // Check tier
    const tierOrder: LoyaltyTier[] = ["poa", "classica", "icone", "poa_black"];
    if (tierOrder.indexOf(loyalty.currentTier) < tierOrder.indexOf(reward.minTier)) {
      return { 
        canRedeem: false, 
        reason: `Necessário nível ${LOYALTY_TIERS[reward.minTier].name}` 
      };
    }

    // Check stock
    if (!reward.unlimitedStock && (reward.stockQty === null || reward.stockQty <= 0)) {
      return { canRedeem: false, reason: "Esgotado" };
    }

    return { canRedeem: true, reason: null };
  }, [loyalty]);

  // Redeem a reward
  const redeemReward = useCallback(async (rewardId: string) => {
    if (!user || !loyalty) return null;

    const reward = rewards.find(r => r.id === rewardId);
    if (!reward) return null;

    const { canRedeem, reason } = canRedeemReward(reward);
    if (!canRedeem) {
      throw new Error(reason || "Não é possível resgatar");
    }

    try {
      // Generate coupon code
      const { data: couponData, error: couponError } = await supabase
        .rpc("generate_reward_coupon");

      if (couponError) throw couponError;
      const couponCode = couponData as string;

      // Create redemption (expires in 30 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { data: redemption, error: redemptionError } = await supabase
        .from("reward_redemptions")
        .insert({
          user_id: user.id,
          reward_id: rewardId,
          points_spent: reward.pointsCost,
          coupon_code: couponCode,
          reward_type: reward.type as "discount_fixed" | "discount_percentage" | "free_shipping" | "gift" | "vip_access",
          discount_value: reward.discountValue,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (redemptionError) throw redemptionError;

      // Deduct points (create negative transaction)
      const { error: transactionError } = await supabase
        .from("point_transactions")
        .insert({
          user_id: user.id,
          type: "redemption",
          points: -reward.pointsCost,
          description: `Resgate: ${reward.name}`,
          reward_id: rewardId,
          redemption_id: redemption.id,
        });

      if (transactionError) throw transactionError;

      // Update loyalty balance
      const { error: updateError } = await supabase
        .from("customer_loyalty")
        .update({ 
          current_points: loyalty.currentPoints - reward.pointsCost,
          updated_at: new Date().toISOString()
        })
        .eq("id", loyalty.id);

      if (updateError) throw updateError;

      // Refresh data
      await Promise.all([fetchLoyalty(), fetchRedemptions(), fetchTransactions()]);

      return couponCode;
    } catch (error) {
      console.error("Error redeeming reward:", error);
      throw error;
    }
  }, [user, loyalty, rewards, canRedeemReward, fetchLoyalty, fetchRedemptions, fetchTransactions]);

  // Points about to expire (next 30 days)
  const getExpiringPoints = useCallback(() => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    return transactions
      .filter(t => 
        t.points > 0 && 
        !t.expired && 
        t.expiresAt && 
        new Date(t.expiresAt) <= thirtyDaysFromNow
      )
      .reduce((sum, t) => sum + t.points, 0);
  }, [transactions]);

  // Initial load
  useEffect(() => {
    fetchLoyalty();
    fetchRewards();
  }, [fetchLoyalty, fetchRewards]);

  // Fetch user-specific data when user changes
  useEffect(() => {
    if (user) {
      fetchTransactions();
      fetchRedemptions();
    }
  }, [user, fetchTransactions, fetchRedemptions]);

  return {
    loyalty,
    transactions,
    rewards,
    redemptions,
    isLoading,
    // Tier helpers
    getTierInfo,
    getNextTier,
    getProgressToNextTier,
    // Mission helpers
    canEarnMissionPoints,
    getMissionPointsRemaining,
    monthlyMissionLimit: MONTHLY_MISSION_LIMIT,
    // Reward helpers
    canRedeemReward,
    redeemReward,
    getExpiringPoints,
    getMaxRedeemablePoints,
    // Constants
    fixedMissions: FIXED_MISSIONS,
    recurringMissions: RECURRING_MISSIONS,
    redemptionDiscounts: REDEMPTION_DISCOUNTS,
    // Refetch
    refetch: fetchLoyalty,
  };
}
