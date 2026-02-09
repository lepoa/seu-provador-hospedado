import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock, CheckCircle, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const passwordSchema = z
  .object({
    password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
    confirmPassword: z.string().min(6, "Confirmação deve ter no mínimo 6 caracteres"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });

const ResetarSenha = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Link inválido. Solicite um novo link de recuperação.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = passwordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: resetError } = await supabase.functions.invoke("reset-password", {
        body: { 
          token,
          newPassword: password,
        },
      });

      if (resetError) {
        throw new Error(resetError.message || "Erro ao redefinir senha");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setIsSuccess(true);
      toast.success("Senha atualizada com sucesso! 🎉");
    } catch (err: any) {
      console.error("Password reset error:", err);
      const errorMessage = err.message || "Erro ao redefinir senha. Tente novamente.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToMeuEstilo = () => {
    navigate("/meu-estilo");
  };

  const handleGoToLogin = () => {
    navigate("/entrar");
  };

  // Invalid or missing token
  if (!token || error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto px-4 py-8 max-w-md">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="font-serif text-2xl mb-2">Link inválido ou expirado</h1>
            <p className="text-muted-foreground text-sm mb-6">
              {error || "Este link de recuperação de senha não é mais válido. Isso pode acontecer se o link já foi usado ou expirou."}
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

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto px-4 py-8 max-w-md">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="font-serif text-2xl mb-2">✨ Senha atualizada com sucesso!</h1>
            <p className="text-muted-foreground text-sm mb-6">
              Você já pode acessar o seu Provador VIP e conferir suas sugestões personalizadas.
            </p>

            <div className="space-y-3">
              <Button className="w-full gap-2" onClick={handleGoToMeuEstilo}>
                <Sparkles className="h-4 w-4" />
                Ir para Meu Estilo
              </Button>
              <Button variant="outline" className="w-full" onClick={handleGoToLogin}>
                Fazer login
              </Button>
            </div>

            <div className="mt-8 p-4 bg-accent/10 rounded-xl border border-accent/30">
              <p className="text-sm text-muted-foreground">
                💎 Acesse "Meu Estilo" para ver seu nível VIP, pontos acumulados e sugestões exclusivas!
              </p>
            </div>
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
          <h1 className="font-serif text-2xl mb-2">Criar nova senha</h1>
          <p className="text-muted-foreground text-sm">
            Digite sua nova senha abaixo. Escolha uma senha segura com no mínimo
            6 caracteres.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="password">Nova senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Mínimo de 6 caracteres
            </p>
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
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
};

export default ResetarSenha;
