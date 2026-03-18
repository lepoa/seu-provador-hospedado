import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ─── Helpers ────────────────────────────────────────────────────────────────

function createTransporter() {
  const smtpPort = Number(process.env.SMTP_PORT);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function checkSmtpEnv(res) {
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM_EMAIL"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    res.status(500).json({ ok: false, error: `Variaveis SMTP ausentes: ${missing.join(", ")}` });
    return false;
  }
  return true;
}

// ─── Single email ────────────────────────────────────────────────────────────

app.post("/api/send-email", async (req, res) => {
  try {
    console.log("Requisicao recebida:", req.body);
    const { to, subject, html } = req.body;
    if (!checkSmtpEnv(res)) return;

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"Le.Poa" <${process.env.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      html,
    });

    console.log("Email enviado com sucesso");
    res.json({ ok: true });
  } catch (error) {
    console.error("Erro ao enviar email:", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Erro interno ao enviar email",
    });
  }
});

// ─── Batch email (max 20/min) ────────────────────────────────────────────────

app.post("/api/send-email-batch", async (req, res) => {
  try {
    const { emails, subject, html, tracking_id } = req.body;
    if (!Array.isArray(emails) || !subject || !html) {
      return res.status(400).json({ ok: false, error: "Parametros invalidos." });
    }
    if (!checkSmtpEnv(res)) return;

    const BATCH_SIZE = 20;
    const DELAY_MS = 60_000;
    const BASE_URL = process.env.SERVER_BASE_URL || "http://localhost:3001";

    const transporter = createTransporter();
    const unique = [...new Set(emails)];
    const errors = [];
    let sent = 0;

    // Inject tracking pixel + click wrappers if tracking_id given
    function buildTrackedHtml(baseHtml) {
      if (!tracking_id) return baseHtml;
      const pixel = `<img src="${BASE_URL}/api/email-pixel/${tracking_id}" width="1" height="1" style="display:none" alt="" />`;
      let traced = baseHtml.replace(/<\/body>/i, `${pixel}</body>`);
      traced = traced.replace(/href="(https?:\/\/[^"]+)"/g, (_, url) => {
        const encoded = encodeURIComponent(url);
        return `href="${BASE_URL}/api/email-click/${tracking_id}?url=${encoded}"`;
      });
      return traced;
    }

    // Send synchronously — wait for all emails so we can report real results
    for (let i = 0; i < unique.length; i += BATCH_SIZE) {
      const batch = unique.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((to) =>
          transporter.sendMail({
            from: `"Le.Poa" <${process.env.SMTP_FROM_EMAIL}>`,
            to,
            subject,
            html: buildTrackedHtml(html),
          })
        )
      );

      results.forEach((result, idx) => {
        if (result.status === "fulfilled") {
          sent++;
          console.log(`[batch] ✓ Enviado para ${batch[idx]}`);
        } else {
          errors.push({ to: batch[idx], error: result.reason?.message || "Erro desconhecido" });
          console.error(`[batch] ✗ Falha para ${batch[idx]}:`, result.reason?.message);
        }
      });

      // Only delay if there are more batches
      if (i + BATCH_SIZE < unique.length) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }

    console.log(`[batch] Concluído: ${sent} enviados, ${errors.length} falhas de ${unique.length} total.`);

    if (sent === 0 && errors.length > 0) {
      return res.status(500).json({
        ok: false,
        sent: 0,
        total: unique.length,
        error: `Todos os ${errors.length} emails falharam. Primeiro erro: ${errors[0].error}`,
        errors,
      });
    }

    res.json({ ok: true, sent, total: unique.length, failed: errors.length, errors: errors.slice(0, 5) });
  } catch (error) {
    console.error("Erro no batch:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ─── Email open tracking pixel ────────────────────────────────────────────────

app.get("/api/email-pixel/:trackId", async (req, res) => {
  const { trackId } = req.params;
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (supabaseUrl && serviceKey) {
      const campRes = await fetch(
        `${supabaseUrl}/rest/v1/email_campaigns?tracking_id=eq.${trackId}&select=id`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      );
      const camps = await campRes.json();
      if (camps?.[0]?.id) {
        await fetch(`${supabaseUrl}/rest/v1/email_events`, {
          method: "POST",
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ campaign_id: camps[0].id, event: "open" }),
        });
      }
    }
  } catch (e) {
    console.error("[pixel] Erro:", e.message);
  }
  const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store" }).send(gif);
});

// ─── Email click tracking redirect ───────────────────────────────────────────

app.get("/api/email-click/:trackId", async (req, res) => {
  const { trackId } = req.params;
  const url = req.query.url ? decodeURIComponent(req.query.url) : "https://lepoa.online";
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (supabaseUrl && serviceKey) {
      const campRes = await fetch(
        `${supabaseUrl}/rest/v1/email_campaigns?tracking_id=eq.${trackId}&select=id`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      );
      const camps = await campRes.json();
      if (camps?.[0]?.id) {
        await fetch(`${supabaseUrl}/rest/v1/email_events`, {
          method: "POST",
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ campaign_id: camps[0].id, event: "click", url }),
        });
      }
    }
  } catch (e) {
    console.error("[click] Erro:", e.message);
  }
  res.redirect(url);
});

// ─── Abandoned cart job ───────────────────────────────────────────────────────

