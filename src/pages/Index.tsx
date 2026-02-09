import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Camera, Heart, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { BenefitsBar } from "@/components/BenefitsBar";
const Index = () => {
  return <div className="min-h-screen flex flex-col">
      <BenefitsBar />
      <Header />
      
      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-4 py-12 md:py-20">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-2 text-accent text-sm md:text-base font-medium mb-4">
              <Sparkles className="h-4 w-4" />
              Descubra seu estilo único
            </span>
          </div>
          
          <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl font-semibold leading-tight mb-6 animate-slide-up">Seu Provador
Personalizado<br />
            <span className="text-accent">Personalizado</span>
          </h1>
          
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-10 animate-slide-up" style={{
          animationDelay: "0.1s"
        }}>
            Responda rapidinho e receba sugestões no seu estilo e no seu tamanho. 
            É como ter uma consultora de moda no seu bolso.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style={{
          animationDelay: "0.2s"
        }}>
            <Link to="/meu-estilo">
              <Button size="lg" className="w-full sm:w-auto gap-2 text-base px-8">
                <Heart className="h-5 w-5" />
                Descobrir meu estilo
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/enviar-print">
              <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2 text-base px-8">
                <Camera className="h-5 w-5" />
                Buscar por foto
              </Button>
            </Link>
          </div>
          
          <p className="text-xs text-muted-foreground mt-6 animate-slide-up" style={{
          animationDelay: "0.3s"
        }}>
            Você pode enviar print do Instagram, foto do espelho ou qualquer inspiração ✨
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-secondary/50">
        <div className="container mx-auto px-4">
          <h2 className="font-serif text-3xl md:text-4xl text-center mb-12">
            Como funciona?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <FeatureCard step="01" title="Faça o quiz" description="Responda perguntas rápidas sobre seu estilo e preferências. Leva menos de 2 minutos!" icon={Sparkles} />
            <FeatureCard step="02" title="Receba sugestões" description="Nossa consultora virtual seleciona looks perfeitos para o seu perfil de estilo." icon={Heart} />
            <FeatureCard step="03" title="Fale conosco" description="Receba os looks direto no seu WhatsApp e tire dúvidas sobre tamanhos." icon={Users} />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2026 Provador Vip Le.Poá. Feito com ❤️ para você.</p>
          <Link to="/area-lojista" className="mt-2 inline-block text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
            Área do Lojista
          </Link>
        </div>
      </footer>
    </div>;
};
function FeatureCard({
  step,
  title,
  description,
  icon: Icon
}: {
  step: string;
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return <div className="bg-card rounded-xl p-6 md:p-8 text-center border border-border hover:shadow-lg transition-shadow">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 text-accent mb-4">
        <Icon className="h-6 w-6" />
      </div>
      <span className="text-xs font-semibold text-accent mb-2 block">{step}</span>
      <h3 className="font-serif text-xl mb-3">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>;
}
export default Index;