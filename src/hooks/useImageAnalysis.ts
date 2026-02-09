import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FieldAnalysis {
  value: string | null;
  confidence: number;
  alternatives?: string[];
}

export interface ImageAnalysisResult {
  categoria: FieldAnalysis;
  cor: FieldAnalysis;
  estilo: FieldAnalysis;
  ocasiao: FieldAnalysis;
  modelagem: FieldAnalysis;
  tags_extras: string[];
}

export function useImageAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ImageAnalysisResult | null>(null);

  const analyzeImage = async (imageData: string): Promise<ImageAnalysisResult | null> => {
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      // Determine if it's a URL or base64 data
      const isUrl = imageData.startsWith("http://") || imageData.startsWith("https://");
      
      const body = isUrl 
        ? { image_url: imageData }
        : { image_base64: imageData };

      const { data, error } = await supabase.functions.invoke("analyze-product-image", {
        body,
      });

      if (error) {
        console.error("Edge function error:", error);
        toast.error("Erro ao analisar imagem");
        return null;
      }

      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      if (data?.success && data?.analysis) {
        setAnalysisResult(data.analysis);
        toast.success("Análise concluída! Confira as sugestões.");
        return data.analysis;
      }

      return null;
    } catch (err) {
      console.error("Error analyzing image:", err);
      toast.error("Erro ao conectar com o serviço de análise");
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearAnalysis = () => {
    setAnalysisResult(null);
  };

  return {
    isAnalyzing,
    analysisResult,
    analyzeImage,
    clearAnalysis,
  };
}
