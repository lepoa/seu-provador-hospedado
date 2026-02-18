import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Package, CheckCircle2, AlertCircle, User, Truck, MapPin, Store, ArrowRight, CreditCard, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Header } from "@/components/Header";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isLowStock } from "@/components/StockBySize";
import { usePhoneMask } from "@/hooks/usePhoneMask";
import { STORE_CONFIG, DeliveryMethod, ShippingQuote } from "@/lib/storeDeliveryConfig";
import { AddressForm, AddressData, formatFullAddress, parseAddressLine, isValidCpf } from "@/components/AddressForm";
import { useCoupon, recordCouponUse } from "@/hooks/useCoupon";
import { CouponInput } from "@/components/CouponInput";
import { MotoboyConfirmation, DeliveryPeriod, canProceedWithMotoboy } from "@/components/checkout/MotoboyConfirmation";
import { PickupConfirmation } from "@/components/checkout/PickupConfirmation";
import { ShippingAddressSelector } from "@/components/checkout/ShippingAddressSelector";
import { useProductAvailableStock } from "@/hooks/useProductAvailableStock";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
}

interface ProductStock {
  id: string;
  stock_by_size: Record<string, number> | null | unknown;
  color: string | null;
  image_url: string | null;
  images: string[] | null;
  main_image_index: number | null;
  weight_kg: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
}

// Default values for shipping calculation
const DEFAULT_WEIGHT_KG = 0.30;
const DEFAULT_DIMENSIONS = {
  length: 30,
  width: 20,
  height: 10,
};

interface CustomerProfile {
  full_name: string | null;
  name: string | null;
  whatsapp: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  address_reference: string | null;
  cpf: string | null;
  address: string | null;
}

type CheckoutStep = "profile" | "delivery" | "review" | "payment";

