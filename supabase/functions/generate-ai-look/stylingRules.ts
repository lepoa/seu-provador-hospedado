const normalizeStr = (str: any) => {
    if (!str || typeof str !== 'string') return "";
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

export const OCCASION_MAP: Record<string, string[]> = {
    "jantar": ["jantar", "restaurante", "date", "noite"],
    "eventos": ["festa", "evento", "casamento", "formatura", "aniversario", "gala", "batizado", "cerimonia"],
    "trabalho": ["trabalho", "corporativo", "escritorio", "reuniao", "reunião", "profissional", "entrevista"],
    "igreja": ["igreja", "culto", "missa", "religioso", "templo"],
    "viagem": ["viagem", "aeroporto", "turismo", "mala"],
    "dia a dia": ["dia a dia", "dia-a-dia", "rotina", "passeio", "shopping"],
    "especial": ["especial", "comemoracao", "comemoração", "data especial"]
};

export const STYLE_MAP: Record<string, string[]> = {
    "elegante": ["elegante", "sofisticado", "chique", "chic", "fino", "arrumado"],
    "clássico": ["classico", "clássico", "atemporal", "oficial", "tradicional"],
    "romântico": ["romantico", "romântico", "delicado", "feminino", "fofo", "doce"],
    "moderno": ["moderno", "descolado", "atual", "estiloso", "fashionista"],
    "sexy chic": ["sexy", "sensual", "ousado", "decote", "fenda", "sexy chic"],
    "casual": ["casual", "confortavel", "confortável", "relaxe", "despojado"],
    "minimal": ["minimalista", "minimal", "simples", "clean", "basico", "básico"],
    "fashion": ["fashion", "tendencia", "impactante"]
};

export const FIT_MAP: Record<string, string[]> = {
    "soltinho": ["soltinho", "confortavel", "confortável", "larguinho", "fluido", "solto", "amplo"],
    "ajustado": ["justo", "ajustado", "colado"],
    "acinturado": ["marcando cintura", "acinturado", "cintura marcada"]
};

export function resolveOccasion(text: string): string | null {
    const normalized = normalizeStr(text);
    for (const [key, terms] of Object.entries(OCCASION_MAP)) {
        for (const term of terms) {
            if (normalized.includes(normalizeStr(term))) return key;
        }
    }
    return null;
}

export function resolveStyle(text: string): string | null {
    const normalized = normalizeStr(text);
    for (const [key, terms] of Object.entries(STYLE_MAP)) {
        for (const term of terms) {
            if (normalized.includes(normalizeStr(term))) return key;
        }
    }
    return null;
}

export function resolveFit(text: string): string | null {
    const normalized = normalizeStr(text);
    for (const [key, terms] of Object.entries(FIT_MAP)) {
        for (const term of terms) {
            if (normalized.includes(normalizeStr(term))) return key;
        }
    }
    return null;
}

export function resolveSize(text: string): string | null {
    const tokens = text.toUpperCase().replace(/[^\w\s]/g, "").split(/\s+/);
    const validSizes = ["PP", "P", "M", "G", "GG", "EXG", "34", "36", "38", "40", "42", "44", "46", "48", "U"];
    for (const token of tokens) {
        if (validSizes.includes(token)) return token;
    }
    return null;
}

// Function to score product based on strict ranking
// 1. ocasião
// 2. estilo
// 3. modelagem
export function scoreProductPriority(product: any, state: { occasion: string | null, style: string | null, fit: string | null }): number {
    let score = 0;
    
    const pOccasion = normalizeStr(product.occasion || "");
    const pStyle = normalizeStr(product.style || "");
    const pName = normalizeStr(product.name || "");
    const pDesc = normalizeStr(product.description || "");

    if (state.occasion) {
        if (pOccasion.includes(normalizeStr(state.occasion))) score += 1000;
        // Secondary match in description
        else if (pDesc.includes(normalizeStr(state.occasion))) score += 200;
    }

    if (state.style) {
        if (pStyle.includes(normalizeStr(state.style))) score += 100;
        else if (pDesc.includes(normalizeStr(state.style))) score += 20;
    }

    if (state.fit) {
        if (pDesc.includes(normalizeStr(state.fit)) || pName.includes(normalizeStr(state.fit))) score += 10;
    }

    return score;
}
