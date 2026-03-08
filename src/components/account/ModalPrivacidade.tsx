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

interface ModalPrivacidadeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgree: () => void;
}

export function ModalPrivacidade({ open, onOpenChange, onAgree }: ModalPrivacidadeProps) {
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
          <DialogTitle>Política de Privacidade</DialogTitle>
          <DialogDescription>Transparência sobre coleta, uso e proteção dos seus dados pessoais.</DialogDescription>
        </DialogHeader>

        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="max-h-[45vh] overflow-y-auto pr-1 text-sm text-muted-foreground space-y-3"
        >
          <p>
            Coletamos os dados estritamente necessários para cadastro, autenticação, processamento de pedidos e
            comunicação com você.
          </p>
          <p>
            Seus dados podem incluir email, informações de perfil, preferências e registros técnicos de acesso para
            segurança da conta.
          </p>
          <p>
            Tratamos os dados conforme a LGPD, com base legal apropriada e medidas de segurança técnicas e
            organizacionais.
          </p>
          <p>Você pode solicitar atualização, correção ou exclusão de dados, quando aplicável, pelos canais de atendimento da loja.</p>
          <p>
            Esta política pode ser atualizada para refletir mudanças legais ou operacionais. A versão vigente será
            informada na plataforma.
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
