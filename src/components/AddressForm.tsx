import { useState, useEffect } from "react";
import { Loader2, Search, MapPin, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCepLookup, maskCep } from "@/hooks/useCepLookup";
import { cn } from "@/lib/utils";

const STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export interface AddressData {
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  reference: string;
  document: string; // CPF - 11 digits only
}

// CPF mask helper
export function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

// Validate CPF has exactly 11 digits
export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11;
}

interface AddressFormProps {
  value: AddressData;
  onChange: (data: AddressData) => void;
  showReference?: boolean;
  showCpf?: boolean;
  cpfRequired?: boolean;
  className?: string;
  disabled?: boolean;
}

export function AddressForm({
  value,
  onChange,
  showReference = true,
  showCpf = true,
  cpfRequired = false,
  className,
  disabled = false,
}: AddressFormProps) {
  const cepLookup = useCepLookup();
  const [cepInput, setCepInput] = useState(value.zipCode || "");
  const [autoFilled, setAutoFilled] = useState(false);

  // Update cepInput when value.zipCode changes externally
  useEffect(() => {
    if (value.zipCode && value.zipCode !== cepInput.replace(/\D/g, "")) {
      setCepInput(maskCep(value.zipCode));
    }
  }, [value.zipCode]);

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCep(e.target.value);
    setCepInput(masked);
    onChange({ ...value, zipCode: masked.replace(/\D/g, "") });
    setAutoFilled(false);
  };

  const handleCepBlur = async () => {
    const cleanCep = cepInput.replace(/\D/g, "");
    if (cleanCep.length === 8 && !autoFilled) {
      const data = await cepLookup.lookup(cleanCep);
      if (data) {
        onChange({
          ...value,
          zipCode: data.cep,
          street: data.street || value.street,
          neighborhood: data.neighborhood || value.neighborhood,
          city: data.city || value.city,
          state: data.state || value.state,
        });
        setAutoFilled(true);
      }
    }
  };

  const handleCepSearch = async () => {
    const cleanCep = cepInput.replace(/\D/g, "");
    if (cleanCep.length === 8) {
      const data = await cepLookup.lookup(cleanCep);
      if (data) {
        onChange({
          ...value,
          zipCode: data.cep,
          street: data.street || value.street,
          neighborhood: data.neighborhood || value.neighborhood,
          city: data.city || value.city,
          state: data.state || value.state,
        });
        setAutoFilled(true);
      }
    }
  };

  const updateField = (field: keyof AddressData, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* CEP with auto-lookup */}
      <div className="space-y-2">
        <Label htmlFor="cep" className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          CEP
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="cep"
              value={cepInput}
              onChange={handleCepChange}
              onBlur={handleCepBlur}
              placeholder="00000-000"
              maxLength={9}
              disabled={disabled}
              className={cn(
                autoFilled && "border-green-500 bg-green-50/50"
              )}
            />
            {autoFilled && (
              <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleCepSearch}
            disabled={cepInput.replace(/\D/g, "").length !== 8 || cepLookup.isLoading || disabled}
          >
            {cepLookup.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
        {cepLookup.error && (
          <p className="text-sm text-destructive">{cepLookup.error}</p>
        )}
        {autoFilled && (
          <p className="text-sm text-green-600">Endereço preenchido automaticamente!</p>
        )}
      </div>

      {/* Street (Logradouro) */}
      <div className="space-y-2">
        <Label htmlFor="street">Rua / Avenida</Label>
        <Input
          id="street"
          value={value.street}
          onChange={(e) => updateField("street", e.target.value)}
          placeholder="Nome da rua ou avenida"
          disabled={disabled}
        />
      </div>

      {/* Number + Complement */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="number">Número</Label>
          <Input
            id="number"
            value={value.number}
            onChange={(e) => updateField("number", e.target.value)}
            placeholder="Nº"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="complement">Complemento</Label>
          <Input
            id="complement"
            value={value.complement}
            onChange={(e) => updateField("complement", e.target.value)}
            placeholder="Apto, Bloco, etc."
            disabled={disabled}
          />
        </div>
      </div>

      {/* Neighborhood */}
      <div className="space-y-2">
        <Label htmlFor="neighborhood">Bairro</Label>
        <Input
          id="neighborhood"
          value={value.neighborhood}
          onChange={(e) => updateField("neighborhood", e.target.value)}
          placeholder="Bairro"
          disabled={disabled}
        />
      </div>

      {/* City + State */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="city">Cidade</Label>
          <Input
            id="city"
            value={value.city}
            onChange={(e) => updateField("city", e.target.value)}
            placeholder="Cidade"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Estado</Label>
          <Select
            value={value.state}
            onValueChange={(v) => updateField("state", v)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              {STATES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* CPF */}
      {showCpf && (
        <div className="space-y-2">
          <Label htmlFor="cpf">
            CPF {cpfRequired ? <span className="text-red-500">*</span> : "(opcional)"}
          </Label>
          <Input
            id="cpf"
            value={formatCpf(value.document || "")}
            onChange={(e) => updateField("document", e.target.value.replace(/\D/g, "").slice(0, 11))}
            placeholder="000.000.000-00"
            maxLength={14}
            disabled={disabled}
            className={cn(
              cpfRequired && !isValidCpf(value.document || "") && "border-red-500",
              !cpfRequired && value.document && !isValidCpf(value.document) && "border-amber-500"
            )}
          />
          {cpfRequired && !isValidCpf(value.document || "") && (
            <p className="text-xs text-red-600">CPF obrigatório para gerar etiqueta dos Correios (11 dígitos)</p>
          )}
          {!cpfRequired && value.document && !isValidCpf(value.document) && (
            <p className="text-xs text-amber-600">CPF deve ter 11 dígitos</p>
          )}
        </div>
      )}

      {/* Reference (optional) */}
      {showReference && (
        <div className="space-y-2">
          <Label htmlFor="reference">Ponto de referência (opcional)</Label>
          <Input
            id="reference"
            value={value.reference}
            onChange={(e) => updateField("reference", e.target.value)}
            placeholder="Próximo a..."
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

// Helper to format full address for display
export function formatFullAddress(data: AddressData): string {
  const parts = [
    data.street,
    data.number,
    data.complement,
    data.neighborhood,
    data.city,
    data.state,
  ].filter(Boolean);
  
  let address = parts.join(", ");
  if (data.zipCode) {
    address += ` - CEP ${maskCep(data.zipCode)}`;
  }
  if (data.reference) {
    address += ` (${data.reference})`;
  }
  return address;
}

// Helper to parse legacy address_line format into AddressData
export function parseAddressLine(
  addressLine: string | null,
  city: string | null,
  state: string | null,
  zipCode: string | null,
  reference: string | null,
  document?: string | null
): AddressData {
  // Try to extract number from address line if it contains comma
  let street = addressLine || "";
  let number = "";
  let complement = "";
  let neighborhood = "";
  
  if (addressLine) {
    // Pattern: "Rua Nome, 123, Bairro" or "Rua Nome, 123"
    const parts = addressLine.split(",").map(p => p.trim());
    if (parts.length >= 2) {
      street = parts[0];
      // Check if second part is a number
      if (/^\d+/.test(parts[1])) {
        number = parts[1].match(/^\d+/)?.[0] || "";
        // Rest might be complement or neighborhood
        const remaining = parts[1].replace(/^\d+\s*/, "").trim();
        if (remaining) complement = remaining;
        if (parts[2]) neighborhood = parts[2];
      } else {
        // Second part might be neighborhood
        neighborhood = parts[1];
      }
    }
  }

  return {
    zipCode: zipCode?.replace(/\D/g, "") || "",
    street,
    number,
    complement,
    neighborhood,
    city: city || "",
    state: state || "",
    reference: reference || "",
    document: document?.replace(/\D/g, "") || "",
  };
}
