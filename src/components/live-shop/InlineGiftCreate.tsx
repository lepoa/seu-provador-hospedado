import { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InlineGiftCreateProps {
  open: boolean;
  onClose: () => void;
  onCreated: (giftId: string) => void;
}

export function InlineGiftCreate({ open, onClose, onCreated }: InlineGiftCreateProps) {
  const [name, setName] = useState("");
  const [stockQty, setStockQty] = useState("1");
  const [imageUrl, setImageUrl] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Preencha o nome do brinde");
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from("gifts")
        .insert({
          name: name.trim(),
          stock_qty: parseInt(stockQty) || 1,
          image_url: imageUrl.trim() || null,
          is_active: true,
          unlimited_stock: false,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Brinde "${name}" criado!`);
      onCreated(data.id);
      
      // Reset form
      setName("");
      setStockQty("1");
      setImageUrl("");
      onClose();
    } catch (err) {
      console.error("Error creating gift:", err);
      toast.error("Erro ao criar brinde");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Criar Novo Brinde
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Brinde *</Label>
            <Input
              placeholder="Ex: Brinco Semijoia, Caixa de Bombom..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input
                type="number"
                min="1"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>URL da Imagem (opcional)</Label>
              <Input
                placeholder="https://..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar e Selecionar"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
