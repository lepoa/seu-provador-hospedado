import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Percent, DollarSign } from "lucide-react";

interface ProductDiscountFieldsProps {
  discountType: string | null;
  discountValue: number | null;
  onDiscountTypeChange: (value: string | null) => void;
  onDiscountValueChange: (value: number | null) => void;
  label?: string;
}

export function ProductDiscountFields({
  discountType,
  discountValue,
  onDiscountTypeChange,
  onDiscountValueChange,
  label = "Desconto",
}: ProductDiscountFieldsProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Select
          value={discountType || "_none"}
          onValueChange={(v) => onDiscountTypeChange(v === "_none" ? null : v)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Sem desconto" />
          </SelectTrigger>
          <SelectContent className="bg-background z-50">
            <SelectItem value="_none">Sem desconto</SelectItem>
            <SelectItem value="percentage">
              <span className="flex items-center gap-1">
                <Percent className="h-3 w-3" /> Porcentagem
              </span>
            </SelectItem>
            <SelectItem value="fixed">
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Valor fixo
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        {discountType && (
          <div className="relative flex-1">
            <Input
              type="number"
              min="0"
              step={discountType === "percentage" ? "1" : "0.01"}
              max={discountType === "percentage" ? "100" : undefined}
              value={discountValue ?? ""}
              onChange={(e) =>
                onDiscountValueChange(
                  e.target.value ? parseFloat(e.target.value) : null
                )
              }
              placeholder={discountType === "percentage" ? "Ex: 10" : "Ex: 15.00"}
              className="pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              {discountType === "percentage" ? "%" : "R$"}
            </span>
          </div>
        )}
      </div>
      {discountType && discountValue && (
        <p className="text-xs text-muted-foreground">
          {discountType === "percentage"
            ? `${discountValue}% de desconto será aplicado`
            : `R$ ${discountValue.toFixed(2)} de desconto será aplicado`}
        </p>
      )}
    </div>
  );
}

export function calculateDiscountedPrice(
  originalPrice: number,
  discountType: string | null,
  discountValue: number | null
): number {
  if (!discountType || !discountValue) return originalPrice;

  if (discountType === "percentage") {
    return originalPrice * (1 - discountValue / 100);
  } else {
    return Math.max(0, originalPrice - discountValue);
  }
}
