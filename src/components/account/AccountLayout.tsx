import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Crown,
  Target,
  Sparkles,
  Heart,
  Camera,
  User,
  ChevronRight,
  Home,
  ShoppingBag,
  LogOut,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  description?: string;
  highlight?: boolean;
}

const accountNavItems: NavItem[] = [
  {
    label: "Visão Geral",
    href: "/minha-conta",
    icon: LayoutDashboard,
    description: "Seu resumo",
  },
  {
    label: "Meus Pedidos",
    href: "/meus-pedidos",
    icon: Package,
    description: "Acompanhe suas compras",
  },
  {
    label: "Le.Poá Club",
    href: "/minha-conta/club",
    icon: Crown,
    description: "Pontos & Recompensas",
    highlight: true,
  },
  {
    label: "Módulos de Estilo",
    href: "/minha-conta/missoes",
    icon: Target,
    description: "Refine seu perfil",
  },
  {
    label: "Meu Estilo",
    href: "/meu-estilo",
    icon: Sparkles,
    description: "Quiz & Preferências",
  },
  {
    label: "Sugestões",
    href: "/minhas-sugestoes",
    icon: Heart,
    description: "Looks para você",
  },
  {
    label: "Meus Prints",
    href: "/meus-prints",
    icon: Camera,
    description: "Fotos enviadas",
  },
  {
    label: "Perfil",
    href: "/meu-perfil",
    icon: User,
    description: "Dados e endereços",
  },
];

// Bottom nav items for mobile
const bottomNavItems = [
  { label: "Início", href: "/", icon: Home },
  { label: "Catálogo", href: "/catalogo", icon: ShoppingBag },
  { label: "Club", href: "/minha-conta/club", icon: Crown },
  { label: "Conta", href: "/minha-conta", icon: User },
];

interface AccountLayoutProps {
  children: ReactNode;
  title?: string;
  showBackButton?: boolean;
}

export function AccountLayout({ children, title, showBackButton }: AccountLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Até logo!");
    navigate("/");
  };

  // Desktop layout with sidebar
  if (!isMobile) {
    return (
      <div className="min-h-screen bg-[#f8f3e8]">
        <Header />

        <div className="container mx-auto px-4 py-8">
          <div className="mx-auto flex max-w-6xl gap-8">
            {/* Sidebar */}
            <aside className="w-64 shrink-0">
              <div className="sticky top-24 rounded-2xl border border-[#ccb487]/45 bg-[#fffaf0] p-4 shadow-[0_8px_24px_rgba(16,37,31,0.08)]">
                {/* User greeting */}
                <div className="mb-6 px-2">
                  <p className="text-sm font-medium text-[#7d7568]">Olá,</p>
                  <p className="truncate font-serif text-lg text-[#13261f]">{user?.email?.split("@")[0]}</p>
                </div>

                {/* Navigation */}
                <nav className="space-y-1">
                  {accountNavItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                          "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                          isActive
                            ? "bg-[#15251f] text-[#f5e8c8]"
                            : "text-[#292823] hover:bg-[#f0e5cc]",
                          item.highlight && !isActive && "text-[#a37d38]"
                        )}
                      >
                        <Icon className={cn(
                          "h-5 w-5 shrink-0",
                          item.highlight && !isActive && "text-[#a37d38]"
                        )} />
                        <span className="font-medium">{item.label}</span>
                        <ChevronRight className={cn(
                          "h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity",
                          isActive && "opacity-100"
                        )} />
                      </Link>
                    );
                  })}
                </nav>

                {/* Logout */}
                <div className="mt-8 border-t border-[#ccb487]/45 pt-6">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-[#6f6759] hover:bg-[#f0e5cc] hover:text-[#3f392e]"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-5 w-5 mr-3" />
                    Sair da conta
                  </Button>
                </div>
              </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 min-w-0">
              {title && (
                <h1 className="mb-6 font-serif text-2xl text-[#13261f]">{title}</h1>
              )}
              {children}
            </main>
          </div>
        </div>
      </div>
    );
  }

  // Mobile layout with bottom nav
  return (
    <div className="min-h-screen bg-[#f8f3e8] pb-20">
      <Header />

      <main className="container mx-auto px-4 py-6">
        {showBackButton && (
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-1 text-sm text-[#746d61]"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            Voltar
          </button>
        )}
        {title && (
          <h1 className="mb-5 font-serif text-xl text-[#13261f]">{title}</h1>
        )}
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#ccb487]/45 bg-[#fffaf0]/98 backdrop-blur">
        <div className="flex items-center justify-around h-16">
          {bottomNavItems.map((item) => {
            const isActive = location.pathname === item.href ||
              (item.href !== "/" && location.pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-4 py-2 min-w-[64px]",
                  isActive ? "text-[#13261f]" : "text-[#7a725f]"
                )}
              >
                <Icon className={cn(
                  "h-5 w-5",
                  item.href === "/minha-conta/club" && "text-[#a37d38]"
                )} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
