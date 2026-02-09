import { useState } from "react";
import { Star, Crown, Gift, AlertCircle, Loader2 } from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { RewardCard } from "@/components/account/RewardCard";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLoyalty, LOYALTY_TIERS } from "@/hooks/useLoyalty";
import { toast } from "sonner";

export default function LepoaClub() {
  const {
    loyalty,
    rewards,
    redemptions,
    isLoading,
    getProgressToNextTier,
    canRedeemReward,
    redeemReward,
    getExpiringPoints,
  } = useLoyalty();
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  const handleRedeem = async (rewardId: string) => {
    setRedeemingId(rewardId);
    try {
      const couponCode = await redeemReward(rewardId);
      if (couponCode) {
        toast.success(`Resgatado! Use o cupom: ${couponCode}`, { duration: 8000 });
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao resgatar");
    } finally {
      setRedeemingId(null);
    }
  };

  if (isLoading) {
    return (
      <AccountLayout title="Le.Poá Club">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AccountLayout>
    );
  }

  const currentTier = loyalty?.currentTier || "poa";
  const tierInfo = LOYALTY_TIERS[currentTier];
  const { progress, pointsNeeded, nextTierName } = getProgressToNextTier(
    loyalty?.annualPoints || 0,
    currentTier
  );
  const expiringPoints = getExpiringPoints();
  const featuredRewards = rewards.filter((r) => r.isFeatured);

  return (
    <AccountLayout title="Le.Poá Club" showBackButton>
      {/* Points & Tier Card */}
      <div className="bg-gradient-to-br from-card via-accent/5 to-card border border-accent/20 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
            <Crown className="h-6 w-6 text-accent" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Nível atual</p>
            <h2 className="font-serif text-xl">{tierInfo.name}</h2>
          </div>
        </div>

        {/* Points */}
        <div className="bg-card/80 rounded-xl p-4 mb-4 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pontos disponíveis</p>
              <div className="flex items-center gap-2 mt-1">
                <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                <span className="font-serif text-2xl font-semibold text-amber-700">
                  {loyalty?.currentPoints || 0}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Multiplicador</p>
              <p className="font-semibold text-accent">{tierInfo.multiplier}x</p>
            </div>
          </div>
        </div>

        {/* Progress */}
        {nextTierName && (
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-muted-foreground">Para {nextTierName}</span>
              <span className="font-medium">{pointsNeeded} pts</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Expiring warning */}
        {expiringPoints > 0 && (
          <div className="flex items-center gap-2 mt-4 p-3 bg-amber-50 rounded-lg text-sm text-amber-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{expiringPoints} pontos expiram em 30 dias</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rewards" className="w-full">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="rewards" className="flex-1">Recompensas</TabsTrigger>
          <TabsTrigger value="my-rewards" className="flex-1">Meus Resgates</TabsTrigger>
        </TabsList>

        <TabsContent value="rewards">
          {/* Featured */}
          {featuredRewards.length > 0 && (
            <div className="mb-6">
              <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                <Gift className="h-4 w-4 text-accent" />
                Em destaque
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {featuredRewards.map((reward) => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    currentPoints={loyalty?.currentPoints || 0}
                    currentTier={currentTier}
                    onRedeem={handleRedeem}
                    isRedeeming={redeemingId === reward.id}
                    canRedeem={canRedeemReward(reward)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All Rewards */}
          <div>
            <h3 className="font-medium text-sm mb-3">Todas as recompensas</h3>
            <div className="grid grid-cols-2 gap-3">
              {rewards.map((reward) => (
                <RewardCard
                  key={reward.id}
                  reward={reward}
                  currentPoints={loyalty?.currentPoints || 0}
                  currentTier={currentTier}
                  onRedeem={handleRedeem}
                  isRedeeming={redeemingId === reward.id}
                  canRedeem={canRedeemReward(reward)}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="my-rewards">
          {redemptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Gift className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Você ainda não resgatou recompensas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {redemptions.map((r) => (
                <div key={r.id} className="bg-card border rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{r.reward?.name || "Recompensa"}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Código: <span className="font-mono font-medium">{r.couponCode}</span>
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      r.status === "active" ? "bg-success/10 text-success" :
                      r.status === "used" ? "bg-muted text-muted-foreground" :
                      "bg-destructive/10 text-destructive"
                    }`}>
                      {r.status === "active" ? "Ativo" : r.status === "used" ? "Usado" : "Expirado"}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Expira em {new Date(r.expiresAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AccountLayout>
  );
}
