import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Clock, CheckCircle, Truck, CreditCard, X, ChevronDown, Copy,
  Package, Search, MessageCircle, Radio, Store, StickyNote, User,
  Save, Edit2, RefreshCw, AlertCircle, Send, Timer, FileText, Printer,
  MapPin, Lock, Filter, XCircle
} from "lucide-react";
import { copyToClipboard } from "@/lib/clipboardUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSellers } from "@/hooks/useSellers";
import { RevalidatePaymentModal } from "./RevalidatePaymentModal";
import { OrderPackingSlipPrint, BatchPackingSlipPrint } from "./orders/OrderPackingSlipPrint";
import { OrderShippingLabelPrint } from "./orders/OrderShippingLabelPrint";
import {
  getWhatsAppTemplateForStatus,
  getShortOrderId,
  type OrderStatus
} from "@/lib/whatsappTemplates";
import {
  parseOrdersUrlParams,
  getSpecialFilterLabel,
  isPendingActionsFilter
} from "@/lib/dashboardNavigation";
import { getOperationalPendingOrders, type PendingOrderType } from "@/lib/pendingOrdersUtils";

interface AddressSnapshot {
  name?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  cpf?: string;
  document?: string;
  reference?: string;
  address_line?: string;
  full_name?: string;
}

interface Order {
  id: string;
  created_at: string;
  status: string;
  total: number;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_id: string | null;
  payment_link: string | null;
  tracking_code: string | null;
  delivery_method: string | null;
  live_event_id: string | null;
  seller_id: string | null;
  internal_notes: string | null;
  mp_checkout_url: string | null;
  customer_notes: string | null;
  delivery_period: string | null;
  last_whatsapp_status: string | null;
  last_whatsapp_sent_at: string | null;
  whatsapp_message_override: string | null;
  reserved_until?: string | null;
  address_snapshot?: AddressSnapshot | null;
  me_shipment_id?: string | null;
  me_label_url?: string | null;
  paid_at?: string | null;
  // New shipping status fields
  shipping_status?: string | null;
  shipping_label_generated_at?: string | null;
  // New fields for unified orders
  source?: string;
  live_cart_id?: string | null;
  live_bag_number?: number | null;
  live_event?: { titulo: string } | null;
  // Attention fields for operational alerts
  requires_physical_cancel?: boolean;
  attention_reason?: string | null;
  attention_at?: string | null;
  cancel_reason?: string | null;
  updated_at?: string;
}

interface OrderItem {
  id: string;
  product_name: string;
  product_price: number;
  size: string;
  quantity: number;
  color: string | null;
  image_url: string | null;
  product_sku: string | null;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pendente: { label: "Pendente", icon: Clock, color: "bg-amber-100 text-amber-800" },
  aguardando_pagamento: { label: "Aguardando Pagamento", icon: CreditCard, color: "bg-orange-100 text-orange-800" },
  pago: { label: "Pago", icon: CheckCircle, color: "bg-green-100 text-green-800" },
  etiqueta_gerada: { label: "Etiqueta Gerada", icon: FileText, color: "bg-cyan-100 text-cyan-800" },
  confirmado: { label: "Confirmado", icon: CheckCircle, color: "bg-blue-100 text-blue-800" },
  enviado: { label: "Enviado", icon: Truck, color: "bg-purple-100 text-purple-800" },
  entregue: { label: "Entregue", icon: CheckCircle, color: "bg-green-100 text-green-800" },
  cancelado: { label: "Cancelado", icon: X, color: "bg-red-100 text-red-800" },
  pagamento_rejeitado: { label: "Pagamento Rejeitado", icon: X, color: "bg-red-100 text-red-800" },
  reembolsado: { label: "Reembolsado", icon: Clock, color: "bg-gray-100 text-gray-800" },
  aguardando_pagamento_frete: { label: "Aguardando Pag. Frete", icon: CreditCard, color: "bg-yellow-100 text-yellow-800" },
};

const statusOptions = [
  { value: "pendente", label: "Pendente" },
  { value: "aguardando_pagamento", label: "Aguardando Pagamento" },
  { value: "pago", label: "Pago" },
  { value: "etiqueta_gerada", label: "Etiqueta Gerada" },
  { value: "confirmado", label: "Confirmado" },
  { value: "enviado", label: "Enviado" },
  { value: "entregue", label: "Entregue" },
  { value: "cancelado", label: "Cancelado" },
  { value: "pagamento_rejeitado", label: "Pagamento Rejeitado" },
  { value: "reembolsado", label: "Reembolsado" },
  { value: "aguardando_pagamento_frete", label: "Aguardando Pag. Frete" },
];

// Map special filter types to pending order types
const specialFilterToPendingType: Record<string, PendingOrderType> = {
  "aguardando-24h": "aguardando_pagamento_24h",
  "aguardando-retorno": "aguardando_retorno_24h",
  "nao-cobrado": "nao_cobrado",
  "sem-logistica": "pago_sem_logistica",
  "etiqueta-pendente": "etiqueta_pendente",
  "sem-vendedora": "sem_vendedora",
  "urgente": "urgente",
};

interface OrdersManagerProps {
  initialFilter?: string;
}

