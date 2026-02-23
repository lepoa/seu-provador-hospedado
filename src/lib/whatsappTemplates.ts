/**
 * WhatsApp message templates by order status
 * Used in admin panel to auto-generate messages when status changes
 */

export interface WhatsAppTemplateData {
  customerName: string;
  shortId: string;
  trackingCode?: string | null;
  total?: string;
}

export type OrderStatus =
  | 'pendente'
  | 'aguardando_pagamento'
  | 'manter_na_reserva'
  | 'pago'
  | 'confirmado'
  | 'enviado'
  | 'entregue'
  | 'cancelado'
  | 'pagamento_rejeitado'
  | 'reembolsado';

/**
 * Status-based WhatsApp message templates
 */
export const whatsappTemplates: Record<OrderStatus, (data: WhatsAppTemplateData) => string> = {
  pendente: (data) =>
    `Oi, ${data.customerName}! \u{1F44B}\n\nSeu pedido #${data.shortId} foi recebido e está aguardando confirmação.\n\nQualquer dúvida, estou por aqui! \u{1F495}`,

  aguardando_pagamento: (data) =>
    `Oi, ${data.customerName}! \u{1F44B}\n\nSeu pedido #${data.shortId} está aguardando pagamento.\n\n${data.total ? `*Total:* ${data.total}\n\n` : ''}Assim que o pagamento for confirmado, já começamos a preparar! \u{1F495}`,

  manter_na_reserva: (data) =>
    `Oi, ${data.customerName}! \u{1F44B}\n\nSeu pedido #${data.shortId} permanece reservado para voce.\n\n${data.total ? `*Total:* ${data.total}\n\n` : ''}Quando finalizar o pagamento, seguimos com a preparacao. \u{1F495}`,

  pago: (data) =>
    `Oi, ${data.customerName}! \u{1F49B}\n\nPagamento confirmado \u2705\n\nJá vamos preparar seu pedido #${data.shortId} com muito carinho!\n\nQualquer coisa, estou por aqui! \u{1F495}`,

  confirmado: (data) =>
    `Oi, ${data.customerName}! \u{1F49B}\n\nSeu pedido #${data.shortId} foi confirmado e está sendo preparado!\n\nEm breve você receberá as atualizações de envio. \u{1F495}`,

  enviado: (data) =>
    `Oi, ${data.customerName}! \u{1F389}\n\nBoa notícia! Seu pedido #${data.shortId} foi enviado!\n\n${data.trackingCode ? `\u{1F4E6} *Código de rastreio:* ${data.trackingCode}\n\nVocê pode acompanhar pelo site dos Correios.` : 'Em breve você receberá o código de rastreio.'}\n\nQualquer coisa, estou por aqui! \u{1F495}`,

  entregue: (data) =>
    `Oi, ${data.customerName}! \u{1F49B}\n\nSeu pedido #${data.shortId} foi entregue! \u{1F381}\n\nEsperamos que tenha gostado! Se puder, compartilha uma foto usando as peças - adoramos ver! \u{1F4F8}\n\nObrigada pela confiança! \u{1F495}`,

  cancelado: (data) =>
    `Oi, ${data.customerName}.\n\nInformamos que seu pedido #${data.shortId} foi cancelado.\n\nSe precisar de algo ou tiver dúvidas, estamos à disposição! \u{1F49B}`,

  pagamento_rejeitado: (data) =>
    `Oi, ${data.customerName}! \u{1F44B}\n\nHouve um problema com o pagamento do pedido #${data.shortId}.\n\nPor favor, tente novamente ou entre em contato para resolvermos juntos! \u{1F49B}`,

  reembolsado: (data) =>
    `Oi, ${data.customerName}.\n\nO reembolso do pedido #${data.shortId} foi processado.\n\nO valor será estornado conforme a política do seu método de pagamento.\n\nSe precisar de algo, estamos aqui! \u{1F49B}`,
};

/**
 * Generate WhatsApp message for a given status
 */
export function getWhatsAppTemplateForStatus(
  status: OrderStatus,
  data: WhatsAppTemplateData
): string {
  const template = whatsappTemplates[status];
  if (!template) {
    return `Oi, ${data.customerName}! Qualquer dúvida sobre o pedido #${data.shortId}, estou à disposição! \u{1F495}`;
  }
  return template(data);
}

/**
 * Get short order ID from UUID
 */
export function getShortOrderId(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

/**
 * Status labels for display
 */
export const statusLabels: Record<OrderStatus, string> = {
  pendente: 'Pendente',
  aguardando_pagamento: 'Aguardando Pagamento',
  manter_na_reserva: 'Manter na Reserva',
  pago: 'Pago',
  confirmado: 'Confirmado',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  pagamento_rejeitado: 'Pagamento Rejeitado',
  reembolsado: 'Reembolsado',
};
