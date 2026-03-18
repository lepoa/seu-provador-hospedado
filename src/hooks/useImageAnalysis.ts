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
  decote: FieldAnalysis;
  manga_alca: FieldAnalysis;
  comprimento: FieldAnalysis;
  textura: FieldAnalysis;
  tags_extras: string[];
  resumo_visual?: string;
}

function normalizeFieldAnalysis(value: unknown): FieldAnalysis {
  if (!value || typeof value !== "object") {
    return { value: null, confidence: 0 };
  }

  const input = value as Record<string, unknown>;
  const normalizedValue = typeof input.value === "string" ? input.value : null;
  const confidence =
    typeof input.confidence === "number" && Number.isFinite(input.confidence)
      ? Math.max(0, Math.min(1, input.confidence))
      : 0;
  const alternatives = Array.isArray(input.alternatives)
    ? input.alternatives.filter((item): item is string => typeof item === "string")
    : undefined;

  return { value: normalizedValue, confidence, alternatives };
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 10);
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? [normalized] : [];
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 10);
  }

  return [];
}

function normalizeAnalysisResult(raw: unknown): ImageAnalysisResult {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  return {
    categoria: normalizeFieldAnalysis(input.categoria),
    cor: normalizeFieldAnalysis(input.cor),
    estilo: normalizeFieldAnalysis(input.estilo),
    ocasiao: normalizeFieldAnalysis(input.ocasiao),
    modelagem: normalizeFieldAnalysis(input.modelagem),
    decote: normalizeFieldAnalysis(input.decote),
    manga_alca: normalizeFieldAnalysis(input.manga_alca),
    comprimento: normalizeFieldAnalysis(input.comprimento),
    textura: normalizeFieldAnalysis(input.textura),
    tags_extras: normalizeTags(input.tags_extras),
    resumo_visual: typeof input.resumo_visual === "string" ? input.resumo_visual : undefined,
  };
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
        const normalized = normalizeAnalysisResult(data.analysis);
        setAnalysisResult(normalized);
        toast.success("Análise concluída! Confira as sugestões.");
        return normalized;
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
