import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Plus,
  Play,
  GripVertical,
  Trash2,
  Package,
  Eye,
  EyeOff,
  Lock,
  Calendar,
  DollarSign,
  ShoppingBag,
  Search,
  Percent,
  Tag,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLiveEvent, useLiveEvents } from "@/hooks/useLiveEvents";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StockByVariationInput } from "./StockByVariationInput";
import type { LiveProductVisibility, LiveProduct } from "@/types/liveShop";

interface Product {
  id: string;
  name: string;
  image_url: string | null;
  images: string[] | null;
  price: number;
  color: string | null;
  stock_by_size: Record<string, number> | null;
  category: string | null;
  sku: string | null;
}

interface ProductConfig {
  visibilidade: LiveProductVisibility;
  bloquear_desde_planejamento: boolean;
  limite_unidades_live: number | null;
  live_discount_type: 'percentage' | 'fixed' | null;
  live_discount_value: number | null;
  stock_reservations: Record<string, number>;
  reserve_all: boolean;
}

const defaultProductConfig: ProductConfig = {
  visibilidade: 'catalogo_e_live',
  bloquear_desde_planejamento: false,
  limite_unidades_live: null,
  live_discount_type: null,
  live_discount_value: null,
  stock_reservations: {},
  reserve_all: true,
};

