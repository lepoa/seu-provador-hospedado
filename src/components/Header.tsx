import { Link } from "react-router-dom";
import { Menu, User, MessageCircle } from "lucide-react";
import logoLepoa from "@/assets/logo-lepoa.png";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CartButton } from "@/components/CartButton";
import { buildWhatsAppLink, buildDefaultContactMessage } from "@/lib/whatsappHelpers";

interface HeaderProps {
  showCart?: boolean;
}

export function Header({ showCart = true }: HeaderProps) {
  const whatsAppUrl = buildWhatsAppLink(buildDefaultContactMessage());

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center shrink-0">
          <img 
            src={logoLepoa} 
            alt="LE.POÁ" 
            className="h-7 sm:h-10 w-auto max-w-[100px] sm:max-w-none"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-4 lg:gap-6 flex-wrap">
          <Link to="/catalogo" className="text-sm font-medium hover:text-accent transition-colors whitespace-nowrap">
            Catálogo completo
          </Link>
          <Link to="/meu-estilo" className="text-sm font-medium hover:text-accent transition-colors whitespace-nowrap">
            Meu estilo
          </Link>
          <Link to="/enviar-print" className="text-sm font-medium hover:text-accent transition-colors whitespace-nowrap">
            Buscar por foto
          </Link>
          {showCart && <CartButton />}
          <Button variant="ghost" size="sm" className="gap-2 text-green-600 hover:text-green-700 hover:bg-green-50 whitespace-nowrap" asChild>
            <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Fale com a gente
            </a>
          </Button>
          <Link to="/minha-conta">
            <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap">
              <User className="h-4 w-4" />
              Minha Conta
            </Button>
          </Link>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2 md:hidden">
          {showCart && <CartButton />}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(92vw,320px)] p-0 overflow-hidden">
              <nav className="flex flex-col gap-1 pt-12 px-4 h-full overflow-y-auto">
                <Link to="/catalogo" className="text-base font-medium py-3 hover:text-accent transition-colors border-b">
                  Catálogo completo
                </Link>
                <Link to="/meu-estilo" className="text-base font-medium py-3 hover:text-accent transition-colors border-b">
                  Meu estilo
                </Link>
                <Link to="/enviar-print" className="text-base font-medium py-3 hover:text-accent transition-colors border-b">
                  Buscar por foto
                </Link>
                <Link to="/carrinho" className="text-base font-medium py-3 hover:text-accent transition-colors border-b">
                  Meu Carrinho
                </Link>
                <a
                  href={whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-base font-medium py-3 text-green-600 hover:text-green-700 transition-colors border-b"
                >
                  <MessageCircle className="h-5 w-5 shrink-0" />
                  Fale com a gente
                </a>
                <Link to="/minha-conta" className="mt-6">
                  <Button className="w-full gap-2 h-11">
                    <User className="h-4 w-4" />
                    Minha Conta
                  </Button>
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
