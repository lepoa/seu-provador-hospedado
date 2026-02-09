import { useState } from "react";
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  Edit2, 
  Save, 
  X, 
  Loader2 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatPhoneDisplay } from "@/hooks/usePhoneMask";

// Format CPF with mask
function formatCpf(value: string): string {
  const digits = (value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

interface CustomerDataCardProps {
  customer: {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
    address_line: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    document: string | null;
  };
  onUpdate: () => void;
}

export function CustomerDataCard({ customer, onUpdate }: CustomerDataCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: customer.name || "",
    email: customer.email || "",
    document: customer.document?.replace(/\D/g, "") || "",
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const cleanCpf = formData.document.replace(/\D/g, "");
      
      // Validate CPF if provided
      if (cleanCpf && cleanCpf.length !== 11) {
        toast.error("CPF deve ter 11 dígitos");
        setIsSaving(false);
        return;
      }

      const { error } = await supabase
        .from("customers")
        .update({
          name: formData.name || null,
          email: formData.email || null,
          document: cleanCpf || null,
        })
        .eq("id", customer.id);

      if (error) throw error;

      // Also update customer_addresses.document if exists
      if (cleanCpf) {
        const { data: defaultAddr } = await supabase
          .from("customer_addresses")
          .select("id")
          .eq("customer_id", customer.id)
          .eq("is_default", true)
          .maybeSingle();

        if (defaultAddr) {
          await supabase
            .from("customer_addresses")
            .update({ document: cleanCpf })
            .eq("id", defaultAddr.id);
        }
      }

      toast.success("Dados atualizados!");
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error("Error updating customer:", error);
      toast.error("Erro ao atualizar dados");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: customer.name || "",
      email: customer.email || "",
      document: customer.document?.replace(/\D/g, "") || "",
    });
    setIsEditing(false);
  };

  const cpfDigits = customer.document?.replace(/\D/g, "") || "";
  const hasCpf = cpfDigits.length === 11;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          Dados do Cliente
        </CardTitle>
        {!isEditing ? (
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            <Edit2 className="h-4 w-4 mr-1" />
            Editar
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Salvar
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          /* Edit Mode */
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cpf">CPF</Label>
              <Input
                id="edit-cpf"
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
        ) : (
          /* View Mode */
          <div className="space-y-3">
            {/* Name */}
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Nome:</span>
              <span className="text-sm">{customer.name || <span className="text-muted-foreground italic">Não informado</span>}</span>
            </div>

            {/* Phone */}
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Telefone:</span>
              <span className="text-sm">{formatPhoneDisplay(customer.phone)}</span>
            </div>

            {/* Email */}
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Email:</span>
              <span className="text-sm">{customer.email || <span className="text-muted-foreground italic">Não informado</span>}</span>
            </div>

            {/* CPF */}
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">CPF:</span>
              {hasCpf ? (
                <span className="text-sm font-mono">{formatCpf(cpfDigits)}</span>
              ) : (
                <span className="text-sm text-muted-foreground italic">Não informado</span>
              )}
            </div>

            {/* Address (read-only here, editable in IncompleteRegistration) */}
            {customer.address_line && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <span className="text-sm font-medium">Endereço:</span>
                  <p className="text-sm text-muted-foreground">
                    {customer.address_line}
                    {customer.city && `, ${customer.city}`}
                    {customer.state && `/${customer.state}`}
                    {customer.zip_code && ` - CEP ${customer.zip_code}`}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
