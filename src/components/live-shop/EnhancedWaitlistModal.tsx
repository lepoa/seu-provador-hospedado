import { useState } from "react";
import { ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface EnhancedWaitlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  productColor?: string;
  size: string;
  queueCount: number;
  onSubmit: (data: {
    instagram: string;
    nome?: string;
    whatsapp?: string;
    observacao?: string;
  }) => Promise<boolean>;
}

export function EnhancedWaitlistModal({
  open,
  onOpenChange,
  productName,
  productColor,
  size,
  queueCount,
  onSubmit,
}: EnhancedWaitlistModalProps) {
  const [instagram, setInstagram] = useState("");
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [observacao, setObservacao] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!instagram.trim()) return;

    setIsLoading(true);
    const success = await onSubmit({
      instagram: instagram.trim(),
      nome: nome.trim() || undefined,
      whatsapp: whatsapp.trim() || undefined,
      observacao: observacao.trim() || undefined,
    });
    setIsLoading(false);

    if (success) {
      // Reset form
      setInstagram("");
      setNome("");
      setWhatsapp("");
      setObservacao("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5 text-amber-600" />
            Lista de Espera
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product info */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="font-medium">{productName}</div>
            <div className="text-sm text-muted-foreground">
              {productColor && `${productColor} • `}
              Tam: {size}
            </div>
            {queueCount > 0 && (
              <div className="text-xs text-amber-600 mt-1">
                {queueCount} pessoa(s) já na fila
              </div>
            )}
          </div>

          {/* Form */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>
                @ do Instagram <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="@cliente"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Nome (opcional)</Label>
              <Input
                placeholder="Nome da cliente"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>WhatsApp (opcional)</Label>
              <Input
                placeholder="(62) 99999-9999"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea
                placeholder="Ex: pode ser 38 ou 40"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!instagram.trim() || isLoading}
          >
            {isLoading ? "Adicionando..." : "Entrar na Lista"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
