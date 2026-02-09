import { Sparkles, Copy, Palette, Ban, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface QuizResponse {
  id: string;
  question: string;
  answer: string;
  question_number: number;
  points: number | null;
}

interface ProfileData {
  style_title: string | null;
  style_description: string | null;
  color_palette: string[] | null;
  avoid_items: string[] | null;
  personal_tip: string | null;
  size_letter: string | null;
  size_number: string | null;
  quiz_points: number | null;
  quiz_level: number | null;
  quiz_completed_at: string | null;
}

interface StyleProfileProps {
  customer: {
    name: string | null;
    style_title: string | null;
    size_letter: string | null;
    size_number: string | null;
  };
  profileData: ProfileData | null;
  quizResponses: QuizResponse[];
  quizLink: string;
}

export function StyleProfile({ customer, profileData, quizResponses, quizLink }: StyleProfileProps) {
  // Check if quiz was completed - use profile data OR customer style_title OR quiz responses
  const hasQuiz = quizResponses.length > 0 || !!customer.style_title || !!profileData?.style_title;

  const copyQuizInvite = () => {
    const message = `Oi ${customer.name || ""}! ✨ Fizemos uma consultoria rápida no Provador VIP. Quer descobrir seu estilo e receber sugestões no seu tamanho? Responde em 2 min: ${quizLink}`;
    navigator.clipboard.writeText(message);
    toast.success("Mensagem copiada!");
  };

  if (!hasQuiz) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="py-8 text-center">
          <Sparkles className="h-12 w-12 mx-auto mb-4 text-amber-500" />
          <h3 className="font-medium text-lg mb-2">
            Cliente ainda não completou o Quiz
          </h3>
          <p className="text-muted-foreground text-sm mb-4">
            Envie um convite personalizado para conhecer o estilo dela
          </p>
          <Button onClick={copyQuizInvite} variant="outline" className="gap-2">
            <Copy className="h-4 w-4" />
            Copiar convite para Quiz
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Perfil de Estilo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quiz Stats */}
        {profileData?.quiz_points && (
          <div className="flex items-center gap-4 p-3 bg-primary/5 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Pontos VIP</p>
              <p className="text-xl font-bold text-primary">⭐ {profileData.quiz_points} pts</p>
            </div>
            {profileData.quiz_level && (
              <div>
                <p className="text-sm text-muted-foreground">Nível</p>
                <p className="font-medium">Nível {profileData.quiz_level}</p>
              </div>
            )}
          </div>
        )}

        {/* Style title */}
        {customer.style_title && (
          <div>
            <p className="text-sm text-muted-foreground mb-1">Estilo Principal</p>
            <Badge variant="default" className="text-base px-3 py-1">
              ✨ {customer.style_title}
            </Badge>
          </div>
        )}

        {/* Sizes */}
        {(customer.size_letter || customer.size_number) && (
          <div>
            <p className="text-sm text-muted-foreground mb-1">Tamanhos</p>
            <div className="flex gap-2">
              {customer.size_letter && (
                <Badge variant="secondary">Letra: {customer.size_letter}</Badge>
              )}
              {customer.size_number && (
                <Badge variant="secondary">Número: {customer.size_number}</Badge>
              )}
            </div>
          </div>
        )}

        {/* Style description */}
        {profileData?.style_description && (
          <div>
            <p className="text-sm text-muted-foreground mb-1">Descrição do Estilo</p>
            <p className="text-sm">{profileData.style_description}</p>
          </div>
        )}

        {/* Color palette */}
        {profileData?.color_palette && profileData.color_palette.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
              <Palette className="h-4 w-4" />
              Paleta de Cores
            </p>
            <div className="flex flex-wrap gap-2">
              {profileData.color_palette.map((color, i) => (
                <Badge key={i} variant="outline">{color}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Avoid items */}
        {profileData?.avoid_items && profileData.avoid_items.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
              <Ban className="h-4 w-4" />
              Não gosta / Evitar
            </p>
            <div className="flex flex-wrap gap-2">
              {profileData.avoid_items.map((item, i) => (
                <Badge key={i} variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Personal tip */}
        {profileData?.personal_tip && (
          <div>
            <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              Comentário da cliente
            </p>
            <p className="text-sm italic bg-secondary/50 p-3 rounded-lg">
              "{profileData.personal_tip}"
            </p>
          </div>
        )}

        {/* Quiz responses */}
        {quizResponses.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-3">Respostas do Quiz</p>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {quizResponses.map((response) => (
                <div key={response.id} className="text-sm">
                  <p className="text-muted-foreground">
                    {response.question_number}. {response.question}
                  </p>
                  <p className="font-medium text-primary">{response.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
