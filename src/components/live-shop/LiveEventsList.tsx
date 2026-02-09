import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Calendar, 
  Clock, 
  Play, 
  Square, 
  Archive,
  Plus,
  Radio,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Users,
  ShoppingCart,
  DollarSign,
  BarChart3,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiveEvents } from "@/hooks/useLiveEvents";
import { CreateLiveEventModal } from "./CreateLiveEventModal";
import type { LiveEventStatus } from "@/types/liveShop";

interface LiveEventWithStats {
  id: string;
  titulo: string;
  data_hora_inicio: string;
  data_hora_fim?: string | null;
  status: LiveEventStatus;
  observacoes?: string | null;
  productsCount: number;
  cartsCount: number;
  totalPaid: number;
}
const statusConfig: Record<LiveEventStatus, { 
  label: string; 
  color: string; 
  icon: React.ReactNode;
  bgColor: string;
}> = {
  'planejada': { 
    label: 'Planejada', 
    color: 'text-blue-600', 
    bgColor: 'bg-blue-50 border-blue-200',
    icon: <Calendar className="h-4 w-4" />
  },
  'ao_vivo': { 
    label: 'AO VIVO', 
    color: 'text-red-600', 
    bgColor: 'bg-red-50 border-red-200',
    icon: <Radio className="h-4 w-4 animate-pulse" />
  },
  'encerrada': { 
    label: 'Encerrada', 
    color: 'text-green-600', 
    bgColor: 'bg-green-50 border-green-200',
    icon: <CheckCircle className="h-4 w-4" />
  },
  'arquivada': { 
    label: 'Arquivada', 
    color: 'text-muted-foreground', 
    bgColor: 'bg-muted border-muted',
    icon: <Archive className="h-4 w-4" />
  },
};

export function LiveEventsList() {
  const navigate = useNavigate();
  const { events, isLoading, updateEventStatus } = useLiveEvents();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const handleStartLive = async (event: LiveEventWithStats) => {
    await updateEventStatus(event.id, 'ao_vivo');
    navigate(`/dashboard/lives/${event.id}/backstage`);
  };

  const handleEndLive = async (event: LiveEventWithStats) => {
    await updateEventStatus(event.id, 'encerrada');
  };

  const formatDateTime = (dateStr: string) => {
    return format(new Date(dateStr), "dd/MM 'às' HH:mm", { locale: ptBR });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  const liveEvents = events.filter(e => e.status === 'ao_vivo');
  const upcomingEvents = events.filter(e => e.status === 'planejada');
  const pastEvents = events.filter(e => ['encerrada', 'arquivada'].includes(e.status));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Lives</h2>
          <p className="text-muted-foreground text-sm">
            Gerencie suas vendas durante transmissões ao vivo
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={() => navigate("/dashboard/lives/rastreador")}
            className="gap-2"
          >
            <ScanLine className="h-4 w-4" />
            Rastreador
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate("/dashboard/lives/relatorio")}
            className="gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Relatório
          </Button>
          <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Live
          </Button>
        </div>
      </div>

      {/* Live Now Section */}
      {liveEvents.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-red-600 flex items-center gap-2">
            <Radio className="h-4 w-4 animate-pulse" />
            Ao Vivo Agora
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveEvents.map(event => (
              <LiveEventCard 
                key={event.id} 
                event={event} 
                onOpenBackstage={() => navigate(`/dashboard/lives/${event.id}/backstage`)}
                onEndLive={() => handleEndLive(event)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Section */}
      {upcomingEvents.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-blue-600 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Próximas Lives
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingEvents.map(event => (
              <LiveEventCard 
                key={event.id} 
                event={event} 
                onPlan={() => navigate(`/dashboard/lives/${event.id}/planejar`)}
                onStartLive={() => handleStartLive(event)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Past Section */}
      {pastEvents.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-muted-foreground flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Lives Anteriores
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastEvents.slice(0, 6).map(event => (
              <LiveEventCard 
                key={event.id} 
                event={event}
                onViewReport={() => navigate(`/dashboard/lives/${event.id}/relatorio`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {events.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Radio className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-lg mb-2">Nenhuma live ainda</h3>
            <p className="text-muted-foreground text-sm mb-4 max-w-sm">
              Crie sua primeira live para vender durante transmissões do Instagram
            </p>
            <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar primeira live
            </Button>
          </CardContent>
        </Card>
      )}

      <CreateLiveEventModal 
        open={createModalOpen} 
        onOpenChange={setCreateModalOpen}
      />
    </div>
  );
}

interface LiveEventCardProps {
  event: LiveEventWithStats;
  onPlan?: () => void;
  onStartLive?: () => void;
  onOpenBackstage?: () => void;
  onEndLive?: () => void;
  onViewReport?: () => void;
}

function LiveEventCard({ 
  event, 
  onPlan, 
  onStartLive, 
  onOpenBackstage, 
  onEndLive,
  onViewReport 
}: LiveEventCardProps) {
  const config = statusConfig[event.status];

  return (
    <Card className={`transition-all hover:shadow-md ${config.bgColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-medium line-clamp-1">
            {event.titulo}
          </CardTitle>
          <Badge variant="outline" className={`${config.color} shrink-0 gap-1`}>
            {config.icon}
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date/Time */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {format(new Date(event.data_hora_inicio), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-background/80 rounded-lg p-2">
            <div className="text-lg font-semibold">{event.productsCount}</div>
            <div className="text-xs text-muted-foreground">Produtos</div>
          </div>
          <div className="bg-background/80 rounded-lg p-2">
            <div className="text-lg font-semibold">{event.cartsCount}</div>
            <div className="text-xs text-muted-foreground">Carrinhos</div>
          </div>
          <div className="bg-background/80 rounded-lg p-2">
            <div className="text-lg font-semibold">
              {event.totalPaid > 0 
                ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(event.totalPaid)
                : 'R$ 0'
              }
            </div>
            <div className="text-xs text-muted-foreground">Vendas</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {event.status === 'planejada' && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={onPlan}
              >
                Planejar
              </Button>
              <Button 
                size="sm" 
                className="flex-1 gap-1 bg-red-600 hover:bg-red-700"
                onClick={onStartLive}
              >
                <Play className="h-3 w-3" />
                Iniciar
              </Button>
            </>
          )}
          {event.status === 'ao_vivo' && (
            <>
              <Button 
                size="sm" 
                className="flex-1 gap-1 bg-red-600 hover:bg-red-700"
                onClick={onOpenBackstage}
              >
                <Radio className="h-3 w-3" />
                Backstage
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={onEndLive}
              >
                <Square className="h-3 w-3" />
              </Button>
            </>
          )}
          {['encerrada', 'arquivada'].includes(event.status) && (
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={onViewReport}
            >
              Ver Relatório
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
