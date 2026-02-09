// Live Shop Types

export type LiveEventStatus = 'planejada' | 'ao_vivo' | 'encerrada' | 'arquivada';
export type LiveProductVisibility = 'exclusivo_live' | 'catalogo_e_live';
export type LiveCustomerStatus = 'ativo' | 'parou' | 'finalizado' | 'cancelado';
export type LiveCartStatus = 'aberto' | 'em_confirmacao' | 'aguardando_pagamento' | 'pago' | 'cancelado' | 'expirado';
export type LiveCartItemStatus = 'reservado' | 'confirmado' | 'removido' | 'substituido' | 'cancelado' | 'expirado';
export type LiveWaitlistStatus = 'ativa' | 'chamada' | 'atendida' | 'cancelada';

export interface LiveEvent {
  id: string;
  titulo: string;
  data_hora_inicio: string;
  data_hora_fim: string | null;
  status: LiveEventStatus;
  observacoes: string | null;
  reservation_expiry_minutes: number;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiveProduct {
  id: string;
  live_event_id: string;
  product_id: string;
  prioridade_ordem: number;
  visibilidade: LiveProductVisibility;
  bloquear_desde_planejamento: boolean;
  limite_unidades_live: number | null;
  snapshot_variantes: Record<string, any>;
  live_discount_type: 'percentage' | 'fixed' | null;
  live_discount_value: number | null;
  created_at: string;
  updated_at: string;
  // Joined data
  product?: {
    id: string;
    name: string;
    image_url: string | null;
    images: string[] | null;
    price: number;
    color: string | null;
    stock_by_size: Record<string, number> | null;
    category: string | null;
    sku: string | null;
    group_key: string | null;
  };
}

export interface LiveCustomer {
  id: string;
  live_event_id: string;
  client_id: string | null;
  instagram_handle: string;
  nome: string | null;
  whatsapp: string | null;
  status: LiveCustomerStatus;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiveCart {
  id: string;
  live_event_id: string;
  live_customer_id: string;
  status: LiveCartStatus;
  subtotal: number;
  descontos: number;
  frete: number;
  total: number;
  order_id: string | null;
  mp_preference_id: string | null;
  mp_checkout_url: string | null;
  bag_number: number | null;
  // Operational fields
  customer_live_notes: string | null;
  is_raffle_winner: boolean;
  raffle_name: string | null;
  raffle_prize: string | null;
  raffle_applied: boolean;
  needs_label_reprint: boolean;
  label_printed_at: string | null;
  // New post-live logistics fields
  seller_id: string | null;
  delivery_method: 'retirada' | 'motoboy' | 'correios';
  shipping_address_snapshot: Record<string, any> | null;
  me_shipment_id: string | null;
  me_label_url: string | null;
  shipping_tracking_code: string | null;
  operational_status: string | null;
  separation_status: string | null;
  public_token: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  live_customer?: LiveCustomer;
  items?: LiveCartItem[];
  seller?: {
    id: string;
    name: string;
  };
}

export interface LiveCartItem {
  id: string;
  live_cart_id: string;
  product_id: string;
  variante: {
    cor?: string;
    tamanho?: string;
    tamanho_letra?: string;
    tamanho_numero?: string;
    sku?: string;
  };
  qtd: number;
  preco_unitario: number;
  status: LiveCartItemStatus;
  reservado_em: string;
  expiracao_reserva_em: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  product?: {
    id: string;
    name: string;
    image_url: string | null;
    color: string | null;
  };
}

export interface LiveWaitlist {
  id: string;
  live_event_id: string;
  product_id: string;
  variante: {
    cor?: string;
    tamanho?: string;
  };
  instagram_handle: string;
  whatsapp: string | null;
  ordem: number;
  status: LiveWaitlistStatus;
  created_at: string;
  updated_at: string;
}

// KPIs for a live event
export interface LiveEventKPIs {
  totalPlanejado: { itens: number; valor: number };
  totalReservado: { itens: number; valor: number };
  totalVendido: { itens: number; valor: number };
  totalEmAberto: { itens: number; valor: number };
  percentualPago: number;
}

// Form types
export interface CreateLiveEventForm {
  titulo: string;
  data_hora_inicio: string;
  observacoes?: string;
  reservation_expiry_minutes?: number;
}

export interface AddProductToLiveForm {
  product_id: string;
  visibilidade: LiveProductVisibility;
  bloquear_desde_planejamento: boolean;
  limite_unidades_live?: number;
  live_discount_type?: 'percentage' | 'fixed' | null;
  live_discount_value?: number | null;
}

export interface QuickLaunchForm {
  instagram_handle: string;
  product_id: string;
  cor?: string;
  tamanho?: string;
  qtd: number;
}
