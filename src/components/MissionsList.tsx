import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Mission, getAvailableMissions, getMissionTotalPoints } from "@/lib/missionsData";
import { cn } from "@/lib/utils";

interface MissionsListProps {
  completedMissions: string[];
  currentPoints: number;
  currentLevel: number;
}

export function MissionsList({ completedMissions, currentPoints, currentLevel }: MissionsListProps) {
  const availableMissions = getAvailableMissions(completedMissions);
  const allMissions = [...getAvailableMissions([])];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h3 className="font-serif text-xl">Aprofunde seu perfil</h3>
        <span className="text-[11px] tracking-[0.15em] uppercase text-foreground/40">
          {completedMissions.length} de {allMissions.length} concluídas
        </span>
      </div>

      <p className="text-sm text-foreground/50 font-light leading-relaxed">
        Cada módulo refina sua curadoria em uma área específica — quanto mais eu te conhecer, melhores serão as sugestões.
      </p>

      <div className="grid gap-3">
        {allMissions.map((mission) => {
          const isCompleted = completedMissions.includes(mission.id);

          return (
            <MissionCard
              key={mission.id}
              mission={mission}
              isCompleted={isCompleted}
            />
          );
        })}
      </div>

      {availableMissions.length === 0 && (
        <div className="text-center py-10 border border-border">
          <CheckCircle2 className="h-8 w-8 text-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-light text-foreground/60">Todos os módulos concluídos</p>
          <p className="text-[11px] text-foreground/40 mt-1 tracking-wide">
            Novos módulos em breve
          </p>
        </div>
      )}
    </div>
  );
}

interface MissionCardProps {
  mission: Mission;
  isCompleted: boolean;
}

function MissionCard({ mission, isCompleted }: MissionCardProps) {
  const questionCount = mission.questions.length;

  return (
    <div
      className={cn(
        "border p-5 transition-all duration-300",
        isCompleted
          ? "border-foreground/10 bg-foreground/[0.02]"
          : "border-border hover:border-foreground/30"
      )}
    >
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={cn(
              "text-sm tracking-wide",
              isCompleted ? "text-foreground/50" : "font-medium"
            )}>{mission.title}</h4>
            {isCompleted && (
              <CheckCircle2 className="h-3.5 w-3.5 text-foreground/30 shrink-0" />
            )}
          </div>
          <p className="text-[12px] text-foreground/40 font-light">
            {mission.subtitle}
          </p>
          <p className="text-[11px] text-foreground/30 mt-1.5 tracking-wide">
            {questionCount} perguntas + referências visuais
          </p>
        </div>

        <div className="shrink-0">
          {isCompleted ? (
            <span className="text-[11px] tracking-[0.15em] uppercase text-foreground/30 font-medium">
              Concluída
            </span>
          ) : (
            <Link to={`/missao/${mission.id}`}>
              <button className="px-5 py-2.5 border border-foreground/20 text-[11px] tracking-[0.15em] uppercase font-medium text-foreground/60 transition-all duration-300 hover:border-foreground hover:text-foreground flex items-center gap-2">
                Iniciar
                <ArrowRight className="h-3 w-3" />
              </button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}