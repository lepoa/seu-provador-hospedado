import { supabase } from "@/integrations/supabase/client";

export interface AbandonedCartItem {
    name: string;
    size?: string;
    price: number;
    quantity: number;
    image_url?: string;
}

/**
 * Saves or updates an abandoned cart record in Supabase.
 * Call this when the user (logged in) adds items to the cart.
 * The server-side job will send the recovery email after 2h if not purchased.
 */
export async function saveAbandonedCart(
    email: string,
    items: AbandonedCartItem[]
): Promise<void> {
    if (!email || items.length === 0) return;

    try {
        const { data: existing } = await supabase
            .from("abandoned_carts")
            .select("id, email_sent")
            .eq("email", email)
            .eq("email_sent", false)
            .maybeSingle();

        if (existing) {
            // Update the cart data and reset created_at so the 2h window resets
            await supabase
                .from("abandoned_carts")
                .update({
                    cart_data: items as unknown as Record<string, unknown>[],
                    created_at: new Date().toISOString(),
                })
                .eq("id", existing.id);
        } else {
            await supabase.from("abandoned_carts").insert({
                email,
                cart_data: items as unknown as Record<string, unknown>[],
                email_sent: false,
            });
        }
    } catch (err) {
        console.warn("[useAbandonedCart] Falha ao salvar carrinho abandonado:", err);
    }
}

/**
 * Clears any pending abandoned cart email for this email address.
 * Call this when the user successfully completes a purchase.
 */
export async function clearAbandonedCart(email: string): Promise<void> {
    if (!email) return;
    try {
        await supabase
            .from("abandoned_carts")
            .update({ email_sent: true })
            .eq("email", email)
            .eq("email_sent", false);
    } catch (err) {
        console.warn("[useAbandonedCart] Falha ao limpar carrinho abandonado:", err);
    }
}
