import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/Header";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ModalPrivacidade } from "@/components/account/ModalPrivacidade";
import { ModalTermos } from "@/components/account/ModalTermos";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePhoneMask } from "@/hooks/usePhoneMask";
import { toast } from "sonner";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

const signupSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  whatsapp: z.string().min(14, "WhatsApp inválido"),
});

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  const CONSENT_TERMS_VERSION = "v1";
  const CONSENT_PRIVACY_VERSION = "v1";

  const {
    displayValue: whatsappMasked,
    handleChange: handleWhatsappChangeEvent,
    getNormalizedValue: getWhatsappNormalized,
    isValid: whatsappIsValid
  } = usePhoneMask("");

  // Get redirect URL from query params or state
  const searchParams = new URLSearchParams(location.search);
  const stateData = location.state as { redirectTo?: string; returnTo?: string; from?: string; message?: string } | null;
  const redirectTo = searchParams.get("redirect") || stateData?.returnTo || stateData?.redirectTo || stateData?.from || "/";
  const customMessage = stateData?.message;

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      navigate(redirectTo, { replace: true });
    }
  }, [user, authLoading, navigate, redirectTo]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = loginSchema.safeParse({ email, password });
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

      toast.success("Bem-vinda de volta! 💕");
      navigate(redirectTo, { replace: true });
    } catch (error: any) {
      console.error("Auth error:", error);
      if (error.message.includes("Invalid login")) {
        toast.error("Email ou senha incorretos.");
      } else {
        toast.error(error.message || "Erro ao entrar. Tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = signupSchema.safeParse({ name, email, password, whatsapp: whatsappMasked });
    if (!result.success || !whatsappIsValid) {
      toast.error(!whatsappIsValid ? "WhatsApp inválido" : result.error.errors[0].message);
      toast.error(result.error.errors[0].message);
      return;
    }

    if (!termsAccepted) {
      toast.error("Você precisa aceitar os termos para criar sua conta.");
      return;
    }

    setIsLoading(true);
    try {
      const now = new Date().toISOString();
      const redirectUrl = `${window.location.origin}${redirectTo}`;
      const normalizedWhatsapp = getWhatsappNormalized();
      const normalizedInstagram = instagramHandle
        .replace(/@/g, "").replace(/\s/g, "").toLowerCase().trim() || null;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name,
            whatsapp: normalizedWhatsapp,
            instagram_handle: normalizedInstagram,
            terms_accepted: true,
            privacy_accepted: true,
            terms_version: CONSENT_TERMS_VERSION,
            privacy_version: CONSENT_PRIVACY_VERSION,
            consent_user_agent: navigator.userAgent,
          },
        },
      });

      if (error) throw error;

      // Update profile and create customer
      if (data.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            name,
            whatsapp: normalizedWhatsapp,
            instagram_handle: normalizedInstagram,
            terms_accepted: true,
            privacy_accepted: true,
            terms_accepted_at: now,
            privacy_accepted_at: now,
            terms_version: CONSENT_TERMS_VERSION,
            privacy_version: CONSENT_PRIVACY_VERSION,
            consent_user_agent: navigator.userAgent,
          })
          .eq("user_id", data.user.id);

        if (profileError) {
          console.error("Profile update error:", profileError);
        }

        const { error: customerError } = await supabase
          .from("customers")
          .upsert({
            user_id: data.user.id,
            name,
            phone: normalizedWhatsapp,
            instagram_handle: normalizedInstagram,
          }, { onConflict: 'phone' });

        if (customerError) {
          console.warn("Erro ao criar registro em customers:", customerError);
        }
      }

      toast.success("Conta criada com sucesso! 🎉");
      navigate(redirectTo, { replace: true });
    } catch (error: any) {
      console.error("Signup error:", error);
      if (error.message.includes("already registered")) {
        toast.error("Este email já está cadastrado. Faça login.");
        setIsSignUp(false);
      } else {
        toast.error(error.message || "Erro ao criar conta. Tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      // Save return destination for after OAuth callback
      sessionStorage.setItem("oauth_return_to", redirectTo);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${redirectTo}`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("Google auth error:", error);
      toast.error("Erro ao entrar com Google. Tente novamente.");
      setIsGoogleLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-4">
            <Sparkles className="h-8 w-8 text-accent" />
          </div>
          <h1 className="font-serif text-2xl mb-2">
            {isSignUp ? "Criar sua conta" : "Entrar"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {customMessage
              ? customMessage
              : isSignUp
                ? "Crie sua conta para fazer o quiz e receber looks personalizados"
                : "Entre para acessar seus looks e pedidos"}
          </p>
        </div>

        {customMessage && (
          <div className="mb-6 p-4 bg-accent/10 rounded-xl border border-accent/30 text-center">
            <p className="text-sm">
              ✨ Ao entrar, você terá acesso ao seu perfil de estilo e sugestões personalizadas!
            </p>
          </div>
        )}

        <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
          {isSignUp && (
            <div className="animate-slide-in-up">
              <Label htmlFor="name">Seu nome</Label>
              <Input
                id="name"
                type="text"
                placeholder="Como podemos te chamar?"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className={isSignUp ? "animate-slide-in-up" : ""} style={isSignUp ? { animationDelay: "50ms" } : {}}>
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

          {isSignUp && (
            <div className="animate-slide-in-up" style={{ animationDelay: "100ms" }}>
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                type="tel"
                placeholder="(62) 99999-9999"
                value={whatsappMasked}
                onChange={handleWhatsappChangeEvent}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Usaremos para enviar novidades e looks no seu tamanho
              </p>
            </div>
          )}

          {isSignUp && (
            <div className="animate-slide-in-up" style={{ animationDelay: "120ms" }}>
              <Label htmlFor="instagram">Instagram (opcional)</Label>
              <Input
                id="instagram"
                type="text"
                placeholder="@seuinstagram"
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se você compra nas nossas lives, coloque seu @ para ver seus pedidos aqui
              </p>
            </div>
          )}

          <div className={isSignUp ? "animate-slide-in-up" : ""} style={isSignUp ? { animationDelay: "150ms" } : {}}>
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {!isSignUp && (
              <div className="mt-1 text-right">
                <Link
                  to="/esqueci-senha"
                  className="text-xs text-muted-foreground hover:text-accent transition-colors"
                >
                  Esqueci minha senha
                </Link>
              </div>
            )}
          </div>

          {isSignUp && (
            <div className="rounded-md border border-border p-3 space-y-2 animate-slide-in-up" style={{ animationDelay: "180ms" }}>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="terms-acceptance"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                />
                <Label htmlFor="terms-acceptance" className="text-xs leading-5 cursor-pointer text-muted-foreground">
                  Li e concordo com os{" "}
                  <button
                    type="button"
                    onClick={() => setIsTermsModalOpen(true)}
                    className="underline underline-offset-4 hover:text-foreground text-accent"
                  >
                    Termos de Uso
                  </button>{" "}
                  e{" "}
                  <button
                    type="button"
                    onClick={() => setIsPrivacyModalOpen(true)}
                    className="underline underline-offset-4 hover:text-foreground text-accent"
                  >
                    Política de Privacidade
                  </button>
                </Label>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full gap-2 transition-all hover:scale-[1.02]"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isSignUp ? "Criando conta..." : "Entrando..."}
              </>
            ) : isSignUp ? (
              <>
                <Sparkles className="h-4 w-4" />
                Criar conta
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>

        <div className="relative my-6">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
            ou continue com
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading || isLoading}
        >
          {isGoogleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          Google
        </Button>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-accent hover:underline"
          >
            {isSignUp
              ? "Já tem uma conta? Fazer login"
              : "Não tem conta? Criar agora"}
          </button>
        </div>

        {redirectTo.includes("quiz") && (
          <div className="mt-8 p-4 bg-accent/10 rounded-xl border border-accent/30 text-center">
            <p className="text-sm text-muted-foreground">
              Ao criar sua conta, você terá acesso a:
            </p>
            <ul className="mt-2 text-sm space-y-1">
              <li>✨ Looks personalizados no seu tamanho</li>
              <li>📦 Histórico de pedidos</li>
              <li>💕 Sugestões exclusivas</li>
            </ul>
          </div>
        )}

        <ModalTermos
          open={isTermsModalOpen}
          onOpenChange={setIsTermsModalOpen}
          onAgree={() => setTermsAccepted(true)}
        />
        <ModalPrivacidade
          open={isPrivacyModalOpen}
          onOpenChange={setIsPrivacyModalOpen}
          onAgree={() => setTermsAccepted(true)}
        />
      </main>
    </div>
  );
};

export default Auth;
