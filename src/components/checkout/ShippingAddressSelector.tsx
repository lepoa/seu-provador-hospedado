import { useState, useEffect } from "react";
import { Home, PlusCircle, Check, MapPin, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AddressForm, AddressData, formatFullAddress, formatCpf, isValidCpf } from "@/components/AddressForm";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface SavedAddress {
  id: string;
  label: string | null;
  street: string;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  zip_code: string;
  reference: string | null;
  document: string | null;
  is_default: boolean | null;
}

interface ShippingAddressSelectorProps {
  userId: string;
  quotedZipCode: string; // CEP used for shipping quote
  onAddressSelect: (address: AddressData, addressId?: string) => void;
  selectedAddressId?: string | null;
  cpfRequired?: boolean;
  className?: string;
}

export function ShippingAddressSelector({
  userId,
  quotedZipCode,
  onAddressSelect,
  selectedAddressId,
  cpfRequired = true,
  className,
}: ShippingAddressSelectorProps) {
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(selectedAddressId || null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newAddressData, setNewAddressData] = useState<AddressData>({
    zipCode: quotedZipCode,
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    reference: "",
    document: "",
  });

  // Clean ZIP code for comparison
  const cleanQuotedZip = quotedZipCode.replace(/\D/g, "");

  // Load saved addresses
  useEffect(() => {
    async function loadAddresses() {
      if (!userId) return;
      
      setIsLoading(true);
      try {
        // First find customer by user_id
        const { data: customer } = await supabase
          .from("customers")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (customer) {
          const { data: addresses } = await supabase
            .from("customer_addresses")
            .select("*")
            .eq("customer_id", customer.id)
            .order("is_default", { ascending: false });

          if (addresses) {
            setSavedAddresses(addresses);
            
            // Check if any saved address matches the quoted ZIP
            const matchingAddress = addresses.find(
              addr => addr.zip_code?.replace(/\D/g, "") === cleanQuotedZip
            );
            
            if (matchingAddress && !selectedId) {
              // Auto-select matching address
              setSelectedId(matchingAddress.id);
              handleSelectAddress(matchingAddress);
            } else if (!matchingAddress && addresses.length === 0) {
              // No saved addresses, show new address form
              setIsAddingNew(true);
            }
          }
        } else {
          // No customer record yet, show new address form
          setIsAddingNew(true);
        }
      } catch (error) {
        console.error("Error loading addresses:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadAddresses();
  }, [userId, cleanQuotedZip]);

  // Pre-fill ZIP code when adding new
  useEffect(() => {
    if (isAddingNew) {
      setNewAddressData(prev => ({
        ...prev,
        zipCode: cleanQuotedZip,
      }));
    }
  }, [isAddingNew, cleanQuotedZip]);

  const handleSelectAddress = (address: SavedAddress) => {
    const addressData: AddressData = {
      zipCode: address.zip_code?.replace(/\D/g, "") || "",
      street: address.street || "",
      number: address.number || "",
      complement: address.complement || "",
      neighborhood: address.neighborhood || "",
      city: address.city || "",
      state: address.state || "",
      reference: address.reference || "",
      document: address.document?.replace(/\D/g, "") || "",
    };
    
    onAddressSelect(addressData, address.id);
  };

  const handleNewAddressChange = (data: AddressData) => {
    setNewAddressData(data);
    
    // Validate before propagating
    const dataZip = data.zipCode.replace(/\D/g, "");
    if (dataZip === cleanQuotedZip && data.street && data.city && data.state) {
      onAddressSelect(data, undefined);
    }
  };

  const handleSelectNewAddress = () => {
    setSelectedId(null);
    setIsAddingNew(true);
    
    // Initialize with quoted ZIP
    const newData: AddressData = {
      zipCode: cleanQuotedZip,
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      reference: "",
      document: "",
    };
    setNewAddressData(newData);
  };

  const handleSelectExisting = (address: SavedAddress) => {
    setSelectedId(address.id);
    setIsAddingNew(false);
    handleSelectAddress(address);
  };

  // Get addresses that match the quoted ZIP
  const matchingAddresses = savedAddresses.filter(
    addr => addr.zip_code?.replace(/\D/g, "") === cleanQuotedZip
  );
  
  // Get addresses that don't match (for display with warning)
  const nonMatchingAddresses = savedAddresses.filter(
    addr => addr.zip_code?.replace(/\D/g, "") !== cleanQuotedZip
  );

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-20 bg-muted rounded-lg" />
        <div className="h-20 bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="h-4 w-4 text-primary" />
        <span className="font-medium">Endereço de entrega para CEP {cleanQuotedZip.replace(/(\d{5})(\d{3})/, "$1-$2")}</span>
      </div>

      {/* Show matching addresses first */}
      {matchingAddresses.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">Endereços salvos para este CEP:</span>
          <RadioGroup value={selectedId || ""} onValueChange={(id) => {
            const addr = matchingAddresses.find(a => a.id === id);
            if (addr) handleSelectExisting(addr);
          }}>
            {matchingAddresses.map((address) => (
              <AddressCard
                key={address.id}
                address={address}
                isSelected={selectedId === address.id && !isAddingNew}
                onSelect={() => handleSelectExisting(address)}
                showWarning={false}
              />
            ))}
          </RadioGroup>
        </div>
      )}

      {/* Show non-matching addresses with warning */}
      {nonMatchingAddresses.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">Outros endereços salvos (CEP diferente):</span>
          <RadioGroup value={selectedId || ""} onValueChange={(id) => {
            const addr = nonMatchingAddresses.find(a => a.id === id);
            if (addr) handleSelectExisting(addr);
          }}>
            {nonMatchingAddresses.map((address) => (
              <AddressCard
                key={address.id}
                address={address}
                isSelected={selectedId === address.id && !isAddingNew}
                onSelect={() => handleSelectExisting(address)}
                showWarning={true}
                quotedZip={cleanQuotedZip}
              />
            ))}
          </RadioGroup>
        </div>
      )}

      {/* Add new address option */}
      <Card 
        className={cn(
          "cursor-pointer transition-colors",
          isAddingNew ? "border-primary bg-primary/5" : "hover:border-primary/50"
        )}
        onClick={handleSelectNewAddress}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-5 h-5 rounded-full border-2 flex items-center justify-center",
              isAddingNew ? "border-primary bg-primary" : "border-muted-foreground"
            )}>
              {isAddingNew && <Check className="h-3 w-3 text-primary-foreground" />}
            </div>
            <PlusCircle className="h-4 w-4 text-primary" />
            <span className="font-medium">Cadastrar novo endereço</span>
          </div>
        </CardContent>
      </Card>

      {/* New address form */}
      {isAddingNew && (
        <Card className="border-primary/30">
          <CardContent className="p-4">
            <AddressForm
              value={newAddressData}
              onChange={handleNewAddressChange}
              showReference={true}
              showCpf={true}
              cpfRequired={cpfRequired}
            />
            
            {/* Validation message if ZIP doesn't match */}
            {newAddressData.zipCode.replace(/\D/g, "") !== cleanQuotedZip && newAddressData.zipCode.length === 8 && (
              <Alert variant="destructive" className="mt-3">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  O CEP do endereço ({newAddressData.zipCode.replace(/(\d{5})(\d{3})/, "$1-$2")}) 
                  é diferente do CEP cotado ({cleanQuotedZip.replace(/(\d{5})(\d{3})/, "$1-$2")}). 
                  O frete pode mudar. Por favor, use o CEP correto.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Address card component
function AddressCard({
  address,
  isSelected,
  onSelect,
  showWarning,
  quotedZip,
}: {
  address: SavedAddress;
  isSelected: boolean;
  onSelect: () => void;
  showWarning: boolean;
  quotedZip?: string;
}) {
  const addressLine = [
    address.street,
    address.number,
    address.complement,
    address.neighborhood,
  ].filter(Boolean).join(", ");
  
  const cityState = `${address.city} - ${address.state}`;
  const zipFormatted = address.zip_code?.replace(/(\d{5})(\d{3})/, "$1-$2") || "";

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-colors",
        isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50",
        showWarning && "border-amber-300"
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5",
            isSelected ? "border-primary bg-primary" : "border-muted-foreground"
          )}>
            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Home className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{address.label || "Endereço"}</span>
              {address.is_default && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Padrão</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{addressLine}</p>
            <p className="text-sm text-muted-foreground">{cityState} • CEP {zipFormatted}</p>
            
            {showWarning && quotedZip && (
              <div className="flex items-center gap-1 mt-2 text-amber-600 text-xs">
                <AlertCircle className="h-3 w-3" />
                <span>CEP diferente do cotado ({quotedZip.replace(/(\d{5})(\d{3})/, "$1-$2")}). O frete será recalculado.</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ShippingAddressSelector;
