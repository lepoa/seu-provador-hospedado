import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Radio,
  Square,
  Search,
  Package,
  ShoppingCart,
  Users,
  Clock,
  Plus,
  Minus,
  X,
  AlertCircle,
  CheckCircle,
  MessageCircle,
  CreditCard,
  HelpCircle,
  ListOrdered,
  DollarSign,
  Loader2,
  ExternalLink,
  BarChart3,
  MoreVertical,
  UserPlus,
  Copy,
  Check,
  User,
  Banknote,
  Store,
  XCircle,
  Pencil,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/dialog";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLiveEvent, useLiveEvents } from "@/hooks/useLiveEvents";
import { useLiveBackstage } from "@/hooks/useLiveBackstage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sortSizes } from "@/lib/sizeUtils";
import { buildWhatsAppLink } from "@/lib/whatsappHelpers";
import { calculateDiscountedPrice, hasDiscount, getDiscountLabel } from "@/lib/discountUtils";
import type { LiveProduct, LiveCart, LiveCartItem } from "@/types/liveShop";

// Import new modular components
import { WhoGotItModal } from "./WhoGotItModal";
import { AddProductsModal } from "./AddProductsModal";
import { EditLiveProductModal } from "./EditLiveProductModal";
import { EnhancedWaitlistModal } from "./EnhancedWaitlistModal";
import { WaitlistOfferModal } from "./WaitlistOfferModal";
import { PendingCartsAlert } from "./PendingCartsAlert";
import { CartStatusHistory } from "./CartStatusHistory";
import { WaitlistBadge } from "./WaitlistBadge";
import { WaitlistDrawer } from "./WaitlistDrawer";
import { WaitlistAlert } from "./WaitlistAlert";
import { WaitlistTab } from "./WaitlistTab";
import { LiveRaffle } from "./LiveRaffle";
import { BackstageCartModal } from "./BackstageCartModal";

