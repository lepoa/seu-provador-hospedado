import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  ArrowRight, 
  ShoppingBag,
  Package,
  CheckCircle2,
  Lock
} from "lucide-react";
import { ReallocationConfirmationModal } from "./ReallocationConfirmationModal";
import type { SeparationBag, ReallocationInfo, AttentionRequirement } from "@/types/separation";

interface AttentionBagAlertProps {
  bag: SeparationBag;
  attentionRequirements: AttentionRequirement[];
  onResolveReallocation: (
    reallocation: ReallocationInfo,
    removedConfirmed: boolean,
    placedConfirmed: boolean
  ) => Promise<void>;
}

export function AttentionBagAlert({
  bag,
  attentionRequirements,
  onResolveReallocation,
}: AttentionBagAlertProps) {
  const [selectedReallocation, setSelectedReallocation] = useState<ReallocationInfo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const unresolvedRequirements = attentionRequirements.filter(r => !r.resolved);
  const hasUnresolved = unresolvedRequirements.length > 0;

  if (!hasUnresolved) return null;

  const handleConfirmReallocation = async (
    removedConfirmed: boolean,
    placedConfirmed: boolean
  ) => {
    if (!selectedReallocation) return;
    
    setIsProcessing(true);
    try {
      await onResolveReallocation(selectedReallocation, removedConfirmed, placedConfirmed);
    } finally {
      setIsProcessing(false);
      setSelectedReallocation(null);
    }
  };

  return (
    <>
      <Card className="border-amber-400 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-semibold text-amber-800">
                  ⚠️ Atenção Obrigatória
                </h4>
                <Badge className="bg-amber-200 text-amber-800 border-amber-300">
                  {unresolvedRequirements.length} pendência(s)
                </Badge>
              </div>
              
              <p className="text-sm text-amber-700 mb-3">
                Esta sacola requer confirmação manual antes de continuar. 
                Ações bloqueadas até resolução.
              </p>

              {/* Blocked actions indicator */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-100/50">
                  <Lock className="h-3 w-3 mr-1" />
                  Impressão bloqueada
                </Badge>
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-100/50">
                  <Lock className="h-3 w-3 mr-1" />
                  Finalização bloqueada
                </Badge>
              </div>

              {/* List of attention requirements */}
              <div className="space-y-2">
                {unresolvedRequirements.map((req, idx) => (
                  <div 
                    key={idx}
                    className="p-3 rounded-lg bg-white border border-amber-200"
                  >
                    {req.type === 'reallocation' && req.reallocationInfo && (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Product image */}
                          <div className="h-10 w-10 rounded overflow-hidden bg-muted flex-shrink-0">
                            {req.reallocationInfo.productImage ? (
                              <img 
                                src={req.reallocationInfo.productImage} 
                                alt={req.reallocationInfo.productName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {req.reallocationInfo.productName}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <ShoppingBag className="h-3 w-3" />
                                #{req.reallocationInfo.originBagNumber.toString().padStart(3, '0')}
                              </span>
                              <ArrowRight className="h-3 w-3" />
                              {req.reallocationInfo.destinationBagId ? (
                                <span className="flex items-center gap-1 text-green-600">
                                  <ShoppingBag className="h-3 w-3" />
                                  #{req.reallocationInfo.destinationBagNumber?.toString().padStart(3, '0')}
                                </span>
                              ) : (
                                <span className="text-gray-500">Cancelado</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-400 text-amber-700 hover:bg-amber-100"
                          onClick={() => setSelectedReallocation(req.reallocationInfo!)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Confirmar
                        </Button>
                      </div>
                    )}
                    
                    {req.type !== 'reallocation' && (
                      <p className="text-sm">{req.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ReallocationConfirmationModal
        open={!!selectedReallocation}
        onOpenChange={(open) => !open && setSelectedReallocation(null)}
        reallocation={selectedReallocation}
        onConfirm={handleConfirmReallocation}
        isProcessing={isProcessing}
      />
    </>
  );
}
