import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import logoLepoa from "@/assets/logo-lepoa.png";

const authSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

const Login = () => {
  const navigate = useNavigate();
  const { user, isMerchant, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user && isMerchant()) {
      navigate("/dashboard");
    }
  }, [authLoading, isMerchant, navigate, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = authSchema.safeParse({ email, password });
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id);

      const hasMerchantRole = roles?.some((r) => r.role === "merchant" || r.role === "admin");

      if (!hasMerchantRole) {
        await supabase.auth.signOut();
        toast.error("Acesso restrito. Esta área é apenas para lojistas autorizados.");
        return;
      }

      toast.success("Bem-vinda de volta.");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Auth error:", error);
      if (error.message?.includes("Invalid login")) {
        toast.error("Email ou senha incorretos.");
      } else {
        toast.error(error.message || "Erro ao autenticar. Tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#102820]">
        <Loader2 className="h-8 w-8 animate-spin text-[#d4b26f]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#102820] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[#d1b37066] bg-[#f8f3e8] px-6 py-8 shadow-[0_16px_42px_rgba(0,0,0,0.35)] sm:px-8">
        <div className="mb-8 text-center">
          <img src={logoLepoa} alt="Le.Poá" className="mx-auto mb-5 h-14 w-auto object-contain" />
          <h1 className="text-2xl font-semibold text-[#102820]">Área do lojista</h1>
          <p className="mt-2 text-sm text-[#6f6658]">Acesso restrito para equipe autorizada.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border-[#c8aa6a80] bg-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-[#c8aa6a80] bg-white pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7b6b4d] transition-colors hover:text-[#102820]"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="h-11 w-full border border-[#b18a40] bg-[#102820] text-[#f3e5c1] hover:bg-[#123129]"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-[#6f6658]">Cadastro de lojistas apenas por convite.</p>
      </div>
    </div>
  );
};

export default Login;
