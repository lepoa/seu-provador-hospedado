import { useState, useEffect, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Lock, Package } from "lucide-react";
import { sortSizes } from "@/lib/sizeUtils";

interface StockByVariationInputProps {
  stockBySize: Record<string, number> | null;
  value: Record<string, number>;
  onChange: (value: Record<string, number>) => void;
  reserveAll: boolean;
  onReserveAllChange: (value: boolean) => void;
  disabled?: boolean;
}

export function StockByVariationInput({
  stockBySize,
  value,
  onChange,
  reserveAll,
  onReserveAllChange,
  disabled = false,
}: StockByVariationInputProps) {
  const sizes = useMemo(() => {
    if (!stockBySize) return [];
    return sortSizes(Object.keys(stockBySize).filter(size => (stockBySize[size] || 0) > 0));
  }, [stockBySize]);

  const totalAvailable = useMemo(() => {
    if (!stockBySize) return 0;
    return Object.values(stockBySize).reduce((sum, qty) => sum + (qty || 0), 0);
  }, [stockBySize]);

  const totalReserved = useMemo(() => {
    return Object.values(value).reduce((sum, qty) => sum + (qty || 0), 0);
  }, [value]);

  // When reserveAll is toggled, set all sizes to their max or clear them
  useEffect(() => {
    if (reserveAll && stockBySize) {
      const allSizes: Record<string, number> = {};
      Object.entries(stockBySize).forEach(([size, qty]) => {
        if (qty && qty > 0) {
          allSizes[size] = qty;
        }
      });
      onChange(allSizes);
    }
  }, [reserveAll, stockBySize]);

  const handleSizeChange = (size: string, qty: number) => {
    const maxQty = stockBySize?.[size] || 0;
    const clampedQty = Math.max(0, Math.min(qty, maxQty));
    
    onChange({
      ...value,
      [size]: clampedQty,
    });

    // If manually changed, uncheck reserveAll
    if (reserveAll && clampedQty !== maxQty) {
      onReserveAllChange(false);
    }
  };

  if (sizes.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-muted-foreground">
        <Package className="h-4 w-4" />
        <span className="text-sm">Sem estoque disponível</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Reserve all checkbox */}
      <label 
        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
          reserveAll 
            ? 'bg-primary/10 border-primary' 
            : 'bg-background hover:bg-muted/50'
        }`}
      >
        <Checkbox 
          checked={reserveAll} 
          onCheckedChange={(checked) => onReserveAllChange(checked === true)}
          disabled={disabled}
        />
        <div className="flex-1">
          <span className="font-medium text-sm flex items-center gap-2">
            <Lock className="h-3.5 w-3.5" />
            Reservar todo o estoque para a live
          </span>
          <p className="text-xs text-muted-foreground">
            {totalAvailable} unidades disponíveis
          </p>
        </div>
        {reserveAll && (
          <Badge variant="default" className="bg-primary">
            100% reservado
          </Badge>
        )}
      </label>

      {/* Size grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Quantidade por tamanho</Label>
          <Badge variant="outline" className="text-xs">
            {totalReserved} de {totalAvailable}
          </Badge>
        </div>
        
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {sizes.map((size) => {
            const available = stockBySize?.[size] || 0;
            const reserved = value[size] || 0;
            
            return (
              <div 
                key={size}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  reserved > 0 
                    ? 'bg-primary/5 border-primary/30' 
                    : 'bg-background'
                }`}
              >
                <div className="font-medium text-sm mb-1">{size}</div>
                <div className="text-xs text-muted-foreground mb-2">
                  Disp: {available}
                </div>
                <Input
                  type="number"
                  min={0}
                  max={available}
                  value={reserved || ""}
                  onChange={(e) => handleSizeChange(size, parseInt(e.target.value) || 0)}
                  disabled={disabled || reserveAll}
                  className="h-8 text-center text-sm"
                  placeholder="0"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      {totalReserved > 0 && !reserveAll && (
        <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950/30 rounded-lg text-sm">
          <span className="text-green-700 dark:text-green-400">
            Total reservado para a live:
          </span>
          <span className="font-bold text-green-700 dark:text-green-400">
            {totalReserved} unidades
          </span>
        </div>
      )}
    </div>
  );
}
