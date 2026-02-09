import { Link } from "react-router-dom";
import { ArrowLeft, MessageCircle, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { buildWhatsAppLink } from "@/lib/whatsappHelpers";

const EsqueciSenha = () => {
  const whatsappMessage = "Oi! Esqueci minha senha do Provador VIP e preciso recuperar meu acesso 💚";
  const whatsappLink = buildWhatsAppLink(whatsappMessage);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-md">
        <Link
          to="/entrar"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para login
        </Link>

        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-4">
            <Heart className="h-8 w-8 text-accent" />
          </div>
          
          <h1 className="font-serif text-2xl mb-4">Esqueceu sua senha?</h1>
          
          <p className="text-muted-foreground text-sm mb-2">
            Não se preocupe 💚
          </p>
          
          <p className="text-muted-foreground text-sm mb-6">
            Para sua segurança, a recuperação de acesso ao Provador VIP é feita 
            com nosso time pelo WhatsApp.
          </p>
          
          <p className="text-muted-foreground text-sm mb-8">
            Assim garantimos um atendimento rápido e personalizado pra você 
            voltar a usar seu provador sem dor de cabeça ✨
          </p>

          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Button 
              className="w-full gap-2 bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-xl py-6 text-base font-medium"
              size="lg"
            >
              <MessageCircle className="h-5 w-5" />
              Recuperar acesso no WhatsApp
            </Button>
          </a>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Lembrou sua senha?{" "}
            <Link to="/entrar" className="text-accent hover:underline">
              Fazer login
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default EsqueciSenha;
