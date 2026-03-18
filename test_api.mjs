import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({path: '.env.local'});
dotenv.config({path: '.env'});

const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-look`;
const apiKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log("Calling", url);

const controller = new AbortController();
const timeoutId = setTimeout(() => {
  controller.abort();
  console.log("TIMEOUT AFTER 15 SECONDS");
}, 15000);

try {
  const start = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      input_text: 'Quero um look para colação de grau como convidada',
      session_id: 'test',
      history: [
        { type: "bot", text: "Olá! Para que ocasião você está buscando um look hoje?" }
      ]
    }),
    signal: controller.signal
  });
  clearTimeout(timeoutId);
  console.log(`Status: ${res.status} ${res.statusText} (${Date.now() - start}ms)`);
  const text = await res.text();
  fs.writeFileSync('error.json', text);
  console.log("Wrote response to error.json");
} catch (e) {
  console.error("Fetch Exception:", e);
}
