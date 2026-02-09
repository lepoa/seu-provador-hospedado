import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { QuizProgress } from "@/components/QuizProgress";
import { quizQuestions, calculateStyleProfile } from "@/lib/quizData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Answer {
  questionId: number;
  answer: string;
  points: typeof quizQuestions[0]["options"][0]["points"];
}

const Quiz = () => {
  const navigate = useNavigate();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const question = quizQuestions[currentQuestion];
  const isLastQuestion = currentQuestion === quizQuestions.length - 1;
  const canProceed = selectedOption !== null;

  const handleSelectOption = (optionIndex: number) => {
    setSelectedOption(optionIndex);
  };

  const handleNext = async () => {
    if (selectedOption === null) return;

    const option = question.options[selectedOption];
    const newAnswer: Answer = {
      questionId: question.id,
      answer: option.text,
      points: option.points,
    };

    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);

    if (isLastQuestion) {
      setIsSubmitting(true);
      try {
        // Calculate style profile
        const profile = calculateStyleProfile(updatedAnswers);
        
        // Create customer record
        const { data: customer, error: customerError } = await supabase
          .from("customers")
          .insert({
            phone: "",
            style_title: profile.title,
          })
          .select()
          .single();

        if (customerError) throw customerError;

        // Save quiz responses
        const quizResponses = updatedAnswers.map((answer, index) => ({
          customer_id: customer.id,
          question_number: index + 1,
          question: quizQuestions[index].question,
          answer: answer.answer,
          points: Object.values(answer.points).reduce((a, b) => a + b, 0),
        }));

        const { error: responsesError } = await supabase
          .from("quiz_responses")
          .insert(quizResponses);

        if (responsesError) throw responsesError;

        // Navigate to results with customer id
        navigate(`/resultado/${customer.id}`);
      } catch (error) {
        console.error("Error saving quiz:", error);
        toast.error("Ops! Algo deu errado. Tente novamente.");
        setIsSubmitting(false);
      }
    } else {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedOption(null);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      setAnswers(answers.slice(0, -1));
      setSelectedOption(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <QuizProgress 
          current={currentQuestion + 1} 
          total={quizQuestions.length} 
        />

        <div className="mt-10 animate-fade-in" key={currentQuestion}>
          {question.subtext && (
            <p className="text-accent text-sm mb-2">{question.subtext}</p>
          )}
          
          <h2 className="font-serif text-2xl md:text-3xl mb-8">
            {question.question}
          </h2>

          <div className="space-y-3">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleSelectOption(index)}
                className={`quiz-option w-full text-left ${
                  selectedOption === index ? "quiz-option-selected" : ""
                }`}
              >
                <span className="font-medium">{option.text}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 flex gap-4">
          {currentQuestion > 0 && (
            <Button 
              variant="outline" 
              onClick={handlePrevious}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          )}
          
          <Button 
            onClick={handleNext}
            disabled={!canProceed || isSubmitting}
            className="flex-1 gap-2"
          >
            {isSubmitting ? (
              "Analisando..."
            ) : isLastQuestion ? (
              "Ver meu resultado"
            ) : (
              <>
                Próxima
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Quiz;
