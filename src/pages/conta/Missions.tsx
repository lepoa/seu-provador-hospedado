import { useEffect, useState } from "react";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { useAuth } from "@/hooks/useAuth";
import { useLoyalty } from "@/hooks/useLoyalty";
import { supabase } from "@/integrations/supabase/client";
import { getAvailableMissions, getMissionById } from "@/lib/missionsData";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getLevelFromPoints } from "@/lib/quizDataV2";

interface MissionAttempt {
  mission_id: string;
  status: string;
  completed_at: string | null;
}

export default function Missions() {
  const { user } = useAuth();
  const { loyalty, monthlyMissionLimit, getMissionPointsRemaining } = useLoyalty();
  const [attempts, setAttempts] = useState<MissionAttempt[]>([]);
  const [completedMissions, setCompletedMissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      Promise.all([
        supabase
          .from("mission_attempts")
          .select("mission_id, status, completed_at")
          .eq("user_id", user.id),
        supabase
          .from("profiles")
          .select("completed_missions")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]).then(([attemptsRes, profileRes]) => {
        setAttempts(attemptsRes.data || []);
        setCompletedMissions((profileRes.data?.completed_missions as string[]) || []);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading) {
    return (
      <AccountLayout title="Módulos de Estilo" showBackButton>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-foreground/20" />
        </div>
      </AccountLayout>
    );
  }

  const availableMissions = getAvailableMissions(completedMissions);
  const totalPoints = loyalty?.currentPoints || 0;
  const monthlyPoints = loyalty?.weeklyMissionPoints || 0;
  const monthlyRemaining = getMissionPointsRemaining(monthlyPoints);

  // Group missions by status
  const inProgress = attempts.filter((a) => a.status === "in_progress");
  const completed = completedMissions.map((id) => {
    const attempt = attempts.find((a) => a.mission_id === id && a.status === "completed");
    return { id, completedAt: attempt?.completed_at };
  });

  return (
    <AccountLayout title="Módulos de Estilo" showBackButton>
      {/* Total Points Display */}
      <div className="border border-foreground/10 p-5 mb-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase text-foreground/40 font-medium mb-1">
              Seus pontos no Le.Poá Club
            </p>
            <p className="text-3xl font-light text-foreground">{totalPoints.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-foreground/40 tracking-wide">
              {loyalty?.currentTier === "poa" ? "Poá" :
                loyalty?.currentTier === "poa_gold" ? "Poá Gold" :
                  loyalty?.currentTier === "poa_platinum" ? "Poá Platinum" :
                    loyalty?.currentTier === "poa_black" ? "Poá Black" : "Poá"}
            </p>
          </div>
        </div>
      </div>

      {/* Monthly Mission Progress */}
      <div className="border border-foreground/10 p-4 mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] tracking-[0.15em] uppercase text-foreground/40 font-medium">
            Progresso mensal de módulos
          </p>
          <span className="text-[11px] text-foreground/40">
            {monthlyRemaining} pts restantes
          </span>
        </div>
        <div className="h-px bg-border relative">
          <div
            className="h-px bg-foreground transition-all duration-700"
            style={{ width: `${(monthlyPoints / monthlyMissionLimit) * 100}%` }}
          />
        </div>
        <p className="text-[11px] text-foreground/30 mt-2">
          {monthlyPoints} / {monthlyMissionLimit} Poás este mês
        </p>
      </div>

      {/* In Progress */}
      {inProgress.length > 0 && (
        <div className="mb-8">
          <h2 className="text-[11px] tracking-[0.2em] uppercase text-foreground/40 font-medium mb-4">
            Em andamento
          </h2>
          <div className="space-y-3">
            {inProgress.map((attempt) => {
              const mission = getMissionById(attempt.mission_id);
              if (!mission) return null;
              return (
                <EditorialMissionCard
                  key={attempt.mission_id}
                  id={mission.id}
                  title={mission.title}
                  description={mission.subtitle}
                  questionCount={mission.questions?.length}
                  status="in_progress"
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Available */}
      {availableMissions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-[11px] tracking-[0.2em] uppercase text-foreground/40 font-medium mb-4">
            Disponíveis
          </h2>
          <div className="space-y-3">
            {availableMissions.map((mission) => (
              <EditorialMissionCard
                key={mission.id}
                id={mission.id}
                title={mission.title}
                description={mission.subtitle}
                questionCount={mission.questions?.length}
                status="available"
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-[11px] tracking-[0.2em] uppercase text-foreground/40 font-medium mb-4">
            Concluídos
          </h2>
          <div className="space-y-3">
            {completed.map(({ id, completedAt }) => {
              const mission = getMissionById(id);
              if (!mission) return null;
              return (
                <EditorialMissionCard
                  key={id}
                  id={mission.id}
                  title={mission.title}
                  description={mission.subtitle}
                  status="completed"
                  completedAt={completedAt || undefined}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {availableMissions.length === 0 && inProgress.length === 0 && completed.length === 0 && (
        <div className="text-center py-16">
          <p className="text-foreground/40 text-sm font-light">
            Faça o quiz de estilo primeiro para desbloquear módulos
          </p>
        </div>
      )}
    </AccountLayout>
  );
}

// Editorial-style mission card (replaces MissionCard import)
function EditorialMissionCard({
  id,
  title,
  description,
  questionCount,
  status,
  completedAt,
}: {
  id: string;
  title: string;
  description: string;
  questionCount?: number;
  status: "available" | "in_progress" | "completed";
  completedAt?: string;
}) {
  const isCompleted = status === "completed";

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
            <h3
              className={cn(
                "text-sm tracking-wide",
                isCompleted ? "text-foreground/50" : "font-medium"
              )}
            >
              {title}
            </h3>
            {isCompleted && (
              <CheckCircle2 className="h-3.5 w-3.5 text-foreground/30 shrink-0" />
            )}
          </div>
          <p className="text-[12px] text-foreground/40 font-light">{description}</p>
          <div className="flex items-center gap-3 mt-1.5">
            {questionCount && (
              <span className="text-[11px] text-foreground/30 tracking-wide">
                {questionCount} perguntas
              </span>
            )}
            {isCompleted && completedAt && (
              <span className="text-[11px] text-foreground/30">
                Concluído em {new Date(completedAt).toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0">
          {isCompleted ? (
            <span className="text-[11px] tracking-[0.15em] uppercase text-foreground/30 font-medium">
              Concluído
            </span>
          ) : (
            <Link to={`/missao/${id}`}>
              <button className="px-5 py-2.5 border border-foreground/20 text-[11px] tracking-[0.15em] uppercase font-medium text-foreground/60 transition-all duration-300 hover:border-foreground hover:text-foreground flex items-center gap-2">
                {status === "in_progress" ? "Continuar" : "Iniciar"}
                <ArrowRight className="h-3 w-3" />
              </button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
