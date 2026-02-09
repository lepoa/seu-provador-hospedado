import { Star, Trophy, Zap, Sparkles } from "lucide-react";
import { getLevelFromPoints } from "@/lib/quizDataV2";
import { cn } from "@/lib/utils";

interface QuizProgressV2Props {
  current: number;
  total: number;
  points: number;
  pointsJustEarned?: number;
}

export function QuizProgressV2({ current, total, points, pointsJustEarned }: QuizProgressV2Props) {
  const percentage = (current / total) * 100;
  const { level, title, nextLevel, minPoints } = getLevelFromPoints(points);
  
  // Calculate progress within current level
  const pointsInLevel = points - minPoints;
  const levelRange = nextLevel - minPoints;
  const levelProgress = Math.min((pointsInLevel / levelRange) * 100, 100);

  return (
    <div className="w-full space-y-4">
      {/* Quiz Title */}
      <div className="text-center mb-2">
        <h1 className="font-serif text-lg text-foreground flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          Seu Provador VIP em 2 minutos
        </h1>
        <p className="text-xs text-muted-foreground">
          Descubra seu estilo e receba sugestões no seu tamanho ✨
        </p>
      </div>

      {/* Points Display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-amber-400/10 px-3 py-1.5 rounded-full border border-amber-500/30",
            pointsJustEarned && pointsJustEarned > 0 && "animate-glow-pulse"
          )}>
            <Star className={cn(
              "h-4 w-4 text-amber-500 fill-amber-500",
              pointsJustEarned && pointsJustEarned > 0 && "animate-bounce"
            )} />
            <span className="font-bold text-amber-700">{points}</span>
            {pointsJustEarned && pointsJustEarned > 0 && (
              <span className="text-xs text-amber-600 font-bold flex items-center gap-0.5 animate-bounce-in">
                <Zap className="h-3 w-3" />
                +{pointsJustEarned}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium">Nível {level}</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">• {title}</span>
        </div>
      </div>

      {/* Level Progress */}
      <div className="relative">
        <div className="h-2.5 bg-secondary rounded-full overflow-hidden shadow-inner">
          <div 
            className="h-full bg-gradient-to-r from-accent via-primary to-accent transition-all duration-700 ease-out relative"
            style={{ width: `${levelProgress}%` }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
          </div>
        </div>
        <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-accent/50" />
            Pergunta {current}/{total}
          </span>
          <span className="font-medium">{points}/{nextLevel} pts para Nível {level + 1}</span>
        </div>
      </div>
    </div>
  );
}
