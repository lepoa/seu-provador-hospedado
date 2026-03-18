import { sendEmail } from "@/lib/sendEmail";
import { orderConfirmedEmail, OrderItem } from "@/emails/orderConfirmedEmail";
import { orderShippedEmail } from "@/emails/orderShippedEmail";

export interface OrderEmailParams {
    customerName: string;
    customerEmail: string;
    orderId: string;
    items: OrderItem[];
    total: number;
}

/**
 * Sends a "Pedido confirmado" email to the customer.
 * Call this right after a successful order is created.
 */
export async function sendOrderConfirmedEmail(params: OrderEmailParams): Promise<void> {
    const { customerName, customerEmail, orderId, items, total } = params;

    const orderUrl = `${window.location.origin}/meus-pedidos/${orderId}`;

    const html = orderConfirmedEmail({
        customerName,
        orderId,
        items,
        total,
        orderUrl,
    });

    const result = await sendEmail({
        to: customerEmail,
        subject: "Pedido confirmado na Le.Poá ✨",
        html,
    });

    if (!result.ok) {
        console.warn("[useOrderEmail] Falha ao enviar email de pedido confirmado:", result.error);
    }
}

/**
 * Sends a "Pedido enviado" email with the tracking code.
 * Call this when the order shipping is registered.
 */
export async function sendOrderShippedEmail({
    customerName,
    customerEmail,
    orderId,
    trackingCode,
    trackingUrl,
}: {
    customerName: string;
    customerEmail: string;
    orderId: string;
    trackingCode: string;
    trackingUrl?: string;
}): Promise<void> {
    const html = orderShippedEmail({
        customerName,
        orderId,
        trackingCode,
        trackingUrl,
    });

    const result = await sendEmail({
        to: customerEmail,
        subject: "Seu pedido está a caminho 📦",
        html,
    });

    if (!result.ok) {
        console.warn("[useOrderEmail] Falha ao enviar email de pedido enviado:", result.error);
    }
}
