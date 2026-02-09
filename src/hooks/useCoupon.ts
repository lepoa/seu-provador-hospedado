import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Coupon {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  times_used: number;
  min_order_value: number | null;
  is_active: boolean;
}

interface UseCouponResult {
  coupon: Coupon | null;
  isLoading: boolean;
  error: string | null;
  discountAmount: number;
  applyCoupon: (code: string, orderTotal: number) => Promise<boolean>;
  removeCoupon: () => void;
  calculateDiscount: (total: number) => number;
}

export function useCoupon(): UseCouponResult {
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  const calculateDiscount = (total: number): number => {
    if (!coupon) return 0;

    if (coupon.discount_type === "percentage") {
      return total * (coupon.discount_value / 100);
    } else {
      return Math.min(coupon.discount_value, total);
    }
  };

  const applyCoupon = async (code: string, orderTotal: number): Promise<boolean> => {
    if (!code.trim()) {
      setError("Digite um código de cupom");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", code.toUpperCase().trim())
        .eq("is_active", true)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        setError("Cupom não encontrado ou inativo");
        setCoupon(null);
        setDiscountAmount(0);
        return false;
      }

      const couponData = data as Coupon;
      const now = new Date();

      // Check date validity
      if (couponData.starts_at && new Date(couponData.starts_at) > now) {
        setError("Este cupom ainda não está disponível");
        return false;
      }

      if (couponData.ends_at && new Date(couponData.ends_at) < now) {
        setError("Este cupom expirou");
        return false;
      }

      // Check usage limit
      if (couponData.max_uses && couponData.times_used >= couponData.max_uses) {
        setError("Este cupom atingiu o limite de usos");
        return false;
      }

      // Check minimum order value
      if (couponData.min_order_value && orderTotal < couponData.min_order_value) {
        setError(
          `Pedido mínimo de R$ ${couponData.min_order_value.toFixed(2)} para este cupom`
        );
        return false;
      }

      setCoupon(couponData);
      const discount =
        couponData.discount_type === "percentage"
          ? orderTotal * (couponData.discount_value / 100)
          : Math.min(couponData.discount_value, orderTotal);
      
      setDiscountAmount(discount);
      toast.success(`Cupom aplicado! Desconto de R$ ${discount.toFixed(2)}`);
      return true;
    } catch (err) {
      console.error("Error applying coupon:", err);
      setError("Erro ao validar cupom");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const removeCoupon = () => {
    setCoupon(null);
    setDiscountAmount(0);
    setError(null);
  };

  return {
    coupon,
    isLoading,
    error,
    discountAmount,
    applyCoupon,
    removeCoupon,
    calculateDiscount,
  };
}

export async function recordCouponUse(
  couponId: string,
  orderId: string | null,
  liveCartId: string | null,
  discountApplied: number
): Promise<void> {
  try {
    // Insert usage record
    await supabase.from("coupon_uses").insert({
      coupon_id: couponId,
      order_id: orderId,
      live_cart_id: liveCartId,
      discount_applied: discountApplied,
    });

    // Increment times_used directly
    const { data: currentCoupon } = await supabase
      .from("coupons")
      .select("times_used")
      .eq("id", couponId)
      .single();
    
    if (currentCoupon) {
      await supabase
        .from("coupons")
        .update({ times_used: (currentCoupon.times_used || 0) + 1 })
        .eq("id", couponId);
    }
  } catch (err) {
    console.error("Error recording coupon use:", err);
  }
}
