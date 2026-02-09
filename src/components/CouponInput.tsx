import { useState } from "react";
import { Ticket, X, Loader2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CouponInputProps {
  onApply: (code: string) => Promise<boolean>;
  onRemove: () => void;
  appliedCoupon: { code: string; discountAmount: number } | null;
  isLoading: boolean;
  error: string | null;
  orderTotal: number;
  className?: string;
}

export function CouponInput({
  onApply,
  onRemove,
  appliedCoupon,
  isLoading,
  error,
  orderTotal,
  className,
}: CouponInputProps) {
  const [code, setCode] = useState("");

  const handleApply = async () => {
    const success = await onApply(code);
    if (success) {
      setCode("");
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  if (appliedCoupon) {
    return (
      <div
        className={cn(
          "flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg",
          className
        )}
      >
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-green-600" />
          <div>
            <span className="font-mono font-bold text-green-700 dark:text-green-400">
              {appliedCoupon.code}
            </span>
            <span className="text-sm text-green-600 dark:text-green-400 ml-2">
              -{formatCurrency(appliedCoupon.discountAmount)}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-green-600 hover:text-red-600"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Código do cupom"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="pl-10 font-mono"
            disabled={isLoading}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleApply}
          disabled={!code.trim() || isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Aplicar"
          )}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
