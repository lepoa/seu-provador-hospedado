import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sparkles, ChevronDown, ChevronUp, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBusinessInsights } from "@/hooks/useBusinessInsights";
import { cn } from "@/lib/utils";

export function DashboardInsightsBlock() {
  const { insight, isLoading, isGenerating, generateInsights, trackDetailsClick } = useBusinessInsights();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleDetails = () => {
    if (!isExpanded && insight) {
      trackDetailsClick();
    }
    setIsExpanded(!isExpanded);
  };

  if (isLoading) {
    return (
      <Card className="border-amber-200/50 bg-gradient-to-br from-amber-50/50 to-orange-50/30">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>
    );
  }

  const hasInsights = insight && insight.insights.length > 0;
  const visibleInsights = isExpanded ? insight?.insights : insight?.insights.slice(0, 2);

  return (
    <Card className="border-amber-200/50 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10 dark:border-amber-800/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-900/40">
              <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle className="text-base font-medium text-amber-900 dark:text-amber-100">
              Leitura Inteligente
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={generateInsights}
            disabled={isGenerating}
            className="h-7 px-2 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-100/50 dark:text-amber-400 dark:hover:bg-amber-900/30"
          >
            {isGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        {insight && (
          <p className="text-[11px] text-amber-600/70 dark:text-amber-500/70 mt-1">
            Análise de {format(parseISO(insight.analysis_period_start), "dd/MM", { locale: ptBR })} a{" "}
            {format(parseISO(insight.analysis_period_end), "dd/MM", { locale: ptBR })}
          </p>
        )}
      </CardHeader>
      
      <CardContent className="pt-2">
        {!hasInsights ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Ainda não há análise para hoje
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={generateInsights}
              disabled={isGenerating}
              className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Gerar Análise
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleInsights?.map((text, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-2 text-sm leading-relaxed",
                  "text-amber-950/80 dark:text-amber-100/80"
                )}
              >
                <span className="text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0">•</span>
                <span className="italic">{text}</span>
              </div>
            ))}
            
            {insight.insights.length > 2 && (
              <button
                onClick={handleToggleDetails}
                className="flex items-center gap-1 text-[11px] text-amber-600/70 hover:text-amber-700 dark:text-amber-500/70 dark:hover:text-amber-400 mt-2 transition-colors"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    <span>ver menos</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    <span>ver detalhes ({insight.insights.length - 2} mais)</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
