import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ModalTermosProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgree: () => void;
}

export function ModalTermos({ open, onOpenChange, onAgree }: ModalTermosProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  useEffect(() => {
    if (!open) {
      setHasScrolledToBottom(false);
    }
  }, [open]);

  const handleScroll = () => {
    const element = contentRef.current;
    if (!element) return;
    const reachedBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 2;
    if (reachedBottom) {
      setHasScrolledToBottom(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[70vh]">
        <DialogHeader>
          <DialogTitle>Termos de Uso</DialogTitle>
          <DialogDescription>Leia atentamente os termos para concluir seu cadastro.</DialogDescription>
        </DialogHeader>

        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="max-h-[45vh] overflow-y-auto pr-1 text-sm text-muted-foreground space-y-3"
        >
          <p>
            Ao criar sua conta, você concorda em usar a plataforma de forma lícita, sem violar direitos de terceiros
            ou comprometer a segurança do sistema.
          </p>
          <p>
            Os dados da sua conta são usados para autenticação, atendimento, histórico de pedidos e personalização da
            experiência de compra.
          </p>
          <p>Você é responsável pelas informações fornecidas no cadastro e pela confidencialidade do seu acesso.</p>
          <p>Podemos atualizar estes Termos periodicamente para adequação legal, melhorias de produto e segurança.</p>
          <p>
            Em caso de uso indevido, a conta pode ser limitada ou suspensa, conforme regras internas e legislação
            aplicavel.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            type="button"
            disabled={!hasScrolledToBottom}
            onClick={() => {
              onAgree();
              onOpenChange(false);
            }}
          >
            Li e concordo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
