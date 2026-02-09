import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuizOptionCardProps {
  text: string;
  emoji?: string;
  imageUrl?: string;
  isSelected: boolean;
  onClick: () => void;
}

export function QuizOptionCard({ text, emoji, imageUrl, isSelected, onClick }: QuizOptionCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full p-4 rounded-xl border-2 transition-all duration-300 text-left group",
        "hover:border-accent/50 hover:bg-accent/5 hover:scale-[1.02] hover:shadow-md",
        "active:scale-[0.98]",
        isSelected 
          ? "border-accent bg-accent/10 shadow-lg ring-2 ring-accent/20" 
          : "border-border bg-card"
      )}
    >
      <div className="flex items-center gap-3">
        {emoji && (
          <span className={cn(
            "text-2xl flex-shrink-0 transition-transform duration-300",
            isSelected && "scale-110"
          )}>
            {emoji}
          </span>
        )}
        {imageUrl && (
          <img 
            src={imageUrl} 
            alt={text}
            className={cn(
              "w-12 h-12 object-cover rounded-lg flex-shrink-0 transition-all duration-300",
              isSelected && "ring-2 ring-accent"
            )}
          />
        )}
        <span className={cn(
          "font-medium flex-1 transition-colors duration-200",
          isSelected && "text-accent"
        )}>
          {text}
        </span>
        
        {isSelected ? (
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-md animate-bounce-in">
            <Check className="h-4 w-4 text-accent-foreground" />
          </div>
        ) : (
          <div className="flex-shrink-0 w-7 h-7 rounded-full border-2 border-muted-foreground/20 group-hover:border-accent/50 transition-colors" />
        )}
      </div>
      
      {/* Selection sparkle effect */}
      {isSelected && (
        <Sparkles className="absolute top-2 right-2 h-3 w-3 text-amber-500 animate-pulse" />
      )}
    </button>
  );
}
