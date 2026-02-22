import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ManualPaymentValidationModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: any;
    onSuccess: () => void;
}

export const ManualPaymentValidationModal = ({
    isOpen,
    onClose,
    order,
    onSuccess
}: ManualPaymentValidationModalProps) => {
    const [isProcessing, setIsProcessing] = useState(false);

    const handleValidation = async (approved: boolean) => {
        if (!order) return;

        setIsProcessing(true);
        try {
            if (approved) {
                // 1. Update order status to paid
                const { error: orderError } = await supabase
                    .from("orders")
                    .update({
                        status: "pago",
                        payment_review_status: "approved",
                        paid_at: new Date().toISOString()
                    })
                    .eq("id", order.id);

                if (orderError) throw orderError;

                // 2. If it's a live cart, update that too
                if (order.live_cart_id) {
                    const { error: cartError } = await supabase
                        .from("live_carts")
                        .update({
                            status: "pago",
                            operational_status: "pago"
                        })
                        .eq("id", order.live_cart_id);
                    if (cartError) console.error("Error updating live cart:", cartError);
                }

                toast.success("Pagamento aprovado com sucesso!");
            } else {
                // Reject - move back to awaiting payment or a special 'rejected' state
                const { error: orderError } = await supabase
                    .from("orders")
                    .update({
                        status: "aguardando_pagamento",
                        payment_review_status: "rejected"
                    })
                    .eq("id", order.id);

                if (orderError) throw orderError;

                // Update live cart if exists
                if (order.live_cart_id) {
                    await supabase
                        .from("live_carts")
                        .update({ operational_status: "pendente" })
                        .eq("id", order.live_cart_id);
                }

                toast.error("Pagamento rejeitado. O cliente precisará enviar um novo comprovante.");
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Error validating payment:", error);
            toast.error("Erro ao processar: " + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!order) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Validar Comprovante de Pagamento</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex justify-between items-center text-sm border-b pb-2">
                        <span className="text-muted-foreground">Pedido:</span>
                        <span className="font-medium">#{order.id.slice(0, 8)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b pb-2">
                        <span className="text-muted-foreground">Cliente:</span>
                        <span className="font-medium">{order.customer_name}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b pb-2">
                        <span className="text-muted-foreground">Valor Total:</span>
                        <span className="font-semibold text-primary">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.total)}
                        </span>
                    </div>

                    <div className="mt-4">
                        <p className="text-sm font-medium mb-2">Comprovante enviado:</p>
                        {order.payment_proof_url ? (
                            <div className="relative group rounded-lg overflow-hidden border bg-muted min-h-[200px] flex items-center justify-center">
                                <img
                                    src={order.payment_proof_url}
                                    alt="Comprovante"
                                    className="max-h-[400px] w-auto object-contain cursor-pointer"
                                    onClick={() => window.open(order.payment_proof_url, '_blank')}
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <Button variant="secondary" size="sm" asChild>
                                        <a href={order.payment_proof_url} target="_blank" rel="noreferrer">
                                            <ExternalLink className="h-4 w-4 mr-2" />
                                            Ampliar
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-8 text-center border-2 border-dashed rounded-lg text-muted-foreground">
                                Comprovante não encontrado ou URL inválida.
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="flex gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        className="flex-1 text-destructive hover:text-destructive"
                        onClick={() => handleValidation(false)}
                        disabled={isProcessing}
                    >
                        <XCircle className="h-4 w-4 mr-2" />
                        Recusar
                    </Button>
                    <Button
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => handleValidation(true)}
                        disabled={isProcessing}
                    >
                        {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                        )}
                        Aprovar Pagamento
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
