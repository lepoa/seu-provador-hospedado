import { useState } from "react";
import {
  LayoutDashboard,
  UserCheck,
  Package,
  ShoppingBag,
  Radio,
  Ticket,
  Gift,
  Crown,
  UsersRound,
  Image,
  Menu,
  X,
  LogOut,
  FileSpreadsheet,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
  { value: "orders", label: "Pedidos", icon: ShoppingBag },
  { value: "lives", label: "Lives", icon: Radio },
  { value: "cupons", label: "Cupons", icon: Ticket },
  { value: "promocoes", label: "Promoções", icon: Tag },
  { value: "brindes", label: "Brindes", icon: Gift },
  { value: "club", label: "Le.Poá Club", icon: Crown },
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

  const activeItem = navItems.find((item) => item.value === activeTab);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden shrink-0">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(92vw,320px)] p-0 overflow-hidden">
        <SheetHeader className="p-4 border-b shrink-0">
          <div className="flex items-center justify-between gap-2">
            <img src={logoLepoa} alt="LE.POÁ" className="h-8 max-w-[120px] object-contain" />
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="shrink-0">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>
        
        <nav className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">
          <div className="flex-1 overflow-y-auto py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.value;
              
              return (
                <button
                  key={item.value}
                  onClick={() => handleSelect(item.value)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                    "hover:bg-muted/50 active:bg-muted",
                    "min-h-[48px]", // 44px+ touch target
                    isActive && "bg-primary/5 text-primary border-r-2 border-primary"
                  )}
                >
                  <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn("text-sm font-medium truncate flex-1", isActive && "text-primary")}>
                    {item.label}
                  </span>
                  {item.showCount && printCount > 0 && (
                    <span className="shrink-0 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      {printCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Bottom actions */}
          <div className="border-t p-4 space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 h-11"
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
              className="w-full justify-start gap-2 h-11 text-muted-foreground"
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
