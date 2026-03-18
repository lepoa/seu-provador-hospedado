import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Heart, Loader2, MessageCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Número do WhatsApp da Le.Poá para suporte (formato internacional sem +)
const WHATSAPP_NUMBER = "5562991223519";

const EsqueciSenha = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Informe seu email.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });

      if (error) throw error;

      toast.success("Enviamos um link seguro para seu email.");
      setEmailSent(true);
    } catch (error: unknown) {
      console.error("Password recovery error:", error);
      const err = error as { message?: string };
      toast.error(err.message || "Nao foi possivel enviar o link de recuperacao.");
    } finally {
      setIsLoading(false);
    }
  };

  const whatsappMsg = encodeURIComponent(
    `Olá! Preciso de ajuda para redefinir a senha da minha conta Le.Poá. Meu email cadastrado é: ${email}`
  );
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`;

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

          <p className="text-muted-foreground text-sm mb-8">
            Digite seu email para receber um link seguro de redefinicao de senha.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-left">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar link de recuperacao"
              )}
            </Button>
          </form>

          {emailSent && (
            <div className="mt-8 p-4 rounded-xl border border-border bg-muted/40 text-left space-y-3">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <Mail className="h-4 w-4 text-accent shrink-0" />
                Não recebeu o email?
              </p>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                <li>Verifique sua pasta de <strong>Spam</strong> ou <strong>Lixo eletrônico</strong></li>
                <li>Pode levar alguns minutos para chegar</li>
                <li>Certifique-se que o email digitado está correto</li>
              </ul>
              <div className="pt-1">
                <p className="text-xs text-muted-foreground mb-2">
                  Ainda com problemas? Fale com a gente pelo WhatsApp:
                </p>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-700 transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  Contatar suporte via WhatsApp
                </a>
              </div>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
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
