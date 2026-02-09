import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ListOrdered, 
  UserPlus, 
  SkipForward, 
  XCircle, 
  CheckCircle, 
  Clock,
  MessageCircle,
  Phone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { LiveWaitlist } from "@/types/liveShop";

interface WaitlistDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  productColor?: string;
  size: string;
  entries: LiveWaitlist[];
  hasStock: boolean;
  onAllocate: (waitlistId: string) => Promise<boolean>;
  onSkip: (waitlistId: string) => Promise<void>;
  onEndQueue: () => Promise<void>;
  onAddToWaitlist: () => void;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  'ativa': { label: 'Aguardando', icon: Clock, color: 'bg-amber-100 text-amber-700' },
  'chamada': { label: 'Chamado', icon: Phone, color: 'bg-blue-100 text-blue-700' },
  'atendida': { label: 'Transferido', icon: CheckCircle, color: 'bg-green-100 text-green-700' },
  'cancelada': { label: 'Cancelado', icon: XCircle, color: 'bg-muted text-muted-foreground' },
};

export function WaitlistDrawer({
  open,
  onOpenChange,
  productName,
  productColor,
  size,
  entries,
  hasStock,
  onAllocate,
  onSkip,
  onEndQueue,
  onAddToWaitlist,
}: WaitlistDrawerProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const activeEntries = entries.filter(e => e.status === 'ativa');
  const historyEntries = entries.filter(e => e.status !== 'ativa');

  const handleAllocate = async (id: string) => {
    setLoadingId(id);
    await onAllocate(id);
    setLoadingId(null);
  };

  const handleSkip = async (id: string) => {
    setLoadingId(id);
    await onSkip(id);
    setLoadingId(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col">
        <SheetHeader className="shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5 text-amber-600" />
            Lista de Espera
          </SheetTitle>
          <div className="p-3 bg-muted/50 rounded-lg text-left">
            <div className="font-medium">{productName}</div>
            <div className="text-sm text-muted-foreground">
              {productColor && `${productColor} • `}Tam: {size}
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {/* Stock Alert */}
          {hasStock && activeEntries.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4 animate-pulse">
              <div className="flex items-center gap-2 text-amber-800">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Estoque disponível!</span>
              </div>
              <p className="text-sm text-amber-700 mt-1">
                Ofereça para {activeEntries[0].instagram_handle}
              </p>
            </div>
          )}

          {/* Active Queue */}
          {activeEntries.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Fila ativa ({activeEntries.length})
              </h4>
              {activeEntries.map((entry, index) => {
                const isFirst = index === 0;
                const isLoading = loadingId === entry.id;
                const variante = entry.variante as any;

                return (
                  <div 
                    key={entry.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      isFirst && hasStock 
                        ? 'border-amber-300 bg-amber-50' 
                        : 'hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={`shrink-0 ${isFirst ? 'border-amber-400 bg-amber-100 text-amber-800' : ''}`}
                          >
                            #{entry.ordem}
                          </Badge>
                          <span className="font-medium truncate">{entry.instagram_handle}</span>
                        </div>
                        {entry.whatsapp && (
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {entry.whatsapp}
                          </div>
                        )}
                        {variante?.observacao && (
                          <div className="text-xs text-muted-foreground mt-1 italic">
                            "{variante.observacao}"
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          {format(new Date(entry.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {isFirst && hasStock && (
                          <Button
                            size="sm"
                            className="gap-1 bg-green-600 hover:bg-green-700"
                            disabled={isLoading}
                            onClick={() => handleAllocate(entry.id)}
                          >
                            <CheckCircle className="h-3 w-3" />
                            Transferir
                          </Button>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              disabled={isLoading}
                              onClick={() => handleSkip(entry.id)}
                            >
                              <SkipForward className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Pular (não respondeu)</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ListOrdered className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma pessoa na fila</p>
            </div>
          )}

          {/* History */}
          {historyEntries.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Histórico ({historyEntries.length})
              </h4>
              <div className="space-y-1">
                {historyEntries.slice(0, 5).map(entry => {
                  const status = statusConfig[entry.status] || statusConfig.ativa;
                  const StatusIcon = status.icon;
                  
                  return (
                    <div 
                      key={entry.id}
                      className="flex items-center gap-2 p-2 text-sm rounded opacity-60"
                    >
                      <StatusIcon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{entry.instagram_handle}</span>
                      <Badge variant="outline" className={`text-xs ml-auto ${status.color}`}>
                        {status.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </ScrollArea>

        <SheetFooter className="shrink-0 gap-2 sm:gap-2 pt-4 border-t">
          <Button 
            variant="outline" 
            className="flex-1 gap-1"
            onClick={onAddToWaitlist}
          >
            <UserPlus className="h-4 w-4" />
            Adicionar
          </Button>
          {activeEntries.length > 0 && (
            <Button 
              variant="destructive"
              className="flex-1 gap-1"
              onClick={onEndQueue}
            >
              <XCircle className="h-4 w-4" />
              Encerrar Fila
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
