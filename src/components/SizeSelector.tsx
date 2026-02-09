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
    <div className="space-y-6">
      {/* Letter Sizes */}
      <div>
        <p className="text-sm text-muted-foreground mb-3">
          Tamanho em letras <span className="text-foreground font-medium">(opcional)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {LETTER_SIZES.map((size, index) => (
            <button
              key={size}
              onClick={() => handleLetterClick(size)}
              style={{ animationDelay: `${index * 50}ms` }}
              className={cn(
                "w-14 h-14 rounded-xl border-2 font-medium transition-all duration-300 animate-slide-in-up",
                "hover:border-accent/50 hover:bg-accent/5 hover:scale-105",
                "active:scale-95",
                selectedLetterSize === size
                  ? "border-accent bg-accent text-accent-foreground shadow-lg ring-2 ring-accent/20"
                  : "border-border bg-card"
              )}
            >
              {size}
            </button>
          ))}
        </div>
        {selectedLetterSize && (
          <p className="text-xs text-accent mt-2 flex items-center gap-1 animate-fade-in">
            <span>✓</span> Selecionado: <span className="font-bold">{selectedLetterSize}</span>
          </p>
        )}
      </div>

      {/* Number Sizes */}
      <div>
        <p className="text-sm text-muted-foreground mb-3">
          Numeração <span className="text-foreground font-medium">(opcional)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {NUMBER_SIZES.map((size, index) => (
            <button
              key={size}
              onClick={() => handleNumberClick(size)}
              style={{ animationDelay: `${(index + 5) * 50}ms` }}
              className={cn(
                "w-14 h-14 rounded-xl border-2 font-medium transition-all duration-300 animate-slide-in-up",
                "hover:border-accent/50 hover:bg-accent/5 hover:scale-105",
                "active:scale-95",
                selectedNumberSize === size
                  ? "border-accent bg-accent text-accent-foreground shadow-lg ring-2 ring-accent/20"
                  : "border-border bg-card"
              )}
            >
              {size}
            </button>
          ))}
        </div>
        {selectedNumberSize && (
          <p className="text-xs text-accent mt-2 flex items-center gap-1 animate-fade-in">
            <span>✓</span> Selecionado: <span className="font-bold">{selectedNumberSize}</span>
          </p>
        )}
      </div>

      {/* Summary */}
      {(selectedLetterSize || selectedNumberSize) && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-4">
          <p className="text-sm font-medium text-center">
            {selectedLetterSize && selectedNumberSize ? (
              <>Seus tamanhos: <span className="text-accent">{selectedLetterSize}</span> e <span className="text-accent">{selectedNumberSize}</span></>
            ) : selectedLetterSize ? (
              <>Seu tamanho: <span className="text-accent">{selectedLetterSize}</span></>
            ) : (
              <>Sua numeração: <span className="text-accent">{selectedNumberSize}</span></>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
