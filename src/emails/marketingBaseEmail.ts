export interface MarketingEmailParams {
    subject: string;
    content: string; // Supports plain text or HTML paragraphs
    ctaText?: string;
    ctaUrl?: string;
    recipientName?: string;
}

export function marketingBaseEmail({
    content,
    ctaText,
    ctaUrl,
    recipientName,
}: MarketingEmailParams): string {
    const greeting = recipientName ? `<p style="margin:0 0 16px;font-size:15px;color:#6b5744;">Olá, <strong>${recipientName}</strong>!</p>` : "";

    const ctaBlock =
        ctaText && ctaUrl
            ? `<table cellpadding="0" cellspacing="0" style="margin:32px auto 0;">
          <tr>
            <td style="background:#2d1f14;border-radius:8px;">
              <a href="${ctaUrl}" style="display:block;padding:14px 32px;font-size:14px;color:#fff;text-decoration:none;font-family:Arial,sans-serif;letter-spacing:0.5px;">${ctaText}</a>
            </td>
          </tr>
        </table>`
            : "";

    // Convert plain text newlines to <br> if content doesn't contain HTML tags
    const hasHtml = /<[a-z][\s\S]*>/i.test(content);
    const formattedContent = hasHtml
        ? content
        : content
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => `<p style="margin:0 0 12px;font-size:15px;color:#3d2b1f;line-height:1.6;">${line}</p>`)
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
          <td style="padding:40px 40px 32px;">
            ${greeting}
            <div>${formattedContent}</div>
            ${ctaBlock}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#faf7f2;padding:24px 40px;text-align:center;border-top:1px solid #f0ebe3;">
            <p style="margin:0 0 8px;font-size:13px;color:#9b8b7a;">Equipe Le.Poá · <a href="https://lepoa.online" style="color:#d4a96a;text-decoration:none;">lepoa.online</a></p>
            <p style="margin:0;font-size:11px;color:#bfb0a3;">Você está recebendo este email por ser cliente da Le.Poá.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
