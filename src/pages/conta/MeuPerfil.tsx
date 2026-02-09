import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Save, Loader2, MapPin, Pencil } from "lucide-react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { AddressForm, AddressData, formatFullAddress } from "@/components/AddressForm";
import { maskCep } from "@/hooks/useCepLookup";

interface Profile {
  name: string;
  whatsapp: string;
  preferred_sizes: string[];
  style_preferences: string;
  addressData: AddressData;
}

const SIZE_OPTIONS = ["PP", "P", "M", "G", "GG", "34", "36", "38", "40", "42", "44", "46"];

const emptyAddress: AddressData = {
  zipCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  reference: "",
  document: "",
};

export default function MeuPerfil() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    name: "",
    whatsapp: "",
    preferred_sizes: [],
    style_preferences: "",
    addressData: emptyAddress,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/minha-conta");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("name, whatsapp, preferred_sizes, style_preferences, address_line, city, state, zip_code, address_reference")
      .eq("user_id", user.id)
      .single();

    if (!error && data) {
      // Parse address_line to extract street, number, complement, neighborhood
      let street = "";
      let number = "";
      let complement = "";
      let neighborhood = "";
      
      if (data.address_line) {
        const parts = data.address_line.split(",").map((p: string) => p.trim());
        if (parts.length >= 1) street = parts[0];
        if (parts.length >= 2) {
          // Check if second part starts with number
          const numMatch = parts[1].match(/^(\d+)\s*(.*)/);
          if (numMatch) {
            number = numMatch[1];
            complement = numMatch[2] || "";
          } else {
            neighborhood = parts[1];
          }
        }
        if (parts.length >= 3) neighborhood = parts[2];
      }

      setProfile({
        name: data.name || "",
        whatsapp: data.whatsapp || "",
        preferred_sizes: data.preferred_sizes || [],
        style_preferences: data.style_preferences || "",
        addressData: {
          zipCode: data.zip_code || "",
          street,
          number,
          complement,
          neighborhood,
          city: data.city || "",
          state: data.state || "",
          reference: data.address_reference || "",
          document: "",
        },
      });
      
      // If address is empty, show edit form
      if (!data.address_line && !data.zip_code) {
        setIsEditingAddress(true);
      }
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    
    // Build address_line from structured data
    const addressParts = [profile.addressData.street];
    if (profile.addressData.number) {
      addressParts.push(profile.addressData.number + (profile.addressData.complement ? " " + profile.addressData.complement : ""));
    }
    if (profile.addressData.neighborhood) {
      addressParts.push(profile.addressData.neighborhood);
    }
    const addressLine = addressParts.filter(Boolean).join(", ");

    const { error } = await supabase
      .from("profiles")
      .update({
        name: profile.name,
        whatsapp: profile.whatsapp,
        preferred_sizes: profile.preferred_sizes,
        style_preferences: profile.style_preferences,
        address_line: addressLine,
        city: profile.addressData.city,
        state: profile.addressData.state,
        zip_code: profile.addressData.zipCode,
        address_reference: profile.addressData.reference,
      })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Erro ao salvar. Tente novamente.");
    } else {
      toast.success("Perfil atualizado!");
      setIsEditingAddress(false);
    }
    setIsSaving(false);
  };

  const toggleSize = (size: string) => {
    setProfile((prev) => ({
      ...prev,
      preferred_sizes: prev.preferred_sizes.includes(size)
        ? prev.preferred_sizes.filter((s) => s !== size)
        : [...prev.preferred_sizes, size],
    }));
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
    toast.success("Até logo!");
  };

  const hasAddress = profile.addressData.street || profile.addressData.zipCode;

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-lg">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-lg">
        <h1 className="font-serif text-2xl mb-6">Meu Perfil</h1>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Dados pessoais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={profile.name}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={profile.whatsapp}
                  onChange={(e) => setProfile((p) => ({ ...p, whatsapp: e.target.value }))}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Endereço de entrega
                </span>
                {hasAddress && !isEditingAddress && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingAddress(true)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditingAddress ? (
                <div className="space-y-4">
                  <AddressForm
                    value={profile.addressData}
                    onChange={(addressData) => setProfile((p) => ({ ...p, addressData }))}
                  />
                  {hasAddress && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingAddress(false)}
                      className="w-full"
                    >
                      Cancelar edição
                    </Button>
                  )}
                </div>
              ) : hasAddress ? (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm">{formatFullAddress(profile.addressData)}</p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground text-sm mb-3">
                    Nenhum endereço cadastrado
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingAddress(true)}
                  >
                    Adicionar endereço
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preferências de moda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">Meus tamanhos favoritos</Label>
                <div className="flex flex-wrap gap-2">
                  {SIZE_OPTIONS.map((size) => (
                    <button
                      key={size}
                      onClick={() => toggleSize(size)}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        profile.preferred_sizes.includes(size)
                          ? "bg-accent text-accent-foreground border-accent"
                          : "border-border hover:border-accent/50"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="style">Estilo e preferências</Label>
                <Textarea
                  id="style"
                  value={profile.style_preferences}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, style_preferences: e.target.value }))
                  }
                  placeholder="Ex: Gosto de peças confortáveis, cores neutras, estampas florais..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSave} className="w-full gap-2" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar alterações
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full text-muted-foreground"
          >
            Sair da conta
          </Button>
        </div>
      </main>
    </div>
  );
}
