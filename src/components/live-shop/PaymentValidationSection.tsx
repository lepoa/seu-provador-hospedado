import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle,
  XCircle,
  Image as ImageIcon,
  Maximize2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  ShieldX,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { LiveOrderCart } from "@/hooks/useLiveOrders";

interface PaymentValidationSectionProps {
  order: LiveOrderCart;
  isAdmin: boolean;
  onApprove: (orderId: string) => Promise<boolean>;
  onReject: (orderId: string, reason: string) => Promise<boolean>;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  rede: "Maquininha REDE",
  pix_itau: "PIX Itaú",
  pix_rede: "PIX REDE",
  link_rede: "Link Externo REDE",
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao: "Cartão",
};

export function PaymentValidationSection({
  order,
  isAdmin,
  onApprove,
  onReject,
}: PaymentValidationSectionProps) {
  const [showProofModal, setShowProofModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);

  const isPendingValidation = order.payment_review_status === "pending_review";
  const isApproved = order.payment_review_status === "approved";
  const isRejected = order.payment_review_status === "rejected";
  const hasProof = !!order.payment_proof_url;

  // Only show if there's a manual payment (has proof or pending validation)
  if (!hasProof && !isPendingValidation && !isApproved && !isRejected) {
    return null;
  }

  const handleApprove = async () => {
    setIsApproving(true);
    const success = await onApprove(order.id);
    setIsApproving(false);
    return success;
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return;
    setIsRejecting(true);
    const success = await onReject(order.id, rejectionReason);
    setIsRejecting(false);
    if (success) {
      setRejectionReason("");
      setShowRejectForm(false);
    }
  };

  return (
    <div className="space-y-3">
      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Pagamento Manual
          </h4>

          {/* Status Badge */}
          {isPendingValidation && (
            <Badge className="bg-violet-100 text-violet-700 border-violet-300">
              <Clock className="h-3 w-3 mr-1" />
              Aguardando Validação
            </Badge>
          )}
          {isApproved && (
            <Badge className="bg-green-100 text-green-700 border-green-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              Validado
            </Badge>
          )}
          {isRejected && (
            <Badge className="bg-red-100 text-red-700 border-red-300">
              <XCircle className="h-3 w-3 mr-1" />
              Rejeitado
            </Badge>
          )}
        </div>

        {/* Payment Info */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Método</span>
            <span className="font-medium">
              {PAYMENT_METHOD_LABELS[order.paid_method || ""] || order.paid_method}
            </span>
          </div>
          {order.paid_at && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Data/hora</span>
              <span>
                {format(new Date(order.paid_at), "dd/MM/yyyy 'às' HH:mm", {
                  locale: ptBR,
                })}
              </span>
            </div>
          )}
          {order.validated_at && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {isRejected ? "Rejeitado em" : "Validado em"}
              </span>
              <span>
                {format(new Date(order.validated_at), "dd/MM/yyyy 'às' HH:mm", {
                  locale: ptBR,
                })}
              </span>
            </div>
          )}
        </div>

        {/* Proof Image */}
        {hasProof && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Comprovante</Label>
            <div
              className="relative cursor-pointer group"
              onClick={() => setShowProofModal(true)}
            >
              <img
                src={order.payment_proof_url!}
                alt="Comprovante de pagamento"
                className="w-full max-h-48 object-contain rounded-lg border bg-muted"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center">
                <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
              </div>
            </div>
          </div>
        )}

        {/* Rejection Reason Display */}
        {isRejected && order.rejection_reason && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">
              <strong>Motivo:</strong> {order.rejection_reason}
            </p>
          </div>
        )}

        {/* Admin Actions */}
        {isAdmin && isPendingValidation && (
          <div className="space-y-3 pt-2">
            {!showRejectForm ? (
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={handleApprove}
                  disabled={isApproving}
                >
                  {isApproving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Validar Pagamento
                </Button>
                <Button
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => setShowRejectForm(true)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rejeitar
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Motivo da rejeição *</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Ex: Valor divergente, comprovante inválido..."
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRejectForm(false);
                      setRejectionReason("");
                    }}
                    disabled={isRejecting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleReject}
                    disabled={isRejecting || !rejectionReason.trim()}
                  >
                    {isRejecting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Confirmar Rejeição
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Seller View - Pending */}
        {!isAdmin && isPendingValidation && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Aguardando validação do admin</p>
              <p className="text-amber-700">
                O pagamento foi registrado e está sendo revisado. Você será
                notificada quando for aprovado.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Proof Modal */}
      <Dialog open={showProofModal} onOpenChange={setShowProofModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Comprovante de Pagamento</DialogTitle>
          </DialogHeader>
          {hasProof && (
            <img
              src={order.payment_proof_url!}
              alt="Comprovante de pagamento"
              className="w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
