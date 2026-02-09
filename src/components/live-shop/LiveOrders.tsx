import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Calendar,
  LayoutGrid,
  List,
  Search,
  RefreshCw,
  Package,
  MessageCircle,
  Send,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLiveOrders, LiveOrderFilters } from "@/hooks/useLiveOrders";
import { useLiveEvent } from "@/hooks/useLiveEvents";
import { useAuth } from "@/hooks/useAuth";
import { LiveOrderKPIs } from "./LiveOrderKPIs";
import { LiveOrderCard } from "./LiveOrderCard";
import { LiveOrderDetailDrawer } from "./LiveOrderDetailDrawer";
import { MassChargeModal } from "./MassChargeModal";
import { ManualPaymentModal } from "./ManualPaymentModal";
import type { LiveOrderCart } from "@/hooks/useLiveOrders";

export function LiveOrders() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { hasRole, rolesLoading } = useAuth();
  
  // Wait for roles to load before computing isAdmin
  const isAdmin = !rolesLoading && hasRole("admin");
  
  const { event, isLoading: eventLoading } = useLiveEvent(eventId);
  const { 
    orders, 
    sellers, 
    kpis, 
    isLoading, 
    filterOrders, 
    ordersNeedingCharge,
    getOrderUrgency,
    assignSeller,
    markAsPaid,
    markAsPaidWithProof,
    approveManualPayment,
    rejectManualPayment,
    markAsPosted,
    markAsDelivered,
    markAsPickedUp,
    advanceStatus,
    revertStatus,
    generateShippingLabel,
    updateDeliveryMethod,
    updateDeliveryWithShipping,
    updateCustomerZipCode,
    updateDeliveryDetails,
    recordCharge,
    fetchChargeHistory,
    updateTrackingCode,
    refetch 
  } = useLiveOrders(eventId);

  // View state
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [massChargeOpen, setMassChargeOpen] = useState(false);
  const [manualPaymentOrderId, setManualPaymentOrderId] = useState<string | null>(null);
  
  // Filter state
  const [filters, setFilters] = useState<LiveOrderFilters>({
    search: '',
    status: 'all',
    deliveryMethod: 'all',
    sellerId: '',
    urgentOnly: false,
    needsCharge: false,
    pendingProof: false,
  });

  // Selected order for detail drawer
  const [selectedOrder, setSelectedOrder] = useState<LiveOrderCart | null>(null);

  // Charge history for selected order
  const [chargeHistory, setChargeHistory] = useState<{ channel: string; created_at: string; charged_by?: string }[]>([]);

  // Fetch charge history when order is selected
  useEffect(() => {
    if (selectedOrder?.id) {
      fetchChargeHistory(selectedOrder.id).then(setChargeHistory);
    } else {
      setChargeHistory([]);
    }
  }, [selectedOrder?.id, fetchChargeHistory]);

  // Get the order for manual payment
  const manualPaymentOrder = useMemo(() => 
    orders.find(o => o.id === manualPaymentOrderId), 
    [orders, manualPaymentOrderId]
  );

  // Filtered orders
  const filteredOrders = useMemo(() => filterOrders(filters), [filterOrders, filters]);

  // Group orders by status for kanban
  const kanbanColumns = useMemo(() => ({
    aguardando: filteredOrders.filter(o => o.status === 'aguardando_pagamento' || o.status === 'aberto'),
    pago: filteredOrders.filter(o => o.status === 'pago' && !['etiqueta_gerada', 'postado', 'entregue', 'retirado'].includes(o.operational_status || '')),
    etiqueta: filteredOrders.filter(o => o.operational_status === 'etiqueta_gerada'),
    enviado: filteredOrders.filter(o => ['postado', 'entregue', 'retirado', 'em_rota'].includes(o.operational_status || '')),
  }), [filteredOrders]);

  // Handle KPI click to set filters
  const handleKpiClick = (key: string) => {
    const newFilters: LiveOrderFilters = {
      search: '',
      status: 'all',
      deliveryMethod: 'all',
      sellerId: '',
      urgentOnly: false,
      needsCharge: false,
      pendingProof: false,
    };

    if (key === 'needs_charge') {
      newFilters.needsCharge = true;
    } else if (key === 'pending_proof') {
      newFilters.pendingProof = true;
    } else if (key === 'urgent') {
      newFilters.urgentOnly = true;
    } else if (key === 'none') {
      newFilters.sellerId = 'none';
    } else if (key === 'retirada' || key === 'motoboy' || key === 'correios') {
      newFilters.deliveryMethod = key;
      newFilters.status = 'pago';
    } else if (key !== 'all') {
      newFilters.status = key;
    }

    setFilters(newFilters);
  };

  // Update selected order when orders change
  useMemo(() => {
    if (selectedOrder) {
      const updated = orders.find(o => o.id === selectedOrder.id);
      if (updated) {
        setSelectedOrder(updated);
      }
    }
  }, [orders, selectedOrder?.id]);

  // Handle manual payment
  const handleManualPaymentConfirm = async (method: string, proofUrl: string, notes?: string) => {
    if (!manualPaymentOrderId) return false;
    return markAsPaidWithProof(manualPaymentOrderId, method, proofUrl, notes);
  };

  if (eventLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
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
      {/* Header - Mobile optimized */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3">
          {/* Top row - Title and main action */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate("/dashboard")}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-lg font-semibold truncate">{event.titulo}</h1>
                  <Badge className={`${status.color} shrink-0 text-xs`}>{status.label}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span className="truncate">{format(new Date(event.data_hora_inicio), "dd 'de' MMMM", { locale: ptBR })}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <Button variant="outline" size="icon" onClick={refetch} className="h-9 w-9">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Bottom row - Action buttons (wrap on mobile) */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {ordersNeedingCharge.length > 0 && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => setMassChargeOpen(true)}
                className="bg-rose-600 hover:bg-rose-700 h-9"
              >
                <Send className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Cobrar</span> ({ordersNeedingCharge.length})
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate(`/dashboard/lives/${eventId}/pendencias`)}
              className="h-9"
            >
              Pendências
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate(`/dashboard/lives/${eventId}/relatorio`)}
              className="h-9"
            >
              Relatório
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate(`/dashboard/lives/${eventId}/separacao`)}
              className="h-9"
            >
              Separação
            </Button>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <LiveOrderKPIs 
          kpis={kpis} 
          activeFilter={filters.status}
          onFilterClick={handleKpiClick}
        />
      </div>

      {/* Filters - Mobile optimized */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 pb-4">
        <div className="flex flex-col gap-3 bg-muted/30 rounded-lg p-3 border">
          {/* Search */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar @instagram, nome, sacola..."
              className="pl-9 bg-background w-full"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>

          {/* Filter selects - stack on mobile */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value, needsCharge: false, pendingProof: false, urgentOnly: false }))}
            >
              <SelectTrigger className="w-full sm:w-[160px] bg-background h-10">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="aguardando_pagamento">Aguardando Pgto</SelectItem>
                <SelectItem value="aguardando_retorno">Aguardando Retorno</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="preparar_envio">Preparar Envio</SelectItem>
                <SelectItem value="etiqueta_gerada">Etiqueta Gerada</SelectItem>
                <SelectItem value="postado">Postado</SelectItem>
                <SelectItem value="em_rota">Em Rota</SelectItem>
                <SelectItem value="entregue">Entregue</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.deliveryMethod}
              onValueChange={(value) => setFilters(prev => ({ ...prev, deliveryMethod: value }))}
            >
              <SelectTrigger className="w-full sm:w-[130px] bg-background h-10">
                <SelectValue placeholder="Entrega" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="correios">Correios</SelectItem>
                <SelectItem value="motoboy">Motoboy</SelectItem>
                <SelectItem value="retirada">Retirada</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.sellerId || "all_sellers"}
              onValueChange={(value) => setFilters(prev => ({ ...prev, sellerId: value === "all_sellers" ? "" : value }))}
            >
              <SelectTrigger className="w-full sm:w-[150px] bg-background h-10 col-span-2 sm:col-span-1">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_sellers">Todas</SelectItem>
                <SelectItem value="none">Sem responsável</SelectItem>
                {sellers.map((seller) => (
                  <SelectItem key={seller.id} value={seller.id}>
                    {seller.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* View toggle - hidden on mobile, show on sm+ */}
            <div className="hidden sm:flex gap-1 border rounded-md p-1 ml-auto bg-background">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('kanban')}
                className="h-8"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Active filters badges */}
          {(filters.urgentOnly || filters.needsCharge || filters.pendingProof) && (
            <div className="flex gap-1 flex-wrap">
              {filters.urgentOnly && (
                <Badge 
                  variant="outline" 
                  className="cursor-pointer border-amber-300 text-amber-700 bg-amber-50"
                  onClick={() => setFilters(prev => ({ ...prev, urgentOnly: false }))}
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Urgentes ✕
                </Badge>
              )}
              {filters.needsCharge && (
                <Badge 
                  variant="outline" 
                  className="cursor-pointer border-rose-300 text-rose-700 bg-rose-50"
                  onClick={() => setFilters(prev => ({ ...prev, needsCharge: false }))}
                >
                  <MessageCircle className="h-3 w-3 mr-1" />
                  Cobrar ✕
                </Badge>
              )}
              {filters.pendingProof && (
                <Badge 
                  variant="outline" 
                  className="cursor-pointer border-purple-300 text-purple-700 bg-purple-50"
                  onClick={() => setFilters(prev => ({ ...prev, pendingProof: false }))}
                >
                  Validar Pgto ✕
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 pb-8">
        {viewMode === 'list' ? (
          <div className="space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum pedido encontrado</p>
              </div>
            ) : (
              filteredOrders.map((order) => (
                <LiveOrderCard
                  key={order.id}
                  order={order}
                  sellers={sellers}
                  urgency={getOrderUrgency(order)}
                  onSelect={() => setSelectedOrder(order)}
                  onAssignSeller={assignSeller}
                  onMarkAsPaid={markAsPaid}
                  onMarkAsPosted={markAsPosted}
                  onMarkAsDelivered={markAsDelivered}
                  onMarkAsPickedUp={markAsPickedUp}
                  onAdvanceStatus={advanceStatus}
                  onRecordCharge={recordCharge}
                  onOpenManualPayment={(id) => setManualPaymentOrderId(id)}
                />
              ))
            )}
          </div>
        ) : (
          /* Kanban view - horizontal scroll on mobile, grid on desktop */
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-4">
            <div className="flex sm:grid sm:grid-cols-4 gap-3 sm:gap-4 min-w-max sm:min-w-0">
              {[
                { key: 'aguardando', label: 'Aguardando', data: kanbanColumns.aguardando, color: 'amber' },
                { key: 'pago', label: 'Pago', data: kanbanColumns.pago, color: 'emerald' },
                { key: 'etiqueta', label: 'Etiqueta', data: kanbanColumns.etiqueta, color: 'blue' },
                { key: 'enviado', label: 'Enviado', data: kanbanColumns.enviado, color: 'violet' },
              ].map((col) => (
                <div key={col.key} className="w-72 sm:w-auto shrink-0 sm:shrink space-y-2 sm:space-y-3">
                  <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-muted/50 rounded-lg border sticky top-0">
                    <span className="font-medium text-xs sm:text-sm">{col.label}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">{col.data.length}</Badge>
                  </div>
                  {col.data.map((order) => (
                    <LiveOrderCard
                      key={order.id}
                      order={order}
                      sellers={sellers}
                      urgency={getOrderUrgency(order)}
                      compact
                      onSelect={() => setSelectedOrder(order)}
                      onAssignSeller={assignSeller}
                      onMarkAsPaid={markAsPaid}
                      onMarkAsPosted={markAsPosted}
                      onMarkAsDelivered={markAsDelivered}
                      onMarkAsPickedUp={markAsPickedUp}
                      onAdvanceStatus={advanceStatus}
                      onRecordCharge={recordCharge}
                      onOpenManualPayment={(id) => setManualPaymentOrderId(id)}
                    />
                  ))}
                  {col.data.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground text-xs sm:text-sm">
                      Nenhum pedido
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Detail Drawer */}
      <LiveOrderDetailDrawer
        order={selectedOrder}
        sellers={sellers}
        isAdmin={isAdmin}
        onClose={() => setSelectedOrder(null)}
        onAssignSeller={assignSeller}
        onMarkAsPaid={markAsPaid}
        onMarkAsPaidWithProof={markAsPaidWithProof}
        onMarkAsPosted={markAsPosted}
        onMarkAsDelivered={markAsDelivered}
        onMarkAsPickedUp={markAsPickedUp}
        onGenerateLabel={generateShippingLabel}
        onUpdateDeliveryMethod={updateDeliveryMethod}
        onUpdateDeliveryWithShipping={updateDeliveryWithShipping}
        onUpdateCustomerZipCode={updateCustomerZipCode}
        onRecordCharge={recordCharge}
        onApprovePayment={approveManualPayment}
        onRejectPayment={rejectManualPayment}
        onRevertStatus={(orderId, targetStatus, reason) => revertStatus(orderId, targetStatus, reason, isAdmin)}
        onTrackingSynced={updateTrackingCode}
        chargeHistory={chargeHistory}
      />

      {/* Mass Charge Modal */}
      <MassChargeModal
        open={massChargeOpen}
        onClose={() => setMassChargeOpen(false)}
        orders={ordersNeedingCharge}
        onRecordCharge={recordCharge}
      />

      {/* Manual Payment Modal */}
      {manualPaymentOrder && (
        <ManualPaymentModal
          open={!!manualPaymentOrderId}
          onClose={() => setManualPaymentOrderId(null)}
          orderId={manualPaymentOrderId!}
          orderTotal={manualPaymentOrder.total}
          onConfirm={handleManualPaymentConfirm}
        />
      )}
    </div>
  );
}
