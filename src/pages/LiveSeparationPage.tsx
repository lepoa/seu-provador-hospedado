import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package } from "lucide-react";
import { LiveSeparation } from "@/components/live-shop/LiveSeparation";

export default function LiveSeparationPage() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [eventTitle, setEventTitle] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      const hasAccess = roles?.some(r => 
        ['merchant', 'admin'].includes(r.role)
      );

      if (!hasAccess) {
        navigate("/");
        return;
      }

      // Fetch event title
      if (eventId) {
        const { data: event } = await supabase
          .from("live_events")
          .select("titulo")
          .eq("id", eventId)
          .single();
        
        if (event) {
          setEventTitle(event.titulo);
        }
      }

      setIsLoading(false);
    };

    checkAuth();
  }, [navigate, eventId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Package className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/dashboard/lives/${eventId}/backstage`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Separação (Pós-Live)</h1>
          </div>
          {eventTitle && (
            <span className="text-sm text-muted-foreground hidden sm:block">
              — {eventTitle}
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="container px-4 py-6">
        <LiveSeparation eventId={eventId} eventTitle={eventTitle} />
      </main>
    </div>
  );
}
