import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { HelpCircle } from "lucide-react";

interface StockEntry {
  stock: number;      // renamed from on_hand to match view
  reserved: number;
  committed: number;
  available: number;
}

interface StockBreakdownTooltipProps {
  size: string;
  stock: StockEntry | null | undefined;
  /** Show badge with size:quantity or just icon */
  variant?: "badge" | "icon";
  /** Whether this has reservations (for styling) */
  hasReservations?: boolean;
}

/**
 * Reusable tooltip showing stock breakdown for a specific size
 * Formula: Disponível Venda = Estoque Inicial − Reservado − Vendidos
 * 
 * IMPORTANT: This component is used in Admin context and MUST NOT
 * depend on CartContext or any other front-end-specific providers.
 * It uses HoverCard from Radix UI which is provider-agnostic.
 */
export function StockBreakdownTooltip({
  size,
  stock,
  variant = "badge",
  hasReservations = false
}: StockBreakdownTooltipProps) {
  // Safely check if we have valid data
  const hasData = stock !== null &&
    stock !== undefined &&
    typeof stock.stock === 'number' &&
    !isNaN(stock.stock);

  const content = (
    <div className="space-y-2 min-w-[180px]">
      <p className="font-semibold text-sm border-b pb-1">Detalhe: {size}</p>
      {hasData ? (
        <>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estoque Inicial:</span>
              <span className="font-medium">{stock.stock}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Reservado:</span>
              <span className={`font-medium ${stock.reserved > 0 ? 'text-orange-600' : ''}`}>
                {stock.reserved}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Vendido:</span>
              <span className={`font-medium ${stock.committed > 0 ? 'text-blue-600' : ''}`}>
                {stock.committed}
              </span>
            </div>

            <div className="flex justify-between pt-1 border-t mt-1">
              <span className="font-medium">Disponível Venda:</span>
              <span className={`font-bold ${stock.available > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stock.available}
              </span>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          Sem detalhamento disponível no momento.
        </p>
      )}
    </div>
  );

  if (variant === "icon") {
    return (
      <HoverCard openDelay={0} closeDelay={0}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center cursor-help focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded-sm"
            aria-label={`Ver detalhes de estoque para tamanho ${size}`}
          >
            <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-auto p-3 z-50 bg-white shadow-xl border-2" side="top" align="center">
          {content}
        </HoverCardContent>
      </HoverCard>
    );
  }

  return (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>
        <div
          className={`
            inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-semibold transition-colors cursor-help
            ${hasData && stock.available > 0
              ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              : 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 opacity-50'
            }
            ${hasReservations ? 'border-orange-200 bg-orange-50 text-orange-700' : ''}
          `}
          tabIndex={0}
          role="button"
        >
          <span>{size}: {hasData ? stock.available : 0}</span>
          <HelpCircle className="h-3 w-3 opacity-50 ml-0.5" />
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-auto p-3 z-50 bg-white shadow-xl border-2" side="top" align="center">
        {content}
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * Full breakdown panel for product detail page
 */
interface StockBreakdownPanelProps {
  stockBySize: Map<string, StockEntry> | null;
  className?: string;
}

export function StockBreakdownPanel({ stockBySize, className = "" }: StockBreakdownPanelProps) {
  if (!stockBySize || stockBySize.size === 0) {
    return (
      <div className={`text-sm text-muted-foreground italic ${className}`}>
        Nenhum estoque cadastrado.
      </div>
    );
  }

  // Sort sizes
  const letterOrder = ["PP", "P", "M", "G", "GG", "XG", "XXG", "XXXG", "UN"];
  const entries = Array.from(stockBySize.entries()).sort(([a], [b]) => {
    const aIsLetter = letterOrder.includes(a.toUpperCase());
    const bIsLetter = letterOrder.includes(b.toUpperCase());
    const aIsNumeric = /^\d+$/.test(a);
    const bIsNumeric = /^\d+$/.test(b);

    if (aIsLetter && !bIsLetter) return -1;
    if (!aIsLetter && bIsLetter) return 1;
    if (aIsLetter && bIsLetter) {
      return letterOrder.indexOf(a.toUpperCase()) - letterOrder.indexOf(b.toUpperCase());
    }
    if (aIsNumeric && bIsNumeric) {
      return parseInt(a) - parseInt(b);
    }
    return a.localeCompare(b);
  });

  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="text-sm font-semibold">Estoque por Tamanho</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-2 font-medium">Tamanho</th>
              <th className="text-right py-2 px-2 font-medium">Estoque Inicial</th>
              <th className="text-right py-2 px-2 font-medium">Reservado</th>
              <th className="text-right py-2 px-2 font-medium">Vendido</th>
              <th className="text-right py-2 px-2 font-medium">Disponível Venda</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([size, entry]) => (
              <tr key={size} className="border-b last:border-b-0">
                <td className="py-2 px-2 font-medium">{size}</td>
                <td className="text-right py-2 px-2">{entry.stock}</td>
                <td className={`text-right py-2 px-2 ${entry.reserved > 0 ? 'text-orange-600' : ''}`}>
                  {entry.reserved}
                </td>
                <td className={`text-right py-2 px-2 ${entry.committed > 0 ? 'text-blue-600' : ''}`}>
                  {entry.committed}
                </td>
                <td className={`text-right py-2 px-2 font-semibold ${entry.available > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                  {entry.available}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Disponível Venda = Estoque Inicial − Reservado − Vendido
      </p>
    </div>
  );
}
