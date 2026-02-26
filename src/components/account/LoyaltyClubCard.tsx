import { Link } from "react-router-dom";
import { ChevronRight, Crown, Sparkles, Star } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { LOYALTY_TIERS, useLoyalty } from "@/hooks/useLoyalty";

interface LoyaltyClubCardProps {
  variant?: "compact" | "full";
}

export function LoyaltyClubCard({ variant = "full" }: LoyaltyClubCardProps) {
  const { loyalty, getProgressToNextTier, isLoading } = useLoyalty();

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-2xl border border-[#ccb487]/45 bg-gradient-to-br from-[#fffaf0] via-[#f8efdd] to-[#f3e7cf] p-6">
        <div className="mb-4 h-6 w-32 rounded bg-[#e3d3b3]" />
        <div className="mb-4 h-8 w-24 rounded bg-[#e3d3b3]" />
        <div className="mb-4 h-2 rounded bg-[#e3d3b3]" />
        <div className="h-10 rounded bg-[#e3d3b3]" />
      </div>
    );
  }

  const currentTier = loyalty?.currentTier || "poa";
  const tierInfo = LOYALTY_TIERS[currentTier];
  const { progress, pointsNeeded, nextTierName } = getProgressToNextTier(loyalty?.annualPoints || 0, currentTier);

  if (variant === "compact") {
    return (
      <Link to="/minha-conta/club">
        <div className="rounded-xl border border-[#cbb488] bg-gradient-to-r from-[#fffaf0] to-[#f4e8d1] p-4 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#dcc295]/55 to-[#ceb078]/45">
                <Crown className="h-5 w-5 text-[#8a672d]" />
              </div>
              <div>
                <p className="font-medium text-[#1f1d1a]">Le.Poá Club</p>
                <div className="flex items-center gap-2 text-sm text-[#6f6759]">
                  <Star className="h-3.5 w-3.5 fill-[#b48a3f] text-[#b48a3f]" />
                  <span className="font-semibold text-[#8a672d]">{loyalty?.currentPoints || 0}</span>
                  <span>pontos</span>
                </div>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-[#6f6759]" />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-[#ccb487]/45 bg-gradient-to-br from-[#fffaf0] via-[#f8efdd] to-[#f3e7cf] p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#dcc295]/55 to-[#ceb078]/45">
          <Crown className="h-6 w-6 text-[#8a672d]" />
        </div>
        <div>
          <h3 className="font-serif text-lg text-[#1f1d1a]">Le.Poá Club</h3>
          <p className="text-sm text-[#6f6759]">
            Nível <span className="font-medium text-[#1f1d1a]">{tierInfo.name}</span>
          </p>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-[#d8c5a2] bg-[#fffaf0] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="mb-1 text-sm text-[#6f6759]">Seus pontos</p>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 fill-[#b48a3f] text-[#b48a3f]" />
              <span className="font-serif text-2xl font-semibold text-[#8a672d]">{loyalty?.currentPoints || 0}</span>
            </div>
          </div>
          {nextTierName && (
            <div className="text-right">
              <p className="text-xs text-[#6f6759]">Próximo nível</p>
              <p className="text-sm font-medium text-[#8a672d]">{nextTierName}</p>
            </div>
          )}
        </div>
      </div>

      {nextTierName && (
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-[#6f6759]">Progresso para {nextTierName}</span>
            <span className="font-medium text-[#8a672d]">{pointsNeeded} pts restantes</span>
          </div>
          <Progress value={progress} className="h-2 bg-[#e8dcc4]" />
        </div>
      )}

      <Link to="/minha-conta/club">
        <Button
          className="w-full gap-2 border-[#c3a163] bg-[#fff4df] text-[#2f2a22] hover:bg-[#f4e6ca]"
          variant="outline"
        >
          <Sparkles className="h-4 w-4" />
          Ver Recompensas
          <ChevronRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}
