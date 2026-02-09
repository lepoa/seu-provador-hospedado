import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Package,
  Plus,
  Trash2,
  Percent,
  DollarSign,
  AlertTriangle,
  ClipboardList,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getTotalStock } from "@/lib/sizeUtils";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
  sku: string | null;
  is_active: boolean;
  stock_by_size: Record<string, number> | null;
  discount_type?: "percentage" | "fixed" | null;
  discount_value?: number | null;
}

export interface ProductDiscountItem {
  product_id: string;
  product_name?: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  price_base?: "current" | "full";
  // Extended info for UI
  image_url?: string;
  original_price?: number;
  sku?: string;
  is_active?: boolean;
}

interface ProductDiscountSelectorProps {
  value: ProductDiscountItem[];
  onChange: (items: ProductDiscountItem[]) => void;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

export function ProductDiscountSelector({
  value,
  onChange,
}: ProductDiscountSelectorProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [bulkSameDiscount, setBulkSameDiscount] = useState(false);
  const [bulkDiscountType, setBulkDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [bulkDiscountValue, setBulkDiscountValue] = useState("");

  // Bulk paste modal
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteLoading, setPasteLoading] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!searchOpen) return;

    const timeout = setTimeout(() => {
      fetchProducts(searchQuery);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, searchOpen]);

  // Initial load when popover opens
  useEffect(() => {
    if (searchOpen) {
      fetchProducts("");
    }
  }, [searchOpen]);

