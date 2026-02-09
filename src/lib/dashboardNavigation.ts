/**
 * Dashboard Navigation Helper
 * 
 * Centraliza o mapeamento de cliques do dashboard para filtros de pedidos.
 * Todos os KPIs, cards e métricas devem usar essas funções para navegação consistente.
 */

export interface OrdersFilterParams {
  status?: string;
  source?: string;
  seller?: string;
  specialFilter?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Build URL search params for orders filtering
 */
export function buildOrdersUrl(params: OrdersFilterParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set("tab", "orders");
  
  if (params.status) searchParams.set("status", params.status);
  if (params.source) searchParams.set("source", params.source);
  if (params.seller) searchParams.set("seller", params.seller);
  if (params.specialFilter) searchParams.set("filter", params.specialFilter);
  if (params.startDate) searchParams.set("from", params.startDate);
  if (params.endDate) searchParams.set("to", params.endDate);
  
  return `/dashboard?${searchParams.toString()}`;
}

/**
 * Navigation targets for dashboard KPIs
 */
export const dashboardNavigation = {
  // Main KPIs
  pendencias: () => buildOrdersUrl({ 
    specialFilter: "pendencias" 
  }),
  
  faturamentoPago: () => buildOrdersUrl({ 
    status: "pago" 
  }),
  
  reservado: () => buildOrdersUrl({ 
    status: "aguardando_pagamento" 
  }),
  
  conversao: () => buildOrdersUrl({ 
    specialFilter: "funil" 
  }),
  
  // Secondary KPIs
  pagos: () => buildOrdersUrl({ 
    status: "pago" 
  }),
  
  pendentes: () => buildOrdersUrl({ 
    status: "aguardando_pagamento" 
  }),
  
  cancelados: () => buildOrdersUrl({ 
    status: "cancelado" 
  }),
  
  // Channel-specific
  catalogPagos: () => buildOrdersUrl({ 
    source: "catalog", 
    status: "pago" 
  }),
  
  catalogPendentes: () => buildOrdersUrl({ 
    source: "catalog", 
    status: "aguardando_pagamento" 
  }),
  
  catalogAll: () => buildOrdersUrl({ 
    source: "catalog" 
  }),
  
  livePagos: () => buildOrdersUrl({ 
    source: "live", 
    status: "pago" 
  }),
  
  livePendentes: () => buildOrdersUrl({ 
    source: "live", 
    status: "aguardando_pagamento" 
  }),
  
  liveAll: () => buildOrdersUrl({ 
    source: "live" 
  }),
  
  // Pending action types
  aguardandoPagamento24h: () => buildOrdersUrl({ 
    specialFilter: "aguardando-24h" 
  }),
  
  aguardandoRetorno24h: () => buildOrdersUrl({ 
    specialFilter: "aguardando-retorno" 
  }),
  
  naoCobrado: () => buildOrdersUrl({ 
    specialFilter: "nao-cobrado" 
  }),
  
  pagoSemLogistica: () => buildOrdersUrl({ 
    status: "pago",
    specialFilter: "sem-logistica" 
  }),
  
  etiquetaPendente: () => buildOrdersUrl({ 
    specialFilter: "etiqueta-pendente" 
  }),
  
  semVendedora: () => buildOrdersUrl({ 
    specialFilter: "sem-vendedora" 
  }),
  
  urgente: () => buildOrdersUrl({ 
    specialFilter: "urgente" 
  }),
  
  // For specific live event
  liveEventOrders: (liveEventId: string) => buildOrdersUrl({ 
    source: "live",
    specialFilter: `live-event:${liveEventId}` 
  }),
  
  // For specific seller
  sellerOrders: (sellerId: string) => buildOrdersUrl({ 
    seller: sellerId 
  }),
};

/**
 * Parse URL search params back to filter state
 */
export function parseOrdersUrlParams(searchParams: URLSearchParams): {
  status: string;
  source: string;
  seller: string | null;
  specialFilter: string | null;
  liveEventId: string | null;
} {
  const status = searchParams.get("status") || "all";
  const source = searchParams.get("source") || "all";
  const seller = searchParams.get("seller");
  const specialFilter = searchParams.get("filter");
  
  // Extract live event ID from special filter if present
  let liveEventId: string | null = null;
  if (specialFilter?.startsWith("live-event:")) {
    liveEventId = specialFilter.replace("live-event:", "");
  }
  
  return { status, source, seller, specialFilter, liveEventId };
}

/**
 * Get human-readable label for a special filter
 */
export function getSpecialFilterLabel(filter: string | null): string | null {
  if (!filter) return null;
  
  const labels: Record<string, string> = {
    "pendencias": "Pendências operacionais",
    "funil": "Análise de funil",
    "aguardando-24h": "Aguardando pagamento +24h",
    "aguardando-retorno": "Aguardando retorno +24h",
    "nao-cobrado": "Não cobrados",
    "sem-logistica": "Pagos sem logística definida",
    "etiqueta-pendente": "Etiqueta pendente",
    "sem-vendedora": "Sem vendedora atribuída",
    "urgente": "Urgentes",
  };
  
  if (filter.startsWith("live-event:")) {
    return "Pedidos da Live";
  }
  
  return labels[filter] || null;
}

/**
 * Check if current filters match a "pending actions" scenario that requires special handling
 */
export function isPendingActionsFilter(specialFilter: string | null): boolean {
  const pendingFilters = [
    "pendencias",
    "aguardando-24h",
    "aguardando-retorno",
    "nao-cobrado",
    "sem-logistica",
    "etiqueta-pendente",
    "sem-vendedora",
    "urgente",
  ];
  return specialFilter !== null && pendingFilters.includes(specialFilter);
}
