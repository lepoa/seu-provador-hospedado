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
      <div className="min-h-screen bg-background">
        <Header />

        <div className="container mx-auto px-4 py-8">
          <div className="flex gap-8 max-w-6xl mx-auto">
            {/* Sidebar */}
            <aside className="w-64 shrink-0">
              <div className="sticky top-24">
                {/* User greeting */}
                <div className="mb-6 px-2">
                  <p className="text-sm text-muted-foreground">Olá,</p>
                  <p className="font-serif text-lg truncate">{user?.email?.split("@")[0]}</p>
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
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-secondary text-foreground",
                          item.highlight && !isActive && "text-accent"
                        )}
                      >
                        <Icon className={cn(
                          "h-5 w-5 shrink-0",
                          item.highlight && !isActive && "text-accent"
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
                <div className="mt-8 pt-6 border-t">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground hover:text-destructive"
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
                <h1 className="font-serif text-2xl mb-6">{title}</h1>
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
    <div className="min-h-screen bg-background pb-20">
      <Header />

      <main className="container mx-auto px-4 py-6">
        {showBackButton && (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-muted-foreground mb-4 text-sm"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            Voltar
          </button>
        )}
        {title && (
          <h1 className="font-serif text-xl mb-5">{title}</h1>
        )}
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
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
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className={cn(
                  "h-5 w-5",
                  item.href === "/minha-conta/club" && "text-accent"
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
