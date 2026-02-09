import { useState, useMemo, useEffect } from "react";
import { Search, Package, Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sortSizes } from "@/lib/sizeUtils";

interface Product {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
  color: string | null;
  sku: string | null;
  group_key: string | null;
  stock_by_size: Record<string, number> | null;
}

interface AvailableStockEntry {
  product_id: string;
  size: string;
  stock: number;      // renamed from on_hand to match view
  available: number;
}

interface AddProductsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  existingProductIds: string[];
  onProductsAdded: () => void;
}

export function AddProductsModal({
  open,
  onOpenChange,
  eventId,
  existingProductIds,
  onProductsAdded,
}: AddProductsModalProps) {
  const [search, setSearch] = useState("");
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [availableStock, setAvailableStock] = useState<Map<string, Map<string, number>>>(new Map());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch all products when modal opens
  useEffect(() => {
    if (open) {
      fetchProducts();
      setSelectedIds(new Set());
      setSearch("");
    }
  }, [open]);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      // CRITICAL: First fetch REAL available stock from the view
      // This is the SAME source the catalog uses for availability
      const { data: stockData, error: stockError } = await supabase
        .from("product_available_stock")
        .select("product_id, size, stock, available");

      if (stockError) {
        console.error("Error fetching available stock:", stockError);
        toast.error("Erro ao carregar estoque disponível");
        setIsLoading(false);
        return;
      }

      // Build a map: product_id -> size -> available quantity
      // ONLY include sizes with available > 0
      const stockMap = new Map<string, Map<string, number>>();
      (stockData || []).forEach((entry: AvailableStockEntry) => {
        // Only add if available > 0 (skip sold-out sizes)
        if (entry.available > 0) {
          if (!stockMap.has(entry.product_id)) {
            stockMap.set(entry.product_id, new Map());
          }
          stockMap.get(entry.product_id)!.set(entry.size, entry.available);
        }
      });
      setAvailableStock(stockMap);
      
      console.log("[AddProductsModal] Loaded available stock for", stockMap.size, "products");

      // Now fetch product info (we DON'T use stock_by_size - only for display)
      const { data: productsData, error: productsError } = await supabase
        .from("product_catalog")
        .select("id, name, image_url, price, color, sku, group_key")
        .eq("is_active", true)
        .order("name");

      if (productsError) throw productsError;
      
      // Cast to Product but stock_by_size will be null (we don't need it)
      setAllProducts((productsData || []).map(p => ({ ...p, stock_by_size: null })) as Product[]);
    } catch (err) {
      console.error("Error fetching products:", err);
      toast.error("Erro ao carregar produtos");
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    // Exclude already added products
    let products = allProducts.filter((p) => !existingProductIds.includes(p.id));

    if (search.trim()) {
      const searchLower = search.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.sku?.toLowerCase().includes(searchLower) ||
          p.group_key?.toLowerCase().includes(searchLower) ||
          p.color?.toLowerCase().includes(searchLower)
      );
    }

    return products;
  }, [allProducts, existingProductIds, search]);

  const toggleProduct = (productId: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(productId)) {
      newSet.delete(productId);
    } else {
      newSet.add(productId);
    }
    setSelectedIds(newSet);
  };

  const handleAddProducts = async () => {
    if (selectedIds.size === 0) return;

    setIsSaving(true);
    try {
      // Get current max order
      const { data: existingProducts } = await supabase
        .from("live_products")
        .select("prioridade_ordem")
        .eq("live_event_id", eventId)
        .order("prioridade_ordem", { ascending: false })
        .limit(1);

      let maxOrder = existingProducts?.[0]?.prioridade_ordem || 0;

      // Prepare inserts - use ONLY available stock for snapshot (NOT raw on_hand)
      const inserts = Array.from(selectedIds).map((productId) => {
        maxOrder += 1;
        
        // Build snapshot_variantes ONLY from availableStock (real availability)
        // This map already only contains sizes with available > 0
        const productStock = availableStock.get(productId);
        const snapshotVariantes: Record<string, number> = {};
        
        if (productStock) {
          productStock.forEach((available, size) => {
            // Double-check: only include sizes with available > 0
            if (available > 0) {
              snapshotVariantes[size] = available;
            }
          });
        }
        // NO FALLBACK to stock_by_size - if no available stock, snapshot is empty
        
        return {
          live_event_id: eventId,
          product_id: productId,
          prioridade_ordem: maxOrder,
          visibilidade: "catalogo_e_live" as const,
          bloquear_desde_planejamento: false,
          snapshot_variantes: snapshotVariantes,
        };
      });

      const { error } = await supabase.from("live_products").insert(inserts);

      if (error) throw error;

      toast.success(`${selectedIds.size} produto(s) adicionado(s) à live!`);
      onProductsAdded();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error adding products:", err);
      toast.error("Erro ao adicionar produtos");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 w-[min(720px,95vw)] max-h-[85vh] !flex !flex-col overflow-hidden">
        {/* HEADER - Fixed/Sticky */}
        <div className="px-6 py-4 border-b shrink-0">
          <DialogHeader className="p-0 m-0">
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Adicionar Produtos à Live
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* BODY - Scrollable */}
        <div className="px-6 py-4 flex-1 min-h-0 overflow-y-auto">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, código ou cor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Selected count */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg mb-3">
              <span className="text-sm font-medium">
                {selectedIds.size} produto(s) selecionado(s)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            </div>
          )}

          {/* Products list */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando produtos...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum produto encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
            {filteredProducts.map((product) => {
                const isSelected = selectedIds.has(product.id);
                
                // Use ONLY available stock from the view (same as catalog)
                // The availableStock map already only contains sizes with available > 0
                const productStock = availableStock.get(product.id);
                let sizesWithAvailable: Array<{ size: string; available: number }> = [];
                let totalAvailable = 0;
                
                if (productStock && productStock.size > 0) {
                  // Build array from the map (already filtered to available > 0)
                  productStock.forEach((available, size) => {
                    sizesWithAvailable.push({ size, available });
                    totalAvailable += available;
                  });
                  
                  // Sort sizes for display
                  const sortedSizes = sortSizes(sizesWithAvailable.map(s => s.size));
                  sizesWithAvailable = sortedSizes.map(size => {
                    const available = productStock.get(size) || 0;
                    return { size, available };
                  }).filter(s => s.available > 0);
                }
                // NO FALLBACK - if no available stock, product shows 0 units

                return (
                  <div
                    key={product.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => toggleProduct(product.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox checked={isSelected} />

                      <div className="w-12 h-12 bg-secondary rounded overflow-hidden shrink-0">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {product.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {product.sku || product.group_key || "—"}
                          {product.color && ` • ${product.color}`}
                          {" • "}
                          {formatPrice(product.price)}
                        </div>
                        {/* Size chips - using AVAILABLE stock */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {sizesWithAvailable.slice(0, 6).map(({ size, available }) => (
                            <span
                              key={size}
                              className={`px-1.5 py-0.5 rounded text-xs ${
                                available > 0 ? 'bg-secondary' : 'bg-red-100 text-red-600'
                              }`}
                            >
                              {size}: {available}
                            </span>
                          ))}
                          {sizesWithAvailable.length > 6 && (
                            <span className="text-xs text-muted-foreground">
                              +{sizesWithAvailable.length - 6}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <Badge
                          variant={totalAvailable > 0 ? "secondary" : "destructive"}
                        >
                          {totalAvailable} un
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER - Fixed/Sticky */}
        <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleAddProducts}
            disabled={selectedIds.size === 0 || isSaving}
          >
            {isSaving ? (
              "Adicionando..."
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Adicionar {selectedIds.size > 0 && `(${selectedIds.size})`}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
