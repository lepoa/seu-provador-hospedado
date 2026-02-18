import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuizOptionCardProps {
  text: string;
  emoji?: string;
  imageUrl?: string;
  isSelected: boolean;
  onClick: () => void;
}

export function QuizOptionCard({ text, imageUrl, isSelected, onClick }: QuizOptionCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-full py-5 px-6 border transition-all duration-500 text-left group",
        "hover:border-foreground/40",
        "active:scale-[0.99]",
        isSelected
          ? "border-foreground bg-foreground/[0.03]"
          : "border-border bg-transparent"
      )}
    >
      <div className="flex items-center gap-4">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={text}
            className={cn(
              "w-12 h-12 object-cover flex-shrink-0 transition-all duration-300",
              isSelected && "ring-1 ring-foreground"
            )}
          />
        )}

        <span className={cn(
          "font-light text-base flex-1 transition-colors duration-300 tracking-wide",
          isSelected ? "text-foreground font-normal" : "text-foreground/70"
        )}>
          {text}
        </span>

        {isSelected ? (
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-foreground flex items-center justify-center">
            <Check className="h-3.5 w-3.5 text-background" strokeWidth={2.5} />
          </div>
        ) : (
          <div className="flex-shrink-0 w-6 h-6 rounded-full border border-foreground/20 group-hover:border-foreground/40 transition-colors duration-300" />
        )}
      </div>
    </button>
  );
}
