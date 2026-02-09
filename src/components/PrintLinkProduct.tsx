import { useState, useEffect } from "react";
import { Search, Link2, Check, Package, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboardUtils";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  sizes: string[];
  category: string | null;
  style: string | null;
  tags: string[];
}

interface PrintRequest {
  id: string;
  size: string | null;
  preference: string | null;
  linked_product_id: string | null;
}

interface PrintLinkProductProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  print: PrintRequest;
  customerPhone: string;
  onSuccess: () => void;
}

export function PrintLinkProduct({ 
  open, 
  onOpenChange, 
  print, 
  customerPhone,
  onSuccess 
}: PrintLinkProductProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [suggestedProducts, setSuggestedProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadProducts();
    }
  }, [open, print]);

  const loadProducts = async () => {
    try {
      // Load all active products
      const { data: allProducts, error } = await supabase
        .from("product_catalog")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setProducts(allProducts || []);

      // Find suggested products based on print preferences
      if (print.size || print.preference) {
        const modelingPref = print.preference === "ajustado" 
          ? ["ajustado", "regular"] 
          : ["soltinho", "oversized"];
        
        const suggested = (allProducts || []).filter(p => {
          const sizeMatch = !print.size || p.sizes?.includes(print.size);
          const modelMatch = !print.preference || modelingPref.some(m => p.tags?.includes(m) || p.style?.includes(m));
          return sizeMatch || modelMatch;
        }).slice(0, 6);

        setSuggestedProducts(suggested);
      }

      // If already linked, set selected product
      if (print.linked_product_id) {
        const linked = (allProducts || []).find(p => p.id === print.linked_product_id);
        if (linked) setSelectedProduct(linked);
      }
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  const handleLinkProduct = async () => {
    if (!selectedProduct) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("print_requests")
        .update({ linked_product_id: selectedProduct.id })
        .eq("id", print.id);

      if (error) throw error;

      toast.success("Produto vinculado!");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error linking product:", error);
      toast.error("Erro ao vincular produto");
    } finally {
      setIsSaving(false);
    }
  };

  const generateResponse = () => {
    const formatPrice = (price: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

    if (selectedProduct) {
      const sizeAvailable = print.size && selectedProduct.sizes?.includes(print.size);
      
      if (sizeAvailable) {
        return `Oi! 💕 Achei a peça que você procura: ${selectedProduct.name} - ${formatPrice(selectedProduct.price)}. Tenho no seu tamanho (${print.size})! Posso reservar para você?`;
      } else {
        return `Oi! 💕 Encontrei uma peça parecida com o que você procura: ${selectedProduct.name} - ${formatPrice(selectedProduct.price)}. Vou verificar os tamanhos disponíveis e te aviso!`;
      }
    }
    return `Oi! 💕 Vi o print que você mandou! Estou procurando essa peça para você. Em breve te dou um retorno!`;
  };

  const handleSendWhatsApp = async () => {
    const message = generateResponse();
    const phone = customerPhone.replace(/\D/g, "");
    const waUrl = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
    const newWindow = window.open(waUrl, "_blank", "noopener,noreferrer");
    
    if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
      await copyToClipboard(message);
      toast.success("Link bloqueado. Mensagem copiada para área de transferência!");
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Vincular a Produto</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Selected Product */}
          {selectedProduct && (
            <div className="p-4 bg-accent/10 rounded-xl border border-accent/20">
              <p className="text-xs text-accent font-medium mb-2">Produto selecionado</p>
              <div className="flex gap-4">
                {selectedProduct.image_url ? (
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-16 h-16 bg-secondary rounded-lg flex items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium">{selectedProduct.name}</p>
                  <p className="text-sm text-muted-foreground">{formatPrice(selectedProduct.price)}</p>
                  {print.size && (
                    <p className="text-xs mt-1">
                      {selectedProduct.sizes?.includes(print.size) ? (
                        <span className="text-green-600">✓ Tem no tamanho {print.size}</span>
                      ) : (
                        <span className="text-amber-600">⚠ Verificar tamanho {print.size}</span>
                      )}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProduct(null)}
                >
                  Trocar
                </Button>
              </div>
            </div>
          )}

          {/* Suggested Products */}
          {!selectedProduct && suggestedProducts.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-3">Sugestões baseadas nas preferências</p>
              <div className="grid grid-cols-3 gap-3">
                {suggestedProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className="text-left p-3 rounded-xl border border-border hover:border-accent transition-colors"
                  >
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full aspect-square object-cover rounded-lg mb-2"
                      />
                    ) : (
                      <div className="w-full aspect-square bg-secondary rounded-lg mb-2 flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{formatPrice(product.price)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All Products List */}
          {!selectedProduct && search && (
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-accent transition-colors text-left"
                >
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
                  <div className="flex-1">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">{formatPrice(product.price)}</p>
                  </div>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum produto encontrado
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-4 border-t border-border">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleLinkProduct}
                disabled={!selectedProduct || isSaving}
                className="flex-1 gap-2"
              >
                <Link2 className="h-4 w-4" />
                Vincular
              </Button>
            </div>
            
            <Button
              variant="secondary"
              onClick={handleSendWhatsApp}
              className="gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Enviar resposta no WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
