import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  RefreshCw,
  AlertTriangle,
  XCircle,
  Package,
  Trash2
} from "lucide-react";
import { BagLabelPrint } from "./BagLabelPrint";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { SeparationBag, SeparationItem, ReallocationInfo } from "@/types/separation";
import { AttentionBagAlert } from "./AttentionBagAlert";

interface SeparationByBagProps {
  bags: SeparationBag[];
  eventTitle: string;
  onMarkItemSeparated: (itemId: string) => Promise<boolean>;
  onMarkItemCancelled: (itemId: string, notes?: string) => Promise<boolean>;
  onConfirmItemRemoved: (itemId: string, confirmedCount?: number) => Promise<boolean>;
  onMarkBagSeparated: (bagId: string) => Promise<boolean>;
  onLabelPrinted?: (bagId: string) => Promise<boolean>;
  onResolveReallocation: (
    reallocation: ReallocationInfo,
    removedConfirmed: boolean,
    placedConfirmed: boolean
  ) => Promise<boolean>;
}

// Track separated units per item (key: itemId, value: number of units separated)
type UnitSeparationState = Record<string, number>;
// Track removal confirmations per cancelled item
type UnitRemovalState = Record<string, number>;

export function SeparationByBag({
  bags,
  eventTitle,
  onMarkItemSeparated,
  onMarkItemCancelled,
  onConfirmItemRemoved,
  onMarkBagSeparated,
  onLabelPrinted,
  onResolveReallocation,
}: SeparationByBagProps) {
  const [expandedBags, setExpandedBags] = useState<Set<string>>(new Set());
  // Track how many units of each item have been checked (for items with qty > 1)
  const [unitsSeparated, setUnitsSeparated] = useState<UnitSeparationState>({});
  // Track how many cancelled units have been confirmed as removed
  const [unitsRemoved, setUnitsRemoved] = useState<UnitRemovalState>({});

  // Initialize unitsSeparated and unitsRemoved based on item status
  useEffect(() => {
    const initialSeparatedState: UnitSeparationState = {};
    const initialRemovedState: UnitRemovalState = {};
    
    bags.forEach(bag => {
      bag.items.forEach(item => {
        if (item.status === 'separado' || item.status === 'retirado_confirmado') {
          initialSeparatedState[item.id] = item.quantity;
        } else if (item.status === 'em_separacao') {
          // Keep existing state or default to 0
          initialSeparatedState[item.id] = unitsSeparated[item.id] ?? 0;
        }
        
        // For cancelled items OR items with partial cancellation, track removal confirmations
        const hasPartialCancellation = (item.pendingRemovalFromQuantityReduction ?? 0) > 0;
        const isFullyCancelled = item.status === 'cancelado' || item.cartItemStatus === 'cancelado' || item.cartItemStatus === 'removido';
        
        if (hasPartialCancellation || isFullyCancelled) {
          initialRemovedState[item.id] = item.removedConfirmedCount || unitsRemoved[item.id] || 0;
        }
        if (item.status === 'retirado_confirmado') {
          // For partial cancellation, the "all confirmed" count is the pendingRemoval count
          const totalToRemove = hasPartialCancellation 
            ? (item.pendingRemovalFromQuantityReduction ?? 0)
            : item.quantity;
          initialRemovedState[item.id] = totalToRemove; // All confirmed
        }
      });
    });
    
    setUnitsSeparated(prev => ({ ...prev, ...initialSeparatedState }));
    setUnitsRemoved(prev => ({ ...prev, ...initialRemovedState }));
  }, [bags]);
  
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());

  const toggleBag = (bagId: string) => {
    setExpandedBags(prev => {
      const next = new Set(prev);
      if (next.has(bagId)) {
        next.delete(bagId);
      } else {
        next.add(bagId);
      }
      return next;
    });
  };

  // Handle toggling a single unit checkbox for separation
  const handleUnitToggle = async (itemId: string, unitIndex: number, item: SeparationItem) => {
    const currentSeparated = unitsSeparated[itemId] || 0;
    const isChecked = unitIndex < currentSeparated;
    
    if (isChecked) {
      // Unchecking - just update local state
      setUnitsSeparated(prev => ({
        ...prev,
        [itemId]: Math.max(0, currentSeparated - 1)
      }));
    } else {
      // Checking - update local state
      const newCount = currentSeparated + 1;
      setUnitsSeparated(prev => ({
        ...prev,
        [itemId]: newCount
      }));
      
      // If all units are now separated, call the API
      if (newCount >= item.quantity) {
        setProcessingItems(prev => new Set(prev).add(itemId));
        await onMarkItemSeparated(itemId);
        setProcessingItems(prev => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }
    }
  };

  // Handle toggling a single unit checkbox for removal confirmation
  const handleRemovalToggle = async (itemId: string, unitIndex: number, item: SeparationItem) => {
    const currentRemoved = unitsRemoved[itemId] || 0;
    const isChecked = unitIndex < currentRemoved;
    
    if (isChecked) {
      // Unchecking - update local state and persist
      const newCount = Math.max(0, currentRemoved - 1);
      setUnitsRemoved(prev => ({
        ...prev,
        [itemId]: newCount
      }));
      setProcessingItems(prev => new Set(prev).add(itemId));
      await onConfirmItemRemoved(itemId, newCount);
      setProcessingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    } else {
      // Checking - update local state and persist
      const newCount = currentRemoved + 1;
      setUnitsRemoved(prev => ({
        ...prev,
        [itemId]: newCount
      }));
      
      setProcessingItems(prev => new Set(prev).add(itemId));
      await onConfirmItemRemoved(itemId, newCount);
      setProcessingItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleMarkItemSeparated = async (itemId: string) => {
    setProcessingItems(prev => new Set(prev).add(itemId));
    await onMarkItemSeparated(itemId);
    setProcessingItems(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  };

  const handleConfirmAllRemoved = async (itemId: string, quantity: number) => {
    setUnitsRemoved(prev => ({ ...prev, [itemId]: quantity }));
    setProcessingItems(prev => new Set(prev).add(itemId));
    await onConfirmItemRemoved(itemId, quantity);
    setProcessingItems(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'separado':
        return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" /> Separada</Badge>;
      case 'em_separacao':
      case 'pendente':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200"><RefreshCw className="h-3 w-3 mr-1" /> Em separação</Badge>;
      case 'atencao':
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><AlertTriangle className="h-3 w-3 mr-1" /> Atenção</Badge>;
      case 'cancelado':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'separado':
        return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs"><CheckCircle2 className="h-3 w-3" /></Badge>;
      case 'em_separacao':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-gray-200 text-xs"><RefreshCw className="h-3 w-3" /></Badge>;
      case 'cancelado':
        return <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3" /></Badge>;
      case 'retirado_confirmado':
        return <Badge className="bg-gray-200 text-gray-600 text-xs">Retirado ✓</Badge>;
      default:
        return null;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (bags.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhuma sacola encontrada</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {bags.map((bag) => (
        <Collapsible
          key={bag.id}
          open={expandedBags.has(bag.id)}
          onOpenChange={() => toggleBag(bag.id)}
        >
          <Card className={`transition-all ${
            bag.status === 'atencao' ? 'border-amber-300 bg-amber-50/30' :
            bag.status === 'separado' ? 'border-green-300 bg-green-50/30' :
            bag.status === 'cancelado' ? 'border-red-300 bg-red-50/30 opacity-60' :
            ''
          }`}>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedBags.has(bag.id) ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">
                        Sacola #{bag.bagNumber.toString().padStart(3, '0')}
                      </span>
                      <span className="text-muted-foreground">—</span>
                      <span className="font-medium text-primary">{bag.instagramHandle}</span>
                      {bag.customerName && (
                        <span className="text-sm text-muted-foreground hidden sm:inline">
                          ({bag.customerName})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Print button - disabled when bag is blocked */}
                    {!bag.isBlocked ? (
                      <BagLabelPrint bag={bag} eventTitle={eventTitle} onLabelPrinted={onLabelPrinted} />
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                        🔒 Bloqueado
                      </Badge>
                    )}
                    <div className="text-right hidden sm:block">
                      <p className="text-sm text-muted-foreground">{bag.totalItems} {bag.totalItems === 1 ? 'item' : 'itens'}</p>
                      <p className="font-semibold">{formatCurrency(bag.totalValue)}</p>
                    </div>
                    {getStatusBadge(bag.status)}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <CardContent className="pt-0 pb-4 px-4">
                {/* Attention alert for blocked bags */}
                {bag.hasUnresolvedAttention && (
                  <div className="mb-4">
                    <AttentionBagAlert
                      bag={bag}
                      attentionRequirements={bag.attentionRequirements}
                      onResolveReallocation={async (reallocation, removed, placed) => {
                        await onResolveReallocation(reallocation, removed, placed);
                      }}
                    />
                  </div>
                )}

                {/* Items list */}
                <div className="space-y-2 mb-4">
                {bag.items.map((item) => {
                    const separatedCount = unitsSeparated[item.id] || 0;
                    const removedCount = unitsRemoved[item.id] || 0;
                    const isFullySeparated = item.status === 'separado' || item.status === 'retirado_confirmado';
                    
                    // Check if this is a fully cancelled item OR an item with partial cancellation (qty reduction)
                    const isFullyCancelled = item.status === 'cancelado' || item.cartItemStatus === 'cancelado' || item.cartItemStatus === 'removido';
                    const hasPartialCancellation = (item.pendingRemovalFromQuantityReduction ?? 0) > 0;
                    const needsRemovalConfirmation = isFullyCancelled || hasPartialCancellation;
                    
                    // Calculate pending removal count
                    // For partial cancellation: use pendingRemovalFromQuantityReduction
                    // For full cancellation: use item.quantity
                    const totalToRemove = hasPartialCancellation 
                      ? (item.pendingRemovalFromQuantityReduction ?? 0)
                      : (isFullyCancelled ? item.quantity : 0);
                    const pendingRemovalCount = Math.max(0, totalToRemove - removedCount);
                    
                    // Determine visual state
                    const showRemovalUI = needsRemovalConfirmation && pendingRemovalCount > 0;
                    const showItemAsStrikethrough = isFullyCancelled;
                    
                    return (
                      <div 
                        key={item.id}
                        className={`p-3 rounded-lg border ${
                          showRemovalUI
                            ? 'bg-red-50 border-red-200' 
                            : needsRemovalConfirmation && pendingRemovalCount === 0
                            ? 'bg-gray-100 border-gray-200'
                            : isFullySeparated
                            ? 'bg-green-50/50 border-green-200'
                            : 'bg-background'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Product image */}
                          <div className="h-12 w-12 rounded overflow-hidden bg-muted flex-shrink-0">
                            {item.productImage ? (
                              <img 
                                src={item.productImage} 
                                alt={item.productName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>

                          {/* Product info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`font-medium text-sm truncate ${showItemAsStrikethrough ? 'line-through text-muted-foreground' : ''}`}>
                                {item.productName}
                              </p>
                              {item.isGift && (
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs shrink-0">
                                  {item.giftSource === 'raffle' ? '🏆 SORTEIO' : '🎁 BRINDE'}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {item.color && <span>{item.color}</span>}
                              {item.size && (
                                <>
                                  <span>•</span>
                                  <span className="font-medium">{item.size}</span>
                                </>
                              )}
                              <span>•</span>
                              <span>Qtd: {item.quantity}</span>
                              {hasPartialCancellation && (
                                <span className="text-red-600 font-medium">
                                  (+ {item.pendingRemovalFromQuantityReduction} cancelada{(item.pendingRemovalFromQuantityReduction ?? 0) > 1 ? 's' : ''})
                                </span>
                              )}
                              {item.status === 'em_separacao' && separatedCount > 0 && !hasPartialCancellation && (
                                <span className="text-green-600 font-medium">
                                  ({separatedCount}/{item.quantity} separados)
                                </span>
                              )}
                              {needsRemovalConfirmation && removedCount > 0 && removedCount < totalToRemove && (
                                <span className="text-amber-600 font-medium">
                                  ({removedCount}/{totalToRemove} retirados)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Status badge */}
                          <div className="flex-shrink-0">
                            {hasPartialCancellation && pendingRemovalCount > 0 ? (
                              <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Retirar {pendingRemovalCount}
                              </Badge>
                            ) : (
                              getItemStatusBadge(item.status)
                            )}
                          </div>
                        </div>

                        {/* Individual unit checkboxes for em_separacao items */}
                        {item.status === 'em_separacao' && (
                          <div className="mt-3 pt-3 border-t border-dashed">
                            <div className="flex flex-wrap gap-2 items-center">
                              {Array.from({ length: item.quantity }).map((_, unitIndex) => {
                                const isChecked = isFullySeparated || unitIndex < separatedCount;
                                return (
                                  <label
                                    key={unitIndex}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                                      isChecked
                                        ? 'bg-green-100 border-green-300 text-green-700'
                                        : 'bg-background border-muted hover:bg-muted/50'
                                    }`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Checkbox
                                      checked={isChecked}
                                      disabled={processingItems.has(item.id)}
                                      onCheckedChange={() => handleUnitToggle(item.id, unitIndex, item)}
                                    />
                                    <span className="text-sm font-medium">
                                      Unid. {unitIndex + 1}
                                    </span>
                                    {isChecked && <CheckCircle2 className="h-4 w-4" />}
                                  </label>
                                );
                              })}
                              
                              {processingItems.has(item.id) && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                  Salvando...
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Individual unit checkboxes for items needing removal confirmation */}
                        {showRemovalUI && (
                          <div className="mt-3 pt-3 border-t border-dashed border-red-200">
                            <div className="flex items-center gap-2 mb-2">
                              <Trash2 className="h-4 w-4 text-red-600" />
                              <span className="text-sm font-medium text-red-700">
                                {item.wasSeparatedBeforeCancellation 
                                  ? `⚠️ ${hasPartialCancellation ? `${totalToRemove} unidade(s)` : 'Item'} JÁ SEPARADO foi cancelado! Retire da sacola:`
                                  : 'Confirme a retirada física da sacola:'}
                              </span>
                            </div>
                            {item.wasSeparatedBeforeCancellation && (
                              <div className="mb-2 p-2 rounded text-xs bg-muted/60 border border-border text-foreground">
                                {hasPartialCancellation 
                                  ? `${totalToRemove} unidade(s) deste produto já estava(m) na sacola física e precisa(m) ser removida(s) manualmente.`
                                  : 'Este produto já estava na sacola física e precisa ser removido manualmente.'}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2 items-center">
                              {Array.from({ length: totalToRemove }).map((_, unitIndex) => {
                                const isChecked = unitIndex < removedCount;
                                return (
                                  <label
                                    key={unitIndex}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                                      isChecked
                                        ? 'bg-gray-200 border-gray-400 text-gray-700'
                                        : 'bg-red-50 border-red-300 hover:bg-red-100 text-red-700'
                                    }`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Checkbox
                                      checked={isChecked}
                                      disabled={processingItems.has(item.id)}
                                      onCheckedChange={() => handleRemovalToggle(item.id, unitIndex, item)}
                                    />
                                    <span className="text-sm font-medium">
                                      {isChecked ? '✓ Retirado' : `Retirar unid. ${unitIndex + 1}`}
                                    </span>
                                  </label>
                                );
                              })}
                              
                              {processingItems.has(item.id) && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                  Salvando...
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Show confirmed message when all cancelled items are confirmed as removed */}
                        {needsRemovalConfirmation && pendingRemovalCount === 0 && totalToRemove > 0 && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Retirada confirmada</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Reprint label warning */}
                {bag.needsReprintLabel && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-100 border border-orange-300 mb-4">
                    <Package className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-orange-800">⚠️ Reimprimir Etiqueta</p>
                      <p className="text-sm text-orange-700">
                        Esta sacola foi modificada após a etiqueta ser impressa. Reimprima a etiqueta após confirmar as retiradas.
                      </p>
                    </div>
                  </div>
                )}

                {/* Cancelled item warning */}
                {bag.pendingRemovalCount > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-100 border border-red-300 mb-4">
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">
                        Atenção: {bag.pendingRemovalCount} unidade(s) cancelada(s) para retirar
                      </p>
                      <p className="text-sm text-red-700">
                        Marque cada checkbox abaixo após retirar fisicamente cada unidade da sacola.
                      </p>
                    </div>
                  </div>
                )}

                {/* Quick action: Mark all separated - blocked when bag has unresolved attention */}
                {bag.hasUnseparatedItems && !bag.hasCancelledItems && !bag.isBlocked && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Marcar toda sacola como separada
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar separação completa?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Todos os {bag.items.filter(i => i.status === 'em_separacao').length} itens pendentes serão marcados como separados.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onMarkBagSeparated(bag.id)}>
                          Confirmar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {/* Blocked action message */}
                {bag.hasUnseparatedItems && !bag.hasCancelledItems && bag.isBlocked && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-center">
                    <p className="text-sm text-amber-700">
                      🔒 Resolva as pendências acima antes de finalizar a separação
                    </p>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
    </div>
  );
}
