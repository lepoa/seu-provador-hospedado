import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Star, Trophy, Gift, Target, ChevronRight, Sparkles,
  Clock, CheckCircle2, ArrowRight, Crown, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountLayout } from "@/components/account/AccountLayout";
import { useLoyalty, LOYALTY_TIERS } from "@/hooks/useLoyalty";
import { useAuth } from "@/hooks/useAuth";

export default function ClubHub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    loyalty,
    rewards,
    redemptions,
    transactions,
    isLoading,
    getTierInfo,
    getProgressToNextTier,
    canRedeemReward,
    redeemReward,
    getExpiringPoints,
    getMissionPointsRemaining,
    monthlyMissionLimit,
  } = useLoyalty();

  const [activeTab, setActiveTab] = useState("overview");
  const [redeeming, setRedeeming] = useState<string | null>(null);

  if (isLoading) {
    return (
      <AccountLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AccountLayout>
    );
  }

  if (!loyalty) {
    return (
      <AccountLayout>
        <div className="text-center py-12">
          <Crown className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-serif mb-2">Bem-vinda ao Le.Poá Club</h2>
          <p className="text-sm text-muted-foreground mb-2">Acumule Poás a cada compra: 1 Poá = R$ 1 pago</p>
          <p className="text-muted-foreground mb-6">
            Faça seu primeiro pedido para começar a acumular pontos!
          </p>
          <Button onClick={() => navigate("/catalogo")}>
            Ver Catálogo
          </Button>
        </div>
      </AccountLayout>
    );
  }

  const tierInfo = getTierInfo(loyalty.currentTier);
  const { progress, pointsNeeded, nextTierName } = getProgressToNextTier(
    loyalty.annualPoints,
    loyalty.currentTier
  );
  const expiringPoints = getExpiringPoints();
  const missionPointsRemaining = getMissionPointsRemaining(loyalty.weeklyMissionPoints);

  // Filter available rewards
  const availableRewards = rewards.filter(r => {
    const { canRedeem } = canRedeemReward(r);
    return canRedeem || loyalty.currentPoints >= r.pointsCost * 0.7; // Show rewards close to unlocking
  });

  const handleRedeem = async (rewardId: string) => {
    setRedeeming(rewardId);
    try {
      const couponCode = await redeemReward(rewardId);
      if (couponCode) {
        // Show success with coupon code
        alert(`Seu cupom: ${couponCode}\n\nUse no checkout para aplicar a recompensa!`);
      }
    } catch (error: any) {
      alert(error.message || "Erro ao resgatar");
    } finally {
      setRedeeming(null);
    }
  };

  return (
    <AccountLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center pb-4 border-b border-border">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-primary/10 to-accent/10 px-4 py-1.5 rounded-full mb-3">
            <Crown className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Le.Poá Club</span>
          </div>
          <h1 className="text-2xl font-serif">Olá, membro {tierInfo.name}!</h1>
        </div>

        {/* Main Progress Card */}
        <Card className="bg-gradient-to-br from-card to-muted/30 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <Star className="h-6 w-6 text-primary fill-primary" />
                </div>
                <div>
                  <div className="text-3xl font-bold">{loyalty.currentPoints.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Poás disponíveis</div>
                </div>
              </div>
              <Badge variant="outline" className="text-base px-3 py-1">
                Nível {tierInfo.name}
              </Badge>
            </div>

            {/* Progress to next tier */}
            {nextTierName && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progresso para {nextTierName}</span>
                  <span className="font-medium">{pointsNeeded} pts restantes</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* Tier Benefits */}
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-accent" />
                <span>Multiplicador <strong>{tierInfo.multiplier}x</strong> nos pontos</span>
              </div>
            </div>

            {/* Expiring Points Alert */}
            {expiringPoints > 0 && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-sm">
                  <Clock className="h-4 w-4" />
                  <span><strong>{expiringPoints}</strong> pontos expiram em 30 dias</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/conta/missoes">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mb-2">
                  <Target className="h-5 w-5 text-accent" />
                </div>
                <div className="font-medium text-sm">Módulos de Estilo</div>
                <div className="text-xs text-muted-foreground">
                  +{missionPointsRemaining} pts disponíveis
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/conta/recompensas">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <Gift className="h-5 w-5 text-primary" />
                </div>
                <div className="font-medium text-sm">Recompensas</div>
                <div className="text-xs text-muted-foreground">
                  {rewards.length} disponíveis
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="overview">Destaques</TabsTrigger>
            <TabsTrigger value="rewards">Recompensas</TabsTrigger>
            <TabsTrigger value="history">Extrato</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Featured Rewards */}
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Recompensas em Destaque
              </h3>
              <div className="space-y-3">
                {availableRewards.slice(0, 3).map(reward => {
                  const { canRedeem, reason } = canRedeemReward(reward);
                  return (
                    <Card key={reward.id} className={canRedeem ? "border-primary/30" : ""}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <Gift className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{reward.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {reward.pointsCost} pontos
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={canRedeem ? "default" : "outline"}
                          disabled={!canRedeem || redeeming === reward.id}
                          onClick={() => handleRedeem(reward.id)}
                        >
                          {redeeming === reward.id ? "..." : canRedeem ? "Resgatar" : "Bloqueado"}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Missions CTA */}
            <Card className="bg-gradient-to-r from-accent/5 to-primary/5 border-accent/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                    <Target className="h-6 w-6 text-accent" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">Aprofunde seu perfil</div>
                    <div className="text-sm text-muted-foreground">
                      Ganhe até {monthlyMissionLimit} Poás por mês
                    </div>
                  </div>
                  <Link to="/conta/missoes">
                    <Button variant="ghost" size="icon">
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rewards Tab */}
          <TabsContent value="rewards" className="space-y-4 mt-4">
            {rewards.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma recompensa disponível no momento
              </div>
            ) : (
              <div className="space-y-3">
                {rewards.map(reward => {
                  const { canRedeem, reason } = canRedeemReward(reward);
                  return (
                    <Card key={reward.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            {reward.imageUrl ? (
                              <img src={reward.imageUrl} alt={reward.name} className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <Gift className="h-7 w-7 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{reward.name}</div>
                            {reward.description && (
                              <div className="text-sm text-muted-foreground line-clamp-2">
                                {reward.description}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline">{reward.pointsCost} pts</Badge>
                              {reward.minTier !== "poa" && (
                                <Badge variant="secondary">
                                  {LOYALTY_TIERS[reward.minTier].name}+
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t flex items-center justify-between">
                          {!canRedeem && reason && (
                            <span className="text-sm text-muted-foreground">{reason}</span>
                          )}
                          <Button
                            size="sm"
                            className="ml-auto"
                            variant={canRedeem ? "default" : "outline"}
                            disabled={!canRedeem || redeeming === reward.id}
                            onClick={() => handleRedeem(reward.id)}
                          >
                            {redeeming === reward.id ? "Resgatando..." : "Resgatar"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4 mt-4">
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma transação ainda
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.slice(0, 20).map(tx => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.points > 0 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                        }`}>
                        {tx.points > 0 ? "+" : "-"}
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          {tx.description || (tx.points > 0 ? "Pontos ganhos" : "Pontos usados")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                    </div>
                    <div className={`font-bold ${tx.points > 0 ? "text-green-600" : "text-red-600"}`}>
                      {tx.points > 0 ? "+" : ""}{tx.points}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AccountLayout>
  );
}
