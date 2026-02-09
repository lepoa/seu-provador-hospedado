import { useState, useCallback } from "react";
import { getStoreWhatsAppPhone, getFormattedStorePhone } from "@/lib/storeConfig";
import { copyToClipboard } from "@/lib/clipboardUtils";

interface WhatsAppState {
  isOpen: boolean;
  message: string;
  phone: string;
}

export function useWhatsApp() {
  const [fallbackModal, setFallbackModal] = useState<WhatsAppState>({
    isOpen: false,
    message: "",
    phone: "",
  });

  const storePhone = getStoreWhatsAppPhone();
  const formattedStorePhone = getFormattedStorePhone();

  /**
   * Opens WhatsApp with the given message to the store.
   * Uses wa.me format directly. Falls back to modal if blocked.
   * @param message - The message to send
   */
  const openWhatsApp = useCallback((message: string) => {
    const encodedMessage = encodeURIComponent(message);
    const waUrl = `https://wa.me/${storePhone}?text=${encodedMessage}`;

    // Try to open WhatsApp directly
    const newWindow = window.open(waUrl, "_blank", "noopener,noreferrer");

    // If popup was blocked or failed, show fallback modal
    if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
      setFallbackModal({
        isOpen: true,
        message,
        phone: storePhone,
      });
    }
  }, [storePhone]);

  /**
   * Opens WhatsApp to send a message to a customer (merchant -> customer)
   * @param message - The message to send
   * @param customerPhone - Customer phone (DDD + number, e.g., 62991223519)
   */
  const openWhatsAppToCustomer = useCallback((message: string, customerPhone: string) => {
    const cleanPhone = customerPhone.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const encodedMessage = encodeURIComponent(message);
    const waUrl = `https://wa.me/${fullPhone}?text=${encodedMessage}`;

    const newWindow = window.open(waUrl, "_blank", "noopener,noreferrer");

    if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
      setFallbackModal({
        isOpen: true,
        message,
        phone: fullPhone,
      });
    }
  }, []);

  const closeFallbackModal = useCallback(() => {
    setFallbackModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const copyMessage = useCallback(async () => {
    await copyToClipboard(fallbackModal.message);
  }, [fallbackModal.message]);

  return {
    openWhatsApp,
    openWhatsAppToCustomer,
    fallbackModal,
    closeFallbackModal,
    copyMessage,
    storePhone,
    formattedStorePhone,
  };
}
