import { useState, useEffect } from "react";
import { 
  Sparkles, 
  X, 
  Plus, 
  Trash2, 
  GripVertical,
  Copy,
  ExternalLink,
  MessageCircle,
  Loader2,
  Filter
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  images: string[] | null;
  main_image_index: number | null;
  stock_by_size: Record<string, number> | null;
  color: string | null;
  category: string | null;
}

interface CustomerCatalogModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string | null;
  customerPhone: string;
  customerStyle: string | null;
  customerSizeLetter: string | null;
  customerSizeNumber: string | null;
  availableProducts: Product[];
}

export function CustomerCatalogModal({
  open,
  onClose,
  customerId,
  customerName,
  customerPhone,
  customerStyle,
  customerSizeLetter,
  customerSizeNumber,
  availableProducts,
}: CustomerCatalogModalProps) {
  const [title, setTitle] = useState(`Catálogo da ${customerName || "Cliente"}`);
  const [introText, setIntroText] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [isGeneratingIntro, setIsGeneratingIntro] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [catalogLink, setCatalogLink] = useState<string | null>(null);
  const [showProductPicker, setShowProductPicker] = useState(false);

  // Filter states for product picker
  const [filterSize, setFilterSize] = useState<string>("_all");
  const [filterCategory, setFilterCategory] = useState<string>("_all");
  const [filterColor, setFilterColor] = useState<string>("_all");

  const customerSizeOptions = [customerSizeLetter, customerSizeNumber, "UN", "Único"].filter(Boolean);
  const [productTab, setProductTab] = useState<"suggested" | "all">("all");

  // Standard size order
  const sizeOrder = ["34", "36", "38", "40", "42", "44", "46", "PP", "P", "M", "G", "GG", "UN", "Único"];

  // Get all available sizes from products
  const allAvailableSizes = [...new Set(
    availableProducts.flatMap((p) => {
      if (!p.stock_by_size) return [];
      const stock = p.stock_by_size as Record<string, number>;
      return Object.entries(stock)
        .filter(([_, qty]) => qty > 0)
        .map(([size]) => size);
    })
  )].sort((a, b) => {
    const indexA = sizeOrder.indexOf(a);
    const indexB = sizeOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  // Get all available categories from products
  const allAvailableCategories = [...new Set(
    availableProducts
      .filter((p) => p.category)
      .map((p) => p.category as string)
  )].sort();

  // Get all available colors from products
  const allAvailableColors = [...new Set(
    availableProducts
      .filter((p) => p.color)
      .map((p) => p.color as string)
  )].sort();

  // All products with any stock
  const allProductsWithStock = availableProducts.filter((p) => {
    if (!p.stock_by_size) return false;
    const stock = p.stock_by_size as Record<string, number>;
    const totalStock = Object.values(stock).reduce((sum, qty) => sum + qty, 0);
    return totalStock > 0;
  });

  // Filter products that have stock in customer's size (suggested)
  const suggestedProducts = customerSizeOptions.length > 0 
    ? availableProducts.filter((p) => {
        if (!p.stock_by_size) return false;
        const stock = p.stock_by_size as Record<string, number>;
        return customerSizeOptions.some((size) => {
          if (!size) return false;
          const sizeKey = Object.keys(stock).find(
            (k) => k.toLowerCase() === size.toLowerCase()
          );
          return sizeKey && stock[sizeKey] > 0;
        });
      })
    : [];

  // Apply additional filters (size, category, and color)
  const applyFilters = (products: Product[]) => {
    return products.filter((p) => {
      // Category filter
      if (filterCategory !== "_all" && p.category !== filterCategory) {
        return false;
      }
      // Color filter
      if (filterColor !== "_all" && p.color !== filterColor) {
        return false;
      }
      // Size filter
      if (filterSize !== "_all") {
        if (!p.stock_by_size) return false;
        const stock = p.stock_by_size as Record<string, number>;
        const sizeKey = Object.keys(stock).find(
          (k) => k.toLowerCase() === filterSize.toLowerCase()
        );
        if (!sizeKey || stock[sizeKey] <= 0) return false;
      }
      return true;
    });
  };

  // Products to display based on selected tab and filters
  const baseProducts = productTab === "suggested" ? suggestedProducts : allProductsWithStock;
  const displayProducts = applyFilters(baseProducts);

  useEffect(() => {
    if (open) {
      setTitle(`Catálogo da ${customerName || "Cliente"}`);
      generateIntroText();
      // Default to "all" if no size filter, otherwise "suggested" if there are suggested products
      setProductTab(suggestedProducts.length > 0 ? "suggested" : "all");
      // Reset filters when opening
      setFilterSize("_all");
      setFilterCategory("_all");
      setFilterColor("_all");
    }
  }, [open, customerName]);

  const generateIntroText = async () => {
    setIsGeneratingIntro(true);
    const sizeDisplay = [customerSizeLetter, customerSizeNumber].filter(Boolean).join("/");
    
    // Simple AI-like intro generation based on customer data
    const intros = [
      `${customerName || "Querida"}, montei esse provador pensando no seu estilo ${customerStyle ? `${customerStyle} ` : ""}e no seu tamanho${sizeDisplay ? ` ${sizeDisplay}` : ""}, com peças que vão te deixar ainda mais confiante e sofisticada. Me diz qual você amou primeiro 💛`,
      `Oi ${customerName || ""}! Selecionei essas peças especialmente pra você, todas no seu tamanho${sizeDisplay ? ` ${sizeDisplay}` : ""} e com a sua cara${customerStyle ? `, combinando com seu estilo ${customerStyle}` : ""}. Qual delas te conquistou? ✨`,
      `${customerName || "Linda"}, preparei uma seleção exclusiva pensando em você! Peças que valorizam seu corpo${sizeDisplay ? ` (${sizeDisplay})` : ""} e combinam perfeitamente com ${customerStyle ? `seu estilo ${customerStyle}` : "seu estilo único"}. Me conta sua favorita! 💕`,
    ];
    
    setIntroText(intros[Math.floor(Math.random() * intros.length)]);
    setIsGeneratingIntro(false);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const getProductImage = (product: Product) => {
    if (product.images && product.images.length > 0) {
      const mainIndex = product.main_image_index || 0;
      return product.images[mainIndex] || product.images[0];
    }
    return product.image_url;
  };

  const addProduct = (product: Product) => {
    if (!selectedProducts.find((p) => p.id === product.id)) {
      setSelectedProducts([...selectedProducts, product]);
    }
    setShowProductPicker(false);
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts(selectedProducts.filter((p) => p.id !== productId));
  };

  const saveCatalog = async () => {
    if (selectedProducts.length === 0) {
      toast.error("Adicione pelo menos um produto ao catálogo");
      return;
    }

    setIsSaving(true);
    try {
      const publicLink = `catalogo-${customerId.slice(0, 8)}-${Date.now()}`;
      
      const { data, error } = await supabase
        .from("customer_catalogs")
        .insert({
          customer_id: customerId,
          title,
          intro_text: introText,
          products: selectedProducts.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            image: getProductImage(p),
            color: p.color,
          })),
          public_link: publicLink,
        })
        .select()
        .single();

      if (error) throw error;

      const fullLink = `${window.location.origin}/c/${publicLink}`;
      setCatalogLink(fullLink);
      toast.success("Catálogo criado com sucesso!");
    } catch (error) {
      console.error("Error saving catalog:", error);
      toast.error("Erro ao salvar catálogo");
    } finally {
      setIsSaving(false);
    }
  };

  const copyLink = () => {
    if (catalogLink) {
      navigator.clipboard.writeText(catalogLink);
      toast.success("Link copiado!");
    }
  };

  const sendWhatsApp = () => {
    const phone = customerPhone.replace(/\D/g, "");
    const whatsappNumber = phone.startsWith("55") ? phone : `55${phone}`;
    const message = encodeURIComponent(`${introText}\n\n🛍️ Veja seu catálogo personalizado:\n${catalogLink}`);
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Montar Catálogo Personalizado
          </DialogTitle>
          <DialogDescription>
            Selecione produtos para criar um catálogo exclusivo para {customerName || "esta cliente"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-2 block">Nome do catálogo</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Catálogo da Cliente"
            />
          </div>

          {/* Intro text */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Texto de abertura</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={generateIntroText}
                disabled={isGeneratingIntro}
              >
                {isGeneratingIntro ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Gerar novo
              </Button>
            </div>
            <Textarea
              value={introText}
              onChange={(e) => setIntroText(e.target.value)}
              rows={4}
              placeholder="Texto personalizado para a cliente..."
            />
          </div>

          {/* Selected products */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium">
                Produtos ({selectedProducts.length})
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowProductPicker(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            {selectedProducts.length === 0 ? (
              <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
                <p>Nenhum produto selecionado</p>
                <p className="text-sm">Clique em "Adicionar" para incluir produtos</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedProducts.map((product, index) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 bg-secondary/50 rounded-lg p-2"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <div className="w-12 h-12 rounded overflow-hidden bg-secondary flex-shrink-0">
                      {getProductImage(product) ? (
                        <img
                          src={getProductImage(product)!}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          ?
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      <p className="text-sm text-primary">{formatPrice(product.price)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeProduct(product.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product picker modal */}
          {showProductPicker && (
            <div className="border rounded-lg p-4 bg-background">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Selecionar produto</h4>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowProductPicker(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Filter dropdowns */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <Select value={filterSize} onValueChange={setFilterSize}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Tamanho" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="_all">Todos tam.</SelectItem>
                    {allAvailableSizes.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="_all">Todas cat.</SelectItem>
                    {allAvailableCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterColor} onValueChange={setFilterColor}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Cor" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="_all">Todas cores</SelectItem>
                    {allAvailableColors.map((color) => (
                      <SelectItem key={color} value={color}>
                        {color}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tabs for filtering */}
              <Tabs value={productTab} onValueChange={(v) => setProductTab(v as "suggested" | "all")} className="mb-3">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="suggested" disabled={suggestedProducts.length === 0}>
                    <Filter className="h-3 w-3 mr-1" />
                    Sugeridos ({suggestedProducts.length})
                  </TabsTrigger>
                  <TabsTrigger value="all">
                    Todos ({allProductsWithStock.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Results count */}
              <p className="text-xs text-muted-foreground mb-2">
                {displayProducts.filter((p) => !selectedProducts.find((sp) => sp.id === p.id)).length} produtos encontrados
              </p>

              {displayProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">Nenhum produto encontrado</p>
                  {(filterSize !== "_all" || filterCategory !== "_all" || filterColor !== "_all") && (
                    <Button 
                      variant="link" 
                      size="sm" 
                      onClick={() => { setFilterSize("_all"); setFilterCategory("_all"); setFilterColor("_all"); }}
                      className="mt-2"
                    >
                      Limpar filtros
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                  {displayProducts
                    .filter((p) => !selectedProducts.find((sp) => sp.id === p.id))
                    .map((product) => (
                      <button
                        key={product.id}
                        onClick={() => addProduct(product)}
                        className="text-left p-2 rounded-lg hover:bg-secondary transition-colors"
                      >
                        <div className="aspect-square rounded overflow-hidden bg-secondary mb-1">
                          {getProductImage(product) ? (
                            <img
                              src={getProductImage(product)!}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              ?
                            </div>
                          )}
                        </div>
                        <p className="text-xs truncate">{product.name}</p>
                        <p className="text-xs text-primary">{formatPrice(product.price)}</p>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Catalog link (after save) */}
          {catalogLink && (
            <div className="border rounded-lg p-4 bg-emerald-50/50">
              <p className="text-sm font-medium text-emerald-700 mb-2">
                ✅ Catálogo criado!
              </p>
              <div className="flex items-center gap-2 mb-3">
                <Input
                  value={catalogLink}
                  readOnly
                  className="flex-1 text-sm"
                />
                <Button variant="outline" size="icon" onClick={copyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={catalogLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              <Button
                className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white"
                onClick={sendWhatsApp}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Enviar no WhatsApp
              </Button>
            </div>
          )}

          {/* Actions */}
          {!catalogLink && (
            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={saveCatalog}
                disabled={isSaving || selectedProducts.length === 0}
                className="flex-1"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Criar Catálogo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
