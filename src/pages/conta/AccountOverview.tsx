import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Loader2, Package, Target } from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { LoyaltyClubCard } from "@/components/account/LoyaltyClubCard";
import { QuickActionCard } from "@/components/account/QuickActionCard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function AccountOverview() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [lastOrder, setLastOrder] = useState<{ id: string; status: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/minha-conta/auth");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) {
      supabase
        .from("orders")
        .select("id, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          setLastOrder(data);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [user]);

  const getOrderStatus = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "success" | "warning" | "muted" }> = {
      pendente: { label: "Aguardando pagamento", variant: "warning" },
      pago: { label: "Pago", variant: "success" },
      preparar_envio: { label: "Em preparação", variant: "default" },
      postado: { label: "Enviado", variant: "success" },
      entregue: { label: "Entregue", variant: "muted" },
    };
    return statusMap[status] || { label: status, variant: "muted" as const };
  };

  if (loading) {
    return (
      <AccountLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#6f6759]" />
        </div>
      </AccountLayout>
    );
  }

  return (
    <AccountLayout>
      <div className="mb-6 rounded-2xl border border-[#ccb487]/45 bg-[#fffaf0] p-5 shadow-sm">
        <h1 className="mb-1 font-serif text-2xl text-[#13261f]">Olá! 👋</h1>
        <p className="text-sm font-medium text-[#6f6759]">Bem-vinda ao seu espaço Le.Poá</p>
      </div>

      <div className="mb-6">
        <LoyaltyClubCard variant="full" />
      </div>

      <div className="space-y-3">
        <QuickActionCard
          title="Meus Pedidos"
          description={lastOrder ? "Acompanhe seu último pedido" : "Você ainda não fez pedidos"}
          href="/meus-pedidos"
          icon={Package}
          status={lastOrder ? getOrderStatus(lastOrder.status) : undefined}
        />

        <QuickActionCard
          title="Missões do Dia"
          description="Responda perguntas e ganhe pontos"
          href="/minha-conta/missoes"
          icon={Target}
          badge="Novo"
          highlight
        />

        <QuickActionCard
          title="Meus Favoritos"
          description="Produtos que você amou"
          href="/meus-favoritos"
          icon={Heart}
          highlight
        />

        <QuickActionCard
          title="Sugestões pra Você"
          description="Looks personalizados para seu estilo"
          href="/minhas-sugestoes"
          icon={Target}
        />
      </div>
    </AccountLayout>
  );
}
