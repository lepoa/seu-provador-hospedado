import { useState, useRef } from "react";
import { Camera, X, Loader2, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PhotoAnalysis {
  estilo?: string;
  cor?: string;
  ocasiao?: string;
  modelagem?: string;
  tags_extras?: string[];
}

interface UploadedPhoto {
  url: string;
  analysis: PhotoAnalysis | null;
  isAnalyzing: boolean;
}

interface MissionPhotoUploadProps {
  missionId: string;
  userId: string;
  theme: string;
  photoPrompt: string;
  maxPhotos?: number;
  onPhotosChange: (photos: UploadedPhoto[]) => void;
  onPointsEarned: (points: number) => void;
}

export function MissionPhotoUpload({
  missionId,
  userId,
  theme,
  photoPrompt,
  maxPhotos = 5,
  onPhotosChange,
  onPointsEarned,
}: MissionPhotoUploadProps) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxPhotos - photos.length;
    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    if (filesToUpload.length < files.length) {
      toast.info(`Máximo de ${maxPhotos} fotos permitidas`);
    }

    setIsUploading(true);

    for (const file of filesToUpload) {
      await uploadAndAnalyzePhoto(file);
    }

    setIsUploading(false);
    
    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadAndAnalyzePhoto = async (file: File) => {
    try {
      // Create unique filename
      const timestamp = Date.now();
      const filename = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const filePath = `${userId}/missions/${missionId}/${filename}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from("prints")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("prints")
        .getPublicUrl(filePath);

      const imageUrl = urlData.publicUrl;

      // Add photo to state with analyzing status
      const newPhoto: UploadedPhoto = {
        url: imageUrl,
        analysis: null,
        isAnalyzing: true,
      };

      setPhotos(prev => {
        const updated = [...prev, newPhoto];
        onPhotosChange(updated);
        return updated;
      });

      // Award points for upload
      onPointsEarned(50);

      // Analyze with AI
      try {
        const { data: analysisResult, error: analysisError } = await supabase.functions.invoke(
          "analyze-product-image",
          { body: { image_url: imageUrl } }
        );

        if (analysisError) {
          console.error("Analysis error:", analysisError);
        }

        // Update photo with analysis result
        setPhotos(prev => {
          const updated = prev.map(p => 
            p.url === imageUrl 
              ? { ...p, analysis: analysisResult?.analysis || null, isAnalyzing: false }
              : p
          );
          onPhotosChange(updated);
          return updated;
        });
      } catch (err) {
        console.error("Failed to analyze:", err);
        setPhotos(prev => {
          const updated = prev.map(p => 
            p.url === imageUrl ? { ...p, isAnalyzing: false } : p
          );
          onPhotosChange(updated);
          return updated;
        });
      }

    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao enviar foto");
    }
  };

  const removePhoto = (url: string) => {
    setPhotos(prev => {
      const updated = prev.filter(p => p.url !== url);
      onPhotosChange(updated);
      return updated;
    });
  };

  const canAddMore = photos.length < maxPhotos;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-accent/10 px-4 py-2 rounded-full mb-3">
          <Camera className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium text-accent">Etapa opcional: +50pts por foto</span>
        </div>
        <p className="text-muted-foreground text-sm">{photoPrompt}</p>
      </div>

      {/* Photo Grid */}
      <div className="grid grid-cols-3 gap-3">
        {photos.map((photo, index) => (
          <div 
            key={photo.url} 
            className="relative aspect-square rounded-xl overflow-hidden border-2 border-accent/30 bg-secondary"
          >
            <img 
              src={photo.url} 
              alt={`Inspiração ${index + 1}`} 
              className="w-full h-full object-cover"
            />
            
            {/* Analysis overlay */}
            {photo.isAnalyzing && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              </div>
            )}
            
            {photo.analysis && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <div className="flex items-center gap-1 text-white text-xs">
                  <Sparkles className="h-3 w-3" />
                  <span className="truncate">
                    {photo.analysis.estilo || photo.analysis.cor || "Analisado"}
                  </span>
                </div>
              </div>
            )}
            
            {/* Remove button */}
            <button
              onClick={() => removePhoto(photo.url)}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Success badge */}
            {!photo.isAnalyzing && (
              <div className="absolute top-1 left-1 w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center">
                <Check className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {/* Add More Button */}
        {canAddMore && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={cn(
              "aspect-square rounded-xl border-2 border-dashed border-accent/30 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-accent hover:text-accent transition-colors",
              isUploading && "opacity-50 cursor-not-allowed"
            )}
          >
            {isUploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <Camera className="h-6 w-6" />
                <span className="text-xs">Adicionar</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Counter */}
      <div className="text-center text-sm text-muted-foreground">
        {photos.length}/{maxPhotos} fotos • 
        {photos.length > 0 && (
          <span className="text-amber-600 font-medium ml-1">
            +{photos.length * 50} pts
          </span>
        )}
      </div>
    </div>
  );
}
