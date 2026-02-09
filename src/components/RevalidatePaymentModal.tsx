import { useState } from "react";
import { RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OrderData {
  id: string;
  status: string;
  payment_status: string;
  paid_at: string | null;
  total: number;
  payment_confirmed_amount: number;
  gateway?: string | null;
}

interface LiveCartData {
  id: string;
  status: string;
  paid_at: string | null;
  total: number;
  order_id: string | null;
}

interface RevalidateResult {
  success: boolean;
  message: string;
  error?: string;
  amount?: number;
  already_paid?: boolean;
  order_id?: string;
  order?: OrderData;
  live_cart_id?: string;
  live_cart?: LiveCartData;
  paid_at?: string;
}

interface RevalidatePaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (result: RevalidateResult) => void;
  orderId?: string;
  liveCartId?: string;
}

export function RevalidatePaymentModal({
  open,
  onClose,
  onSuccess,
  orderId,
  liveCartId,
}: RevalidatePaymentModalProps) {
  const [paymentId, setPaymentId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RevalidateResult | null>(null);

  const handleRevalidate = async () => {
    if (!paymentId.trim()) {
      toast.error("Informe o ID do pagamento");
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      // CRITICAL: Send the FULL UUID as order_id, not just the prefix
      const { data, error } = await supabase.functions.invoke("revalidate-payment", {
        body: {
          payment_id: paymentId.trim(),
          // Send full UUID from prop - backend will use this for exact match
          order_id: orderId || undefined,
        },
      });

      if (error) {
        console.error("Revalidate error:", error);
        console.error("Revalidate backend payload:", data);
        const backendMsg = (data as any)?.error || (data as any)?.message;
        const message = backendMsg || error.message || "Erro ao revalidar";
        setResult({ success: false, message });
        toast.error(message);
        return;
      }

      const responseData = data as RevalidateResult;
      console.log("[RevalidatePaymentModal] Response:", responseData);

      // CRITICAL: Only show success if the order/cart is actually marked as "pago"
      const isPaid = 
        responseData.order?.status === "pago" || 
        responseData.order?.payment_status === "approved" ||
        responseData.live_cart?.status === "pago";

      if (responseData.success && isPaid) {
        setResult({
          success: true,
          message: responseData.message,
          amount: responseData.amount,
          already_paid: responseData.already_paid,
          order_id: responseData.order_id,
          order: responseData.order,
          live_cart_id: responseData.live_cart_id,
          live_cart: responseData.live_cart,
          paid_at: responseData.paid_at,
        });
        
        if (!responseData.already_paid) {
          toast.success("✅ Pagamento revalidado e pedido atualizado para PAGO!");
        } else {
          toast.info("Este pedido já estava marcado como pago.");
        }
        
        // CRITICAL: Call onSuccess to trigger refetch in parent component
        onSuccess?.(responseData);
      } else if (responseData.success && !isPaid) {
        // Edge case: API returned success but status is not "pago"
        console.error("[RevalidatePaymentModal] API success but status not pago:", responseData);
        setResult({ 
          success: false, 
          message: responseData.error || "Revalidação falhou. Status não atualizado para 'pago'." 
        });
        toast.error("Falha na persistência. Status não atualizado.");
      } else {
        // Backend explicitly returned error
        const errorMessage = responseData.error || responseData.message || "Falha na revalidação";
        setResult({ success: false, message: errorMessage });
        toast.error(errorMessage);
      }
    } catch (err) {
      console.error("Revalidate exception:", err);
      setResult({ success: false, message: "Erro de conexão. Tente novamente." });
      toast.error("Erro de conexão");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPaymentId("");
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Revalidar Pagamento Mercado Pago
          </DialogTitle>
          <DialogDescription>
            Cole o ID do pagamento do Mercado Pago para buscar e atualizar o status do pedido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Instructions */}
          <Alert variant="default" className="bg-blue-50 border-blue-200">
            <AlertDescription className="text-sm">
              <strong>Como encontrar o Payment ID:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Acesse o <a href="https://www.mercadopago.com.br/activities" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">painel do Mercado Pago</a></li>
                <li>Encontre a transação (aprovada)</li>
                <li>Copie o número do pagamento (ex: 12345678901)</li>
              </ol>
            </AlertDescription>
          </Alert>

          {/* Input */}
          <div className="space-y-2">
            <Label htmlFor="payment_id">ID do Pagamento</Label>
            <Input
              id="payment_id"
              placeholder="Ex: 12345678901"
              value={paymentId}
              onChange={(e) => setPaymentId(e.target.value)}
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading && paymentId.trim()) {
                  handleRevalidate();
                }
              }}
            />
          </div>

          {/* Result */}
          {result && (
            <Alert variant={result.success ? "default" : "destructive"} className={result.success ? "bg-green-50 border-green-200" : ""}>
              {result.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertDescription>
                <span className={result.success ? "text-green-800" : ""}>
                  {result.message}
                </span>
                {result.amount && (
                  <div className="mt-1 font-medium text-green-700">
                    Valor confirmado: R$ {result.amount.toFixed(2)}
                  </div>
                )}
                {result.paid_at && (
                  <div className="mt-1 text-sm text-green-600">
                    Data do pagamento: {new Date(result.paid_at).toLocaleString('pt-BR')}
                  </div>
                )}
                {result.order && (
                  <div className="mt-2 text-xs text-muted-foreground font-mono space-y-1">
                    <div>Pedido: {result.order.id.slice(0, 8)}...</div>
                    <div>Status: <span className="font-semibold text-green-700">{result.order.status}</span></div>
                    <div>Payment Status: <span className="font-semibold">{result.order.payment_status}</span></div>
                  </div>
                )}
                {result.live_cart && (
                  <div className="mt-2 text-xs text-muted-foreground font-mono space-y-1">
                    <div>Sacola: {result.live_cart.id.slice(0, 8)}...</div>
                    <div>Status: <span className="font-semibold text-green-700">{result.live_cart.status}</span></div>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Context */}
          {(orderId || liveCartId) && !result && (
            <p className="text-xs text-muted-foreground">
              {orderId && <>Pedido: <span className="font-mono">{orderId.slice(0, 8)}</span></>}
              {liveCartId && <>Sacola: <span className="font-mono">{liveCartId.slice(0, 8)}</span></>}
            </p>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            {result?.success ? "Fechar" : "Cancelar"}
          </Button>
          {!result?.success && (
            <Button onClick={handleRevalidate} disabled={isLoading || !paymentId.trim()}>
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Revalidar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
