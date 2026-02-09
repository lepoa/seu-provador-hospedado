import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Archive, Search, Package, Trash2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProductForm } from "@/components/ProductForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StockBreakdownTooltip } from "@/components/StockBreakdownTooltip";
import { calculateDiscountedPrice, hasDiscount, getDiscountLabel, DiscountType } from "@/lib/discountUtils";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  group_key: string | null;
  category: string | null;
  price: number;
  color: string | null;
  style: string | null;
  occasion: string | null;
  modeling: string | null;
  sizes: string[] | null;
  stock_by_size: unknown;
  is_active: boolean | null;
  image_url: string | null;
  tags: string[] | null;
  user_id: string | null;
  created_at: string;
  created_from_import?: boolean;
  weight_kg?: number | null;
  discount_type?: DiscountType;
  discount_value?: number | null;
}

interface AvailableStockEntry {
  product_id: string;
  size: string;
  stock: number;      // renamed from on_hand to match view
  committed: number;
  reserved: number;
  available: number;
}

interface ProductsManagerProps {
  userId: string;
  initialFilter?: string;
}

type FilterType = "active" | "archived" | "imported";

export function ProductsManager({ userId, initialFilter }: ProductsManagerProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [availableStock, setAvailableStock] = useState<Map<string, Map<string, AvailableStockEntry>>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>(() => {
    if (initialFilter === "imported") return "imported";
    return "active";
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Fetch available stock from the view
  const loadAvailableStock = useCallback(async (productIds: string[]) => {
    if (productIds.length === 0) return;
    
    try {
      const { data, error } = await supabase
        .from("product_available_stock")
        .select("*")
        .in("product_id", productIds);
      
      if (error) throw error;
      
      const stockMap = new Map<string, Map<string, AvailableStockEntry>>();
      (data || []).forEach((entry: AvailableStockEntry) => {
        if (!stockMap.has(entry.product_id)) {
          stockMap.set(entry.product_id, new Map());
        }
        stockMap.get(entry.product_id)!.set(entry.size, entry);
      });
      
      setAvailableStock(stockMap);
    } catch (error) {
      console.error("Error loading available stock:", error);
    }
  }, []);

  const loadProducts = async () => {
    try {
      let query = supabase
        .from("product_catalog")
        .select("*")
        .order("group_key", { ascending: true, nullsFirst: false })
        .order("color", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      // Filter by user_id for multi-tenant support
      query = query.or(`user_id.eq.${userId},user_id.is.null`);

      // Apply filter based on current filter state
      if (filter === "active") {
        query = query.eq("is_active", true);
      } else if (filter === "archived") {
        query = query.eq("is_active", false);
      } else if (filter === "imported") {
        query = query.eq("is_active", false).eq("created_from_import", true);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProducts(data || []);
      
      // Load available stock for these products
      if (data && data.length > 0) {
        loadAvailableStock(data.map((p: Product) => p.id));
      }
    } catch (error) {
      console.error("Error loading products:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [userId, filter]);

  const handleArchive = async (product: Product) => {
    try {
      const { error } = await supabase
        .from("product_catalog")
        .update({ is_active: !product.is_active })
        .eq("id", product.id);

      if (error) throw error;
      toast.success(product.is_active ? "Produto arquivado" : "Produto reativado");
      loadProducts();
    } catch (error) {
      console.error("Error archiving product:", error);
      toast.error("Erro ao arquivar produto");
    }
  };

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;
    
    try {
      const { error } = await supabase
        .from("product_catalog")
        .delete()
        .eq("id", productToDelete.id);

      if (error) throw error;
      toast.success("Produto excluído permanentemente");
      loadProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Erro ao excluir produto");
    } finally {
      setDeleteConfirmOpen(false);
      setProductToDelete(null);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormOpen(true);
  };

  const handleNewProduct = () => {
    setEditingProduct(null);
    setFormOpen(true);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.group_key?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase()) ||
    p.color?.toLowerCase().includes(search.toLowerCase())
  );

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const getTotalStock = (stockBySize: unknown): number => {
    if (!stockBySize || typeof stockBySize !== 'object') return 0;
    return Object.values(stockBySize as Record<string, number>).reduce((acc, qty) => acc + (qty || 0), 0);
  };

  const getStockBySize = (stockBySize: unknown): Record<string, number> => {
    if (!stockBySize || typeof stockBySize !== 'object') return {};
    return stockBySize as Record<string, number>;
  };

  // Sort sizes: letter sizes first (PP, P, M, G, GG, etc.), then numeric sizes in ascending order
  const sortSizes = (entries: [string, number][]): [string, number][] => {
    const letterOrder = ["PP", "P", "M", "G", "GG", "XG", "XXG", "XXXG", "UN"];
    
    return entries.sort(([a], [b]) => {
      const aIsLetter = letterOrder.includes(a.toUpperCase());
      const bIsLetter = letterOrder.includes(b.toUpperCase());
      const aIsNumeric = /^\d+$/.test(a);
      const bIsNumeric = /^\d+$/.test(b);
      
      // Letters come first
      if (aIsLetter && !bIsLetter) return -1;
      if (!aIsLetter && bIsLetter) return 1;
      
      // Both are letters - sort by predefined order
      if (aIsLetter && bIsLetter) {
        return letterOrder.indexOf(a.toUpperCase()) - letterOrder.indexOf(b.toUpperCase());
      }
      
      // Both are numeric - sort numerically
      if (aIsNumeric && bIsNumeric) {
        return parseInt(a) - parseInt(b);
      }
      
      // Default alphabetical
      return a.localeCompare(b);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "active" ? "secondary" : "outline"}
            onClick={() => setFilter("active")}
            className="gap-2"
            size="sm"
          >
            Ativos
          </Button>
          <Button
            variant={filter === "archived" ? "secondary" : "outline"}
            onClick={() => setFilter("archived")}
            className="gap-2"
            size="sm"
          >
            <Archive className="h-4 w-4" />
            Arquivados
          </Button>
          <Button
            variant={filter === "imported" ? "secondary" : "outline"}
            onClick={() => setFilter("imported")}
            className="gap-2"
            size="sm"
          >
            <Package className="h-4 w-4" />
            Importados (ERP)
          </Button>
          <Button onClick={handleNewProduct} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Produto
          </Button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Imagem</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-12 h-12 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {product.category && (
                        <span className="text-xs text-muted-foreground">{product.category}</span>
                      )}
                      {product.category && product.color && (
                        <span className="text-xs text-muted-foreground">•</span>
                      )}
                      {product.color ? (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 font-normal">
                          {product.color}
                        </Badge>
                      ) : (
                        <span className="text-xs text-amber-600">Cor pendente</span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {product.group_key ? (
                    <Badge variant="outline" className="font-mono">
                      {product.group_key}
                    </Badge>
                  ) : product.sku ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {product.sku}
                    </span>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  {product.price > 0 ? (
                    <div className="flex flex-col">
                      {hasDiscount(product.discount_type, product.discount_value) ? (
                        <>
                          <span className="font-medium text-green-600">
                            {formatPrice(calculateDiscountedPrice(product.price, product.discount_type, product.discount_value))}
                          </span>
                          <span className="text-xs text-muted-foreground line-through">
                            {formatPrice(product.price)}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 w-fit text-green-600 border-green-200 mt-0.5">
                            <Tag className="h-2.5 w-2.5 mr-0.5" />
                            {getDiscountLabel(product.discount_type, product.discount_value)}
                          </Badge>
                        </>
                      ) : (
                        formatPrice(product.price)
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">A definir</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      // Use available stock from view if available
                      const productAvailableStock = availableStock.get(product.id);
                      
                      if (productAvailableStock && productAvailableStock.size > 0) {
                        // Use the view data (shows available = on_hand - committed - reserved)
                        const entries: [string, AvailableStockEntry][] = Array.from(productAvailableStock.entries());
                        const sortedBySize = sortSizes(entries.map(([size, entry]) => [size, entry.available] as [string, number]));
                        const withAvailable = sortedBySize.filter(([, qty]) => qty > 0);
                        const withoutAvailable = sortedBySize.filter(([, qty]) => qty <= 0);
                        
                        if (sortedBySize.length === 0) {
                          return (
                            <span className="text-xs text-amber-600">
                              ⚠️ Grade não definida
                            </span>
                          );
                        }
                        
                        if (withAvailable.length === 0) {
                          return (
                            <>
                              <span className="text-xs text-amber-600 mr-1">⚠️ Esgotado</span>
                              {withoutAvailable.slice(0, 4).map(([size]) => {
                                const entry = productAvailableStock.get(size);
                                return (
                                  <StockBreakdownTooltip
                                    key={size}
                                    size={size}
                                    stock={entry || null}
                                    hasReservations={(entry?.reserved || 0) > 0}
                                  />
                                );
                              })}
                              {withoutAvailable.length > 4 && (
                                <span className="text-xs text-muted-foreground">+{withoutAvailable.length - 4}</span>
                              )}
                            </>
                          );
                        }
                        
                        return (
                          <>
                            {withAvailable.slice(0, 5).map(([size]) => {
                              const entry = productAvailableStock.get(size);
                              const reserved = entry?.reserved || 0;
                              const committed = entry?.committed || 0;
                              const hasReservations = reserved > 0 || committed > 0;
                              
                              return (
                                <StockBreakdownTooltip
                                  key={size}
                                  size={size}
                                  stock={entry || null}
                                  hasReservations={hasReservations}
                                />
                              );
                            })}
                            {withAvailable.length > 5 && (
                              <span className="text-xs text-muted-foreground">
                                +{withAvailable.length - 5}
                              </span>
                            )}
                          </>
                        );
                      }
                      
                      // Fallback to stock_by_size if view data not available
                      const stock = getStockBySize(product.stock_by_size);
                      const allEntries = Object.entries(stock);
                      const sortedEntries = sortSizes(allEntries);
                      const withStock = sortedEntries.filter(([, qty]) => qty > 0);
                      const withoutStock = sortedEntries.filter(([, qty]) => qty === 0);
                      
                      if (allEntries.length === 0) {
                        return (
                          <span className="text-xs text-amber-600">
                            ⚠️ Grade não definida
                          </span>
                        );
                      }
                      
                      if (withStock.length === 0) {
                        return (
                          <>
                            <span className="text-xs text-amber-600 mr-1">⚠️ Zerado</span>
                            {withoutStock.slice(0, 4).map(([size]) => (
                              <StockBreakdownTooltip
                                key={size}
                                size={size}
                                stock={{ stock: 0, reserved: 0, committed: 0, available: 0 }}
                              />
                            ))}
                            {withoutStock.length > 4 && (
                              <span className="text-xs text-muted-foreground">+{withoutStock.length - 4}</span>
                            )}
                          </>
                        );
                      }
                      
                      // If no view data, create basic entries from stock_by_size
                      return (
                        <>
                          {withStock.slice(0, 5).map(([size, qty]) => (
                            <StockBreakdownTooltip
                              key={size}
                              size={size}
                              stock={{ stock: qty, reserved: 0, committed: 0, available: qty }}
                            />
                          ))}
                          {withStock.length > 5 && (
                            <span className="text-xs text-muted-foreground">
                              +{withStock.length - 5}
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-1">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        product.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {product.is_active ? "Ativo" : "Arquivado"}
                      </span>
                      {product.created_from_import && (
                        <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                          ERP
                        </span>
                      )}
                    </div>
                    {product.is_active && !product.weight_kg && (
                      <span className="text-xs text-amber-600">⚠️ Peso faltando</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(product)}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleArchive(product)}
                      title={product.is_active ? "Arquivar" : "Reativar"}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                    {product.created_from_import && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(product)}
                        title="Excluir permanentemente"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredProducts.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {isLoading ? "Carregando..." : "Nenhum produto encontrado"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Product Form Modal */}
      <ProductForm
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editingProduct ? {
          ...editingProduct,
          sizes: editingProduct.sizes || [],
          tags: editingProduct.tags || [],
          is_active: editingProduct.is_active ?? true,
          stock_by_size: getStockBySize(editingProduct.stock_by_size),
          group_key: editingProduct.group_key,
          created_from_import: editingProduct.created_from_import,
        } : null}
        onSuccess={loadProducts}
        userId={userId}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O produto "{productToDelete?.name}" será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
