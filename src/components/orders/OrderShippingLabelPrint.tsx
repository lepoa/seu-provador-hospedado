import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Truck, Loader2, ExternalLink, AlertCircle, Edit2, Save, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Order {
  id: string;
  created_at: string;
  status: string;
  total: number;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_id?: string | null;
  delivery_method: string | null;
  tracking_code?: string | null;
  me_label_url?: string | null;
  me_shipment_id?: string | null;
  paid_at?: string | null;
  // New shipping status fields
  shipping_status?: string | null;
  shipping_label_generated_at?: string | null;
  address_snapshot?: {
    name?: string;
    full_name?: string;
    street?: string;
    address_line?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    district?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    cpf?: string;
    document?: string;
    reference?: string;
    address_reference?: string;
  } | null;
}

interface OrderShippingLabelPrintProps {
  order: Order;
  variant?: "button" | "full";
  onLabelGenerated?: (labelUrl: string, trackingCode: string) => void;
  onOrderUpdated?: (order: Order) => void;
}

// Format CPF with mask
function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

// Normalize status to check if paid using paid_at as primary source of truth
function isOrderPaid(order: { status: string; paid_at?: string | null }): boolean {
  // paid_at is the source of truth
  if (order.paid_at) return true;
  
  // Fallback to status text
  const normalized = order.status.toLowerCase().trim();
  return ['pago', 'paid', 'approved', 'payment_approved'].includes(normalized);
}

// Check if status is awaiting payment
function isStatusAwaitingPayment(order: { status: string; paid_at?: string | null }): boolean {
  // If paid_at exists, it's not awaiting payment
  if (order.paid_at) return false;
  
  const normalized = order.status.toLowerCase().trim();
  return normalized === 'pendente' || 
         normalized === 'aguardando_pagamento' || 
         normalized === 'pagamento_rejeitado' ||
         normalized === 'pending';
}

// Check if label was already generated (using shipping_status or tracking_code or me_label_url)
function hasLabelBeenGenerated(order: { 
  tracking_code?: string | null; 
  me_label_url?: string | null;
  shipping_status?: string | null;
}): boolean {
  return !!order.me_label_url || 
         !!order.tracking_code || 
         order.shipping_status === 'etiqueta_gerada';
}