export function LivePlanning() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { event, products, kpis, isLoading, addProduct, removeProduct, fetchEvent } = useLiveEvent(eventId);
  const { updateEventStatus } = useLiveEvents();
  
  // Add product modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [availableStock, setAvailableStock] = useState<Map<string, Map<string, number>>>(new Map());
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productConfig, setProductConfig] = useState<ProductConfig>(defaultProductConfig);
  const addModalBodyRef = useRef<HTMLDivElement | null>(null);

  // DEBUG (temporary): validate that modal body is actually scrollable when content overflows.
  useEffect(() => {
    if (!addModalOpen) return;
    if (!import.meta.env.DEV) return;

    // Measure after layout.
    requestAnimationFrame(() => {
      const el = addModalBodyRef.current;
      if (!el) return;
      // eslint-disable-next-line no-console
      console.log("[AddProductModal] body metrics", {
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      });
    });
  }, [addModalOpen, selectedProduct, productConfig.live_discount_type, productConfig.live_discount_value]);

  // Edit product modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingLiveProduct, setEditingLiveProduct] = useState<LiveProduct | null>(null);
  const [editConfig, setEditConfig] = useState<ProductConfig>(defaultProductConfig);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Fetch available products + REAL availability (product_available_stock)
  useEffect(() => {
    const fetchProducts = async () => {
      const { data: productsData, error: productsError } = await supabase
        .from("product_catalog")
        .select("id, name, image_url, images, price, color, stock_by_size, category, sku")
        .eq("is_active", true)
        .order("name");

      if (productsError) {
        console.error("[LivePlanning] Error fetching products:", productsError);
        return;
      }

      const products = (productsData || []) as Product[];
      setAvailableProducts(products);

      const productIds = products.map((p) => p.id).filter(Boolean);
      if (productIds.length === 0) {
        setAvailableStock(new Map());
        return;
      }

      type AvailableRow = { product_id: string; size: string; available: number | null };
      const { data: stockData, error: stockError } = await supabase
        .from("product_available_stock")
        .select("product_id, size, available")
        .in("product_id", productIds);

      if (stockError) {
        console.error("[LivePlanning] Error fetching available stock:", stockError);
        setAvailableStock(new Map());
        return;
      }

      const stockMap = new Map<string, Map<string, number>>();
      (stockData || []).forEach((row: AvailableRow) => {
        const available = Number(row.available || 0);
        if (available <= 0) return;

        if (!stockMap.has(row.product_id)) stockMap.set(row.product_id, new Map());
        stockMap.get(row.product_id)!.set(row.size, available);
      });

      setAvailableStock(stockMap);

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log("[LivePlanning] loaded availability for", stockMap.size, "products");
      }
    };

    fetchProducts();
  }, []);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const getTotalStock = (stock: Record<string, number> | null) => {
    if (!stock) return 0;
    return Object.values(stock).reduce((sum, qty) => sum + (qty || 0), 0);
  };

  const getAvailableStockBySize = (product: Product | LiveProduct["product"] | null): Record<string, number> => {
    if (!product?.id) return {};

    const liveAvailability = availableStock.get(product.id);
    if (liveAvailability && liveAvailability.size > 0) {
      const fromView: Record<string, number> = {};
      liveAvailability.forEach((qty, size) => {
        if ((qty || 0) > 0) {
          fromView[size] = qty;
        }
      });
      return fromView;
    }

    return (product.stock_by_size || {}) as Record<string, number>;
  };

  const handleAddProduct = async () => {
    if (!selectedProduct) return;
    
    const success = await addProduct(selectedProduct.id, productConfig);
    if (success) {
      setAddModalOpen(false);
      setSelectedProduct(null);
      setProductConfig(defaultProductConfig);
    }
  };

  const handleOpenEdit = (lp: LiveProduct) => {
    setEditingLiveProduct(lp);
    // Parse existing snapshot_variantes as stock_reservations if available
    const existingReservations = lp.snapshot_variantes && typeof lp.snapshot_variantes === 'object'
      ? (lp.snapshot_variantes as Record<string, number>)
      : {};
    const totalReserved = Object.values(existingReservations).reduce((sum, qty) => sum + (qty || 0), 0);
    const totalStock = getTotalStock(getAvailableStockBySize(lp.product));
    
    setEditConfig({
      visibilidade: lp.visibilidade,
      bloquear_desde_planejamento: lp.bloquear_desde_planejamento,
      limite_unidades_live: lp.limite_unidades_live,
      live_discount_type: lp.live_discount_type,
      live_discount_value: lp.live_discount_value,
      stock_reservations: existingReservations,
      reserve_all: totalReserved === totalStock && totalStock > 0,
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingLiveProduct) return;
    
    // Calculate total reserved for limite_unidades_live
    const totalReserved = Object.values(editConfig.stock_reservations).reduce((sum, qty) => sum + (qty || 0), 0);
    
    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from("live_products")
        .update({
          visibilidade: editConfig.visibilidade,
          bloquear_desde_planejamento: editConfig.bloquear_desde_planejamento,
          limite_unidades_live: totalReserved > 0 ? totalReserved : editConfig.limite_unidades_live,
          live_discount_type: editConfig.live_discount_type,
          live_discount_value: editConfig.live_discount_value,
          snapshot_variantes: editConfig.stock_reservations,
        })
        .eq("id", editingLiveProduct.id);

      if (error) throw error;

      toast.success("Produto atualizado!");
      setEditModalOpen(false);
      setEditingLiveProduct(null);
      fetchEvent();
    } catch (err: any) {
      console.error("Error updating live product:", err);
      toast.error("Erro ao atualizar produto");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleStartLive = async () => {
    if (!event) return;
    const success = await updateEventStatus(event.id, 'ao_vivo');
    if (success) {
      navigate(`/dashboard/lives/${event.id}/backstage`);
    }
  };

  // Filter products already in live
  const productIdsInLive = new Set(products.map(p => p.product_id));
  const filteredProducts = availableProducts.filter(p => {
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const notInLive = !productIdsInLive.has(p.id);
    return matchesSearch && notInLive;
  });

  if (isLoading || !event) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid md:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/dashboard?tab=lives")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-serif text-2xl font-semibold">{event.titulo}</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {format(new Date(event.data_hora_inicio), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
        <Button 
          className="gap-2 bg-red-600 hover:bg-red-700"
          onClick={handleStartLive}
          disabled={products.length === 0}
        >
          <Play className="h-4 w-4" />
          Iniciar Live
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Package className="h-4 w-4" />
              Produtos
            </div>
            <div className="text-2xl font-semibold">{products.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <ShoppingBag className="h-4 w-4" />
              Itens Planejados
            </div>
            <div className="text-2xl font-semibold">{kpis.totalPlanejado.itens}</div>
          </CardContent>
        </Card>
        <Card className="col-span-2">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-4 w-4" />
              Valor Planejado
            </div>
            <div className="text-2xl font-semibold">{formatPrice(kpis.totalPlanejado.valor)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Products List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Produtos da Live</CardTitle>
          <Button onClick={() => setAddModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Produto
          </Button>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum produto adicionado ainda</p>
              <p className="text-sm">Adicione produtos para planejar sua live</p>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map((lp, index) => {
                const product = lp.product;
                if (!product) return null;

                // CRITICAL: “unid.” must reflect SUM(product_available_stock.available)
                // (useLiveEvent injects product.available_by_size already filtered to available > 0)
                const availableBySize = (product as any).available_by_size as Record<string, number> | undefined;
                const totalAvailable = availableBySize
                  ? Object.values(availableBySize).reduce((sum, qty) => sum + (qty || 0), 0)
                  : 0;

                if (import.meta.env.DEV) {
                  const rawTotal = getTotalStock(product.stock_by_size);
                  if (rawTotal !== totalAvailable) {
                    // eslint-disable-next-line no-console
                    console.log("[LivePlanning][Produtos da Live] units source", {
                      product_id: product.id,
                      total_available: totalAvailable,
                      available_by_size: availableBySize || {},
                      raw_total_on_hand: rawTotal,
                      stock_by_size: product.stock_by_size,
                      limite_unidades_live: lp.limite_unidades_live,
                      snapshot_variantes: lp.snapshot_variantes,
                    });
                  }
                }

                return (
                  <div 
                    key={lp.id}
                    className="flex items-center gap-4 p-3 border rounded-lg bg-card hover:bg-muted/30 transition-colors"
                  >
                    {/* Drag Handle */}
                    <div className="cursor-grab text-muted-foreground hover:text-foreground">
                      <GripVertical className="h-5 w-5" />
                    </div>

                    {/* Order Number */}
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>

                    {/* Image */}
                    <div className="w-16 h-16 bg-secondary rounded-lg overflow-hidden shrink-0">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{product.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                        {product.color && (
                          <span className="bg-secondary px-2 py-0.5 rounded text-xs">
                            {product.color}
                          </span>
                        )}
                        {lp.live_discount_type && lp.live_discount_value ? (
                          <>
                            <span className="text-green-600 font-medium">
                              {formatPrice(
                                lp.live_discount_type === 'percentage'
                                  ? product.price * (1 - lp.live_discount_value / 100)
                                  : Math.max(0, product.price - lp.live_discount_value)
                              )}
                            </span>
                            <span className="line-through opacity-50">{formatPrice(product.price)}</span>
                          </>
                        ) : (
                          <span>{formatPrice(product.price)}</span>
                        )}
                        <span>•</span>
                        <span>{totalAvailable} unid.</span>
                      </div>
                    </div>

                    {/* Visibility Badge */}
                    <Badge 
                      variant={lp.visibilidade === 'exclusivo_live' ? 'default' : 'outline'}
                      className="shrink-0 gap-1"
                    >
                      {lp.visibilidade === 'exclusivo_live' ? (
                        <>
                          <EyeOff className="h-3 w-3" />
                          Exclusivo
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3" />
                          Catálogo + Live
                        </>
                      )}
                    </Badge>

                    {/* Lock Badge */}
                    {lp.bloquear_desde_planejamento && (
                      <Badge variant="secondary" className="shrink-0 gap-1">
                        <Lock className="h-3 w-3" />
                        Bloqueado
                      </Badge>
                    )}

                    {/* Edit Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => handleOpenEdit(lp)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>

                    {/* Remove Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive shrink-0"
                      onClick={() => removeProduct(lp.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Product Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="p-0 w-[min(920px,95vw)] max-h-[85vh] !flex !flex-col overflow-hidden">
          <div className="px-6 py-4 border-b shrink-0">
            <DialogHeader className="p-0 m-0">
              <DialogTitle>Adicionar Produto à Live</DialogTitle>
              <DialogDescription>
                Selecione um produto e configure as opções para a live
              </DialogDescription>
            </DialogHeader>
          </div>

          <div ref={addModalBodyRef} className="px-6 py-4 flex-1 min-h-0 overflow-y-auto">
            {!selectedProduct ? (
              <div>
                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, SKU ou categoria..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Products Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {filteredProducts.map((product) => {
                    const productAvailability = availableStock.get(product.id);
                    const totalAvailable = productAvailability
                      ? Array.from(productAvailability.values()).reduce((sum, qty) => sum + (qty || 0), 0)
                      : 0;

                    if (import.meta.env.DEV) {
                      const rawTotal = getTotalStock(product.stock_by_size);
                      if (rawTotal !== totalAvailable) {
                        // eslint-disable-next-line no-console
                        console.log("[LivePlanning][Add Modal list] units source", {
                          product_id: product.id,
                          total_available: totalAvailable,
                          available_by_size: productAvailability
                            ? Object.fromEntries(productAvailability.entries())
                            : {},
                          raw_total_on_hand: rawTotal,
                          stock_by_size: product.stock_by_size,
                        });
                      }
                    }

                    return (
                      <button
                        key={product.id}
                        className="flex items-center gap-3 p-3 border rounded-lg text-left hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedProduct(product)}
                      >
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
                          <div className="font-medium text-sm truncate">{product.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatPrice(product.price)} • {totalAvailable} unid.
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <div className="col-span-2 text-center py-8 text-muted-foreground">
                      Nenhum produto encontrado
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Selected Product Preview */}
                <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                  <div className="w-16 h-16 bg-secondary rounded overflow-hidden shrink-0">
                    {selectedProduct.image_url ? (
                      <img
                        src={selectedProduct.image_url}
                        alt={selectedProduct.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{selectedProduct.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {(() => {
                        const productAvailability = availableStock.get(selectedProduct.id);
                        const totalAvailable = productAvailability
                          ? Array.from(productAvailability.values()).reduce((sum, qty) => sum + (qty || 0), 0)
                          : 0;

                        if (import.meta.env.DEV) {
                          const rawTotal = getTotalStock(selectedProduct.stock_by_size);
                          if (rawTotal !== totalAvailable) {
                            // eslint-disable-next-line no-console
                            console.log("[LivePlanning][Add Modal selected] units source", {
                              product_id: selectedProduct.id,
                              total_available: totalAvailable,
                              available_by_size: productAvailability
                                ? Object.fromEntries(productAvailability.entries())
                                : {},
                              raw_total_on_hand: rawTotal,
                              stock_by_size: selectedProduct.stock_by_size,
                            });
                          }
                        }

                        return (
                          <>
                            {formatPrice(selectedProduct.price)} • {totalAvailable} unid.
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedProduct(null)}>
                    Trocar
                  </Button>
                </div>

                {/* Configuration */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Visibilidade</Label>
                    <Select
                      value={productConfig.visibilidade}
                      onValueChange={(v) =>
                        setProductConfig((prev) => ({
                          ...prev,
                          visibilidade: v as LiveProductVisibility,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="catalogo_e_live">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            Catálogo + Live
                          </div>
                        </SelectItem>
                        <SelectItem value="exclusivo_live">
                          <div className="flex items-center gap-2">
                            <EyeOff className="h-4 w-4" />
                            Exclusivo da Live
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {productConfig.visibilidade === "exclusivo_live"
                        ? "O produto ficará oculto no catálogo durante a live"
                        : "O produto continuará visível no catálogo, mas respeitará reservas"}
                    </p>
                  </div>

                  {productConfig.visibilidade === "exclusivo_live" && (
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <Label>Bloquear desde o planejamento</Label>
                        <p className="text-xs text-muted-foreground">
                          Oculta o produto do catálogo antes mesmo de iniciar a live
                        </p>
                      </div>
                      <Switch
                        checked={productConfig.bloquear_desde_planejamento}
                        onCheckedChange={(checked) =>
                          setProductConfig((prev) => ({
                            ...prev,
                            bloquear_desde_planejamento: checked,
                          }))
                        }
                      />
                    </div>
                  )}

                  {/* Stock Reservations by Size */}
                  <div className="space-y-2 border-t pt-4">
                    <Label className="font-medium">Reserva de estoque por tamanho</Label>
                    <StockByVariationInput
                      stockBySize={getAvailableStockBySize(selectedProduct)}
                      value={productConfig.stock_reservations}
                      onChange={(value) =>
                        setProductConfig((prev) => ({
                          ...prev,
                          stock_reservations: value,
                        }))
                      }
                      reserveAll={productConfig.reserve_all}
                      onReserveAllChange={(value) =>
                        setProductConfig((prev) => ({
                          ...prev,
                          reserve_all: value,
                        }))
                      }
                    />
                  </div>

                  {/* Live Discount */}
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      <Label className="font-medium">Desconto exclusivo da Live</Label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Tipo de desconto</Label>
                        <Select
                          value={productConfig.live_discount_type || "_none"}
                          onValueChange={(v) =>
                            setProductConfig((prev) => ({
                              ...prev,
                              live_discount_type:
                                v === "_none" ? null : (v as "percentage" | "fixed"),
                              live_discount_value: v === "_none" ? null : prev.live_discount_value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sem desconto" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Sem desconto</SelectItem>
                            <SelectItem value="percentage">
                              <span className="flex items-center gap-2">
                                <Percent className="h-3.5 w-3.5" />
                                Porcentagem
                              </span>
                            </SelectItem>
                            <SelectItem value="fixed">
                              <span className="flex items-center gap-2">
                                <DollarSign className="h-3.5 w-3.5" />
                                Valor fixo
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {productConfig.live_discount_type && (
                        <div className="space-y-2">
                          <Label>
                            {productConfig.live_discount_type === "percentage"
                              ? "Desconto (%)"
                              : "Desconto (R$)"}
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            max={productConfig.live_discount_type === "percentage" ? 100 : undefined}
                            step={productConfig.live_discount_type === "percentage" ? 1 : 0.01}
                            placeholder={
                              productConfig.live_discount_type === "percentage"
                                ? "Ex: 10"
                                : "Ex: 15.00"
                            }
                            value={productConfig.live_discount_value || ""}
                            onChange={(e) =>
                              setProductConfig((prev) => ({
                                ...prev,
                                live_discount_value: e.target.value
                                  ? parseFloat(e.target.value)
                                  : null,
                              }))
                            }
                          />
                        </div>
                      )}
                    </div>

                    {productConfig.live_discount_type && productConfig.live_discount_value && (
                      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                        <p className="text-sm text-green-700 dark:text-green-400">
                          Preço na live:{" "}
                          <span className="font-bold">
                            {formatPrice(
                              productConfig.live_discount_type === "percentage"
                                ? selectedProduct.price * (1 - productConfig.live_discount_value / 100)
                                : Math.max(0, selectedProduct.price - productConfig.live_discount_value)
                            )}
                          </span>
                          <span className="text-xs ml-2 line-through opacity-70">
                            {formatPrice(selectedProduct.price)}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAddModalOpen(false);
                setSelectedProduct(null);
              }}
            >
              Cancelar
            </Button>
            {selectedProduct && (
              <Button onClick={handleAddProduct} className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar à Live
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Product Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="p-0 w-[min(600px,95vw)] max-h-[85vh] !flex !flex-col overflow-hidden">
          <div className="px-6 py-4 border-b shrink-0">
            <DialogHeader className="p-0 m-0 space-y-1">
              <DialogTitle>Editar Produto na Live</DialogTitle>
              <DialogDescription>
                Altere as configurações de reserva e desconto
              </DialogDescription>
            </DialogHeader>
          </div>

          {editingLiveProduct && editingLiveProduct.product && (
            <div className="px-6 py-4 flex-1 min-h-0 overflow-y-auto">
              <div className="space-y-4">
                {/* Product Preview */}
                <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                  <div className="w-16 h-16 bg-secondary rounded overflow-hidden shrink-0">
                    {editingLiveProduct.product.image_url ? (
                      <img 
                        src={editingLiveProduct.product.image_url} 
                        alt={editingLiveProduct.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{editingLiveProduct.product.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatPrice(editingLiveProduct.product.price)} • {getTotalStock(editingLiveProduct.product.stock_by_size)} unid.
                    </div>
                  </div>
                </div>

              {/* Edit Configuration */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Visibilidade</Label>
                  <Select
                    value={editConfig.visibilidade}
                    onValueChange={(v) => setEditConfig(prev => ({ 
                      ...prev, 
                      visibilidade: v as LiveProductVisibility 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="catalogo_e_live">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          Catálogo + Live
                        </div>
                      </SelectItem>
                      <SelectItem value="exclusivo_live">
                        <div className="flex items-center gap-2">
                          <EyeOff className="h-4 w-4" />
                          Exclusivo da Live
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {editConfig.visibilidade === 'exclusivo_live' && (
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <Label>Bloquear desde o planejamento</Label>
                      <p className="text-xs text-muted-foreground">
                        Oculta o produto do catálogo antes da live
                      </p>
                    </div>
                    <Switch
                      checked={editConfig.bloquear_desde_planejamento}
                      onCheckedChange={(checked) => setEditConfig(prev => ({
                        ...prev,
                        bloquear_desde_planejamento: checked
                      }))}
                    />
                  </div>
                )}

                {/* Stock Reservations by Size */}
                <div className="space-y-2 border-t pt-4">
                  <Label className="font-medium">Reserva de estoque por tamanho</Label>
                  <StockByVariationInput
                    stockBySize={getAvailableStockBySize(editingLiveProduct.product)}
                    value={editConfig.stock_reservations}
                    onChange={(value) => setEditConfig(prev => ({
                      ...prev,
                      stock_reservations: value
                    }))}
                    reserveAll={editConfig.reserve_all}
                    onReserveAllChange={(value) => setEditConfig(prev => ({
                      ...prev,
                      reserve_all: value
                    }))}
                  />
                </div>

                {/* Live Discount */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary" />
                    <Label className="font-medium">Desconto exclusivo da Live</Label>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Tipo de desconto</Label>
                      <Select
                        value={editConfig.live_discount_type || "_none"}
                        onValueChange={(v) => setEditConfig(prev => ({
                          ...prev,
                          live_discount_type: v === "_none" ? null : v as 'percentage' | 'fixed',
                          live_discount_value: v === "_none" ? null : prev.live_discount_value
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sem desconto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Sem desconto</SelectItem>
                          <SelectItem value="percentage">
                            <span className="flex items-center gap-2">
                              <Percent className="h-3.5 w-3.5" />
                              Porcentagem
                            </span>
                          </SelectItem>
                          <SelectItem value="fixed">
                            <span className="flex items-center gap-2">
                              <DollarSign className="h-3.5 w-3.5" />
                              Valor fixo
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {editConfig.live_discount_type && (
                      <div className="space-y-2">
                        <Label>
                          {editConfig.live_discount_type === 'percentage' ? 'Desconto (%)' : 'Desconto (R$)'}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={editConfig.live_discount_type === 'percentage' ? 100 : undefined}
                          step={editConfig.live_discount_type === 'percentage' ? 1 : 0.01}
                          placeholder={editConfig.live_discount_type === 'percentage' ? 'Ex: 10' : 'Ex: 15.00'}
                          value={editConfig.live_discount_value || ""}
                          onChange={(e) => setEditConfig(prev => ({
                            ...prev,
                            live_discount_value: e.target.value ? parseFloat(e.target.value) : null
                          }))}
                        />
                      </div>
                    )}
                  </div>

                  {editConfig.live_discount_type && editConfig.live_discount_value && (
                    <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <p className="text-sm text-green-700 dark:text-green-400">
                        Preço na live:{" "}
                        <span className="font-bold">
                          {formatPrice(
                            editConfig.live_discount_type === 'percentage'
                              ? editingLiveProduct.product.price * (1 - editConfig.live_discount_value / 100)
                              : Math.max(0, editingLiveProduct.product.price - editConfig.live_discount_value)
                          )}
                        </span>
                        <span className="text-xs ml-2 line-through opacity-70">
                          {formatPrice(editingLiveProduct.product.price)}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
              </div>
            </div>
          )}

          <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setEditModalOpen(false);
                setEditingLiveProduct(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
