import { Link } from "react-router-dom";
import { Clock, Star, CheckCircle2, Play, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MissionCardProps {
  id: string;
  title: string;
  description: string;
  points: number;
  questionCount?: number;
  estimatedTime?: string;
  status: "available" | "in_progress" | "completed";
  completedAt?: string;
}

export function MissionCard({
  id,
  title,
  description,
  points,
  questionCount,
  estimatedTime,
  status,
  completedAt,
}: MissionCardProps) {
  const isCompleted = status === "completed";
  const isInProgress = status === "in_progress";

  return (
    <div
      className={cn(
        "bg-card border rounded-xl p-4 transition-all",
        isCompleted && "opacity-75",
        !isCompleted && "hover:shadow-md hover:border-accent/30"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            isCompleted && "bg-success/10",
            isInProgress && "bg-amber-100",
            status === "available" && "bg-accent/10"
          )}
        >
          {isCompleted ? (
            <CheckCircle2 className="h-5 w-5 text-success" />
          ) : isInProgress ? (
            <Play className="h-5 w-5 text-amber-600" />
          ) : (
            <Star className="h-5 w-5 text-accent" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-sm">{title}</h3>
            {!isCompleted && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                +{points} pts
              </span>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
            {description}
          </p>

          {/* Meta info */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            {questionCount && (
              <span>{questionCount} perguntas</span>
            )}
            {estimatedTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {estimatedTime}
              </span>
            )}
            {isCompleted && completedAt && (
              <span className="text-success">
                Concluída em {new Date(completedAt).toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
        </div>

        {/* Action */}
        {!isCompleted && (
          <Link to={`/missao/${id}`}>
            <Button
              size="sm"
              variant={isInProgress ? "default" : "outline"}
              className="gap-1 shrink-0"
            >
              {isInProgress ? "Continuar" : "Iniciar"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
