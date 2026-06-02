import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Clock, CheckCircle, Truck, CreditCard, X, ChevronDown, Copy,
  Package, Search, MessageCircle, Radio, Store, StickyNote, User,
  Save, Edit2, RefreshCw, AlertCircle, Send, Timer, FileText, Printer,
  MapPin, Lock, Filter, XCircle, ShieldCheck, Receipt
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
import { ManualPaymentValidationModal } from "./ManualPaymentValidationModal";
import { ManualPaymentModal } from "./live-shop/ManualPaymentModal";

import { OrderPackingSlipPrint, BatchPackingSlipPrint } from "./orders/OrderPackingSlipPrint";
import { OrderShippingLabelPrint } from "./orders/OrderShippingLabelPrint";
import {
  getWhatsAppTemplateForStatus,
  getShortOrderId,
  type OrderStatus
} from "@/lib/whatsappTemplates";
import {
  parseOrdersUrlParams,
} from "@/lib/dashboardNavigation";

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
  payment_review_status?: string | null;
  payment_proof_url?: string | null;
  updated_at?: string;
  shipping_fee?: number | null;
  subtotal?: number | null;
  coupon_discount?: number | null;
  coupon_id?: string | null;
  coupon?: { code: string; discount_type: string; discount_value: number } | null;
  // Payment info
  paid_method?: string | null;
  installments?: number | null;
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
  live_item_status?: string | null;
  live_item_cancelled?: boolean;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  // 🟠 Precisa de ação (laranja/amber)
  aberto: { label: "Aguardando Pagamento (sacola)", icon: Clock, color: "bg-[#fff3e0] text-[#e65100] border-[#ffcc80]" },
  aguardando_retorno: { label: "Aguardando Retorno", icon: Clock, color: "bg-[#ffe0b2] text-[#e65100] border-[#ffb74d]" },
  pendente: { label: "Aguardando Pagamento (legado)", icon: Clock, color: "bg-[#fff3e0] text-[#e65100] border-[#ffcc80]" },
  aguardando_pagamento: { label: "Aguardando Pagamento", icon: CreditCard, color: "bg-[#ffe0b2] text-[#bf360c] border-[#ffb74d]" },
  aguardando_pagamento_frete: { label: "Aguardando Pag. Frete", icon: CreditCard, color: "bg-[#fff9c4] text-[#f57f17] border-[#fff176]" },
  // 🔵 Em espera (azul)
  manter_na_reserva: { label: "Manter na Reserva", icon: Clock, color: "bg-[#e3f2fd] text-[#1565c0] border-[#90caf9]" },
  // 🟢 Positivos / Concluídos (verde)
  pago: { label: "Pago", icon: CheckCircle, color: "bg-[#c8e6c9] text-[#1b5e20] border-[#81c784]" },
  confirmado: { label: "Pago (legado)", icon: CheckCircle, color: "bg-[#c8e6c9] text-[#1b5e20] border-[#81c784]" },
  etiqueta_gerada: { label: "Etiqueta Gerada", icon: FileText, color: "bg-[#e0f2f1] text-[#00695c] border-[#80cbc4]" },
  enviado: { label: "Enviado", icon: Truck, color: "bg-[#a5d6a7] text-[#1b5e20] border-[#66bb6a]" },
  entregue: { label: "Entregue", icon: CheckCircle, color: "bg-[#81c784] text-[#0d3b0f] border-[#4caf50]" },
  // 🔴 Negativos (vermelho)
  cancelado: { label: "Cancelado", icon: X, color: "bg-[#ffcdd2] text-[#b71c1c] border-[#ef9a9a]" },
  pagamento_rejeitado: { label: "Pagamento Rejeitado", icon: X, color: "bg-[#ffcdd2] text-[#b71c1c] border-[#ef9a9a]" },
  reembolsado: { label: "Reembolsado", icon: Clock, color: "bg-[#ffebee] text-[#c62828] border-[#ef9a9a]" },
  abandonado: { label: "Abandonado", icon: X, color: "bg-[#f5f5f5] text-[#757575] border-[#e0e0e0]" },
  // 🟣 Atenção gerente (roxo)
  aguardando_validacao_pagamento: { label: "Validar Pagamento", icon: ShieldCheck, color: "bg-[#e1bee7] text-[#6a1b9a] animate-pulse border-[#ce93d8]" },
};


