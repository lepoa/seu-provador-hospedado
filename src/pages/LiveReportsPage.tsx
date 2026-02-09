import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LiveReportsV2 } from "@/components/live-shop/LiveReportsV2";
import { supabase } from "@/integrations/supabase/client";

export default function LiveReportsPage() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [isLoading, setIsLoading] = useState(true);

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

      setIsLoading(false);
    };

    checkAuth();
  }, [navigate]);

  if (isLoading) {
    return null;
  }

  return <LiveReportsV2 />;
}
