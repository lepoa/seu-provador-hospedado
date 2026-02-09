import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Upload, AlertTriangle, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ManualPaymentModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderTotal: number;
  onConfirm: (method: string, proofUrl: string, notes?: string) => Promise<boolean>;
}

const PAYMENT_METHODS = [
  { value: 'rede', label: 'Maquininha REDE' },
  { value: 'pix_itau', label: 'PIX Itaú' },
  { value: 'pix_rede', label: 'PIX REDE' },
  { value: 'link_rede', label: 'Link Externo REDE' },
  { value: 'dinheiro', label: 'Dinheiro' },
];

export function ManualPaymentModal({
  open,
  onClose,
  orderId,
  orderTotal,
  onConfirm,
}: ManualPaymentModalProps) {
  const [method, setMethod] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Máximo 5MB.");
        return;
      }
      setProofFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setProofPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadProof = async (): Promise<string | null> => {
    if (!proofFile) return null;

    setIsUploading(true);
    try {
      const fileExt = proofFile.name.split('.').pop();
      const fileName = `payment-proof-${orderId}-${Date.now()}.${fileExt}`;
      const filePath = `payment-proofs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, proofFile);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast.error("Erro ao fazer upload do comprovante");
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao fazer upload");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    // Validate
    if (!method) {
      toast.error("Selecione o método de pagamento");
      return;
    }
    if (!proofFile) {
      toast.error("Comprovante obrigatório para pagamento manual");
      return;
    }

    setIsSubmitting(true);

    // Upload proof
    const proofUrl = await uploadProof();
    if (!proofUrl) {
      setIsSubmitting(false);
      return;
    }

    // Confirm payment
    const success = await onConfirm(method, proofUrl, notes);
    setIsSubmitting(false);

    if (success) {
      // Reset form
      setMethod("");
      setNotes("");
      setProofFile(null);
      setProofPreview("");
      onClose();
    }
  };

  const handleClose = () => {
    setMethod("");
    setNotes("");
    setProofFile(null);
    setProofPreview("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento Manual</DialogTitle>
          <DialogDescription>
            Valor: <span className="font-bold text-foreground">{formatPrice(orderTotal)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Comprovante obrigatório</p>
              <p className="text-amber-700">
                Pagamentos manuais passam por validação administrativa.
              </p>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Método de Pagamento *</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o método" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Proof Upload */}
          <div className="space-y-2">
            <Label>Comprovante *</Label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            
            {proofPreview ? (
              <div className="relative">
                <img 
                  src={proofPreview} 
                  alt="Comprovante" 
                  className="w-full h-48 object-contain border rounded-lg bg-muted"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute bottom-2 right-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Trocar
                </Button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Clique para anexar foto do comprovante
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG até 5MB
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informações adicionais sobre o pagamento..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting || isUploading || !method || !proofFile}
          >
            {(isSubmitting || isUploading) && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Confirmar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
