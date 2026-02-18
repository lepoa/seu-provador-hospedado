export interface QuizQuestionV2 {
  id: number;
  question: string;
  subtext?: string;
  type: "single" | "size" | "open" | "photos";
  pointsType: "common" | "key" | "photos" | "open";
  options?: {
    text: string;
    emoji?: string;
    imageUrl?: string;
    points: { elegante: number; classica: number; minimal: number; romantica: number };
  }[];
}

export const quizQuestionsV2: QuizQuestionV2[] = [
  // ───────────────────────────────────────────────────
  // 1. ASPIRAÇÃO DE ESTILO — Entender como ela QUER ser vista
  // ───────────────────────────────────────────────────
  {
    id: 1,
    question: "Como você gostaria de ser percebida quando entra em um lugar?",
    subtext: "Sua consultora pessoal começa aqui",
    type: "single",
    pointsType: "key",
    options: [
      { text: "Sofisticada e poderosa — comando respeito", points: { elegante: 3, classica: 1, minimal: 0, romantica: 0 } },
      { text: "Elegante sem esforço — tudo parece natural em mim", points: { elegante: 1, classica: 3, minimal: 1, romantica: 0 } },
      { text: "Moderna e despojada — menos é mais", points: { elegante: 0, classica: 1, minimal: 3, romantica: 0 } },
      { text: "Feminina e marcante — os detalhes me definem", points: { elegante: 0, classica: 0, minimal: 0, romantica: 3 } },
    ],
  },

  // ───────────────────────────────────────────────────
  // 2. ROTINA — Entender para QUE ela se veste
  // ───────────────────────────────────────────────────
  {
    id: 2,
    question: "Como é a sua rotina na maior parte da semana?",
    subtext: "Para montar sugestões que funcionem na sua vida real",
    type: "single",
    pointsType: "common",
    options: [
      { text: "Escritório, reuniões e ambientes corporativos", points: { elegante: 3, classica: 2, minimal: 0, romantica: 0 } },
      { text: "Flexível — misturo trabalho, casa e compromissos", points: { elegante: 1, classica: 2, minimal: 3, romantica: 0 } },
      { text: "Home office, mas saio bastante nos fins de semana", points: { elegante: 0, classica: 1, minimal: 3, romantica: 1 } },
      { text: "Vida social ativa — eventos, encontros e saídas", points: { elegante: 1, classica: 0, minimal: 0, romantica: 3 } },
    ],
  },

  // ───────────────────────────────────────────────────
  // 3. CORES — EXPANDIDO com opção vibrante
  // ───────────────────────────────────────────────────
  {
    id: 3,
    question: "Quais cores te fazem se sentir mais bonita?",
    subtext: "Cores revelam muito sobre quem você é",
    type: "single",
    pointsType: "key",
    options: [
      { text: "Preto, marinho e tons escuros — não erro nunca", points: { elegante: 3, classica: 1, minimal: 2, romantica: 0 } },
      { text: "Neutros quentes — bege, caramelo, terracota", points: { elegante: 1, classica: 3, minimal: 2, romantica: 0 } },
      { text: "Cores vibrantes — vermelho, verde, azul royal, pink", points: { elegante: 2, classica: 0, minimal: 0, romantica: 2 } },
      { text: "Tons suaves — rosa, lavanda, pêssego, verde menta", points: { elegante: 0, classica: 0, minimal: 1, romantica: 3 } },
      { text: "Branco e off-white — gosto de leveza e limpeza", points: { elegante: 1, classica: 1, minimal: 3, romantica: 1 } },
    ],
  },

  // ───────────────────────────────────────────────────
  // 4. SILHUETA & CORPO — O que ela quer valorizar
  // ───────────────────────────────────────────────────
  {
    id: 4,
    question: "O que você mais gosta de valorizar no seu corpo?",
    subtext: "Para escolher cortes que te favoreçam de verdade",
    type: "single",
    pointsType: "key",
    options: [
      { text: "A cintura — adoro peças que marquem", points: { elegante: 3, classica: 1, minimal: 0, romantica: 2 } },
      { text: "Os ombros e a postura — gosto de estrutura", points: { elegante: 3, classica: 2, minimal: 1, romantica: 0 } },
      { text: "Prefiro não marcar — gosto de caimento solto", points: { elegante: 0, classica: 1, minimal: 3, romantica: 1 } },
      { text: "As pernas — saias e vestidos são meu forte", points: { elegante: 1, classica: 0, minimal: 0, romantica: 3 } },
    ],
  },

  // ───────────────────────────────────────────────────
  // 5. DOR PRINCIPAL — O que a frustra ao se vestir
  // ───────────────────────────────────────────────────
  {
    id: 5,
    question: "Qual a sua maior dificuldade na hora de se vestir?",
    subtext: "Entender isso me ajuda a cuidar melhor de você",
    type: "single",
    pointsType: "common",
    options: [
      { text: "Não sei combinar peças — fico insegura", points: { elegante: 0, classica: 3, minimal: 1, romantica: 1 } },
      { text: "Não encontro roupas que valorizem meu corpo", points: { elegante: 2, classica: 1, minimal: 1, romantica: 1 } },
      { text: "Canso de usar sempre a mesma coisa", points: { elegante: 1, classica: 0, minimal: 0, romantica: 3 } },
      { text: "Compro e depois não uso — falta estratégia", points: { elegante: 0, classica: 1, minimal: 3, romantica: 0 } },
    ],
  },

  // ───────────────────────────────────────────────────
  // 6. PEÇA-CHAVE — O que ela mais valoriza no closet
  // ───────────────────────────────────────────────────
  {
    id: 6,
    question: "Se pudesse ter só 3 peças no closet, qual não ficaria de fora?",
    subtext: "A peça essencial diz muito sobre seu estilo",
    type: "single",
    pointsType: "common",
    options: [
      { text: "Blazer bem cortado", points: { elegante: 3, classica: 2, minimal: 1, romantica: 0 } },
      { text: "Jeans perfeito + camisa atemporal", points: { elegante: 0, classica: 3, minimal: 2, romantica: 0 } },
      { text: "Conjunto confortável e estiloso", points: { elegante: 0, classica: 0, minimal: 3, romantica: 1 } },
      { text: "Vestido que funciona pra tudo", points: { elegante: 1, classica: 1, minimal: 0, romantica: 3 } },
    ],
  },

  // ───────────────────────────────────────────────────
  // 7. ESTAMPAS & TEXTURAS — Nível de ousadia
  // ───────────────────────────────────────────────────
  {
    id: 7,
    question: "Qual a sua relação com estampas?",
    subtext: "Isso define o nível de ousadia da sua curadoria",
    type: "single",
    pointsType: "common",
    options: [
      { text: "Prefiro peças lisas — a elegância está no corte", points: { elegante: 3, classica: 1, minimal: 2, romantica: 0 } },
      { text: "Gosto de listras, poá e estampas clássicas", points: { elegante: 1, classica: 3, minimal: 0, romantica: 1 } },
      { text: "Adoro — floral, animal print, estampa colorida", points: { elegante: 0, classica: 0, minimal: 0, romantica: 3 } },
      { text: "Gosto de textura — tricot, linho, couro, tule", points: { elegante: 1, classica: 1, minimal: 3, romantica: 1 } },
    ],
  },

  // ───────────────────────────────────────────────────
  // 8. FOTOS — Referências visuais
  // ───────────────────────────────────────────────────
  {
    id: 8,
    question: "Tem algum look que te inspira?",
    subtext: "Envie uma referência — isso me ajuda a entender você ainda melhor",
    type: "photos",
    pointsType: "photos",
  },

  // ───────────────────────────────────────────────────
  // 9. CAMPO LIVRE — A cliente fala com a consultora
  // ───────────────────────────────────────────────────
  {
    id: 9,
    question: "Quer me contar mais sobre o que procura?",
    subtext: "Quanto mais eu souber, mais precisa será a sua curadoria",
    type: "open",
    pointsType: "open",
  },

  // ───────────────────────────────────────────────────
  // 10. TAMANHO — Para filtrar peças disponíveis
  // ───────────────────────────────────────────────────
  {
    id: 10,
    question: "Qual é o seu tamanho?",
    subtext: "Vou selecionar apenas peças disponíveis na sua numeração",
    type: "size",
    pointsType: "key",
  },
];

