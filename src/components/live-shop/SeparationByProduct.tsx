import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  RefreshCw,
  Package,
  AlertTriangle
} from "lucide-react";
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
import type { ProductSeparationGroup } from "@/types/separation";

interface SeparationByProductProps {
  productGroups: ProductSeparationGroup[];
  onMarkItemSeparated: (itemId: string) => Promise<boolean>;
  onMarkAllSeparated: (productId: string, color: string | null, size: string | null) => Promise<boolean>;
}

export function SeparationByProduct({
  productGroups,
  onMarkItemSeparated,
  onMarkAllSeparated,
}: SeparationByProductProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  const [processingGroups, setProcessingGroups] = useState<Set<string>>(new Set());

  const getGroupKey = (group: ProductSeparationGroup) => 
    `${group.productId}_${group.color || ''}_${group.size || ''}`;

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
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

  const handleMarkAllSeparated = async (group: ProductSeparationGroup) => {
    const groupKey = getGroupKey(group);
    setProcessingGroups(prev => new Set(prev).add(groupKey));
    await onMarkAllSeparated(group.productId, group.color, group.size);
    setProcessingGroups(prev => {
      const next = new Set(prev);
      next.delete(groupKey);
      return next;
    });
  };

  if (productGroups.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum produto encontrado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {productGroups.map((group) => {
        const groupKey = getGroupKey(group);
        const isExpanded = expandedGroups.has(groupKey);
        const progressPercent = group.totalNeeded > 0 
          ? Math.round((group.totalSeparated / group.totalNeeded) * 100)
          : 0;
        const isComplete = group.totalPending === 0;

        return (
          <Collapsible
            key={groupKey}
            open={isExpanded}
            onOpenChange={() => toggleGroup(groupKey)}
          >
            <Card className={`transition-all ${
              isComplete ? 'border-green-300 bg-green-50/30' : ''
            }`}>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="p-4">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}

                    {/* Product image */}
                    <div className="h-14 w-14 rounded overflow-hidden bg-muted flex-shrink-0">
                      {group.productImage ? (
                        <img 
                          src={group.productImage} 
                          alt={group.productName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Product info */}
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-medium truncate">{group.productName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {group.color && (
                          <Badge variant="outline" className="text-xs">
                            {group.color}
                          </Badge>
                        )}
                        {group.size && (
                          <Badge variant="secondary" className="text-xs font-bold">
                            {group.size}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex-shrink-0 text-right">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {group.totalSeparated}/{group.totalNeeded}
                        </span>
                        {isComplete ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <RefreshCw className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <Progress value={progressPercent} className="w-20 h-2" />
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0 pb-4 px-4">
                  {/* Bags that need this product */}
                  <div className="space-y-2 mb-4">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Sacolas que precisam deste item:
                    </p>
                    {group.bags
                      .sort((a, b) => a.bagNumber - b.bagNumber)
                      .map((bagItem) => (
                        <div 
                          key={bagItem.itemId}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            bagItem.status === 'separado' || bagItem.status === 'retirado_confirmado'
                              ? 'bg-green-50 border-green-200'
                              : bagItem.status === 'cancelado'
                              ? 'bg-red-50 border-red-200'
                              : 'bg-background'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-lg">
                              #{bagItem.bagNumber.toString().padStart(3, '0')}
                            </span>
                            <span className="text-primary font-medium">
                              {bagItem.instagramHandle}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              Qtd: {bagItem.quantity}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-2">
                            {bagItem.status === 'separado' ? (
                              <Badge className="bg-green-100 text-green-700 border-green-200">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Separado
                              </Badge>
                            ) : bagItem.status === 'cancelado' ? (
                              <Badge variant="destructive">Cancelado</Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 bg-green-50 border-green-200 hover:bg-green-100 text-green-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkItemSeparated(bagItem.itemId);
                                }}
                                disabled={processingItems.has(bagItem.itemId)}
                              >
                                {processingItems.has(bagItem.itemId) ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                    Separado
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Mark all separated button */}
                  {group.totalPending > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full gap-2"
                          disabled={processingGroups.has(groupKey)}
                        >
                          {processingGroups.has(groupKey) ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          Marcar todos como separado ({group.totalPending} pendentes)
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Marcar todos como separados?</AlertDialogTitle>
                          <AlertDialogDescription>
                            <div className="space-y-2">
                              <p>
                                {group.totalPending} unidades de <strong>{group.productName}</strong>
                                {group.color && ` (${group.color})`}
                                {group.size && ` - Tam. ${group.size}`} serão marcadas como separadas.
                              </p>
                              <div className="flex items-start gap-2 p-2 bg-amber-50 rounded border border-amber-200 mt-2">
                                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-amber-700">
                                  Certifique-se de ter todas as peças em mãos antes de confirmar.
                                </p>
                              </div>
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleMarkAllSeparated(group)}>
                            Confirmar todos
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}
