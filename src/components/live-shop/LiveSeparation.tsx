import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Package, 
  Search, 
  Filter, 
  ArrowUpDown,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ShoppingBag,
  Boxes
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLiveSeparation } from "@/hooks/useLiveSeparation";
import { SeparationKPICards } from "./SeparationKPICards";
import { SeparationByBag } from "./SeparationByBag";
import { SeparationByProduct } from "./SeparationByProduct";
import { BatchLabelPrint } from "./BagLabelPrint";
import { BagQRScanner } from "./BagQRScanner";
import type { SeparationFilter, SeparationSort, SeparationMode } from "@/types/separation";

interface LiveSeparationProps {
  eventId: string | undefined;
  eventTitle?: string;
}

export function LiveSeparation({ eventId, eventTitle = "Live" }: LiveSeparationProps) {
  const [mode, setMode] = useState<SeparationMode>("by_bag");
  const [filter, setFilter] = useState<SeparationFilter>("all");
  const [sort, setSort] = useState<SeparationSort>("bag_number");
  const [search, setSearch] = useState("");

  const {
    bags,
    productGroups,
    kpis,
    isLoading,
    isGeneratingBags,
    generateBagNumbers,
    markItemSeparated,
    markItemCancelled,
    confirmItemRemoved,
    markBagSeparated,
    markAllProductItemsSeparated,
    markLabelPrinted,
    markLabelsAsPrinted,
    filterBags,
    filterProductGroups,
    fetchSeparationData,
    resolveReallocation,
  } = useLiveSeparation(eventId);

  const filteredBags = filterBags(filter, sort, search);
  const filteredProductGroups = filterProductGroups(search);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check if separation hasn't started yet (no bags with numbers)
  const needsToStartSeparation = bags.length === 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <SeparationKPICards kpis={kpis} />

      {/* Start separation button if no bags yet */}
      {needsToStartSeparation && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <Package className="h-16 w-16 text-muted-foreground" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">Iniciar Separação</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                Clique para gerar sacolas numeradas para todos os pedidos da live.
                Cada pedido receberá um número sequencial único.
              </p>
            </div>
            <Button 
              size="lg" 
              onClick={generateBagNumbers}
              disabled={isGeneratingBags}
              className="gap-2"
            >
              {isGeneratingBags ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Gerando sacolas...
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" />
                  Iniciar Separação
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main content when bags exist */}
      {!needsToStartSeparation && (
        <>
          {/* Mode tabs and filters */}
          <div className="flex flex-col gap-4">
            {/* Mode selection */}
            <Tabs value={mode} onValueChange={(v) => setMode(v as SeparationMode)}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <TabsList className="grid w-full sm:w-auto grid-cols-2">
                  <TabsTrigger value="by_bag" className="gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    Por Sacola
                  </TabsTrigger>
                  <TabsTrigger value="by_product" className="gap-2">
                    <Boxes className="h-4 w-4" />
                    Por Produto
                  </TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-2">
                  {/* QR Scanner button */}
                  {mode === "by_bag" && bags.length > 0 && (
                    <BagQRScanner 
                      bags={bags} 
                      onMarkBagSeparated={markBagSeparated}
                      onMarkItemSeparated={markItemSeparated}
                    />
                  )}

                  {/* Batch print button */}
                  {mode === "by_bag" && filteredBags.length > 0 && (
                    <BatchLabelPrint bags={filteredBags} eventTitle={eventTitle} onLabelsAsPrinted={markLabelsAsPrinted} />
                  )}

                  {/* Re-sync bags button (bags are auto-generated now) */}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={generateBagNumbers}
                    disabled={isGeneratingBags}
                    className="gap-2"
                  >
                    {isGeneratingBags ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Re-sincronizar
                  </Button>
                </div>
              </div>

              {/* Search and filters */}
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por @, número, produto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {mode === "by_bag" && (
                  <>
                    <Select value={filter} onValueChange={(v) => setFilter(v as SeparationFilter)}>
                      <SelectTrigger className="w-full sm:w-[160px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filtrar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="pending">
                          <span className="flex items-center gap-2">
                            <RefreshCw className="h-3 w-3" /> Pendentes
                          </span>
                        </SelectItem>
                        <SelectItem value="separated">
                          <span className="flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3" /> Separados
                          </span>
                        </SelectItem>
                        <SelectItem value="attention">
                          <span className="flex items-center gap-2">
                            <AlertTriangle className="h-3 w-3" /> Atenção
                          </span>
                        </SelectItem>
                        <SelectItem value="cancelled">
                          <span className="flex items-center gap-2">
                            <XCircle className="h-3 w-3" /> Cancelados
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={sort} onValueChange={(v) => setSort(v as SeparationSort)}>
                      <SelectTrigger className="w-full sm:w-[160px]">
                        <ArrowUpDown className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Ordenar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bag_number">Nº Sacola</SelectItem>
                        <SelectItem value="instagram">@Instagram</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>

              {/* Content */}
              <TabsContent value="by_bag" className="mt-4">
                <SeparationByBag
                  bags={filteredBags}
                  eventTitle={eventTitle}
                  onMarkItemSeparated={markItemSeparated}
                  onMarkItemCancelled={markItemCancelled}
                  onConfirmItemRemoved={confirmItemRemoved}
                  onMarkBagSeparated={markBagSeparated}
                  onLabelPrinted={markLabelPrinted}
                  onResolveReallocation={resolveReallocation}
                />
              </TabsContent>

              <TabsContent value="by_product" className="mt-4">
                <SeparationByProduct
                  productGroups={filteredProductGroups}
                  onMarkItemSeparated={markItemSeparated}
                  onMarkAllSeparated={markAllProductItemsSeparated}
                />
              </TabsContent>
            </Tabs>
          </div>
        </>
      )}
    </div>
  );
}