export const LETTER_SIZES = ["PP", "P", "M", "G", "GG"];
export const NUMBER_SIZES = ["34", "36", "38", "40", "42", "44", "46"];

export interface StyleProfileV2 {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  highlights: string[];
  valorizes: string[];
  tags: string[];
  emoji: string;
  colorPalette: string[];
  keyPieces: string[];
}

export const styleProfilesV2: Record<string, StyleProfileV2> = {
  elegante: {
    id: "elegante",
    title: "Elegante Estratégica",
    subtitle: "Poder e sofisticação em cada detalhe",
    description: "Você transmite confiança e autoridade sem dizer uma palavra. Suas escolhas são intencionais — cada peça é um statement. Você sabe que a roupa certa abre portas, e busca qualidade, corte impecável e presença.",
    highlights: [
      "Você valoriza qualidade sobre quantidade",
      "Seu olhar é atraído por cortes impecáveis e acabamento nobre",
      "A roupa é sua ferramenta de poder e expressão"
    ],
    valorizes: ["estrutura", "acabamento impecável", "tecidos nobres", "cores fortes e sóbrias"],
    tags: ["elegante", "power", "luxo", "trabalho", "sofisticada"],
    emoji: "",
    colorPalette: ["preto", "branco", "marinho", "dourado", "vermelho escuro"],
    keyPieces: ["Blazer estruturado", "Scarpin clássico", "Bolsa de couro", "Calça de alfaiataria"],
  },
  classica: {
    id: "classica",
    title: "Clássica Moderna",
    subtitle: "Atemporal com um toque contemporâneo",
    description: "Você constrói um guarda-roupa com intenção. Prefere peças que atravessam temporadas a tendências passageiras. Seu estilo é uma curadoria inteligente — cada peça combina com as outras, e vestir-se é simples porque tudo funciona junto.",
    highlights: [
      "Seu closet é curado com estratégia — nada ali é acidente",
      "Elegância discreta é sua marca registrada",
      "Você investe em peças que duram anos, não semanas"
    ],
    valorizes: ["versatilidade", "cortes clean", "paleta neutra e harmônica", "peças atemporais"],
    tags: ["clássico", "atemporal", "neutro", "trabalho", "curado"],
    emoji: "",
    colorPalette: ["bege", "marinho", "branco", "caramelo", "cinza"],
    keyPieces: ["Camisa branca", "Calça de alfaiataria", "Trench coat", "Scarpin nude"],
  },
  minimal: {
    id: "minimal",
    title: "Chic Minimal",
    subtitle: "Menos é mais — e você prova isso todos os dias",
    description: "Você encontra beleza na simplicidade e conforto no que é bem pensado. Cortes limpos, cores neutras e uma curadoria intencional definem quem você é. Seu visual parece fácil, mas por trás tem uma mulher que sabe exatamente o que quer.",
    highlights: [
      "Praticidade e estilo caminham juntos na sua vida",
      "Você prefere menos peças, mas que todas conversem entre si",
      "Conforto não é abrir mão de estilo — é seu superpoder"
    ],
    valorizes: ["conforto inteligente", "silhueta relaxada", "tecidos macios de qualidade", "funcionalidade"],
    tags: ["minimal", "moderno", "versátil", "confortável", "clean"],
    emoji: "",
    colorPalette: ["branco", "cinza", "bege", "oliva", "terracota"],
    keyPieces: ["T-shirt premium", "Jeans reto perfeito", "Tênis branco", "Cardigan oversized"],
  },
  romantica: {
    id: "romantica",
    title: "Romântica Contemporânea",
    subtitle: "Delicadeza com personalidade e ousadia",
    description: "Você celebra sua feminilidade com graça e autenticidade. Ama detalhes que contam uma história — um laço, uma estampa, uma textura inesperada. Cores te atraem, movimento te encanta, e você não tem medo de ser vista.",
    highlights: [
      "Detalhes são tudo para você — cada peça conta uma história",
      "Feminilidade é sua forma de expressão e força",
      "Você se permite experimentar, misturar e ousar"
    ],
    valorizes: ["delicadeza", "movimento fluido", "estampas e cores", "detalhes especiais"],
    tags: ["romântico", "floral", "feminino", "colorido", "ousada"],
    emoji: "",
    colorPalette: ["rosa", "lavanda", "pêssego", "vermelho", "verde esmeralda"],
    keyPieces: ["Vestido midi", "Saia fluida", "Blusa com detalhes", "Acessórios statement"],
  },
};