app.post("/api/abandoned-cart-job", async (req, res) => {
  try {
    if (!checkSmtpEnv(res)) return;

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ ok: false, error: "Supabase URL/Key nao configurados." });
    }

    // Fetch carts abandoned more than 2 hours ago with email_sent = false
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const response = await fetch(
      `${supabaseUrl}/rest/v1/abandoned_carts?email_sent=eq.false&created_at=lt.${twoHoursAgo}&select=*`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const carts = await response.json();

    if (!Array.isArray(carts) || carts.length === 0) {
      console.log("[abandoned-cart-job] Nenhum carrinho pendente.");
      return res.json({ ok: true, processed: 0 });
    }

    const transporter = createTransporter();
    let processed = 0;

    for (const cart of carts) {
      try {
        const items = Array.isArray(cart.cart_data) ? cart.cart_data : [];
        const itemRows = items
          .map(
            (item) =>
              `<tr><td style="padding:6px 0;font-size:14px;">${item.name}${item.size ? ` (${item.size})` : ""}</td><td style="padding:6px 0;font-size:14px;text-align:right;">R$ ${(item.price * (item.quantity || 1)).toFixed(2).replace(".", ",")}</td></tr>`
          )
          .join("");

        const html = `<!DOCTYPE html><html lang="pt-BR"><body style="font-family:Georgia,serif;background:#faf7f2;padding:32px 16px;">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;margin:0 auto;overflow:hidden;">
            <tr><td style="background:#2d1f14;padding:28px 40px;text-align:center;"><p style="margin:0;font-size:24px;color:#d4a96a;letter-spacing:2px;">LE.POÁ</p></td></tr>
            <tr><td style="padding:36px 40px;text-align:center;">
              <p style="font-size:36px;margin:0 0 12px;">👀</p>
              <h1 style="margin:0 0 8px;font-size:20px;color:#2d1f14;font-weight:normal;">Você esqueceu algo no carrinho...</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#6b5744;">Olá! Seu carrinho ainda está te esperando.</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;text-align:left;">${itemRows}</table>
              <a href="https://lepoa.online/carrinho" style="display:inline-block;padding:12px 32px;background:#c4732a;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;">Finalizar compra</a>
            </td></tr>
            <tr><td style="background:#faf7f2;padding:20px 40px;text-align:center;border-top:1px solid #f0ebe3;"><p style="margin:0;font-size:13px;color:#9b8b7a;">Equipe Le.Poá</p></td></tr>
          </table></body></html>`;

        await transporter.sendMail({
          from: `"Le.Poa" <${process.env.SMTP_FROM_EMAIL}>`,
          to: cart.email,
          subject: "Você esqueceu algo no seu carrinho 👀",
          html,
        });

        // Mark as sent
        await fetch(`${supabaseUrl}/rest/v1/abandoned_carts?id=eq.${cart.id}`, {
          method: "PATCH",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ email_sent: true }),
        });

        processed++;
        console.log(`[abandoned-cart-job] Email enviado para ${cart.email}`);
      } catch (err) {
        console.error(`[abandoned-cart-job] Falha para ${cart.email}:`, err.message);
      }
    }

    res.json({ ok: true, processed });
  } catch (error) {
    console.error("[abandoned-cart-job] Erro:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ─── Get all user emails (uses service role to access auth.users) ─────────────

app.get("/api/get-all-user-emails", async (req, res) => {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    const withDetails = req.query.details === "true";

    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({ ok: false, error: "SUPABASE_SERVICE_KEY nao configurado no .env do servidor." });
    }

    let allUsers = [];
    let page = 1;
    const perPage = 1000;

    // Paginate through all users
    while (true) {
      const response = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
        }
      );

      if (!response.ok) {
        const err = await response.text();
        console.error("[get-all-user-emails] Supabase error:", err);
        return res.status(500).json({ ok: false, error: "Erro ao buscar usuarios do Supabase." });
      }

      const { users = [] } = await response.json();
      allUsers = allUsers.concat(users);

      if (users.length < perPage) break; // last page
      page++;
    }

    if (withDetails) {
      // Return {id, email} objects for user_id → email mapping
      const users = allUsers
        .filter((u) => u.email)
        .map((u) => ({ id: u.id, email: u.email }));
      return res.json({ ok: true, users });
    }

    const emails = [...new Set(allUsers.map((u) => u.email).filter(Boolean))];
    res.json({ ok: true, emails });
  } catch (error) {
    console.error("[get-all-user-emails] Erro:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.listen(3001, () => {
  console.log("Email server running on port 3001");

  // ── Auto-run abandoned cart job every 30 minutes ─────────────────────
  const INTERVAL_MS = 30 * 60 * 1000; // 30 min
  const INITIAL_DELAY_MS = 5 * 60 * 1000; // wait 5 min after startup

  const runJob = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/abandoned-cart-job", { method: "POST" });
      const data = await res.json();
      console.log(`[cron] abandoned-cart-job: processed ${data.processed ?? 0} carts`);
    } catch (err) {
      console.error("[cron] abandoned-cart-job error:", err.message);
    }
  };

  setTimeout(() => {
    runJob();
    setInterval(runJob, INTERVAL_MS);
  }, INITIAL_DELAY_MS);
});

