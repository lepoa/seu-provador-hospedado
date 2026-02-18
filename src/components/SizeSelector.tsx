import { cn } from "@/lib/utils";

interface SizeSelectorProps {
  selectedLetterSize: string | null;
  selectedNumberSize: string | null;
  onSelectLetter: (size: string | null) => void;
  onSelectNumber: (size: string | null) => void;
}

const LETTER_SIZES = ["PP", "P", "M", "G", "GG"];
const NUMBER_SIZES = ["34", "36", "38", "40", "42", "44", "46"];

export function SizeSelector({
  selectedLetterSize,
  selectedNumberSize,
  onSelectLetter,
  onSelectNumber
}: SizeSelectorProps) {
  const handleLetterClick = (size: string) => {
    onSelectLetter(selectedLetterSize === size ? null : size);
  };

  const handleNumberClick = (size: string) => {
    onSelectNumber(selectedNumberSize === size ? null : size);
  };

  return (
    <div className="space-y-8">
      {/* Letter Sizes */}
      <div>
        <p className="text-[11px] tracking-[0.15em] uppercase text-foreground/40 font-medium mb-4">
          Tamanho em letras <span className="text-foreground/60">(opcional)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {LETTER_SIZES.map((size, index) => (
            <button
              key={size}
              onClick={() => handleLetterClick(size)}
              style={{ animationDelay: `${index * 50}ms` }}
              className={cn(
                "w-14 h-14 border font-light tracking-wide text-sm transition-all duration-300 animate-slide-in-up",
                "hover:border-foreground/40",
                selectedLetterSize === size
                  ? "border-foreground bg-foreground text-background font-normal"
                  : "border-border bg-transparent text-foreground/60"
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Number Sizes */}
      <div>
        <p className="text-[11px] tracking-[0.15em] uppercase text-foreground/40 font-medium mb-4">
          Numeração <span className="text-foreground/60">(opcional)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {NUMBER_SIZES.map((size, index) => (
            <button
              key={size}
              onClick={() => handleNumberClick(size)}
              style={{ animationDelay: `${(index + 5) * 50}ms` }}
              className={cn(
                "w-14 h-14 border font-light tracking-wide text-sm transition-all duration-300 animate-slide-in-up",
                "hover:border-foreground/40",
                selectedNumberSize === size
                  ? "border-foreground bg-foreground text-background font-normal"
                  : "border-border bg-transparent text-foreground/60"
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      {(selectedLetterSize || selectedNumberSize) && (
        <div className="border-t border-border pt-4">
          <p className="text-sm text-foreground/70 text-center font-light">
            {selectedLetterSize && selectedNumberSize ? (
              <>Seus tamanhos: <span className="font-medium text-foreground">{selectedLetterSize}</span> e <span className="font-medium text-foreground">{selectedNumberSize}</span></>
            ) : selectedLetterSize ? (
              <>Seu tamanho: <span className="font-medium text-foreground">{selectedLetterSize}</span></>
            ) : (
              <>Sua numeração: <span className="font-medium text-foreground">{selectedNumberSize}</span></>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
