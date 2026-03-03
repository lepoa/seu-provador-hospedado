import { useState } from "react";
import { Upload, X, Star, GripVertical, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { compressImage, getEmbedUrl } from "@/lib/mediaUtils";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

interface ProductImageUploaderProps {
  images: string[];
  mainImageIndex: number;
  videoUrl: string | null;
  onImagesChange: (images: string[], mainIndex: number) => void;
  onVideoChange: (url: string | null) => void;
  userId: string;
}

const MAX_IMAGES = 5;

export function ProductImageUploader({
  images,
  mainImageIndex,
  videoUrl,
  onImagesChange,
  onVideoChange,
  userId,
}: ProductImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [videoInput, setVideoInput] = useState("");

  const normalizedVideoInput = videoInput.trim();
  const parsedVideoEmbedUrl = normalizedVideoInput ? getEmbedUrl(normalizedVideoInput) : null;
  const isVideoInputValid = Boolean(parsedVideoEmbedUrl);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots <= 0) {
      toast.error(`Maximo de ${MAX_IMAGES} imagens`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setIsUploading(true);

    try {
      const uploadedUrls: string[] = [];

      for (const file of filesToUpload) {
        const compressedFile = await compressImage(file);

        const fileName = `${userId}/${Date.now()}-${compressedFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("products")
          .upload(fileName, compressedFile, {
            cacheControl: "3600000",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("products")
          .getPublicUrl(fileName);

        uploadedUrls.push(urlData.publicUrl);
      }

      onImagesChange([...images, ...uploadedUrls], mainImageIndex);
      toast.success(`${uploadedUrls.length} imagem(ns) enviada(s)`);
    } catch (error) {
      console.error("Error uploading images:", error);
      toast.error("Erro ao enviar imagens");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleVideoLinkSubmit = () => {
    if (!normalizedVideoInput) return;

    const embedUrl = getEmbedUrl(normalizedVideoInput);
    if (!embedUrl) {
      toast.error("Link invalido. Use um link do YouTube (inclui Shorts) ou Vimeo.");
      return;
    }

    onVideoChange(embedUrl);
    setVideoInput("");
    toast.success("Video vinculado!");
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    let newMainIndex = mainImageIndex;

    if (index === mainImageIndex) {
      newMainIndex = 0;
    } else if (index < mainImageIndex) {
      newMainIndex = mainImageIndex - 1;
    }

    onImagesChange(newImages, Math.min(newMainIndex, newImages.length - 1));
  };

  const setAsMain = (index: number) => {
    onImagesChange(images, index);
    toast.success("Imagem principal atualizada");
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const [draggedImage] = newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedImage);

    let newMainIndex = mainImageIndex;
    if (mainImageIndex === draggedIndex) {
      newMainIndex = index;
    } else if (draggedIndex < mainImageIndex && index >= mainImageIndex) {
      newMainIndex = mainImageIndex - 1;
    } else if (draggedIndex > mainImageIndex && index <= mainImageIndex) {
      newMainIndex = mainImageIndex + 1;
    }

    onImagesChange(newImages, newMainIndex);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Imagens ({images.length}/{MAX_IMAGES})
        </span>
        {images.length < MAX_IMAGES && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => document.getElementById("multi-image-upload")?.click()}
            disabled={isUploading}
          >
            <Upload className="h-4 w-4 mr-1" />
            {isUploading ? "Enviando..." : "Adicionar"}
          </Button>
        )}
        <input
          id="multi-image-upload"
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {images.map((url, index) => (
          <div
            key={url}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-move group ${
              index === mainImageIndex
                ? "border-accent ring-2 ring-accent/30"
                : "border-border"
            } ${draggedIndex === index ? "opacity-50" : ""}`}
          >
            <img
              src={url}
              alt={`Imagem ${index + 1}`}
              className="w-full h-full object-cover"
            />

            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-white hover:bg-white/20"
                onClick={() => setAsMain(index)}
                title="Definir como principal"
              >
                <Star className={`h-4 w-4 ${index === mainImageIndex ? "fill-yellow-400 text-yellow-400" : ""}`} />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-white hover:bg-white/20"
                onClick={() => removeImage(index)}
                title="Remover"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {index === mainImageIndex && (
              <span className="absolute top-1 left-1 text-[10px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded">
                Principal
              </span>
            )}

            <div className="absolute bottom-1 right-1 text-white/60">
              <GripVertical className="h-3 w-3" />
            </div>
          </div>
        ))}

        {images.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => document.getElementById("multi-image-upload")?.click()}
            className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-accent flex items-center justify-center transition-colors"
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="pt-4 border-t border-border">
        <div className="flex flex-col gap-2 mb-2">
          <span className="text-sm font-medium flex items-center gap-1.5">
            <Video className="h-4 w-4" />
            Video Externo (YouTube/Vimeo) - Opcional
          </span>
          {!videoUrl && (
            <div className="flex items-center gap-2">
              <Input
                type="url"
                placeholder="Cole o link do YouTube ou Vimeo"
                value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)}
                className="flex-1 text-sm bg-white"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleVideoLinkSubmit}
                disabled={!isVideoInputValid}
              >
                Vincular
              </Button>
            </div>
          )}
          {!videoUrl && normalizedVideoInput && !isVideoInputValid && (
            <p className="text-xs text-destructive">
              Link invalido. Cole uma URL valida do YouTube (watch, youtu.be, shorts, embed) ou Vimeo.
            </p>
          )}
        </div>

        {videoUrl && (
          <div className="relative aspect-video rounded-lg overflow-hidden bg-black/5 border border-border">
            <iframe
              src={videoUrl}
              className="w-full h-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute top-2 right-2 h-7 w-7"
              onClick={() => onVideoChange(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
