import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BusinessInsight {
  id: string;
  insight_date: string;
  analysis_period_start: string;
  analysis_period_end: string;
  insights: string[];
  details_clicked_at: string | null;
  created_at: string;
}

export function useBusinessInsights() {
  const [insight, setInsight] = useState<BusinessInsight | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchTodayInsight = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      
      const { data, error } = await supabase
        .from("ai_business_insights")
        .select("*")
        .eq("insight_date", today)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setInsight({
          id: data.id,
          insight_date: data.insight_date,
          analysis_period_start: data.analysis_period_start,
          analysis_period_end: data.analysis_period_end,
          insights: (data.insights as string[]) || [],
          details_clicked_at: data.details_clicked_at,
          created_at: data.created_at,
        });
      } else {
        setInsight(null);
      }
    } catch (error) {
      console.error("Error fetching insights:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generateInsights = useCallback(async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-business-insights");
      
      if (error) throw error;
      
      if (data?.insights) {
        await fetchTodayInsight();
        toast.success("Análise atualizada com sucesso");
      }
    } catch (error) {
      console.error("Error generating insights:", error);
      toast.error("Erro ao gerar análise");
    } finally {
      setIsGenerating(false);
    }
  }, [fetchTodayInsight]);

  const trackDetailsClick = useCallback(async () => {
    if (!insight?.id) return;
    
    try {
      await supabase
        .from("ai_business_insights")
        .update({ details_clicked_at: new Date().toISOString() })
        .eq("id", insight.id);
      
      setInsight(prev => prev ? { ...prev, details_clicked_at: new Date().toISOString() } : null);
    } catch (error) {
      console.error("Error tracking click:", error);
    }
  }, [insight?.id]);

  useEffect(() => {
    fetchTodayInsight();
  }, [fetchTodayInsight]);

  return {
    insight,
    isLoading,
    isGenerating,
    generateInsights,
    trackDetailsClick,
    refetch: fetchTodayInsight,
  };
}
