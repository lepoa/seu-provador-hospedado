import { Link } from "react-router-dom";
import { Menu, MessageCircle, User } from "lucide-react";
import logoLepoa from "@/assets/logo-lepoa.png";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CartButton } from "@/components/CartButton";
import { buildDefaultContactMessage, buildWhatsAppLink } from "@/lib/whatsappHelpers";

interface HeaderProps {
  showCart?: boolean;
}

export function Header({ showCart = true }: HeaderProps) {
  const whatsAppUrl = buildWhatsAppLink(buildDefaultContactMessage());

  return (
    <header className="sticky top-0 z-50 border-b border-[#c8ad76]/45 bg-[#f9f4ea]/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:h-16 sm:px-4">
        <Link to="/" className="flex shrink-0 items-center">
          <img
            src={logoLepoa}
            alt="LE.POÁ"
            className="h-7 w-auto max-w-[100px] sm:h-10 sm:max-w-none"
          />
        </Link>

        <nav className="hidden flex-wrap items-center gap-4 md:flex lg:gap-6">
          <Link
            to="/catalogo"
            className="whitespace-nowrap text-sm font-medium text-[#17251f] transition-colors hover:text-[#9e7936]"
          >
            Catálogo completo
          </Link>
          <Link
            to="/meu-estilo"
            className="whitespace-nowrap text-sm font-medium text-[#17251f] transition-colors hover:text-[#9e7936]"
          >
            Meu estilo
          </Link>
          <Link
            to="/enviar-print"
            className="whitespace-nowrap text-sm font-medium text-[#17251f] transition-colors hover:text-[#9e7936]"
          >
            Buscar por foto
          </Link>
          {showCart && <CartButton />}
          <Button
            variant="ghost"
            size="sm"
            className="whitespace-nowrap gap-2 rounded-full px-3 text-[#7a6335] hover:bg-[#efe3ca] hover:text-[#5f4b2a]"
            asChild
          >
            <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Fale com a gente
            </a>
          </Button>
          <Link to="/minha-conta">
            <Button
              variant="outline"
              size="sm"
              className="whitespace-nowrap gap-2 rounded-full border-[#c7aa6b] bg-[#faf4e4] text-[#2f2a22] hover:border-[#b49149] hover:bg-[#f2e7cd]"
            >
              <User className="h-4 w-4" />
              Minha Conta
            </Button>
          </Link>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2 md:hidden">
          {showCart && <CartButton />}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-[#213128] hover:bg-[#eee1c7]">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[min(92vw,320px)] overflow-hidden border-l border-[#c8ad76]/35 bg-[#10251f] p-0"
            >
              <nav className="flex h-full flex-col gap-1 overflow-y-auto px-4 pt-12">
                <Link
                  to="/catalogo"
                  className="border-b border-[#d4b26f44] py-3 text-base font-medium text-[#f7eccc] transition-colors hover:text-[#d4b26f]"
                >
                  Catálogo completo
                </Link>
                <Link
                  to="/meu-estilo"
                  className="border-b border-[#d4b26f44] py-3 text-base font-medium text-[#f7eccc] transition-colors hover:text-[#d4b26f]"
                >
                  Meu estilo
                </Link>
                <Link
                  to="/enviar-print"
                  className="border-b border-[#d4b26f44] py-3 text-base font-medium text-[#f7eccc] transition-colors hover:text-[#d4b26f]"
                >
                  Buscar por foto
                </Link>
                <Link
                  to="/carrinho"
                  className="border-b border-[#d4b26f44] py-3 text-base font-medium text-[#f7eccc] transition-colors hover:text-[#d4b26f]"
                >
                  Meu Carrinho
                </Link>
                <a
                  href={whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 border-b border-[#d4b26f44] py-3 text-base font-medium text-[#d4b26f] transition-colors hover:text-[#f4e8c9]"
                >
                  <MessageCircle className="h-5 w-5 shrink-0" />
                  Fale com a gente
                </a>
                <Link to="/minha-conta" className="mt-6">
                  <Button className="h-11 w-full gap-2 border border-[#b8944e] bg-[#f7efdc] text-[#2f2a22] hover:bg-[#f2e6cc]">
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
