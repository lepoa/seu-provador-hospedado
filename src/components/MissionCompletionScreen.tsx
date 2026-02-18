import { useNavigate } from "react-router-dom";
import { CheckCircle, ArrowRight } from "lucide-react";
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
    <div className="text-center animate-fade-in">
      {/* Success Icon */}
      <div className="w-16 h-16 mx-auto mb-8 border border-foreground/10 rounded-full flex items-center justify-center">
        <CheckCircle className="h-7 w-7 text-foreground/40" />
      </div>

      {/* Title */}
      <h1 className="font-serif text-3xl mb-2">Módulo concluído</h1>
      <p className="text-foreground/50 font-light mb-8">{mission.title}</p>

      {/* Message */}
      <div className="border border-foreground/10 p-5 mb-8 max-w-sm mx-auto">
        <p className="text-sm text-foreground/60 font-light">
          Suas sugestões de estilo foram refinadas com base nas suas respostas.
        </p>
      </div>

      {/* Points Info */}
      <div className="border border-foreground/10 p-6 mb-8 max-w-sm mx-auto">
        <p className="text-[11px] tracking-[0.2em] uppercase text-foreground/40 mb-3">Pontos conquistados</p>
        <p className="text-2xl font-light text-foreground">+{earnedPoints}</p>

        {leveledUp && (
          <div className="border-t border-foreground/10 mt-4 pt-4">
            <p className="text-sm text-foreground/60">
              Você subiu para <span className="font-medium text-foreground">{levelTitle}</span>
            </p>
          </div>
        )}

        <p className="text-[11px] text-foreground/30 mt-3 tracking-wide">
          {levelTitle} — {totalPoints} pontos acumulados
        </p>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 max-w-sm mx-auto">
        <button
          onClick={() => navigate("/minhas-sugestoes")}
          className="w-full py-3.5 bg-foreground text-background text-xs tracking-[0.2em] uppercase font-medium transition-all duration-300 hover:bg-accent"
        >
          Ver minhas sugestões atualizadas
        </button>

        {nextMissionId && (
          <button
            onClick={() => navigate(`/missao/${nextMissionId}`)}
            className="w-full py-3.5 border border-foreground/20 text-xs tracking-[0.2em] uppercase font-medium text-foreground/60 transition-all duration-300 hover:border-foreground hover:text-foreground flex items-center justify-center gap-2"
          >
            Próximo módulo
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          onClick={() => navigate("/minha-conta")}
          className="w-full py-3 text-xs tracking-[0.15em] uppercase text-foreground/40 hover:text-foreground/60 transition-colors"
        >
          Voltar para minha conta
        </button>
      </div>

      {/* Next Mission Preview */}
      {nextMissionId && nextMissionName && (
        <div className="mt-8 text-[11px] text-foreground/30 tracking-wide">
          <p>Próximo módulo recomendado:</p>
          <p className="font-medium text-foreground/50 mt-0.5">{nextMissionName}</p>
        </div>
      )}
    </div>
  );
}