// -- OrderUpsellSection: tracks in-store add-on sales for live orders --
function OrderUpsellSection({ cartId }: { cartId: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTotal, setCurrentTotal] = useState(0);
  const [currentNotes, setCurrentNotes] = useState('');
  const [total, setTotal] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("live_carts")
        .select("upsell_total, upsell_notes")
        .eq("id", cartId)
        .single();
      if (data) {
        setCurrentTotal((data as any).upsell_total || 0);
        setCurrentNotes((data as any).upsell_notes || '');
      }
      setIsLoading(false);
    })();
  }, [cartId]);

  const handleSave = async () => {
    setIsSaving(true);
    const parsedTotal = parseFloat(total.replace(',', '.')) || 0;
    const { error } = await supabase
      .from("live_carts")
      .update({
        upsell_total: parsedTotal,
        upsell_notes: notes.trim() || null,
      } as any)
      .eq("id", cartId);

    if (error) {
      toast.error("Erro ao salvar venda adicional");
    } else {
      setCurrentTotal(parsedTotal);
      setCurrentNotes(notes.trim());
      toast.success("Venda adicional salva!");
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  if (isLoading) return null;

  const hasUpsell = currentTotal > 0;

  if (!isEditing) {
    return (
      <div>
        <label className="text-sm font-medium mb-2 block flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-emerald-600" />
          Venda Adicional (Retirada)
        </label>
        <div className="flex items-start gap-2">
          {hasUpsell ? (
            <div className="flex-1 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-lg font-bold text-emerald-800">{fmt(currentTotal)}</p>
              {currentNotes && (
                <p className="text-sm text-emerald-600 mt-1">{currentNotes}</p>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground italic">
              Nenhuma venda adicional
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setTotal(String(currentTotal || ''));
              setNotes(currentNotes || '');
              setIsEditing(true);
            }}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-sm font-medium mb-2 block flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-emerald-600" />
        Venda Adicional (Retirada)
      </label>
      <div className="space-y-2">
        <Input
          type="text"
          inputMode="decimal"
          placeholder="Valor adicional (R$)"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
        />
        <Input
          type="text"
          placeholder="Ex: Levou + 1 blusa e 1 saia"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Save className="h-4 w-4 mr-1" />
            Salvar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(false)}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

// -- OrderRegisterCustomerSection: complete/create customer registration from order --
function OrderRegisterCustomerSection({
  orderId,
  instagramHandle,
  existingCustomerId,
  onRegistered,
}: {
  orderId: string;
  instagramHandle: string;
  existingCustomerId: string | null;
  onRegistered: (customerId: string, newName: string, newPhone: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Extract clean Instagram handle
  const cleanHandle = instagramHandle?.replace(/^@/, '').toLowerCase().trim() || '';

  // Check if customer already has phone (complete registration)
  useEffect(() => {
    if (!existingCustomerId) {
      setIsLoading(false);
      setIsComplete(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("customers")
        .select("name, phone")
        .eq("id", existingCustomerId)
        .maybeSingle();
      if (data?.phone) {
        setIsComplete(true);
        setName(data.name || '');
        setPhone(data.phone || '');
      } else {
        setIsComplete(false);
        setName(data?.name || '');
      }
      setIsLoading(false);
    })();
  }, [existingCustomerId]);

  if (isLoading) return null;
  if (isComplete) return null; // Customer already has phone — fully registered

  if (!isOpen) {
    return (
      <div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 w-full"
          onClick={() => setIsOpen(true)}
        >
          <User className="h-4 w-4" />
          {existingCustomerId ? `Completar cadastro de @${cleanHandle}` : `Cadastrar @${cleanHandle} como cliente`}
        </Button>
      </div>
    );
  }

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.error("Preencha nome e telefone");
      return;
    }
    setIsSaving(true);
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        toast.error("Telefone inválido. Insira com DDD.");
        setIsSaving(false);
        return;
      }
      const formattedPhone = cleanPhone.length === 11
        ? `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 7)}-${cleanPhone.slice(7)}`
        : cleanPhone;

      if (existingCustomerId) {
        // UPDATE existing customer with missing data
        const { error } = await supabase
          .from("customers")
          .update({ name: name.trim(), phone: formattedPhone })
          .eq("id", existingCustomerId);

        if (error) throw error;

        // Also update orders table with name and phone
        await supabase
          .from("orders")
          .update({ customer_name: name.trim(), customer_phone: formattedPhone })
          .eq("id", orderId);

        toast.success(`Cadastro de @${cleanHandle} atualizado!`);
        onRegistered(existingCustomerId, name.trim(), formattedPhone);
        setIsComplete(true);
        setIsOpen(false);
        return;
      }

      // Check duplicate phone
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", formattedPhone)
        .maybeSingle();

      if (existing) {
        await supabase.from("orders").update({ customer_id: existing.id, customer_name: name.trim(), customer_phone: formattedPhone }).eq("id", orderId);
        toast.success("Cliente já existente — pedido vinculado!");
        onRegistered(existing.id, name.trim(), formattedPhone);
        setIsComplete(true);
        setIsOpen(false);
        return;
      }

      // Insert new customer
      const { data: newCustomer, error: insertError } = await supabase
        .from("customers")
        .insert({ name: name.trim(), phone: formattedPhone })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Insert instagram_identity
      if (cleanHandle && newCustomer) {
        await supabase
          .from("instagram_identities")
          .insert({ customer_id: newCustomer.id, instagram_handle_normalized: cleanHandle, instagram_handle_raw: cleanHandle } as any);
      }

      // Link customer to order with name and phone
      await supabase.from("orders").update({ customer_id: newCustomer.id, customer_name: name.trim(), customer_phone: formattedPhone }).eq("id", orderId);

      toast.success(`${name.trim()} cadastrada com sucesso!`);
      onRegistered(newCustomer.id, name.trim(), formattedPhone);
      setIsComplete(true);
      setIsOpen(false);
    } catch (err: any) {
      console.error("Registration error:", err);
      toast.error("Erro ao cadastrar: " + (err.message || "Tente novamente"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-3 border border-emerald-200 rounded-lg bg-emerald-50/50 space-y-3">
      <label className="text-sm font-medium flex items-center gap-2">
        <User className="h-4 w-4 text-emerald-600" />
        {existingCustomerId ? `Completar cadastro de @${cleanHandle}` : `Cadastrar @${cleanHandle}`}
      </label>
      <div className="space-y-2">
        <Input
          placeholder="Nome completo"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Telefone (WhatsApp) com DDD"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="bg-zinc-800 hover:bg-zinc-900 text-white"
        >
          <Save className="h-4 w-4 mr-1" />
          {existingCustomerId ? 'Salvar' : 'Cadastrar'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

const statusOptions = [
  { value: "aguardando_retorno", label: "Aguardando Retorno" },
  { value: "aguardando_pagamento", label: "Aguardando Pagamento" },
  { value: "manter_na_reserva", label: "Manter na Reserva" },
  { value: "pago", label: "Pago" },
  { value: "etiqueta_gerada", label: "Etiqueta Gerada" },
  { value: "enviado", label: "Enviado" },
  { value: "entregue", label: "Entregue" },
  { value: "cancelado", label: "Cancelado" },
  { value: "pagamento_rejeitado", label: "Pagamento Rejeitado" },
  { value: "reembolsado", label: "Reembolsado" },
  { value: "aguardando_pagamento_frete", label: "Aguardando Pag. Frete" },
  { value: "aguardando_validacao_pagamento", label: "Validar Pagamento" },
];

// Operational filters — client-side, based on order properties
const operationalFilterOptions = [
  { value: "op_sem_vendedora", label: "🟡 Sem vendedora" },
  { value: "op_aguardando_pagamento_24h", label: "🔴 Pag. pendente >24h" },
  { value: "op_aguardando_retorno_24h", label: "🔴 Retorno pendente >24h" },
  { value: "op_pago_sem_logistica", label: "🟠 Pagos sem logística" },
  { value: "op_etiqueta_pendente", label: "🟠 Etiqueta sem postagem" },
  { value: "op_pendencias", label: "⚠️ Todas as pendências" },
];

const PAID_STATUSES_LIST = ['pago', 'preparar_envio', 'etiqueta_gerada', 'postado', 'em_rota', 'retirada', 'entregue'];
const FINALIZED_STATUSES_LIST = ['postado', 'em_rota', 'retirada', 'entregue'];

/** Check if a filterStatus is an operational filter (starts with op_) */
const isOperationalFilter = (status: string) => status.startsWith("op_");

/** Get human-readable label for operational filter */
const getOperationalFilterLabel = (status: string): string | null => {
  const opt = operationalFilterOptions.find(o => o.value === status);
  return opt ? opt.label.replace(/^[🟡🔴🟠⚠️]\s*/, '') : null;
};

/** Client-side operational filter matching */
function matchesOperationalFilter(order: Order, filterValue: string): boolean {
  const now = Date.now();
  const created = new Date(order.created_at).getTime();
  const updated = new Date(order.updated_at || order.created_at).getTime();
  const hoursSinceCreation = (now - created) / 3_600_000;
  const hoursStalled = (now - updated) / 3_600_000;
  const st = (order.status || '').toLowerCase();
  const isPaid = PAID_STATUSES_LIST.includes(st);
  const isFinalized = FINALIZED_STATUSES_LIST.includes(st);
  if (st === 'cancelado') return false;

  switch (filterValue) {
    case 'op_sem_vendedora':
      return !order.seller_id && !isFinalized;

    case 'op_aguardando_pagamento_24h':
      return (st === 'pendente' || st === 'aguardando_pagamento' || (!isPaid && order.source === 'live')) && hoursSinceCreation > 24;

    case 'op_aguardando_retorno_24h':
      return st === 'aguardando_retorno' && hoursStalled > 24;

    case 'op_pago_sem_logistica':
      return (st === 'pago' || st === 'preparar_envio') && order.delivery_method === 'shipping' && hoursStalled > 12;

    case 'op_etiqueta_pendente':
      return st === 'etiqueta_gerada' && hoursStalled > 24;

    case 'op_pendencias':
      return matchesOperationalFilter(order, 'op_sem_vendedora')
        || matchesOperationalFilter(order, 'op_aguardando_pagamento_24h')
        || matchesOperationalFilter(order, 'op_aguardando_retorno_24h')
        || matchesOperationalFilter(order, 'op_pago_sem_logistica')
        || matchesOperationalFilter(order, 'op_etiqueta_pendente');

    default:
      return true;
  }
}

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
    // Check specialFilter from URL and convert to op_ filter
    const sf = urlFilters.specialFilter;
    if (sf) {
      const sfToOp: Record<string, string> = {
        'pendencias': 'op_pendencias',
        'aguardando-24h': 'op_aguardando_pagamento_24h',
        'aguardando-retorno': 'op_aguardando_retorno_24h',
        'sem-logistica': 'op_pago_sem_logistica',
        'etiqueta-pendente': 'op_etiqueta_pendente',
        'sem-vendedora': 'op_sem_vendedora',
      };
      if (sfToOp[sf]) return sfToOp[sf];
    }
    if (urlFilters.status !== "all") return urlFilters.status;
    return mapInitialFilter(initialFilter) || "all";
  });
  const [filterSource, setFilterSource] = useState<string>(() => urlFilters.source || "all");
  const [filterSeller, setFilterSeller] = useState<string | null>(() => urlFilters.seller);

  const [searchTerm, setSearchTerm] = useState("");
  const [editingTrackingCode, setEditingTrackingCode] = useState<string | null>(null);
  const [trackingCodeValue, setTrackingCodeValue] = useState("");
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [showRevalidateModal, setShowRevalidateModal] = useState(false);
  const [revalidateOrderId, setRevalidateOrderId] = useState<string | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validatingOrder, setValidatingOrder] = useState<Order | null>(null);

  // Manual payment modal state
  const [showManualPaymentModal, setShowManualPaymentModal] = useState(false);
  const [manualPaymentOrderId, setManualPaymentOrderId] = useState<string | null>(null);
  const [manualPaymentOrderTotal, setManualPaymentOrderTotal] = useState<number>(0);


  // WhatsApp message state per order
  const [whatsappMessages, setWhatsappMessages] = useState<Record<string, string>>({});
  const [whatsappPendingSend, setWhatsappPendingSend] = useState<Record<string, boolean>>({});
  const [editingWhatsappMessage, setEditingWhatsappMessage] = useState<string | null>(null);

  // Multi-select state for batch printing
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  // Delivery method edit state
  const [editingDeliveryOrder, setEditingDeliveryOrder] = useState<string | null>(null);
  const [newDeliveryMethod, setNewDeliveryMethod] = useState<string>("");
  const [newShippingFee, setNewShippingFee] = useState<string>("");

  const { sellers } = useSellers();

  const isOrderItemCancelled = (item: OrderItem): boolean =>
    item.live_item_cancelled === true ||
    item.live_item_status === "cancelado" ||
    item.live_item_status === "removido";

  const splitOrderItemsByCancellation = (items: OrderItem[] | undefined) => {
    const all = items || [];
    const activeItems = all.filter((item) => !isOrderItemCancelled(item) && item.quantity > 0);
    const cancelledItems = all.filter((item) => isOrderItemCancelled(item));
    return { allItems: all, activeItems, cancelledItems };
  };

  const getPrintableOrderItems = (items: OrderItem[] | undefined): OrderItem[] =>
    (items || []).filter((item) => !isOrderItemCancelled(item) && item.quantity > 0);

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
        const items = getPrintableOrderItems(orderItems[orderId]);
        return order ? { order, items } : null;
      })
      .filter((item): item is { order: Order; items: OrderItem[] } => item !== null);
  };

  function mapInitialFilter(filter?: string): string | undefined {
    if (!filter) return undefined;
    // Map old special filter names to operational filter values
    const opMap: Record<string, string> = {
      'pendencias': 'op_pendencias',
      'aguardando-24h': 'op_aguardando_pagamento_24h',
      'aguardando-retorno': 'op_aguardando_retorno_24h',
      'nao-cobrado': 'op_pendencias',
      'sem-logistica': 'op_pago_sem_logistica',
      'etiqueta-pendente': 'op_etiqueta_pendente',
      'sem-vendedora': 'op_sem_vendedora',
      'urgente': 'op_pendencias',
      'funil': 'all',
    };
    if (opMap[filter]) return opMap[filter];

    const filterMap: Record<string, string> = {
      'aguardando': 'aguardando_pagamento',
      'pagos': 'pago',
      'separar': 'pago',
      'envio': 'enviado',
      'retirada': 'pago',
      'cancelado': 'cancelado',
    };
    return filterMap[filter] || filter;
  }

  // Sync filters with URL when they change
  useEffect(() => {
    const newUrlFilters = parseOrdersUrlParams(searchParams);
    // Convert specialFilter (from dashboard links) to op_ status
    if (newUrlFilters.specialFilter) {
      const mapped = mapInitialFilter(newUrlFilters.specialFilter);
      if (mapped && mapped !== 'all') setFilterStatus(mapped);
    } else if (newUrlFilters.status !== "all") {
      setFilterStatus(newUrlFilters.status);
    }
    if (newUrlFilters.source !== "all") setFilterSource(newUrlFilters.source);
    if (newUrlFilters.seller) setFilterSeller(newUrlFilters.seller);
  }, [searchParams]);

  useEffect(() => {
    loadOrders();
  }, []);

  const mapLiveCartItemsToOrderItems = (items: any[] | null | undefined): OrderItem[] => {
    if (!items) return [];
    return items.map((item) => {
      const variant = (item.variante as Record<string, string>) || {};
      const status = item.status || null;
      return {
        id: item.id,
        product_name: item.product?.name || variant.nome || "Produto da Live",
        product_price: item.preco_unitario ?? item.product?.price ?? 0,
        size: variant.tamanho || "Unico",
        quantity: item.qtd ?? 0,
        color: item.product?.color || variant.cor || null,
        image_url: item.product?.image_url || null,
        product_sku: item.product?.sku || null,
        live_item_status: status,
        live_item_cancelled: status === "cancelado" || status === "removido",
      };
    });
  };

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Regular Orders
      const { data: regularOrders, error: ordersError } = await supabase
        .from("orders")
        .select(`
          *,
          live_event:live_events(titulo),
          order_items(*),
          coupon:coupons(code, discount_type, discount_value),
          payments(installments, status)
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
          live_event:live_events(titulo),
          items:live_cart_items(
            id,
            qtd,
            preco_unitario,
            status,
            variante,
            product:product_catalog(id, name, image_url, color, sku, price)
          )
        `)
        .is("order_id", null)
        // .neq("status", "aberto") // Removed to allow active carts to be seen in the manager
        .neq("status", "cancelado")
        .neq("status", "expirado")
        .order("created_at", { ascending: false });

      if (liveError) {
        console.error("Error fetching live carts:", liveError);
        // Don't throw, just show what we have
      }

      // 3. Map Live Carts to Order Interface
      const mappedLiveOrders: Order[] = (liveCarts || []).map((cart: any) => ({
        id: cart.id,
        created_at: cart.created_at,
        status: cart.operational_status || cart.status,
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
        // Payment info from live_carts
        paid_method: cart.paid_method || null,
        installments: null,
        // Live specific fields
        source: "live",
        live_cart_id: cart.id,
        live_bag_number: cart.bag_number,
        live_event: cart.live_event,
        requires_physical_cancel: false // Default to false
      }));

      // 4. Merge and Sort
      const regularItemsMap = (regularOrders || []).reduce<Record<string, OrderItem[]>>((acc, order: any) => {
        if (order.order_items?.length) {
          acc[order.id] = (order.order_items as OrderItem[]).map((item) => ({
            ...item,
            size: item.size || "Unico",
          }));
        }
        delete order.order_items;
        // Extract payment info from joined payments table
        const paymentWithInstallments = (order.payments || []).find((p: any) => p.installments && p.installments > 0);
        if (!order.installments && paymentWithInstallments) {
          order.installments = paymentWithInstallments.installments;
        }
        delete order.payments;
        return acc;
      }, {});

      const liveItemsMap = (liveCarts || []).reduce<Record<string, OrderItem[]>>((acc, cart: any) => {
        if (Array.isArray(cart.items) && cart.items.length > 0) {
          acc[cart.id] = mapLiveCartItemsToOrderItems(cart.items);
        }
        return acc;
      }, {});

      const allOrders = [...(regularOrders || []), ...mappedLiveOrders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Cast the data to our Order type
      setOrders(allOrders as unknown as Order[]);
      if (Object.keys(regularItemsMap).length || Object.keys(liveItemsMap).length) {
        setOrderItems(prev => ({ ...prev, ...regularItemsMap, ...liveItemsMap }));
      }
    } catch (error) {
      console.error("Error loading orders:", error);
      toast.error("Erro ao carregar pedidos");
    } finally {
      setIsLoading(false);
    }
  };



  // Clear all filters and URL params
  const clearAllFilters = () => {
    setFilterStatus("all");
    setFilterSource("all");
    setFilterSeller(null);
    setSearchTerm("");

    // Clear URL params except tab
    const newParams = new URLSearchParams();
    newParams.set("tab", "orders");
    setSearchParams(newParams);
  };

  const loadOrderItems = async (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    const isLiveOrder = Boolean(order.live_cart_id || order.source === "live" || order.live_event_id);

    // For non-live orders we can use the existing cache.
    if (!isLiveOrder && orderItems[orderId]?.length) return;

    try {
      const liveCartId = order.live_cart_id || (order.source === "live" ? order.id : null);
      if (liveCartId) {
        const { data: liveItems, error: liveError } = await supabase
          .from("live_cart_items")
          .select(`
            id,
            qtd,
            preco_unitario,
            status,
            variante,
            product:product_catalog(id, name, image_url, color, sku, price)
          `)
          .eq("live_cart_id", liveCartId);

        if (!liveError && liveItems) {
          const mappedItems = mapLiveCartItemsToOrderItems(liveItems);
          setOrderItems((prev) => ({ ...prev, [orderId]: mappedItems }));
          return;
        }

        if (liveError) {
          console.error("Erro ao buscar itens da live:", liveError);
        }
      }

      // Fallback for legacy/non-live orders.
      const { data: regularItems, error: regularError } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);

      if (regularError) {
        console.error("Erro ao buscar itens do pedido:", regularError);
      }

      setOrderItems((prev) => ({ ...prev, [orderId]: regularItems || [] }));
    } catch (error) {
      console.error("Erro ao carregar itens do pedido:", error);
      toast.error("Erro ao carregar itens do pedido");
      setOrderItems((prev) => ({ ...prev, [orderId]: [] }));
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // Build update payload - set paid_at when changing to paid status
    const normalizedStatus = newStatus.toLowerCase().trim();
    const isPaidStatus = ['pago', 'paid', 'approved', 'payment_approved'].includes(normalizedStatus);

    // INTERCEPT: If changing to "pago" manually, open the manual payment modal
    // Skip if order was already paid (e.g., changing from pago to entregue and back)
    if (isPaidStatus && !order.paid_at) {
      setManualPaymentOrderId(orderId);
      setManualPaymentOrderTotal(order.total);
      setShowManualPaymentModal(true);
      return; // Don't proceed — the modal will handle the update
    }

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

    // NEW PREVENTIVE SYNC FOR LIVE ORDERS:
    // If it's a Live order, we MUST also update live_carts and apply effects if paid
    if (order.source === 'live' && order.live_cart_id) {
      const liveCartsUpdate: Record<string, any> = {
        operational_status: newStatus,
        updated_at: new Date().toISOString()
      };

      // Map global status to live_carts status/paid_at if necessary
      if (isPaidStatus) {
        liveCartsUpdate.status = 'pago';
        liveCartsUpdate.paid_at = updatePayload.paid_at;
      } else if (newStatus === 'cancelado') {
        liveCartsUpdate.status = 'cancelado';
      }

      const { error: liveError } = await supabase
        .from("live_carts")
        .update(liveCartsUpdate)
        .eq("id", order.live_cart_id);

      if (liveError) {
        console.error("Error syncing live_carts status:", liveError);
        toast.error("Status atualizado em Pedidos, mas erro ao sincronizar com Live");
      }

      // If marked as paid, trigger the stock effects RPC
      if (isPaidStatus) {
        // CRITICAL: Confirm items FIRST so the RPC finds them
        // Without this, items stay as 'reservado' and the RPC skips them
        const { error: itemsError } = await supabase
          .from("live_cart_items")
          .update({ status: 'confirmado' })
          .eq("live_cart_id", order.live_cart_id)
          .eq("status", 'reservado');

        if (itemsError) {
          console.error("Error confirming live_cart_items:", itemsError);
        }

        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('apply_live_cart_paid_effects', {
            p_live_cart_id: order.live_cart_id
          });

          if (rpcError) {
            console.error("RPC Error (stock decrement):", rpcError);
            toast.error("Erro ao baixar estoque da Live automaticamente");
          } else {
            console.log("Live stock effects applied:", rpcData);
            toast.success("Estoque da Live atualizado!");
          }
        } catch (rpcCatch) {
          console.error("Catching RPC error:", rpcCatch);
        }
      }

      // Log to live history for visibility
      await supabase.from("live_cart_status_history").insert({
        live_cart_id: order.live_cart_id,
        old_status: order.status,
        new_status: newStatus,
        notes: `Atualizado via Gerenciador de Pedidos Geral`,
      });
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

    // Recalculate shipping fee and total based on new method
    const isPickup = method === "retirada" || method === "pickup";
    const itemsTotal = (orderItems[order.id] || []).reduce((sum: number, i: any) => sum + (Number(i.product_price) * Number(i.quantity)), 0);
    const parsedFee = parseFloat(newShippingFee.replace(",", "."));
    const calcFee = isPickup ? 0 : (isNaN(parsedFee) ? Number(order.shipping_fee || 0) : parsedFee);
    const calcTotal = itemsTotal + calcFee - Number(order.coupon_discount || 0);

    const { error } = await supabase
      .from("orders")
      .update({
        delivery_method: method,
        shipping_fee: calcFee,
        total: calcTotal,
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao atualizar mÃ©todo de entrega");
      return;
    }

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, delivery_method: method, shipping_fee: calcFee, total: newTotal } : o))
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

    return `Olá ${order.customer_name}! \u{1F44B}

Seu pedido #${order.id.slice(0, 8).toUpperCase()} está pronto para pagamento.

*Itens:*
${itemsList}

*Total:* ${formatPrice(order.total)}

${paymentUrl ? `*Link para pagamento:*\n${paymentUrl}` : ""}

Qualquer dúvida estamos à disposição! \u{1F495}`;
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
      case "pickup": case "retirada": return "Retirada na loja";
      case "shipping": case "correios": return "Correios";
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
    filterSeller !== null || searchTerm !== "";

  // Get label for the active filter
  const activeFilterLabel = isOperationalFilter(filterStatus)
    ? getOperationalFilterLabel(filterStatus)
    : (filterStatus !== "all" ? (statusConfig[filterStatus]?.label || filterStatus) : null);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Status filter (includes operational op_ filters)
      let matchesStatus = false;
      if (filterStatus === "all") {
        matchesStatus = true;
      } else if (filterStatus === "attention") {
        matchesStatus = !!order.requires_physical_cancel;
      } else if (isOperationalFilter(filterStatus)) {
        matchesStatus = matchesOperationalFilter(order, filterStatus);
      } else {
        matchesStatus = order.status === filterStatus;
      }

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
  }, [orders, filterStatus, filterSource, filterSeller, searchTerm]);

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

          {filterStatus !== "all" && (
            <Badge variant="secondary" className="gap-1">
              {activeFilterLabel || filterStatus}
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
        <Select value={filterStatus} onValueChange={setFilterStatus}>
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
            <Separator className="my-1" />
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Operacional</div>
            {operationalFilterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSeller || "all"} onValueChange={(v) => setFilterSeller(v === "all" ? null : v)}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Vendedora" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {sellers.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
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
            const { allItems, activeItems, cancelledItems } = splitOrderItemsByCancellation(orderItems[order.id]);

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
                        {/* Payment method sublabel for paid orders */}
                        {(order.status === 'pago' || order.status === 'confirmado' || order.status === 'entregue' || order.status === 'etiqueta_gerada' || order.status === 'enviado') && order.paid_method && (() => {
                          const m = order.paid_method!.toLowerCase();
                          const installmentsSuffix = order.installments && order.installments >= 1 ? ` ${order.installments}x` : '';
                          // Manual payment methods
                          const manualMethods: Record<string, string> = {
                            'rede': '🏪 Maquininha REDE',
                            'pix_itau': '🏪 PIX Itaú',
                            'pix_rede': '🏪 PIX REDE',
                            'link_rede': '🏪 Link REDE',
                            'dinheiro': '💵 Dinheiro',
                          };
                          const isManual = m in manualMethods;
                          let label = '';
                          if (isManual) {
                            label = manualMethods[m];
                          } else if (m === 'pix') {
                            label = '◉ PIX (MP)';
                          } else if (m === 'account_money' || m === 'mercadopago') {
                            label = '💳 Saldo MP';
                          } else if (m.includes('credit') || m.includes('debit')) {
                            label = `💳 Crédito${installmentsSuffix} (MP)`;
                          } else {
                            // Card brand names: master, visa, elo, hipercard, amex, etc.
                            const brand = order.paid_method!.charAt(0).toUpperCase() + order.paid_method!.slice(1).toLowerCase();
                            label = `💳 ${brand}${installmentsSuffix} (MP)`;
                          }
                          return (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium ${isManual ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>
                              {label}
                            </span>
                          );
                        })()}
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
                          {!orderItems[order.id] ? (
                            <p className="text-sm text-muted-foreground">Carregando...</p>
                          ) : (
                            <>
                              {activeItems.length > 0 ? (
                                activeItems.map((item) => (
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
                                ))
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  Sem itens ativos no pedido.
                                </p>
                              )}

                              {cancelledItems.length > 0 && (
                                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
                                    Itens cancelados - retirar da sacola
                                  </p>
                                  <div className="space-y-2">
                                    {cancelledItems.map((item) => (
                                      <div
                                        key={`${item.id}-cancelled`}
                                        className="flex items-center gap-3 rounded-lg bg-white/60 p-2"
                                      >
                                        {item.image_url ? (
                                          <img
                                            src={item.image_url}
                                            alt={item.product_name}
                                            className="h-10 w-10 rounded object-cover opacity-70"
                                          />
                                        ) : (
                                          <div className="flex h-10 w-10 items-center justify-center rounded bg-secondary">
                                            <Package className="h-4 w-4 text-muted-foreground" />
                                          </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-sm font-medium line-through text-muted-foreground">
                                            {item.product_name}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {item.size}
                                            {item.color && ` • ${item.color}`} • x
                                            {item.quantity}
                                          </p>
                                        </div>
                                        <Badge variant="destructive" className="text-[10px]">
                                          Cancelado
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {allItems.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                  Nenhum item encontrado.
                                </p>
                              )}
                            </>
                          )}
                        </div>


                        {/* Price Breakdown */}
                        <div className="mt-3 space-y-1 text-sm bg-muted/30 rounded-md p-3">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal:</span>
                            <span>R$ {((orderItems[order.id] || []).reduce((sum: number, i: any) => sum + (Number(i.product_price) * Number(i.quantity)), 0)).toFixed(2).replace(".", ",")}</span>
                          </div>
                          {Number(order.shipping_fee || 0) > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Frete ({getDeliveryLabel(order.delivery_method)}):</span>
                              <span>R$ {Number(order.shipping_fee || 0).toFixed(2).replace(".", ",")}</span>
                            </div>
                          )}
                          {Number(order.coupon_discount || 0) > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Desconto{order.coupon ? ` (${order.coupon.code.toUpperCase()})` : ""}:</span>
                              <span className="text-green-600">- R$ {Number(order.coupon_discount || 0).toFixed(2).replace(".", ",")}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                            <span>Total:</span>
                            <span>R$ {Number(order.total || 0).toFixed(2).replace(".", ",")}</span>
                          </div>
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
                                    <SelectItem value="retirada">Retirada na loja</SelectItem>
                                    <SelectItem value="motoboy">Motoboy</SelectItem>
                                    <SelectItem value="correios">Correios</SelectItem>
                                  </SelectContent>
                                </Select>
                                {(newDeliveryMethod === "correios" || newDeliveryMethod === "motoboy") && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-muted-foreground">Frete R$</span>
                                    <input
                                      type="text"
                                      className="h-7 w-[70px] text-xs border rounded px-1 text-right"
                                      placeholder="0,00"
                                      value={newShippingFee}
                                      onChange={(e) => setNewShippingFee(e.target.value)}
                                    />
                                  </div>
                                )}
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
                          {(order.delivery_method === 'shipping' || order.delivery_method === 'correios') && (
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
                          {(order.delivery_method === 'shipping' || order.delivery_method === 'correios') && (order.tracking_code || order.me_label_url || order.status === 'etiqueta_gerada') && (
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
                            items={getPrintableOrderItems(orderItems[order.id])}
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

                        {/* Upsell - In-store add-ons (only for live orders) */}
                        {order.live_cart_id && (
                          <OrderUpsellSection cartId={order.live_cart_id} />
                        )}

                        {/* Quick customer registration for live orders */}
                        {order.live_cart_id && (
                          <OrderRegisterCustomerSection
                            orderId={order.id}
                            instagramHandle={order.customer_name}
                            existingCustomerId={order.customer_id || null}
                            onRegistered={(customerId, newName, newPhone) => {
                              setOrders(prev => prev.map(o =>
                                o.id === order.id
                                  ? { ...o, customer_id: customerId, customer_name: newName, customer_phone: newPhone }
                                  : o
                              ));
                            }}
                          />
                        )}

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

                        {/* Manual Payment Validation Button */}
                        {order.status === "aguardando_validacao_pagamento" && (
                          <Button
                            className="w-full gap-2 bg-purple-600 hover:bg-purple-700 animate-pulse"
                            onClick={() => {
                              setValidatingOrder(order);
                              setShowValidationModal(true);
                            }}
                          >
                            <ShieldCheck className="h-4 w-4" />
                            Validar Comprovante
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

      <ManualPaymentValidationModal
        isOpen={showValidationModal}
        onClose={() => {
          setShowValidationModal(false);
          setValidatingOrder(null);
        }}
        order={validatingOrder}
        onSuccess={loadOrders}
      />

      {/* Manual Payment Modal - for marking orders as paid */}
      {showManualPaymentModal && manualPaymentOrderId && (
        <ManualPaymentModal
          open={showManualPaymentModal}
          onClose={() => {
            setShowManualPaymentModal(false);
            setManualPaymentOrderId(null);
          }}
          orderId={manualPaymentOrderId}
          orderTotal={manualPaymentOrderTotal}
          onConfirm={async (method, proofUrl, notes) => {
            const order = orders.find(o => o.id === manualPaymentOrderId);
            if (!order) return false;

            const now = new Date().toISOString();
            const updatePayload: Record<string, any> = {
              status: 'pago',
              paid_at: now,
              paid_method: method,
              payment_proof_url: proofUrl,
              updated_at: now,
            };
            if (notes) updatePayload.internal_notes = `${order.internal_notes ? order.internal_notes + '\n' : ''}Pgto manual: ${notes}`;

            const { error } = await supabase.from('orders').update(updatePayload).eq('id', manualPaymentOrderId);
            if (error) {
              toast.error('Erro ao confirmar pagamento');
              return false;
            }

            // Sync live cart if needed
            if (order.source === 'live' && order.live_cart_id) {
              await supabase.from('live_carts').update({
                status: 'pago',
                operational_status: 'pago',
                paid_at: now,
                paid_method: method,
                updated_at: now,
              }).eq('id', order.live_cart_id);

              await supabase.from('live_cart_items').update({ status: 'confirmado' }).eq('live_cart_id', order.live_cart_id).eq('status', 'reservado');

              try {
                await supabase.rpc('apply_live_cart_paid_effects', { p_live_cart_id: order.live_cart_id });
              } catch (e) {
                console.error('RPC error:', e);
              }

              await supabase.from('live_cart_status_history').insert({
                live_cart_id: order.live_cart_id,
                old_status: order.status,
                new_status: 'pago',
                notes: `Pagamento manual (${method}) com comprovante`,
              });
            }

            // Update local state
            setOrders(prev => prev.map(o => o.id === manualPaymentOrderId ? { ...o, ...updatePayload } : o));
            toast.success('Pagamento registrado com sucesso!');
            return true;
          }}
        />
      )}
    </div>

  );
}