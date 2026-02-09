// Store delivery configuration
export const STORE_CONFIG = {
  // Store address - Endereço correto da Le.Poá
  originZipCode: "75110-760", // CEP da loja em Anápolis
  storeAddress: "Rua Luiz França, nº 65, qd 32 lote 20 - Bairro Jundiaí - Anápolis/GO",
  storeHours: "Segunda a Sexta: 9h às 18h | Sábado: 9h às 13h",
  
  // Motoboy delivery (local Anápolis)
  motoboyFee: 10.00,
  motoboyDeliveryText: "Entrega rápida em Anápolis",
  
  // Package defaults for shipping calculation (MVP)
  defaultWeight: 0.30, // kg - fallback when product has no weight
  defaultLength: 30,   // cm
  defaultWidth: 20,    // cm
  defaultHeight: 10,   // cm
};

export type DeliveryMethod = "motoboy" | "pickup" | "shipping";

export interface DeliveryOption {
  method: DeliveryMethod;
  label: string;
  description: string;
  fee: number;
  service?: string;
  deadlineDays?: number;
}

export interface ShippingQuote {
  service: string;
  serviceName: string;
  price: number;
  deliveryDays: number;
  deliveryRange: { min: number; max: number };
}
