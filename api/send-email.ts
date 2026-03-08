import nodemailer from "nodemailer";

type ReqBody = {
  to?: string;
  subject?: string;
  html?: string;
};

type Req = {
  method?: string;
  body?: ReqBody;
};

type Res = {
  status: (code: number) => Res;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export default async function handler(req: Req, res: Res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const { to, subject, html } = req.body || {};

    if (!to || !subject || !html) {
      res.status(400).json({ ok: false, error: "Missing required fields: to, subject, html" });
      return;
    }

    const host = getRequiredEnv("SMTP_HOST");
    const port = Number(getRequiredEnv("SMTP_PORT"));
    const user = getRequiredEnv("SMTP_USER");
    const pass = getRequiredEnv("SMTP_PASS");
    const fromName = process.env.SMTP_FROM_NAME || "Le.Poa";
    const fromEmail = process.env.SMTP_FROM_EMAIL || "nao-responder@lepoa.online";

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      html,
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[send-email] error", error);
    res.status(500).json({ ok: false, error: "Failed to send email" });
  }
}
