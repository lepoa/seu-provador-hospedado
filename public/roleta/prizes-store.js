/* global window */
// Shared prize store — single source of truth for the wheel.
// Uses Supabase as shared storage so admin changes are visible to all clients.

const PRIZES_KEY = "lepoa-premios-v1";

const _SB_URL = "https://deibjfkveiyogvtscyeh.supabase.co";
const _SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlaWJqZmt2ZWl5b2d2dHNjeWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MDA3MzMsImV4cCI6MjA4NjE3NjczM30.eYGXOHLLJq6wpRT605kxSc8t_qS15_ux174d0rUOmfY";

// Character limits — keep layout tight.
window.PRIZE_LIMITS = {
  label: 12,
  sub:   18,
  code:  12,
  valid: 14,
};

// Fixed slot palette
const SLOT_PALETTE = [
  { color: "#6f7a4f", text: "#faf7f0" },
  { color: "#d9b1aa", text: "#3a2620" },
  { color: "#e6ca9a", text: "#3a2e18" },
  { color: "#4a5333", text: "#f7f3eb" },
  { color: "#c99b94", text: "#3a2620" },
  { color: "#b08a44", text: "#1e2117" },
  { color: "#8a9468", text: "#1e2117" },
  { color: "#f3e5c6", text: "#3a2e18" },
];

const DEFAULT_PRIZES = [
  { id: "s1", label: "10% OFF",      sub: "toda loja",       weight: 22, code: "LEPOA10",  valid: "7 dias",     enabled: true },
  { id: "s2", label: "FRETE GRÁTIS", sub: "acima R$199",     weight: 18, code: "FRETEPOA", valid: "7 dias",     enabled: true },
  { id: "s3", label: "5% OFF",       sub: "boas-vindas",     weight: 22, code: "LEPOA5",   valid: "15 dias",    enabled: true },
  { id: "s4", label: "15% OFF",      sub: "coleção nova",    weight: 12, code: "POA15",    valid: "5 dias",     enabled: true },
  { id: "s5", label: "BRINDE",       sub: "surpresa",        weight: 8,  code: "BRINDELP", valid: "presencial", enabled: true },
  { id: "s6", label: "20% OFF",      sub: "peça selecionada",weight: 4,  code: "POA20",    valid: "3 dias",     enabled: true },
  { id: "s7", label: "GIRO DUPLO",   sub: "+ uma chance",    weight: 8,  code: "__AGAIN",  valid: "—",          enabled: true },
  { id: "s8", label: "8% OFF",       sub: "qualquer peça",   weight: 6,  code: "LEPOA8",   valid: "10 dias",    enabled: true },
];

window.SLOT_PALETTE = SLOT_PALETTE;
window.DEFAULT_PRIZES = DEFAULT_PRIZES;
window.PRIZES_KEY = PRIZES_KEY;

// Apply palette colors to prizes
function applyPalette(prizes) {
  return prizes.map((p, i) => ({ ...p, ...SLOT_PALETTE[i % SLOT_PALETTE.length] }));
}

// Load prizes: first from localStorage cache, then fetch from Supabase in background
window.loadPrizes = function () {
  try {
    const raw = localStorage.getItem(PRIZES_KEY);
    if (raw) {
      return applyPalette(JSON.parse(raw));
    }
  } catch { /* ignore */ }
  return applyPalette(DEFAULT_PRIZES);
};

// Save prizes to both localStorage AND Supabase
window.savePrizes = function (prizes) {
  const clean = prizes.map(({ id, label, sub, weight, code, valid, enabled }) => ({
    id, label, sub, weight, code, valid, enabled
  }));
  // Save locally for instant access
  localStorage.setItem(PRIZES_KEY, JSON.stringify(clean));
  // Save to Supabase so all clients see the change
  savePrizesToSupabase(clean);
};

window.resetPrizes = function () {
  localStorage.removeItem(PRIZES_KEY);
  // Reset Supabase too
  savePrizesToSupabase(DEFAULT_PRIZES);
};

// ----- Supabase sync -----

async function savePrizesToSupabase(prizes) {
  try {
    // Try upsert
    const resp = await fetch(`${_SB_URL}/rest/v1/roleta_config?on_conflict=id`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": _SB_KEY,
        "Authorization": `Bearer ${_SB_KEY}`,
        "Prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify({ id: "prizes", data: prizes, updated_at: new Date().toISOString() }),
    });
    if (!resp.ok) {
      console.warn("[roleta] savePrizesToSupabase failed:", resp.status);
    }
  } catch (e) {
    console.warn("[roleta] savePrizesToSupabase error:", e);
  }
}

// Fetch latest prizes from Supabase and update localStorage cache
window.syncPrizesFromSupabase = async function () {
  try {
    const resp = await fetch(`${_SB_URL}/rest/v1/roleta_config?id=eq.prizes&select=data`, {
      headers: {
        "apikey": _SB_KEY,
        "Authorization": `Bearer ${_SB_KEY}`,
      },
    });
    if (!resp.ok) return null;
    const rows = await resp.json();
    if (rows.length > 0 && rows[0].data) {
      const prizes = rows[0].data;
      localStorage.setItem(PRIZES_KEY, JSON.stringify(prizes));
      return applyPalette(prizes);
    }
  } catch (e) {
    console.warn("[roleta] syncPrizesFromSupabase error:", e);
  }
  return null;
};
