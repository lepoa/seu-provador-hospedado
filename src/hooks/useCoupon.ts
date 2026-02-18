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
  // Birthday coupon fields
  isBirthdayCoupon?: boolean;
  birthdayDiscountId?: string;
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
      const normalizedCode = code.toUpperCase().trim();

      // First, try regular coupons table
      const { data, error: fetchError } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", normalizedCode)
        .eq("is_active", true)
        .maybeSingle();

      if (fetchError) throw fetchError;

      // If not found in regular coupons, check birthday discounts
      if (!data) {
        const birthdayResult = await tryBirthdayCoupon(normalizedCode, orderTotal);
        if (birthdayResult) return true;

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

  // Check birthday_discounts table for ANIVER- coupons
  const tryBirthdayCoupon = async (code: string, orderTotal: number): Promise<boolean> => {
    try {
      const { data: bd, error: bdError } = await supabase
        .from("birthday_discounts")
        .select("id, coupon_code, discount_percent, used_at, expires_at, user_id")
        .eq("coupon_code", code)
        .maybeSingle();

      if (bdError || !bd) return false;

      // Already used
      if (bd.used_at) {
        setError("Este cupom de aniversário já foi utilizado");
        return false;
      }

      // Expired
      if (bd.expires_at && new Date(bd.expires_at) < new Date()) {
        setError("Este cupom de aniversário expirou");
        return false;
      }

      // Check that the coupon belongs to the logged-in user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== bd.user_id) {
        setError("Este cupom pertence a outra conta");
        return false;
      }

      const discount = orderTotal * (bd.discount_percent / 100);

      const birthdayCoupon: Coupon = {
        id: bd.id,
        code: bd.coupon_code,
        discount_type: "percentage",
        discount_value: bd.discount_percent,
        starts_at: null,
        ends_at: bd.expires_at,
        max_uses: 1,
        times_used: 0,
        min_order_value: null,
        is_active: true,
        isBirthdayCoupon: true,
        birthdayDiscountId: bd.id,
      };

      setCoupon(birthdayCoupon);
      setDiscountAmount(discount);
      toast.success(
        `🎂 Cupom de aniversário aplicado! ${bd.discount_percent}% de desconto (R$ ${discount.toFixed(2)})`
      );
      return true;
    } catch (err) {
      console.error("Error checking birthday coupon:", err);
      return false;
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
  discountApplied: number,
  isBirthdayCoupon?: boolean
): Promise<void> {
  try {
    if (isBirthdayCoupon) {
      // Mark birthday discount as used
      await supabase
        .from("birthday_discounts")
        .update({ used_at: new Date().toISOString(), order_id: orderId })
        .eq("id", couponId);
      return;
    }

    // Regular coupon: insert usage record
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
