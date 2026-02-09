import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Sparkles, Loader2, Star, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { QuizOptionCard } from "@/components/QuizOptionCard";
import { PointsAnimation } from "@/components/PointsAnimation";
import { MissionPhotoUpload } from "@/components/MissionPhotoUpload";
import { MissionCompletionScreen } from "@/components/MissionCompletionScreen";
import { 
  getMissionById, 
  getAvailableMissions,
  Mission, 
  MISSION_POINTS 
} from "@/lib/missionsData";
import { getLevelFromPoints } from "@/lib/quizDataV2";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useConfetti } from "@/hooks/useConfetti";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface MissionAnswer {
  questionId: number;
  answer: string;
  styleBonus: { elegante: number; classica: number; minimal: number; romantica: number };
}

interface UploadedPhoto {
  url: string;
  analysis: Record<string, unknown> | null;
  isAnalyzing: boolean;
}

const MissionQuiz = () => {
  const navigate = useNavigate();
  const { missionId } = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const { firePoints, fireLevelUp, fireConfetti } = useConfetti();
  
  const [mission, setMission] = useState<Mission | null>(null);
  const [currentStep, setCurrentStep] = useState(0); // 0 to N-1 for questions, N for photos
  const [answers, setAnswers] = useState<MissionAnswer[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [photoPoints, setPhotoPoints] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showPointsAnimation, setShowPointsAnimation] = useState(false);
  const [animationPoints, setAnimationPoints] = useState(10);
  const [previousLevel, setPreviousLevel] = useState(1);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [newLevel, setNewLevel] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [existingAttempt, setExistingAttempt] = useState<string | null>(null);
  const [nextMission, setNextMission] = useState<{ id: string; name: string } | null>(null);

  // Load mission data and user points
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/entrar?redirect=/missao/" + missionId, { replace: true });
      return;
    }

    const foundMission = getMissionById(missionId || "");
    if (!foundMission) {
      toast.error("Missão não encontrada");
      navigate("/minha-conta");
      return;
    }
    setMission(foundMission);

    // Load user's current points and check for existing attempt
    if (user) {
      loadUserData();
    }
  }, [missionId, user, authLoading, navigate]);

  const loadUserData = async () => {
    if (!user || !missionId) return;

    // Load profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("quiz_points, quiz_level, completed_missions")
      .eq("user_id", user.id)
      .single();

    if (profile) {
      setCurrentPoints(profile.quiz_points || 0);
      setPreviousLevel(profile.quiz_level || 1);
      
      // Check if already completed
      const completed = (profile.completed_missions as string[]) || [];
      if (completed.includes(missionId)) {
        toast.info("Você já completou essa missão!");
        navigate("/minha-conta");
        return;
      }

      // Get next recommended mission
      const availableMissions = getAvailableMissions([...completed, missionId]);
      if (availableMissions.length > 0) {
        setNextMission({ id: availableMissions[0].id, name: availableMissions[0].title });
      }
    }

    // Check for in-progress attempt
    const { data: attempt } = await supabase
      .from("mission_attempts")
      .select("*")
      .eq("user_id", user.id)
      .eq("mission_id", missionId)
      .eq("status", "in_progress")
      .maybeSingle();

    if (attempt) {
      setExistingAttempt(attempt.id);
      setCurrentStep(attempt.current_question || 0);
      // Cast JSON to expected type
      const savedAnswers = attempt.answers_json as unknown as MissionAnswer[] | null;
      setAnswers(savedAnswers || []);
      // Restore photos if any
      if (attempt.images_urls && (attempt.images_urls as string[]).length > 0) {
        const restoredPhotos = (attempt.images_urls as string[]).map(url => ({
          url,
          analysis: null,
          isAnalyzing: false,
        }));
        setPhotos(restoredPhotos);
        setPhotoPoints(restoredPhotos.length * MISSION_POINTS.photoUpload);
      }
    }
  };

  if (!mission || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  const totalQuestions = mission.questions.length;
  const isPhotoStep = currentStep === totalQuestions;
  const isLastQuestionStep = currentStep === totalQuestions - 1;
  const question = !isPhotoStep ? mission.questions[currentStep] : null;

  const handleSelectOption = (optionIndex: number) => {
    setSelectedOption(optionIndex);
  };

  const handlePhotosChange = (updatedPhotos: UploadedPhoto[]) => {
    setPhotos(updatedPhotos);
  };

  const handlePhotoPointsEarned = (points: number) => {
    setPhotoPoints(prev => prev + points);
    setAnimationPoints(points);
    setShowPointsAnimation(true);
    firePoints(points);
  };

  const saveProgress = async (step: number, currentAnswers: MissionAnswer[]) => {
    if (!user || !missionId) return;

    const attemptData = {
      user_id: user.id,
      mission_id: missionId,
      status: "in_progress",
      current_question: step,
      answers_json: JSON.parse(JSON.stringify(currentAnswers)),
      images_urls: photos.map(p => p.url),
      score_earned: 0,
    };

    if (existingAttempt) {
      await supabase
        .from("mission_attempts")
        .update(attemptData)
        .eq("id", existingAttempt);
    } else {
      const { data } = await supabase
        .from("mission_attempts")
        .insert([attemptData])
        .select("id")
        .single();
      
      if (data) {
        setExistingAttempt(data.id);
      }
    }
  };

  const completeMission = async () => {
    if (!user || !mission) return;

    setIsSubmitting(true);
    try {
      // Calculate total points earned
      const questionPoints = answers.length * MISSION_POINTS.perQuestion;
      const totalEarned = questionPoints + photoPoints + MISSION_POINTS.completionBonus;
      const newTotalPoints = currentPoints + totalEarned;
      const { level: calculatedNewLevel } = getLevelFromPoints(newTotalPoints);

      setEarnedPoints(totalEarned);
      setNewLevel(calculatedNewLevel);

      // Aggregate analysis from photos - serialize for JSON storage
      const analysisResults = photos
        .filter(p => p.analysis)
        .map(p => JSON.parse(JSON.stringify(p.analysis)));

      // Update mission attempt to completed
      if (existingAttempt) {
        await supabase
          .from("mission_attempts")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            score_earned: totalEarned,
            images_urls: photos.map(p => p.url),
            analysis_json: JSON.parse(JSON.stringify({ photos: analysisResults })),
          })
          .eq("id", existingAttempt);
      } else {
        await supabase
          .from("mission_attempts")
          .insert([{
            user_id: user.id,
            mission_id: mission.id,
            status: "completed",
            completed_at: new Date().toISOString(),
            current_question: totalQuestions,
            answers_json: JSON.parse(JSON.stringify(answers)),
            score_earned: totalEarned,
            images_urls: photos.map(p => p.url),
            analysis_json: JSON.parse(JSON.stringify({ photos: analysisResults })),
          }]);
      }

      // Also log to missions_log for backwards compatibility
      await supabase.from("missions_log").insert([{
        user_id: user.id,
        mission_id: mission.id,
        points_earned: totalEarned,
        answers: JSON.parse(JSON.stringify(answers)),
      }]);

      // Update profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("completed_missions, quiz_points, quiz_level")
        .eq("user_id", user.id)
        .single();

      const completedMissions = [...((profile?.completed_missions as string[]) || []), mission.id];

      await supabase
        .from("profiles")
        .update({
          quiz_points: newTotalPoints,
          quiz_level: calculatedNewLevel,
          completed_missions: completedMissions,
          last_mission_id: mission.id,
          last_mission_completed_at: new Date().toISOString(),
          suggestions_updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      // Check for level up
      if (calculatedNewLevel > previousLevel) {
        setTimeout(() => {
          fireLevelUp();
          toast.success(`🏆 Você subiu para o Nível ${calculatedNewLevel}!`);
        }, 500);
      }

      // Fire celebration
      fireConfetti({ type: "celebration" });
      setCurrentPoints(newTotalPoints);
      setIsCompleted(true);
      
    } catch (error) {
      console.error("Error completing mission:", error);
      toast.error("Erro ao salvar missão");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (isPhotoStep) {
      // Complete mission
      await completeMission();
      return;
    }

    if (selectedOption === null || !question) return;

    const option = question.options[selectedOption];
    const newAnswer: MissionAnswer = {
      questionId: question.id,
      answer: option.text,
      styleBonus: option.styleBonus,
    };

    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);

    // Award points for question
    setAnimationPoints(MISSION_POINTS.perQuestion);
    setShowPointsAnimation(true);
    firePoints(MISSION_POINTS.perQuestion);

    // Save progress
    await saveProgress(currentStep + 1, newAnswers);

    // Move to next step
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentStep(currentStep + 1);
      setSelectedOption(null);
      setIsTransitioning(false);
    }, 300);
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setIsTransitioning(true);
      setTimeout(() => {
        if (isPhotoStep) {
          setCurrentStep(totalQuestions - 1);
        } else {
          setCurrentStep(currentStep - 1);
          setAnswers(answers.slice(0, -1));
        }
        setSelectedOption(null);
        setIsTransitioning(false);
      }, 150);
    }
  };

  const handleSkipPhotos = async () => {
    await completeMission();
  };

  // Mission completed screen
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 max-w-lg">
          <MissionCompletionScreen
            mission={mission}
            earnedPoints={earnedPoints}
            totalPoints={currentPoints}
            previousLevel={previousLevel}
            newLevel={newLevel}
            nextMissionId={nextMission?.id}
            nextMissionName={nextMission?.name}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <PointsAnimation 
        points={animationPoints} 
        show={showPointsAnimation}
        onComplete={() => setShowPointsAnimation(false)}
      />
      
      <main className="flex-1 container mx-auto px-4 py-6 max-w-2xl">
        {/* Mission Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-accent/10 px-4 py-2 rounded-full mb-3">
            <span className="text-2xl">{mission.emoji}</span>
            <span className="font-medium text-accent">{mission.title}</span>
          </div>
          <p className="text-sm text-muted-foreground">{mission.subtitle}</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">
              {isPhotoStep ? "Etapa bônus: Fotos" : `Pergunta ${currentStep + 1}/${totalQuestions}`}
            </span>
            <span className="text-amber-600 font-medium">
              +{MISSION_POINTS.perQuestion * totalQuestions + MISSION_POINTS.completionBonus} pts base
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-accent to-primary transition-all duration-500"
              style={{ width: `${((currentStep + 1) / (totalQuestions + 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Question or Photo Step */}
        <div 
          className={cn(
            "transition-all duration-300 ease-out",
            isTransitioning ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
          )}
          key={currentStep}
        >
          {isPhotoStep ? (
            <MissionPhotoUpload
              missionId={mission.id}
              userId={user?.id || ""}
              theme={mission.theme}
              photoPrompt={mission.photoPrompt}
              maxPhotos={5}
              onPhotosChange={handlePhotosChange}
              onPointsEarned={handlePhotoPointsEarned}
            />
          ) : question && (
            <>
              {question.subtext && (
                <p className="text-accent text-sm mb-2 font-medium animate-slide-in-up">
                  {question.subtext}
                </p>
              )}
              
              <h2 className="font-serif text-2xl md:text-3xl mb-6 animate-slide-in-up" style={{ animationDelay: "50ms" }}>
                {question.question}
              </h2>

              <div className="space-y-3">
                {question.options.map((option, index) => (
                  <div 
                    key={index} 
                    className="animate-slide-in-up"
                    style={{ animationDelay: `${100 + index * 50}ms` }}
                  >
                    <QuizOptionCard
                      text={option.text}
                      emoji={option.emoji}
                      isSelected={selectedOption === index}
                      onClick={() => handleSelectOption(index)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex gap-4">
          {currentStep > 0 && (
            <Button 
              variant="outline" 
              onClick={handlePrevious}
              className="gap-2"
              disabled={isSubmitting || isTransitioning}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          )}
          
          {isPhotoStep ? (
            <div className="flex-1 flex gap-2">
              <Button 
                variant="outline"
                onClick={handleSkipPhotos}
                disabled={isSubmitting}
                className="flex-1"
              >
                Pular fotos
              </Button>
              <Button 
                onClick={handleNext}
                disabled={isSubmitting}
                className="flex-1 gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Completar {photos.length > 0 && `(+${photoPoints} pts)`}
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button 
              onClick={handleNext}
              disabled={selectedOption === null || isSubmitting || isTransitioning}
              className="flex-1 gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : isLastQuestionStep ? (
                <>
                  <Camera className="h-4 w-4" />
                  Próximo: Fotos
                </>
              ) : (
                <>
                  Próxima
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default MissionQuiz;