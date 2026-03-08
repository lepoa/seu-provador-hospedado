export interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
}

interface SendEmailResult {
  ok: boolean;
  error?: string;
}

const EMAIL_API_ENDPOINT = "http://localhost:3001/api/send-email";

export async function sendEmail({ to, subject, html }: SendEmailPayload): Promise<SendEmailResult> {
  if (!to || !subject || !html) {
    return { ok: false, error: "Parametros obrigatorios ausentes." };
  }

  try {
    const response = await fetch(EMAIL_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      let serverError = "";
      try {
        const payload = await response.json();
        serverError = payload?.error ? ` ${payload.error}` : "";
      } catch {
        serverError = "";
      }
      const message = `Falha ao enviar email (status ${response.status}).${serverError}`;
      return { ok: false, error: message };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido ao enviar email.";
    return { ok: false, error: message };
  }
}
