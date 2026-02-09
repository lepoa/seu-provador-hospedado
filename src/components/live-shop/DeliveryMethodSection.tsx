import { useState, useEffect } from "react";
import { Truck, Store, Bike, AlertTriangle, Loader2, CheckCircle, MapPin, Edit3, Calculator, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { STORE_CONFIG } from "@/lib/storeDeliveryConfig";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { maskCep } from "@/hooks/useCepLookup";
import type { DeliveryMethod } from "@/hooks/useLiveOrders";

interface ShippingQuote {
  id: string;
  service: string;
  serviceName: string;
  name: string;
  price: number;
  deliveryDays: number;
  deliveryTime: number;
  deliveryRange?: { min: number; max: number };
  company: string;
}

interface DeliveryMethodSectionProps {
  orderId: string;
  currentMethod: DeliveryMethod;
  currentShipping: number;
  currentShippingService?: string | null;
  subtotal: number;
  discounts: number;
  isPaid: boolean;
  isAwaitingPayment: boolean;
  customerZipCode?: string | null;
  customerId?: string | null;
  orderItems?: { qtd: number; product_id: string }[];
  onUpdateDelivery: (orderId: string, method: DeliveryMethod, shippingAmount: number, shippingService?: string) => Promise<boolean>;
  onUpdateCustomerZip?: (customerId: string, zipCode: string) => Promise<boolean>;
}

export function DeliveryMethodSection({
  orderId,
  currentMethod,
  currentShipping,
  currentShippingService,
  subtotal,
  discounts,
  isPaid,
  isAwaitingPayment,
  customerZipCode,
  customerId,
  orderItems = [],
  onUpdateDelivery,
  onUpdateCustomerZip,
}: DeliveryMethodSectionProps) {
  const [selectedMethod, setSelectedMethod] = useState<DeliveryMethod>(currentMethod);
  const [correiosShipping, setCorreiosShipping] = useState<string>(
    currentMethod === 'correios' && currentShipping > 0 ? currentShipping.toString() : ""
  );
  const [selectedServiceName, setSelectedServiceName] = useState<string>(currentShippingService || "");
  const [isSaving, setIsSaving] = useState(false);
  
  // CEP and shipping calculation state
  const [cep, setCep] = useState<string>(customerZipCode || "");
  const [isCalculating, setIsCalculating] = useState(false);
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>("");
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualShipping, setManualShipping] = useState<string>("");

  // Check if delivery has been confirmed (saved to DB)
  // This is true when currentMethod is set AND (not correios OR has shipping)
  const isDeliveryConfirmed = (): boolean => {
    if (!currentMethod || currentMethod === 'retirada') return currentMethod === 'retirada';
    if (currentMethod === 'motoboy') return currentShipping === STORE_CONFIG.motoboyFee;
    if (currentMethod === 'correios') return currentShipping > 0;
    return false;
  };

  // Initialize CEP from customer data
  useEffect(() => {
    if (customerZipCode && !cep) {
      setCep(customerZipCode);
    }
  }, [customerZipCode]);

  // Reset quotes when changing to a non-correios method
  useEffect(() => {
    if (selectedMethod !== 'correios') {
      setQuotes([]);
      setSelectedQuoteId("");
      setShippingError(null);
      setShowManualInput(false);
    }
  }, [selectedMethod]);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Calculate shipping via Melhor Envio
  const calculateShipping = async () => {
    const cleanCep = cep.replace(/\D/g, "");
    
    if (cleanCep.length !== 8) {
      setShippingError("CEP deve ter 8 dígitos");
      return;
    }

    setIsCalculating(true);
    setShippingError(null);
    setQuotes([]);
    setSelectedQuoteId("");
    setShowManualInput(false);

    try {
      // Calculate total weight based on items (default 0.3kg per item if not specified)
      const totalWeight = orderItems.reduce((sum, item) => sum + (item.qtd * 0.3), 0) || 0.5;
      
      const payload = {
        toZipCode: cleanCep,
        weight: Math.max(0.3, totalWeight),
        length: 30,
        width: 20,
        height: Math.min(100, 10 + orderItems.reduce((sum, item) => sum + item.qtd * 3, 0)),
      };

      console.log("[DeliverySection] Calculating shipping:", payload);

      const { data, error: fnError } = await supabase.functions.invoke("calculate-shipping", {
        body: payload,
      });

      console.log("[DeliverySection] Response:", data);

      if (fnError) {
        console.error("[DeliverySection] Function error:", fnError);
        setShippingError("Erro ao calcular frete. Use o frete manual.");
        setShowManualInput(true);
        return;
      }

      if (data?.error) {
        setShippingError(data.error);
        setShowManualInput(true);
        return;
      }

      if (data?.quotes && data.quotes.length > 0) {
        setQuotes(data.quotes);
        toast.success("Opções de frete carregadas!");
      } else {
        setShippingError("Nenhuma opção de frete disponível para este CEP");
        setShowManualInput(true);
      }
    } catch (err: any) {
      console.error("[DeliverySection] Exception:", err);
      setShippingError("Erro de conexão. Use o frete manual.");
      setShowManualInput(true);
    } finally {
      setIsCalculating(false);
    }
  };

  // Handle quote selection
  const handleQuoteSelect = (quoteId: string) => {
    setSelectedQuoteId(quoteId);
    const quote = quotes.find(q => q.id === quoteId);
    if (quote) {
      setCorreiosShipping(quote.price.toString());
      setSelectedServiceName(quote.name || quote.serviceName);
      setShowManualInput(false);
      setManualShipping("");
    }
  };

  // Handle manual shipping input
  const handleManualShippingConfirm = () => {
    const parsed = parseFloat(manualShipping.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    setCorreiosShipping(parsed.toString());
    setSelectedServiceName("Manual");
    setSelectedQuoteId("");
  };

  // Calculate shipping based on method
  const getShippingForMethod = (method: DeliveryMethod): number => {
    if (method === 'retirada') return 0;
    if (method === 'motoboy') return STORE_CONFIG.motoboyFee;
    if (method === 'correios') {
      const parsed = parseFloat(correiosShipping.replace(',', '.'));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  // Calculate new total
  const calculateTotal = (method: DeliveryMethod): number => {
    const shipping = getShippingForMethod(method);
    return subtotal - discounts + shipping;
  };

  // Check if can save
  const canSave = (): boolean => {
    if (selectedMethod === 'correios') {
      const cleanCep = cep.replace(/\D/g, "");
      if (cleanCep.length !== 8) return false;
      const parsed = parseFloat(correiosShipping.replace(',', '.'));
      return !isNaN(parsed) && parsed > 0;
    }
    return true;
  };

  // Check if there are unsaved changes that need confirmation
  const hasUnsavedChanges = (): boolean => {
    if (selectedMethod !== currentMethod) return true;
    if (selectedMethod === 'correios') {
      const newShipping = parseFloat(correiosShipping.replace(',', '.')) || 0;
      return newShipping !== currentShipping;
    }
    if (selectedMethod === 'motoboy' && currentShipping !== STORE_CONFIG.motoboyFee) return true;
    if (selectedMethod === 'retirada' && currentShipping !== 0) return true;
    return false;
  };

  // Check if we can show the confirm button
  const canShowConfirmButton = (): boolean => {
    // Show if not yet confirmed, or if there are changes
    if (!isDeliveryConfirmed()) return canSave();
    return hasUnsavedChanges() && canSave();
  };

  // Handle save
  const handleSave = async () => {
    if (!canSave()) return;

    setIsSaving(true);
    const shippingAmount = getShippingForMethod(selectedMethod);
    const serviceName = selectedMethod === 'correios' ? selectedServiceName : undefined;
    
    const success = await onUpdateDelivery(orderId, selectedMethod, shippingAmount, serviceName);
    
    // If CEP was entered/changed and customer exists, save to customer record
    if (success && selectedMethod === 'correios' && customerId && onUpdateCustomerZip) {
      const cleanCep = cep.replace(/\D/g, "");
      if (cleanCep.length === 8 && cleanCep !== customerZipCode?.replace(/\D/g, "")) {
        await onUpdateCustomerZip(customerId, cleanCep);
      }
    }
    
    setIsSaving(false);

    if (success) {
      setCorreiosShipping(shippingAmount.toString());
    }
  };

  // Handle method change
  const handleMethodChange = (method: DeliveryMethod) => {
    setSelectedMethod(method);
    if (method !== 'correios') {
      setCorreiosShipping("");
      setQuotes([]);
      setSelectedQuoteId("");
      setShowManualInput(false);
    }
  };

  // Delivery icon and label
  const DeliveryIcon = selectedMethod === 'correios' ? Truck 
    : selectedMethod === 'motoboy' ? Bike 
    : Store;

  const deliveryLabel = selectedMethod === 'correios' ? 'Correios' 
    : selectedMethod === 'motoboy' ? 'Motoboy' 
    : 'Retirada na Loja';

  // If paid, show read-only
  if (isPaid) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium flex items-center gap-2">
            <DeliveryIcon className="h-4 w-4" />
            Entrega: {deliveryLabel}
          </h4>
          <Badge className="bg-green-100 text-green-700 border-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Confirmada
          </Badge>
        </div>
        {currentShipping > 0 && (
          <div className="text-sm text-muted-foreground">
            Frete: {formatPrice(currentShipping)}
            {currentShippingService && ` (${currentShippingService})`}
          </div>
        )}
      </div>
    );
  }

  // Not paid - allow editing
  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <DeliveryIcon className="h-4 w-4" />
          ETAPA 1: Forma de Envio
        </h4>
        {isDeliveryConfirmed() ? (
          <Badge className="bg-green-100 text-green-700 border-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Confirmada
          </Badge>
        ) : (
          <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        )}
      </div>

      {/* Method selector */}
      <Select
        value={selectedMethod}
        onValueChange={(value) => handleMethodChange(value as DeliveryMethod)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="retirada">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              Retirada na Loja (Grátis)
            </div>
          </SelectItem>
          <SelectItem value="motoboy">
            <div className="flex items-center gap-2">
              <Bike className="h-4 w-4" />
              Motoboy - {formatPrice(STORE_CONFIG.motoboyFee)}
            </div>
          </SelectItem>
          <SelectItem value="correios">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Correios
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Correios section with CEP and shipping calculation */}
      {selectedMethod === 'correios' && (
        <div className="space-y-4 border-t pt-4">
          {/* CEP Input */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              CEP de destino *
            </Label>
            <div className="flex gap-2">
              <Input
                value={maskCep(cep)}
                onChange={(e) => setCep(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="00000-000"
                maxLength={9}
                disabled={isCalculating}
                className="flex-1"
              />
              <Button
                variant="secondary"
                onClick={calculateShipping}
                disabled={isCalculating || cep.replace(/\D/g, "").length !== 8}
              >
                {isCalculating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Calculando...
                  </>
                ) : (
                  <>
                    <Calculator className="h-4 w-4 mr-2" />
                    Calcular
                  </>
                )}
              </Button>
            </div>
            {cep.replace(/\D/g, "").length !== 8 && (
              <p className="text-xs text-muted-foreground">Informe o CEP para calcular o frete</p>
            )}
          </div>

          {/* Error message */}
          {shippingError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 inline mr-2" />
              {shippingError}
            </div>
          )}

          {/* Shipping quotes */}
          {quotes.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Escolha o serviço
              </Label>
              <RadioGroup
                value={selectedQuoteId}
                onValueChange={handleQuoteSelect}
              >
                {quotes.map((quote) => (
                  <label
                    key={quote.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                      selectedQuoteId === quote.id
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value={quote.id} />
                      <div>
                        <p className="font-medium text-sm">{quote.name || quote.serviceName}</p>
                        <p className="text-xs text-muted-foreground">
                          {quote.deliveryRange
                            ? `${quote.deliveryRange.min}-${quote.deliveryRange.max} dias úteis`
                            : `${quote.deliveryDays || quote.deliveryTime} dias úteis`}
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold">{formatPrice(quote.price)}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Manual fallback button */}
          {(quotes.length > 0 || shippingError) && (
            <div className="pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowManualInput(!showManualInput)}
                className="text-muted-foreground"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                {showManualInput ? "Ocultar frete manual" : "Inserir frete manual"}
              </Button>
            </div>
          )}

          {/* Manual shipping input */}
          {showManualInput && (
            <div className="space-y-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Label className="text-sm text-amber-800">Valor do frete (manual)</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 25,90"
                  value={manualShipping}
                  onChange={(e) => setManualShipping(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleManualShippingConfirm}
                  disabled={!manualShipping}
                >
                  Usar
                </Button>
              </div>
            </div>
          )}

          {/* Selected shipping display */}
          {parseFloat(correiosShipping) > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-green-800">Frete selecionado</p>
                <p className="text-sm text-green-600">
                  {selectedServiceName || "Manual"}: {formatPrice(parseFloat(correiosShipping))}
                </p>
              </div>
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          )}
        </div>
      )}

      {/* Preview of new total */}
      <div className="bg-background p-3 rounded-md space-y-1">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        {discounts > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Descontos</span>
            <span>-{formatPrice(discounts)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Frete</span>
          <span className={cn(
            getShippingForMethod(selectedMethod) > 0 ? "text-foreground" : "text-muted-foreground"
          )}>
            {getShippingForMethod(selectedMethod) > 0 
              ? formatPrice(getShippingForMethod(selectedMethod))
              : "Grátis"}
          </span>
        </div>
        <div className="flex justify-between text-base font-bold pt-2 border-t">
          <span>Total</span>
          <span>{formatPrice(calculateTotal(selectedMethod))}</span>
        </div>
      </div>

      {/* Confirm delivery button - Always show when can save and needs confirmation */}
      {canShowConfirmButton() && (
        <Button
          className="w-full bg-blue-600 hover:bg-blue-700"
          onClick={handleSave}
          disabled={!canSave() || isSaving}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <PackageCheck className="h-4 w-4 mr-2" />
          )}
          Confirmar Forma de Envio
        </Button>
      )}

      {/* Visual state when delivery is confirmed and no changes */}
      {isDeliveryConfirmed() && !hasUnsavedChanges() && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-green-800">Entrega confirmada</p>
            <p className="text-sm text-green-700">
              {selectedMethod === 'retirada' && "Retirada na loja - Grátis"}
              {selectedMethod === 'motoboy' && `Motoboy - ${formatPrice(STORE_CONFIG.motoboyFee)}`}
              {selectedMethod === 'correios' && `${currentShippingService || 'Correios'} - ${formatPrice(currentShipping)}`}
            </p>
          </div>
        </div>
      )}

      {/* Warning if not configured for payment */}
      {isAwaitingPayment && !isDeliveryConfirmed() && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Confirme a entrega antes do pagamento</p>
            <p className="text-amber-700">
              {!selectedMethod 
                ? "Selecione um método de entrega."
                : selectedMethod === 'correios' && cep.replace(/\D/g, "").length !== 8 
                ? "Informe o CEP de destino para calcular o frete."
                : selectedMethod === 'correios' && parseFloat(correiosShipping) === 0
                ? "Selecione uma opção de frete ou informe manualmente."
                : "Clique em 'Confirmar Forma de Envio' para prosseguir."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to check if delivery is properly confirmed (saved to DB) for payment
export function isDeliveryConfiguredForPayment(
  method: DeliveryMethod | undefined,
  shippingAmount: number,
  zipCode?: string | null
): boolean {
  if (!method) return false;
  
  // For retirada, it must be the selected method with zero shipping
  if (method === 'retirada') return shippingAmount === 0;
  
  // For motoboy, must have the fixed fee saved
  if (method === 'motoboy') return shippingAmount === 10; // R$ 10 motoboy fee
  
  // For correios, need valid shipping amount saved
  if (method === 'correios') {
    const hasValidShipping = shippingAmount > 0;
    return hasValidShipping;
  }
  
  return false;
}