  const fetchProducts = async (query: string) => {
    setIsLoading(true);
    try {
      let builder = supabase
        .from("product_catalog")
        .select("id, name, image_url, price, sku, is_active, stock_by_size, discount_type, discount_value")
        .order("name")
        .limit(50);

      if (query && query.length >= 2) {
        builder = builder.or(`name.ilike.%${query}%,sku.ilike.%${query}%`);
      }

      const { data, error } = await builder;
      if (error) throw error;
      setProducts((data || []) as Product[]);
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter out already selected products
  const availableProducts = useMemo(() => {
    const selectedIds = new Set(value.map((v) => v.product_id));
    return products.filter((p) => !selectedIds.has(p.id));
  }, [products, value]);

  const handleAddProduct = useCallback((product: Product) => {
    // Check if already added
    if (value.some((v) => v.product_id === product.id)) {
      toast.info("Produto já adicionado", { description: product.name });
      return;
    }

    // Check if inactive
    if (!product.is_active) {
      toast.warning("Produto inativo", {
        description: `${product.name} está inativo. Confirme se deseja adicionar.`,
        action: {
          label: "Adicionar mesmo assim",
          onClick: () => addProductToList(product),
        },
      });
      return;
    }

    addProductToList(product);
  }, [value, bulkSameDiscount, bulkDiscountType, bulkDiscountValue]);

  const addProductToList = (product: Product) => {
    const discountType = bulkSameDiscount ? bulkDiscountType : "percentage";
    const discountValue = bulkSameDiscount && bulkDiscountValue ? parseFloat(bulkDiscountValue) : 10;

    const newItem: ProductDiscountItem = {
      product_id: product.id,
      product_name: product.name,
      discount_type: discountType,
      discount_value: discountValue,
      price_base: "current",
      image_url: product.image_url || undefined,
      original_price: product.price,
      sku: product.sku || undefined,
      is_active: product.is_active,
    };

    onChange([...value, newItem]);
    setSearchOpen(false);
    setSearchQuery("");
  };

  const handleRemoveProduct = (productId: string) => {
    onChange(value.filter((v) => v.product_id !== productId));
  };

  const handleUpdateDiscount = (
    productId: string,
    field: "discount_type" | "discount_value" | "price_base",
    newValue: string | number
  ) => {
    onChange(
      value.map((item) =>
        item.product_id === productId
          ? { ...item, [field]: field === "discount_value" ? parseFloat(String(newValue)) || 0 : newValue }
          : item
      )
    );
  };

  const applyBulkDiscount = () => {
    if (!bulkDiscountValue) return;
    const discountVal = parseFloat(bulkDiscountValue);
    onChange(
      value.map((item) => ({
        ...item,
        discount_type: bulkDiscountType,
        discount_value: discountVal,
      }))
    );
    toast.success(`Desconto aplicado a ${value.length} produtos`);
  };

  // Bulk paste handler
  const handlePasteSubmit = async () => {
    if (!pasteText.trim()) return;
    
    setPasteLoading(true);
    try {
      // Parse input: comma, newline, or space separated
      const rawIds = pasteText
        .split(/[\n,;\s]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (rawIds.length === 0) {
        toast.error("Nenhum SKU ou ID válido encontrado");
        return;
      }

      // Search for products by SKU or ID
      const { data, error } = await supabase
        .from("product_catalog")
        .select("id, name, image_url, price, sku, is_active, stock_by_size")
        .or(rawIds.map((id) => `sku.eq.${id},id.eq.${id}`).join(","));

      if (error) throw error;

      const foundProducts = (data || []) as Product[];
      const foundIds = new Set(foundProducts.map((p) => p.sku || p.id));
      const notFound = rawIds.filter((id) => !foundIds.has(id) && !foundProducts.some((p) => p.id === id));

      let added = 0;
      let skipped = 0;

      const existingIds = new Set(value.map((v) => v.product_id));
      const newItems: ProductDiscountItem[] = [];

      for (const product of foundProducts) {
        if (existingIds.has(product.id)) {
          skipped++;
          continue;
        }
        
        newItems.push({
          product_id: product.id,
          product_name: product.name,
          discount_type: bulkDiscountType,
          discount_value: bulkDiscountValue ? parseFloat(bulkDiscountValue) : 10,
          price_base: "current",
          image_url: product.image_url || undefined,
          original_price: product.price,
          sku: product.sku || undefined,
          is_active: product.is_active,
        });
        added++;
      }

      onChange([...value, ...newItems]);

      // Show result
      let message = `${added} produto(s) adicionado(s)`;
      if (skipped > 0) message += `, ${skipped} já existiam`;
      if (notFound.length > 0) message += `, ${notFound.length} não encontrado(s)`;

      toast.success(message, {
        description: notFound.length > 0 ? `Não encontrados: ${notFound.slice(0, 5).join(", ")}${notFound.length > 5 ? "..." : ""}` : undefined,
      });

      setPasteModalOpen(false);
      setPasteText("");
    } catch (err) {
      console.error("Error processing paste:", err);
      toast.error("Erro ao processar lista");
    } finally {
      setPasteLoading(false);
    }
  };

  const calculateFinalPrice = (item: ProductDiscountItem) => {
    if (!item.original_price) return null;
    if (item.discount_type === "percentage") {
      return item.original_price * (1 - item.discount_value / 100);
    }
    return Math.max(0, item.original_price - item.discount_value);
  };

  const validateDiscount = (item: ProductDiscountItem): string | null => {
    if (item.discount_type === "percentage") {
      if (item.discount_value <= 0 || item.discount_value > 90) {
        return "Desconto % deve ser entre 1 e 90";
      }
    } else if (item.discount_type === "fixed") {
      if (item.original_price && item.discount_value >= item.original_price) {
        return "Desconto não pode ser maior que o preço";
      }
    }
    return null;
  };

  // Stats
  const stats = useMemo(() => {
    if (value.length === 0) return null;
    const avgDiscount =
      value.reduce((sum, item) => {
        if (item.discount_type === "percentage") return sum + item.discount_value;
        if (item.original_price && item.original_price > 0) {
          return sum + (item.discount_value / item.original_price) * 100;
        }
        return sum;
      }, 0) / value.length;

    return {
      count: value.length,
      avgDiscount: avgDiscount.toFixed(1),
    };
  }, [value]);

  return (
    <div className="space-y-4">
      {/* Bulk discount toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Switch
            id="bulk-same-discount"
            checked={bulkSameDiscount}
            onCheckedChange={setBulkSameDiscount}
          />
          <Label htmlFor="bulk-same-discount" className="text-sm">
            Aplicar mesmo desconto
          </Label>
        </div>
        {bulkSameDiscount && (
          <div className="flex items-center gap-2">
            <Select
              value={bulkDiscountType}
              onValueChange={(v) => setBulkDiscountType(v as any)}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">%</SelectItem>
                <SelectItem value="fixed">R$</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min="0"
              max={bulkDiscountType === "percentage" ? "90" : undefined}
              placeholder="Valor"
              value={bulkDiscountValue}
              onChange={(e) => setBulkDiscountValue(e.target.value)}
              className="w-24"
            />
            {value.length > 0 && (
              <Button variant="outline" size="sm" onClick={applyBulkDiscount}>
                Aplicar a todos
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Search and actions */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="flex-1 justify-start">
              <Search className="h-4 w-4 mr-2" />
              Buscar produto por nome ou SKU...
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Digite nome ou SKU..."
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                {isLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Buscando...
                  </div>
                ) : availableProducts.length === 0 ? (
                  <CommandEmpty>
                    {searchQuery.length < 2
                      ? "Digite ao menos 2 caracteres"
                      : "Nenhum produto encontrado"}
                  </CommandEmpty>
                ) : (
                  <CommandGroup>
                    {availableProducts.slice(0, 20).map((product) => {
                      const totalStock = getTotalStock(product.stock_by_size);
                      return (
                        <CommandItem
                          key={product.id}
                          value={product.id}
                          onSelect={() => handleAddProduct(product)}
                          className="flex items-center gap-3 p-2"
                        >
                          <div className="w-10 h-10 bg-secondary rounded overflow-hidden shrink-0">
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
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {product.name}
                              </span>
                              {!product.is_active && (
                                <Badge variant="outline" className="text-[10px] px-1">
                                  Inativo
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {product.sku || "Sem SKU"} • {formatPrice(product.price)} • {totalStock} un
                            </div>
                          </div>
                          <Plus className="h-4 w-4 shrink-0" />
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Button variant="outline" onClick={() => setPasteModalOpen(true)}>
          <ClipboardList className="h-4 w-4 mr-2" />
          Colar SKUs
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{stats.count} produto(s) selecionado(s)</span>
          <span>Média: {stats.avgDiscount}% desconto</span>
        </div>
      )}

      {/* Selected products list */}
      {value.length > 0 ? (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {value.map((item) => {
            const finalPrice = calculateFinalPrice(item);
            const error = validateDiscount(item);

            return (
              <div
                key={item.product_id}
                className={cn(
                  "p-3 rounded-lg border",
                  error ? "border-destructive/50 bg-destructive/5" : "bg-muted/30"
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Thumbnail */}
                  <div className="w-12 h-12 bg-secondary rounded overflow-hidden shrink-0">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.product_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">
                        {item.product_name || item.product_id.slice(0, 8)}
                      </span>
                      {item.is_active === false && (
                        <Badge variant="outline" className="text-[10px] px-1">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {item.sku || "—"}
                      {item.original_price && ` • ${formatPrice(item.original_price)}`}
                    </div>

                    {/* Discount controls */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={item.discount_type}
                        onValueChange={(v) =>
                          handleUpdateDiscount(item.product_id, "discount_type", v)
                        }
                      >
                        <SelectTrigger className="w-16 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">
                            <Percent className="h-3 w-3" />
                          </SelectItem>
                          <SelectItem value="fixed">
                            <DollarSign className="h-3 w-3" />
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        max={item.discount_type === "percentage" ? "90" : undefined}
                        step={item.discount_type === "percentage" ? "1" : "0.01"}
                        value={item.discount_value}
                        onChange={(e) =>
                          handleUpdateDiscount(item.product_id, "discount_value", e.target.value)
                        }
                        className="w-20 h-8"
                      />
                      {finalPrice !== null && item.original_price && (
                        <span className="text-sm">
                          <span className="text-muted-foreground line-through">
                            {formatPrice(item.original_price)}
                          </span>
                          {" → "}
                          <span className="font-medium text-green-600">
                            {formatPrice(finalPrice)}
                          </span>
                        </span>
                      )}
                    </div>

                    {error && (
                      <p className="text-xs text-destructive mt-1">{error}</p>
                    )}
                  </div>

                  {/* Remove button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveProduct(item.product_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum produto selecionado</p>
          <p className="text-xs">Use a busca acima para adicionar produtos</p>
        </div>
      )}

      {/* Bulk paste modal */}
      <Dialog open={pasteModalOpen} onOpenChange={setPasteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Colar Lista de SKUs/IDs
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Cole aqui os SKUs ou IDs separados por vírgula, espaço ou nova linha..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              Exemplo: SKU001, SKU002, SKU003 ou um por linha
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasteModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePasteSubmit} disabled={pasteLoading || !pasteText.trim()}>
              {pasteLoading ? "Processando..." : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Processar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
