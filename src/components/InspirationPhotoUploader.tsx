import { useState, useCallback } from "react";
import { Upload, X, Camera, Sparkles, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { PHOTO_UPLOAD_BONUS, getLevelFromPoints } from "@/lib/quizDataV2";

interface PhotoAnalysis {
  categoria: { value: string | null; confidence: number };
  cor: { value: string | null; confidence: number };
  estilo: { value: string | null; confidence: number };
  ocasiao: { value: string | null; confidence: number };
  modelagem: { value: string | null; confidence: number };
  tags_extras: string[];
}

interface InspirationPhoto {
  url: string;
  analysis?: PhotoAnalysis;
  isAnalyzing: boolean;
}

interface InspirationPhotoUploaderProps {
  onPhotosChange?: (photos: InspirationPhoto[]) => void;
  onPointsEarned?: (points: number, newTotal: number) => void;
  currentPoints: number;
}

const MAX_PHOTOS = 5;

export function InspirationPhotoUploader({
  onPhotosChange,
  onPointsEarned,
  currentPoints,
}: InspirationPhotoUploaderProps) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<InspirationPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [patternSummary, setPatternSummary] = useState<string | null>(null);

  const analyzePhoto = async (imageUrl: string): Promise<PhotoAnalysis | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("analyze-product-image", {
        body: { image_url: imageUrl },
      });

      if (error) {
        console.error("Analysis error:", error);
        return null;
      }

      if (data?.success && data?.analysis) {
        return data.analysis;
      }

      return null;
    } catch (err) {
      console.error("Error analyzing photo:", err);
      return null;
    }
  };

  const updateProfileWithPatterns = async (allPhotos: InspirationPhoto[]) => {
    if (!user) return;

    // Aggregate patterns from all analyzed photos
    const analyzedPhotos = allPhotos.filter(p => p.analysis);
    if (analyzedPhotos.length === 0) return;

    const patterns = {
      cores: new Map<string, number>(),
      estilos: new Map<string, number>(),
      categorias: new Map<string, number>(),
      tags: new Map<string, number>(),
    };

    analyzedPhotos.forEach(photo => {
      if (!photo.analysis) return;

      // Count occurrences
      if (photo.analysis.cor?.value) {
        const count = patterns.cores.get(photo.analysis.cor.value) || 0;
        patterns.cores.set(photo.analysis.cor.value, count + 1);
      }
      if (photo.analysis.estilo?.value) {
        const count = patterns.estilos.get(photo.analysis.estilo.value) || 0;
        patterns.estilos.set(photo.analysis.estilo.value, count + 1);
      }
      if (photo.analysis.categoria?.value) {
        const count = patterns.categorias.get(photo.analysis.categoria.value) || 0;
        patterns.categorias.set(photo.analysis.categoria.value, count + 1);
      }
      photo.analysis.tags_extras?.forEach(tag => {
        const count = patterns.tags.get(tag) || 0;
        patterns.tags.set(tag, count + 1);
      });
    });

    // Get top patterns
    const topColors = [...patterns.cores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
    const topStyles = [...patterns.estilos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0]);
    const topCategories = [...patterns.categorias.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);

    // Create summary
    const summary = [
      topColors.length > 0 ? `Cores favoritas: ${topColors.join(", ")}` : null,
      topStyles.length > 0 ? `Estilos: ${topStyles.join(", ")}` : null,
      topCategories.length > 0 ? `Peças preferidas: ${topCategories.join(", ")}` : null,
    ].filter(Boolean).join(" • ");

    setPatternSummary(summary);

    // Update profile with inspiration data
    try {
      const existingProfile = await supabase
        .from("profiles")
        .select("style_preferences, color_palette")
        .eq("user_id", user.id)
        .single();

      const existingColors = existingProfile.data?.color_palette || [];
      const mergedColors = [...new Set([...topColors, ...existingColors])].slice(0, 5);

      await supabase
        .from("profiles")
        .update({
          color_palette: mergedColors,
          style_preferences: `${existingProfile.data?.style_preferences || ""}\nInspiração: ${summary}`.trim(),
        })
        .eq("user_id", user.id);
    } catch (err) {
      console.error("Error updating profile with patterns:", err);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    const remainingSlots = MAX_PHOTOS - photos.length;
    if (remainingSlots <= 0) {
      toast.error(`Máximo de ${MAX_PHOTOS} fotos de inspiração`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setIsUploading(true);

    try {
      for (const file of filesToUpload) {
        // Upload to Supabase storage
        const fileName = `${user.id}/inspiration/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("prints")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("prints")
          .getPublicUrl(fileName);

        const newPhoto: InspirationPhoto = {
          url: urlData.publicUrl,
          isAnalyzing: true,
        };

        // Add photo immediately with analyzing state
        setPhotos(prev => {
          const updated = [...prev, newPhoto];
          onPhotosChange?.(updated);
          return updated;
        });

        // Award points for upload
        const newTotalPoints = currentPoints + (photos.length + 1) * PHOTO_UPLOAD_BONUS;
        
        // Update profile points
        const { data: profile } = await supabase
          .from("profiles")
          .select("quiz_points")
          .eq("user_id", user.id)
          .single();

        const updatedPoints = (profile?.quiz_points || 0) + PHOTO_UPLOAD_BONUS;
        const { level } = getLevelFromPoints(updatedPoints);

        await supabase
          .from("profiles")
          .update({
            quiz_points: updatedPoints,
            quiz_level: level,
          })
          .eq("user_id", user.id);

        onPointsEarned?.(PHOTO_UPLOAD_BONUS, updatedPoints);
        toast.success(`+${PHOTO_UPLOAD_BONUS} pontos! 🎉`);

        // Analyze photo with AI
        const analysis = await analyzePhoto(urlData.publicUrl);

        // Update photo with analysis result
        setPhotos(prev => {
          const updated = prev.map(p => 
            p.url === urlData.publicUrl 
              ? { ...p, analysis: analysis || undefined, isAnalyzing: false }
              : p
          );
          
          // Update patterns after each analysis
          updateProfileWithPatterns(updated);
          onPhotosChange?.(updated);
          return updated;
        });
      }

      toast.success(`${filesToUpload.length} foto(s) analisada(s) com IA!`);
    } catch (error) {
      console.error("Error uploading photos:", error);
      toast.error("Erro ao enviar fotos");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const removePhoto = (urlToRemove: string) => {
    setPhotos(prev => {
      const updated = prev.filter(p => p.url !== urlToRemove);
      onPhotosChange?.(updated);
      updateProfileWithPatterns(updated);
      return updated;
    });
  };

  return (
    <div className="bg-card rounded-2xl p-6 border border-border">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
          <Camera className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h3 className="font-serif text-lg">Fotos de inspiração</h3>
          <p className="text-sm text-muted-foreground">
            Envie até {MAX_PHOTOS} fotos de looks que você ama (+{PHOTO_UPLOAD_BONUS}pts cada)
          </p>
        </div>
      </div>

      {/* Photos Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
        {photos.map((photo, index) => (
          <div
            key={photo.url}
            className="relative aspect-square rounded-lg overflow-hidden border-2 border-border group"
          >
            <img
              src={photo.url}
              alt={`Inspiração ${index + 1}`}
              className="w-full h-full object-cover"
            />
            
            {/* Analyzing overlay */}
            {photo.isAnalyzing && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              </div>
            )}
            
            {/* Analyzed badge */}
            {!photo.isAnalyzing && photo.analysis && (
              <div className="absolute top-1 left-1">
                <div className="bg-accent text-accent-foreground rounded-full p-1">
                  <Check className="h-3 w-3" />
                </div>
              </div>
            )}

            {/* Remove button */}
            <button
              onClick={() => removePhoto(photo.url)}
              className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>

            {/* Analysis preview on hover */}
            {photo.analysis && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
                {photo.analysis.estilo?.value || photo.analysis.cor?.value || "Analisado"}
              </div>
            )}
          </div>
        ))}

        {/* Upload button placeholder */}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => document.getElementById("inspiration-photo-upload")?.click()}
            disabled={isUploading}
            className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-accent flex flex-col items-center justify-center transition-colors disabled:opacity-50 gap-1"
          >
            {isUploading ? (
              <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
            ) : (
              <>
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">+{PHOTO_UPLOAD_BONUS}pts</span>
              </>
            )}
          </button>
        )}
        <input
          id="inspiration-photo-upload"
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotoUpload}
          className="hidden"
        />
      </div>

      {/* Pattern Summary */}
      {patternSummary && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-accent mb-1">Padrões identificados pela IA:</p>
            <p className="text-sm text-foreground">{patternSummary}</p>
          </div>
        </div>
      )}

      {/* Empty state CTA */}
      {photos.length === 0 && !isUploading && (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => document.getElementById("inspiration-photo-upload")?.click()}
        >
          <Camera className="h-4 w-4" />
          Adicionar fotos de inspiração
        </Button>
      )}

      {/* Progress indicator */}
      {photos.length > 0 && photos.length < MAX_PHOTOS && (
        <p className="text-center text-xs text-muted-foreground mt-3">
          {photos.length}/{MAX_PHOTOS} fotos • +{(MAX_PHOTOS - photos.length) * PHOTO_UPLOAD_BONUS} pontos restantes
        </p>
      )}
    </div>
  );
}
