import { useEffect, useState } from "react";
import { Star, Target, Loader2 } from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { MissionCard } from "@/components/account/MissionCard";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useLoyalty } from "@/hooks/useLoyalty";
import { supabase } from "@/integrations/supabase/client";
import { getAvailableMissions, getMissionById } from "@/lib/missionsData";

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
      <AccountLayout title="Missões">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AccountLayout>
    );
  }

  const availableMissions = getAvailableMissions(completedMissions);
  const monthlyPoints = loyalty?.weeklyMissionPoints || 0; // reusing field for monthly
  const monthlyRemaining = getMissionPointsRemaining(monthlyPoints);
  const monthlyProgress = (monthlyPoints / monthlyMissionLimit) * 100;

  // Group missions by status
  const inProgress = attempts.filter((a) => a.status === "in_progress");
  const completed = completedMissions.map((id) => {
    const attempt = attempts.find((a) => a.mission_id === id && a.status === "completed");
    return { id, completedAt: attempt?.completed_at };
  });

  return (
    <AccountLayout title="Missões" showBackButton>
      {/* Monthly Progress Card */}
      <div className="bg-gradient-to-br from-accent/5 to-card border border-accent/20 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <Target className="h-5 w-5 text-accent" />
          <span className="font-medium text-sm">Progresso Mensal</span>
        </div>
        <div className="flex items-center justify-between text-sm mb-2">
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            <span className="font-semibold text-amber-700">{monthlyPoints}</span>
            <span className="text-muted-foreground">/ {monthlyMissionLimit} Poás</span>
          </div>
          <span className="text-xs text-muted-foreground">{monthlyRemaining} restantes</span>
        </div>
        <Progress value={monthlyProgress} className="h-2" />
      </div>

      {/* In Progress */}
      {inProgress.length > 0 && (
        <div className="mb-6">
          <h2 className="font-medium text-sm mb-3 text-amber-700">Em andamento</h2>
          <div className="space-y-3">
            {inProgress.map((attempt) => {
              const mission = getMissionById(attempt.mission_id);
              if (!mission) return null;
              return (
                <MissionCard
                  key={attempt.mission_id}
                  id={mission.id}
                  title={mission.title}
                  description={mission.subtitle}
                  points={mission.pointsReward}
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
        <div className="mb-6">
          <h2 className="font-medium text-sm mb-3">Disponíveis</h2>
          <div className="space-y-3">
            {availableMissions.map((mission) => (
              <MissionCard
                key={mission.id}
                id={mission.id}
                title={mission.title}
                description={mission.subtitle}
                points={mission.pointsReward}
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
          <h2 className="font-medium text-sm mb-3 text-muted-foreground">Concluídas</h2>
          <div className="space-y-3">
            {completed.map(({ id, completedAt }) => {
              const mission = getMissionById(id);
              if (!mission) return null;
              return (
                <MissionCard
                  key={id}
                  id={mission.id}
                  title={mission.title}
                  description={mission.subtitle}
                  points={mission.pointsReward}
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
        <div className="text-center py-12 text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Faça o quiz de estilo primeiro para desbloquear missões!</p>
        </div>
      )}
    </AccountLayout>
  );
}
