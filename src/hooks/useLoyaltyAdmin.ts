import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Types
export interface LoyaltyTier {
  id: string;
  name: string;
  slug: string;
  minPoints: number;
  maxPoints: number | null;
  multiplier: number;
  benefits: string | null;
  badgeColor: string;
  displayOrder: number;
  isActive: boolean;
}

export interface LoyaltyCampaign {
  id: string;
  name: string;
  description: string | null;
  campaignType: "multiplier" | "bonus_points" | "auto_gift" | "mission_bonus";
  multiplierValue: number;
  bonusPoints: number;
  giftId: string | null;
  minOrderValue: number | null;
  applicableTiers: string[];
  channelScope: "live" | "catalog" | "both";
  categoryFilter: string[] | null;
  skuFilter: string[] | null;
  priority: number;
  maxUsesPerCustomer: number | null;
  maxTotalUses: number | null;
  currentUses: number;
  startAt: string | null;
  endAt: string | null;
  isActive: boolean;
}

export interface LoyaltyMission {
  id: string;
  missionKey: string;
  title: string;
  subtitle: string | null;
  emoji: string;
  description: string | null;
  pointsReward: number;
  missionType: "quiz" | "profile_update" | "photo_upload" | "first_purchase" | "review";
  questionsJson: any[];
  maxPhotos: number;
  isRepeatable: boolean;
  repeatIntervalDays: number | null;
  prerequisiteMissionId: string | null;
  minTier: string;
  displayOrder: number;
  isActive: boolean;
  isPublished: boolean;
}

export interface LoyaltySettings {
  enabled: boolean;
  pointsPerReal: number;
  pointsExpiryMonths: number;
  weeklyMissionLimit: number;
}

export interface LoyaltyMessages {
  welcome: string;
  levelUp: string;
  pointsEarned: string;
  pointsExpiring: string;
}

export interface LoyaltyReportData {
  pointsEarned: number;
  pointsRedeemed: number;
  pointsExpired: number;
  activeUsers: number;
  topRewards: { name: string; redemptions: number }[];
  tierDistribution: { tier: string; count: number }[];
}

