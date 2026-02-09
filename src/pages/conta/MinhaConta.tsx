import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, Package, Camera, User, ChevronRight, Sparkles, Target, Heart } from "lucide-react";
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { MissionsList } from "@/components/MissionsList";
import { VipProgressSection } from "@/components/VipProgressSection";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { z } from "zod";
import { getAvailableMissions, getMissionById } from "@/lib/missionsData";

const authSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

interface ProfileData {
  quiz_points: number;
  quiz_level: number;
  completed_missions: string[];
  style_title: string | null;
  last_mission_id: string | null;
  last_mission_completed_at: string | null;
}

export default function MinhaConta() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [inProgressMissionId, setInProgressMissionId] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      sessionStorage.setItem("oauth_return_to", "/minha-conta");
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
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
        .select("quiz_points, quiz_level, completed_missions, style_title, last_mission_id, last_mission_completed_at")
        .eq("user_id", user.id)
        .maybeSingle();

      // If profile doesn't exist, create it
      if (!profileData && !error) {
        const { data: newProfile } = await supabase
          .from("profiles")
          .insert({ user_id: user.id })
          .select("quiz_points, quiz_level, completed_missions, style_title, last_mission_id, last_mission_completed_at")
          .single();
        profileData = newProfile;
      }

      setProfile({
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
            <h1 className="font-serif text-2xl mb-2">Olá! 👋</h1>
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
                      <p className="font-medium">Meu Perfil</p>
                      <p className="text-sm text-muted-foreground">Dados e preferências</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Missions Section - Only show if user has completed quiz */}
          {profile && profile.quiz_points > 0 && (
            <div id="missions-section" className="mt-8 pt-8 border-t border-border">
              <MissionsList 
                completedMissions={profile.completed_missions}
                currentPoints={profile.quiz_points}
                currentLevel={profile.quiz_level}
              />
            </div>
          )}
        </main>
      </div>
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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/minha-conta`,
          },
        });
        if (error) throw error;
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

          <Button type="submit" className="w-full" disabled={isSubmitting}>
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
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isLogin 
              ? "Não tem conta? Criar agora" 
              : "Já tem conta? Fazer login"}
          </button>
        </div>
      </main>
    </div>
  );
}