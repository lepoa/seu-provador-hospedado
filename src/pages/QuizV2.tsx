import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Sparkles, Loader2, Star, Lock, Camera, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Header } from "@/components/Header";
import { QuizProgressV2 } from "@/components/QuizProgressV2";
import { QuizOptionCard } from "@/components/QuizOptionCard";
import { SizeSelector } from "@/components/SizeSelector";
import { PointsAnimation } from "@/components/PointsAnimation";
import { QuizPhotoUploadStep } from "@/components/QuizPhotoUploadStep";
import { 
  quizQuestionsV2, 
  calculateStyleProfileV2, 
  getLevelFromPoints, 
  getQuestionPoints,
  OPEN_FIELD_BONUS,
  PHOTO_UPLOAD_BONUS
} from "@/lib/quizDataV2";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useConfetti } from "@/hooks/useConfetti";
import { useAuth } from "@/hooks/useAuth";

interface Answer {
  questionId: number;
  question: string;
  answer: string;
  points: { elegante: number; classica: number; minimal: number; romantica: number };
  earnedPoints: number;
}

interface InspirationPhoto {
  url: string;
  analysis?: any;
  isAnalyzing: boolean;
}

const QuizV2 = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRedoMode = searchParams.get("redo") === "true";
  const { user, isLoading: authLoading } = useAuth();
  const { firePoints, fireLevelUp } = useConfetti();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedLetterSize, setSelectedLetterSize] = useState<string | null>(null);
  const [selectedNumberSize, setSelectedNumberSize] = useState<string | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [inspirationPhotos, setInspirationPhotos] = useState<InspirationPhoto[]>([]);
  const [photoPoints, setPhotoPoints] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [existingPoints, setExistingPoints] = useState(0);
  const [pointsJustEarned, setPointsJustEarned] = useState(0);
  const [showPointsAnimation, setShowPointsAnimation] = useState(false);
  const [previousLevel, setPreviousLevel] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/entrar?redirect=/quiz", { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Load existing points if in redo mode
  useEffect(() => {
    const loadExistingPoints = async () => {
      if (user && isRedoMode) {
        const { data } = await supabase
          .from("profiles")
          .select("quiz_points")
          .eq("user_id", user.id)
          .single();
        
        if (data?.quiz_points) {
          setExistingPoints(data.quiz_points);
        }
      }
    };
    loadExistingPoints();
  }, [user, isRedoMode]);

  const question = quizQuestionsV2[currentQuestion];
  const isLastQuestion = currentQuestion === quizQuestionsV2.length - 1;
  const isSizeQuestion = question?.type === "size";
  const isPhotosQuestion = question?.type === "photos";
  const isOpenQuestion = question?.type === "open";
  
  // Can always proceed on photos (optional) and open questions
  const canProceed = isSizeQuestion 
    ? (selectedLetterSize !== null || selectedNumberSize !== null)
    : isPhotosQuestion || isOpenQuestion
      ? true
      : selectedOption !== null;

  // Check for level up
  const checkLevelUp = useCallback((newPoints: number) => {
    const { level: newLevel } = getLevelFromPoints(newPoints);
    if (newLevel > previousLevel) {
      setPreviousLevel(newLevel);
      setTimeout(() => {
        fireLevelUp();
        toast.success(`🏆 Parabéns! Você alcançou o Nível ${newLevel}!`, {
          duration: 3000,
        });
      }, 800);
    }
  }, [previousLevel, fireLevelUp]);

  // Clear animation after showing points
  useEffect(() => {
    if (pointsJustEarned > 0) {
      const timer = setTimeout(() => setPointsJustEarned(0), 1500);
      return () => clearTimeout(timer);
    }
  }, [pointsJustEarned]);

  const handleSelectOption = (optionIndex: number) => {
    setSelectedOption(optionIndex);
  };

  const handleSelectLetterSize = (size: string | null) => {
    setSelectedLetterSize(size);
  };

  const handleSelectNumberSize = (size: string | null) => {
    setSelectedNumberSize(size);
  };

  const handlePhotosChange = (photos: InspirationPhoto[], totalPhotoPoints: number) => {
    setInspirationPhotos(photos);
    setPhotoPoints(totalPhotoPoints);
  };

  const handlePhotoPointsEarned = (points: number) => {
    // In redo mode, don't add photo points
    if (isRedoMode) return;
    
    const newTotal = totalPoints + points;
    setTotalPoints(newTotal);
    setPointsJustEarned(points);
    setShowPointsAnimation(true);
    firePoints(points);
    checkLevelUp(newTotal);
  };

  const handleNext = async () => {
    // Photos question - just move to next (points already awarded on upload)
    if (isPhotosQuestion) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentQuestion(currentQuestion + 1);
        setSelectedOption(null);
        setIsTransitioning(false);
      }, 300);
      return;
    }

    // Open question - award points if filled, then move on
    if (isOpenQuestion) {
      // In redo mode, don't add new points
      const earnedPoints = isRedoMode ? 0 : (additionalNotes.trim() ? OPEN_FIELD_BONUS : 0);
      
      if (earnedPoints > 0) {
        const newTotal = totalPoints + earnedPoints;
        setTotalPoints(newTotal);
        setPointsJustEarned(earnedPoints);
        setShowPointsAnimation(true);
        firePoints(earnedPoints);
        checkLevelUp(newTotal);
      }

      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentQuestion(currentQuestion + 1);
        setSelectedOption(null);
        setIsTransitioning(false);
      }, 300);
      return;
    }

    // Size question - final step, submit everything
    if (isSizeQuestion) {
      if (!selectedLetterSize && !selectedNumberSize) return;
      
      setIsSubmitting(true);
      try {
        const earnedPoints = isRedoMode ? 0 : getQuestionPoints(question.pointsType);
        // In redo mode, keep existing points; otherwise calculate new total
        const finalPoints = isRedoMode ? existingPoints : totalPoints + earnedPoints;
        
        // Calculate style profile from answers
        const profile = calculateStyleProfileV2(answers);
        
        // Prepare quiz data for AI analysis
        const quizAnswers = answers.map(a => ({
          question: a.question,
          answer: a.answer,
          points: a.earnedPoints,
        }));

        // Call AI to analyze quiz
        const sizeDisplay = [selectedLetterSize, selectedNumberSize].filter(Boolean).join(" / ");
        let aiAnalysis = null;
        try {
          const { data, error } = await supabase.functions.invoke("analyze-quiz", {
            body: {
              answers: quizAnswers,
              size: sizeDisplay,
              additionalNotes: additionalNotes || undefined,
              totalPoints: finalPoints,
              inspirationPhotos: inspirationPhotos.filter(p => p.analysis).map(p => ({
                url: p.url,
                analysis: p.analysis,
              })),
            },
          });
          if (!error && data && !data.error) {
            aiAnalysis = data;
          }
        } catch (aiError) {
          console.log("AI analysis skipped:", aiError);
        }

        // Get user profile data (name and whatsapp) for customer record
        let userName = "";
        let userWhatsapp = "";
        let userEmail = "";
        
        if (user) {
          // First try to get from profiles table
          const { data: profileData } = await supabase
            .from("profiles")
            .select("name, whatsapp, full_name")
            .eq("user_id", user.id)
            .maybeSingle();
          
          userName = profileData?.full_name || profileData?.name || user.user_metadata?.name || "";
          userWhatsapp = profileData?.whatsapp || user.user_metadata?.whatsapp || "";
          userEmail = user.email || "";
        }

        // Create customer record linked to user with all available data
        const { data: customer, error: customerError } = await supabase
          .from("customers")
          .insert({
            phone: userWhatsapp,
            name: userName,
            email: userEmail || null,
            style_title: aiAnalysis?.styleTitle || profile.title,
            size_letter: selectedLetterSize,
            size_number: selectedNumberSize,
            user_id: user?.id,
          })
          .select()
          .single();

        if (customerError) throw customerError;

        // Update user profile with quiz data
        if (user) {
          const { level } = getLevelFromPoints(finalPoints);
          
          // Extract patterns from inspiration photos
          const photoPatterns = inspirationPhotos
            .filter(p => p.analysis)
            .map(p => p.analysis);
          
          const topColors = photoPatterns
            .map(a => a?.cor?.value)
            .filter(Boolean)
            .slice(0, 3);

          await supabase
            .from("profiles")
            .update({
              size_letter: selectedLetterSize,
              size_number: selectedNumberSize,
              style_title: aiAnalysis?.styleTitle || profile.title,
              quiz_points: finalPoints,
              quiz_level: level,
              quiz_completed_at: new Date().toISOString(),
              style_description: aiAnalysis?.description || profile.description,
              color_palette: aiAnalysis?.colorPalette || [...topColors, ...(profile.colorPalette || [])].slice(0, 5),
              personal_tip: aiAnalysis?.personalTip,
              avoid_items: aiAnalysis?.avoidColors || [],
            })
            .eq("user_id", user.id);
        }

        // Save quiz responses with user_id
        const quizResponses = answers.map((answer, index) => ({
          customer_id: customer.id,
          user_id: user?.id,
          question_number: index + 1,
          question: answer.question,
          answer: answer.answer,
          points: answer.earnedPoints,
        }));

        // Add photos as a response
        if (inspirationPhotos.length > 0) {
          quizResponses.push({
            customer_id: customer.id,
            user_id: user?.id,
            question_number: answers.length + 1,
            question: "Fotos de inspiração",
            answer: `${inspirationPhotos.length} fotos enviadas`,
            points: photoPoints,
          });
        }

        // Add notes if provided
        if (additionalNotes) {
          quizResponses.push({
            customer_id: customer.id,
            user_id: user?.id,
            question_number: answers.length + 2,
            question: "Quer me contar mais?",
            answer: additionalNotes,
            points: additionalNotes.trim() ? OPEN_FIELD_BONUS : 0,
          });
        }

        // Add size as a response
        if (selectedLetterSize || selectedNumberSize) {
          const sizeAnswer = [selectedLetterSize, selectedNumberSize].filter(Boolean).join(" e ");
          quizResponses.push({
            customer_id: customer.id,
            user_id: user?.id,
            question_number: answers.length + 3,
            question: "Qual é o seu tamanho?",
            answer: sizeAnswer,
            points: earnedPoints,
          });
        }

        const { error: responsesError } = await supabase
          .from("quiz_responses")
          .insert(quizResponses);

        if (responsesError) throw responsesError;

        // Navigate to results with customer id and AI analysis
        navigate(`/resultado/${customer.id}`, {
          state: { 
            aiAnalysis, 
            totalPoints: finalPoints,
            sizeLetter: selectedLetterSize,
            sizeNumber: selectedNumberSize,
            showCelebration: true,
            profile,
          },
        });
      } catch (error) {
        console.error("Error saving quiz:", error);
        toast.error("Ops! Algo deu errado. Tente novamente.");
        setIsSubmitting(false);
      }
      return;
    }

    // Regular single-choice question
    if (selectedOption === null || !question.options) return;

    const option = question.options[selectedOption];
    // In redo mode, don't add points
    const earnedPoints = isRedoMode ? 0 : getQuestionPoints(question.pointsType);
    
    const newAnswer: Answer = {
      questionId: question.id,
      question: question.question,
      answer: option.text,
      points: option.points,
      earnedPoints,
    };

    const newTotalPoints = totalPoints + earnedPoints;
    
    // Fire confetti for points (only if earning new points)
    if (earnedPoints > 0) {
      firePoints(earnedPoints);
      setShowPointsAnimation(true);
      setPointsJustEarned(earnedPoints);
      checkLevelUp(newTotalPoints);
    }
    
    setAnswers([...answers, newAnswer]);
    setTotalPoints(newTotalPoints);
    
    // Animate transition
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedOption(null);
      setIsTransitioning(false);
    }, 300);
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      const prevQuestion = quizQuestionsV2[currentQuestion - 1];
      
      // If going back from photos, don't remove photo points (they stay)
      // If going back from open, remove open points if they were added
      // If going back from size, just go back
      // If going back from regular question, remove the answer
      
      if (prevQuestion.type === "single") {
        const lastAnswer = answers[answers.length - 1];
        if (lastAnswer) {
          setTotalPoints(prev => prev - lastAnswer.earnedPoints);
          setAnswers(answers.slice(0, -1));
        }
      }
      
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentQuestion(currentQuestion - 1);
        setSelectedOption(null);
        setIsTransitioning(false);
      }, 150);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Show message if not logged in (brief flash before redirect)
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Redirecionando para login...</p>
        </div>
      </div>
    );
  }

  // Get current question points for display
  const currentQuestionPoints = question ? getQuestionPoints(question.pointsType) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      {/* Points Animation Overlay */}
      <PointsAnimation 
        points={pointsJustEarned} 
        show={showPointsAnimation}
        onComplete={() => setShowPointsAnimation(false)}
      />
      
      <main className="flex-1 container mx-auto px-4 py-6 max-w-2xl">
        {/* Redo Mode Banner */}
        {isRedoMode && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-sm text-amber-800">
            <RotateCcw className="h-4 w-4 flex-shrink-0" />
            <span>
              Você está refazendo o quiz. <strong>Seus pontos serão mantidos</strong> — apenas seu perfil de estilo será atualizado.
            </span>
          </div>
        )}
        
        <QuizProgressV2 
          current={currentQuestion + 1} 
          total={quizQuestionsV2.length}
          points={isRedoMode ? existingPoints : totalPoints}
          pointsJustEarned={isRedoMode ? 0 : pointsJustEarned}
        />

        <div 
          className={`mt-8 transition-all duration-300 ease-out ${
            isTransitioning 
              ? "opacity-0 translate-y-4" 
              : "opacity-100 translate-y-0"
          }`}
          key={currentQuestion}
        >
          {question.subtext && (
            <p className="text-accent text-sm mb-2 font-medium animate-slide-in-up">{question.subtext}</p>
          )}
          
          <h2 className="font-serif text-2xl md:text-3xl mb-6 animate-slide-in-up" style={{ animationDelay: "50ms" }}>
            {question.question}
          </h2>

          {/* Photos Question */}
          {isPhotosQuestion && (
            <div className="animate-slide-in-up" style={{ animationDelay: "100ms" }}>
              <QuizPhotoUploadStep
                userId={user.id}
                photos={inspirationPhotos}
                onPhotosChange={handlePhotosChange}
                onPointsEarned={handlePhotoPointsEarned}
              />
            </div>
          )}

          {/* Open Question */}
          {isOpenQuestion && (
            <div className="animate-slide-in-up" style={{ animationDelay: "100ms" }}>
              <p className="text-muted-foreground mb-4">
                Cores favoritas, ocasiões especiais, peças que ama ou evita...
              </p>

              <Textarea
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Ex: Adoro peças confortáveis pra trabalhar de casa, gosto muito de azul e verde, evito estampas muito grandes..."
                className="min-h-[120px] focus:ring-2 focus:ring-accent transition-all"
              />
              
              {additionalNotes.trim() && (
                <p className="text-sm text-amber-600 mt-2 flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                  Você vai ganhar +{OPEN_FIELD_BONUS} pontos bônus!
                </p>
              )}
            </div>
          )}

          {/* Size Question */}
          {isSizeQuestion && (
            <div className="animate-slide-in-up" style={{ animationDelay: "100ms" }}>
              <SizeSelector 
                selectedLetterSize={selectedLetterSize}
                selectedNumberSize={selectedNumberSize}
                onSelectLetter={handleSelectLetterSize}
                onSelectNumber={handleSelectNumberSize}
              />
            </div>
          )}

          {/* Regular Single Choice Question */}
          {question.type === "single" && (
            <div className="space-y-3">
              {question.options?.map((option, index) => (
                <div 
                  key={index} 
                  className="animate-slide-in-up"
                  style={{ animationDelay: `${100 + index * 50}ms` }}
                >
                  <QuizOptionCard
                    text={option.text}
                    emoji={option.emoji}
                    imageUrl={option.imageUrl}
                    isSelected={selectedOption === index}
                    onClick={() => handleSelectOption(index)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 flex gap-4">
          {currentQuestion > 0 && (
            <Button 
              variant="outline" 
              onClick={handlePrevious}
              className="gap-2 transition-all hover:scale-105"
              disabled={isSubmitting || isTransitioning}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          )}
          
          <Button 
            onClick={handleNext}
            disabled={!canProceed || isSubmitting || isTransitioning}
            className="flex-1 gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparando seu resultado...
              </>
            ) : isLastQuestion ? (
              <>
                <Sparkles className="h-4 w-4 animate-pulse" />
                Descobrir meu estilo
              </>
            ) : isPhotosQuestion ? (
              <>
                {inspirationPhotos.length > 0 ? "Continuar" : "Pular"}
                <ArrowRight className="h-4 w-4" />
              </>
            ) : isOpenQuestion ? (
              <>
                {additionalNotes.trim() ? "Continuar" : "Pular"}
                <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              <>
                Próxima
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
        
        {/* Points hint */}
        {question && question.type === "single" && (
          <p className="text-center text-xs text-muted-foreground mt-4 animate-fade-in">
            Esta pergunta vale <span className="font-medium text-amber-600">+{currentQuestionPoints} pontos</span>
          </p>
        )}
        
        {question && question.type === "photos" && (
          <p className="text-center text-xs text-muted-foreground mt-4 animate-fade-in">
            Cada foto vale <span className="font-medium text-amber-600">+{PHOTO_UPLOAD_BONUS} pontos</span>
          </p>
        )}
        
        {question && question.type === "open" && (
          <p className="text-center text-xs text-muted-foreground mt-4 animate-fade-in">
            Este campo vale <span className="font-medium text-amber-600">+{OPEN_FIELD_BONUS} pontos</span> se preenchido
          </p>
        )}
      </main>
    </div>
  );
};

export default QuizV2;
