export interface OrderShippedEmailParams {
    customerName: string;
    orderId: string;
    trackingCode: string;
    trackingUrl?: string;
}

export function orderShippedEmail({
    customerName,
    orderId,
    trackingCode,
    trackingUrl,
}: OrderShippedEmailParams): string {
    const trackingLink = trackingUrl || `https://www.correios.com.br/rastreamento/?objetos=${trackingCode}`;

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
          <td style="padding:40px 40px 24px;text-align:center;">
            <div style="font-size:48px;margin-bottom:16px;">📦</div>
            <h1 style="margin:0 0 8px;font-size:22px;color:#2d1f14;font-weight:normal;">Seu pedido está a caminho!</h1>
            <p style="margin:0 0 32px;font-size:15px;color:#6b5744;">
              Olá, <strong>${customerName}</strong>! Seu pedido <strong>#${orderId}</strong> foi despachado.
            </p>

            <!-- Tracking box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background:#faf7f2;border-radius:8px;padding:20px;text-align:center;border:1px solid #f0ebe3;">
                  <p style="margin:0 0 4px;font-size:12px;color:#9b8b7a;text-transform:uppercase;letter-spacing:1px;">Código de rastreio</p>
                  <p style="margin:0;font-size:20px;color:#2d1f14;font-weight:bold;letter-spacing:2px;">${trackingCode}</p>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
              <tr>
                <td style="background:#2d1f14;border-radius:8px;">
                  <a href="${trackingLink}" style="display:block;padding:14px 32px;font-size:14px;color:#fff;text-decoration:none;font-family:Arial,sans-serif;letter-spacing:0.5px;">Acompanhar entrega</a>
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
