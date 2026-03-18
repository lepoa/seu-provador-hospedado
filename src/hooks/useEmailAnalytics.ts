import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CampaignAnalytics {
    id: string;
    subject: string;
    segment: string;
    sent_count: number;
    created_at: string;
    tracking_id: string | null;
    opens: number;
    clicks: number;
    open_rate: number;
    click_rate: number;
}

export interface EmailAnalyticsSummary {
    totalSent: number;
    totalOpens: number;
    totalClicks: number;
    avgOpenRate: number;
    campaigns: CampaignAnalytics[];
}

export function useEmailAnalytics() {
    return useQuery({
        queryKey: ["email_analytics"],
        queryFn: async (): Promise<EmailAnalyticsSummary> => {
            // Fetch campaigns
            const { data: campaigns, error: campError } = await supabase
                .from("email_campaigns")
                .select("id, subject, segment, sent_count, created_at, tracking_id")
                .order("created_at", { ascending: false });
            if (campError) throw campError;

            // Fetch events grouped by campaign
            const { data: events, error: evtError } = await supabase
                .from("email_events")
                .select("campaign_id, event");
            if (evtError) throw evtError;

            // Build per-campaign event counts
            const eventMap: Record<string, { opens: number; clicks: number }> = {};
            for (const evt of events ?? []) {
                if (!eventMap[evt.campaign_id]) eventMap[evt.campaign_id] = { opens: 0, clicks: 0 };
                if (evt.event === "open") eventMap[evt.campaign_id].opens++;
                if (evt.event === "click") eventMap[evt.campaign_id].clicks++;
            }

            const enriched: CampaignAnalytics[] = (campaigns ?? []).map((c: any) => {
                const evts = eventMap[c.id] ?? { opens: 0, clicks: 0 };
                const sent = c.sent_count || 0;
                return {
                    ...c,
                    opens: evts.opens,
                    clicks: evts.clicks,
                    open_rate: sent > 0 ? Math.round((evts.opens / sent) * 100) : 0,
                    click_rate: sent > 0 ? Math.round((evts.clicks / sent) * 100) : 0,
                };
            });

            const totalSent = enriched.reduce((s, c) => s + c.sent_count, 0);
            const totalOpens = enriched.reduce((s, c) => s + c.opens, 0);
            const totalClicks = enriched.reduce((s, c) => s + c.clicks, 0);
            const avgOpenRate = totalSent > 0 ? Math.round((totalOpens / totalSent) * 100) : 0;

            return { totalSent, totalOpens, totalClicks, avgOpenRate, campaigns: enriched };
        },
        refetchInterval: 30_000, // refresh every 30s
    });
}