export function OrderShippingLabelPrint({ 
  order, 
  variant = "button", 
  onLabelGenerated,
  onOrderUpdated 
}: OrderShippingLabelPrintProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCpfModal, setShowCpfModal] = useState(false);
  const [cpfValue, setCpfValue] = useState("");
  const [isSavingCpf, setIsSavingCpf] = useState(false);
  const [currentOrderStatus, setCurrentOrderStatus] = useState(order.status);
  
  // Status categories for clear logic - using paid_at as source of truth
  const isCorreios = order.delivery_method === 'shipping';
  const hasLabel = !!order.me_label_url;
  const labelAlreadyGenerated = hasLabelBeenGenerated(order);
  
  // Use order-level checks (includes paid_at check)
  const isPaid = isOrderPaid(order);
  const isAwaitingPayment = isStatusAwaitingPayment(order);
  
  // canPrint = already has a label to print
  const canPrint = hasLabel;

  // Check if address has minimum required data
  const address = order.address_snapshot;
  const hasCompleteAddress = address && 
    address.zip_code && 
    (address.street || address.address_line) && 
    address.city && 
    address.state;
  
  // CPF can be in document or cpf field - must have exactly 11 digits
  const cpfRaw = (address?.document || address?.cpf || "").replace(/\D/g, "");
  const hasCpf = cpfRaw.length === 11;
  
  // showGenerateSection = show the generate UI ONLY when:
  // - order is paid (paid_at exists OR status is pago/paid/approved)
  // - is Correios delivery
  // - no label exists yet (check shipping_status, tracking_code, me_label_url)
  // - has complete address
  const showGenerateSection = isPaid && isCorreios && !labelAlreadyGenerated && hasCompleteAddress;
  
  // canGenerate = can actually click the generate button (needs valid CPF)
  const canGenerate = showGenerateSection && hasCpf;

  const handleOpenCpfModal = () => {
    setCpfValue(cpfRaw);
    setShowCpfModal(true);
  };

  const handleSaveCpf = async () => {
    const cleanCpf = cpfValue.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      toast.error("CPF deve ter 11 dígitos");
      return;
    }

    setIsSavingCpf(true);
    try {
      // Update the address_snapshot in the order with the new CPF
      const updatedSnapshot = {
        ...order.address_snapshot,
        document: cleanCpf,
      };

      const { error: orderError } = await supabase
        .from("orders")
        .update({
          address_snapshot: updatedSnapshot,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (orderError) throw orderError;

      // Also update the customer's permanent record if available
      if (order.customer_id) {
        // Update customers.document
        await supabase
          .from("customers")
          .update({ document: cleanCpf })
          .eq("id", order.customer_id);

        // Also update customer_addresses.document (default address)
        const { data: defaultAddr } = await supabase
          .from("customer_addresses")
          .select("id")
          .eq("customer_id", order.customer_id)
          .eq("is_default", true)
          .maybeSingle();

        if (defaultAddr) {
          await supabase
            .from("customer_addresses")
            .update({ document: cleanCpf })
            .eq("id", defaultAddr.id);
        }
      }

      toast.success("CPF salvo com sucesso!");
      setShowCpfModal(false);

      // Notify parent to refresh order data
      if (onOrderUpdated) {
        onOrderUpdated({
          ...order,
          address_snapshot: updatedSnapshot,
        });
      }
    } catch (error: any) {
      console.error("Error saving CPF:", error);
      toast.error("Erro ao salvar CPF");
    } finally {
      setIsSavingCpf(false);
    }
  };

  const handleGenerateLabel = async () => {
    if (!hasCompleteAddress) {
      toast.error("Endereço incompleto. Verifique CEP, rua, cidade e estado.");
      return;
    }

    if (!hasCpf) {
      handleOpenCpfModal();
      return;
    }

    setShowConfirmDialog(true);
  };

  const confirmGenerateLabel = async () => {
    setShowConfirmDialog(false);
    setIsGenerating(true);

    // Debug log for support
    console.log('[ShippingLabel] Starting label generation', {
      orderId: order.id,
      currentStatus: order.status,
      normalizedStatus: order.status.toLowerCase().trim(),
    });

    try {
      // STEP 1: Refetch order to get current status from database
      const { data: freshOrder, error: fetchError } = await supabase
        .from('orders')
        .select('id, status, paid_at, tracking_code, me_label_url, shipping_status')
        .eq('id', order.id)
        .single();

      if (fetchError || !freshOrder) {
        console.error('[ShippingLabel] Failed to refetch order:', fetchError);
        toast.error('Erro ao verificar status do pedido. Tente novamente.');
        return;
      }

      console.log('[ShippingLabel] Refetched order:', {
        orderId: freshOrder.id,
        dbStatus: freshOrder.status,
        paid_at: freshOrder.paid_at,
        shipping_status: freshOrder.shipping_status,
        tracking_code: freshOrder.tracking_code,
        me_label_url: freshOrder.me_label_url,
      });

      // Update local status state
      setCurrentOrderStatus(freshOrder.status);

      // STEP 1.5: Check if label was already generated (prevent duplicates)
      if (hasLabelBeenGenerated(freshOrder)) {
        toast.error(
          <div className="space-y-1">
            <p><strong>Etiqueta já foi gerada</strong></p>
            <p className="text-sm">Este pedido já possui uma etiqueta gerada.</p>
            {freshOrder.tracking_code && <p className="text-xs text-muted-foreground">Rastreio: {freshOrder.tracking_code}</p>}
          </div>,
          { duration: 6000 }
        );
        return;
      }

      // STEP 2: Validate payment status before calling Edge Function
      // Use paid_at as source of truth
      const freshIsPaid = isOrderPaid(freshOrder);
      if (!freshIsPaid) {
        toast.error(
          <div className="space-y-1">
            <p><strong>Pedido ainda não está pago</strong></p>
            <p className="text-sm">Status atual: {freshOrder.status}</p>
            <p className="text-xs text-muted-foreground">
              {freshOrder.paid_at ? `Pagamento registrado: ${new Date(freshOrder.paid_at).toLocaleString('pt-BR')}` : 'Aguarde a confirmação do pagamento para gerar a etiqueta.'}
            </p>
          </div>,
          { duration: 6000 }
        );
        return;
      }

      // STEP 3: Call Edge Function
      const { data, error } = await supabase.functions.invoke('generate-order-shipping-label', {
        body: { orderId: order.id }
      });

      // Log full response for debugging
      console.log('[ShippingLabel] Edge Function response:', {
        orderId: order.id,
        hasError: !!error,
        errorMessage: error?.message,
        errorContext: (error as any)?.context,
        data: data,
      });

      // Handle Supabase invoke error (network, auth, non-2xx responses)
      if (error) {
        console.error('[ShippingLabel] Edge function invoke error:', error);
        
        // Extract the actual response body from FunctionsHttpError
        // The Supabase client puts the response in error.context for non-2xx responses
        let errorBody: any = null;
        try {
          // Try to get JSON from context
          const context = (error as any)?.context;
          if (context) {
            // context might be a Response object or already parsed
            if (typeof context.json === 'function') {
              errorBody = await context.json();
            } else if (context.body) {
              errorBody = context.body;
            } else if (typeof context === 'object') {
              errorBody = context;
            }
          }
        } catch (parseErr) {
          console.error('[ShippingLabel] Failed to parse error context:', parseErr);
        }

        console.log('[ShippingLabel] Extracted error body:', errorBody);

        // If we got the real error body, handle it properly
        if (errorBody?.error) {
          // Handle wallet recharge case
          if (errorBody.action === 'recharge_wallet') {
            toast.error(
              <div className="space-y-2">
                <p><strong>Saldo insuficiente no Melhor Envio</strong></p>
                <p className="text-sm">{errorBody.details || 'Recarregue a carteira e tente novamente.'}</p>
                {errorBody.wallet_url && (
                  <a 
                    href={errorBody.wallet_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 underline text-sm block"
                  >
                    Recarregar carteira →
                  </a>
                )}
              </div>,
              { duration: 10000 }
            );
            return;
          }

          // Handle missing fields
          if (errorBody.missing_fields) {
            toast.error(
              <div className="space-y-1">
                <p><strong>Dados faltando para gerar etiqueta</strong></p>
                <p className="text-sm">{errorBody.missing_fields.join(', ')}</p>
              </div>
            );
            return;
          }

          // Show the real error message
          toast.error(
            <div className="space-y-1">
              <p><strong>Erro ao gerar etiqueta</strong></p>
              <p className="text-sm">{errorBody.error || errorBody.message}</p>
              {errorBody.details && <p className="text-xs text-muted-foreground">{errorBody.details}</p>}
            </div>,
            { duration: 8000 }
          );
          return;
        }
        
        // Fallback to generic error if we couldn't parse the body
        toast.error(
          <div className="space-y-1">
            <p><strong>Erro ao gerar etiqueta</strong></p>
            <p className="text-sm">{error.message || 'Erro desconhecido'}</p>
          </div>,
          { duration: 8000 }
        );
        return;
      }

      // Handle Edge Function returning error in response body
      if (data?.error) {
        console.error('[ShippingLabel] Edge function error in response:', data);
        
        // Handle specific error cases
        if (data.action === 'recharge_wallet') {
          toast.error(
            <div className="space-y-2">
              <p><strong>Saldo insuficiente no Melhor Envio</strong></p>
              <p className="text-sm">{data.details}</p>
              <a 
                href={data.wallet_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 underline text-sm"
              >
                Recarregar carteira →
              </a>
            </div>,
            { duration: 10000 }
          );
          return;
        }

        if (data.missing_fields) {
          toast.error(
            <div className="space-y-1">
              <p><strong>Dados faltando para gerar etiqueta</strong></p>
              <p className="text-sm">{data.missing_fields.join(', ')}</p>
            </div>
          );
          return;
        }

        // Show the real error message from backend
        const statusCode = data.status || data.statusCode || 'Erro';
        toast.error(
          <div className="space-y-1">
            <p><strong>Erro ao gerar etiqueta ({statusCode})</strong></p>
            <p className="text-sm">{data.error || data.message || 'Erro desconhecido'}</p>
            {data.details && <p className="text-xs text-muted-foreground">{data.details}</p>}
          </div>,
          { duration: 8000 }
        );
        return;
      }

      if (data?.success || data?.label_url) {
        toast.success(
          <div className="space-y-1">
            <p><strong>Etiqueta gerada com sucesso!</strong></p>
            {data.tracking_code && <p className="text-sm">Rastreio: {data.tracking_code}</p>}
          </div>
        );

        // Notify parent component
        if (onLabelGenerated) {
          onLabelGenerated(data.label_url, data.tracking_code);
        }

        // Open label in new tab
        if (data.label_url) {
          window.open(data.label_url, '_blank');
        }
      }
    } catch (err: any) {
      console.error('[ShippingLabel] Unexpected error:', err);
      toast.error(
        <div className="space-y-1">
          <p><strong>Erro inesperado</strong></p>
          <p className="text-sm">{err?.message || 'Falha ao gerar etiqueta'}</p>
        </div>,
        { duration: 8000 }
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintLabel = () => {
    if (order.me_label_url) {
      window.open(order.me_label_url, '_blank');
    }
  };

  // Don't show anything if not Correios delivery
  if (!isCorreios) {
    return null;
  }

  // Show generate section when conditions are met (button enabled/disabled based on CPF)
  if (showGenerateSection) {
    return (
      <>
        <div className="flex flex-col gap-2">
          {/* CPF warning and entry button when missing */}
          {!hasCpf && (
            <div className="flex flex-col gap-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={handleOpenCpfModal}
              >
                <Edit2 className="h-4 w-4" />
                Cadastrar CPF para Etiqueta
              </Button>
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                CPF obrigatório para gerar etiqueta Correios
              </span>
            </div>
          )}

          {/* Generate button - enabled only if CPF is valid */}
          <Button
            variant={variant === "full" ? "default" : "outline"}
            size="sm"
            className={variant === "full" 
              ? `gap-2 ${canGenerate ? 'bg-orange-600 hover:bg-orange-700' : 'bg-muted text-muted-foreground cursor-not-allowed'}`
              : `gap-2 ${canGenerate ? 'border-orange-300 text-orange-700 hover:bg-orange-50' : 'border-muted text-muted-foreground cursor-not-allowed'}`
            }
            onClick={(e) => {
              e.stopPropagation();
              if (canGenerate) {
                handleGenerateLabel();
              }
            }}
            disabled={isGenerating || !canGenerate}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Truck className="h-4 w-4" />
                {variant === "full" ? "Gerar Etiqueta (Melhor Envio)" : "Gerar Etiqueta"}
              </>
            )}
          </Button>

          {/* Show CPF with edit button when valid */}
          {hasCpf && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-600">
                CPF: {formatCpf(cpfRaw)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenCpfModal();
                }}
              >
                <Edit2 className="h-3 w-3 mr-1" />
                Editar
              </Button>
            </div>
          )}
        </div>

        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Gerar Etiqueta dos Correios?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>Esta ação irá:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Comprar a etiqueta no Melhor Envio (débito na carteira)</li>
                  <li>Gerar o PDF oficial para postagem nos Correios</li>
                  <li>Atualizar o status do pedido para "Etiqueta Gerada"</li>
                </ul>
                <p className="font-medium mt-2">
                  Destinatário: {order.customer_name}<br/>
                  CPF: {formatCpf(cpfRaw)}<br/>
                  CEP: {address?.zip_code}
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmGenerateLabel}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Confirmar e Gerar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* CPF Modal */}
        <Dialog open={showCpfModal} onOpenChange={setShowCpfModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{hasCpf ? 'Editar' : 'Cadastrar'} CPF do Destinatário</DialogTitle>
              <DialogDescription>
                O CPF é obrigatório para gerar etiquetas dos Correios via Melhor Envio.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF (11 dígitos)</Label>
                <Input
                  id="cpf"
                  value={formatCpf(cpfValue)}
                  onChange={(e) => setCpfValue(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
                {cpfValue && cpfValue.length > 0 && cpfValue.length !== 11 && (
                  <p className="text-xs text-amber-600">CPF deve ter 11 dígitos ({cpfValue.length}/11)</p>
                )}
              </div>
              <div className="bg-muted/50 rounded p-3 text-sm">
                <p className="font-medium">Destinatário:</p>
                <p>{order.customer_name}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  {address?.city}/{address?.state} - CEP {address?.zip_code}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCpfModal(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveCpf}
                disabled={cpfValue.length !== 11 || isSavingCpf}
                className="gap-2"
              >
                {isSavingCpf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar CPF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Show print button if label exists (CPF is now locked)
  if (canPrint) {
    return (
      <div className="flex flex-col gap-1">
        <Button
          variant={variant === "full" ? "default" : "outline"}
          size="sm"
          className={variant === "full" 
            ? "gap-2 bg-green-600 hover:bg-green-700" 
            : "gap-2 border-green-300 text-green-700 hover:bg-green-50"
          }
          onClick={(e) => {
            e.stopPropagation();
            handlePrintLabel();
          }}
        >
          <ExternalLink className="h-4 w-4" />
          {variant === "full" ? "Imprimir Etiqueta Correios" : "Imprimir Etiqueta"}
        </Button>
        {order.tracking_code && (
          <span className="text-xs text-muted-foreground">
            Rastreio: {order.tracking_code}
          </span>
        )}
        {hasCpf && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            <span>CPF: {formatCpf(cpfRaw)}</span>
            <span className="text-[10px] italic">(não editável após etiqueta)</span>
          </div>
        )}
      </div>
    );
  }

  // Order not in the right status - show clear lock message
  if (isAwaitingPayment) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
        <Lock className="h-4 w-4 text-amber-600" />
        <span className="text-xs text-amber-700 font-medium">
          🔒 Aguardando pagamento para liberar envio
        </span>
      </div>
    );
  }

  // Order has label data but missing me_label_url (can happen if tracking exists but not URL)
  if (labelAlreadyGenerated && !hasLabel) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 bg-green-50 border border-green-200 rounded-lg">
        <Truck className="h-4 w-4 text-green-600" />
        <span className="text-xs text-green-700 font-medium">
          ✓ Etiqueta já gerada {order.tracking_code ? `• ${order.tracking_code}` : ''}
        </span>
      </div>
    );
  }

  // Missing address
  if (!hasCompleteAddress) {
    return (
      <span className="text-xs text-red-500 flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        Endereço incompleto
      </span>
    );
  }

  return null;
}
