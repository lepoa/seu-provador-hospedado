import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  Filter,
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Calendar,
  ShoppingBag,
  MessageSquare,
  MoreVertical,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { usePendencias, PendenciaStatus, PendenciaPriority, PendenciaType } from "@/hooks/usePendencias";
import { useSellers } from "@/hooks/useSellers";
import { useIsMobile } from "@/hooks/use-mobile";

interface PendenciasManagerProps {
  liveEventId?: string;
}

export function PendenciasManager({ liveEventId }: PendenciasManagerProps) {
  const isMobile = useIsMobile();
  const { sellers } = useSellers();
  const {
    pendencias,
    isLoading,
    filters,
    setFilters,
    updateStatus,
    assignTo,
    countOpen,
    countInProgress,
  } = usePendencias(liveEventId);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: PendenciaStatus) => {
    switch (status) {
      case 'aberta':
        return <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700"><Clock className="h-3 w-3 mr-1" />Aberta</Badge>;
      case 'em_andamento':
        return <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700"><AlertCircle className="h-3 w-3 mr-1" />Em Andamento</Badge>;
      case 'resolvida':
        return <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />Resolvida</Badge>;
    }
  };

  const getPriorityBadge = (priority: PendenciaPriority) => {
    switch (priority) {
      case 'alta':
        return <Badge variant="destructive" className="text-xs">Alta</Badge>;
      case 'media':
        return <Badge variant="secondary" className="text-xs">Média</Badge>;
      case 'baixa':
        return <Badge variant="outline" className="text-xs">Baixa</Badge>;
    }
  };

  const getTypeLabel = (type: PendenciaType) => {
    const labels: Record<PendenciaType, string> = {
      'observacao_cliente': 'Observação',
      'ajuste_tamanho': 'Ajuste Tamanho',
      'troca': 'Troca',
      'enviar_opcoes': 'Enviar Opções',
      'outros': 'Outros',
    };
    return labels[type];
  };

  // Export to CSV
  const handleExport = () => {
    const headers = ['Data', 'Sacola', 'Cliente', 'Tipo', 'Título', 'Descrição', 'Status', 'Prioridade'];
    const rows = pendencias.map(p => [
      format(new Date(p.created_at), 'dd/MM/yyyy HH:mm'),
      p.live_cart?.bag_number || '-',
      p.live_cart?.live_customer?.instagram_handle || '-',
      getTypeLabel(p.type),
      p.title,
      p.description || '',
      p.status,
      p.priority,
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pendencias_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20 hidden md:block" />
        </div>
        <Skeleton className="h-12" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6 overflow-x-hidden">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card 
          className={`cursor-pointer transition-colors ${filters.status === 'aberta' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setFilters(prev => ({ ...prev, status: prev.status === 'aberta' ? 'all' : 'aberta' }))}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold">{countOpen}</p>
                <p className="text-xs text-muted-foreground truncate">Abertas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-colors ${filters.status === 'em_andamento' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setFilters(prev => ({ ...prev, status: prev.status === 'em_andamento' ? 'all' : 'em_andamento' }))}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                <AlertCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold">{countInProgress}</p>
                <p className="text-xs text-muted-foreground truncate">Em Andamento</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hidden md:block">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg shrink-0">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold">{pendencias.filter(p => p.status === 'resolvida').length}</p>
                <p className="text-xs text-muted-foreground truncate">Resolvidas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar @instagram, sacola, título..."
            className="pl-9"
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select
            value={filters.status}
            onValueChange={(value) => setFilters(prev => ({ ...prev, status: value as PendenciaStatus | 'all' }))}
          >
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="aberta">Abertas</SelectItem>
              <SelectItem value="em_andamento">Em Andamento</SelectItem>
              <SelectItem value="resolvida">Resolvidas</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.priority}
            onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value as PendenciaPriority | 'all' }))}
          >
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.type}
            onValueChange={(value) => setFilters(prev => ({ ...prev, type: value as PendenciaType | 'all' }))}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="observacao_cliente">Observação</SelectItem>
              <SelectItem value="ajuste_tamanho">Ajuste Tam.</SelectItem>
              <SelectItem value="troca">Troca</SelectItem>
              <SelectItem value="enviar_opcoes">Enviar Opções</SelectItem>
              <SelectItem value="outros">Outros</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={handleExport} className="shrink-0 ml-auto">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {pendencias.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma pendência encontrada</p>
          </div>
        ) : (
          pendencias.map((pendencia) => (
            <Card key={pendencia.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {pendencia.live_cart?.bag_number && (
                        <Badge variant="secondary" className="shrink-0">
                          #{String(pendencia.live_cart.bag_number).padStart(3, '0')}
                        </Badge>
                      )}
                      <span className="font-medium truncate">
                        @{pendencia.live_cart?.live_customer?.instagram_handle || 'Desconhecido'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {getPriorityBadge(pendencia.priority)}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => updateStatus(pendencia.id, 'aberta')}>
                            <Clock className="h-4 w-4 mr-2" />
                            Marcar como Aberta
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateStatus(pendencia.id, 'em_andamento')}>
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Em Andamento
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateStatus(pendencia.id, 'resolvida')}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Marcar como Resolvida
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <User className="h-4 w-4 mr-2" />
                            Atribuir Responsável
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Calendar className="h-4 w-4 mr-2" />
                            Definir Prazo
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(pendencia.status)}
                      <Badge variant="outline" className="text-xs">{getTypeLabel(pendencia.type)}</Badge>
                    </div>
                    <p className="font-medium text-sm line-clamp-1">{pendencia.title}</p>
                    {pendencia.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{pendencia.description}</p>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span>{format(new Date(pendencia.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                    {pendencia.live_cart?.total && (
                      <span className="font-medium">{formatPrice(pendencia.live_cart.total)}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
