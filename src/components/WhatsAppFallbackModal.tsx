import { Copy, MessageCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboardUtils";

interface WhatsAppFallbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  phone: string;
}

export function WhatsAppFallbackModal({
  isOpen,
  onClose,
  message,
  phone,
}: WhatsAppFallbackModalProps) {
  const handleCopy = async () => {
    await copyToClipboard(message);
    toast.success("Mensagem copiada!");
  };

  const formattedPhone = phone.replace(/^55(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");

  const handleTryAgain = () => {
    const encodedMessage = encodeURIComponent(message);
    const waUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
    window.location.href = waUrl;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-whatsapp" />
            WhatsApp
          </DialogTitle>
          <DialogDescription>
            O WhatsApp não pôde ser aberto automaticamente. Copie a mensagem abaixo e envie manualmente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Número da loja:
            </p>
            <p className="font-mono text-lg">{formattedPhone}</p>
          </div>

          <div className="p-3 bg-muted rounded-lg max-h-48 overflow-y-auto">
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Mensagem:
            </p>
            <p className="text-sm whitespace-pre-wrap">{message}</p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleTryAgain} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Tentar novamente
          </Button>
          <Button onClick={handleCopy} className="btn-whatsapp gap-2">
            <Copy className="h-4 w-4" />
            Copiar mensagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
