import { useState } from "react";
import {
  BadgeCheck,
  Brain,
  Crown,
  FileSpreadsheet,
  Gift,
  Image,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Radio,
  ShoppingBag,
  Sparkles,
  Tag,
  Ticket,
  UserCheck,
  UsersRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import logoLepoa from "@/assets/logo-lepoa.png";

interface DashboardMobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  onImportStock: () => void;
  printCount: number;
}

const navItems = [
  { value: "overview", label: "Visão Geral", icon: LayoutDashboard },
  { value: "clientes", label: "Clientes", icon: UserCheck },
  { value: "products", label: "Produtos", icon: Package },
  { value: "categories", label: "Categorias", icon: BadgeCheck },
  { value: "orders", label: "Pedidos", icon: ShoppingBag },
  { value: "lives", label: "Lives", icon: Radio },
  { value: "cupons", label: "Cupons", icon: Ticket },
  { value: "promocoes", label: "Promoções", icon: Tag },
  { value: "brindes", label: "Brindes", icon: Gift },
  { value: "club", label: "Le.Poá Club", icon: Crown },
  { value: "rfv", label: "RFV", icon: Brain },
  { value: "consultora", label: "Consultoria IA", icon: Sparkles },
  { value: "equipe", label: "Equipe", icon: UsersRound },
  { value: "prints", label: "Prints", icon: Image, showCount: true },
];

export function DashboardMobileNav({
  activeTab,
  onTabChange,
  onLogout,
  onImportStock,
  printCount,
}: DashboardMobileNavProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (value: string) => {
    onTabChange(value);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0 md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Menu</span>
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-[min(92vw,320px)] overflow-hidden border-r border-[#d0b06b55] bg-[#102820] p-0">
        <SheetHeader className="shrink-0 border-b border-[#d0b06b44] p-4">
          <div className="flex items-center justify-between gap-2">
            <img src={logoLepoa} alt="Le.Poá" className="h-8 max-w-[120px] object-contain" />
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="shrink-0">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        <nav className="flex h-[calc(100vh-80px)] flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleSelect(item.value)}
                  className={cn(
                    "flex min-h-[48px] w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                    "hover:bg-[#17362d] active:bg-[#193d32]",
                    isActive && "border-r-2 border-[#d4b26f] bg-[#17362d] text-[#f4e8c9]"
                  )}
                >
                  <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-[#f0dfb2]" : "text-[#bfae8b]")} />
                  <span className={cn("flex-1 truncate text-sm font-medium text-[#d6cab1]", isActive && "text-[#f4e8c9]")}>{item.label}</span>

                  {item.showCount && printCount > 0 ? (
                    <span className="shrink-0 rounded-full border border-[#d4b26f66] bg-[#1a3a31] px-2 py-0.5 text-xs text-[#e8d7ad]">
                      {printCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="space-y-2 border-t border-[#d0b06b44] p-4">
            <Button
              variant="outline"
              size="sm"
              className="h-11 w-full justify-start gap-2 border-[#c8aa6a] bg-[#f6edd8] text-[#2a2a2a] hover:border-[#b59657] hover:bg-[#f3e7ca]"
              onClick={() => {
                onImportStock();
                setOpen(false);
              }}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Importar Estoque
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-11 w-full justify-start gap-2 text-[#d6cab1] hover:bg-[#17362d] hover:text-[#f4e8c9]"
              onClick={() => {
                onLogout();
                setOpen(false);
              }}
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
