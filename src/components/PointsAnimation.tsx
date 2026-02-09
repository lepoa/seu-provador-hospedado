import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface PointsAnimationProps {
  points: number;
  show: boolean;
  onComplete?: () => void;
}

export function PointsAnimation({ points, show, onComplete }: PointsAnimationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    if (show && points > 0) {
      setIsVisible(true);
      // Staggered animation
      requestAnimationFrame(() => {
        setScale(1);
      });
      
      const timer = setTimeout(() => {
        setScale(0);
        setTimeout(() => {
          setIsVisible(false);
          onComplete?.();
        }, 300);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [show, points, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 right-4 pointer-events-none z-40">
      <div 
        className={cn(
          "transition-all duration-300 ease-out",
          scale === 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        <div className="bg-stone-900/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg border border-stone-700">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-white">
              +{points} pontos
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
