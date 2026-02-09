import { useState } from "react";
import { Upload, X, Camera, Sparkles, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PHOTO_UPLOAD_BONUS } from "@/lib/quizDataV2";

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

interface QuizPhotoUploadStepProps {
  userId: string;
  onPhotosChange: (photos: InspirationPhoto[], totalPhotoPoints: number) => void;
  photos: InspirationPhoto[];
  onPointsEarned: (points: number) => void;
}

const MAX_PHOTOS = 5;

export function QuizPhotoUploadStep({
  userId,
  onPhotosChange,
  photos,
  onPointsEarned,
}: QuizPhotoUploadStepProps) {
  const [isUploading, setIsUploading] = useState(false);

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_PHOTOS - photos.length;
    if (remainingSlots <= 0) {
      toast.error(`Máximo de ${MAX_PHOTOS} fotos`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setIsUploading(true);

    try {
      let newPhotos = [...photos];
      let addedPoints = 0;

      for (const file of filesToUpload) {
        // Upload to Supabase storage
        const fileName = `${userId}/inspiration/${Date.now()}-${file.name}`;
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

        newPhotos = [...newPhotos, newPhoto];
        addedPoints += PHOTO_UPLOAD_BONUS;
        
        // Notify parent about new photo and points
        onPhotosChange(newPhotos, addedPoints);
        onPointsEarned(PHOTO_UPLOAD_BONUS);
        toast.success(`+${PHOTO_UPLOAD_BONUS} pontos! 🎉`);

        // Analyze photo with AI in background
        analyzePhoto(urlData.publicUrl).then(analysis => {
          const updatedPhotos = newPhotos.map(p => 
            p.url === urlData.publicUrl 
              ? { ...p, analysis: analysis || undefined, isAnalyzing: false }
              : p
          );
          onPhotosChange(updatedPhotos, addedPoints);
        });
      }
    } catch (error) {
      console.error("Error uploading photos:", error);
      toast.error("Erro ao enviar fotos");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const removePhoto = (urlToRemove: string) => {
    const newPhotos = photos.filter(p => p.url !== urlToRemove);
    const totalPhotoPoints = newPhotos.length * PHOTO_UPLOAD_BONUS;
    onPhotosChange(newPhotos, totalPhotoPoints);
  };

  return (
    <div className="space-y-6">
      {/* Photos Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {photos.map((photo, index) => (
          <div
            key={photo.url}
            className="relative aspect-square rounded-xl overflow-hidden border-2 border-accent/30 group shadow-sm"
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
              <div className="absolute top-1.5 left-1.5">
                <div className="bg-accent text-accent-foreground rounded-full p-1">
                  <Check className="h-3 w-3" />
                </div>
              </div>
            )}

            {/* Remove button */}
            <button
              onClick={() => removePhoto(photo.url)}
              className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>

            {/* Points badge */}
            <div className="absolute bottom-1.5 left-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              +{PHOTO_UPLOAD_BONUS}
            </div>
          </div>
        ))}

        {/* Upload button placeholder */}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => document.getElementById("quiz-photo-upload")?.click()}
            disabled={isUploading}
            className="aspect-square rounded-xl border-2 border-dashed border-accent/40 hover:border-accent bg-accent/5 hover:bg-accent/10 flex flex-col items-center justify-center transition-all disabled:opacity-50 gap-1.5"
          >
            {isUploading ? (
              <Loader2 className="h-6 w-6 text-accent animate-spin" />
            ) : (
              <>
                <Upload className="h-6 w-6 text-accent" />
                <span className="text-xs font-medium text-accent">+{PHOTO_UPLOAD_BONUS}pts</span>
              </>
            )}
          </button>
        )}
        <input
          id="quiz-photo-upload"
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotoUpload}
          className="hidden"
        />
      </div>

      {/* Pattern Summary */}
      {photos.length > 0 && photos.some(p => p.analysis) && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-accent shrink-0 mt-0.5 animate-pulse" />
          <div>
            <p className="text-sm font-medium text-accent mb-1">IA analisando seus looks...</p>
            <p className="text-sm text-muted-foreground">
              Estou identificando cores, estilos e peças que você ama
            </p>
          </div>
        </div>
      )}

      {/* Empty state CTA */}
      {photos.length === 0 && !isUploading && (
        <Button
          variant="outline"
          className="w-full gap-2 h-12 border-accent/30 hover:border-accent hover:bg-accent/5"
          onClick={() => document.getElementById("quiz-photo-upload")?.click()}
        >
          <Camera className="h-5 w-5 text-accent" />
          <span>Adicionar fotos de inspiração</span>
        </Button>
      )}

      {/* Progress indicator */}
      <p className="text-center text-sm text-muted-foreground">
        {photos.length === 0 ? (
          "Opcional: envie até 5 fotos"
        ) : photos.length < MAX_PHOTOS ? (
          <>
            <span className="font-medium text-accent">{photos.length}/{MAX_PHOTOS}</span> fotos • 
            Você pode ganhar mais <span className="font-medium text-amber-600">+{(MAX_PHOTOS - photos.length) * PHOTO_UPLOAD_BONUS} pontos</span>
          </>
        ) : (
          <span className="text-accent font-medium">✓ Máximo de fotos atingido!</span>
        )}
      </p>
    </div>
  );
}
