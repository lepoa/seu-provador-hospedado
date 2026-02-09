import { useNavigate } from "react-router-dom";
import { CheckCircle, Star, Trophy, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLevelFromPoints } from "@/lib/quizDataV2";
import { Mission } from "@/lib/missionsData";

interface MissionCompletionScreenProps {
  mission: Mission;
  earnedPoints: number;
  totalPoints: number;
  previousLevel: number;
  newLevel: number;
  nextMissionId?: string | null;
  nextMissionName?: string | null;
}

export function MissionCompletionScreen({
  mission,
  earnedPoints,
  totalPoints,
  previousLevel,
  newLevel,
  nextMissionId,
  nextMissionName,
}: MissionCompletionScreenProps) {
  const navigate = useNavigate();
  const { title: levelTitle } = getLevelFromPoints(totalPoints);
  const leveledUp = newLevel > previousLevel;

  return (
    <div className="text-center animate-bounce-in">
      {/* Success Icon */}
      <div className="relative w-24 h-24 mx-auto mb-6">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
          <CheckCircle className="h-12 w-12 text-accent" />
        </div>
        {leveledUp && (
          <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center animate-bounce">
            <Trophy className="h-5 w-5 text-white" />
          </div>
        )}
      </div>

      {/* Title */}
      <h1 className="font-serif text-3xl mb-2">Missão Completa! 🎉</h1>
      <p className="text-muted-foreground mb-2">{mission.title}</p>
      
      {/* Message */}
      <div className="bg-accent/10 rounded-2xl p-4 mb-6 max-w-sm mx-auto">
        <p className="text-sm text-accent font-medium flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4" />
          Você desbloqueou sugestões mais certeiras ✨
        </p>
      </div>

      {/* Points Earned */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6 max-w-sm mx-auto">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Star className="h-6 w-6 text-amber-500 fill-amber-500" />
          <span className="text-2xl font-bold text-amber-700">+{earnedPoints} pts</span>
        </div>
        
        {leveledUp && (
          <div className="bg-amber-50 rounded-xl p-3 mb-4 border border-amber-200">
            <div className="flex items-center justify-center gap-2 text-amber-700">
              <Trophy className="h-5 w-5" />
              <span className="font-medium">Subiu para Nível {newLevel}!</span>
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Trophy className="h-4 w-4 text-accent" />
          <span>Nível {newLevel}: {levelTitle}</span>
          <span className="text-xs">({totalPoints} pts total)</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 max-w-sm mx-auto">
        <Button 
          onClick={() => navigate("/minhas-sugestoes")} 
          className="w-full gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Ver minhas sugestões atualizadas
        </Button>
        
        {nextMissionId && (
          <Button 
            variant="outline" 
            onClick={() => navigate(`/missao/${nextMissionId}`)} 
            className="w-full gap-2"
          >
            Fazer próxima missão
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        
        <Button 
          variant="ghost" 
          onClick={() => navigate("/minha-conta")} 
          className="w-full"
        >
          Voltar para Minha Conta
        </Button>
      </div>

      {/* Next Mission Preview */}
      {nextMissionId && nextMissionName && (
        <div className="mt-6 text-sm text-muted-foreground">
          <p>Próxima missão recomendada:</p>
          <p className="font-medium text-foreground">{nextMissionName}</p>
        </div>
      )}
    </div>
  );
}
