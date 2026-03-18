import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { marketingBaseEmail } from "@/emails/marketingBaseEmail";

export type CampaignSegment = "all" | "with_orders" | "without_orders";

export interface EmailCampaign {
    id: string;
    subject: string;
    content: string;
    segment: CampaignSegment;
    sent_count: number;
    created_at: string;
}

export interface CreateCampaignParams {
    subject: string;
    content: string;
    segment: CampaignSegment;
    ctaText?: string;
    ctaUrl?: string;
}

// ─── Queries ────────────────────────────────────────────────────────────────

export function useEmailCampaigns() {
    return useQuery({
        queryKey: ["email_campaigns"],
        queryFn: async (): Promise<EmailCampaign[]> => {
            const { data, error } = await supabase
                .from("email_campaigns")
                .select("*")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return (data ?? []) as EmailCampaign[];
        },
    });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchEmailsBySegment(segment: CampaignSegment): Promise<string[]> {
    // Fetch all user emails from server (needs SUPABASE_SERVICE_KEY)
    const res = await fetch("/api/get-all-user-emails", { method: "GET" });
    if (!res.ok) {
        throw new Error("Não foi possível buscar os emails dos usuários. Verifique se o server.js está rodando com SUPABASE_SERVICE_KEY configurado.");
    }
    const { emails: allEmails = [] } = await res.json();
    const allEmailsSet: string[] = [...new Set(allEmails as string[])];

    if (segment === "all") {
        return allEmailsSet;
    }

    // For with_orders / without_orders: get user_ids that have orders
    const { data: ordersWithUsers } = await supabase
        .from("orders")
        .select("customer_id")
        .not("customer_id", "is", null);

    const customerIds = new Set(
        (ordersWithUsers ?? []).map((o: { customer_id: string }) => o.customer_id).filter(Boolean)
    );

    // Map user_id → email via the full user list from server
    const resDetails = await fetch("/api/get-all-user-emails?details=true", { method: "GET" });
    let idToEmail: Record<string, string> = {};
    if (resDetails.ok) {
        const { users = [] } = await resDetails.json();
        for (const u of users as { id: string; email: string }[]) {
            if (u.email) idToEmail[u.id] = u.email;
        }
    }

    if (segment === "with_orders") {
        // Emails of users who placed at least one order
        const withOrderEmails = new Set(
            Array.from(customerIds).map((id) => idToEmail[id]).filter(Boolean)
        );
        return allEmailsSet.filter((e) => withOrderEmails.has(e));
    }

    if (segment === "without_orders") {
        const withOrderEmails = new Set(
            Array.from(customerIds).map((id) => idToEmail[id]).filter(Boolean)
        );
        return allEmailsSet.filter((e) => !withOrderEmails.has(e));
    }

    return allEmailsSet;
}


// ─── Mutation ────────────────────────────────────────────────────────────────

export function useSendCampaign() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: CreateCampaignParams) => {
            const { subject, content, segment, ctaText, ctaUrl } = params;

            // 1. Fetch emails for segment
            const emails = await fetchEmailsBySegment(segment);
            if (emails.length === 0) {
                throw new Error("Nenhum email encontrado para o segmento selecionado.");
            }

            // 2. Build HTML
            const html = marketingBaseEmail({ subject, content, ctaText, ctaUrl });

            // 3. Generate tracking_id for this campaign
            const tracking_id = crypto.randomUUID();

            // 4. Send in batch via server endpoint
            const response = await fetch("/api/send-email-batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ emails, subject, html, tracking_id }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err?.error || "Erro ao enviar campanha.");
            }

            const result = await response.json();

            // 5. Save campaign record with tracking_id
            await supabase.from("email_campaigns").insert({
                subject,
                content,
                segment,
                sent_count: result.sent ?? emails.length,
                tracking_id,
            });

            return { sent: result.sent ?? emails.length, total: emails.length };

        },
        onSuccess: (data) => {
            toast.success(`Campanha enviada para ${data.sent} destinatários!`);
            queryClient.invalidateQueries({ queryKey: ["email_campaigns"] });
        },
        onError: (err: Error) => {
            toast.error(err.message || "Erro ao enviar campanha.");
        },
    });
}