export function OrdersManager({ initialFilter }: OrdersManagerProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse URL filters
  const urlFilters = useMemo(() => parseOrdersUrlParams(searchParams), [searchParams]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // Initialize filters from URL or props
  const [filterStatus, setFilterStatus] = useState<string>(() => {
    if (urlFilters.status !== "all") return urlFilters.status;
    return mapInitialFilter(initialFilter) || "all";
  });
  const [filterSource, setFilterSource] = useState<string>(() => urlFilters.source || "all");
  const [filterSeller, setFilterSeller] = useState<string | null>(() => urlFilters.seller);
  const [specialFilter, setSpecialFilter] = useState<string | null>(() => urlFilters.specialFilter);
  const [pendingOrderIds, setPendingOrderIds] = useState<Set<string>>(new Set());

  const [searchTerm, setSearchTerm] = useState("");
  const [editingTrackingCode, setEditingTrackingCode] = useState<string | null>(null);
  const [trackingCodeValue, setTrackingCodeValue] = useState("");
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [showRevalidateModal, setShowRevalidateModal] = useState(false);
  const [revalidateOrderId, setRevalidateOrderId] = useState<string | null>(null);

  // WhatsApp message state per order
  const [whatsappMessages, setWhatsappMessages] = useState<Record<string, string>>({});
  const [whatsappPendingSend, setWhatsappPendingSend] = useState<Record<string, boolean>>({});
  const [editingWhatsappMessage, setEditingWhatsappMessage] = useState<string | null>(null);

  // Multi-select state for batch printing
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  // Delivery method edit state
  const [editingDeliveryOrder, setEditingDeliveryOrder] = useState<string | null>(null);
  const [newDeliveryMethod, setNewDeliveryMethod] = useState<string>("");

  const { sellers } = useSellers();

  // Toggle single order selection
  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // Toggle all filtered orders
  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  // Get selected orders with their items for batch printing
  const getSelectedOrdersWithItems = () => {
    return Array.from(selectedOrders)
      .map(orderId => {
        const order = orders.find(o => o.id === orderId);
        const items = orderItems[orderId] || [];
        return order ? { order, items } : null;
      })
      .filter((item): item is { order: Order; items: OrderItem[] } => item !== null);
  };

  function mapInitialFilter(filter?: string): string | undefined {
    if (!filter) return undefined;
    const filterMap: Record<string, string> = {
      "aguardando": "aguardando_pagamento",
      "pagos": "pago",
      "separar": "pago",
      "envio": "enviado",
      "retirada": "pago",
      "cancelado": "cancelado",
    };
    return filterMap[filter] || filter;
  }

  // Sync filters with URL when they change
  useEffect(() => {
    const newUrlFilters = parseOrdersUrlParams(searchParams);
    if (newUrlFilters.status !== "all") setFilterStatus(newUrlFilters.status);
    if (newUrlFilters.source !== "all") setFilterSource(newUrlFilters.source);
    if (newUrlFilters.seller) setFilterSeller(newUrlFilters.seller);
    if (newUrlFilters.specialFilter) setSpecialFilter(newUrlFilters.specialFilter);
  }, [searchParams]);

  useEffect(() => {
    loadOrders();
  }, []);

  // Load pending order IDs when special filter is active
  useEffect(() => {
    if (specialFilter && isPendingActionsFilter(specialFilter)) {
      loadPendingOrderIds();
    } else {
      setPendingOrderIds(new Set());
    }
  }, [specialFilter]);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Regular Orders
      const { data: regularOrders, error: ordersError } = await supabase
        .from("orders")
        .select(`
          *,
          live_event:live_events(titulo)
        `)
        .order("created_at", { ascending: false });

      if (ordersError) {
        throw ordersError;
      }

      // 2. Fetch Orphaned Live Carts (Fallback for when webhook fails to create order)
      // Only fetch those that are NOT linked to an order yet (order_id is null)
      const { data: liveCarts, error: liveError } = await supabase
        .from("live_carts")
        .select(`
          *,
          live_customer:live_customers(*),
          live_event:live_events(titulo)
        `)
        .is("order_id", null)
        .neq("status", "aberto") // Only show finalized/checkout carts
        .neq("status", "abandonado")
        .order("created_at", { ascending: false });

      if (liveError) {
        console.error("Error fetching live carts:", liveError);
        // Don't throw, just show what we have
      }

      // 3. Map Live Carts to Order Interface
      const mappedLiveOrders: Order[] = (liveCarts || []).map((cart: any) => ({
        id: cart.id,
        created_at: cart.created_at,
        status: cart.status,
        total: cart.total,
        customer_name: cart.live_customer?.nome || cart.live_customer?.instagram_handle || "Cliente Live",
        customer_phone: cart.live_customer?.whatsapp || "",
        customer_address: cart.shipping_address_snapshot?.full_address || "Endereço não capturado",
        customer_id: cart.user_id || null, // Updated to use the new user_id column
        payment_link: null,
        tracking_code: cart.shipping_tracking_code || null,
        delivery_method: cart.delivery_method,
        live_event_id: cart.live_event_id,
        seller_id: cart.seller_id,
        internal_notes: null,
        mp_checkout_url: null,
        customer_notes: cart.customer_checkout_notes || cart.customer_live_notes,
        delivery_period: cart.delivery_period,
        last_whatsapp_status: null,
        last_whatsapp_sent_at: null,
        whatsapp_message_override: null,
        reserved_until: null,
        address_snapshot: cart.shipping_address_snapshot,
        me_shipment_id: cart.me_shipment_id,
        me_label_url: cart.me_label_url,
        paid_at: cart.paid_at,
        // Live specific fields
        source: "live",
        live_cart_id: cart.id,
        live_bag_number: cart.bag_number,
        live_event: cart.live_event,
        requires_physical_cancel: false // Default to false
      }));

      // 4. Merge and Sort
      const allOrders = [...(regularOrders || []), ...mappedLiveOrders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Cast the data to our Order type
      setOrders(allOrders as unknown as Order[]);
    } catch (error) {
      console.error("Error loading orders:", error);
      toast.error("Erro ao carregar pedidos");
    } finally {
      setIsLoading(false);
    }
  };

  // Load pending order IDs for special filters
  const loadPendingOrderIds = async () => {
    if (!specialFilter) return;

    const pendingType = specialFilterToPendingType[specialFilter];
    if (!pendingType) return;

    const result = await getOperationalPendingOrders({ type: pendingType });
    const ids = new Set(result.allOrders.map(o => o.id));
    setPendingOrderIds(ids);
  };

  // Clear all filters and URL params
  const clearAllFilters = () => {
    setFilterStatus("all");
    setFilterSource("all");
    setFilterSeller(null);
    setSpecialFilter(null);
    setSearchTerm("");

    // Clear URL params except tab
    const newParams = new URLSearchParams();
    newParams.set("tab", "orders");
    setSearchParams(newParams);
  };

  const loadOrderItems = async (orderId: string) => {
    if (orderItems[orderId]) return;

    const { data } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    if (data) {
      setOrderItems((prev) => ({ ...prev, [orderId]: data }));
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // Build update payload - set paid_at when changing to paid status
    const normalizedStatus = newStatus.toLowerCase().trim();
    const isPaidStatus = ['pago', 'paid', 'approved', 'payment_approved'].includes(normalizedStatus);

    const updatePayload: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    // Set paid_at = now() when marking as paid (if not already set)
    if (isPaidStatus && !order.paid_at) {
      updatePayload.paid_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    // Update local state
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? {
        ...o,
        status: newStatus,
        paid_at: updatePayload.paid_at || o.paid_at
      } : o))
    );

    // Auto-generate WhatsApp message for new status
    const templateData = {
      customerName: order.customer_name.split(' ')[0], // First name
      shortId: getShortOrderId(orderId),
      trackingCode: order.tracking_code,
      total: formatPrice(order.total),
    };
    const newMessage = getWhatsAppTemplateForStatus(newStatus as OrderStatus, templateData);
    setWhatsappMessages(prev => ({ ...prev, [orderId]: newMessage }));

    // Mark as pending send to alert admin
    setWhatsappPendingSend(prev => ({ ...prev, [orderId]: true }));

    toast.success("Status atualizado — mensagem pronta para enviar!");
  };

  const handleSellerChange = async (orderId: string, sellerId: string | null) => {
    const { error } = await supabase
      .from("orders")
      .update({ seller_id: sellerId === "none" ? null : sellerId })
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao atualizar vendedora");
      return;
    }

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, seller_id: sellerId === "none" ? null : sellerId } : o))
    );
    toast.success("Vendedora atualizada");
  };

  // Check if order can have delivery method changed
  const canEditDeliveryMethod = (order: Order): { allowed: boolean; reason?: string } => {
    const normalizedStatus = (order.status || '').toLowerCase().trim();
    const paidStatuses = ['pago', 'paid', 'approved', 'payment_approved', 'etiqueta_gerada', 'enviado', 'entregue'];
    const isPaid = paidStatuses.includes(normalizedStatus) || !!order.paid_at;

    if (isPaid) {
      return { allowed: false, reason: "Não é possível alterar entrega após pagamento confirmado." };
    }

    if (order.tracking_code || order.me_label_url || order.me_shipment_id) {
      return { allowed: false, reason: "Não é possível alterar entrega com etiqueta/rastreio gerado." };
    }

    return { allowed: true };
  };

  // Handle delivery method change
  const handleDeliveryMethodChange = async (orderId: string, method: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const canEdit = canEditDeliveryMethod(order);
    if (!canEdit.allowed) {
      toast.error(
        <div className="space-y-1">
          <p><strong>Alteração bloqueada</strong></p>
          <p className="text-sm">{canEdit.reason}</p>
          <p className="text-xs text-muted-foreground">Coloque o pedido em ATENÇÃO para ajuste manual.</p>
        </div>,
        { duration: 6000 }
      );
      return;
    }

    const { error } = await supabase
      .from("orders")
      .update({
        delivery_method: method,
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao atualizar método de entrega");
      return;
    }

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, delivery_method: method } : o))
    );

    setEditingDeliveryOrder(null);
    toast.success(`Método de entrega alterado para ${getDeliveryLabel(method)}`);
  };

  const handleSaveNotes = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ internal_notes: notesValue || null })
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao salvar observação");
      return;
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, internal_notes: notesValue || null } : o
      )
    );
    setEditingNotes(null);
    toast.success("Observação salva");
  };

  const handleSaveTrackingCode = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ tracking_code: trackingCodeValue || null })
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao salvar código");
      return;
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, tracking_code: trackingCodeValue || null } : o
      )
    );
    setEditingTrackingCode(null);
    toast.success("Código de rastreio salvo");
  };

  const generatePaymentMessage = (order: Order) => {
    const items = orderItems[order.id] || [];
    const itemsList = items
      .map((item) => {
        let itemText = `• ${item.product_name}`;
        if (item.color) itemText += ` - ${item.color}`;
        itemText += ` (${item.size}) x${item.quantity}`;
        return itemText;
      })
      .join("\n");

    const paymentUrl = order.mp_checkout_url || order.payment_link;

    return `Olá ${order.customer_name}! 👋

Seu pedido #${order.id.slice(0, 8).toUpperCase()} está pronto para pagamento.

*Itens:*
${itemsList}

*Total:* ${formatPrice(order.total)}

${paymentUrl ? `*Link para pagamento:*\n${paymentUrl}` : ""}

Qualquer dúvida estamos à disposição! 💕`;
  };

  const copyPaymentMessage = async (order: Order) => {
    const message = generatePaymentMessage(order);
    await copyToClipboard(message);
    toast.success("Mensagem copiada!");
  };

  const getWhatsAppUrl = (order: Order) => {
    const message = generatePaymentMessage(order);
    const cleanPhone = order.customer_phone.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const getOrderNumber = (orderId: string) => orderId.slice(0, 8).toUpperCase();

  const getOrderOrigin = (order: Order) => {
    if (order.source === 'live' || order.live_event_id) {
      const liveName = order.live_event?.titulo ? ` • ${order.live_event.titulo}` : '';
      const bagNumber = order.live_bag_number ? ` • Sacola #${order.live_bag_number}` : '';
      return {
        label: "Live",
        icon: Radio,
        color: "bg-pink-100 text-pink-700",
        details: `${liveName}${bagNumber}`.replace(/^ • /, '')
      };
    }
    return { label: "Loja Online", icon: Store, color: "bg-blue-100 text-blue-700", details: '' };
  };

  const getDeliveryLabel = (method: string | null) => {
    switch (method) {
      case "motoboy": return "Motoboy";
      case "pickup": return "Retirada na loja";
      case "shipping": return "Correios";
      default: return "Não definido";
    }
  };

  const getSellerName = (sellerId: string | null) => {
    if (!sellerId) return null;
    const seller = sellers.find(s => s.id === sellerId);
    return seller?.name || null;
  };

  const getReservationExpiryInfo = (order: Order) => {
    if (order.status !== 'aguardando_pagamento' || !order.reserved_until) {
      return null;
    }

    const now = new Date();
    const expiresAt = new Date(order.reserved_until);
    const diffMs = expiresAt.getTime() - now.getTime();

    if (diffMs <= 0) {
      return { expired: true, text: "Expirado", minutesLeft: 0 };
    }

    const minutesLeft = Math.ceil(diffMs / (1000 * 60));
    const hoursLeft = Math.floor(minutesLeft / 60);
    const daysLeft = Math.floor(hoursLeft / 24);

    const isLiveOrder = order.source === 'live' || order.live_event_id;

    // For live orders, show days/hours format
    if (isLiveOrder) {
      if (daysLeft >= 1) {
        const remainingHours = hoursLeft % 24;
        const text = remainingHours > 0 ? `${daysLeft}d ${remainingHours}h` : `${daysLeft}d`;
        return { expired: false, text, minutesLeft, urgent: daysLeft < 1 };
      } else if (hoursLeft >= 1) {
        return { expired: false, text: `${hoursLeft}h`, minutesLeft, urgent: hoursLeft < 6 };
      }
      // Less than 1 hour - show minutes
      return { expired: false, text: `${minutesLeft}min`, minutesLeft, urgent: true };
    }

    // For catalog orders, show minutes
    if (minutesLeft <= 5) {
      return { expired: false, text: `${minutesLeft}min`, minutesLeft, urgent: true };
    }

    return { expired: false, text: `${minutesLeft}min`, minutesLeft, urgent: false };
  };

  // Count orders requiring attention
  const attentionOrdersCount = orders.filter(o => o.requires_physical_cancel).length;

  // Check if any filters are active (for showing clear button)
  const hasActiveFilters = filterStatus !== "all" || filterSource !== "all" ||
    filterSeller !== null || specialFilter !== null || searchTerm !== "";

  // Get active filter description
  const specialFilterLabel = getSpecialFilterLabel(specialFilter);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Special filter handling - when a pending action type is selected
      if (specialFilter && isPendingActionsFilter(specialFilter)) {
        // For "pendencias" show all pending orders
        if (specialFilter === "pendencias") {
          return pendingOrderIds.has(order.id);
        }
        // For specific pending types, use the pendingOrderIds set
        return pendingOrderIds.has(order.id);
      }

      // Regular status filter
      const matchesStatus = filterStatus === "all" ||
        (filterStatus === "attention" && order.requires_physical_cancel) ||
        order.status === filterStatus;

      // Source filter
      const matchesSource = filterSource === "all" ||
        (filterSource === "live" && (order.source === 'live' || order.live_event_id)) ||
        (filterSource === "catalog" && order.source !== 'live' && !order.live_event_id);

      // Seller filter
      const matchesSeller = !filterSeller || order.seller_id === filterSeller;

      // Search filter
      const matchesSearch =
        searchTerm === "" ||
        order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_phone.includes(searchTerm) ||
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.live_bag_number && order.live_bag_number.toString().includes(searchTerm));

      return matchesStatus && matchesSource && matchesSeller && matchesSearch;
    });
  }, [orders, filterStatus, filterSource, filterSeller, specialFilter, pendingOrderIds, searchTerm]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active Filter Indicator */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Filtros ativos:</span>
          </div>

          {specialFilterLabel && (
            <Badge variant="secondary" className="gap-1">
              {specialFilterLabel}
              <button onClick={() => setSpecialFilter(null)} className="ml-1 hover:text-destructive">
                <XCircle className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filterStatus !== "all" && !specialFilter && (
            <Badge variant="secondary" className="gap-1">
              Status: {statusConfig[filterStatus]?.label || filterStatus}
              <button onClick={() => setFilterStatus("all")} className="ml-1 hover:text-destructive">
                <XCircle className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filterSource !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Origem: {filterSource === "live" ? "Live" : "Catálogo"}
              <button onClick={() => setFilterSource("all")} className="ml-1 hover:text-destructive">
                <XCircle className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filterSeller && (
            <Badge variant="secondary" className="gap-1">
              Vendedora: {sellers.find(s => s.id === filterSeller)?.name || filterSeller}
              <button onClick={() => setFilterSeller(null)} className="ml-1 hover:text-destructive">
                <XCircle className="h-3 w-3" />
              </button>
            </Badge>
          )}

          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-6 text-xs">
            Limpar todos
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou nº pedido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-full sm:w-[120px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            <SelectItem value="catalog">Loja Online</SelectItem>
            <SelectItem value="live">Live</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => {
          setFilterStatus(v);
          // Clear special filter when changing status
          if (specialFilter) setSpecialFilter(null);
        }}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {attentionOrdersCount > 0 && (
              <SelectItem value="attention" className="text-amber-600">
                ⚠️ Requerem atenção ({attentionOrdersCount})
              </SelectItem>
            )}
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Batch Actions Bar - shows when orders are selected */}
      {selectedOrders.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium">
            {selectedOrders.size} pedido{selectedOrders.size > 1 ? 's' : ''} selecionado{selectedOrders.size > 1 ? 's' : ''}
          </span>
          <div className="flex-1" />
          <BatchPackingSlipPrint orders={getSelectedOrdersWithItems()} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedOrders(new Set())}
          >
            Limpar seleção
          </Button>
        </div>
      )}

      {/* Orders List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Header - Desktop */}
        <div className="hidden md:grid grid-cols-[32px_40px_80px_1fr_80px_minmax(160px,auto)_80px_90px] gap-3 px-4 py-3 bg-muted/40 border-b border-border text-sm font-medium text-muted-foreground">
          <div className="flex items-center justify-center">
            <Checkbox
              checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
              onCheckedChange={toggleSelectAll}
            />
          </div>
          <div></div>
          <div>Pedido</div>
          <div>Cliente</div>
          <div>Origem</div>
          <div>Status</div>
          <div className="text-right">Total</div>
          <div className="text-right">Data</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          {filteredOrders.map((order) => {
            const status = statusConfig[order.status] || statusConfig.pendente;
            const StatusIcon = status.icon;
            const origin = getOrderOrigin(order);
            const OriginIcon = origin.icon;
            const isExpanded = expandedOrder === order.id;
            const sellerName = getSellerName(order.seller_id);
            const expiryInfo = getReservationExpiryInfo(order);

            return (
              <Collapsible
                key={order.id}
                open={isExpanded}
                onOpenChange={(open) => {
                  setExpandedOrder(open ? order.id : null);
                  if (open) loadOrderItems(order.id);
                }}
              >
                <CollapsibleTrigger asChild>
                  <div className="cursor-pointer hover:bg-muted/50 transition-colors">
                    {/* Desktop Row */}
                    <div className="hidden md:grid grid-cols-[32px_40px_80px_1fr_80px_minmax(160px,auto)_80px_90px] gap-3 px-4 py-3 items-center">
                      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedOrders.has(order.id)}
                          onCheckedChange={() => {
                            toggleOrderSelection(order.id);
                            // Load items when selecting for batch print
                            loadOrderItems(order.id);
                          }}
                        />
                      </div>
                      <div>
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""
                            }`}
                        />
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        #{getOrderNumber(order.id)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate text-sm">{order.customer_name}</p>
                          {sellerName && (
                            <Badge variant="outline" className="text-[10px] shrink-0 px-1.5 py-0">
                              <User className="h-2.5 w-2.5 mr-0.5" />
                              {sellerName}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {order.customer_phone}
                        </p>
                      </div>
                      <div className="flex flex-col gap-0.5 items-start">
                        <Badge className={`${origin.color} border-0 gap-1 text-[10px] px-1.5`}>
                          <OriginIcon className="h-2.5 w-2.5" />
                          {origin.label}
                        </Badge>
                        {origin.details && (
                          <span className="text-[9px] text-muted-foreground truncate max-w-[100px]" title={origin.details}>
                            {origin.details}
                          </span>
                        )}
                      </div>
                      {/* Status Column - Stacked Layout */}
                      <div className="flex flex-col gap-1 items-start">
                        <Badge className={`${status.color} border-0 gap-1 text-xs`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                        {expiryInfo && (
                          <Badge
                            className={`border-0 gap-1 text-[10px] px-1.5 py-0 ${expiryInfo.expired
                                ? "bg-destructive text-destructive-foreground"
                                : expiryInfo.urgent
                                  ? "bg-amber-100 text-amber-700 animate-pulse-soft"
                                  : "bg-secondary text-muted-foreground"
                              }`}
                          >
                            <Timer className="h-2.5 w-2.5" />
                            {expiryInfo.expired ? "Reserva expirada" : `Reserva: ${expiryInfo.text}`}
                          </Badge>
                        )}
                        {order.requires_physical_cancel && (
                          <Badge
                            className="border-0 gap-1 text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 animate-pulse"
                          >
                            <AlertCircle className="h-2.5 w-2.5" />
                            Cancelar sacola física
                          </Badge>
                        )}
                      </div>
                      <div className="text-right font-semibold tabular-nums text-sm">
                        {formatPrice(order.total)}
                      </div>
                      <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(order.created_at)}
                      </div>
                    </div>

                    {/* Mobile Row */}
                    <div className="md:hidden p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""
                              }`}
                          />
                          <div>
                            <p className="font-medium text-sm">{order.customer_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              #{getOrderNumber(order.id)} • {formatDate(order.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-sm tabular-nums">{formatPrice(order.total)}</p>
                          <Badge className={`${origin.color} border-0 text-[10px] px-1.5 mt-1`}>
                            {origin.label}
                          </Badge>
                        </div>
                      </div>
                      {/* Status badges - stacked on mobile */}
                      <div className="flex flex-wrap items-center gap-1.5 ml-6">
                        <Badge className={`${status.color} border-0 gap-1 text-xs`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                        {expiryInfo && (
                          <Badge
                            className={`border-0 gap-1 text-[10px] px-1.5 ${expiryInfo.expired
                                ? "bg-destructive text-destructive-foreground"
                                : expiryInfo.urgent
                                  ? "bg-amber-100 text-amber-700 animate-pulse-soft"
                                  : "bg-secondary text-muted-foreground"
                              }`}
                          >
                            <Timer className="h-2.5 w-2.5" />
                            {expiryInfo.expired ? "Expirada" : expiryInfo.text}
                          </Badge>
                        )}
                        {order.requires_physical_cancel && (
                          <Badge
                            className="border-0 gap-1 text-[10px] px-1.5 bg-orange-100 text-orange-700 animate-pulse"
                          >
                            <AlertCircle className="h-2.5 w-2.5" />
                            Cancelar sacola
                          </Badge>
                        )}
                        {sellerName && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            <User className="h-2.5 w-2.5 mr-0.5" />
                            {sellerName}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="px-4 py-4 bg-muted/20 border-t border-border">
                    {/* Operational Alert Banner */}
                    {order.requires_physical_cancel && (
                      <Alert className="mb-4 border-orange-200 bg-orange-50">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="flex items-center justify-between">
                          <span className="text-orange-700">
                            <strong>⚠️ Atenção:</strong> Reserva expirada. É necessário cancelar a sacola física da Live.
                            {order.live_bag_number && ` (Sacola #${order.live_bag_number})`}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="ml-2 border-orange-300 text-orange-700 hover:bg-orange-100"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const { error } = await supabase
                                .from("orders")
                                .update({
                                  requires_physical_cancel: false,
                                  attention_reason: null,
                                  attention_at: null
                                })
                                .eq("id", order.id);

                              if (error) {
                                toast.error("Erro ao resolver atenção");
                                return;
                              }

                              setOrders(prev => prev.map(o =>
                                o.id === order.id
                                  ? { ...o, requires_physical_cancel: false, attention_reason: null, attention_at: null }
                                  : o
                              ));
                              toast.success("Atenção resolvida!");
                            }}
                          >
                            ✓ Marcar como resolvido
                          </Button>
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Order Items */}
                      <div>
                        <h4 className="font-medium mb-3 text-sm">Itens do pedido</h4>
                        <div className="space-y-2">
                          {orderItems[order.id]?.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-3 p-2 bg-background rounded-lg"
                            >
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.product_name}
                                  className="w-10 h-10 object-cover rounded"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-secondary rounded flex items-center justify-center">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {item.product_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {item.size}
                                  {item.color && ` • ${item.color}`} • x
                                  {item.quantity}
                                </p>
                              </div>
                              <span className="text-sm font-medium">
                                {formatPrice(item.product_price * item.quantity)}
                              </span>
                            </div>
                          )) || (
                              <p className="text-sm text-muted-foreground">
                                Carregando...
                              </p>
                            )}
                        </div>

                        <Separator className="my-4" />

                        <div className="space-y-2 text-sm">
                          {/* Delivery Method with Edit Option */}
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Entrega: </span>
                            {editingDeliveryOrder === order.id ? (
                              <div className="flex items-center gap-2">
                                <Select
                                  value={newDeliveryMethod || order.delivery_method || ""}
                                  onValueChange={(value) => setNewDeliveryMethod(value)}
                                >
                                  <SelectTrigger className="h-7 w-[140px] text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pickup">Retirada na loja</SelectItem>
                                    <SelectItem value="motoboy">Motoboy</SelectItem>
                                    <SelectItem value="shipping">Correios</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => handleDeliveryMethodChange(order.id, newDeliveryMethod || order.delivery_method || "")}
                                  disabled={!newDeliveryMethod || newDeliveryMethod === order.delivery_method}
                                >
                                  <Save className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => {
                                    setEditingDeliveryOrder(null);
                                    setNewDeliveryMethod("");
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <span className="font-medium">{getDeliveryLabel(order.delivery_method)}</span>
                                {(() => {
                                  const canEdit = canEditDeliveryMethod(order);
                                  if (canEdit.allowed) {
                                    return (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingDeliveryOrder(order.id);
                                          setNewDeliveryMethod(order.delivery_method || "");
                                        }}
                                      >
                                        <Edit2 className="h-3 w-3" />
                                        Alterar
                                      </Button>
                                    );
                                  } else {
                                    return (
                                      <span className="text-xs text-muted-foreground flex items-center gap-1 ml-2">
                                        <Lock className="h-3 w-3" />
                                        Bloqueado
                                      </span>
                                    );
                                  }
                                })()}
                              </>
                            )}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Endereço: </span>
                            <span>{order.customer_address}</span>
                          </div>
                          {/* CPF - show if available (for Correios) */}
                          {order.delivery_method === 'shipping' && (
                            <div>
                              <span className="text-muted-foreground">CPF: </span>
                              {(() => {
                                const cpfRaw = (order.address_snapshot?.document || order.address_snapshot?.cpf || "").replace(/\D/g, "");
                                if (cpfRaw.length === 11) {
                                  return <span className="font-medium text-green-700">{cpfRaw.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</span>;
                                }
                                return <span className="text-amber-600 font-medium">Não cadastrado</span>;
                              })()}
                            </div>
                          )}

                          {/* Tracking Code - show for Correios orders with label */}
                          {order.delivery_method === 'shipping' && (order.tracking_code || order.me_label_url || order.status === 'etiqueta_gerada') && (
                            <div className="mt-2 pt-2 border-t border-dashed border-border">
                              {(() => {
                                // Validation: Check if tracking code is valid (not ORD-... or other invalid formats)
                                const isValidTracking = (code: string | null | undefined) => {
                                  if (!code) return false;
                                  if (code.startsWith('ORD-') || code.startsWith('ORD')) return false;
                                  // Correios format: AA123456789BR
                                  const isCorreios = /^[A-Z]{2}\d{9}BR$/.test(code);
                                  // Numeric format (Jadlog, etc.): 8-20 digits
                                  const isNumeric = /^\d{8,20}$/.test(code);
                                  return isCorreios || isNumeric;
                                };

                                const hasValidTracking = isValidTracking(order.tracking_code);

                                if (hasValidTracking) {
                                  return (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-muted-foreground">Rastreio:</span>
                                      <Badge variant="outline" className="font-mono text-xs bg-purple-50 text-purple-700 border-purple-200">
                                        {order.tracking_code}
                                      </Badge>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 px-2 text-xs gap-1"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const success = await copyToClipboard(order.tracking_code!);
                                          if (success) {
                                            toast.success("Código de rastreio copiado!");
                                          } else {
                                            toast.error("Erro ao copiar");
                                          }
                                        }}
                                      >
                                        <Copy className="h-3 w-3" />
                                        Copiar
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 px-2 text-xs gap-1"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.open(
                                            `https://www.correios.com.br/rastreamento?objetos=${order.tracking_code}`,
                                            '_blank'
                                          );
                                        }}
                                      >
                                        <Truck className="h-3 w-3" />
                                        Acompanhar
                                      </Button>
                                      {/* Edit button */}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs gap-1 text-muted-foreground"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingTrackingCode(order.id);
                                          setTrackingCodeValue(order.tracking_code || "");
                                        }}
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  );
                                }

                                // No valid tracking - show sync/edit options
                                return (
                                  <div className="space-y-2">
                                    {editingTrackingCode === order.id ? (
                                      <div className="flex items-center gap-2">
                                        <Input
                                          value={trackingCodeValue}
                                          onChange={(e) => setTrackingCodeValue(e.target.value.toUpperCase())}
                                          placeholder="Ex: AB123456789BR"
                                          className="h-8 text-sm font-mono flex-1 max-w-[200px]"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <Button
                                          size="sm"
                                          className="h-8"
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            await handleSaveTrackingCode(order.id);
                                          }}
                                        >
                                          <Save className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-8"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingTrackingCode(null);
                                          }}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="flex flex-wrap items-center gap-2">
                                        <div className="flex items-center gap-1 text-amber-600">
                                          <AlertCircle className="h-4 w-4" />
                                          <span className="text-xs">Rastreio não encontrado</span>
                                        </div>
                                        {order.me_shipment_id && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-6 px-2 text-xs gap-1"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              toast.loading("Sincronizando rastreio...", { id: `sync-${order.id}` });
                                              try {
                                                const { data, error } = await supabase.functions.invoke('sync-order-tracking', {
                                                  body: { orderId: order.id }
                                                });
                                                if (error || data?.error) {
                                                  toast.error(data?.error || "Erro ao sincronizar", { id: `sync-${order.id}` });
                                                } else if (data?.tracking_code) {
                                                  toast.success(`Rastreio sincronizado: ${data.tracking_code}`, { id: `sync-${order.id}` });
                                                  loadOrders(); // Refresh orders
                                                } else {
                                                  toast.error("Rastreio ainda não disponível", { id: `sync-${order.id}` });
                                                }
                                              } catch (err) {
                                                toast.error("Erro ao sincronizar rastreio", { id: `sync-${order.id}` });
                                              }
                                            }}
                                          >
                                            <RefreshCw className="h-3 w-3" />
                                            Sincronizar
                                          </Button>
                                        )}
                                        {/* Manual edit option when label exists */}
                                        {(order.me_label_url || order.status === 'etiqueta_gerada') && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-6 px-2 text-xs gap-1"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingTrackingCode(order.id);
                                              setTrackingCodeValue(order.tracking_code || "");
                                            }}
                                          >
                                            <Edit2 className="h-3 w-3" />
                                            Editar rastreio
                                          </Button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>

                        {/* Print Actions */}
                        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-dashed border-border">
                          <OrderPackingSlipPrint
                            order={order}
                            items={orderItems[order.id] || []}
                          />
                          <OrderShippingLabelPrint
                            order={order}
                            onLabelGenerated={(labelUrl, trackingCode) => {
                              // Update local state with new label info
                              // IMPORTANT: Do NOT change orders.status - keep payment status intact
                              // Use shipping_status for shipping state
                              setOrders(prev => prev.map(o =>
                                o.id === order.id
                                  ? {
                                    ...o,
                                    me_label_url: labelUrl,
                                    tracking_code: trackingCode,
                                    shipping_status: 'etiqueta_gerada',
                                    shipping_label_generated_at: new Date().toISOString()
                                    // Note: status remains unchanged (e.g., 'pago')
                                  }
                                  : o
                              ));
                            }}
                            onOrderUpdated={(updatedOrder) => {
                              // Update local state when CPF is added
                              setOrders(prev => prev.map(o =>
                                o.id === updatedOrder.id
                                  ? { ...o, address_snapshot: updatedOrder.address_snapshot }
                                  : o
                              ));
                            }}
                          />
                        </div>
                      </div>

                      {/* Order Actions */}
                      <div className="space-y-4">
                        {/* Status Change */}
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Alterar status
                          </label>
                          <Select
                            value={order.status}
                            onValueChange={(value) =>
                              handleStatusChange(order.id, value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Seller Assignment */}
                        <div>
                          <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Vendedora responsável
                          </label>
                          <Select
                            value={order.seller_id || "none"}
                            onValueChange={(value) =>
                              handleSellerChange(order.id, value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecionar vendedora" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhuma</SelectItem>
                              {sellers.map((seller) => (
                                <SelectItem key={seller.id} value={seller.id}>
                                  {seller.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Customer Notes (from checkout) */}
                        {order.customer_notes && (
                          <div>
                            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                              <MessageCircle className="h-4 w-4 text-blue-500" />
                              Observação do cliente
                            </label>
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                              {order.customer_notes}
                              {order.delivery_period && (
                                <p className="mt-2 text-xs text-blue-600">
                                  Período preferido: {order.delivery_period === 'manha' ? 'Manhã' : order.delivery_period === 'tarde' ? 'Tarde' : 'Qualquer horário'}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Internal Notes */}
                        <div>
                          <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                            <StickyNote className="h-4 w-4" />
                            Observação interna
                          </label>
                          {editingNotes === order.id ? (
                            <div className="space-y-2">
                              <Textarea
                                placeholder="Ex: Cliente vai passar na loja dia 30/01 para experimentar..."
                                value={notesValue}
                                onChange={(e) => setNotesValue(e.target.value)}
                                rows={3}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveNotes(order.id)}
                                >
                                  <Save className="h-4 w-4 mr-1" />
                                  Salvar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingNotes(null)}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              {order.internal_notes ? (
                                <div className="flex-1 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                                  {order.internal_notes}
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground italic">
                                  Sem observações
                                </span>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setNotesValue(order.internal_notes || "");
                                  setEditingNotes(order.id);
                                }}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Tracking Code (only when status is enviado) */}
                        {order.status === "enviado" && (
                          <div>
                            <label className="text-sm font-medium mb-2 block">
                              Código de rastreio
                            </label>
                            {editingTrackingCode === order.id ? (
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Ex: BR123456789BR"
                                  value={trackingCodeValue}
                                  onChange={(e) =>
                                    setTrackingCodeValue(e.target.value)
                                  }
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveTrackingCode(order.id)}
                                >
                                  Salvar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingTrackingCode(null)}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                {order.tracking_code ? (
                                  <>
                                    <span className="font-mono">
                                      {order.tracking_code}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setTrackingCodeValue(
                                          order.tracking_code || ""
                                        );
                                        setEditingTrackingCode(order.id);
                                      }}
                                    >
                                      Editar
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setTrackingCodeValue("");
                                      setEditingTrackingCode(order.id);
                                    }}
                                  >
                                    Adicionar código
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Revalidate Payment - for pending orders */}
                        {(order.status === "aguardando_pagamento" || order.status === "pendente") && (
                          <Button
                            variant="outline"
                            className="w-full gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                            onClick={() => {
                              setRevalidateOrderId(order.id);
                              setShowRevalidateModal(true);
                            }}
                          >
                            <RefreshCw className="h-4 w-4" />
                            Revalidar Pagamento MP
                          </Button>
                        )}

                        {/* WhatsApp Section with Auto-Template */}
                        <div className="space-y-3">
                          <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                            <MessageCircle className="h-4 w-4 text-green-600" />
                            Mensagem WhatsApp
                          </label>

                          {/* Alert when status changed and message pending */}
                          {whatsappPendingSend[order.id] && (
                            <Alert className="border-green-300 bg-green-50">
                              <AlertCircle className="h-4 w-4 text-green-600" />
                              <AlertDescription className="text-green-800">
                                <strong>Mensagem atualizada!</strong> Clique em "Enviar WhatsApp" para notificar a cliente.
                              </AlertDescription>
                            </Alert>
                          )}

                          {/* Last sent info */}
                          {order.last_whatsapp_sent_at && (
                            <p className="text-xs text-muted-foreground">
                              Última notificação: {new Date(order.last_whatsapp_sent_at).toLocaleString('pt-BR')}
                              {order.last_whatsapp_status && ` (${statusConfig[order.last_whatsapp_status]?.label || order.last_whatsapp_status})`}
                            </p>
                          )}

                          {/* Editable message textarea */}
                          {editingWhatsappMessage === order.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={whatsappMessages[order.id] || getWhatsAppTemplateForStatus(order.status as OrderStatus, {
                                  customerName: order.customer_name.split(' ')[0],
                                  shortId: getShortOrderId(order.id),
                                  trackingCode: order.tracking_code,
                                  total: formatPrice(order.total),
                                })}
                                onChange={(e) => setWhatsappMessages(prev => ({ ...prev, [order.id]: e.target.value }))}
                                rows={5}
                                className="text-sm"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={() => setEditingWhatsappMessage(null)}>
                                  Fechar editor
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    // Reset to template
                                    const newMessage = getWhatsAppTemplateForStatus(order.status as OrderStatus, {
                                      customerName: order.customer_name.split(' ')[0],
                                      shortId: getShortOrderId(order.id),
                                      trackingCode: order.tracking_code,
                                      total: formatPrice(order.total),
                                    });
                                    setWhatsappMessages(prev => ({ ...prev, [order.id]: newMessage }));
                                  }}
                                >
                                  Resetar para template
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className="p-3 bg-muted/50 rounded-lg text-sm cursor-pointer hover:bg-muted transition-colors"
                              onClick={() => setEditingWhatsappMessage(order.id)}
                            >
                              <p className="whitespace-pre-wrap line-clamp-3">
                                {whatsappMessages[order.id] || getWhatsAppTemplateForStatus(order.status as OrderStatus, {
                                  customerName: order.customer_name.split(' ')[0],
                                  shortId: getShortOrderId(order.id),
                                  trackingCode: order.tracking_code,
                                  total: formatPrice(order.total),
                                })}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">Clique para editar</p>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              className="flex-1 gap-2"
                              onClick={async () => {
                                const message = whatsappMessages[order.id] || getWhatsAppTemplateForStatus(order.status as OrderStatus, {
                                  customerName: order.customer_name.split(' ')[0],
                                  shortId: getShortOrderId(order.id),
                                  trackingCode: order.tracking_code,
                                  total: formatPrice(order.total),
                                });
                                await copyToClipboard(message);
                                toast.success("Mensagem copiada!");
                              }}
                            >
                              <Copy className="h-4 w-4" />
                              Copiar msg
                            </Button>
                            <Button
                              className={`flex-1 gap-2 ${whatsappPendingSend[order.id] ? 'bg-green-600 hover:bg-green-700 animate-pulse' : 'btn-whatsapp'}`}
                              onClick={async () => {
                                const message = whatsappMessages[order.id] || getWhatsAppTemplateForStatus(order.status as OrderStatus, {
                                  customerName: order.customer_name.split(' ')[0],
                                  shortId: getShortOrderId(order.id),
                                  trackingCode: order.tracking_code,
                                  total: formatPrice(order.total),
                                });

                                const cleanPhone = order.customer_phone.replace(/\D/g, "");
                                const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
                                const waUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;

                                // Open WhatsApp
                                window.open(waUrl, '_blank', 'noopener,noreferrer');

                                // Record the send in database
                                await supabase
                                  .from("orders")
                                  .update({
                                    last_whatsapp_status: order.status,
                                    last_whatsapp_sent_at: new Date().toISOString(),
                                    whatsapp_message_override: whatsappMessages[order.id] || null,
                                  })
                                  .eq("id", order.id);

                                // Update local state
                                setOrders(prev => prev.map(o =>
                                  o.id === order.id
                                    ? { ...o, last_whatsapp_status: order.status, last_whatsapp_sent_at: new Date().toISOString() }
                                    : o
                                ));

                                // Clear pending flag
                                setWhatsappPendingSend(prev => ({ ...prev, [order.id]: false }));

                                toast.success("WhatsApp aberto — notificação registrada!");
                              }}
                            >
                              <Send className="h-4 w-4" />
                              {whatsappPendingSend[order.id] ? 'Enviar Agora!' : 'Enviar WhatsApp'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {orders.length === 0
              ? "Nenhum pedido ainda."
              : "Nenhum pedido encontrado com os filtros aplicados."}
          </div>
        )}
      </div>

      {/* Revalidate Payment Modal */}
      <RevalidatePaymentModal
        open={showRevalidateModal}
        onClose={() => {
          setShowRevalidateModal(false);
          setRevalidateOrderId(null);
        }}
        onSuccess={loadOrders}
        orderId={revalidateOrderId || undefined}
      />
    </div>
  );
}
