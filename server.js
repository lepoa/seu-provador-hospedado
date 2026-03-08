import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/send-email", async (req, res) => {
  try {
    console.log("Requisicao recebida:", req.body);

    const { to, subject, html } = req.body;
    const requiredEnv = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM_EMAIL"];
    const missingEnv = requiredEnv.filter((key) => !process.env[key]);

    if (missingEnv.length > 0) {
      console.error("Variaveis SMTP ausentes:", missingEnv);
      return res.status(500).json({
        ok: false,
        error: `Variaveis SMTP ausentes: ${missingEnv.join(", ")}`,
      });
    }

    const smtpPort = Number(process.env.SMTP_PORT);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

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

app.listen(3001, () => {
  console.log("Email server running on port 3001");
});
