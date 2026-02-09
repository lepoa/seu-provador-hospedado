import { Link } from "react-router-dom";
import { Star, Trophy, Sparkles, ArrowRight, Target, Clock, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getLevelFromPoints, LEVEL_THRESHOLDS } from "@/lib/quizDataV2";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface VipProgressSectionProps {
  quizPoints: number;
  quizLevel: number;
  hasCompletedQuiz: boolean;
  lastMissionId?: string | null;
  lastMissionName?: string | null;
  lastMissionCompletedAt?: string | null;
  nextMissionId?: string | null;
  nextMissionName?: string | null;
  inProgressMissionId?: string | null;
}

export function VipProgressSection({
  quizPoints,
  quizLevel,
  hasCompletedQuiz,
  lastMissionId,
  lastMissionName,
  lastMissionCompletedAt,
  nextMissionId,
  nextMissionName,
  inProgressMissionId,
}: VipProgressSectionProps) {
  const { level, title } = getLevelFromPoints(quizPoints);
  
  // Calculate progress to next level
  const currentLevelThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextLevelThreshold = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const pointsInCurrentLevel = quizPoints - currentLevelThreshold;
  const pointsNeededForNextLevel = nextLevelThreshold - currentLevelThreshold;
  const progressPercent = Math.min((pointsInCurrentLevel / pointsNeededForNextLevel) * 100, 100);
  const isMaxLevel = level >= LEVEL_THRESHOLDS.length;

  // Format last completed date
  const formatLastCompleted = () => {
    if (!lastMissionCompletedAt) return null;
    const date = new Date(lastMissionCompletedAt);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return `${diffDays} dias atrás`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  return (
    <div className="bg-gradient-to-br from-accent/5 via-primary/5 to-accent/10 border border-accent/20 rounded-2xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-accent" />
        <h2 className="font-serif text-lg">Seu Progresso VIP</h2>
      </div>

      {/* Level and Points Display */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-accent/10 px-3 py-1.5 rounded-full">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            <span className="font-bold text-amber-700">{quizPoints} pts</span>
          </div>
        </div>
        <div className="text-sm text-right">
          <span className="text-muted-foreground">Nível {level}: </span>
          <span className="font-medium text-accent">{title}</span>
        </div>
      </div>

      {/* Progress Bar to Next Level */}
      {!isMaxLevel && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Progresso para Nível {level + 1}</span>
            <span>{nextLevelThreshold - quizPoints} pts restantes</span>
          </div>
          <Progress 
            value={progressPercent} 
            className="h-2 bg-secondary"
          />
        </div>
      )}

      {isMaxLevel && (
        <div className="flex items-center gap-2 text-sm text-accent mb-4">
          <CheckCircle2 className="h-4 w-4" />
          <span className="font-medium">Nível máximo alcançado! 🏆</span>
        </div>
      )}

      {/* Primary CTA */}
      <div className="mb-4">
        {!hasCompletedQuiz ? (
          <Link to="/quiz">
            <Button className="w-full gap-2 bg-accent hover:bg-accent/90">
              <Sparkles className="h-4 w-4" />
              Fazer Quiz Base
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        ) : inProgressMissionId ? (
          <Link to={`/missao/${inProgressMissionId}`}>
            <Button className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white">
              <Clock className="h-4 w-4" />
              Continuar de onde parei
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        ) : nextMissionId ? (
          <Link to={`/missao/${nextMissionId}`}>
            <Button className="w-full gap-2">
              <Target className="h-4 w-4" />
              Continuar Trilhas
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        ) : (
          <div className="text-center text-sm text-muted-foreground bg-card/50 rounded-xl p-3">
            <CheckCircle2 className="h-5 w-5 text-accent mx-auto mb-1" />
            Todas as missões completadas! 🎉
          </div>
        )}
      </div>

      {/* Last and Next Mission Info */}
      {hasCompletedQuiz && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          {lastMissionName && (
            <div className="bg-card/50 rounded-xl p-3">
              <p className="text-muted-foreground mb-0.5">Última missão</p>
              <p className="font-medium truncate">{lastMissionName}</p>
              {lastMissionCompletedAt && (
                <p className="text-muted-foreground text-[10px]">{formatLastCompleted()}</p>
              )}
            </div>
          )}
          {nextMissionName && !inProgressMissionId && (
            <div className="bg-card/50 rounded-xl p-3">
              <p className="text-muted-foreground mb-0.5">Próxima sugerida</p>
              <p className="font-medium truncate">{nextMissionName}</p>
            </div>
          )}
        </div>
      )}

      {/* Redo Quiz Option */}
      {hasCompletedQuiz && (
        <div className="mt-4 pt-4 border-t border-border/50">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-muted-foreground hover:text-foreground gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Refazer Quiz de Estilo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Refazer Quiz de Estilo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Você pode refazer o quiz para atualizar seu perfil de estilo. 
                  <span className="block mt-2 font-medium text-foreground">
                    Seus pontos serão mantidos — não serão somados novamente por respostas já dadas.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Link to="/quiz?redo=true">
                    <Button>Refazer Quiz</Button>
                  </Link>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
