import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BirthdayMember {
    userId: string;
    email: string;
    name: string;
    birthDate: string;
    whatsapp: string | null;
    tier: string;
    discountPercent: number | null;
    couponCode: string | null;
    notifiedAt: string | null;
    renotifiedAt: string | null;
    usedAt: string | null;
    orderId: string | null;
    discountId: string | null;
}

type StatusFilter = "all" | "not_notified" | "notified_not_used" | "used" | "renotified";

export function useBirthdayAdmin() {
    const [members, setMembers] = useState<BirthdayMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

    const fetchMembers = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.rpc("get_birthday_members_of_month", {
                p_month: selectedMonth,
            });

            if (error) {
                console.error("Error fetching birthday members:", error);
                setMembers([]);
            } else {
                setMembers(
                    (data || []).map((row: any) => ({
                        userId: row.user_id,
                        email: row.user_email,
                        name: row.user_name || row.user_email?.split("@")[0] || "—",
                        birthDate: row.birth_date,
                        whatsapp: row.whatsapp,
                        tier: row.tier || "poa",
                        discountPercent: row.discount_percent,
                        couponCode: row.coupon_code,
                        notifiedAt: row.notified_at,
                        renotifiedAt: row.renotified_at,
                        usedAt: row.used_at,
                        orderId: row.order_id,
                        discountId: row.discount_id,
                    }))
                );
            }
        } catch (err) {
            console.error("Birthday admin error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [selectedMonth]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    const markNotified = useCallback(
        async (discountId: string, isRenotify = false) => {
            const { error } = await supabase.rpc("mark_birthday_notified", {
                p_discount_id: discountId,
                p_is_renotify: isRenotify,
            });
            if (error) throw error;
            await fetchMembers();
        },
        [fetchMembers]
    );

    // Generate or ensure a discount exists for a user (for the current month)
    const ensureDiscount = useCallback(
        async (userId: string) => {
            const { data, error } = await supabase.rpc("get_or_create_birthday_discount", {
                p_user_id: userId,
            });
            if (error) throw error;
            await fetchMembers();
            return data?.[0];
        },
        [fetchMembers]
    );

    // Filter members based on status
    const filteredMembers = members.filter((m) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "not_notified") return !m.notifiedAt && !m.usedAt;
        if (statusFilter === "notified_not_used") return m.notifiedAt && !m.usedAt;
        if (statusFilter === "used") return !!m.usedAt;
        if (statusFilter === "renotified") return !!m.renotifiedAt && !m.usedAt;
        return true;
    });

    // Stats
    const stats = {
        total: members.length,
        notNotified: members.filter((m) => !m.notifiedAt && !m.usedAt).length,
        notifiedNotUsed: members.filter((m) => m.notifiedAt && !m.usedAt).length,
        used: members.filter((m) => !!m.usedAt).length,
    };

    return {
        members: filteredMembers,
        allMembers: members,
        isLoading,
        selectedMonth,
        setSelectedMonth,
        statusFilter,
        setStatusFilter,
        stats,
        markNotified,
        ensureDiscount,
        refetch: fetchMembers,
    };
}