const Checkout = () => {
  const navigate = useNavigate();
  const { items, total: cartSubtotal, clearCart } = useCart();
  const couponHook = useCoupon();
  const { user, isLoading: authLoading } = useAuth();

  // Steps
  const [currentStep, setCurrentStep] = useState<CheckoutStep>("profile");

  // Profile form
  const [fullName, setFullName] = useState("");
  const phoneMask = usePhoneMask("");
  const [addressData, setAddressData] = useState<AddressData>({
    zipCode: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    reference: "",
    document: "",
  });

  // Delivery
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("motoboy");
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuote[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingQuote | null>(null);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const [shippingZipCode, setShippingZipCode] = useState("");

  // Correios shipping - LOCKED address data after quote
  const [shippingAddressData, setShippingAddressData] = useState<AddressData | null>(null);
  const [shippingAddressId, setShippingAddressId] = useState<string | null>(null);
  const [quotedZipCode, setQuotedZipCode] = useState(""); // CEP used for the shipping calculation

  // Motoboy specific
  const [motoboyAddressConfirmed, setMotoboyAddressConfirmed] = useState(false);
  const [deliveryPeriod, setDeliveryPeriod] = useState<DeliveryPeriod>("qualquer");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [finalTotal, setFinalTotal] = useState<number | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [productStocks, setProductStocks] = useState<Record<string, ProductStock>>({});
  const [stockErrors, setStockErrors] = useState<string[]>([]);
  const [profileComplete, setProfileComplete] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      toast.info("Faça login para finalizar seu pedido");
      navigate("/entrar", { state: { returnTo: "/checkout" } });
    }
  }, [user, authLoading, navigate]);

  // Load profile
  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  // CRITICAL: Redirect from review to delivery if shipping address is invalid
  // This prevents the review step from showing without a valid address
  useEffect(() => {
    if (currentStep === "review" && deliveryMethod === "shipping") {
      // Inline validation to avoid function reference issue
      const addressValid = (() => {
        if (!shippingAddressData) return false;
        if (!quotedZipCode) return false;

        const addressZip = shippingAddressData.zipCode.replace(/\D/g, "");
        const quotedZip = quotedZipCode.replace(/\D/g, "");

        const hasRequiredFields = !!(
          shippingAddressData.street &&
          shippingAddressData.city &&
          shippingAddressData.state &&
          addressZip.length === 8
        );

        return hasRequiredFields && addressZip === quotedZip;
      })();

      if (!addressValid) {
        toast.error("Endereço de entrega inválido. Selecione ou cadastre um endereço.");
        setCurrentStep("delivery");
      }
    }
  }, [currentStep, deliveryMethod, shippingAddressData, quotedZipCode]);

  // Get product IDs for stock check
  const productIds = useMemo(() => [...new Set(items.map(i => i.productId))], [items]);

  // Use centralized stock hook that considers live reservations
  const { getAvailable, isLoading: stockViewLoading } = useProductAvailableStock(
    productIds.length > 0 ? productIds : undefined
  );

  // Load stock info and validate against centralized view
  useEffect(() => {
    async function loadStocks() {
      if (items.length === 0) return;
      const { data } = await supabase
        .from("product_catalog")
        .select("id, stock_by_size, color, image_url, images, main_image_index, weight_kg, length_cm, width_cm, height_cm")
        .in("id", productIds);

      if (data) {
        const stockMap: Record<string, ProductStock> = {};
        data.forEach(p => { stockMap[p.id] = p; });
        setProductStocks(stockMap);
      }
    }
    loadStocks();
  }, [items, productIds]);

  // Validate stock using centralized view (includes live reservations)
  useEffect(() => {
    if (stockViewLoading || items.length === 0) return;

    const errors: string[] = [];
    items.forEach(item => {
      const available = getAvailable(item.productId, item.size);
      if (item.quantity > available) {
        if (available <= 0) {
          errors.push(`${item.name} (${item.size}): tamanho esgotado no momento`);
        } else {
          errors.push(`${item.name} (${item.size}): apenas ${available} disponível(is)`);
        }
      }
    });
    setStockErrors(errors);
  }, [items, getAvailable, stockViewLoading]);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name, name, whatsapp, address_line, city, state, zip_code, address_reference, cpf, address")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      const name = data.full_name || data.name || "";
      setFullName(name);
      if (data.whatsapp) phoneMask.setDisplayValue(data.whatsapp);

      // Parse address into structured format
      const parsedAddress = parseAddressLine(
        data.address_line,
        data.city,
        data.state,
        data.zip_code,
        data.address_reference
      );
      setAddressData(parsedAddress);

      if (data.zip_code) {
        setShippingZipCode(data.zip_code.replace(/\D/g, ""));
      }

      // Check if profile is complete
      const hasRequiredFields = !!(name && data.whatsapp);
      setProfileComplete(hasRequiredFields);

      // Skip profile step if complete
      if (hasRequiredFields) {
        setCurrentStep("delivery");
      }
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    if (!fullName.trim() || !phoneMask.displayValue) {
      toast.error("Preencha nome e WhatsApp");
      return;
    }
    if (!phoneMask.isValid) {
      toast.error("WhatsApp inválido");
      return;
    }

    setIsSavingProfile(true);
    try {
      // Build full address line from components
      const addressParts = [
        addressData.street,
        addressData.number,
        addressData.complement,
        addressData.neighborhood,
      ].filter(Boolean);
      const fullAddressLine = addressParts.join(", ");

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          name: fullName.trim(),
          whatsapp: phoneMask.getNormalizedValue(),
          address_line: fullAddressLine || null,
          city: addressData.city.trim() || null,
          state: addressData.state.trim() || null,
          zip_code: addressData.zipCode.replace(/\D/g, '') || null,
          address_reference: addressData.reference.trim() || null,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      setProfileComplete(true);
      setCurrentStep("delivery");
      toast.success("Dados salvos!");
    } catch (error) {
      console.error("Save profile error:", error);
      toast.error("Erro ao salvar dados");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Calculate total cart weight
  const getTotalCartWeight = (): number => {
    let totalWeight = 0;

    items.forEach(item => {
      const productWeight = productStocks[item.productId]?.weight_kg || DEFAULT_WEIGHT_KG;
      totalWeight += productWeight * item.quantity;
    });

    return Math.round(totalWeight * 100) / 100; // Round to 2 decimal places
  };

  // Calculate package dimensions (use largest of all items, or defaults)
  const getPackageDimensions = (): { length: number; width: number; height: number } => {
    let maxLength = DEFAULT_DIMENSIONS.length;
    let maxWidth = DEFAULT_DIMENSIONS.width;
    let totalHeight = 0;

    items.forEach(item => {
      const product = productStocks[item.productId];
      const itemLength = product?.length_cm || DEFAULT_DIMENSIONS.length;
      const itemWidth = product?.width_cm || DEFAULT_DIMENSIONS.width;
      const itemHeight = product?.height_cm || DEFAULT_DIMENSIONS.height;

      // Use the largest length and width
      maxLength = Math.max(maxLength, itemLength);
      maxWidth = Math.max(maxWidth, itemWidth);
      // Sum heights for stacked items
      totalHeight += itemHeight * item.quantity;
    });

    // Ensure minimum dimensions and cap at reasonable max
    return {
      length: Math.min(Math.max(maxLength, 11), 100),
      width: Math.min(Math.max(maxWidth, 11), 100),
      height: Math.min(Math.max(totalHeight, 2), 100),
    };
  };

  const calculateShipping = async () => {
    const cleanZip = shippingZipCode.replace(/\D/g, '');
    if (cleanZip.length !== 8) {
      toast.error("CEP inválido");
      return;
    }

    setIsCalculatingShipping(true);
    setShippingQuotes([]);
    setSelectedShipping(null);
    // Clear previously selected address when recalculating - force user to re-select
    setShippingAddressData(null);
    setShippingAddressId(null);

    try {
      const totalWeight = getTotalCartWeight();
      const dimensions = getPackageDimensions();

      console.log(`Shipping calculation: weight=${totalWeight}kg, dimensions=${dimensions.length}x${dimensions.width}x${dimensions.height}cm`);

      const { data, error } = await supabase.functions.invoke('calculate-shipping', {
        body: {
          toZipCode: cleanZip,
          weight: totalWeight,
          length: dimensions.length,
          width: dimensions.width,
          height: dimensions.height,
        }
      });

      if (error) throw error;

      if (data.quotes && data.quotes.length > 0) {
        setShippingQuotes(data.quotes);
        setSelectedShipping(data.quotes[0]); // Pre-select cheapest
        // IMPORTANT: Save the quoted ZIP code to enforce address matching
        setQuotedZipCode(cleanZip);
        toast.success("Frete calculado! Agora selecione o endereço de entrega.");
      } else {
        toast.error(data.error || "Não foi possível calcular o frete");
      }
    } catch (error: any) {
      console.error("Shipping calculation error:", error);

      let errorMessage = "Erro ao calcular frete";

      // Try to extract detailed error from Edge Function response
      if (error?.context?.status === 500 || error?.context?.status === 400) {
        try {
          // The error object from supabase-js might have the body text or json
          const body = await error.context.json();
          if (body?.error) {
            errorMessage = body.error;
            if (body.details) errorMessage += `: ${body.details}`;
          }
        } catch (e) {
          // If parsing fails, use default
          console.error("Failed to parse error body:", e);
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    } finally {
      setIsCalculatingShipping(false);
    }
  };

  const getDeliveryFee = (): number => {
    if (deliveryMethod === "pickup") return 0;
    if (deliveryMethod === "motoboy") return STORE_CONFIG.motoboyFee;
    if (deliveryMethod === "shipping" && selectedShipping) return selectedShipping.price;
    return 0;
  };

  // Validate CPF for Correios shipping (11 digits required)
  const isCpfValidForShipping = (): boolean => {
    // For Correios, use the shippingAddressData (locked address)
    if (deliveryMethod === "shipping" && shippingAddressData) {
      const cpfDigits = (shippingAddressData.document || "").replace(/\D/g, "");
      return cpfDigits.length === 11;
    }
    // Fallback to profile address for non-shipping methods
    const cpfDigits = (addressData.document || "").replace(/\D/g, "");
    return cpfDigits.length === 11;
  };

  // Validate that shipping address matches quoted ZIP
  const isShippingAddressValid = (): boolean => {
    if (!shippingAddressData) return false;
    if (!quotedZipCode) return false;

    const addressZip = shippingAddressData.zipCode.replace(/\D/g, "");
    const quotedZip = quotedZipCode.replace(/\D/g, "");

    // Check if address has minimum required fields
    const hasRequiredFields = !!(
      shippingAddressData.street &&
      shippingAddressData.city &&
      shippingAddressData.state &&
      addressZip.length === 8
    );

    // CEP must match quoted CEP
    const zipMatches = addressZip === quotedZip;

    return hasRequiredFields && zipMatches;
  };

  // Get validation error message for shipping
  const getShippingValidationError = (): string | null => {
    if (!selectedShipping) return "Calcule o frete primeiro";
    if (!quotedZipCode) return "CEP não cotado";
    if (!shippingAddressData) return "Selecione ou cadastre um endereço";

    const addressZip = shippingAddressData.zipCode.replace(/\D/g, "");
    const quotedZip = quotedZipCode.replace(/\D/g, "");

    if (addressZip !== quotedZip) {
      return `O frete foi calculado para o CEP ${quotedZip.replace(/(\d{5})(\d{3})/, "$1-$2")}, mas o endereço selecionado é do CEP ${addressZip.replace(/(\d{5})(\d{3})/, "$1-$2")}. Selecione ou cadastre o endereço correto.`;
    }

    if (!shippingAddressData.street || !shippingAddressData.city || !shippingAddressData.state) {
      return "Complete todos os campos obrigatórios do endereço";
    }

    if (!isCpfValidForShipping()) {
      return "CPF obrigatório para gerar etiqueta dos Correios (11 dígitos)";
    }

    return null;
  };

  const canProceedToReview = (): boolean => {
    if (deliveryMethod === "pickup") return true;
    if (deliveryMethod === "motoboy") {
      return canProceedWithMotoboy(motoboyAddressConfirmed, deliveryPeriod);
    }
    if (deliveryMethod === "shipping") {
      // CRITICAL: Require valid address that matches quoted ZIP AND valid CPF
      return !!selectedShipping && isShippingAddressValid() && isCpfValidForShipping();
    }
    return false;
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Faça login para continuar");
      return;
    }
    if (items.length === 0) {
      toast.error("Carrinho vazio");
      return;
    }
    // Validate required profile fields to avoid "Sem nome"
    if (!fullName.trim()) {
      toast.error("Preencha seu nome completo");
      setCurrentStep("profile");
      return;
    }
    if (!phoneMask.isValid || !phoneMask.displayValue) {
      toast.error("Preencha um WhatsApp válido");
      setCurrentStep("profile");
      return;
    }
    if (stockErrors.length > 0) {
      toast.error("Corrija os problemas de estoque");
      return;
    }
    // Validate Correios shipping address
    if (deliveryMethod === "shipping") {
      const validationError = getShippingValidationError();
      if (validationError) {
        toast.error(validationError);
        setCurrentStep("delivery");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const deliveryFee = getDeliveryFee();
      const discountAmount = couponHook.discountAmount;
      const totalWithShipping = cartSubtotal - discountAmount + deliveryFee;

      // CRITICAL: Use the CORRECT address based on delivery method
      // For Correios: use shippingAddressData (locked to quoted ZIP)
      // For others: use profile addressData
      const effectiveAddress = deliveryMethod === "shipping" && shippingAddressData
        ? shippingAddressData
        : addressData;

      // Build full address line from components
      const addressParts = [
        effectiveAddress.street,
        effectiveAddress.number,
        effectiveAddress.complement,
        effectiveAddress.neighborhood,
      ].filter(Boolean);
      const fullAddressLine = addressParts.join(", ");

      // Build address snapshot with document (CPF) for shipping
      const addressSnapshot = {
        full_name: fullName,
        whatsapp: phoneMask.getNormalizedValue(),
        address_line: fullAddressLine,
        city: effectiveAddress.city,
        state: effectiveAddress.state,
        zip_code: effectiveAddress.zipCode,
        address_reference: effectiveAddress.reference,
        document: effectiveAddress.document?.replace(/\D/g, "") || "",
      };

      // Format address for legacy field
      const fullAddress = deliveryMethod === "pickup"
        ? "Retirada na loja"
        : `${fullAddressLine}, ${effectiveAddress.city} - ${effectiveAddress.state}, CEP ${effectiveAddress.zipCode}${effectiveAddress.reference ? ` (${effectiveAddress.reference})` : ''}`;

      // Create order with status "aguardando_pagamento" (don't decrement stock yet)
      // Store subtotal separately for accurate calculation tracking
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_name: fullName,
          customer_phone: phoneMask.getNormalizedValue(),
          customer_address: fullAddress,
          subtotal: cartSubtotal, // Products only (before discount/shipping)
          total: totalWithShipping,
          status: "aguardando_pagamento",
          payment_status: "pending",
          user_id: user.id,
          delivery_method: deliveryMethod,
          shipping_fee: deliveryFee,
          shipping_service: selectedShipping?.service || null,
          shipping_deadline_days: selectedShipping?.deliveryDays || null,
          address_snapshot: addressSnapshot,
          coupon_id: (couponHook.coupon && !couponHook.coupon.isBirthdayCoupon) ? couponHook.coupon.id : null,
          coupon_discount: discountAmount,
          delivery_period: deliveryMethod === "motoboy" ? deliveryPeriod : null,
          delivery_notes: deliveryNotes?.trim() || null,
          customer_notes: deliveryNotes?.trim() || null, // Persist customer observations separately
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items with discount info (don't decrement stock yet - webhook will do it on payment approval)
      const orderItems = items.map((item) => {
        const product = productStocks[item.productId];
        const mainIndex = product?.main_image_index || 0;
        const productImage = product?.images?.[mainIndex] || product?.image_url || item.imageUrl || null;
        const itemSubtotal = item.price * item.quantity;

        console.log("[CHECKOUT] Order item:", {
          product_id: item.productId,
          size: item.size,
          quantity: item.quantity,
          unit_price_original: item.originalPrice,
          unit_price_final: item.price,
          discount_percent: item.discountPercent,
          subtotal: itemSubtotal,
        });

        return {
          order_id: order.id,
          product_id: item.productId,
          product_name: item.name,
          product_price: item.price, // Final discounted price
          unit_price_original: item.originalPrice,
          discount_percent: item.discountPercent,
          subtotal: itemSubtotal,
          size: item.size,
          quantity: item.quantity,
          color: product?.color || null,
          image_url: productImage,
        };
      });

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Reserve stock immediately (committed_by_size) - idempotent
      const { data: reserveResult, error: reserveError } = await supabase
        .rpc("reserve_order_stock" as any, { p_order_id: order.id });

      if (reserveError) {
        console.error("[CHECKOUT] Stock reservation failed:", reserveError);
        // Non-blocking: order was created, reservation can be retried
      } else {
        console.log("[CHECKOUT] Stock reserved:", reserveResult);
      }

      // Record coupon use if applied
      if (couponHook.coupon) {
        await recordCouponUse(
          couponHook.coupon.id,
          order.id,
          null,
          discountAmount,
          couponHook.coupon.isBirthdayCoupon
        );
      }

      // Persist CPF to customer record and customer_addresses if provided
      const cleanCpf = (addressData.document || "").replace(/\D/g, "");
      if (cleanCpf.length === 11 && user?.id) {
        // Find customer by user_id
        const { data: customerData } = await supabase
          .from("customers")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (customerData) {
          // Update customers.document
          await supabase
            .from("customers")
            .update({ document: cleanCpf })
            .eq("id", customerData.id);

          // Update customer_addresses.document (default address)
          const { data: defaultAddr } = await supabase
            .from("customer_addresses")
            .select("id")
            .eq("customer_id", customerData.id)
            .eq("is_default", true)
            .maybeSingle();

          if (defaultAddr) {
            await supabase
              .from("customer_addresses")
              .update({ document: cleanCpf })
              .eq("id", defaultAddr.id);
          }
        }
      }

      // Save order ID and move to payment step
      setOrderId(order.id);
      setOrderNumber(order.id.slice(0, 8).toUpperCase());

      // Capture the final total before clearing cart (cart clearing zeroes cartSubtotal)
      const computedTotal = cartSubtotal - couponHook.discountAmount + getDeliveryFee();
      setFinalTotal(computedTotal);

      // CRITICAL: Clear cart immediately after order creation to prevent duplicates
      // This must happen BEFORE the payment step, not after MP redirect
      clearCart();

      setCurrentStep("payment");
      toast.success("Pedido criado! Agora finalize o pagamento.");
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Erro ao criar pedido. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayWithMercadoPago = async () => {
    if (!orderId) {
      toast.error("Pedido não encontrado");
      return;
    }

    setIsCreatingPayment(true);
    try {
      // BACKEND-FIRST: Recalculate prices from DB before payment
      // This ensures promotional prices are validated server-side and promotion_id is persisted
      console.log("[CHECKOUT] Calling finalize_order_prices RPC for:", orderId);
      const { data: finalizeResult, error: finalizeError } = await supabase
        .rpc("finalize_order_prices", { p_order_id: orderId });

      if (finalizeError) {
        console.error("finalize_order_prices RPC error:", finalizeError);
        // Non-blocking: continue with payment even if finalize fails
        console.warn("[CHECKOUT] Continuing despite finalize error");
      } else {
        console.log("[CHECKOUT] finalize_order_prices result:", finalizeResult);
      }

      // Now create MP preference with backend-validated total
      const { data, error } = await supabase.functions.invoke("create-mp-preference", {
        body: { order_id: orderId, payer_email: user?.email || "" },
      });

      if (error) {
        console.error("MP preference invocation error:", error);
        toast.error("Erro de conexão com o servidor. Tente novamente.");
        return;
      }

      // Handle structured error responses from edge function
      if (data?.error_code || data?.error) {
        console.error("MP preference error:", data);
        const errorMessage = data.error || "Erro ao criar link de pagamento";
        const action = data.action || "";
        toast.error(`${errorMessage}${action ? ` ${action}` : ""}`);
        return;
      }

      if (data?.init_point) {
        // Cart already cleared when order was created
        // Redirect to Mercado Pago
        window.location.href = data.init_point;
      } else {
        console.error("MP preference missing init_point:", data);
        toast.error("Link de pagamento não gerado. Tente novamente.");
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Erro ao processar pagamento. Verifique sua conexão.");
    } finally {
      setIsCreatingPayment(false);
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Note: Order confirmation is now handled by separate pages (/pedido/sucesso, etc.)
  // after Mercado Pago redirect. The payment step shows inline in checkout.

  // Empty cart (but allow payment step with existing order)
  if (items.length === 0 && !orderNumber && currentStep !== "payment") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 max-w-lg text-center">
          <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="font-serif text-2xl mb-2">Carrinho vazio</h1>
          <p className="text-muted-foreground mb-6">Adicione produtos antes de finalizar</p>
          <Button onClick={() => navigate("/catalogo")}>Ver catálogo</Button>
        </main>
      </div>
    );
  }

  const total = cartSubtotal - couponHook.discountAmount + getDeliveryFee();

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-lg">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8">
          <StepIndicator step="profile" current={currentStep} label="Cadastro" icon={<User className="h-4 w-4" />} />
          <div className="w-4 sm:w-8 h-px bg-border" />
          <StepIndicator step="delivery" current={currentStep} label="Entrega" icon={<Truck className="h-4 w-4" />} />
          <div className="w-4 sm:w-8 h-px bg-border" />
          <StepIndicator step="review" current={currentStep} label="Confirmar" icon={<CheckCircle2 className="h-4 w-4" />} />
          <div className="w-4 sm:w-8 h-px bg-border" />
          <StepIndicator step="payment" current={currentStep} label="Pagar" icon={<CreditCard className="h-4 w-4" />} />
        </div>

        {/* Stock errors */}
        {stockErrors.length > 0 && (
          <Card className="mb-6 border-destructive">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive mb-1">Problemas de estoque</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {stockErrors.map((error, i) => <li key={i}>{error}</li>)}
                  </ul>
                  <Button variant="link" size="sm" className="px-0 h-auto mt-2" onClick={() => navigate("/carrinho")}>
                    Ajustar carrinho
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Profile */}
        {currentStep === "profile" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Complete seu cadastro
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                É só uma vez. Seus dados ficam salvos para os próximos pedidos.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Seu nome *</Label>
                <Input
                  id="fullName"
                  placeholder="Maria Silva"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(62) 99122-3519"
                  value={phoneMask.displayValue}
                  onChange={phoneMask.handleChange}
                  onBlur={phoneMask.handleBlur}
                  className={phoneMask.hasError ? "border-destructive" : ""}
                />
                {phoneMask.hasError && (
                  <p className="text-sm text-destructive">WhatsApp inválido</p>
                )}
              </div>

              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium mb-3">Endereço (para entregas)</p>

                <AddressForm
                  value={addressData}
                  onChange={(data) => {
                    setAddressData(data);
                    if (data.zipCode.length === 8) {
                      setShippingZipCode(data.zipCode);
                    }
                  }}
                  showReference={true}
                />
              </div>

              <Button
                className="w-full mt-4"
                onClick={saveProfile}
                disabled={isSavingProfile || !fullName.trim() || !phoneMask.displayValue || !phoneMask.isValid}
              >
                {isSavingProfile ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                ) : (
                  <>Continuar<ArrowRight className="h-4 w-4 ml-2" /></>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: Delivery */}
        {currentStep === "delivery" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Como você quer receber?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={deliveryMethod}
                onValueChange={(v) => {
                  setDeliveryMethod(v as DeliveryMethod);
                  if (v !== "shipping") {
                    setShippingQuotes([]);
                    setSelectedShipping(null);
                  }
                }}
              >
                {/* Motoboy */}
                <div className={`flex items-start space-x-3 p-4 rounded-lg border ${deliveryMethod === "motoboy" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <RadioGroupItem value="motoboy" id="motoboy" className="mt-1" />
                  <Label htmlFor="motoboy" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="font-medium">Motoboy (Anápolis)</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{STORE_CONFIG.motoboyDeliveryText}</p>
                    <p className="text-sm font-medium text-primary mt-1">{formatPrice(STORE_CONFIG.motoboyFee)}</p>
                  </Label>
                </div>

                {/* Pickup */}
                <div className={`flex items-start space-x-3 p-4 rounded-lg border ${deliveryMethod === "pickup" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <RadioGroupItem value="pickup" id="pickup" className="mt-1" />
                  <Label htmlFor="pickup" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-primary" />
                      <span className="font-medium">Retirar na loja</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{STORE_CONFIG.storeAddress}</p>
                    <p className="text-xs text-muted-foreground">{STORE_CONFIG.storeHours}</p>
                    <p className="text-sm font-medium text-green-600 mt-1">Grátis</p>
                  </Label>
                </div>

                {/* Shipping */}
                <div className={`flex items-start space-x-3 p-4 rounded-lg border ${deliveryMethod === "shipping" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <RadioGroupItem value="shipping" id="shipping" className="mt-1" />
                  <Label htmlFor="shipping" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" />
                      <span className="font-medium">Outra cidade (Correios)</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Entrega via PAC ou SEDEX</p>
                  </Label>
                </div>
              </RadioGroup>

              {/* Motoboy Confirmation */}
              {deliveryMethod === "motoboy" && (
                <MotoboyConfirmation
                  address={{
                    street: addressData.street,
                    number: addressData.number,
                    complement: addressData.complement,
                    neighborhood: addressData.neighborhood,
                    city: addressData.city,
                    state: addressData.state,
                    zipCode: addressData.zipCode,
                    reference: addressData.reference,
                  }}
                  onAddressConfirmed={({ period, notes }) => {
                    setMotoboyAddressConfirmed(true);
                    setDeliveryPeriod(period);
                    setDeliveryNotes(notes);
                  }}
                  onEditAddress={() => setCurrentStep("profile")}
                  initialPeriod={deliveryPeriod}
                  initialNotes={deliveryNotes}
                />
              )}

              {/* Pickup Confirmation */}
              {deliveryMethod === "pickup" && (
                <PickupConfirmation
                  notes={deliveryNotes}
                  onNotesChange={setDeliveryNotes}
                />
              )}

              {/* Shipping calculation */}
              {deliveryMethod === "shipping" && (
                <div className="border-t pt-4 space-y-4">
                  {/* Step 1: ZIP Code and Quote */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">1. Calcular frete</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Digite o CEP de destino"
                        value={shippingZipCode}
                        onChange={(e) => setShippingZipCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        className="flex-1"
                      />
                      <Button
                        variant="secondary"
                        onClick={calculateShipping}
                        disabled={isCalculatingShipping || shippingZipCode.length < 8}
                      >
                        {isCalculatingShipping ? <Loader2 className="h-4 w-4 animate-spin" /> : "Calcular"}
                      </Button>
                    </div>
                  </div>

                  {/* Shipping options */}
                  {shippingQuotes.length > 0 && (
                    <RadioGroup
                      value={selectedShipping?.service || ""}
                      onValueChange={(v) => setSelectedShipping(shippingQuotes.find(q => q.service === v) || null)}
                    >
                      {shippingQuotes.map((quote) => (
                        <div
                          key={quote.service}
                          className={`flex items-center justify-between p-3 rounded-lg border ${selectedShipping?.service === quote.service ? "border-primary bg-primary/5" : "border-border"}`}
                        >
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value={quote.service} id={quote.service} />
                            <Label htmlFor={quote.service} className="cursor-pointer">
                              <span className="font-medium">{quote.serviceName}</span>
                              <p className="text-xs text-muted-foreground">
                                {quote.deliveryRange.min === quote.deliveryRange.max
                                  ? `${quote.deliveryDays} dias úteis`
                                  : `${quote.deliveryRange.min}-${quote.deliveryRange.max} dias úteis`
                                }
                              </p>
                            </Label>
                          </div>
                          <span className="font-medium">{formatPrice(quote.price)}</span>
                        </div>
                      ))}
                    </RadioGroup>
                  )}

                  {/* Step 2: Address Selection (only after quote) */}
                  {selectedShipping && quotedZipCode && user && (
                    <div className="space-y-2 border-t pt-4">
                      <Label className="text-sm font-medium">2. Endereço de entrega</Label>
                      <ShippingAddressSelector
                        userId={user.id}
                        quotedZipCode={quotedZipCode}
                        onAddressSelect={(address, addressId) => {
                          setShippingAddressData(address);
                          setShippingAddressId(addressId || null);
                        }}
                        selectedAddressId={shippingAddressId}
                        cpfRequired={true}
                      />
                    </div>
                  )}

                  {/* Validation error message */}
                  {selectedShipping && getShippingValidationError() && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {getShippingValidationError()}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setCurrentStep("profile")}>Voltar</Button>
                <Button
                  className="flex-1"
                  onClick={() => setCurrentStep("review")}
                  disabled={!canProceedToReview()}
                >
                  Continuar<ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Review */}
        {currentStep === "review" && (
          <div className="space-y-4">
            {/* Order Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Resumo do pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.map((item) => {
                  const stock = productStocks[item.productId]?.stock_by_size;
                  const stockObj = (stock && typeof stock === 'object') ? stock as Record<string, number> : {};
                  const lowStock = isLowStock(stockObj, item.size);

                  return (
                    <div key={`${item.productId}-${item.size}`} className="flex justify-between text-sm items-center">
                      <span className="flex items-center gap-2">
                        {item.name} ({item.size}) x{item.quantity}
                        {lowStock && <Badge variant="outline" className="text-[10px]">Últimas</Badge>}
                      </span>
                      <span>{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  );
                })}

                <div className="border-t pt-2 mt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>{formatPrice(cartSubtotal)}</span>
                  </div>
                  {couponHook.discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Cupom ({couponHook.coupon?.code})</span>
                      <span>-{formatPrice(couponHook.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>
                      {deliveryMethod === "pickup" ? "Retirada" : deliveryMethod === "motoboy" ? "Motoboy" : selectedShipping?.serviceName || "Frete"}
                    </span>
                    <span className={getDeliveryFee() === 0 ? "text-green-600" : ""}>
                      {getDeliveryFee() === 0 ? "Grátis" : formatPrice(getDeliveryFee())}
                    </span>
                  </div>
                  <div className="flex justify-between font-medium text-lg border-t pt-2">
                    <span>Total</span>
                    <span className="text-accent">{formatPrice(total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Coupon Input */}
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-3">Cupom de desconto</p>
                <CouponInput
                  onApply={(code) => couponHook.applyCoupon(code, cartSubtotal)}
                  onRemove={couponHook.removeCoupon}
                  appliedCoupon={couponHook.coupon ? {
                    code: couponHook.coupon.code,
                    discountAmount: couponHook.discountAmount
                  } : null}
                  isLoading={couponHook.isLoading}
                  error={couponHook.error}
                  orderTotal={cartSubtotal}
                />
              </CardContent>
            </Card>

            {/* Delivery Info */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {deliveryMethod === "pickup" ? (
                    <Store className="h-5 w-5 text-primary mt-0.5" />
                  ) : (
                    <MapPin className="h-5 w-5 text-primary mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium">
                      {deliveryMethod === "pickup" ? "Retirada na loja" : "Entrega"}
                    </p>
                    {deliveryMethod === "pickup" ? (
                      <>
                        <p className="text-sm text-muted-foreground">{STORE_CONFIG.storeAddress}</p>
                        <p className="text-xs text-muted-foreground">{STORE_CONFIG.storeHours}</p>
                      </>
                    ) : deliveryMethod === "shipping" && shippingAddressData ? (
                      <>
                        <p className="text-sm text-muted-foreground">
                          {formatFullAddress(shippingAddressData)}
                        </p>
                        {selectedShipping && (
                          <p className="text-xs text-primary mt-1">
                            {selectedShipping.serviceName} • {formatPrice(selectedShipping.price)}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {formatFullAddress(addressData)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep("delivery")}>Voltar</Button>
              <Button
                className="flex-1"
                size="lg"
                onClick={handleSubmit}
                disabled={isSubmitting || stockErrors.length > 0}
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Finalizando...</>
                ) : (
                  `Confirmar pedido • ${formatPrice(total)}`
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Payment */}
        {currentStep === "payment" && orderId && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Pagamento via Mercado Pago
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-center">
                  <p className="text-sm mb-2">
                    Pedido <span className="font-mono font-bold">#{orderNumber}</span> criado!
                  </p>
                  {finalTotal !== null ? (
                    <p className="text-2xl font-bold text-accent">{formatPrice(finalTotal)}</p>
                  ) : (
                    <div className="h-8 w-32 mx-auto bg-muted animate-pulse rounded" />
                  )}
                </div>

                <p className="text-sm text-muted-foreground text-center">
                  Você será redirecionada para o Mercado Pago para finalizar o pagamento com segurança.
                  Aceita cartão, Pix e boleto.
                </p>

                <Button
                  onClick={handlePayWithMercadoPago}
                  disabled={isCreatingPayment}
                  className="w-full"
                  size="lg"
                >
                  {isCreatingPayment ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando link...</>
                  ) : (
                    <>
                      Pagar com Mercado Pago
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Pagamento 100% seguro. Seus dados são protegidos.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

// Step indicator component
function StepIndicator({ step, current, label, icon }: { step: CheckoutStep; current: CheckoutStep; label: string; icon: React.ReactNode }) {
  const steps: CheckoutStep[] = ["profile", "delivery", "review", "payment"];
  const currentIdx = steps.indexOf(current);
  const stepIdx = steps.indexOf(step);
  const isActive = step === current;
  const isCompleted = stepIdx < currentIdx;

  return (
    <div className={`flex flex-col items-center gap-1 ${isActive ? "text-primary" : isCompleted ? "text-primary/70" : "text-muted-foreground"}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isActive ? "bg-primary text-primary-foreground" : isCompleted ? "bg-primary/20" : "bg-muted"}`}>
        {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : icon}
      </div>
      <span className="text-xs">{label}</span>
    </div>
  );
}

export default Checkout;
