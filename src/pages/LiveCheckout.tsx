import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  ShoppingCart, User, Truck, CreditCard, ArrowLeft, Package, MapPin, Store,
  Loader2, CheckCircle, AlertTriangle, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { usePhoneMask } from "@/hooks/usePhoneMask";
import { useCepLookup } from "@/hooks/useCepLookup";
import { STORE_CONFIG } from "@/lib/storeDeliveryConfig";
import { MotoboyConfirmation, DeliveryPeriod, canProceedWithMotoboy } from "@/components/checkout/MotoboyConfirmation";
import { PickupConfirmation } from "@/components/checkout/PickupConfirmation";
import { ShippingCalculator, ShippingQuote } from "@/components/checkout/ShippingCalculator";

type CheckoutStep = "cart" | "registration" | "delivery" | "payment";
type DeliveryMethod = "motoboy" | "pickup" | "shipping";

interface CartData {
  id: string;
  status: string;
  bag_number: number | null;
  subtotal: number;
  frete: number;
  total: number;
  coupon_discount: number;
  delivery_method: string | null;
  shipping_address_snapshot: any;
  mp_checkout_url: string | null;
  event_title: string;
  created_at: string;
  instagram_handle: string;
  customer_name: string | null;
  customer_whatsapp: string | null;
  items: CartItem[];
  known_phone: string | null;
  known_customer_id: string | null;
}

interface CartItem {
  id: string;
  product_name: string;
  product_image: string | null;
  color: string | null;
  size: string | null;
  quantity: number;
  unit_price: number;
  status: string;
}

