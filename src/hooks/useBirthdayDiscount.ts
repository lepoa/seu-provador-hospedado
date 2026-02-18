import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface BirthdayDiscount {
    discountId: string;
    discountPercent: number;
    couponCode: string;
    usedAt: string | null;
    expiresAt: string;
}

/**
 * Hook to check if the current user has a birthday discount available.
 * 
 * - Returns null if no discount (not birthday month, no birth_date set, etc.)
 * - Returns the discount details if available
 * - `isUsed` is true if the discount was already used this year
 */
export function useBirthdayDiscount() {
    const { user } = useAuth();
    const [discount, setDiscount] = useState<BirthdayDiscount | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchDiscount = useCallback(async () => {
        if (!user) {
            setDiscount(null);
            setIsLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase.rpc("get_or_create_birthday_discount", {
                p_user_id: user.id,
            });

            if (error) {
                console.error("Error fetching birthday discount:", error);
                setDiscount(null);
            } else if (data && data.length > 0) {
                const row = data[0];
                setDiscount({
                    discountId: row.discount_id,
                    discountPercent: row.discount_percent,
                    couponCode: row.coupon_code,
                    usedAt: row.used_at,
                    expiresAt: row.expires_at,
                });
            } else {
                setDiscount(null);
            }
        } catch (err) {
            console.error("Birthday discount error:", err);
            setDiscount(null);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchDiscount();
    }, [fetchDiscount]);

    const isUsed = discount?.usedAt !== null && discount?.usedAt !== undefined;
    const hasDiscount = discount !== null && !isUsed;

    return {
        discount,
        hasDiscount,
        isUsed,
        isLoading,
        refetch: fetchDiscount,
    };
}

// Tier discount percentages (used across the app)
export const BIRTHDAY_DISCOUNT_BY_TIER: Record<string, number> = {
    poa: 5,
    poa_gold: 10,
    poa_platinum: 15,
    poa_black: 20,
};

export function getBirthdayDiscountForTier(tier: string): number {
    return BIRTHDAY_DISCOUNT_BY_TIER[tier] || 5;
}
