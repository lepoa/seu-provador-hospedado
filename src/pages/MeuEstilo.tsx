import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Sparkles, Star, Trophy, ArrowRight, Target, Clock, CheckCircle2, 
  RotateCcw, Gift, Palette, Eye, ChevronRight, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getLevelFromPoints, LEVEL_THRESHOLDS } from "@/lib/quizDataV2";
import { availableMissions, getMissionTotalPoints } from "@/lib/missionsData";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ProfileData {
  name: string | null;
  full_name: string | null;
  style_title: string | null;
  style_description: string | null;
  size_letter: string | null;
  size_number: string | null;
  quiz_points: number;
  quiz_level: number;
  quiz_completed_at: string | null;
  completed_missions: string[];
  last_mission_id: string | null;
  last_mission_completed_at: string | null;
  color_palette: string[] | null;
  personal_tip: string | null;
}

const MeuEstilo = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inProgressMissionId, setInProgressMissionId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    // Redirect to login if not authenticated
    if (!user) {
      navigate("/entrar", { 
        state: { 
          from: "/meu-estilo",
          message: "Entre ou crie sua conta para salvar seu estilo e receber sugestões no seu tamanho."
        }
      });
      return;
    }

    loadProfile();
    checkInProgressMission();
  }, [user, authLoading, navigate]);

  const loadProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          name, full_name, style_title, style_description, 
          size_letter, size_number, quiz_points, quiz_level, 
          quiz_completed_at, completed_missions, last_mission_id,
          last_mission_completed_at, color_palette, personal_tip
        `)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      
      setProfile(data || {
        name: null,
        full_name: null,
        style_title: null,
        style_description: null,
        size_letter: null,
        size_number: null,
        quiz_points: 0,
        quiz_level: 1,
        quiz_completed_at: null,
        completed_missions: [],
        last_mission_id: null,
        last_mission_completed_at: null,
        color_palette: null,
        personal_tip: null,
      });
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkInProgressMission = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from("mission_attempts")
        .select("mission_id")
        .eq("user_id", user.id)
        .eq("status", "in_progress")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setInProgressMissionId(data?.mission_id || null);
    } catch (error) {
      console.error("Error checking in-progress mission:", error);
    }
  };

  // Check if quiz base is completed
  const hasCompletedQuiz = !!profile?.quiz_completed_at && !!profile?.style_title;

  // If quiz not completed, redirect to quiz
  useEffect(() => {
    if (!loading && profile && !hasCompletedQuiz) {
      navigate("/quiz");
    }
  }, [loading, profile, hasCompletedQuiz, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      </div>
    );
  }

  if (!profile || !hasCompletedQuiz) {
    return null; // Will redirect to quiz
  }

  const { level, title: levelTitle } = getLevelFromPoints(profile.quiz_points);
  const currentLevelThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextLevelThreshold = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const pointsInCurrentLevel = profile.quiz_points - currentLevelThreshold;
  const pointsNeededForNextLevel = nextLevelThreshold - currentLevelThreshold;
  const progressPercent = Math.min((pointsInCurrentLevel / pointsNeededForNextLevel) * 100, 100);
  const isMaxLevel = level >= LEVEL_THRESHOLDS.length;
  const pointsToNextLevel = nextLevelThreshold - profile.quiz_points;

  const displayName = profile.full_name || profile.name || "você";
  const sizeDisplay = [profile.size_letter, profile.size_number].filter(Boolean).join(" / ");

  // Separate completed and available missions
  const completedMissionIds = profile.completed_missions || [];
  const completedMissions = availableMissions.filter(m => completedMissionIds.includes(m.id));
  const availableMissionsList = availableMissions.filter(m => !completedMissionIds.includes(m.id));

  // Get next suggested mission
  const nextMission = availableMissionsList[0];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-lg">
        {/* Motivational Header */}
        <div className="text-center mb-6">
          <p className="text-xs text-muted-foreground">
            Quanto mais você completa missões, mais perfeito fica seu provador no seu tamanho ✨
          </p>
        </div>

        {/* Welcome Header */}
        <div className="bg-gradient-to-br from-accent/10 via-primary/5 to-accent/5 border border-accent/20 rounded-2xl p-5 mb-6">
          <div className="text-center mb-4">
            <h1 className="font-serif text-xl mb-1">
              Olá, {displayName} ✨
            </h1>
            <p className="text-accent font-medium">{profile.style_title}</p>
            {sizeDisplay && (
              <p className="text-sm text-muted-foreground mt-1">
                Tamanhos: {sizeDisplay}
              </p>
            )}
          </div>

          {/* Color Palette */}
          {profile.color_palette && profile.color_palette.length > 0 && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <div className="flex gap-1.5">
                {profile.color_palette.slice(0, 4).map((color, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {color}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* VIP Progress Section */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-5 w-5 text-accent" />
            <h2 className="font-serif text-lg">Seu Progresso VIP</h2>
          </div>

          {/* Points and Level */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-accent/10 px-3 py-1.5 rounded-full">
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                <span className="font-bold text-amber-700">{profile.quiz_points} pts</span>
              </div>
            </div>
            <div className="text-sm text-right">
              <span className="text-muted-foreground">Nível {level}: </span>
              <span className="font-medium text-accent">{levelTitle}</span>
            </div>
          </div>

          {/* Progress Bar */}
          {!isMaxLevel ? (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>Progresso para Nível {level + 1}</span>
                <span>Faltam {pointsToNextLevel} pts</span>
              </div>
              <Progress value={progressPercent} className="h-2.5" />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-accent mb-4">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-medium">Nível máximo alcançado! 🏆</span>
            </div>
          )}

          {/* Motivational Text */}
          <p className="text-xs text-muted-foreground text-center bg-muted/30 rounded-lg p-3">
            Quanto mais você detalha seu estilo, mais certeiras ficam suas sugestões — e mais pontos você ganha 🎁
          </p>
        </div>

        {/* Rewards Preview */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="h-5 w-5 text-amber-600" />
            <h3 className="font-medium text-amber-800 dark:text-amber-200">Recompensas</h3>
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Seus pontos podem virar presentes e vantagens exclusivas (em breve). 🎁
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 mb-6">
          {inProgressMissionId ? (
            <Link to={`/missao/${inProgressMissionId}`}>
              <Button className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white">
                <Clock className="h-4 w-4" />
                Continuar de onde parei
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : nextMission ? (
            <Link to={`/missao/${nextMission.id}`}>
              <Button className="w-full gap-2">
                <Target className="h-4 w-4" />
                Continuar Trilhas
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <div className="text-center text-sm text-muted-foreground bg-card rounded-xl p-3 border">
              <CheckCircle2 className="h-5 w-5 text-accent mx-auto mb-1" />
              Todas as missões completadas! 🎉
            </div>
          )}

          <Link to="/minhas-sugestoes">
            <Button variant="outline" className="w-full gap-2">
              <Eye className="h-4 w-4" />
              Ver minhas sugestões
            </Button>
          </Link>
        </div>

        {/* Missions Section */}
        <div className="space-y-6">
          {/* Available Missions */}
          {availableMissionsList.length > 0 && (
            <div>
              <h3 className="font-serif text-lg mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-accent" />
                Missões Disponíveis
              </h3>
              <div className="space-y-3">
                {availableMissionsList.map((mission, index) => (
                  <MissionCard 
                    key={mission.id} 
                    mission={mission} 
                    isCompleted={false}
                    isInProgress={inProgressMissionId === mission.id}
                    isNextSuggested={index === 0 && !inProgressMissionId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed Missions */}
          {completedMissions.length > 0 && (
            <div>
              <h3 className="font-serif text-lg mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Missões Concluídas ({completedMissions.length})
              </h3>
              <div className="space-y-3">
                {completedMissions.map((mission) => (
                  <MissionCard 
                    key={mission.id} 
                    mission={mission} 
                    isCompleted={true}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Redo Quiz Option */}
        <div className="mt-8 pt-6 border-t border-border">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-muted-foreground hover:text-foreground gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Refazer Quiz Base
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Refazer Quiz Base?</AlertDialogTitle>
                <AlertDialogDescription>
                  Você pode refazer o quiz para atualizar seu perfil de estilo. 
                  <span className="block mt-2 font-medium text-foreground">
                    Seus pontos serão mantidos — não serão somados novamente.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Link to="/quiz?redo=true">
                    <Button>Refazer Quiz</Button>
                  </Link>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
    </div>
  );
};

// Mission Card Component
interface MissionCardProps {
  mission: typeof availableMissions[0];
  isCompleted: boolean;
  isInProgress?: boolean;
  isNextSuggested?: boolean;
}

function MissionCard({ mission, isCompleted, isInProgress, isNextSuggested }: MissionCardProps) {
  const totalPoints = getMissionTotalPoints(mission);

  return (
    <Link to={`/missao/${mission.id}`}>
      <Card className={`transition-all hover:shadow-md ${
        isCompleted 
          ? "bg-muted/30 border-green-200 dark:border-green-800" 
          : isInProgress 
            ? "border-amber-300 bg-amber-50/50 dark:bg-amber-900/10" 
            : isNextSuggested 
              ? "border-accent/50 bg-accent/5" 
              : ""
      }`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="text-3xl">{mission.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium truncate">{mission.title}</h4>
                {isCompleted && (
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                )}
                {isInProgress && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                    Em andamento
                  </Badge>
                )}
                {isNextSuggested && !isInProgress && (
                  <Badge className="bg-accent text-accent-foreground text-xs">
                    Sugerida
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">{mission.subtitle}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span>{mission.questions.length} perguntas</span>
                <span>+{totalPoints} pts</span>
                <span>📸 até 5 fotos</span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default MeuEstilo;
