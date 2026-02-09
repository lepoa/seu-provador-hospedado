import { useState, useEffect } from "react";
import { AlertCircle, Edit, Loader2, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddressForm, AddressData, parseAddressLine, formatCpf, isValidCpf } from "@/components/AddressForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface IncompleteRegistrationProps {
  customer: {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
    size_letter: string | null;
    size_number: string | null;
    address_line: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    address_reference?: string | null;
    document?: string | null; // CPF
  };
  onUpdate: () => void;
}

const LETTER_SIZES = ["PP", "P", "M", "G", "GG", "XG", "XXG"];
const NUMBER_SIZES = ["34", "36", "38", "40", "42", "44", "46", "48", "50", "52"];

export function IncompleteRegistration({ customer, onUpdate }: IncompleteRegistrationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Parse existing address into structured format
  const existingAddress = parseAddressLine(
    customer.address_line,
    customer.city,
    customer.state,
    customer.zip_code,
    customer.address_reference || null,
    customer.document || null
  );
  
  const [formData, setFormData] = useState({
    name: customer.name || "",
    email: customer.email || "",
    size_letter: customer.size_letter || "",
    size_number: customer.size_number || "",
    document: customer.document?.replace(/\D/g, "") || "",
  });
  
  const [addressData, setAddressData] = useState<AddressData>(existingAddress);

  // Update form when customer changes
  useEffect(() => {
    setFormData({
      name: customer.name || "",
      email: customer.email || "",
      size_letter: customer.size_letter || "",
      size_number: customer.size_number || "",
      document: customer.document?.replace(/\D/g, "") || "",
    });
    setAddressData(parseAddressLine(
      customer.address_line,
      customer.city,
      customer.state,
      customer.zip_code,
      customer.address_reference || null,
      customer.document || null
    ));
  }, [customer]);

  // Determine what's missing
  const missingFields: { key: string; label: string }[] = [];
  if (!customer.name) missingFields.push({ key: "name", label: "Nome" });
  if (!customer.email) missingFields.push({ key: "email", label: "Email" });
  if (!customer.size_letter && !customer.size_number) missingFields.push({ key: "size", label: "Tamanho" });
  if (!customer.address_line) missingFields.push({ key: "address_line", label: "Endereço" });
  if (!customer.zip_code) missingFields.push({ key: "zip_code", label: "CEP" });
  if (!customer.city) missingFields.push({ key: "city", label: "Cidade" });
  if (!customer.state) missingFields.push({ key: "state", label: "Estado" });

  if (missingFields.length === 0) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Build full address line from components
      const addressParts = [
        addressData.street,
        addressData.number,
        addressData.complement,
        addressData.neighborhood,
      ].filter(Boolean);
      const fullAddressLine = addressParts.join(", ");

      // Clean CPF - use from form or address
      const cleanCpf = (formData.document || addressData.document || "").replace(/\D/g, "");

      // Update customer record
      const { error } = await supabase
        .from("customers")
        .update({
          name: formData.name || null,
          email: formData.email || null,
          size_letter: formData.size_letter || null,
          size_number: formData.size_number || null,
          address_line: fullAddressLine || null,
          city: addressData.city || null,
          state: addressData.state || null,
          zip_code: addressData.zipCode || null,
          address_reference: addressData.reference || null,
          document: cleanCpf || null,
        })
        .eq("id", customer.id);

      if (error) throw error;

      // Also update customer_addresses if exists
      if (cleanCpf && addressData.zipCode) {
        const { data: existingAddr } = await supabase
          .from("customer_addresses")
          .select("id")
          .eq("customer_id", customer.id)
          .eq("is_default", true)
          .maybeSingle();

        if (existingAddr) {
          await supabase
            .from("customer_addresses")
            .update({ document: cleanCpf })
            .eq("id", existingAddr.id);
        }
      }

      toast.success("Cadastro atualizado!");
      setIsOpen(false);
      onUpdate();
    } catch (error) {
      console.error("Error updating customer:", error);
      toast.error("Erro ao atualizar cadastro");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-amber-700">
            <AlertCircle className="h-5 w-5" />
            Cadastro incompleto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-amber-700">Faltam:</span>
            {missingFields.map((field) => (
              <span
                key={field.key}
                className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-sm"
              >
                {field.label}
              </span>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(true)}
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
          >
            <Edit className="h-4 w-4 mr-2" />
            Completar cadastro manualmente
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Completar cadastro</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Personal Info Section */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Dados Pessoais
              </h3>
              
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome da cliente"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>

              {/* Sizes */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tamanho (letra)</Label>
                  <Select
                    value={formData.size_letter}
                    onValueChange={(v) => setFormData({ ...formData, size_letter: v === "_none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Não informado</SelectItem>
                      {LETTER_SIZES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tamanho (número)</Label>
                  <Select
                    value={formData.size_number}
                    onValueChange={(v) => setFormData({ ...formData, size_number: v === "_none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Não informado</SelectItem>
                      {NUMBER_SIZES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* CPF */}
              <div className="space-y-2">
                <Label htmlFor="document">CPF</Label>
                <Input
                  id="document"
                  value={formatCpf(formData.document)}
                  onChange={(e) => setFormData({ ...formData, document: e.target.value.replace(/\D/g, "").slice(0, 11) })}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
                {formData.document && formData.document.length > 0 && formData.document.length !== 11 && (
                  <p className="text-xs text-amber-600">CPF deve ter 11 dígitos ({formData.document.length}/11)</p>
                )}
              </div>
            </div>

            {/* Address Section */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Endereço
              </h3>
              
              <AddressForm
                value={addressData}
                onChange={setAddressData}
                showReference={true}
                showCpf={false}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
