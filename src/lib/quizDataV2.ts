export interface QuizQuestionV2 {
  id: number;
  question: string;
  subtext?: string;
  type: "single" | "size" | "open" | "photos";
  pointsType: "common" | "key" | "photos" | "open"; // common = +10pts, key = +20pts, photos = +50 each, open = +30
  options?: {
    text: string;
    emoji?: string;
    imageUrl?: string;
    points: { elegante: number; classica: number; minimal: number; romantica: number };
  }[];
}

export const quizQuestionsV2: QuizQuestionV2[] = [
  {
    id: 1,
    question: "Como você se sente mais você?",
    subtext: "Bem-vinda ao seu Provador VIP! ✨",
    type: "single",
    pointsType: "key", // +20pts - key question about style
    options: [
      { text: "Sofisticada e imponente", emoji: "👑", points: { elegante: 3, classica: 1, minimal: 0, romantica: 0 } },
      { text: "Clássica e atemporal", emoji: "✨", points: { elegante: 1, classica: 3, minimal: 1, romantica: 0 } },
      { text: "Simples e descomplicada", emoji: "🤍", points: { elegante: 0, classica: 1, minimal: 3, romantica: 0 } },
      { text: "Delicada e feminina", emoji: "🌸", points: { elegante: 0, classica: 0, minimal: 1, romantica: 3 } },
    ],
  },
  {
    id: 2,
    question: "Qual peça você mais ama no seu closet?",
    subtext: "Vamos descobrir suas favoritas 💕",
    type: "single",
    pointsType: "common", // +10pts
    options: [
      { text: "Blazer estruturado", emoji: "🧥", points: { elegante: 3, classica: 2, minimal: 1, romantica: 0 } },
      { text: "Camisa branca impecável", emoji: "👔", points: { elegante: 1, classica: 3, minimal: 2, romantica: 0 } },
      { text: "Calça de alfaiataria reta", emoji: "👖", points: { elegante: 2, classica: 2, minimal: 3, romantica: 0 } },
      { text: "Vestido midi fluido", emoji: "👗", points: { elegante: 1, classica: 0, minimal: 0, romantica: 3 } },
    ],
  },
  {
    id: 3,
    question: "E o caimento? Você prefere mais...",
    subtext: "Sobre conforto e estilo 💫",
    type: "single",
    pointsType: "common", // +10pts
    options: [
      { text: "Bem ajustado ao corpo", emoji: "💃", points: { elegante: 3, classica: 1, minimal: 0, romantica: 1 } },
      { text: "Na medida certa", emoji: "✅", points: { elegante: 1, classica: 3, minimal: 2, romantica: 1 } },
      { text: "Mais soltinho e confortável", emoji: "☁️", points: { elegante: 0, classica: 1, minimal: 3, romantica: 2 } },
      { text: "Depende do meu humor", emoji: "🎭", points: { elegante: 1, classica: 1, minimal: 1, romantica: 2 } },
    ],
  },
  {
    id: 4,
    question: "Qual cor você mais veste no dia a dia?",
    subtext: "Cores revelam muito sobre você 🎨",
    type: "single",
    pointsType: "common", // +10pts
    options: [
      { text: "Preto, sempre", emoji: "🖤", points: { elegante: 3, classica: 1, minimal: 2, romantica: 0 } },
      { text: "Tons neutros e terrosos", emoji: "🤎", points: { elegante: 1, classica: 2, minimal: 3, romantica: 1 } },
      { text: "Branco e off-white", emoji: "🤍", points: { elegante: 2, classica: 2, minimal: 3, romantica: 1 } },
      { text: "Cores suaves e pastéis", emoji: "💜", points: { elegante: 0, classica: 1, minimal: 0, romantica: 3 } },
    ],
  },
  {
    id: 5,
    question: "Qual acessório define mais você?",
    subtext: "Detalhes fazem a diferença 💎",
    type: "single",
    pointsType: "common", // +10pts
    options: [
      { text: "Relógio elegante", emoji: "⌚", points: { elegante: 3, classica: 2, minimal: 1, romantica: 0 } },
      { text: "Bolsa estruturada", emoji: "👜", points: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
      { text: "Brincos discretos", emoji: "💎", points: { elegante: 1, classica: 1, minimal: 3, romantica: 1 } },
      { text: "Lenço ou echarpe", emoji: "🧣", points: { elegante: 1, classica: 1, minimal: 0, romantica: 3 } },
    ],
  },
  {
    id: 6,
    question: "Como é seu visual no fim de semana?",
    subtext: "Quando você é só você 🌟",
    type: "single",
    pointsType: "common", // +10pts
    options: [
      { text: "Continuo impecável, claro", emoji: "💼", points: { elegante: 3, classica: 2, minimal: 0, romantica: 0 } },
      { text: "Jeans e peças atemporais", emoji: "👖", points: { elegante: 1, classica: 3, minimal: 2, romantica: 0 } },
      { text: "O mais confortável possível", emoji: "😌", points: { elegante: 0, classica: 0, minimal: 3, romantica: 1 } },
      { text: "Vestido leve ou saia fluida", emoji: "👗", points: { elegante: 0, classica: 1, minimal: 0, romantica: 3 } },
    ],
  },
  {
    id: 7,
    question: "Para qual ocasião você quer se sentir incrível?",
    subtext: "Onde você quer brilhar? ✨",
    type: "single",
    pointsType: "key", // +20pts - key question about occasion
    options: [
      { text: "Reuniões e trabalho", emoji: "💼", points: { elegante: 3, classica: 2, minimal: 1, romantica: 0 } },
      { text: "Eventos e festas", emoji: "🎉", points: { elegante: 2, classica: 1, minimal: 0, romantica: 3 } },
      { text: "Dia a dia casual", emoji: "☀️", points: { elegante: 0, classica: 2, minimal: 3, romantica: 1 } },
      { text: "Encontros especiais", emoji: "💕", points: { elegante: 1, classica: 0, minimal: 0, romantica: 3 } },
    ],
  },
  {
    id: 8,
    question: "Envie looks que te inspiram",
    subtext: "Isso ajuda muito a entender seu estilo 📸",
    type: "photos",
    pointsType: "photos", // +50pts per photo
  },
  {
    id: 9,
    question: "Quer me contar mais sobre seu estilo?",
    subtext: "Bônus +30 pontos ✨",
    type: "open",
    pointsType: "open", // +30pts
  },
  {
    id: 10,
    question: "Qual é o seu tamanho?",
    subtext: "Vou sugerir peças disponíveis pra você 🎁",
    type: "size",
    pointsType: "key", // +20pts - key question about size
  },
];

export const LETTER_SIZES = ["PP", "P", "M", "G", "GG"];
export const NUMBER_SIZES = ["34", "36", "38", "40", "42", "44", "46"];

export interface StyleProfileV2 {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  highlights: string[]; // 3 short phrases about the client
  valorizes: string[]; // "Suas melhores escolhas valorizam:"
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
    description: "Você transmite confiança e autoridade. Suas escolhas são intencionais e você sabe exatamente o impacto que quer causar.",
    highlights: [
      "Você valoriza qualidade sobre quantidade",
      "Seu olhar é atraído por cortes impecáveis",
      "Você sabe que a roupa é uma ferramenta de poder"
    ],
    valorizes: ["estrutura", "acabamento impecável", "tecidos nobres"],
    tags: ["elegante", "power", "luxo", "trabalho"],
    emoji: "👑",
    colorPalette: ["preto", "branco", "dourado"],
    keyPieces: ["Blazer estruturado", "Scarpin", "Bolsa de couro"],
  },
  classica: {
    id: "classica",
    title: "Clássica Moderna",
    subtitle: "Atemporal com um toque contemporâneo",
    description: "Você valoriza qualidade e peças que atravessam temporadas. Seu guarda-roupa é um investimento consciente.",
    highlights: [
      "Você prefere peças atemporais a tendências passageiras",
      "Seu closet é curado com intenção",
      "Elegância discreta é sua marca registrada"
    ],
    valorizes: ["versatilidade", "cortes clean", "paleta neutra"],
    tags: ["clássico", "atemporal", "básico", "trabalho"],
    emoji: "✨",
    colorPalette: ["bege", "marinho", "branco"],
    keyPieces: ["Camisa branca", "Calça de alfaiataria", "Trench coat"],
  },
  minimal: {
    id: "minimal",
    title: "Chic Minimal",
    subtitle: "Menos é mais, e você prova isso",
    description: "Você encontra beleza na simplicidade. Cortes limpos, cores neutras e uma curadoria impecável definem seu estilo.",
    highlights: [
      "Você busca leveza e praticidade",
      "Conforto e estilo caminham juntos pra você",
      "Seu visual parece fácil, mas é muito bem pensado"
    ],
    valorizes: ["conforto inteligente", "silhueta relaxada", "tecidos macios"],
    tags: ["minimal", "moderno", "versátil", "confortável"],
    emoji: "🤍",
    colorPalette: ["branco", "cinza", "bege"],
    keyPieces: ["T-shirt premium", "Jeans reto", "Tênis branco"],
  },
  romantica: {
    id: "romantica",
    title: "Romântica Contemporânea",
    subtitle: "Delicadeza com personalidade",
    description: "Você celebra sua feminilidade com graça. Texturas suaves, estampas florais e detalhes delicados contam sua história.",
    highlights: [
      "Você ama detalhes que fazem a diferença",
      "Feminilidade é sua forma de expressão",
      "Texturas e movimento te encantam"
    ],
    valorizes: ["delicadeza", "movimento fluido", "detalhes especiais"],
    tags: ["romântico", "floral", "delicado", "feminino"],
    emoji: "🌸",
    colorPalette: ["rosa", "lavanda", "pêssego"],
    keyPieces: ["Vestido midi", "Saia fluida", "Blusa com laço"],
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

// Level thresholds exported for progress calculations
export const LEVEL_THRESHOLDS = [0, 100, 200, 350, 500];
export const LEVEL_TITLES = ["Descoberta", "Clareza", "Refinamento", "Assinatura", "Provador VIP"];

// NEW LEVEL SYSTEM - Slower progression
// After 8 questions (max ~100pts), user should reach Level 2 max
export function getLevelFromPoints(points: number): { level: number; title: string; nextLevel: number; minPoints: number } {
  if (points >= 500) return { level: 5, title: "Provador VIP", nextLevel: 999, minPoints: 500 };
  if (points >= 350) return { level: 4, title: "Assinatura", nextLevel: 500, minPoints: 350 };
  if (points >= 200) return { level: 3, title: "Refinamento", nextLevel: 350, minPoints: 200 };
  if (points >= 100) return { level: 2, title: "Clareza", nextLevel: 200, minPoints: 100 };
  return { level: 1, title: "Descoberta", nextLevel: 100, minPoints: 0 };
}

// Points calculation helper
export function getQuestionPoints(pointsType: "common" | "key" | "photos" | "open"): number {
  if (pointsType === "key") return 20;
  if (pointsType === "open") return OPEN_FIELD_BONUS;
  if (pointsType === "photos") return 0; // Photos give points per upload, not per question
  return 10;
}

// Open field bonus points
export const OPEN_FIELD_BONUS = 30;

// Photo upload bonus points (per photo)
export const PHOTO_UPLOAD_BONUS = 50;
