import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, Package, Camera, User, ChevronRight, Sparkles, Target, Heart } from "lucide-react";
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { MissionsList } from "@/components/MissionsList";
import { VipProgressSection } from "@/components/VipProgressSection";
import { ModalPrivacidade } from "@/components/account/ModalPrivacidade";
import { ModalTermos } from "@/components/account/ModalTermos";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { z } from "zod";
import { getAvailableMissions, getMissionById } from "@/lib/missionsData";
import { sendEmail } from "@/lib/sendEmail";

const authSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

interface ProfileData {
  full_name: string | null;
  quiz_points: number;
  quiz_level: number;
  completed_missions: string[];
  style_title: string | null;
  last_mission_id: string | null;
  last_mission_completed_at: string | null;
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function MinhaConta() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [inProgressMissionId, setInProgressMissionId] = useState<string | null>(null);

  const CONSENT_TERMS_VERSION = "v1";
  const CONSENT_PRIVACY_VERSION = "v1";

  const saveConsentOnProfile = async (userId: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: userId,
        terms_accepted: true,
        privacy_accepted: true,
        terms_accepted_at: now,
        privacy_accepted_at: now,
        terms_version: CONSENT_TERMS_VERSION,
        privacy_version: CONSENT_PRIVACY_VERSION,
        consent_user_agent: navigator.userAgent,
      },
      {
        onConflict: "user_id",
        ignoreDuplicates: false,
      },
    );

    if (error) throw error;
  };

  const loadCustomerProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.warn("Erro ao carregar perfil:", error);
      return;
    }

    if (data) {
      setName(data.name ?? "");
      setPhone(data.phone ?? "");
      setInstagram(data.instagram ?? "");
      setBirthDate(data.birth_date ?? "");
    }
  };

  const handleGoogleLogin = async () => {
    if (!isLogin && !termsAccepted) {
      toast.error("Voce precisa aceitar os termos para criar sua conta.");
      return;
    }

    setIsGoogleLoading(true);
    try {
      sessionStorage.setItem("oauth_return_to", "/minha-conta");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/minha-conta`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("Google login error:", err);
      toast.error("Erro ao conectar com Google");
      setIsGoogleLoading(false);
    }
  };

  // Load user profile and mission progress
  useEffect(() => {
    if (user) {
      loadProfileData();
      if (user.id) {
        loadCustomerProfile(user.id);
      }
    } else {
      setLoadingProfile(false);
    }
  }, [user]);

  const loadProfileData = async () => {
    if (!user) return;

    try {
      // Load profile - use maybeSingle to handle missing profile
      let { data: profileData, error } = await supabase
        .from("profiles")
        .select("full_name, quiz_points, quiz_level, completed_missions, style_title, last_mission_id, last_mission_completed_at")
        .eq("user_id", user.id)
        .maybeSingle();

      // If profile doesn't exist, create it
      if (!profileData && !error) {
        const { data: newProfile } = await supabase
          .from("profiles")
          .insert({ user_id: user.id })
          .select("full_name, quiz_points, quiz_level, completed_missions, style_title, last_mission_id, last_mission_completed_at")
          .single();
        profileData = newProfile;
      }

      setProfile({
        full_name: profileData?.full_name || null,
        quiz_points: profileData?.quiz_points || 0,
        quiz_level: profileData?.quiz_level || 1,
        completed_missions: (profileData?.completed_missions as string[]) || [],
        style_title: profileData?.style_title || null,
        last_mission_id: profileData?.last_mission_id || null,
        last_mission_completed_at: profileData?.last_mission_completed_at || null,
      });

      // Check for in-progress mission
      const { data: attempt } = await supabase
        .from("mission_attempts")
        .select("mission_id")
        .eq("user_id", user.id)
        .eq("status", "in_progress")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (attempt) {
        setInProgressMissionId(attempt.mission_id);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoadingProfile(false);
    }
  };

  // If logged in, show account menu
  if (!authLoading && user) {
    const hasCompletedQuiz = (profile?.quiz_points || 0) > 0;
    const completedMissions = profile?.completed_missions || [];
    const availableMissions = getAvailableMissions(completedMissions);
    const nextMission = availableMissions.length > 0 ? availableMissions[0] : null;
    const lastMission = profile?.last_mission_id ? getMissionById(profile.last_mission_id) : null;

    return (
      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto px-4 py-8 max-w-lg">
          {/* Welcome Section */}
          <div className="text-center mb-6">
            <h1 className="font-serif text-2xl mb-2">
              Olá, {profile?.full_name?.split(' ')[0] || "Visitante"}! 👋
            </h1>
            <p className="text-muted-foreground">{user.email}</p>
            {profile?.style_title && (
              <p className="text-sm text-accent mt-1">
                Estilo: {profile.style_title}
              </p>
            )}
          </div>

          {/* VIP Progress Section */}
          {!loadingProfile && (
            <VipProgressSection
              quizPoints={profile?.quiz_points || 0}
              quizLevel={profile?.quiz_level || 1}
              hasCompletedQuiz={hasCompletedQuiz}
              lastMissionId={profile?.last_mission_id}
              lastMissionName={lastMission?.title}
              lastMissionCompletedAt={profile?.last_mission_completed_at}
              nextMissionId={nextMission?.id}
              nextMissionName={nextMission?.title}
              inProgressMissionId={inProgressMissionId}
            />
          )}

          {/* Menu Items */}
          <div className="space-y-3 mb-8">
            <Link to="/meus-favoritos">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-red-200 bg-gradient-to-r from-red-50/50 to-background">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                      <Heart className="h-5 w-5 text-red-500 fill-red-500" />
                    </div>
                    <div>
                      <p className="font-medium">Meus Favoritos</p>
                      <p className="text-sm text-muted-foreground">Produtos que você amou</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            <Link to="/meus-pedidos">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <Package className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium">Meus Pedidos</p>
                      <p className="text-sm text-muted-foreground">Acompanhe suas compras</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            <Link to="/meus-prints">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <Camera className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium">Meus Prints</p>
                      <p className="text-sm text-muted-foreground">Prints enviados e resultados</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            <Link to="/meu-estilo">
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-accent/30 bg-gradient-to-r from-accent/5 to-primary/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium">Meu Estilo</p>
                      <p className="text-sm text-muted-foreground">
                        {hasCompletedQuiz ? "Progresso e trilhas VIP" : "Descubra seu estilo"}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            <Link to="/minhas-sugestoes">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <Target className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium">Sugestões pra mim</p>
                      <p className="text-sm text-muted-foreground">Looks personalizados</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            {/* Missions / Trails - New menu item */}
            {hasCompletedQuiz && (
              <Card
                className="hover:shadow-md transition-shadow cursor-pointer border-accent/30"
                onClick={() => {
                  // Scroll to missions section
                  document.getElementById("missions-section")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-accent/20 flex items-center justify-center">
                      <Target className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium">Missões / Trilhas</p>
                      <p className="text-sm text-muted-foreground">
                        {completedMissions.length}/{completedMissions.length + availableMissions.length} completadas
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            )}

            <Link to="/meu-perfil">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium">Meus Dados</p>
                      <p className="text-sm text-muted-foreground">Endereço, senha e perfil</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>


            {/* Logout Button */}
            <Card
              className="hover:shadow-md transition-shadow cursor-pointer border-red-100 hover:bg-red-50/50"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/login");
              }}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                    <User className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="font-medium text-red-600">Sair da Conta</p>
                    <p className="text-sm text-red-400">Deslogar do dispositivo</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-red-300" />
              </CardContent>
            </Card>
          </div>

          {/* Missions Section - Only show if user has completed quiz */}
          {
            profile && profile.quiz_points > 0 && (
              <div id="missions-section" className="mt-8 pt-8 border-t border-border">
                <MissionsList
                  completedMissions={profile.completed_missions}
                  currentPoints={profile.quiz_points}
                  currentLevel={profile.quiz_level}
                />
              </div>
            )
          }
        </main >
      </div >
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = authSchema.safeParse({ email, password });
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    setIsSubmitting(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Bem-vinda de volta!");
      } else {
        if (!name) {
          toast.error("Informe seu nome.");
          return;
        }

        if (!phone) {
          toast.error("Informe seu telefone.");
          return;
        }

        const normalizedPhone = phone.replace(/\D/g, "");
        if (normalizedPhone.length < 10) {
          toast.error("Informe um telefone válido.");
          return;
        }

        if (!termsAccepted) {
          toast.error("Voce precisa aceitar os termos para criar sua conta.");
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/minha-conta`,
            data: {
              terms_accepted: true,
              privacy_accepted: true,
              terms_version: CONSENT_TERMS_VERSION,
              privacy_version: CONSENT_PRIVACY_VERSION,
              consent_user_agent: navigator.userAgent,
            },
          },
        });
        if (error) {
          if (error.message?.includes("already registered")) {
            toast.error("Este e-mail ja esta cadastrado. Faca login.");
            return;
          }

          toast.error("Nao foi possivel criar a conta.");
          console.error(error);
          return;
        }

        if (data.user?.id) {
          const { error: customerError } = await supabase.from("customers").insert({
            user_id: data.user.id,
            name,
            email,
            phone: normalizedPhone,
          });

          if (customerError) {
            console.warn("Erro ao criar registro em customers:", customerError);
          }

          await saveConsentOnProfile(data.user.id);
        }

        toast.success("Conta criada com sucesso!");
      }
    } catch (error: unknown) {
      console.error("Auth error:", error);
      const err = error as { message?: string };
      if (err.message?.includes("already registered")) {
        toast.error("Este email já está cadastrado. Tente fazer login.");
      } else if (err.message?.includes("Invalid login")) {
        toast.error("Email ou senha incorretos.");
      } else {
        toast.error(err.message || "Erro ao autenticar. Tente novamente.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 max-w-sm flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-12 max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-serif text-2xl mb-2">
            {isLogin ? "Entrar na sua conta" : "Criar conta"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isLogin
              ? "Acesse seus pedidos e preferências"
              : "Crie sua conta para acompanhar tudo"}
          </p>
        </div>

        {/* Google Login Button */}
        <Button
          type="button"
          variant="outline"
          className="w-full mb-4"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading}
        >
          {isGoogleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          Continuar com Google
        </Button>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-3 text-muted-foreground">ou</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div>
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

          {!isLogin && (
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                required
              />
            </div>
          )}

          <div>
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
            {isLogin && (
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

          {!isLogin && (
            <div className="rounded-md border border-border p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="terms-acceptance"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                />
                <Label htmlFor="terms-acceptance" className="text-sm leading-5 cursor-pointer">
                  Li e concordo com os{" "}
                  <button
                    type="button"
                    onClick={() => setIsTermsModalOpen(true)}
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    Termos de Uso
                  </button>{" "}
                  e{" "}
                  <button
                    type="button"
                    onClick={() => setIsPrivacyModalOpen(true)}
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    Politica de Privacidade
                  </button>
                </Label>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting || (!isLogin && !termsAccepted)}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isLogin ? "Entrando..." : "Criando conta..."}
              </>
            ) : (
              isLogin ? "Entrar" : "Criar conta"
            )}
          </Button>

        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              const nextIsLogin = !isLogin;
              setIsLogin(nextIsLogin);
              if (nextIsLogin) {
                setTermsAccepted(false);
              }
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isLogin
              ? "Não tem conta? Criar agora"
              : "Já tem conta? Fazer login"}
          </button>
        </div>
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
}
