import { ListOrdered, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { LiveWaitlist } from "@/types/liveShop";

interface WaitlistBadgeProps {
  count: number;
  hasAvailableStock?: boolean;
  onClick?: () => void;
  entries?: LiveWaitlist[];
}

export function WaitlistBadge({ 
  count, 
  hasAvailableStock = false, 
  onClick,
  entries = []
}: WaitlistBadgeProps) {
  if (count === 0) return null;

  // If stock is available AND there's a waitlist, show urgent alert
  if (hasAvailableStock) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-amber-500 text-white animate-pulse hover:bg-amber-600 transition-colors"
          >
            <AlertTriangle className="h-3 w-3" />
            <span>{count} na fila!</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium text-amber-600">⚠️ Estoque liberado!</p>
            <p className="text-xs">
              {entries.length > 0 
                ? `${entries[0].instagram_handle} é o próximo da fila. Clique para oferecer.`
                : `${count} pessoa(s) aguardando. Clique para ver a fila.`
              }
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Normal waitlist indicator (product is out of stock)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
        >
          <ListOrdered className="h-3 w-3" />
          <span>{count} na fila</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <div className="space-y-1">
          <p className="text-xs">
            {count} pessoa(s) na lista de espera
          </p>
          {entries.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Próximo: {entries[0].instagram_handle}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