export default function LiveCheckout() {
  const { cartId } = useParams<{ cartId: string }>();
  const navigate = useNavigate();
  const publicToken = new URLSearchParams(window.location.search).get("token");

  // Cart state
  const [cart, setCart] = useState<CartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Step state
  const [currentStep, setCurrentStep] = useState<CheckoutStep>("cart");

  // Registration form
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const phoneMask = usePhoneMask("");
  const [cpf, setCpf] = useState("");

  // Address form
  const [zipCode, setZipCode] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [reference, setReference] = useState("");

  const { isLoading: isLoadingCep, lookup: lookupCep } = useCepLookup();

  // Delivery
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("motoboy");
  const [selectedShipping, setSelectedShipping] = useState<ShippingQuote | null>(null);
  const [motoboyAddressConfirmed, setMotoboyAddressConfirmed] = useState(false);
  const [deliveryPeriod, setDeliveryPeriod] = useState<DeliveryPeriod>("qualquer");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  // Payment
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Has registration data already
  const hasRegistrationData = !!(nome.trim() && phoneMask.isValid);

  // Load cart via RPC
  const loadCart = useCallback(async () => {
    if (!cartId || !publicToken) {
      setError("Link inválido - token ausente");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: rpcError } = await supabase.rpc("get_live_checkout", {
        p_cart_id: cartId,
        p_token: publicToken,
      });

      if (rpcError) {
        console.error("RPC error:", rpcError);
        setError("Erro ao carregar sacola");
        setIsLoading(false);
        return;
      }

      const result = data as unknown as CartData;

      if ((result as any)?.error) {
        setError((result as any).error);
        setIsLoading(false);
        return;
      }

      if (result.status === "pago") {
        setError("Este carrinho já foi pago");
        setIsLoading(false);
        return;
      }

      setCart(result);

      // Pre-fill from known identity
      if (result.customer_name) setNome(result.customer_name);
      if (result.known_phone) {
        phoneMask.setDisplayValue(result.known_phone);
      } else if (result.customer_whatsapp) {
        phoneMask.setDisplayValue(result.customer_whatsapp);
      }

      // Pre-fill address from snapshot if exists
      if (result.shipping_address_snapshot) {
        const snap = result.shipping_address_snapshot;
        if (snap.street) setStreet(snap.street);
        if (snap.number) setNumber(snap.number);
        if (snap.complement) setComplement(snap.complement);
        if (snap.neighborhood) setNeighborhood(snap.neighborhood);
        if (snap.city) setCity(snap.city);
        if (snap.state) setState(snap.state);
        if (snap.zip_code) setZipCode(snap.zip_code);
        if (snap.reference) setReference(snap.reference);
        if (snap.document) setCpf(snap.document);
      }
    } catch (err) {
      console.error("Error loading cart:", err);
      setError("Erro ao carregar carrinho");
    } finally {
      setIsLoading(false);
    }
  }, [cartId, publicToken]);

  useEffect(() => { loadCart(); }, [loadCart]);

  const handleCepLookup = async () => {
    const cleanCep = zipCode.replace(/\D/g, "");
    if (cleanCep.length !== 8) { toast.error("CEP inválido"); return; }
    const result = await lookupCep(cleanCep);
    if (result) {
      setStreet(result.street);
      setNeighborhood(result.neighborhood);
      setCity(result.city);
      setState(result.state);
    }
  };

  const saveRegistrationAndProceed = async () => {
    if (!nome.trim()) { toast.error("Preencha seu nome"); return; }
    if (!phoneMask.isValid) { toast.error("WhatsApp inválido"); return; }

    // For motoboy/shipping we need address, for pickup we don't
    // We'll collect address in delivery step if needed; just save name+phone now
    setCurrentStep("delivery");
  };

  const getDeliveryFee = (): number => {
    if (deliveryMethod === "motoboy") return STORE_CONFIG.motoboyFee;
    if (deliveryMethod === "pickup") return 0;
    if (deliveryMethod === "shipping" && selectedShipping) return selectedShipping.price;
    return 0;
  };

  const getTotalWithDelivery = (): number => {
    return (cart?.subtotal || 0) + getDeliveryFee();
  };

  const isCpfValidForShipping = (): boolean => {
    return (cpf || "").replace(/\D/g, "").length === 11;
  };

  const canProceedToPayment = (): boolean => {
    if (deliveryMethod === "pickup") return true;
    if (deliveryMethod === "motoboy") return canProceedWithMotoboy(motoboyAddressConfirmed, deliveryPeriod);
    if (deliveryMethod === "shipping") return !!selectedShipping && isCpfValidForShipping();
    return false;
  };

  const proceedToPayment = async () => {
    if (!canProceedToPayment()) {
      if (deliveryMethod === "motoboy" && !motoboyAddressConfirmed) toast.error("Confirme seu endereço de entrega");
      if (deliveryMethod === "shipping" && !selectedShipping) toast.error("Selecione uma opção de frete");
      if (deliveryMethod === "shipping" && !isCpfValidForShipping()) toast.error("CPF obrigatório para Correios");
      return;
    }

    const deliveryFee = getDeliveryFee();
    const addressParts = [street, number, complement, neighborhood].filter(Boolean);
    const addressLine = addressParts.join(", ");
    const sanitizedCpf = cpf.replace(/\D/g, "");

    const addressSnapshot = {
      name: nome, street, number, complement, neighborhood, city, state,
      zip_code: zipCode, reference, document: sanitizedCpf,
      full_address: `${addressLine}, ${city} - ${state}, CEP ${zipCode}`,
    };

    const dbDeliveryMethod = deliveryMethod === "pickup" ? "retirada" : deliveryMethod === "shipping" ? "correios" : "motoboy";

    setIsSaving(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("save_live_checkout_details", {
        p_cart_id: cartId!,
        p_token: publicToken!,
        p_name: nome.trim(),
        p_phone: phoneMask.getNormalizedValue(),
        p_delivery_method: dbDeliveryMethod,
        p_delivery_period: deliveryMethod === "motoboy" ? deliveryPeriod : null,
        p_delivery_notes: deliveryNotes?.trim() || null,
        p_address_snapshot: addressSnapshot,
        p_shipping_fee: deliveryFee,
        p_shipping_service_name: deliveryMethod === "shipping" && selectedShipping ? (selectedShipping.name || selectedShipping.serviceName) : null,
        p_shipping_deadline_days: deliveryMethod === "shipping" && selectedShipping ? (selectedShipping.deliveryDays || selectedShipping.deliveryTime || null) : null,
        p_customer_notes: deliveryNotes?.trim() || null,
      });

      if (rpcError) throw rpcError;
      const result = data as any;
      if (result?.error) { toast.error(result.error); return; }

      // Update local state with new total
      setCart(prev => prev ? { ...prev, frete: deliveryFee, total: result.total || getTotalWithDelivery(), delivery_method: dbDeliveryMethod } : null);
      setCurrentStep("payment");
    } catch (err: any) {
      console.error("Error saving checkout details:", err);
      toast.error(err?.message || "Erro ao salvar dados");
    } finally {
      setIsSaving(false);
    }
  };

  const generatePayment = async () => {
    if (!cartId) return;
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-live-cart-payment", {
        body: {
          live_cart_id: cartId,
          public_token: publicToken,
          shipping_fee: getDeliveryFee(),
          payer_email: email.trim() || undefined,
          payer_name: nome.trim() || undefined,
          payer_phone: phoneMask.getNormalizedValue() || undefined,
          payer_cpf: cpf.replace(/\D/g, "") || undefined,
          customer_notes: deliveryNotes?.trim() || null,
        },
      });

      if (error) { toast.error("Erro de conexão com o servidor. Tente novamente."); return; }
      if (data?.error_code || data?.message) {
        toast.error(`${data.message}${data.action ? ` ${data.action}` : ""}`);
        return;
      }
      if (data?.init_point) {
        window.location.href = data.init_point;
      } else {
        toast.error("Link de pagamento não gerado. Tente novamente.");
      }
    } catch (err) {
      console.error("Payment generation exception:", err);
      toast.error("Erro ao gerar pagamento. Verifique sua conexão.");
    } finally {
      setIsProcessing(false);
    }
  };

  const formatPrice = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando carrinho...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Ops!</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={() => navigate("/")}>Voltar para a loja</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeItems = (cart?.items || []).filter(item => ["reservado", "confirmado", "expirado"].includes(item.status));

  const steps = [
    { id: "cart", label: "Carrinho", icon: ShoppingCart },
    { id: "registration", label: "Dados", icon: User },
    { id: "delivery", label: "Entrega", icon: Truck },
    { id: "payment", label: "Pagamento", icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Finalizar Pedido</h1>
            <p className="text-xs text-muted-foreground">{cart?.instagram_handle}</p>
          </div>
        </div>
      </header>

      {/* Steps indicator */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isActive = step.id === currentStep;
            const isPast = steps.findIndex(s => s.id === currentStep) > index;
            const Icon = step.icon;
            return (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center gap-2 ${isActive ? "text-primary" : isPast ? "text-green-600" : "text-muted-foreground"}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isActive ? "bg-primary text-primary-foreground" : isPast ? "bg-green-100 text-green-600" : "bg-muted"}`}>
                    {isPast ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className="text-xs hidden sm:inline">{step.label}</span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-8 sm:w-16 h-0.5 mx-2 ${isPast ? "bg-green-300" : "bg-muted"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <main className="max-w-2xl mx-auto p-4 pb-32 space-y-4">
        {/* Step: Cart Review */}
        {currentStep === "cart" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Seus Itens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeItems.map((item) => (
                <div key={item.id} className="flex gap-3 p-3 border rounded-lg">
                  {item.product_image && (
                    <img src={item.product_image} alt={item.product_name} className="w-16 h-16 object-cover rounded-md" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{item.product_name}</h4>
                    <div className="text-sm text-muted-foreground">
                      {item.size && <span>Tam: {item.size}</span>}
                      {item.color && <span> • {item.color}</span>}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm">Qtd: {item.quantity}</span>
                      <span className="font-semibold">{formatPrice(item.unit_price * item.quantity)}</span>
                    </div>
                  </div>
                </div>
              ))}
              <Separator />
              <div className="flex items-center justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatPrice(cart?.subtotal || 0)}</span>
              </div>
              <Button className="w-full" size="lg" onClick={() => setCurrentStep("registration")}>
                Continuar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: Registration (Name + WhatsApp) */}
        {currentStep === "registration" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Seus Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart?.known_phone && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <span>Reconhecemos você! WhatsApp preenchido automaticamente.</span>
                </div>
              )}

              <div className="space-y-2">
                <Label>Nome completo *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome completo" />
              </div>

              <div className="space-y-2">
                <Label>WhatsApp *</Label>
                <Input 
                  value={phoneMask.displayValue} 
                  onChange={(e) => phoneMask.setDisplayValue(e.target.value)} 
                  placeholder="(62) 99999-9999"
                />
              </div>

              <div className="space-y-2">
                <Label>E-mail <span className="text-xs text-muted-foreground">(recomendado — reduz recusa no pagamento)</span></Label>
                <Input 
                  type="email"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="seu@email.com"
                />
              </div>

              <Separator />

              <p className="text-sm text-muted-foreground">Endereço (necessário para entrega)</p>

              <div className="space-y-2">
                <Label>CEP</Label>
                <div className="flex gap-2">
                  <Input value={zipCode} onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="00000-000" maxLength={9} />
                  <Button variant="outline" onClick={handleCepLookup} disabled={isLoadingCep}>
                    {isLoadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-2">
                  <Label>Rua</Label>
                  <Input value={street} onChange={(e) => setStreet(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input value={number} onChange={(e) => setNumber(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Complemento</Label>
                  <Input value={complement} onChange={(e) => setComplement(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input value={state} onChange={(e) => setState(e.target.value)} maxLength={2} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>CPF (obrigatório para Correios)</Label>
                <Input 
                  value={cpf.replace(/\D/g, "").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2")} 
                  onChange={(e) => setCpf(e.target.value.replace(/\D/g, "").slice(0, 11))} 
                  placeholder="000.000.000-00" maxLength={14}
                />
              </div>

              <div className="space-y-2">
                <Label>Referência</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Próximo a..." />
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setCurrentStep("cart")}>Voltar</Button>
                <Button className="flex-1" onClick={saveRegistrationAndProceed} disabled={!nome.trim() || !phoneMask.isValid}>
                  Continuar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Delivery */}
        {currentStep === "delivery" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={deliveryMethod} onValueChange={(v) => {
                setDeliveryMethod(v as DeliveryMethod);
                if (v !== "motoboy") setMotoboyAddressConfirmed(false);
              }}>
                <label className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${deliveryMethod === "motoboy" ? "border-primary bg-primary/5" : ""}`}>
                  <RadioGroupItem value="motoboy" />
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">Motoboy (Anápolis)</p>
                    <p className="text-sm text-muted-foreground">{STORE_CONFIG.motoboyDeliveryText}</p>
                  </div>
                  <span className="font-semibold">{formatPrice(STORE_CONFIG.motoboyFee)}</span>
                </label>

                <label className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${deliveryMethod === "pickup" ? "border-primary bg-primary/5" : ""}`}>
                  <RadioGroupItem value="pickup" />
                  <Store className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">Retirar na Loja</p>
                    <p className="text-sm text-muted-foreground">{STORE_CONFIG.storeAddress}</p>
                    <p className="text-xs text-muted-foreground">{STORE_CONFIG.storeHours}</p>
                  </div>
                  <span className="font-semibold text-green-600">Grátis</span>
                </label>

                <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${deliveryMethod === "shipping" ? "border-primary bg-primary/5" : ""}`}>
                  <RadioGroupItem value="shipping" className="mt-1" />
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">Enviar para outra cidade</p>
                    <p className="text-sm text-muted-foreground">Correios (PAC/SEDEX)</p>
                  </div>
                </label>
              </RadioGroup>

              {deliveryMethod === "motoboy" && (
                <MotoboyConfirmation
                  address={{ street, number, complement, neighborhood, city, state, zipCode, reference }}
                  onAddressConfirmed={({ period, notes }) => {
                    setMotoboyAddressConfirmed(true);
                    setDeliveryPeriod(period);
                    setDeliveryNotes(notes);
                  }}
                  onEditAddress={() => setCurrentStep("registration")}
                  initialPeriod={deliveryPeriod}
                  initialNotes={deliveryNotes}
                />
              )}

              {deliveryMethod === "pickup" && (
                <PickupConfirmation notes={deliveryNotes} onNotesChange={setDeliveryNotes} />
              )}

              {deliveryMethod === "shipping" && (
                <>
                  <ShippingCalculator
                    zipCode={zipCode}
                    onZipCodeChange={setZipCode}
                    cartWeight={0.5}
                    cartDimensions={{ length: 30, width: 20, height: 15 }}
                    selectedQuote={selectedShipping}
                    onQuoteSelect={setSelectedShipping}
                  />
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="cpf-shipping" className="flex items-center gap-1">
                      CPF do destinatário <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="cpf-shipping"
                      value={cpf ? cpf.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2") : ""}
                      onChange={(e) => setCpf(e.target.value.replace(/\D/g, "").slice(0, 11))}
                      placeholder="000.000.000-00" maxLength={14}
                      className={!isCpfValidForShipping() ? "border-red-500" : ""}
                    />
                    {!isCpfValidForShipping() && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        CPF obrigatório para gerar etiqueta dos Correios (11 dígitos)
                      </p>
                    )}
                  </div>
                </>
              )}

              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatPrice(cart?.subtotal || 0)}</span></div>
                <div className="flex justify-between">
                  <span>Entrega</span>
                  <span>{getDeliveryFee() === 0 ? <span className="text-green-600">Grátis</span> : formatPrice(getDeliveryFee())}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                  <span>Total</span><span>{formatPrice(getTotalWithDelivery())}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setCurrentStep("registration")}>Voltar</Button>
                <Button className="flex-1" onClick={proceedToPayment} disabled={isSaving || !canProceedToPayment()}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Continuar para Pagamento
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Payment */}
        {currentStep === "payment" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium">Resumo do Pedido</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>{activeItems.length} {activeItems.length === 1 ? "item" : "itens"}</span>
                    <span>{formatPrice(cart?.subtotal || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Entrega</span><span>{formatPrice(cart?.frete || 0)}</span>
                  </div>
                </div>
                <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                  <span>Total</span>
                  <span>{formatPrice(cart?.total || getTotalWithDelivery())}</span>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                  <CheckCircle className="h-5 w-5" />
                  Pagamento Seguro
                </div>
                <p className="text-sm text-green-600">
                  Você será redirecionada para o Mercado Pago para concluir o pagamento com segurança.
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setCurrentStep("delivery")}>Voltar</Button>
                <Button 
                  className="flex-1 bg-[#009ee3] hover:bg-[#007bbd]" 
                  size="lg"
                  onClick={generatePayment}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Gerando pagamento...</>
                  ) : (
                    <><CreditCard className="h-4 w-4 mr-2" />Pagar com Mercado Pago</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
