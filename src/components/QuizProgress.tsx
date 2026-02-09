interface QuizProgressProps {
  current: number;
  total: number;
}

export function QuizProgress({ current, total }: QuizProgressProps) {
  const percentage = (current / total) * 100;

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Pergunta {current} de {total}</span>
        <span className="font-medium">{Math.round(percentage)}%</span>
      </div>
      <div className="progress-quiz">
        <div 
          className="progress-quiz-bar"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
