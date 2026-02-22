import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useAnalytics() {
    const { user } = useAuth();

    const trackEvent = async (eventName: string, metadata: any = {}) => {
        try {
            // Get or create a session ID for anonymous users
            let sessionId = localStorage.getItem("analytics_session_id");
            if (!sessionId) {
                sessionId = crypto.randomUUID();
                localStorage.setItem("analytics_session_id", sessionId);
            }

            await (supabase.from("analytics_events") as any).insert({
                event_name: eventName,
                user_id: user?.id || null,
                session_id: sessionId,
                metadata: metadata
            });
        } catch (err) {
            console.error("Failed to track event:", err);
        }
    };

    return { trackEvent };
}
