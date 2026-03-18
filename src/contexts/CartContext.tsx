import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useGiftEngine } from "@/hooks/useGiftEngine";
import { supabase } from "@/integrations/supabase/client";
import { saveAbandonedCart, clearAbandonedCart } from "@/hooks/useAbandonedCart";

export interface CartItem {
  productId: string;
  name: string;
  price: number; // Final price after discount
  originalPrice: number; // Original price before discount
  discountPercent: number; // Applied discount percentage (0-100)
  size: string;
  quantity: number;
  imageUrl?: string | null;
  isGift?: boolean; // New: identify gift items
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (productId: string, size: string) => void;
  updateQuantity: (productId: string, size: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
  gifts: CartItem[]; // New: exposed gifts
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "loja_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Migration: add missing fields for old cart items
          return parsed.map((item: any) => ({
            ...item,
            originalPrice: item.originalPrice ?? item.price,
            discountPercent: item.discountPercent ?? 0,
          }));
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  // Gift Engine Integration
  const { evaluateAndApplyGifts } = useGiftEngine();
  const [gifts, setGifts] = useState<CartItem[]>([]);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // ── Abandoned cart tracking ──────────────────────────────────────────
  const abandonedCartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Fire with 5s debounce to avoid excessive writes
    if (abandonedCartTimer.current) clearTimeout(abandonedCartTimer.current);

    if (items.length === 0) return;

    abandonedCartTimer.current = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      await saveAbandonedCart(
        user.email,
        items.map((item) => ({
          name: item.name,
          size: item.size,
          price: item.price,
          quantity: item.quantity,
          image_url: item.imageUrl ?? undefined,
        }))
      );
    }, 5_000);

    return () => {
      if (abandonedCartTimer.current) clearTimeout(abandonedCartTimer.current);
    };
  }, [items]);

  // Calculate total (excluding gifts)
  const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  // Effect to calculate gifts when total changes
  useEffect(() => {
    const checkGifts = async () => {
      // Clean up previous gifts from items is not needed because we store them separately in 'gifts' state
      // But we need to calculate based on the current cart total
      if (total > 0) {
        const applicableGifts = await evaluateAndApplyGifts({
          channel: "catalog",
          cartTotal: total,
          simulateOnly: true
        });

        // Convert AppliedGift to CartItem
        const giftItems: CartItem[] = applicableGifts.map(g => ({
          productId: g.giftId, // Use giftId as productId
          name: g.giftName,
          price: 0,
          originalPrice: 0,
          discountPercent: 100,
          size: "Único",
          quantity: g.qty,
          imageUrl: g.giftImage,
          isGift: true
        }));

        setGifts(giftItems);
      } else {
        setGifts([]);
      }
    };

    checkGifts();
  }, [total, evaluateAndApplyGifts]);

  const addItem = (item: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.productId === item.productId && i.size === item.size
      );
      if (existing) {
        return prev.map((i) =>
          i.productId === item.productId && i.size === item.size
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeItem = (productId: string, size: string) => {
    setItems((prev) =>
      prev.filter((i) => !(i.productId === productId && i.size === size))
    );
  };

  const updateQuantity = (productId: string, size: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId, size);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId && i.size === size ? { ...i, quantity } : i
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    // Clear any pending abandoned cart email for this user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) clearAbandonedCart(user.email).catch(() => { });
    });
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        total,
        itemCount,
        gifts, // Expose gifts
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
