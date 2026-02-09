// Store configuration - centralizes store settings
// The phone should be in format: 55DDDNUMBER (e.g., 5562991223519)
export const STORE_WHATSAPP_PHONE = import.meta.env.VITE_STORE_WHATSAPP_PHONE || "5562991223519";

export const getStoreWhatsAppPhone = () => {
  return STORE_WHATSAPP_PHONE;
};

// Returns formatted phone for display: (62) 99122-3519
export const getFormattedStorePhone = () => {
  const phone = STORE_WHATSAPP_PHONE.replace(/^55/, "");
  return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
};
