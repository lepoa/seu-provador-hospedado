import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle,
  ShoppingBag
} from "lucide-react";
import type { ReallocationInfo } from "@/types/separation";

interface ReallocationConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reallocation: ReallocationInfo | null;
  onConfirm: (
    removedFromOrigin: boolean, 
    placedInDestination: boolean
  ) => Promise<void>;
  isProcessing?: boolean;
}

export function ReallocationConfirmationModal({
  open,
  onOpenChange,
  reallocation,
  onConfirm,
  isProcessing = false,
}: ReallocationConfirmationModalProps) {
  const [removedConfirmed, setRemovedConfirmed] = useState(
    reallocation?.removedFromOriginConfirmed || false
  );
  const [placedConfirmed, setPlacedConfirmed] = useState(
    reallocation?.placedInDestinationConfirmed || false
  );

  if (!reallocation) return null;

  const canComplete = removedConfirmed && (
    // If no destination (cancelled), only need removal confirmation
    !reallocation.destinationBagId || placedConfirmed
  );

  const handleConfirm = async () => {
    await onConfirm(removedConfirmed, placedConfirmed);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            Confirmação de Realocação Obrigatória
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            Uma peça foi movida entre sacolas. Confirme manualmente cada etapa física.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Item info */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
          <div className="h-12 w-12 rounded overflow-hidden bg-muted flex-shrink-0">
            {reallocation.productImage ? (
              <img 
                src={reallocation.productImage} 
                alt={reallocation.productName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{reallocation.productName}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {reallocation.color && <span>{reallocation.color}</span>}
              {reallocation.size && (
                <>
                  <span>•</span>
                  <span className="font-medium">{reallocation.size}</span>
                </>
              )}
              <span>•</span>
              <span>Qtd: {reallocation.quantity}</span>
            </div>
          </div>
        </div>

        {/* Flow visualization */}
        <div className="flex items-center justify-center gap-3 py-4">
          <div className="text-center">
            <div className="h-12 w-12 rounded-full bg-red-100 border-2 border-red-300 flex items-center justify-center mx-auto mb-1">
              <ShoppingBag className="h-5 w-5 text-red-600" />
            </div>
            <Badge variant="outline" className="text-xs">
              Sacola #{reallocation.originBagNumber.toString().padStart(3, '0')}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">Origem</p>
          </div>
          
          <ArrowRight className="h-6 w-6 text-muted-foreground flex-shrink-0" />
          
          <div className="text-center">
            {reallocation.destinationBagId ? (
              <>
                <div className="h-12 w-12 rounded-full bg-green-100 border-2 border-green-300 flex items-center justify-center mx-auto mb-1">
                  <ShoppingBag className="h-5 w-5 text-green-600" />
                </div>
                <Badge variant="outline" className="text-xs">
                  Sacola #{reallocation.destinationBagNumber?.toString().padStart(3, '0')}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {reallocation.destinationInstagram}
                </p>
              </>
            ) : (
              <>
                <div className="h-12 w-12 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center mx-auto mb-1">
                  <Package className="h-5 w-5 text-gray-400" />
                </div>
                <Badge variant="secondary" className="text-xs">
                  Cancelado
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">Devolver ao estoque</p>
              </>
            )}
          </div>
        </div>

        {/* Confirmation checkboxes */}
        <div className="space-y-3">
          <label
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              removedConfirmed
                ? 'bg-green-50 border-green-300'
                : 'bg-red-50 border-red-300 hover:bg-red-100'
            }`}
          >
            <Checkbox
              checked={removedConfirmed}
              onCheckedChange={(checked) => setRemovedConfirmed(checked === true)}
              disabled={isProcessing}
              className="mt-0.5"
            />
            <div className="flex-1">
              <p className="font-medium text-sm">
                {removedConfirmed && <CheckCircle2 className="h-4 w-4 inline mr-1 text-green-600" />}
                Confirmo que retirei a peça da Sacola #{reallocation.originBagNumber.toString().padStart(3, '0')}
              </p>
              <p className="text-xs text-muted-foreground">
                A peça foi fisicamente removida da sacola original
              </p>
            </div>
          </label>

          {reallocation.destinationBagId && (
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                placedConfirmed
                  ? 'bg-green-50 border-green-300'
                  : 'bg-amber-50 border-amber-300 hover:bg-amber-100'
              } ${!removedConfirmed ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <Checkbox
                checked={placedConfirmed}
                onCheckedChange={(checked) => setPlacedConfirmed(checked === true)}
                disabled={isProcessing || !removedConfirmed}
                className="mt-0.5"
              />
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {placedConfirmed && <CheckCircle2 className="h-4 w-4 inline mr-1 text-green-600" />}
                  Confirmo que coloquei a peça na Sacola #{reallocation.destinationBagNumber?.toString().padStart(3, '0')}
                </p>
                <p className="text-xs text-muted-foreground">
                  A peça foi fisicamente colocada na nova sacola ({reallocation.destinationInstagram})
                </p>
              </div>
            </label>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            className="flex-1"
          >
            Voltar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canComplete || isProcessing}
            className="flex-1 gap-2"
          >
            {isProcessing ? (
              <>Salvando...</>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirmar Realocação
              </>
            )}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
