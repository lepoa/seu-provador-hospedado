import { Link } from "react-router-dom";
import { Star, Trophy, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mission, getAvailableMissions, MISSION_POINTS, getMissionTotalPoints } from "@/lib/missionsData";
import { cn } from "@/lib/utils";

interface MissionsListProps {
  completedMissions: string[];
  currentPoints: number;
  currentLevel: number;
}

export function MissionsList({ completedMissions, currentPoints, currentLevel }: MissionsListProps) {
  const availableMissions = getAvailableMissions(completedMissions);
  const allMissions = [...getAvailableMissions([])]; // Get all missions for display
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl">Missões Disponíveis</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Trophy className="h-4 w-4 text-accent" />
          <span>Nível {currentLevel}</span>
          <span>•</span>
          <Star className="h-4 w-4 text-amber-500" />
          <span>{currentPoints} pts</span>
        </div>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Complete missões para ganhar mais pontos e refinar suas sugestões de estilo.
      </p>

      <div className="grid gap-4">
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
        <div className="text-center py-8 bg-card border border-border rounded-xl">
          <CheckCircle2 className="h-12 w-12 text-accent mx-auto mb-3" />
          <p className="font-medium">Todas as missões completadas! 🎉</p>
          <p className="text-sm text-muted-foreground mt-1">
            Novas missões em breve...
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
  const totalPossiblePoints = getMissionTotalPoints(mission);
  const questionCount = mission.questions.length;

  return (
    <div 
      className={cn(
        "bg-card border rounded-xl p-4 transition-all",
        isCompleted 
          ? "border-accent/30 bg-accent/5" 
          : "border-border hover:border-accent/50 hover:shadow-md"
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0",
          isCompleted ? "bg-accent/10" : "bg-secondary"
        )}>
          {mission.emoji}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium">{mission.title}</h4>
            {isCompleted && (
              <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-1">
            {mission.subtitle}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
            <span className="flex items-center gap-1 text-amber-600 font-medium">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              até +{totalPossiblePoints} pts
            </span>
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {questionCount} perguntas + fotos
            </span>
          </div>
        </div>

        <div className="shrink-0">
          {isCompleted ? (
            <div className="text-xs text-accent font-medium px-3 py-1.5 bg-accent/10 rounded-full">
              Concluída
            </div>
          ) : (
            <Link to={`/missao/${mission.id}`}>
              <Button size="sm" variant="outline" className="gap-1">
                Iniciar
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}