export function calculateStyleProfileV2(answers: { points: { elegante: number; classica: number; minimal: number; romantica: number } }[]): StyleProfileV2 {
  const totals = { elegante: 0, classica: 0, minimal: 0, romantica: 0 };

  answers.forEach(answer => {
    if (answer.points) {
      totals.elegante += answer.points.elegante || 0;
      totals.classica += answer.points.classica || 0;
      totals.minimal += answer.points.minimal || 0;
      totals.romantica += answer.points.romantica || 0;
    }
  });

  const winner = Object.entries(totals).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
  return styleProfilesV2[winner as keyof typeof styleProfilesV2];
}

import { getTierFromPoints, LOYALTY_TIERS } from "./loyaltyConfig";

// Level thresholds exported for progress calculations
export const LEVEL_THRESHOLDS = [
  LOYALTY_TIERS.poa.minPoints,
  LOYALTY_TIERS.poa_gold.minPoints,
  LOYALTY_TIERS.poa_platinum.minPoints,
  LOYALTY_TIERS.poa_black.minPoints
];

export const LEVEL_TITLES = [
  LOYALTY_TIERS.poa.name,
  LOYALTY_TIERS.poa_gold.name,
  LOYALTY_TIERS.poa_platinum.name,
  LOYALTY_TIERS.poa_black.name
];

export function getLevelFromPoints(points: number): { level: number; title: string; nextLevel: number; minPoints: number } {
  const tier = getTierFromPoints(points);

  if (tier.id === "poa_black") return { level: 3, title: tier.name, nextLevel: 99999, minPoints: tier.minPoints };
  if (tier.id === "poa_platinum") return { level: 2, title: tier.name, nextLevel: LOYALTY_TIERS.poa_black.minPoints, minPoints: tier.minPoints };
  if (tier.id === "poa_gold") return { level: 1, title: tier.name, nextLevel: LOYALTY_TIERS.poa_platinum.minPoints, minPoints: tier.minPoints };

  return { level: 0, title: LOYALTY_TIERS.poa.name, nextLevel: LOYALTY_TIERS.poa_gold.minPoints, minPoints: 0 };
}

export function getQuestionPoints(pointsType: "common" | "key" | "photos" | "open"): number {
  if (pointsType === "key") return 20;
  if (pointsType === "open") return OPEN_FIELD_BONUS;
  if (pointsType === "photos") return 0;
  return 10;
}

export const OPEN_FIELD_BONUS = 30;
export const PHOTO_UPLOAD_BONUS = 50;
