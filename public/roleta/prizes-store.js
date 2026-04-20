/* global window */
// Shared prize store — single source of truth for the wheel.

const PRIZES_KEY = "lepoa-premios-v1";

// Character limits — keep layout tight.
window.PRIZE_LIMITS = {
  label: 12,  // ex: "FRETE GRÁTIS" (12)
  sub:   18,  // ex: "peça selecionada" (16)
  code:  12,  // ex: "FRETEPOA" (8)
  valid: 14,  // ex: "presencial" (10)
};

// Fixed slot palette — vendedoras não editam cor (mantém o desenho equilibrado).
const SLOT_PALETTE = [
  { color: "#6f7a4f", text: "#faf7f0" }, // olive médio
  { color: "#d9b1aa", text: "#3a2620" }, // rosé claro
  { color: "#e6ca9a", text: "#3a2e18" }, // dourado claro
  { color: "#4a5333", text: "#f7f3eb" }, // olive escuro
  { color: "#c99b94", text: "#3a2620" }, // rosé médio
  { color: "#b08a44", text: "#1e2117" }, // dourado escuro
  { color: "#8a9468", text: "#1e2117" }, // olive claro
  { color: "#f3e5c6", text: "#3a2e18" }, // dourado pálido
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

window.loadPrizes = function () {
  try {
    const raw = localStorage.getItem(PRIZES_KEY);
    if (!raw) return DEFAULT_PRIZES.map((p, i) => ({ ...p, ...SLOT_PALETTE[i] }));
    const saved = JSON.parse(raw);
    return saved.map((p, i) => ({ ...p, ...SLOT_PALETTE[i % SLOT_PALETTE.length] }));
  } catch {
    return DEFAULT_PRIZES.map((p, i) => ({ ...p, ...SLOT_PALETTE[i] }));
  }
};

window.savePrizes = function (prizes) {
  const clean = prizes.map(({ id, label, sub, weight, code, valid, enabled }) => ({
    id, label, sub, weight, code, valid, enabled
  }));
  localStorage.setItem(PRIZES_KEY, JSON.stringify(clean));
};

window.resetPrizes = function () {
  localStorage.removeItem(PRIZES_KEY);
};