export function useLoyaltyAdmin() {
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [campaigns, setCampaigns] = useState<LoyaltyCampaign[]>([]);
  const [missions, setMissions] = useState<LoyaltyMission[]>([]);
  const [settings, setSettings] = useState<LoyaltySettings | null>(null);
  const [messages, setMessages] = useState<LoyaltyMessages | null>(null);
  const [reportData, setReportData] = useState<LoyaltyReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all data
  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchTiers(),
        fetchCampaigns(),
        fetchMissions(),
        fetchSettings(),
        fetchReportData(),
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch tiers
  const fetchTiers = async () => {
    const { data, error } = await supabase
      .from("loyalty_tiers")
      .select("*")
      .order("display_order", { ascending: true });

    if (!error && data) {
      setTiers(data.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        minPoints: t.min_points,
        maxPoints: t.max_points,
        multiplier: Number(t.multiplier),
        benefits: t.benefits,
        badgeColor: t.badge_color || "#8B7355",
        displayOrder: t.display_order,
        isActive: t.is_active,
      })));
    }
  };

  // Fetch campaigns
  const fetchCampaigns = async () => {
    const { data, error } = await supabase
      .from("loyalty_campaigns")
      .select("*")
      .order("priority", { ascending: false });

    if (!error && data) {
      setCampaigns(data.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        campaignType: c.campaign_type as LoyaltyCampaign["campaignType"],
        multiplierValue: Number(c.multiplier_value),
        bonusPoints: c.bonus_points,
        giftId: c.gift_id,
        minOrderValue: c.min_order_value ? Number(c.min_order_value) : null,
        applicableTiers: c.applicable_tiers || [],
        channelScope: c.channel_scope as LoyaltyCampaign["channelScope"],
        categoryFilter: c.category_filter,
        skuFilter: c.sku_filter,
        priority: c.priority,
        maxUsesPerCustomer: c.max_uses_per_customer,
        maxTotalUses: c.max_total_uses,
        currentUses: c.current_uses,
        startAt: c.start_at,
        endAt: c.end_at,
        isActive: c.is_active,
      })));
    }
  };

  // Fetch missions
  const fetchMissions = async () => {
    const { data, error } = await supabase
      .from("loyalty_missions")
      .select("*")
      .order("display_order", { ascending: true });

    if (!error && data) {
      setMissions(data.map(m => ({
        id: m.id,
        missionKey: m.mission_key,
        title: m.title,
        subtitle: m.subtitle,
        emoji: m.emoji || "🎯",
        description: m.description,
        pointsReward: m.points_reward,
        missionType: m.mission_type as LoyaltyMission["missionType"],
        questionsJson: (m.questions_json as any[]) || [],
        maxPhotos: m.max_photos || 5,
        isRepeatable: m.is_repeatable,
        repeatIntervalDays: m.repeat_interval_days,
        prerequisiteMissionId: m.prerequisite_mission_id,
        minTier: m.min_tier || "poa",
        displayOrder: m.display_order,
        isActive: m.is_active,
        isPublished: m.is_published,
      })));
    }
  };

  // Fetch settings
  const fetchSettings = async () => {
    const { data: generalData } = await supabase
      .from("loyalty_settings")
      .select("setting_value")
      .eq("setting_key", "general")
      .single();

    const { data: messagesData } = await supabase
      .from("loyalty_settings")
      .select("setting_value")
      .eq("setting_key", "messages")
      .single();

    if (generalData?.setting_value) {
      const val = generalData.setting_value as any;
      setSettings({
        enabled: val.enabled ?? true,
        pointsPerReal: val.points_per_real ?? 1,
        pointsExpiryMonths: val.points_expiry_months ?? 12,
        weeklyMissionLimit: val.weekly_mission_limit ?? 300,
      });
    }

    if (messagesData?.setting_value) {
      const val = messagesData.setting_value as any;
      setMessages({
        welcome: val.welcome ?? "",
        levelUp: val.level_up ?? "",
        pointsEarned: val.points_earned ?? "",
        pointsExpiring: val.points_expiring ?? "",
      });
    }
  };

  // Fetch report data
  const fetchReportData = async () => {
    // Get points summary
    const { data: transactions } = await supabase
      .from("point_transactions")
      .select("points, type, expired");

    let pointsEarned = 0;
    let pointsRedeemed = 0;
    let pointsExpired = 0;

    (transactions || []).forEach(t => {
      if (t.points > 0 && !t.expired) pointsEarned += t.points;
      if (t.type === "redemption") pointsRedeemed += Math.abs(t.points);
      if (t.expired) pointsExpired += t.points;
    });

    // Get active users
    const { count: activeUsers } = await supabase
      .from("customer_loyalty")
      .select("*", { count: "exact", head: true });

    // Get tier distribution
    const { data: tierData } = await supabase
      .from("customer_loyalty")
      .select("current_tier");

    const tierCounts: Record<string, number> = {};
    (tierData || []).forEach(t => {
      tierCounts[t.current_tier] = (tierCounts[t.current_tier] || 0) + 1;
    });

    // Get top rewards
    const { data: redemptions } = await supabase
      .from("reward_redemptions")
      .select("reward_id, loyalty_rewards(name)")
      .limit(100);

    const rewardCounts: Record<string, { name: string; count: number }> = {};
    (redemptions || []).forEach((r: any) => {
      const name = r.loyalty_rewards?.name || "Unknown";
      if (!rewardCounts[r.reward_id]) {
        rewardCounts[r.reward_id] = { name, count: 0 };
      }
      rewardCounts[r.reward_id].count++;
    });

    setReportData({
      pointsEarned,
      pointsRedeemed,
      pointsExpired,
      activeUsers: activeUsers || 0,
      topRewards: Object.values(rewardCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(r => ({ name: r.name, redemptions: r.count })),
      tierDistribution: Object.entries(tierCounts).map(([tier, count]) => ({
        tier,
        count,
      })),
    });
  };

  // CRUD Operations for Tiers
  const saveTier = async (tier: Partial<LoyaltyTier> & { id?: string }) => {
    const payload = {
      name: tier.name,
      slug: tier.slug,
      min_points: tier.minPoints,
      max_points: tier.maxPoints,
      multiplier: tier.multiplier,
      benefits: tier.benefits,
      badge_color: tier.badgeColor,
      display_order: tier.displayOrder,
      is_active: tier.isActive,
    };

    if (tier.id) {
      const { error } = await supabase
        .from("loyalty_tiers")
        .update(payload)
        .eq("id", tier.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("loyalty_tiers")
        .insert(payload);
      if (error) throw error;
    }
    await fetchTiers();
  };

  const deleteTier = async (id: string) => {
    const { error } = await supabase
      .from("loyalty_tiers")
      .delete()
      .eq("id", id);
    if (error) throw error;
    await fetchTiers();
  };

  // CRUD Operations for Campaigns
  const saveCampaign = async (campaign: Partial<LoyaltyCampaign> & { id?: string }) => {
    const payload = {
      name: campaign.name,
      description: campaign.description,
      campaign_type: campaign.campaignType,
      multiplier_value: campaign.multiplierValue,
      bonus_points: campaign.bonusPoints,
      gift_id: campaign.giftId,
      min_order_value: campaign.minOrderValue,
      applicable_tiers: campaign.applicableTiers,
      channel_scope: campaign.channelScope,
      category_filter: campaign.categoryFilter,
      sku_filter: campaign.skuFilter,
      priority: campaign.priority,
      max_uses_per_customer: campaign.maxUsesPerCustomer,
      max_total_uses: campaign.maxTotalUses,
      start_at: campaign.startAt,
      end_at: campaign.endAt,
      is_active: campaign.isActive,
    };

    if (campaign.id) {
      const { error } = await supabase
        .from("loyalty_campaigns")
        .update(payload)
        .eq("id", campaign.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("loyalty_campaigns")
        .insert(payload);
      if (error) throw error;
    }
    await fetchCampaigns();
  };

  const deleteCampaign = async (id: string) => {
    const { error } = await supabase
      .from("loyalty_campaigns")
      .delete()
      .eq("id", id);
    if (error) throw error;
    await fetchCampaigns();
  };

  // CRUD Operations for Missions
  const saveMission = async (mission: Partial<LoyaltyMission> & { id?: string }) => {
    const payload = {
      mission_key: mission.missionKey,
      title: mission.title,
      subtitle: mission.subtitle,
      emoji: mission.emoji,
      description: mission.description,
      points_reward: mission.pointsReward,
      mission_type: mission.missionType,
      questions_json: mission.questionsJson,
      max_photos: mission.maxPhotos,
      is_repeatable: mission.isRepeatable,
      repeat_interval_days: mission.repeatIntervalDays,
      prerequisite_mission_id: mission.prerequisiteMissionId,
      min_tier: mission.minTier,
      display_order: mission.displayOrder,
      is_active: mission.isActive,
      is_published: mission.isPublished,
    };

    if (mission.id) {
      const { error } = await supabase
        .from("loyalty_missions")
        .update(payload)
        .eq("id", mission.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("loyalty_missions")
        .insert(payload);
      if (error) throw error;
    }
    await fetchMissions();
  };

  const deleteMission = async (id: string) => {
    const { error } = await supabase
      .from("loyalty_missions")
      .delete()
      .eq("id", id);
    if (error) throw error;
    await fetchMissions();
  };

  // Save settings
  const saveSettings = async (newSettings: LoyaltySettings) => {
    const { error } = await supabase
      .from("loyalty_settings")
      .update({
        setting_value: {
          enabled: newSettings.enabled,
          points_per_real: newSettings.pointsPerReal,
          points_expiry_months: newSettings.pointsExpiryMonths,
          weekly_mission_limit: newSettings.weeklyMissionLimit,
        },
      })
      .eq("setting_key", "general");
    if (error) throw error;
    setSettings(newSettings);
  };

  const saveMessages = async (newMessages: LoyaltyMessages) => {
    const { error } = await supabase
      .from("loyalty_settings")
      .update({
        setting_value: {
          welcome: newMessages.welcome,
          level_up: newMessages.levelUp,
          points_earned: newMessages.pointsEarned,
          points_expiring: newMessages.pointsExpiring,
        },
      })
      .eq("setting_key", "messages");
    if (error) throw error;
    setMessages(newMessages);
  };

  // Manual points adjustment
  const adjustPoints = async (
    userId: string,
    points: number,
    reason: string,
    adjustedBy: string
  ) => {
    const { error } = await supabase.from("point_transactions").insert({
      user_id: userId,
      type: points > 0 ? "earn" : "redemption",
      points,
      description: `Ajuste manual: ${reason}`,
    } as any);
    if (error) throw error;

    // Update customer loyalty balance
    const { data: loyalty } = await supabase
      .from("customer_loyalty")
      .select("current_points")
      .eq("user_id", userId)
      .single();

    if (loyalty) {
      await supabase
        .from("customer_loyalty")
        .update({
          current_points: loyalty.current_points + points,
          lifetime_points: points > 0 ? loyalty.current_points + points : undefined,
        })
        .eq("user_id", userId);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    // Data
    tiers,
    campaigns,
    missions,
    settings,
    messages,
    reportData,
    isLoading,
    // Actions
    fetchAll,
    saveTier,
    deleteTier,
    saveCampaign,
    deleteCampaign,
    saveMission,
    deleteMission,
    saveSettings,
    saveMessages,
    adjustPoints,
  };
}
