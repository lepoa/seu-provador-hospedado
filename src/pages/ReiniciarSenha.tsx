import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ReiniciarSenha() {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    const checkRecoverySession = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token") || "";
      const type = hashParams.get("type");

      if (type === "recovery" && accessToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          setIsValidSession(false);
          return;
        }

        window.history.replaceState({}, document.title, window.location.pathname);
        setIsValidSession(true);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      setIsValidSession(Boolean(session));
    };

    checkRecoverySession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!novaSenha || !confirmarSenha) {
      toast.error("Preencha os dois campos de senha.");
      return;
    }

    if (novaSenha.length < 6) {
      toast.error("A nova senha deve ter no minimo 6 caracteres.");
      return;
    }

    if (novaSenha !== confirmarSenha) {
      toast.error("As senhas nao conferem.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: novaSenha,
      });

      if (error) throw error;

      setIsSuccess(true);
      toast.success("Senha alterada com sucesso. Voce ja pode entrar na sua conta.");
    } catch (error: unknown) {
      console.error("Reset password error:", error);
      const err = error as { message?: string };
      toast.error(err.message || "Nao foi possivel alterar a senha.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidSession === null) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-md flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-md">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="font-serif text-2xl mb-2">Link invalido ou expirado</h1>
            <p className="text-muted-foreground text-sm mb-6">
              Solicite um novo link para redefinir sua senha.
            </p>
            <div className="space-y-3">
              <Link to="/esqueci-senha">
                <Button className="w-full">Solicitar novo link</Button>
              </Link>
              <Link to="/entrar">
                <Button variant="outline" className="w-full">
                  Voltar para login
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-md">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="font-serif text-2xl mb-2">Senha alterada com sucesso</h1>
            <p className="text-muted-foreground text-sm mb-6">
              Senha alterada com sucesso. Voce ja pode entrar na sua conta.
            </p>
            <Link to="/entrar">
              <Button className="w-full">Entrar na conta</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-4">
            <Lock className="h-8 w-8 text-accent" />
          </div>
          <h1 className="font-serif text-2xl mb-2">Reiniciar senha</h1>
          <p className="text-muted-foreground text-sm">
            Defina sua nova senha para continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="new-password">Nova senha</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNovaSenha ? "text" : "password"}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="********"
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowNovaSenha(!showNovaSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNovaSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="confirm-password">Confirmar senha</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmarSenha ? "text" : "password"}
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="********"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar nova senha"
            )}
          </Button>
        </form>
      </main>
    </div>
  );
}
