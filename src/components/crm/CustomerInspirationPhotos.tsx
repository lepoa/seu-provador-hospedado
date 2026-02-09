import { useState } from "react";
import { Camera, Star, Pencil, X, Check, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InspirationPhoto {
  id: string;
  image_url: string;
  is_starred: boolean;
  merchant_notes: string | null;
  source: string;
  created_at: string;
}

interface CustomerInspirationPhotosProps {
  photos: InspirationPhoto[];
  onPhotosUpdate: () => void;
}

export function CustomerInspirationPhotos({ 
  photos, 
  onPhotosUpdate 
}: CustomerInspirationPhotosProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<InspirationPhoto | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  };

  const toggleStar = async (photo: InspirationPhoto, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from("customer_inspiration_photos")
        .update({ is_starred: !photo.is_starred })
        .eq("id", photo.id);

      if (error) throw error;
      onPhotosUpdate();
    } catch (error) {
      console.error("Error updating star:", error);
      toast.error("Erro ao atualizar");
    }
  };

  const saveNotes = async () => {
    if (!selectedPhoto) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("customer_inspiration_photos")
        .update({ merchant_notes: notes })
        .eq("id", selectedPhoto.id);

      if (error) throw error;
      
      setEditingNotes(false);
      onPhotosUpdate();
      toast.success("Anotação salva!");
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error("Erro ao salvar anotação");
    } finally {
      setIsSaving(false);
    }
  };

  const openPhoto = (photo: InspirationPhoto) => {
    setSelectedPhoto(photo);
    setNotes(photo.merchant_notes || "");
    setEditingNotes(false);
  };

  if (photos.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma foto de inspiração enviada.</p>
          <p className="text-sm mt-1">
            Fotos enviadas no quiz aparecerão aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Inspirações enviadas ({photos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative cursor-pointer"
                onClick={() => openPhoto(photo)}
              >
                <div className="aspect-square rounded-lg overflow-hidden bg-secondary">
                  <img
                    src={photo.image_url}
                    alt="Inspiração"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>

                {/* Star button */}
                <button
                  onClick={(e) => toggleStar(photo, e)}
                  className={`absolute top-2 right-2 p-1.5 rounded-full transition-colors ${
                    photo.is_starred
                      ? "bg-yellow-400 text-yellow-900"
                      : "bg-white/80 text-muted-foreground hover:bg-white"
                  }`}
                >
                  <Star className="h-3.5 w-3.5" fill={photo.is_starred ? "currentColor" : "none"} />
                </button>

                {/* Has notes indicator */}
                {photo.merchant_notes && (
                  <Badge
                    variant="secondary"
                    className="absolute bottom-2 left-2 text-xs gap-1 bg-white/90"
                  >
                    <Pencil className="h-2.5 w-2.5" />
                    Nota
                  </Badge>
                )}

                {/* Source badge */}
                <Badge
                  variant="outline"
                  className="absolute top-2 left-2 text-xs bg-white/90"
                >
                  {photo.source === "quiz" ? "Quiz" : photo.source === "mission" ? "Missão" : "Upload"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Photo detail modal */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-2xl">
          <DialogTitle className="sr-only">Detalhes da foto</DialogTitle>
          {selectedPhoto && (
            <div className="space-y-4">
              {/* Image */}
              <div className="relative">
                <img
                  src={selectedPhoto.image_url}
                  alt="Inspiração"
                  className="w-full max-h-[60vh] object-contain rounded-lg bg-secondary"
                />
                
                {/* Star button */}
                <button
                  onClick={(e) => toggleStar(selectedPhoto, e)}
                  className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${
                    selectedPhoto.is_starred
                      ? "bg-yellow-400 text-yellow-900"
                      : "bg-white/80 text-muted-foreground hover:bg-white"
                  }`}
                >
                  <Star className="h-5 w-5" fill={selectedPhoto.is_starred ? "currentColor" : "none"} />
                </button>
              </div>

              {/* Info */}
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {selectedPhoto.source === "quiz" ? "Quiz" : selectedPhoto.source === "mission" ? "Missão" : "Upload"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {formatDate(selectedPhoto.created_at)}
                </span>
              </div>

              {/* Merchant notes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Anotação do lojista</label>
                  {!editingNotes && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingNotes(true)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                  )}
                </div>

                {editingNotes ? (
                  <div className="space-y-2">
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Adicione uma anotação sobre esta foto..."
                      rows={3}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingNotes(false);
                          setNotes(selectedPhoto.merchant_notes || "");
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={saveNotes} disabled={isSaving}>
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Check className="h-4 w-4 mr-1" />
                        )}
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground bg-secondary/50 rounded-lg p-3">
                    {selectedPhoto.merchant_notes || "Nenhuma anotação adicionada."}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
