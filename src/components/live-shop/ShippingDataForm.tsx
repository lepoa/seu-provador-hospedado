import { useState, useEffect } from "react";
import { Loader2, MapPin, User, Phone, FileText, Save, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { maskCep, useCepLookup } from "@/hooks/useCepLookup";
import { cn } from "@/lib/utils";

const STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

// Fields required by Melhor Envio (including document/CPF)
const REQUIRED_FIELDS = ['name', 'phone', 'zip_code', 'street', 'number', 'neighborhood', 'city', 'state', 'document'] as const;

export interface ShippingAddressData {
  name: string;
  document: string;
  phone: string;
  zip_code: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  reference: string;
}

interface ShippingDataFormProps {
  orderId: string;
  customerId?: string | null;
  currentData?: Partial<ShippingAddressData> | null;
  customerName?: string | null;
  customerPhone?: string | null;
  onSaved: () => void;
  onCancel?: () => void;
}

// Helper to check which fields are missing
export function getMissingShippingFields(data: Partial<ShippingAddressData> | null | undefined): string[] {
  if (!data) return [...REQUIRED_FIELDS];
  
  const missing: string[] = [];
  REQUIRED_FIELDS.forEach(field => {
    const value = data[field];
    if (!value || value.trim() === '') {
      missing.push(field);
    } else if (field === 'document') {
      // CPF must have exactly 11 digits after sanitization
      const sanitized = value.replace(/\D/g, '');
      if (sanitized.length !== 11) {
        missing.push(field);
      }
    }
  });
  return missing;
}

// Helper to get human-readable field names
const fieldLabels: Record<string, string> = {
  name: 'Nome completo',
  document: 'CPF',
  phone: 'Telefone',
  zip_code: 'CEP',
  street: 'Rua',
  number: 'Número',
  complement: 'Complemento',
  neighborhood: 'Bairro',
  city: 'Cidade',
  state: 'Estado',
  reference: 'Referência',
};

export function ShippingDataForm({
  orderId,
  customerId,
  currentData,
  customerName,
  customerPhone,
  onSaved,
  onCancel,
}: ShippingDataFormProps) {
  const cepLookup = useCepLookup();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<ShippingAddressData>({
    name: currentData?.name || customerName || '',
    document: currentData?.document || '',
    phone: currentData?.phone || customerPhone?.replace(/\D/g, '') || '',
    zip_code: currentData?.zip_code || '',
    street: currentData?.street || '',
    number: currentData?.number || '',
    complement: currentData?.complement || '',
    neighborhood: currentData?.neighborhood || '',
    city: currentData?.city || '',
    state: currentData?.state || '',
    reference: currentData?.reference || '',
  });

  // CEP auto-lookup
  const handleCepBlur = async () => {
    const cleanCep = formData.zip_code.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      const data = await cepLookup.lookup(cleanCep);
      if (data) {
        setFormData(prev => ({
          ...prev,
          zip_code: data.cep,
          street: data.street || prev.street,
          neighborhood: data.neighborhood || prev.neighborhood,
          city: data.city || prev.city,
          state: data.state || prev.state,
        }));
      }
    }
  };

  const updateField = (field: keyof ShippingAddressData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const missingFields = getMissingShippingFields(formData);
  const isValid = missingFields.length === 0;

  const handleSave = async () => {
    if (!isValid) {
      toast.error(`Preencha: ${missingFields.map(f => fieldLabels[f]).join(', ')}`);
      return;
    }

    setIsSaving(true);

    try {
      // Update live_cart with shipping_address_snapshot
      // Cast to Json type for Supabase
      const snapshotJson = JSON.parse(JSON.stringify(formData));
      
      const { error: cartError } = await supabase
        .from('live_carts')
        .update({
          shipping_address_snapshot: snapshotJson,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (cartError) throw cartError;

      // If customer exists, update their address too
      if (customerId) {
        const { error: customerError } = await supabase
          .from('customers')
          .update({
            name: formData.name || undefined,
            phone: formData.phone || undefined,
            address_line: `${formData.street}, ${formData.number}`,
            city: formData.city,
            state: formData.state,
            zip_code: formData.zip_code,
            address_reference: formData.reference || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', customerId);

        if (customerError) {
          console.error("Failed to update customer:", customerError);
        }
      }

      toast.success("Dados de envio salvos!");
      onSaved();
    } catch (error: any) {
      console.error("Error saving shipping data:", error);
      toast.error("Erro ao salvar dados");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Missing fields warning */}
      {missingFields.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-800">Campos obrigatórios faltando:</p>
            <p className="text-amber-700">{missingFields.map(f => fieldLabels[f]).join(', ')}</p>
          </div>
        </div>
      )}

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Nome completo *
        </Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="Nome completo do destinatário"
        />
      </div>

      {/* Document (CPF) - Required for Correios */}
      <div className="space-y-2">
        <Label htmlFor="document" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          CPF *
        </Label>
        <Input
          id="document"
          value={formData.document}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 11);
            // Format CPF: 000.000.000-00
            const formatted = val
              .replace(/(\d{3})(\d)/, '$1.$2')
              .replace(/(\d{3})(\d)/, '$1.$2')
              .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            updateField('document', formatted);
          }}
          placeholder="000.000.000-00"
          className={formData.document && formData.document.replace(/\D/g, '').length !== 11 ? 'border-amber-500' : ''}
        />
        {formData.document && formData.document.replace(/\D/g, '').length > 0 && formData.document.replace(/\D/g, '').length !== 11 && (
          <p className="text-xs text-amber-600">CPF deve ter 11 dígitos</p>
        )}
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="phone" className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Telefone *
        </Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 11);
            // Format: (00) 00000-0000
            let formatted = val;
            if (val.length > 2) formatted = `(${val.slice(0,2)}) ${val.slice(2)}`;
            if (val.length > 7) formatted = `(${val.slice(0,2)}) ${val.slice(2,7)}-${val.slice(7)}`;
            updateField('phone', formatted);
          }}
          placeholder="(00) 00000-0000"
        />
      </div>

      {/* CEP */}
      <div className="space-y-2">
        <Label htmlFor="zip_code" className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          CEP *
        </Label>
        <Input
          id="zip_code"
          value={maskCep(formData.zip_code)}
          onChange={(e) => updateField('zip_code', e.target.value.replace(/\D/g, '').slice(0, 8))}
          onBlur={handleCepBlur}
          placeholder="00000-000"
          maxLength={9}
        />
        {cepLookup.isLoading && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Buscando endereço...
          </p>
        )}
      </div>

      {/* Street */}
      <div className="space-y-2">
        <Label htmlFor="street">Rua / Avenida *</Label>
        <Input
          id="street"
          value={formData.street}
          onChange={(e) => updateField('street', e.target.value)}
          placeholder="Nome da rua"
        />
      </div>

      {/* Number + Complement */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="number">Número *</Label>
          <Input
            id="number"
            value={formData.number}
            onChange={(e) => updateField('number', e.target.value)}
            placeholder="Nº"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="complement">Complemento</Label>
          <Input
            id="complement"
            value={formData.complement}
            onChange={(e) => updateField('complement', e.target.value)}
            placeholder="Apto, Bloco..."
          />
        </div>
      </div>

      {/* Neighborhood */}
      <div className="space-y-2">
        <Label htmlFor="neighborhood">Bairro *</Label>
        <Input
          id="neighborhood"
          value={formData.neighborhood}
          onChange={(e) => updateField('neighborhood', e.target.value)}
          placeholder="Bairro"
        />
      </div>

      {/* City + State */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="city">Cidade *</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => updateField('city', e.target.value)}
            placeholder="Cidade"
          />
        </div>
        <div className="space-y-2">
          <Label>Estado *</Label>
          <Select
            value={formData.state}
            onValueChange={(v) => updateField('state', v)}
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

      {/* Reference */}
      <div className="space-y-2">
        <Label htmlFor="reference">Ponto de referência</Label>
        <Input
          id="reference"
          value={formData.reference}
          onChange={(e) => updateField('reference', e.target.value)}
          placeholder="Próximo a..."
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={!isValid || isSaving}
          className={cn("flex-1", isValid && "bg-green-600 hover:bg-green-700")}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar Dados de Envio
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Badge component to show shipping data status
export function ShippingDataStatus({ 
  data,
  deliveryMethod 
}: { 
  data: Partial<ShippingAddressData> | null | undefined;
  deliveryMethod: string;
}) {
  if (deliveryMethod !== 'correios') return null;

  const missing = getMissingShippingFields(data);

  if (missing.length === 0) {
    return (
      <div className="flex items-center gap-1 text-green-700 text-xs">
        <CheckCircle className="h-3 w-3" />
        Dados completos
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-amber-700 text-xs">
      <AlertTriangle className="h-3 w-3" />
      {missing.length} campo{missing.length > 1 ? 's' : ''} pendente{missing.length > 1 ? 's' : ''}
    </div>
  );
}
