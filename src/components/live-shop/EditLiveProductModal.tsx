import { useState, useEffect } from "react";
import { Pencil, Percent, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { LiveProduct } from "@/types/liveShop";
import { calculateDiscountedPrice, hasDiscount } from "@/lib/discountUtils";

interface EditLiveProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liveProduct: LiveProduct | null;
  onProductUpdated: () => void;
}

export function EditLiveProductModal({
  open,
  onOpenChange,
  liveProduct,
  onProductUpdated,
}: EditLiveProductModalProps) {
  const [discountType, setDiscountType] = useState<"percentage" | "fixed" | "none">("none");
  const [discountValue, setDiscountValue] = useState("");
  const [limiteUnidades, setLimiteUnidades] = useState("");
  const [visibilidade, setVisibilidade] = useState<"exclusivo_live" | "catalogo_e_live">("catalogo_e_live");
  const [bloquearPlanejamento, setBloquearPlanejamento] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when liveProduct changes
  useEffect(() => {
    if (liveProduct) {
      setDiscountType(liveProduct.live_discount_type || "none");
      setDiscountValue(liveProduct.live_discount_value?.toString() || "");
      setLimiteUnidades(liveProduct.limite_unidades_live?.toString() || "");
      setVisibilidade(liveProduct.visibilidade);
      setBloquearPlanejamento(liveProduct.bloquear_desde_planejamento);
    }
  }, [liveProduct]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const handleSave = async () => {
    if (!liveProduct) return;

    setIsSaving(true);
    try {
      const updateData: Record<string, any> = {
        visibilidade,
        bloquear_desde_planejamento: bloquearPlanejamento,
        limite_unidades_live: limiteUnidades ? parseInt(limiteUnidades) : null,
      };

      if (discountType === "none") {
        updateData.live_discount_type = null;
        updateData.live_discount_value = null;
      } else {
        updateData.live_discount_type = discountType;
        updateData.live_discount_value = parseFloat(discountValue) || null;
      }

      const { error } = await supabase
        .from("live_products")
        .update(updateData)
        .eq("id", liveProduct.id);

      if (error) throw error;

      toast.success("Produto atualizado com sucesso!");
      onProductUpdated();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error updating live product:", err);
      toast.error("Erro ao atualizar produto");
    } finally {
      setIsSaving(false);
    }
  };

  if (!liveProduct || !liveProduct.product) return null;

  const product = liveProduct.product;
  const originalPrice = product.price;
  const finalDiscountType = discountType === "none" ? null : discountType;
  const discountedPrice = discountType !== "none" && parseFloat(discountValue) > 0
    ? calculateDiscountedPrice(originalPrice, finalDiscountType, parseFloat(discountValue))
    : originalPrice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 w-[min(480px,95vw)] max-h-[85vh] !flex !flex-col overflow-hidden">
        <div className="px-6 py-4 border-b shrink-0">
          <DialogHeader className="p-0 m-0">
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Editar Produto na Live
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 py-4 flex-1 min-h-0 overflow-y-auto space-y-4">
          {/* Product info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            {product.image_url && (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-14 h-14 rounded object-cover"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{product.name}</p>
              <p className="text-sm text-muted-foreground">
                {product.color && `${product.color} • `}
                {formatPrice(originalPrice)}
              </p>
            </div>
          </div>

          {/* Discount type */}
          <div className="space-y-2">
            <Label>Desconto na Live</Label>
            <Select
              value={discountType}
              onValueChange={(v) => setDiscountType(v as "percentage" | "fixed" | "none")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem desconto</SelectItem>
                <SelectItem value="percentage">Percentual (%)</SelectItem>
                <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Discount value */}
          {discountType !== "none" && (
            <div className="space-y-2">
              <Label>
                {discountType === "percentage" ? "Desconto (%)" : "Desconto (R$)"}
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder={discountType === "percentage" ? "10" : "20.00"}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="pr-10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {discountType === "percentage" ? (
                    <Percent className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              
              {/* Price preview */}
              {parseFloat(discountValue) > 0 && (
                <div className="p-2 bg-green-50 rounded text-sm">
                  <span className="text-muted-foreground line-through mr-2">
                    {formatPrice(originalPrice)}
                  </span>
                  <span className="font-medium text-green-700">
                    {formatPrice(discountedPrice)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Limite de unidades */}
          <div className="space-y-2">
            <Label>Limite de unidades na live (opcional)</Label>
            <Input
              type="number"
              placeholder="Sem limite"
              value={limiteUnidades}
              onChange={(e) => setLimiteUnidades(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Deixe vazio para usar todo o estoque disponível
            </p>
          </div>

          {/* Visibilidade */}
          <div className="space-y-2">
            <Label>Visibilidade</Label>
            <Select
              value={visibilidade}
              onValueChange={(v) => setVisibilidade(v as "exclusivo_live" | "catalogo_e_live")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="catalogo_e_live">Catálogo e Live</SelectItem>
                <SelectItem value="exclusivo_live">Exclusivo da Live</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bloquear desde planejamento */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="space-y-0.5">
              <Label className="cursor-pointer">Bloquear desde planejamento</Label>
              <p className="text-xs text-muted-foreground">
                Esconde do catálogo mesmo antes da live começar
              </p>
            </div>
            <Switch
              checked={bloquearPlanejamento}
              onCheckedChange={setBloquearPlanejamento}
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
