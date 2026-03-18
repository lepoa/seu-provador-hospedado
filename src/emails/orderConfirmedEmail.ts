export interface OrderItem {
    name: string;
    size?: string;
    quantity: number;
    price: number;
}

export interface OrderConfirmedEmailParams {
    customerName: string;
    orderId: string;
    items: OrderItem[];
    total: number;
    orderUrl: string;
}

export function orderConfirmedEmail({
    customerName,
    orderId,
    items,
    total,
    orderUrl,
}: OrderConfirmedEmailParams): string {
    const itemRows = items
        .map(
            (item) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0ebe3;font-size:14px;color:#3d2b1f;">
          ${item.name}${item.size ? ` <span style="color:#9b8b7a;">(${item.size})</span>` : ""}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f0ebe3;font-size:14px;color:#3d2b1f;text-align:center;">
          ${item.quantity}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f0ebe3;font-size:14px;color:#3d2b1f;text-align:right;">
          R$ ${item.price.toFixed(2).replace(".", ",")}
        </td>
      </tr>`
        )
        .join("");

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#faf7f2;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr>
          <td style="background:#2d1f14;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-family:'Georgia',serif;font-size:26px;color:#d4a96a;letter-spacing:2px;">LE.POÁ</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 24px;">
            <h1 style="margin:0 0 8px;font-size:22px;color:#2d1f14;font-weight:normal;">Pedido confirmado ✨</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#6b5744;">
              Olá, <strong>${customerName}</strong>! Recebemos seu pedido com sucesso.
            </p>

            <p style="margin:0 0 4px;font-size:12px;color:#9b8b7a;text-transform:uppercase;letter-spacing:1px;">Pedido</p>
            <p style="margin:0 0 24px;font-size:14px;color:#2d1f14;font-weight:bold;">#${orderId}</p>

            <!-- Items table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              <thead>
                <tr>
                  <th style="padding:8px 0;font-size:12px;color:#9b8b7a;text-align:left;font-weight:normal;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #f0ebe3;">Produto</th>
                  <th style="padding:8px 0;font-size:12px;color:#9b8b7a;text-align:center;font-weight:normal;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #f0ebe3;">Qtd</th>
                  <th style="padding:8px 0;font-size:12px;color:#9b8b7a;text-align:right;font-weight:normal;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #f0ebe3;">Preço</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>

            <!-- Total -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="font-size:15px;color:#2d1f14;font-weight:bold;">Total</td>
                <td style="font-size:15px;color:#2d1f14;font-weight:bold;text-align:right;">R$ ${total.toFixed(2).replace(".", ",")}</td>
              </tr>
            </table>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
              <tr>
                <td style="background:#2d1f14;border-radius:8px;">
                  <a href="${orderUrl}" style="display:block;padding:14px 32px;font-size:14px;color:#fff;text-decoration:none;font-family:Arial,sans-serif;letter-spacing:0.5px;">Ver meu pedido</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#faf7f2;padding:24px 40px;text-align:center;border-top:1px solid #f0ebe3;">
            <p style="margin:0;font-size:13px;color:#9b8b7a;">Equipe Le.Poá · <a href="https://lepoa.online" style="color:#d4a96a;text-decoration:none;">lepoa.online</a></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
