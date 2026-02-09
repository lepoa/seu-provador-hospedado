import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StockBySizeProps {
  stock: Record<string, number>;
  onChange: (stock: Record<string, number>) => void;
}

const CLOTHING_SIZES = ["PP", "P", "M", "G", "GG"];
const NUMERIC_SIZES = ["34", "36", "38", "40", "42", "44", "46"];

export function StockBySize({ stock, onChange }: StockBySizeProps) {
  const handleChange = (size: string, value: string) => {
    const numValue = parseInt(value) || 0;
    onChange({
      ...stock,
      [size]: Math.max(0, numValue),
    });
  };

  const totalStock = Object.values(stock).reduce((sum, val) => sum + (val || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base">Estoque por Tamanho</Label>
        <span className="text-sm text-muted-foreground">
          Total: <span className="font-medium text-foreground">{totalStock}</span> unidades
        </span>
      </div>

      {/* Clothing sizes */}
      <div>
        <span className="text-xs text-muted-foreground block mb-2">Tamanhos letras</span>
        <div className="grid grid-cols-5 gap-2">
          {CLOTHING_SIZES.map((size) => (
            <div key={size} className="space-y-1">
              <label className="text-xs font-medium text-center block">{size}</label>
              <Input
                type="number"
                min="0"
                value={stock[size] || ""}
                onChange={(e) => handleChange(size, e.target.value)}
                placeholder="0"
                className="text-center h-9"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Numeric sizes */}
      <div>
        <span className="text-xs text-muted-foreground block mb-2">Tamanhos numéricos</span>
        <div className="grid grid-cols-7 gap-2">
          {NUMERIC_SIZES.map((size) => (
            <div key={size} className="space-y-1">
              <label className="text-xs font-medium text-center block">{size}</label>
              <Input
                type="number"
                min="0"
                value={stock[size] || ""}
                onChange={(e) => handleChange(size, e.target.value)}
                placeholder="0"
                className="text-center h-9"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { sortSizes } from "@/lib/sizeUtils";

// Helper to get available sizes from stock (sorted in standard order)
export function getAvailableSizes(stock: Record<string, number> | null | unknown): string[] {
  if (!stock || typeof stock !== 'object') return [];
  const stockObj = stock as Record<string, number>;
  const availableSizes = Object.entries(stockObj)
    .filter(([_, qty]) => typeof qty === 'number' && qty > 0)
    .map(([size]) => size);
  return sortSizes(availableSizes);
}

// Helper to check stock level
export function getStockLevel(stock: Record<string, number> | null | unknown, size: string): number {
  if (!stock || typeof stock !== 'object') return 0;
  const stockObj = stock as Record<string, number>;
  return stockObj[size] || 0;
}

// Helper to check if low stock
export function isLowStock(stock: Record<string, number> | null | unknown, size: string): boolean {
  return getStockLevel(stock, size) > 0 && getStockLevel(stock, size) <= 2;
}
