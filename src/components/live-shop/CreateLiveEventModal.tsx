import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Calendar, Clock, Radio } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLiveEvents } from "@/hooks/useLiveEvents";

interface CreateLiveEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateLiveEventModal({ open, onOpenChange }: CreateLiveEventModalProps) {
  const navigate = useNavigate();
  const { createEvent } = useLiveEvents();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [titulo, setTitulo] = useState("");
  const [dataHora, setDataHora] = useState(() => {
    const now = new Date();
    now.setMinutes(0);
    now.setSeconds(0);
    return format(now, "yyyy-MM-dd'T'HH:mm");
  });
  const [observacoes, setObservacoes] = useState("");
  const [expiryDays, setExpiryDays] = useState(7);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!titulo.trim()) return;

    setIsSubmitting(true);
    try {
      const event = await createEvent({
        titulo: titulo.trim(),
        data_hora_inicio: new Date(dataHora).toISOString(),
        observacoes: observacoes.trim() || undefined,
        reservation_expiry_minutes: Math.max(7, expiryDays) * 24 * 60,
      });

      if (event) {
        onOpenChange(false);
        // Reset form
        setTitulo("");
        setObservacoes("");
        // Navigate to planning
        navigate(`/dashboard/lives/${event.id}/planejar`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            Nova Live
          </DialogTitle>
          <DialogDescription>
            Crie um evento de live para gerenciar vendas em tempo real
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="titulo">Título da Live *</Label>
            <Input
              id="titulo"
              placeholder="Ex: Live de Terça - Novidades"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
            />
          </div>

          {/* Date/Time */}
          <div className="space-y-2">
            <Label htmlFor="dataHora">Data e Hora *</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="dataHora"
                type="datetime-local"
                value={dataHora}
                onChange={(e) => setDataHora(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          {/* Expiry */}
          <div className="space-y-2">
            <Label htmlFor="expiryDays">Tempo de Reserva (dias)</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="expiryDays"
                type="number"
                min={7}
                max={30}
                step={1}
                value={expiryDays}
                onChange={(e) => setExpiryDays(parseInt(e.target.value) || 7)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Mínimo de 7 dias. Reservas ficam separadas por pelo menos esse período.
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Anotações sobre a live..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !titulo.trim()}>
              {isSubmitting ? "Criando..." : "Criar e Planejar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
