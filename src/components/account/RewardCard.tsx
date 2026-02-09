import { Star, Gift, Truck, Percent, Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoyaltyReward, LOYALTY_TIERS, LoyaltyTier } from "@/hooks/useLoyalty";
import { cn } from "@/lib/utils";

interface RewardCardProps {
  reward: LoyaltyReward;
  currentPoints: number;
  currentTier: LoyaltyTier;
  onRedeem: (rewardId: string) => void;
  isRedeeming?: boolean;
  canRedeem: { canRedeem: boolean; reason: string | null };
}

const rewardTypeIcons = {
  discount_fixed: Percent,
  discount_percentage: Percent,
  free_shipping: Truck,
  gift: Gift,
  vip_access: Crown,
};

export function RewardCard({
  reward,
  currentPoints,
  currentTier,
  onRedeem,
  isRedeeming,
  canRedeem,
}: RewardCardProps) {
  const Icon = rewardTypeIcons[reward.type as keyof typeof rewardTypeIcons] || Gift;
  const tierInfo = LOYALTY_TIERS[reward.minTier];

  // Check if user meets tier requirement
  const tierOrder: LoyaltyTier[] = ["poa", "classica", "icone", "poa_black"];
  const meetsTier = tierOrder.indexOf(currentTier) >= tierOrder.indexOf(reward.minTier);
  const hasEnoughPoints = currentPoints >= reward.pointsCost;
  const pointsNeeded = reward.pointsCost - currentPoints;

  return (
    <div
      className={cn(
        "bg-card border rounded-xl overflow-hidden transition-all",
        canRedeem.canRedeem && "hover:shadow-md hover:border-accent/30",
        !canRedeem.canRedeem && "opacity-70"
      )}
    >
      {/* Image or Icon Header */}
      <div className="h-32 bg-gradient-to-br from-secondary to-muted flex items-center justify-center relative">
        {reward.imageUrl ? (
          <img
            src={reward.imageUrl}
            alt={reward.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Icon className="h-12 w-12 text-muted-foreground/50" />
        )}
        
        {/* Tier badge if not base tier */}
        {reward.minTier !== "poa" && (
          <div className="absolute top-2 right-2">
            <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-card/90 backdrop-blur border border-border">
              {tierInfo.name}+
            </span>
          </div>
        )}

        {/* Out of stock */}
        {!reward.unlimitedStock && reward.stockQty !== null && reward.stockQty <= 0 && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <span className="text-sm font-medium text-muted-foreground">Esgotado</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-medium mb-1 line-clamp-1">{reward.name}</h3>
        {reward.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {reward.description}
          </p>
        )}

        {/* Points cost */}
        <div className="flex items-center gap-2 mb-3">
          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
          <span className="font-semibold text-amber-700">{reward.pointsCost}</span>
          <span className="text-sm text-muted-foreground">pontos</span>
        </div>

        {/* Action */}
        {canRedeem.canRedeem ? (
          <Button
            className="w-full gap-2"
            onClick={() => onRedeem(reward.id)}
            disabled={isRedeeming}
          >
            <Gift className="h-4 w-4" />
            Resgatar
          </Button>
        ) : (
          <div className="text-center">
            {!meetsTier ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
                <Lock className="h-4 w-4" />
                <span>Nível {tierInfo.name} necessário</span>
              </div>
            ) : !hasEnoughPoints ? (
              <div className="text-center py-2">
                <p className="text-xs text-muted-foreground">Faltam</p>
                <p className="font-medium text-accent">{pointsNeeded} pontos</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-2">{canRedeem.reason}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
