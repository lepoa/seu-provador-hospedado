import { useState } from "react";
import { MapPin, Check, Pencil, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { STORE_CONFIG } from "@/lib/storeDeliveryConfig";

export type DeliveryPeriod = "manha" | "tarde" | "qualquer";

interface AddressData {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  reference?: string;
}

interface MotoboyConfirmationProps {
  address: AddressData;
  onAddressConfirmed: (data: { period: DeliveryPeriod; notes: string }) => void;
  onEditAddress: () => void;
  initialPeriod?: DeliveryPeriod;
  initialNotes?: string;
}

function formatAddress(addr: AddressData): string {
  const parts = [
    addr.street,
    addr.number,
    addr.complement,
    addr.neighborhood,
  ].filter(Boolean);
  
  const line1 = parts.join(", ");
  const line2 = [addr.city, addr.state].filter(Boolean).join(" - ");
  const cep = addr.zipCode ? `CEP ${addr.zipCode}` : "";
  
  return [line1, line2, cep].filter(Boolean).join("\n");
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
}

export function MotoboyConfirmation({
  address,
  onAddressConfirmed,
  onEditAddress,
  initialPeriod = "qualquer",
  initialNotes = "",
}: MotoboyConfirmationProps) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [period, setPeriod] = useState<DeliveryPeriod>(initialPeriod);
  const [notes, setNotes] = useState(initialNotes);

  const formattedAddress = formatAddress(address);
  const hasAddress = !!(address.street && address.city && address.state);

  const handleConfirm = () => {
    setIsConfirmed(true);
    onAddressConfirmed({ period, notes });
  };

  if (!hasAddress) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-amber-800">Endereço não cadastrado</p>
              <p className="text-sm text-amber-700 mt-1">
                Para entrega via Motoboy, precisamos do seu endereço completo.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 border-amber-300 text-amber-800 hover:bg-amber-100"
                onClick={onEditAddress}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Cadastrar endereço
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Address Confirmation - Selectable Card */}
      <div className="space-y-2">
        <Label className="font-medium">Confirme o endereço para entrega *</Label>
        <RadioGroup 
          value={isConfirmed ? "confirmed" : ""} 
          onValueChange={(v) => {
            if (v === "confirmed") {
              handleConfirm();
            }
          }}
        >
          <label 
            className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all hover:bg-muted/50 ${
              isConfirmed 
                ? "border-green-500 bg-green-50" 
                : "border-muted hover:border-primary/50"
            }`}
          >
            <RadioGroupItem value="confirmed" className="mt-1" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className={`h-4 w-4 shrink-0 ${isConfirmed ? "text-green-600" : "text-muted-foreground"}`} />
                  <span className={`font-medium ${isConfirmed ? "text-green-800" : ""}`}>
                    Endereço de entrega
                  </span>
                </div>
                {isConfirmed && <Check className="h-5 w-5 text-green-600 shrink-0" />}
              </div>
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans mt-2">
                {formattedAddress}
              </pre>
              {address.reference && (
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-medium">Ref:</span> {address.reference}
                </p>
              )}
            </div>
          </label>
        </RadioGroup>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={onEditAddress}
          className="mt-2"
        >
          <Pencil className="h-4 w-4 mr-2" />
          Editar endereço
        </Button>
      </div>

      {/* Delivery Period */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-primary" />
            <Label className="font-medium">Período de entrega *</Label>
          </div>
          <RadioGroup 
            value={period} 
            onValueChange={(v) => {
              setPeriod(v as DeliveryPeriod);
              if (isConfirmed) {
                onAddressConfirmed({ period: v as DeliveryPeriod, notes });
              }
            }}
            className="space-y-2"
          >
            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 ${period === "manha" ? "border-primary bg-primary/5" : ""}`}>
              <RadioGroupItem value="manha" />
              <div>
                <span className="font-medium">Manhã</span>
                <span className="text-sm text-muted-foreground ml-2">(8h às 12h)</span>
              </div>
            </label>
            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 ${period === "tarde" ? "border-primary bg-primary/5" : ""}`}>
              <RadioGroupItem value="tarde" />
              <div>
                <span className="font-medium">Tarde</span>
                <span className="text-sm text-muted-foreground ml-2">(13h às 18h)</span>
              </div>
            </label>
            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 ${period === "qualquer" ? "border-primary bg-primary/5" : ""}`}>
              <RadioGroupItem value="qualquer" />
              <div>
                <span className="font-medium">Qualquer horário</span>
                <span className="text-sm text-muted-foreground ml-2">(8h às 18h)</span>
              </div>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Delivery Notes */}
      <Card>
        <CardContent className="p-4">
          <Label className="font-medium mb-2 block">Observações para entrega</Label>
          <Textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              if (isConfirmed) {
                onAddressConfirmed({ period, notes: e.target.value });
              }
            }}
            placeholder="Ex: deixar na portaria / ao chegar ligar / casa de fundo / próximo ao mercado..."
            rows={3}
            className="resize-none"
          />
        </CardContent>
      </Card>

      {/* Price reminder */}
      <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
        <span className="text-sm font-medium">Taxa de entrega Motoboy:</span>
        <span className="font-bold text-primary">{formatPrice(STORE_CONFIG.motoboyFee)}</span>
      </div>
    </div>
  );
}

export function canProceedWithMotoboy(
  isAddressConfirmed: boolean,
  period: DeliveryPeriod | null
): boolean {
  return isAddressConfirmed && !!period;
}
