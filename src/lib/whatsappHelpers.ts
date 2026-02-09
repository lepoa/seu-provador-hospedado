import { STORE_WHATSAPP_PHONE } from "./storeConfig";

/**
 * Builds a WhatsApp link with pre-filled message.
 * Uses wa.me format for best compatibility.
 * @param phoneOrMessage - Phone number OR message (for backward compatibility)
 * @param messageOrUndefined - Message if phone was provided
 */
export function buildWhatsAppLink(phoneOrMessage: string, messageOrUndefined?: string): string {
  // Backward compatibility: if only one arg, it's the message
  let phone: string;
  let message: string;
  
  if (messageOrUndefined === undefined) {
    // Old signature: buildWhatsAppLink(message)
    phone = STORE_WHATSAPP_PHONE;
    message = phoneOrMessage;
  } else {
    // New signature: buildWhatsAppLink(phone, message)
    phone = phoneOrMessage;
    message = messageOrUndefined;
  }

  const targetPhone = normalizePhone(phone);
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${targetPhone}?text=${encodedMessage}`;
}

/**
 * Normalizes phone number to international format (55XXXXXXXXXXX)
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // If already has country code
  if (digits.startsWith("55") && digits.length === 13) {
    return digits;
  }
  // Add country code if missing
  if (digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

/**
 * Normalizes Instagram handle - removes all @, spaces, and returns clean handle
 * ALWAYS store WITHOUT @ in the database
 */
export function normalizeInstagram(handle: string): string {
  if (!handle) return "";
  // Remove ALL @ symbols and spaces, lowercase
  return handle.replace(/@/g, "").replace(/\s/g, "").toLowerCase().trim();
}

/**
 * Display Instagram handle with SINGLE @ for UI
 * Takes raw handle (with or without @) and returns @username
 */
export function displayInstagram(handle: string): string {
  if (!handle) return "";
  // First normalize to remove any @, then add single @
  const clean = normalizeInstagram(handle);
  return clean ? `@${clean}` : "";
}

/**
 * Get Instagram profile URL from handle
 */
export function getInstagramProfileUrl(handle: string): string | null {
  const clean = normalizeInstagram(handle);
  return clean ? `https://www.instagram.com/${clean}` : null;
}

/**
 * Builds the sophisticated LE.POÁ charge message - ELEGANT and PROFESSIONAL
 * This is the ONLY message template for charging customers
 */
export function buildLepoaChargeMessage(bagLink: string, bagNumber?: number): string {
  const bagText = bagNumber ? `Sua sacola #${bagNumber} já está pronta.` : 'Sua sacola já está pronta.';
  
  return `Oi, tudo bem? 💛
Aqui é da LE.POÁ. Muito obrigada por participar da nossa Live Shop.

${bagText}
Para manter tudo organizado, pedimos que finalize seu pedido pelo link abaixo:
👉 ${bagLink}

Qualquer dúvida, fico à disposição.`;
}

/**
 * Builds a WhatsApp message for a specific order (detailed version)
 */
export function buildOrderDetailMessage(
  orderNumber: string,
  items: Array<{ name: string; size: string; color?: string | null; quantity: number }>,
  total: string
): string {
  const itemsResume = items
    .map((item) => {
      let text = `${item.name} tam ${item.size}`;
      if (item.color) text += ` (${item.color})`;
      text += ` x${item.quantity}`;
      return text;
    })
    .join(", ");

  return `Oi! Quero ajuda com meu pedido #${orderNumber}. Itens: ${itemsResume}. Total: ${total}.`;
}

/**
 * Builds a short WhatsApp message for an order (for list view)
 */
export function buildOrderShortMessage(orderNumber: string): string {
  return `Oi! Quero falar sobre o pedido #${orderNumber}.`;
}

/**
 * Default WhatsApp message for general contact
 */
export function buildDefaultContactMessage(): string {
  return "Oi! Vim pelo Provador VIP e queria tirar uma dúvida 😊";
}

/**
 * Build address request message for shipping
 */
export function buildAddressRequestMessage(customerName?: string | null, bagNumber?: number | null): string {
  const nameGreeting = customerName ? ` ${customerName.split(' ')[0]}` : '';
  const bagText = bagNumber ? ` da sacola #${bagNumber}` : '';
  
  return `Olá${nameGreeting}! 📦

Para enviar seu pedido${bagText}, preciso dos dados de entrega:

• Nome completo
• CEP
• Endereço completo (rua, número, complemento)
• Telefone

Pode me enviar? 😊`;
}
