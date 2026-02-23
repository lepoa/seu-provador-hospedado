import { Clock, CheckCircle, Truck, CreditCard, X, FileText, RefreshCw } from "lucide-react";

/**
 * Centralized order status mapping for the customer portal.
 * This ensures consistent status display across all customer-facing views.
 * 
 * Key rules:
 * 1. etiqueta_gerada is ALWAYS shown as "Enviado" (it's post-payment)
 * 2. If tracking_code exists, status should be at minimum "Enviado"
 * 3. Unknown statuses fallback to "Em andamento" (never "Pendente")
 */

export interface StatusDisplay {
  label: string;
  icon: React.ElementType;
  color: string;
}

// Internal status to customer-friendly display mapping
const statusMap: Record<string, StatusDisplay> = {
  pendente: {
    label: "Pendente",
    icon: Clock,
    color: "bg-amber-100 text-amber-800"
  },
  aguardando_pagamento: {
    label: "Pendente",
    icon: CreditCard,
    color: "bg-orange-100 text-orange-800"
  },
  manter_na_reserva: {
    label: "Reserva estendida",
    icon: Clock,
    color: "bg-amber-100 text-amber-800"
  },
  confirmado: {
    label: "Confirmado",
    icon: CheckCircle,
    color: "bg-blue-100 text-blue-800"
  },
  pago: {
    label: "Pago",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800"
  },
  etiqueta_gerada: {
    label: "Enviado",
    icon: Truck,
    color: "bg-purple-100 text-purple-800"
  },
  enviado: {
    label: "Enviado",
    icon: Truck,
    color: "bg-purple-100 text-purple-800"
  },
  postado: {
    label: "Enviado",
    icon: Truck,
    color: "bg-purple-100 text-purple-800"
  },
  em_rota: {
    label: "Em rota de entrega",
    icon: Truck,
    color: "bg-indigo-100 text-indigo-800"
  },
  entregue: {
    label: "Entregue",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800"
  },
  cancelado: {
    label: "Cancelado",
    icon: X,
    color: "bg-red-100 text-red-800"
  },
  aberto: {
    label: "Pendente",
    icon: Clock,
    color: "bg-amber-100 text-amber-800"
  },
  expirado: {
    label: "Pendente",
    icon: CreditCard,
    color: "bg-orange-100 text-orange-800"
  },
  pagamento_rejeitado: {
    label: "Pagamento rejeitado",
    icon: X,
    color: "bg-red-100 text-red-800"
  },
  reembolsado: {
    label: "Reembolsado",
    icon: RefreshCw,
    color: "bg-gray-100 text-gray-800"
  },
};

// Fallback for unknown statuses - NEVER falls back to "Pendente"
const fallbackStatus: StatusDisplay = {
  label: "Em andamento",
  icon: Clock,
  color: "bg-blue-100 text-blue-800"
};

/**
 * Validates if a tracking code is a real carrier tracking number
 * (not an internal ID like ORD-...)
 */
export const isValidTrackingCode = (code: string | null | undefined): boolean => {
  if (!code) return false;
  if (code.startsWith('ORD-') || code.startsWith('ORD')) return false;

  // Correios format: AA123456789BR
  const isCorreios = /^[A-Z]{2}\d{9}BR$/.test(code);
  // Numeric format (Jadlog, etc.): 8-20 digits
  const isNumeric = /^\d{8,20}$/.test(code);

  return isCorreios || isNumeric;
};

/**
 * Get the customer-facing status display for an order.
 * 
 * @param status - The internal order status from the database
 * @param trackingCode - Optional tracking code (if valid, forces "Enviado" minimum)
 * @returns StatusDisplay object with label, icon, and color
 */
export const getCustomerStatusDisplay = (
  status: string | null | undefined,
  trackingCode?: string | null
): StatusDisplay => {
  // Rule: If valid tracking exists, show at minimum "Enviado"
  if (isValidTrackingCode(trackingCode)) {
    // Use enviado display for any status that would show as less than "Enviado"
    const enviadoStatus = statusMap.enviado;

    // For terminal statuses, still show them correctly
    if (status === 'entregue') return statusMap.entregue;
    if (status === 'cancelado') return statusMap.cancelado;
    if (status === 'reembolsado') return statusMap.reembolsado;

    // Otherwise, show as "Enviado" since we have tracking
    return enviadoStatus;
  }

  // Standard mapping
  if (status && statusMap[status]) {
    return statusMap[status];
  }

  // Unknown status - fallback to "Em andamento" (never "Pendente")
  return fallbackStatus;
};

/**
 * Mapping for admin-facing views (different from customer view)
 * Admin sees internal statuses as-is
 */
export const getAdminStatusDisplay = (status: string | null | undefined): StatusDisplay => {
  if (status && statusMap[status]) {
    // For admin, show etiqueta_gerada with its own label
    if (status === 'etiqueta_gerada') {
      return {
        label: "Etiqueta Gerada",
        icon: FileText,
        color: "bg-cyan-100 text-cyan-800"
      };
    }
    return statusMap[status];
  }
  return fallbackStatus;
};
