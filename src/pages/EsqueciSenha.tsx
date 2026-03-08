import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const EsqueciSenha = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
    } catch (error: unknown) {
      console.error("Password recovery error:", error);
      const err = error as { message?: string };
      toast.error(err.message || "Nao foi possivel enviar o link de recuperacao.");
    } finally {
      setIsLoading(false);
    }
  };

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
