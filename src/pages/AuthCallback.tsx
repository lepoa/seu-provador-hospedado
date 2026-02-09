import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Exchange the code in the URL for a session
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) {
          console.error("OAuth callback error:", error);
          navigate("/entrar", { replace: true });
          return;
        }

        // Determine where to redirect
        const returnTo = sessionStorage.getItem("oauth_return_to");
        sessionStorage.removeItem("oauth_return_to");
        navigate(returnTo || "/minha-conta", { replace: true });
      } catch (err) {
        console.error("OAuth callback exception:", err);
        navigate("/entrar", { replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
        <p className="text-muted-foreground text-sm">Finalizando login...</p>
      </div>
    </div>
  );
}
