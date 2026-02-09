import { Link } from "react-router-dom";
import { Crown, Star, ChevronRight, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useLoyalty, LOYALTY_TIERS } from "@/hooks/useLoyalty";
import { cn } from "@/lib/utils";

interface LoyaltyClubCardProps {
  variant?: "compact" | "full";
}

export function LoyaltyClubCard({ variant = "full" }: LoyaltyClubCardProps) {
  const { loyalty, getProgressToNextTier, isLoading } = useLoyalty();

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 rounded-2xl p-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-32 mb-4" />
        <div className="h-8 bg-muted rounded w-24 mb-4" />
        <div className="h-2 bg-muted rounded mb-4" />
        <div className="h-10 bg-muted rounded" />
      </div>
    );
  }

  const currentTier = loyalty?.currentTier || "poa";
  const tierInfo = LOYALTY_TIERS[currentTier];
  const { progress, pointsNeeded, nextTierName } = getProgressToNextTier(
    loyalty?.annualPoints || 0,
    currentTier
  );

  if (variant === "compact") {
    return (
      <Link to="/minha-conta/club">
        <div className="bg-gradient-to-r from-primary/5 to-accent/10 border border-accent/20 rounded-xl p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
                <Crown className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="font-medium">Le.Poá Club</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  <span className="font-semibold text-amber-700">{loyalty?.currentPoints || 0}</span>
                  <span>pontos</span>
                </div>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="bg-gradient-to-br from-card via-accent/5 to-card border border-accent/20 rounded-2xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
          <Crown className="h-6 w-6 text-accent" />
        </div>
        <div>
          <h3 className="font-serif text-lg">Le.Poá Club</h3>
          <p className="text-sm text-muted-foreground">
            Nível <span className="font-medium text-foreground">{tierInfo.name}</span>
          </p>
        </div>
      </div>

      {/* Points Display */}
      <div className="bg-card/80 rounded-xl p-4 mb-5 border border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Seus pontos</p>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
              <span className="font-serif text-2xl font-semibold text-amber-700">
                {loyalty?.currentPoints || 0}
              </span>
            </div>
          </div>
          {nextTierName && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Próximo nível</p>
              <p className="text-sm font-medium text-accent">{nextTierName}</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress to next tier */}
      {nextTierName && (
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-muted-foreground">Progresso para {nextTierName}</span>
            <span className="font-medium text-accent">{pointsNeeded} pts restantes</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* CTA */}
      <Link to="/minha-conta/club">
        <Button className="w-full gap-2" variant="outline">
          <Sparkles className="h-4 w-4" />
          Ver Recompensas
          <ChevronRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}
