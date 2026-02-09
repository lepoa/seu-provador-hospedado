import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Radio, RefreshCw, Calendar, Package, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiveEvent } from "@/hooks/useLiveEvents";
import { PendenciasManager } from "@/components/live-shop/PendenciasManager";

export default function LivePendenciasPage() {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const { event, isLoading } = useLiveEvent(eventId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Live não encontrada</h2>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const statusLabels: Record<string, { label: string; color: string }> = {
    "planejada": { label: "Planejada", color: "bg-blue-100 text-blue-700" },
    "ao_vivo": { label: "Ao Vivo", color: "bg-red-100 text-red-700" },
    "encerrada": { label: "Encerrada", color: "bg-muted text-muted-foreground" },
  };
  const status = statusLabels[event.status] || statusLabels.encerrada;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(`/dashboard/lives/${eventId}/pedidos`)}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold truncate">{event.titulo}</h1>
                <Badge className={status.color}>{status.label}</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ClipboardList className="h-3.5 w-3.5" />
                <span>Pendências</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto">
        <PendenciasManager liveEventId={eventId} />
      </main>
    </div>
  );
}
