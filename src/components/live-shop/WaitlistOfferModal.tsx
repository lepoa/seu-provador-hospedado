import { useState } from "react";
import { ListOrdered, UserPlus, SkipForward, XCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { LiveWaitlist, LiveProduct } from "@/types/liveShop";

interface WaitlistOfferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  waitlistItem: LiveWaitlist | null;
  product: LiveProduct | null;
  onOffer: (waitlistId: string) => Promise<boolean>;
  onSkip: (waitlistId: string) => Promise<void>;
  onEndQueue: (productId: string, size: string) => Promise<void>;
}

export function WaitlistOfferModal({
  open,
  onOpenChange,
  waitlistItem,
  product,
  onOffer,
  onSkip,
  onEndQueue,
}: WaitlistOfferModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!waitlistItem || !product) return null;

  const handleOffer = async () => {
    setIsLoading(true);
    const success = await onOffer(waitlistItem.id);
    setIsLoading(false);
    if (success) {
      onOpenChange(false);
    }
  };

  const handleSkip = async () => {
    setIsLoading(true);
    await onSkip(waitlistItem.id);
    setIsLoading(false);
  };

  const handleEndQueue = async () => {
    setIsLoading(true);
    await onEndQueue(
      waitlistItem.product_id,
      (waitlistItem.variante as any)?.tamanho || ""
    );
    setIsLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ListOrdered className="h-5 w-5 text-amber-600 shrink-0" />
            Estoque Liberado!
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4">
          {/* Product info */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="w-12 h-12 bg-secondary rounded-md overflow-hidden shrink-0">
              {product.product?.image_url && (
                <img
                  src={product.product.image_url}
                  alt={product.product.name}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate">{product.product?.name}</div>
              <div className="text-xs text-muted-foreground">
                {product.product?.color && `${product.product.color} • `}
                Tam: {(waitlistItem.variante as any)?.tamanho}
              </div>
            </div>
          </div>

          {/* Next in queue */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-1.5 mb-2">
              <UserPlus className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-xs font-medium text-amber-800">
                Próximo(a) na lista de espera:
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-base font-bold text-amber-900 truncate block">
                  {waitlistItem.instagram_handle}
                </span>
                {waitlistItem.whatsapp && (
                  <div className="text-xs text-amber-700 truncate">
                    {waitlistItem.whatsapp}
                  </div>
                )}
              </div>
              <Badge variant="outline" className="border-amber-300 text-amber-700 text-xs shrink-0 whitespace-nowrap">
                #{waitlistItem.ordem} na fila
              </Badge>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Deseja oferecer este item para{" "}
            <strong className="text-foreground">{waitlistItem.instagram_handle}</strong>?
          </p>
        </div>

        <div className="px-5 pb-5 pt-0 flex flex-col gap-2">
          <Button 
            onClick={handleOffer} 
            disabled={isLoading} 
            className="w-full gap-1.5 bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4" />
            Oferecer para {waitlistItem.instagram_handle.length > 12 
              ? waitlistItem.instagram_handle.substring(0, 12) + '...' 
              : waitlistItem.instagram_handle}
          </Button>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleEndQueue}
              disabled={isLoading}
              className="flex-1 gap-1 text-xs h-9"
            >
              <XCircle className="h-3.5 w-3.5" />
              Encerrar Fila
            </Button>
            <Button
              variant="secondary"
              onClick={handleSkip}
              disabled={isLoading}
              className="flex-1 gap-1 text-xs h-9"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Pular
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
