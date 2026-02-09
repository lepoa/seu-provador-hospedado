import { useState } from "react";
import { Loader2, RefreshCw, AlertTriangle, MapPin, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ShippingQuote {
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

interface ShippingCalculatorProps {
  zipCode: string;
  onZipCodeChange?: (zip: string) => void;
  cartWeight?: number;
  cartDimensions?: { length: number; width: number; height: number };
  selectedQuote: ShippingQuote | null;
  onQuoteSelect: (quote: ShippingQuote) => void;
  disabled?: boolean;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
}

export function ShippingCalculator({
  zipCode,
  onZipCodeChange,
  cartWeight = 0.5,
  cartDimensions = { length: 30, width: 20, height: 10 },
  selectedQuote,
  onQuoteSelect,
  disabled = false,
}: ShippingCalculatorProps) {
  const [localZip, setLocalZip] = useState(zipCode);
  const [isLoading, setIsLoading] = useState(false);
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const handleZipChange = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 8);
    setLocalZip(cleaned);
    onZipCodeChange?.(cleaned);
  };

  const calculateShipping = async () => {
    const cleanZip = localZip.replace(/\D/g, "");
    
    if (cleanZip.length !== 8) {
      setError("CEP deve ter 8 dígitos");
      return;
    }

    setIsLoading(true);
    setError(null);
    setErrorDetails(null);
    // Keep existing quotes visible during recalculation
    // setQuotes([]);

    try {
      const payload = {
        toZipCode: cleanZip,
        weight: cartWeight,
        length: cartDimensions.length,
        width: cartDimensions.width,
        height: cartDimensions.height,
      };
      
      console.log("[ShippingCalculator] Calculating shipping:", payload);

      const { data, error: fnError } = await supabase.functions.invoke("calculate-shipping", {
        body: payload,
      });

      console.log("[ShippingCalculator] Response:", data);

      if (fnError) {
        console.error("[ShippingCalculator] Function error:", fnError);
        setError("Erro ao calcular frete");
        setErrorDetails(fnError.message || "Erro na comunicação com o servidor");
        return;
      }

      if (data?.error) {
        setError(data.error);
        setErrorDetails(data.details || null);
        
        // Still set empty quotes if available
        if (data.quotes) setQuotes(data.quotes);
        return;
      }

      if (data?.quotes && data.quotes.length > 0) {
        setQuotes(data.quotes);
        // Auto-select the first (cheapest) option if none selected
        if (!selectedQuote) {
          onQuoteSelect(data.quotes[0]);
          toast.success("Frete calculado! Selecione uma opção.");
        } else {
          // Re-select the same service if available after recalculation
          const sameService = data.quotes.find((q: ShippingQuote) => q.id === selectedQuote.id);
          if (sameService) {
            onQuoteSelect(sameService);
          } else {
            onQuoteSelect(data.quotes[0]);
          }
          toast.success("Frete atualizado!");
        }
      } else {
        setQuotes([]);
        setError("Nenhuma opção de frete disponível");
        setErrorDetails("Verifique se o CEP está correto ou tente outro CEP");
      }
    } catch (err: any) {
      console.error("[ShippingCalculator] Exception:", err);
      setError("Erro de conexão");
      setErrorDetails(err?.message || "Verifique sua conexão e tente novamente");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* CEP Input */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          CEP de destino
        </Label>
        <div className="flex gap-2">
          <Input
            value={localZip}
            onChange={(e) => handleZipChange(e.target.value)}
            placeholder="00000-000"
            maxLength={9}
            disabled={disabled || isLoading}
            className="flex-1"
          />
          <Button
            variant="secondary"
            onClick={calculateShipping}
            disabled={disabled || isLoading || localZip.length < 8}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Calculando...
              </>
            ) : quotes.length > 0 ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Recalcular
              </>
            ) : (
              "Calcular frete"
            )}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-destructive">{error}</p>
                {errorDetails && (
                  <p className="text-sm text-muted-foreground mt-1">{errorDetails}</p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={calculateShipping}
                  disabled={isLoading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar novamente
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shipping Options */}
      {quotes.length > 0 && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Escolha o serviço
          </Label>
          <RadioGroup
            value={selectedQuote?.id || ""}
            onValueChange={(id) => {
              const quote = quotes.find((q) => q.id === id);
              if (quote) onQuoteSelect(quote);
            }}
          >
            {quotes.map((quote) => (
              <label
                key={quote.id}
                className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                  selectedQuote?.id === quote.id
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={quote.id} />
                  <div>
                    <p className="font-medium">{quote.name || quote.serviceName}</p>
                    <p className="text-sm text-muted-foreground">
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
    </div>
  );
}