export function LiveBackstage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { event, products, kpis, isLoading: eventLoading, fetchEvent } = useLiveEvent(eventId);
  const { updateEventStatus } = useLiveEvents();
  
  // State for pausing refetch during raffle overlay
  const [isRaffleOverlayActive, setIsRaffleOverlayActive] = useState(false);
  
  const { 
    customers, 
    carts, 
    waitlist, 
    isLoading: backstageLoading,
    quickLaunch,
    removeCartItem,
    reduceItemQuantity,
    cancelItemForSeparation,
    addToWaitlist,
    allocateFromWaitlist,
    skipWaitlistEntry,
    endWaitlistQueue,
    getWaitlistCount,
    getNextWaitlistEntry,
    checkCustomerHasProduct,
    fetchBackstageData,
    generatePaymentLink,
    updateCartStatus,
    fetchCartStatusHistory,
  } = useLiveBackstage(eventId, isRaffleOverlayActive);

  // Quick launcher state
  const [instagram, setInstagram] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);

  // Search state
  const [productSearch, setProductSearch] = useState("");
  const [cartSearch, setCartSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState<"all" | "registered" | "new">("all");

  // Modal state
  const [whoGotItModal, setWhoGotItModal] = useState(false);
  const [addProductsModal, setAddProductsModal] = useState(false);
  const [cartDetailModal, setCartDetailModal] = useState<LiveCart | null>(null);
  const [waitlistModal, setWaitlistModal] = useState<{ 
    productId: string; 
    productName: string;
    productColor?: string;
    size: string;
  } | null>(null);
  const [waitlistOfferModal, setWaitlistOfferModal] = useState<{
    waitlistItem: typeof waitlist[0] | null;
    product: LiveProduct | null;
  } | null>(null);
  const [waitlistDrawer, setWaitlistDrawer] = useState<{
    productId: string;
    productName: string;
    productColor?: string;
    size: string;
  } | null>(null);
  const [waitlistTabOpen, setWaitlistTabOpen] = useState(false);
  const [editProductModal, setEditProductModal] = useState<LiveProduct | null>(null);
  const [raffleDrawer, setRaffleDrawer] = useState(false);
  
  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<"produtos" | "lancador" | "carrinhos" | "fila">("lancador");

  // Payment loading state
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
  
  // Quick launch loading state - prevents double-clicks
  const [isQuickLaunching, setIsQuickLaunching] = useState(false);
  
  // Manual status change state
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Cancel item confirmation dialog state
  const [cancelItemConfirm, setCancelItemConfirm] = useState<{
    itemId: string;
    productName: string;
    size: string;
  } | null>(null);

  // Cart status history state
  const [cartHistory, setCartHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reservedStock, setReservedStock] = useState<Record<string, Record<string, number>>>({});

  // Calculate real-time live metrics from carts (updates automatically with any cart change)
  // IMPORTANT: Only counts PRODUCTS (not gifts/brindes) and excludes cancelled items
  const liveMetrics = useMemo(() => {
    // Filter active carts (not cancelled)
    const activeCarts = carts.filter(c => c.status !== 'cancelado');
    
    // Count unique customers with at least 1 active product item
    const customersWithProducts = new Set<string>();
    
    // Calculate total items and value from active cart items (PRODUCTS ONLY)
    let totalItems = 0;
    let totalValue = 0;
    
    activeCarts.forEach(cart => {
      const items = cart.items || [];
      let hasActiveProducts = false;
      
      items.forEach(item => {
        // Only count active items (reservado, confirmado) - exclude cancelled, removed, etc.
        // live_cart_items are always products (gifts come from order_gifts table)
        if (['reservado', 'confirmado'].includes(item.status)) {
          totalItems += item.qtd;
          totalValue += item.preco_unitario * item.qtd;
          hasActiveProducts = true;
        }
      });
      
      // Only count customer if they have at least 1 active product
      if (hasActiveProducts) {
        customersWithProducts.add(cart.live_customer_id);
      }
    });
    
    return { totalItems, totalCustomers: customersWithProducts.size, totalValue };
  }, [carts]);

  // NOTE: reservedStock is kept ONLY for waitlist detection (checking if this live has reservations)
  // but NOT for stock calculation - product_available_stock.available already includes all reservations
  // DO NOT subtract reservedStock from available - it would be double-counting!
  useEffect(() => {
    const stockMap: Record<string, Record<string, number>> = {};
    
    carts.forEach(cart => {
      (cart.items || []).forEach(item => {
        if (['reservado', 'confirmado'].includes(item.status)) {
          const productId = item.product_id;
          const size = (item.variante as any)?.tamanho || '';
          
          if (!stockMap[productId]) stockMap[productId] = {};
          stockMap[productId][size] = (stockMap[productId][size] || 0) + item.qtd;
        }
      });
    });
    
    setReservedStock(stockMap);
  }, [carts]);

  // Sync cart detail modal with updated carts data
  useEffect(() => {
    if (cartDetailModal) {
      const updatedCart = carts.find(c => c.id === cartDetailModal.id);
      if (updatedCart && JSON.stringify(updatedCart) !== JSON.stringify(cartDetailModal)) {
        setCartDetailModal(updatedCart);
      }
    }
  }, [carts, cartDetailModal]);

  // Load cart history when modal opens
  useEffect(() => {
    if (cartDetailModal) {
      setHistoryLoading(true);
      fetchCartStatusHistory(cartDetailModal.id).then(history => {
        setCartHistory(history);
        setHistoryLoading(false);
      });
    } else {
      setCartHistory([]);
    }
  }, [cartDetailModal?.id]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  // FIXED: Use available directly from product_available_stock view
  // DO NOT subtract reservedStock - the view already accounts for all reservations
  const getAvailableStock = (productId: string, size: string, availableFromView: number) => {
    return Math.max(0, availableFromView);
  };

  const handleQuickLaunch = async () => {
    if (!instagram.trim() || !selectedProductId || !selectedSize) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // CRITICAL: Prevent double-clicks - return early if already in progress
    if (isQuickLaunching) {
      console.log("[handleQuickLaunch] Already in progress, ignoring duplicate click");
      return;
    }

    setIsQuickLaunching(true);
    console.log("[handleQuickLaunch] Starting - button disabled");

    try {
      const success = await quickLaunch({
        instagram_handle: instagram.trim(),
        product_id: selectedProductId,
        cor: selectedColor || undefined,
        tamanho: selectedSize,
        qtd: quantity,
      });

      console.log("[handleQuickLaunch] RPC returned, success:", success);

      if (success) {
        // Clear form
        setInstagram("");
        setSelectedSize("");
        setQuantity(1);
        fetchEvent();
      }
    } finally {
      setIsQuickLaunching(false);
      console.log("[handleQuickLaunch] Complete - button re-enabled");
    }
  };

  const handleEndLive = async () => {
    if (!event) return;
    if (confirm("Tem certeza que deseja encerrar a live?")) {
      await updateEventStatus(event.id, 'encerrada');
      navigate(`/dashboard/lives/${event.id}/relatorio`);
    }
  };

  // Handle enhanced waitlist submission
  const handleEnhancedWaitlistSubmit = async (data: {
    instagram: string;
    nome?: string;
    whatsapp?: string;
    observacao?: string;
  }) => {
    if (!waitlistModal) return false;
    
    const success = await addToWaitlist(
      waitlistModal.productId,
      { cor: waitlistModal.productColor, tamanho: waitlistModal.size },
      data.instagram,
      data.whatsapp,
      data.nome,
      data.observacao
    );

    return success;
  };

  // Handle offer from waitlist
  const handleWaitlistOffer = async (waitlistId: string) => {
    return await allocateFromWaitlist(waitlistId);
  };

  // Handle skip waitlist entry
  const handleSkipWaitlist = async (waitlistId: string) => {
    await skipWaitlistEntry(waitlistId);
    // Check if there's another entry
    const nextEntry = waitlist.find(w => w.id !== waitlistId && w.status === 'ativa');
    if (nextEntry) {
      const product = products.find(p => p.product_id === nextEntry.product_id);
      setWaitlistOfferModal({ waitlistItem: nextEntry, product: product || null });
    } else {
      setWaitlistOfferModal(null);
    }
  };

  // Handle end waitlist queue
  const handleEndWaitlistQueue = async (productId: string, size: string) => {
    await endWaitlistQueue(productId, size);
    setWaitlistDrawer(null);
  };

  // Get waitlist entries for a specific product/size
  const getWaitlistEntries = (productId: string, size: string) => {
    return waitlist.filter(w => 
      w.product_id === productId && 
      (w.variante as any)?.tamanho === size
    );
  };

  // Handle offer from waitlist alert
  const handleWaitlistAlertOffer = (entry: typeof waitlist[0], product: LiveProduct) => {
    setWaitlistOfferModal({ waitlistItem: entry, product });
  };

  const handleGeneratePayment = async (cartId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    setPaymentLoading(cartId);
    const result = await generatePaymentLink(cartId);
    setPaymentLoading(null);
    
    if (result.success && result.checkoutUrl) {
      // Open payment link in new tab
      window.open(result.checkoutUrl, '_blank');
    }
  };

  const selectedProduct = products.find(p => p.product_id === selectedProductId);

  // Filter products
  const filteredProducts = products.filter(p => {
    if (!productSearch) return true;
    const product = p.product;
    if (!product) return false;
    return product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
           product.sku?.toLowerCase().includes(productSearch.toLowerCase());
  });

  // Filter carts
  const filteredCarts = carts.filter(c => {
    // Apply search filter
    const matchesSearch = !cartSearch || 
      c.live_customer?.instagram_handle.toLowerCase().includes(cartSearch.toLowerCase()) ||
      c.live_customer?.nome?.toLowerCase().includes(cartSearch.toLowerCase());
    
    // Apply customer type filter
    const isRegistered = !!c.live_customer?.client_id;
    const matchesCustomerFilter = 
      customerFilter === "all" ||
      (customerFilter === "registered" && isRegistered) ||
      (customerFilter === "new" && !isRegistered);
    
    return matchesSearch && matchesCustomerFilter;
  });

  // Count for filter badges
  const registeredCount = carts.filter(c => c.live_customer?.client_id).length;
  const newCount = carts.filter(c => !c.live_customer?.client_id).length;

  const isLoading = eventLoading || backstageLoading;

  // Render product card
  const renderProductCard = (lp: LiveProduct) => {
    const product = lp.product;
    if (!product) return null;
    
    // Use stock_by_size for the FULL list of registered sizes (including sold-out)
    // Use available_by_size for actual availability quantities
    const stockBySize = (product as any).stock_by_size || {};
    const availableBySize = (product as any).available_by_size || {};
    const sizes = sortSizes(Object.keys(stockBySize));
    
    // Check if any size is out of stock with waitlist
    const totalWaitlistForProduct = sizes.reduce((sum, size) => {
      return sum + getWaitlistCount(lp.product_id, size);
    }, 0);

    // Check if any out-of-stock size has available stock now (released)
    // FIXED: Use available directly - DO NOT subtract reservedStock (already included in view)
    const hasReleasedStock = sizes.some(size => {
      const available = availableBySize[size] || 0;
      const waitlistCount = getWaitlistCount(lp.product_id, size);
      return available > 0 && waitlistCount > 0;
    });

    // Calculate total available stock (already filtered to > 0)
    // FIXED: Use available directly from view - no double subtraction
    const totalAvailable = sizes.reduce((sum, size) => {
      const available = availableBySize[size] || 0;
      return sum + Math.max(0, available);
    }, 0);

    const isFullyOutOfStock = totalAvailable === 0;

    return (
      <div 
        key={lp.id}
        className={`p-3 rounded-lg border transition-colors cursor-pointer ${
          selectedProductId === lp.product_id 
            ? 'border-primary bg-primary/5' 
            : hasReleasedStock
              ? 'border-amber-300 bg-amber-50/50'
              : isFullyOutOfStock
                ? 'opacity-60 hover:opacity-100'
                : 'hover:bg-muted/50'
        }`}
        onClick={() => {
          setSelectedProductId(lp.product_id);
          setSelectedColor(product.color || "");
          setSelectedSize("");
          setMobileTab("lancador");
        }}
      >
        {/* Mobile-optimized product card layout */}
        <div className="flex items-start gap-2 sm:gap-3">
          {/* Thumbnail */}
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-secondary rounded overflow-hidden shrink-0 relative">
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
            {isFullyOutOfStock && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-[8px] sm:text-[10px] font-bold text-white">ESGOTADO</span>
              </div>
            )}
          </div>
          
          {/* Content area - flexible */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="font-medium text-sm leading-tight truncate">{product.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {hasDiscount(lp.live_discount_type, lp.live_discount_value) ? (
                <>
                  <span className="text-destructive font-medium">
                    {formatPrice(calculateDiscountedPrice(product.price, lp.live_discount_type, lp.live_discount_value))}
                  </span>
                  <span className="line-through ml-1 opacity-60">{formatPrice(product.price)}</span>
                </>
              ) : (
                formatPrice(product.price)
              )}
              {product.color && <span className="hidden sm:inline"> • {product.color}</span>}
            </div>
            {/* Badges row */}
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {hasDiscount(lp.live_discount_type, lp.live_discount_value) && (
                <Badge className="text-[10px] px-1.5 py-0 h-4 bg-destructive text-destructive-foreground">
                  {getDiscountLabel(lp.live_discount_type, lp.live_discount_value)}
                </Badge>
              )}
              {lp.visibilidade === 'exclusivo_live' && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  Exclusivo
                </Badge>
              )}
            </div>
          </div>
          
          {/* Edit button - fixed position */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              setEditProductModal(lp);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Size chips - using AVAILABLE stock */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {sizes.map(size => {
            // FIXED: Use available directly from product_available_stock view
            // DO NOT subtract reservedStock - the view already includes all reservations
            const available = availableBySize[size] || 0;
            const isOutOfStock = available <= 0;
            const waitlistCount = getWaitlistCount(lp.product_id, size);
            const hasWaitlistWithStock = available > 0 && waitlistCount > 0;

            return (
              <Tooltip key={size}>
                <TooltipTrigger asChild>
                  <button
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                      hasWaitlistWithStock
                        ? 'bg-amber-500 text-white animate-pulse'
                        : isOutOfStock 
                          ? 'bg-destructive/10 text-destructive line-through' 
                          : available <= 2
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (waitlistCount > 0) {
                        // Open waitlist drawer
                        setWaitlistDrawer({
                          productId: lp.product_id,
                          productName: product.name,
                          productColor: product.color || undefined,
                          size
                        });
                      } else if (isOutOfStock) {
                        setWaitlistModal({ 
                          productId: lp.product_id, 
                          productName: product.name,
                          productColor: product.color || undefined,
                          size 
                        });
                      } else {
                        setSelectedProductId(lp.product_id);
                        setSelectedColor(product.color || "");
                        setSelectedSize(size);
                        setMobileTab("lancador");
                      }
                    }}
                  >
                    {size}
                    {waitlistCount > 0 && (
                      <span className="ml-1">({waitlistCount})</span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {hasWaitlistWithStock 
                    ? `⚠️ Estoque liberado! ${waitlistCount} na fila`
                    : waitlistCount > 0
                      ? `Esgotado - ${waitlistCount} na lista de espera`
                      : isOutOfStock 
                        ? "Esgotado - Clique para lista de espera" 
                        : `${available} disponíveis`}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Waitlist indicator row */}
        {totalWaitlistForProduct > 0 && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed">
            <div className="flex items-center gap-1 text-xs text-amber-700">
              <ListOrdered className="h-3 w-3" />
              <span>{totalWaitlistForProduct} na lista de espera</span>
            </div>
            {hasReleasedStock && (
              <Badge className="bg-amber-500 text-white text-xs animate-pulse">
                Estoque liberado!
              </Badge>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render quick launcher content
  const renderQuickLauncher = () => (
    <div className="space-y-4">
      {/* Instagram Handle */}
      <div className="space-y-2">
        <Label>@ do Instagram *</Label>
        <Input
          placeholder="@cliente"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && instagram.trim() && selectedProductId && selectedSize) {
              e.preventDefault();
              handleQuickLaunch();
            }
          }}
          className="text-lg"
        />
      </div>

      {/* Selected Product */}
      {selectedProduct?.product ? (
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-secondary rounded overflow-hidden shrink-0">
              {selectedProduct.product.image_url ? (
                <img 
                  src={selectedProduct.product.image_url} 
                  alt={selectedProduct.product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">{selectedProduct.product.name}</div>
              <div className="text-xs text-muted-foreground">
                {hasDiscount(selectedProduct.live_discount_type, selectedProduct.live_discount_value) ? (
                  <>
                    <span className="text-destructive font-medium">
                      {formatPrice(calculateDiscountedPrice(selectedProduct.product.price, selectedProduct.live_discount_type, selectedProduct.live_discount_value))}
                    </span>
                    <span className="line-through ml-1 opacity-60">{formatPrice(selectedProduct.product.price)}</span>
                  </>
                ) : (
                  formatPrice(selectedProduct.product.price)
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 border-2 border-dashed rounded-lg text-center text-muted-foreground">
          <Package className="h-6 w-6 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Selecione um produto na aba Produtos</p>
        </div>
      )}

      {/* Size Selection - using AVAILABLE stock */}
      {selectedProduct?.product && (
        <div className="space-y-2">
          <Label>Tamanho *</Label>
          <div className="flex flex-wrap gap-2">
            {(() => {
              // Use stock_by_size for FULL list of sizes (including sold-out for waitlist)
              // Use available_by_size for actual availability
              const stockBySize = (selectedProduct.product as any).stock_by_size || {};
              const availableBySize = (selectedProduct.product as any).available_by_size || {};
              const sizes = sortSizes(Object.keys(stockBySize));
              
              // If no sizes registered at all, show message
              if (sizes.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground italic">
                    Nenhum tamanho cadastrado
                  </p>
                );
              }
              
              return sizes.map(size => {
                // FIXED: Use available directly from product_available_stock view
                // DO NOT subtract reservedStock - the view already includes all reservations
                const available = availableBySize[size] || 0;
                const isSelected = selectedSize === size;
                const isOutOfStock = available <= 0;
                const waitlistCount = getWaitlistCount(selectedProduct.product_id, size);
                const hasWaitlistWithStock = available > 0 && waitlistCount > 0;

                return (
                  <Tooltip key={size}>
                    <TooltipTrigger asChild>
                      <button
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          hasWaitlistWithStock
                            ? 'bg-amber-500 text-white border-amber-500 animate-pulse'
                            : isOutOfStock 
                              ? 'bg-muted text-muted-foreground line-through cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:no-underline' 
                              : isSelected
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'hover:bg-muted'
                        }`}
                        onClick={() => {
                          if (waitlistCount > 0) {
                            // Open waitlist drawer to manage queue
                            setWaitlistDrawer({
                              productId: selectedProduct.product_id,
                              productName: selectedProduct.product.name,
                              productColor: selectedProduct.product.color || undefined,
                              size
                            });
                          } else if (isOutOfStock) {
                            // Open waitlist modal to add customer
                            setWaitlistModal({
                              productId: selectedProduct.product_id,
                              productName: selectedProduct.product.name,
                              productColor: selectedProduct.product.color || undefined,
                              size
                            });
                          } else {
                            setSelectedSize(size);
                          }
                        }}
                      >
                        {size}
                        {waitlistCount > 0 ? (
                          <span className="ml-1 text-xs">({waitlistCount} fila)</span>
                        ) : !isOutOfStock ? (
                          <span className="ml-1 text-xs opacity-70">({available})</span>
                        ) : (
                          <span className="ml-1 text-xs">(esgotado)</span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {hasWaitlistWithStock
                        ? `⚠️ Estoque liberado! ${waitlistCount} na fila - clique para gerenciar`
                        : waitlistCount > 0
                          ? `${waitlistCount} na lista de espera - clique para gerenciar`
                          : isOutOfStock
                            ? "Esgotado - Clique para adicionar à lista de espera"
                            : `${available} disponíveis`}
                    </TooltipContent>
                  </Tooltip>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Quantity */}
      <div className="space-y-2">
        <Label>Quantidade</Label>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setQuantity(q => Math.max(1, q - 1))}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="text-xl font-semibold w-12 text-center">{quantity}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setQuantity(q => q + 1)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Total */}
      {selectedProduct?.product && selectedSize && (
        <div className="p-4 bg-primary/10 rounded-lg text-center">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-2xl font-bold text-primary">
            {formatPrice(
              calculateDiscountedPrice(
                selectedProduct.product.price, 
                selectedProduct.live_discount_type, 
                selectedProduct.live_discount_value
              ) * quantity
            )}
          </div>
          {hasDiscount(selectedProduct.live_discount_type, selectedProduct.live_discount_value) && (
            <div className="text-xs text-muted-foreground line-through mt-1">
              {formatPrice(selectedProduct.product.price * quantity)}
            </div>
          )}
        </div>
      )}

      {/* Add Button - with loading state to prevent double-clicks */}
      <Button
        className="w-full h-12 text-lg gap-2"
        onClick={handleQuickLaunch}
        disabled={!instagram.trim() || !selectedProductId || !selectedSize || isQuickLaunching}
      >
        {isQuickLaunching ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Adicionando...
          </>
        ) : (
          <>
            <Plus className="h-5 w-5" />
            Adicionar ao Carrinho
          </>
        )}
      </Button>
    </div>
  );

  // Render cart card
  // Generate the live checkout link for a cart
  const getLiveCheckoutUrl = (cartId: string) => {
    const baseUrl = window.location.origin;
    const cart = carts.find(c => c.id === cartId);
    const token = cart?.public_token;
    return token ? `${baseUrl}/live-checkout/${cartId}?token=${token}` : `${baseUrl}/live-checkout/${cartId}`;
  };

  // Build WhatsApp message for cart
  const buildCartWhatsAppMessage = (cart: LiveCart) => {
    const items = (cart.items || []).filter(i => ['reservado', 'confirmado'].includes(i.status));
    const customerName = cart.live_customer?.nome || cart.live_customer?.instagram_handle || "";
    const checkoutUrl = getLiveCheckoutUrl(cart.id);
    
    let message = `Oi${customerName ? ` ${customerName.split(' ')[0]}` : ''}! 💛\n\n`;
    message += `Separei seus itens da live pra você ✨\n\n`;
    
    items.forEach(item => {
      const size = (item.variante as any)?.tamanho || '';
      const color = (item.variante as any)?.cor || item.product?.color || '';
      message += `• ${item.product?.name || 'Produto'}`;
      if (size) message += ` - Tam: ${size}`;
      if (color) message += ` (${color})`;
      message += ` - ${formatPrice(item.preco_unitario)}\n`;
    });
    
    message += `\n💰 Total: ${formatPrice(cart.total)}\n\n`;
    message += `Finalize seu pedido por aqui:\n${checkoutUrl}\n\n`;
    message += `Qualquer ajuste me chama aqui 💚`;
    
    return message;
  };

  // Copy checkout link to clipboard
  const handleCopyCheckoutLink = async (cartId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getLiveCheckoutUrl(cartId);
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  // Send WhatsApp message
  const handleSendWhatsApp = (cart: LiveCart, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const phone = cart.live_customer?.whatsapp?.replace(/\D/g, '') || '';
    const message = buildCartWhatsAppMessage(cart);
    
    if (phone) {
      const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    } else {
      // No phone, copy message to clipboard instead
      navigator.clipboard.writeText(message);
      toast.success("Mensagem copiada! Envie pelo Instagram DM.");
    }
  };

  const renderCartCard = (cart: LiveCart) => {
    const customer = cart.live_customer;
    const items = cart.items || [];
    // Include 'expirado' items in count and total (same logic as modal)
    const activeItems = items.filter(i => ['reservado', 'confirmado', 'expirado'].includes(i.status));
    const calculatedTotal = activeItems.reduce((sum, i) => sum + i.preco_unitario * i.qtd, 0);
    
    const statusConfig: Record<string, { label: string; color: string }> = {
      'aberto': { label: 'Aberto', color: 'bg-blue-100 text-blue-700' },
      'em_confirmacao': { label: 'Confirmando', color: 'bg-amber-100 text-amber-700' },
      'aguardando_pagamento': { label: 'Aguardando', color: 'bg-orange-100 text-orange-700' },
      'pago': { label: 'Pago', color: 'bg-green-100 text-green-700' },
      'cancelado': { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
      'expirado': { label: 'Aguardando pagamento', color: 'bg-amber-100 text-amber-700' },
    };

    const status = statusConfig[cart.status] || statusConfig.aberto;
    const bagNumber = cart.bag_number;
    const hasCancelledItems = items.some(i => i.status === 'cancelado');
    const isRaffleWinner = cart.is_raffle_winner;
    const needsReprint = cart.needs_label_reprint;

    return (
      <div 
        key={cart.id}
        className={`p-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer ${hasCancelledItems ? 'border-amber-300 bg-amber-50/30' : ''}`}
        onClick={() => setCartDetailModal(cart)}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Show bag number if exists */}
              {bagNumber && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 font-mono shrink-0">
                  #{String(bagNumber).padStart(3, '0')}
                </Badge>
              )}
              <span className="font-medium text-lg truncate">{customer?.instagram_handle}</span>
              {customer?.client_id ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-green-600" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Cliente cadastrado no CRM</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <User className="h-3 w-3 text-amber-600" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Novo cliente (sem cadastro)</TooltipContent>
                </Tooltip>
              )}
              {/* Raffle winner badge */}
              {isRaffleWinner && (
                <Badge className="bg-amber-500 text-white text-xs gap-1">
                  <Trophy className="h-3 w-3" />
                  Ganhadora
                </Badge>
              )}
            </div>
            {customer?.nome && (
              <div className="text-xs text-muted-foreground truncate">{customer.nome}</div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
            <Badge className={status.color}>{status.label}</Badge>
            {hasCancelledItems && (
              <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">
                <AlertCircle className="h-3 w-3 mr-1" />
                Retirar item
              </Badge>
            )}
            {needsReprint && (
              <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                Reimprimir
              </Badge>
            )}
          </div>
        </div>

        <div className="text-sm text-muted-foreground mb-2">
          {activeItems.length} {activeItems.length === 1 ? 'item' : 'itens'}
        </div>

        <div className="flex items-center justify-between">
          <span className="font-semibold">{formatPrice(calculatedTotal)}</span>
          {/* Removed payment buttons from cart card - backstage is operational only */}
        </div>
      </div>
    );
  };

  if (isLoading || !event) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Radio className="h-12 w-12 animate-pulse text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando backstage...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header - Mobile optimized */}
      <header className="border-b bg-card px-2 sm:px-4 py-2 sm:py-3 shrink-0">
        {/* Top row - Back button, title, live badge */}
        <div className="flex items-center gap-2 mb-2">
          <Button 
            variant="ghost" 
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => navigate("/dashboard?tab=lives")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Badge variant="destructive" className="gap-1 animate-pulse shrink-0">
            <Radio className="h-3 w-3" />
            <span className="hidden sm:inline">AO VIVO</span>
          </Badge>
          <h1 className="font-medium text-sm sm:text-base truncate">{event.titulo}</h1>
          
          {/* Live KPIs - compact on mobile */}
          <div className="hidden sm:flex items-center gap-3 text-sm ml-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{liveMetrics.totalItems}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Peças vendidas na live</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{liveMetrics.totalCustomers}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Clientes comprando</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-green-600 font-medium">
                  <DollarSign className="h-4 w-4" />
                  <span>{formatPrice(liveMetrics.totalValue)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Valor total de vendas</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Mobile KPIs - show in a row below title on mobile */}
        <div className="flex sm:hidden items-center gap-3 text-xs mb-2 px-1">
          <div className="flex items-center gap-1">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{liveMetrics.totalItems}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{liveMetrics.totalCustomers}</span>
          </div>
          <div className="flex items-center gap-1 text-green-600 font-medium">
            <DollarSign className="h-3.5 w-3.5" />
            <span>{formatPrice(liveMetrics.totalValue)}</span>
          </div>
        </div>

        {/* Action buttons - horizontal scroll on mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-2 px-2 sm:mx-0 sm:px-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1 h-8 shrink-0"
            onClick={() => setAddProductsModal(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Produtos</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 h-8 shrink-0"
            onClick={() => navigate(`/dashboard/lives/${event.id}/separacao`)}
          >
            <Package className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Separação</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 h-8 shrink-0"
            onClick={() => navigate(`/dashboard/lives/${event.id}/relatorio`)}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Relatório</span>
          </Button>
          {/* Waitlist button with counter */}
          {waitlist.filter(w => w.status === 'ativa').length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 h-8 border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 relative shrink-0"
              onClick={() => setWaitlistTabOpen(true)}
            >
              <ListOrdered className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Fila</span>
              <Badge className="bg-amber-500 text-white h-4 w-4 p-0 text-[10px] flex items-center justify-center rounded-full ml-0.5">
                {waitlist.filter(w => w.status === 'ativa').length}
              </Badge>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1 h-8 shrink-0"
            onClick={() => setWhoGotItModal(true)}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Quem?</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 h-8 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 shrink-0"
            onClick={() => setRaffleDrawer(true)}
          >
            <Trophy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sorteio</span>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="gap-1 h-8 shrink-0"
            onClick={handleEndLive}
          >
            <Square className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Encerrar</span>
          </Button>
        </div>
      </header>

      {/* Alerts Section */}
      <div className="shrink-0 px-4 pt-4 space-y-2">
        {/* Waitlist Alert - Stock Released */}
        <WaitlistAlert
          entries={waitlist}
          products={products}
          getAvailableStock={getAvailableStock}
          onOfferClick={handleWaitlistAlertOffer}
        />
        
        {/* Pending Carts Alert */}
        <PendingCartsAlert
          carts={carts}
          onCartClick={(cart) => setCartDetailModal(cart)}
          onSendWhatsApp={handleSendWhatsApp}
        />
      </div>

      {/* Mobile Layout with Tabs */}
      <div className="flex-1 overflow-hidden lg:hidden">
        <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as any)} className="h-full flex flex-col">
          <TabsList className="shrink-0 mx-4 mt-2 grid grid-cols-4">
            <TabsTrigger value="produtos" className="gap-1 text-xs">
              <Package className="h-3 w-3" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="lancador" className="gap-1 text-xs">
              <Plus className="h-3 w-3" />
              Lançador
            </TabsTrigger>
            <TabsTrigger value="carrinhos" className="gap-1 text-xs">
              <ShoppingCart className="h-3 w-3" />
              Carrinhos
            </TabsTrigger>
            <TabsTrigger value="fila" className="gap-1 text-xs relative">
              <ListOrdered className="h-3 w-3" />
              Fila
              {waitlist.filter(w => w.status === 'ativa').length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {waitlist.filter(w => w.status === 'ativa').length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="produtos" className="flex-1 overflow-hidden m-0 p-4">
            <Card className="h-full flex flex-col">
              <CardHeader className="shrink-0 pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Produtos ({products.length})
                </CardTitle>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-10 h-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full">
                  <div className="p-4 pt-0 space-y-2">
                    {filteredProducts.map(lp => renderProductCard(lp))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="lancador" className="flex-1 overflow-hidden m-0 p-4">
            <Card className="h-full flex flex-col">
              <CardHeader className="shrink-0 pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Lançador Rápido
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                {renderQuickLauncher()}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="carrinhos" className="flex-1 overflow-hidden m-0 p-4">
            <Card className="h-full flex flex-col">
              <CardHeader className="shrink-0 pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Carrinhos ({carts.length})
                </CardTitle>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar @instagram..."
                    value={cartSearch}
                    onChange={(e) => setCartSearch(e.target.value)}
                    className="pl-10 h-9"
                  />
                </div>
                {/* Customer type filter */}
                <div className="flex gap-1.5 mt-2">
                  <button
                    onClick={() => setCustomerFilter("all")}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      customerFilter === "all"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    Todos ({carts.length})
                  </button>
                  <button
                    onClick={() => setCustomerFilter("registered")}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                      customerFilter === "registered"
                        ? "bg-green-600 text-white"
                        : "bg-green-100 text-green-700 hover:bg-green-200"
                    }`}
                  >
                    <Check className="h-3 w-3" />
                    Cadastrados ({registeredCount})
                  </button>
                  <button
                    onClick={() => setCustomerFilter("new")}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                      customerFilter === "new"
                        ? "bg-amber-600 text-white"
                        : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    }`}
                  >
                    <User className="h-3 w-3" />
                    Novos ({newCount})
                  </button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full">
                  <div className="p-4 pt-0 space-y-2">
                    {filteredCarts.map(cart => renderCartCard(cart))}
                    {filteredCarts.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nenhum carrinho ainda</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="fila" className="flex-1 overflow-hidden m-0 p-4">
            <Card className="h-full flex flex-col">
              <CardHeader className="shrink-0 pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ListOrdered className="h-4 w-4" />
                  Lista de Espera
                  {waitlist.filter(w => w.status === 'ativa').length > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {waitlist.filter(w => w.status === 'ativa').length} aguardando
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto p-4 pt-0">
                <WaitlistTab
                  waitlist={waitlist}
                  products={products}
                  onAllocate={handleWaitlistOffer}
                  onSkip={handleSkipWaitlist}
                  onEndQueue={handleEndWaitlistQueue}
                  getAvailableStock={getAvailableStock}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop 3 Column Layout */}
      <div className="hidden lg:grid flex-1 grid-cols-3 gap-4 p-4 overflow-hidden">
        {/* Column A - Products */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="shrink-0 pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Produtos ({products.length})
              </span>
            </CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              <div className="p-4 pt-0 space-y-2">
                {filteredProducts.map(lp => renderProductCard(lp))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Column B - Quick Launcher */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="shrink-0 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Lançador Rápido
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {renderQuickLauncher()}
          </CardContent>
        </Card>

        {/* Column C - Carts */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="shrink-0 pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Carrinhos ({carts.length})
              </span>
            </CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar @instagram..."
                value={cartSearch}
                onChange={(e) => setCartSearch(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            {/* Customer type filter */}
            <div className="flex gap-1.5 mt-2">
              <button
                onClick={() => setCustomerFilter("all")}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  customerFilter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Todos ({carts.length})
              </button>
              <button
                onClick={() => setCustomerFilter("registered")}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                  customerFilter === "registered"
                    ? "bg-green-600 text-white"
                    : "bg-green-100 text-green-700 hover:bg-green-200"
                }`}
              >
                <Check className="h-3 w-3" />
                Cadastrados ({registeredCount})
              </button>
              <button
                onClick={() => setCustomerFilter("new")}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                  customerFilter === "new"
                    ? "bg-amber-600 text-white"
                    : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                }`}
              >
                <User className="h-3 w-3" />
                Novos ({newCount})
              </button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              <div className="p-4 pt-0 space-y-2">
                {filteredCarts.map(cart => renderCartCard(cart))}
                {filteredCarts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum carrinho ainda</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* "Quem garantiu?" Modal - New Component */}
      <WhoGotItModal
        open={whoGotItModal}
        onOpenChange={setWhoGotItModal}
        products={products}
        carts={carts}
        waitlist={waitlist}
        reservedStock={reservedStock}
      />

      {/* Add Products Modal */}
      <AddProductsModal
        open={addProductsModal}
        onOpenChange={setAddProductsModal}
        eventId={eventId || ""}
        existingProductIds={products.map(p => p.product_id)}
        onProductsAdded={fetchEvent}
      />

      {/* Enhanced Waitlist Modal */}
      {waitlistModal && (
        <EnhancedWaitlistModal
          open={!!waitlistModal}
          onOpenChange={() => setWaitlistModal(null)}
          productId={waitlistModal.productId}
          productName={waitlistModal.productName}
          productColor={waitlistModal.productColor}
          size={waitlistModal.size}
          queueCount={getWaitlistCount(waitlistModal.productId, waitlistModal.size)}
          onSubmit={handleEnhancedWaitlistSubmit}
        />
      )}

      {/* Waitlist Offer Modal */}
      {waitlistOfferModal && (
        <WaitlistOfferModal
          open={!!waitlistOfferModal}
          onOpenChange={() => setWaitlistOfferModal(null)}
          waitlistItem={waitlistOfferModal.waitlistItem}
          product={waitlistOfferModal.product}
          onOffer={handleWaitlistOffer}
          onSkip={handleSkipWaitlist}
          onEndQueue={handleEndWaitlistQueue}
        />
      )}

      {/* Waitlist Drawer - Full list view */}
      {waitlistDrawer && (
        <WaitlistDrawer
          open={!!waitlistDrawer}
          onOpenChange={() => setWaitlistDrawer(null)}
          productName={waitlistDrawer.productName}
          productColor={waitlistDrawer.productColor}
          size={waitlistDrawer.size}
          entries={getWaitlistEntries(waitlistDrawer.productId, waitlistDrawer.size)}
          hasStock={getAvailableStock(
            waitlistDrawer.productId, 
            waitlistDrawer.size, 
            (products.find(p => p.product_id === waitlistDrawer.productId)?.product as any)?.available_by_size?.[waitlistDrawer.size] || 0
          ) > 0}
          onAllocate={handleWaitlistOffer}
          onSkip={handleSkipWaitlist}
          onEndQueue={() => handleEndWaitlistQueue(waitlistDrawer.productId, waitlistDrawer.size)}
          onAddToWaitlist={() => {
            setWaitlistModal({
              productId: waitlistDrawer.productId,
              productName: waitlistDrawer.productName,
              productColor: waitlistDrawer.productColor,
              size: waitlistDrawer.size
            });
          }}
        />
      )}

      {/* Cart Detail Modal - Operational Only (no payment actions) */}
      <BackstageCartModal
        cart={cartDetailModal}
        onClose={() => setCartDetailModal(null)}
        onRemoveItem={removeCartItem}
        onReduceQuantity={reduceItemQuantity}
        onCancelCart={async (cartId) => {
          await updateCartStatus(cartId, 'cancelado');
        }}
        products={products}
        onWaitlistOffer={(waitlistItem, product) => {
          setWaitlistOfferModal({ waitlistItem, product });
        }}
        cartHistory={cartHistory}
        historyLoading={historyLoading}
      />

      {/* Full Waitlist Tab Sheet for Desktop */}
      <Sheet open={waitlistTabOpen} onOpenChange={setWaitlistTabOpen}>
        <SheetContent side="right" className="sm:max-w-2xl w-full">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-amber-600" />
              Gerenciar Lista de Espera
              {waitlist.filter(w => w.status === 'ativa').length > 0 && (
                <Badge className="bg-amber-500 text-white">
                  {waitlist.filter(w => w.status === 'ativa').length} aguardando
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-120px)] mt-4">
            <WaitlistTab
              waitlist={waitlist}
              products={products}
              onAllocate={handleWaitlistOffer}
              onSkip={handleSkipWaitlist}
              onEndQueue={handleEndWaitlistQueue}
              getAvailableStock={getAvailableStock}
            />
          </ScrollArea>
        </SheetContent>
      </Sheet>
      {/* Cancel Item Confirmation Dialog */}
      <AlertDialog open={!!cancelItemConfirm} onOpenChange={() => setCancelItemConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar item do pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a cancelar <strong>{cancelItemConfirm?.productName}</strong> (Tam: {cancelItemConfirm?.size}).
              <br /><br />
              Este item será marcado para <strong>retirada física da sacola</strong> durante a separação.
              O estoque <strong>não será devolvido automaticamente</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (cancelItemConfirm) {
                  await cancelItemForSeparation(cancelItemConfirm.itemId);
                  setCancelItemConfirm(null);
                  setCartDetailModal(null);
                }
              }}
            >
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Live Product Modal */}
      <EditLiveProductModal
        open={!!editProductModal}
        onOpenChange={(open) => !open && setEditProductModal(null)}
        liveProduct={editProductModal}
        onProductUpdated={fetchEvent}
      />

      {/* Raffle Drawer */}
      <Sheet open={raffleDrawer} onOpenChange={setRaffleDrawer}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Sorteio ao Vivo
            </SheetTitle>
          </SheetHeader>
          <div className="p-4">
            {eventId && (
              <LiveRaffle 
                eventId={eventId} 
                carts={carts} 
                onRefresh={fetchBackstageData}
                onRaffleOverlayChange={setIsRaffleOverlayActive}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
