import { cn } from "@/lib/utils";

interface QuizProgressV2Props {
  current: number;
  total: number;
  points: number;
  pointsJustEarned?: number;
}

export function QuizProgressV2({ current, total }: QuizProgressV2Props) {
  const percentage = (current / total) * 100;

  return (
    <div className="w-full space-y-5">
      {/* Quiz Title */}
      <div className="text-center">
        <p className="text-[10px] tracking-[0.3em] uppercase text-foreground/40 font-medium">
          Sua consultoria de estilo
        </p>
      </div>

      {/* Minimal Progress */}
      <div>
        <div className="h-px bg-border relative">
          <div
            className="h-px bg-foreground transition-all duration-700 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex justify-between mt-2.5">
          <span className="text-[11px] text-foreground/40 tracking-wide">
            {current} de {total}
          </span>
          <span className="text-[11px] text-foreground/40 tracking-wide">
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
    </div>
  );
}
