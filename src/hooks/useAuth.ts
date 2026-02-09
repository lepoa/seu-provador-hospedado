import { useState, useEffect, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "customer" | "merchant" | "admin" | "seller";

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  rolesLoading: boolean;
  roles: AppRole[];
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    rolesLoading: true,
    roles: [],
  });

  const fetchRoles = useCallback(async (userId: string) => {
    setAuthState(prev => ({ ...prev, rolesLoading: true }));
    
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (!error && data) {
      setAuthState(prev => ({
        ...prev,
        roles: data.map(r => r.role as AppRole),
        rolesLoading: false,
      }));
    } else {
      console.error("Error fetching roles:", error);
      setAuthState(prev => ({ ...prev, rolesLoading: false }));
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setAuthState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
          isLoading: false,
        }));

        // Fetch roles after auth state changes (deferred)
        if (session?.user) {
          setTimeout(() => {
            fetchRoles(session.user.id);
          }, 0);
        } else {
          setAuthState(prev => ({ ...prev, roles: [], rolesLoading: false }));
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
        isLoading: false,
      }));

      if (session?.user) {
        fetchRoles(session.user.id);
      } else {
        setAuthState(prev => ({ ...prev, rolesLoading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchRoles]);

  const hasRole = useCallback((role: AppRole): boolean => {
    return authState.roles.includes(role);
  }, [authState.roles]);

  const isMerchant = useCallback((): boolean => {
    return hasRole("merchant") || hasRole("admin");
  }, [hasRole]);

  const isAdmin = useCallback((): boolean => {
    return hasRole("admin");
  }, [hasRole]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    ...authState,
    hasRole,
    isMerchant,
    isAdmin,
    signOut,
  };
}
