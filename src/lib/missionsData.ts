export interface Mission {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  theme: string;
  pointsReward: number; // Bonus for completing entire mission
  tags: string[]; // Tags to add to user profile when completed
  expiresAt?: Date; // For weekly rotating missions
  photoPrompt: string; // Prompt for photo upload step
  questions: MissionQuestion[];
}

export interface MissionQuestion {
  id: number;
  question: string;
  subtext?: string;
  options: {
    text: string;
    emoji?: string;
    styleBonus: { elegante: number; classica: number; minimal: number; romantica: number };
  }[];
}

// Points configuration
export const MISSION_POINTS = {
  perQuestion: 10,
  photoUpload: 50, // For submitting photos
  completionBonus: 20, // Bonus for finishing entire mission
};

// Calculate total possible points for a mission
export function getMissionTotalPoints(mission: Mission): number {
  return (
    mission.questions.length * MISSION_POINTS.perQuestion +
    MISSION_POINTS.photoUpload +
    MISSION_POINTS.completionBonus
  );
}

// Weekly rotating missions - each with 5 questions + optional photos
export const availableMissions: Mission[] = [
  {
    id: "blazer-week",
    title: "Semana do Blazer",
    subtitle: "Descubra o blazer perfeito pra você",
    emoji: "🧥",
    theme: "blazer",
    pointsReward: MISSION_POINTS.completionBonus,
    tags: ["blazer-lover", "power-dressing"],
    photoPrompt: "Envie prints de blazers que você amou ou gostaria de ter",
    questions: [
      {
        id: 1,
        question: "Qual modelagem de blazer mais combina com você?",
        subtext: "Pense no seu dia a dia 💼",
        options: [
          { text: "Oversized e descontraído", emoji: "☁️", styleBonus: { elegante: 0, classica: 1, minimal: 3, romantica: 1 } },
          { text: "Ajustado e estruturado", emoji: "💼", styleBonus: { elegante: 3, classica: 2, minimal: 0, romantica: 0 } },
          { text: "Alongado e elegante", emoji: "✨", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Com detalhes delicados", emoji: "🌸", styleBonus: { elegante: 1, classica: 0, minimal: 0, romantica: 3 } },
        ],
      },
      {
        id: 2,
        question: "Para qual ocasião você mais usaria blazer?",
        subtext: "Onde você quer arrasar? ✨",
        options: [
          { text: "Reuniões importantes", emoji: "📊", styleBonus: { elegante: 3, classica: 2, minimal: 1, romantica: 0 } },
          { text: "Happy hour e eventos", emoji: "🍷", styleBonus: { elegante: 2, classica: 1, minimal: 0, romantica: 2 } },
          { text: "Dia a dia no escritório", emoji: "💻", styleBonus: { elegante: 1, classica: 3, minimal: 2, romantica: 0 } },
          { text: "Final de semana estiloso", emoji: "☀️", styleBonus: { elegante: 0, classica: 1, minimal: 3, romantica: 1 } },
        ],
      },
      {
        id: 3,
        question: "Qual cor de blazer você mais usa ou usaria?",
        subtext: "Cores neutras ou ousadas? 🎨",
        options: [
          { text: "Preto clássico", emoji: "🖤", styleBonus: { elegante: 3, classica: 2, minimal: 2, romantica: 0 } },
          { text: "Bege/caramelo", emoji: "🤎", styleBonus: { elegante: 1, classica: 3, minimal: 2, romantica: 1 } },
          { text: "Cores vibrantes", emoji: "💜", styleBonus: { elegante: 1, classica: 0, minimal: 0, romantica: 2 } },
          { text: "Branco/off-white", emoji: "🤍", styleBonus: { elegante: 2, classica: 1, minimal: 3, romantica: 1 } },
        ],
      },
      {
        id: 4,
        question: "Com o que você combinaria seu blazer ideal?",
        subtext: "Monte o look completo 👗",
        options: [
          { text: "Calça de alfaiataria", emoji: "👖", styleBonus: { elegante: 2, classica: 3, minimal: 2, romantica: 0 } },
          { text: "Jeans bem cortado", emoji: "👖", styleBonus: { elegante: 1, classica: 2, minimal: 3, romantica: 0 } },
          { text: "Vestido fluido", emoji: "👗", styleBonus: { elegante: 1, classica: 0, minimal: 0, romantica: 3 } },
          { text: "Saia lápis", emoji: "✨", styleBonus: { elegante: 3, classica: 2, minimal: 1, romantica: 1 } },
        ],
      },
      {
        id: 5,
        question: "Qual detalhe faria seu blazer especial?",
        subtext: "O toque final ✨",
        options: [
          { text: "Botões dourados", emoji: "✨", styleBonus: { elegante: 3, classica: 2, minimal: 0, romantica: 1 } },
          { text: "Corte limpo, sem detalhes", emoji: "〰️", styleBonus: { elegante: 1, classica: 1, minimal: 3, romantica: 0 } },
          { text: "Lapela diferenciada", emoji: "🎀", styleBonus: { elegante: 2, classica: 3, minimal: 0, romantica: 1 } },
          { text: "Bordados ou aplicações", emoji: "🌸", styleBonus: { elegante: 0, classica: 0, minimal: 0, romantica: 3 } },
        ],
      },
    ],
  },
  {
    id: "work-style",
    title: "Missão Trabalho",
    subtitle: "Refine seu visual profissional",
    emoji: "💼",
    theme: "work",
    pointsReward: MISSION_POINTS.completionBonus,
    tags: ["work-ready", "professional"],
    photoPrompt: "Envie looks de trabalho que você admira ou usa como referência",
    questions: [
      {
        id: 1,
        question: "Como você descreveria o dress code do seu trabalho?",
        subtext: "Cada ambiente tem seu estilo 🏢",
        options: [
          { text: "Formal e sofisticado", emoji: "👔", styleBonus: { elegante: 3, classica: 2, minimal: 0, romantica: 0 } },
          { text: "Smart casual", emoji: "✨", styleBonus: { elegante: 1, classica: 3, minimal: 2, romantica: 0 } },
          { text: "Casual e flexível", emoji: "😊", styleBonus: { elegante: 0, classica: 1, minimal: 3, romantica: 1 } },
          { text: "Criativo e expressivo", emoji: "🎨", styleBonus: { elegante: 1, classica: 0, minimal: 1, romantica: 3 } },
        ],
      },
      {
        id: 2,
        question: "Qual peça você considera essencial pro trabalho?",
        subtext: "Aquela que não pode faltar 👗",
        options: [
          { text: "Calça de alfaiataria", emoji: "👖", styleBonus: { elegante: 2, classica: 3, minimal: 2, romantica: 0 } },
          { text: "Blazer versátil", emoji: "🧥", styleBonus: { elegante: 3, classica: 2, minimal: 1, romantica: 0 } },
          { text: "Vestido elegante", emoji: "👗", styleBonus: { elegante: 2, classica: 1, minimal: 0, romantica: 3 } },
          { text: "Camiseta premium", emoji: "👕", styleBonus: { elegante: 0, classica: 1, minimal: 3, romantica: 1 } },
        ],
      },
      {
        id: 3,
        question: "Reunião importante: qual é sua escolha?",
        subtext: "Hora de impressionar 💪",
        options: [
          { text: "Conjunto alfaiataria", emoji: "✨", styleBonus: { elegante: 3, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Vestido midi elegante", emoji: "👗", styleBonus: { elegante: 2, classica: 1, minimal: 0, romantica: 2 } },
          { text: "Blazer + calça jeans", emoji: "👖", styleBonus: { elegante: 1, classica: 2, minimal: 3, romantica: 0 } },
          { text: "Saia + blusa estruturada", emoji: "💼", styleBonus: { elegante: 2, classica: 2, minimal: 1, romantica: 2 } },
        ],
      },
      {
        id: 4,
        question: "Como você prefere seus sapatos de trabalho?",
        subtext: "Conforto ou estilo? (ou ambos!) 👠",
        options: [
          { text: "Scarpin clássico", emoji: "👠", styleBonus: { elegante: 3, classica: 2, minimal: 0, romantica: 1 } },
          { text: "Mocassim ou loafer", emoji: "👞", styleBonus: { elegante: 1, classica: 3, minimal: 2, romantica: 0 } },
          { text: "Tênis elegante", emoji: "👟", styleBonus: { elegante: 0, classica: 1, minimal: 3, romantica: 0 } },
          { text: "Sandália delicada", emoji: "🩴", styleBonus: { elegante: 1, classica: 0, minimal: 1, romantica: 3 } },
        ],
      },
      {
        id: 5,
        question: "Qual acessório completa seu look profissional?",
        subtext: "O detalhe que faz diferença 💎",
        options: [
          { text: "Relógio sofisticado", emoji: "⌚", styleBonus: { elegante: 3, classica: 2, minimal: 1, romantica: 0 } },
          { text: "Bolsa estruturada", emoji: "👜", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Brincos discretos", emoji: "✨", styleBonus: { elegante: 1, classica: 2, minimal: 2, romantica: 2 } },
          { text: "Lenço ou echarpe", emoji: "🧣", styleBonus: { elegante: 1, classica: 1, minimal: 0, romantica: 3 } },
        ],
      },
    ],
  },
  {
    id: "weekend-vibes",
    title: "Missão Fim de Semana",
    subtitle: "Seu estilo quando você é só você",
    emoji: "☀️",
    theme: "casual",
    pointsReward: MISSION_POINTS.completionBonus,
    tags: ["weekend-ready", "casual-chic"],
    photoPrompt: "Envie fotos de looks de fim de semana que você ama",
    questions: [
      {
        id: 1,
        question: "O que você mais valoriza num look de fim de semana?",
        subtext: "Quando não tem compromisso formal 🌿",
        options: [
          { text: "Conforto acima de tudo", emoji: "☁️", styleBonus: { elegante: 0, classica: 1, minimal: 3, romantica: 1 } },
          { text: "Estilo mesmo relaxando", emoji: "✨", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Feminilidade e leveza", emoji: "🌸", styleBonus: { elegante: 1, classica: 0, minimal: 0, romantica: 3 } },
          { text: "Prática e versátil", emoji: "👍", styleBonus: { elegante: 1, classica: 2, minimal: 3, romantica: 0 } },
        ],
      },
      {
        id: 2,
        question: "Qual combinação é a sua cara?",
        subtext: "Aquela que você monta de olhos fechados 👀",
        options: [
          { text: "Jeans + t-shirt premium", emoji: "👖", styleBonus: { elegante: 1, classica: 2, minimal: 3, romantica: 0 } },
          { text: "Vestido fluido + rasteirinha", emoji: "👗", styleBonus: { elegante: 1, classica: 0, minimal: 0, romantica: 3 } },
          { text: "Calça wide + blusa elegante", emoji: "✨", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Saia midi + tênis", emoji: "👟", styleBonus: { elegante: 0, classica: 1, minimal: 2, romantica: 2 } },
        ],
      },
      {
        id: 3,
        question: "Brunch com amigas: o que você veste?",
        subtext: "Look para curtir e tirar foto 📸",
        options: [
          { text: "Vestido midi estampado", emoji: "🌺", styleBonus: { elegante: 1, classica: 1, minimal: 0, romantica: 3 } },
          { text: "Calça + cropped elegante", emoji: "✨", styleBonus: { elegante: 2, classica: 2, minimal: 2, romantica: 0 } },
          { text: "Jeans + blazer leve", emoji: "🧥", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Macacão confortável", emoji: "👗", styleBonus: { elegante: 0, classica: 1, minimal: 3, romantica: 1 } },
        ],
      },
      {
        id: 4,
        question: "Qual é sua bolsa de fim de semana favorita?",
        subtext: "Prática, grande, pequena...? 👜",
        options: [
          { text: "Bolsa grande e espaçosa", emoji: "🛍️", styleBonus: { elegante: 1, classica: 2, minimal: 2, romantica: 0 } },
          { text: "Crossbody compacta", emoji: "👜", styleBonus: { elegante: 1, classica: 1, minimal: 3, romantica: 1 } },
          { text: "Bucket bag", emoji: "🪣", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Clutch delicada", emoji: "✨", styleBonus: { elegante: 2, classica: 0, minimal: 0, romantica: 3 } },
        ],
      },
      {
        id: 5,
        question: "Seu tênis ideal para o fim de semana?",
        subtext: "Conforto com estilo 👟",
        options: [
          { text: "Branco minimalista", emoji: "🤍", styleBonus: { elegante: 1, classica: 2, minimal: 3, romantica: 0 } },
          { text: "Colorido ou estampado", emoji: "🌈", styleBonus: { elegante: 0, classica: 0, minimal: 0, romantica: 3 } },
          { text: "Chunky/plataforma", emoji: "✨", styleBonus: { elegante: 2, classica: 1, minimal: 1, romantica: 1 } },
          { text: "Clássico tipo Converse", emoji: "⭐", styleBonus: { elegante: 0, classica: 3, minimal: 2, romantica: 1 } },
        ],
      },
    ],
  },
  {
    id: "color-discovery",
    title: "Missão Cores",
    subtitle: "Descubra sua paleta ideal",
    emoji: "🎨",
    theme: "colors",
    pointsReward: MISSION_POINTS.completionBonus,
    tags: ["color-confident", "palette-defined"],
    photoPrompt: "Envie peças com cores que você ama vestir ou quer experimentar",
    questions: [
      {
        id: 1,
        question: "Qual paleta te atrai mais?",
        subtext: "Pense nas cores que você mais veste 🌈",
        options: [
          { text: "Preto, branco e cinza", emoji: "🖤", styleBonus: { elegante: 3, classica: 1, minimal: 3, romantica: 0 } },
          { text: "Bege, caramelo e off-white", emoji: "🤎", styleBonus: { elegante: 1, classica: 3, minimal: 2, romantica: 1 } },
          { text: "Rosa, lavanda e pêssego", emoji: "💜", styleBonus: { elegante: 0, classica: 0, minimal: 0, romantica: 3 } },
          { text: "Azul, verde e terrosos", emoji: "🌿", styleBonus: { elegante: 1, classica: 2, minimal: 2, romantica: 1 } },
        ],
      },
      {
        id: 2,
        question: "Que tipo de estampa você prefere?",
        subtext: "Ou prefere liso mesmo? 🤔",
        options: [
          { text: "Prefiro tons lisos", emoji: "⬜", styleBonus: { elegante: 2, classica: 2, minimal: 3, romantica: 0 } },
          { text: "Listras e geométricos", emoji: "📐", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Florais delicados", emoji: "🌸", styleBonus: { elegante: 0, classica: 1, minimal: 0, romantica: 3 } },
          { text: "Animal print sutil", emoji: "🐆", styleBonus: { elegante: 3, classica: 1, minimal: 0, romantica: 1 } },
        ],
      },
      {
        id: 3,
        question: "Cor que você nunca usaria?",
        subtext: "Todo mundo tem uma 🙅‍♀️",
        options: [
          { text: "Cores neon/chamativas", emoji: "💚", styleBonus: { elegante: 2, classica: 3, minimal: 2, romantica: 1 } },
          { text: "Tons pastéis", emoji: "🩷", styleBonus: { elegante: 2, classica: 1, minimal: 2, romantica: 0 } },
          { text: "Preto total", emoji: "🖤", styleBonus: { elegante: 0, classica: 0, minimal: 0, romantica: 3 } },
          { text: "Neutros demais", emoji: "🤎", styleBonus: { elegante: 1, classica: 0, minimal: 0, romantica: 2 } },
        ],
      },
      {
        id: 4,
        question: "Qual cor você gostaria de usar mais?",
        subtext: "Aquela que você admira mas não ousa 👀",
        options: [
          { text: "Vermelho poderoso", emoji: "❤️", styleBonus: { elegante: 3, classica: 1, minimal: 0, romantica: 1 } },
          { text: "Azul profundo", emoji: "💙", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Verde vibrante", emoji: "💚", styleBonus: { elegante: 1, classica: 2, minimal: 2, romantica: 1 } },
          { text: "Rosa intenso", emoji: "💗", styleBonus: { elegante: 1, classica: 0, minimal: 0, romantica: 3 } },
        ],
      },
      {
        id: 5,
        question: "Como você monta um look colorido?",
        subtext: "Sua estratégia com cores 🎨",
        options: [
          { text: "Uma peça colorida + neutros", emoji: "⚫", styleBonus: { elegante: 2, classica: 3, minimal: 2, romantica: 0 } },
          { text: "Total color: uma cor só", emoji: "🟣", styleBonus: { elegante: 3, classica: 1, minimal: 1, romantica: 1 } },
          { text: "Mix de tons próximos", emoji: "🌈", styleBonus: { elegante: 1, classica: 2, minimal: 3, romantica: 1 } },
          { text: "Cores contrastantes", emoji: "✨", styleBonus: { elegante: 1, classica: 0, minimal: 0, romantica: 3 } },
        ],
      },
    ],
  },
  {
    id: "special-occasions",
    title: "Missão Ocasiões Especiais",
    subtitle: "Brilhe em momentos importantes",
    emoji: "✨",
    theme: "events",
    pointsReward: MISSION_POINTS.completionBonus,
    tags: ["event-ready", "celebration-style"],
    photoPrompt: "Envie looks de festa ou eventos especiais que você amou",
    questions: [
      {
        id: 1,
        question: "Para um jantar especial, você escolheria...",
        subtext: "Aquele momento pra impressionar 🍷",
        options: [
          { text: "Vestido elegante e estruturado", emoji: "👗", styleBonus: { elegante: 3, classica: 2, minimal: 0, romantica: 1 } },
          { text: "Conjunto sofisticado", emoji: "✨", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Look monocromático chic", emoji: "🖤", styleBonus: { elegante: 1, classica: 1, minimal: 3, romantica: 0 } },
          { text: "Vestido fluido e romântico", emoji: "🌸", styleBonus: { elegante: 0, classica: 0, minimal: 0, romantica: 3 } },
        ],
      },
      {
        id: 2,
        question: "Qual acessório completa seu look especial?",
        subtext: "O toque final ✨",
        options: [
          { text: "Joias statement", emoji: "💎", styleBonus: { elegante: 3, classica: 1, minimal: 0, romantica: 1 } },
          { text: "Bolsa clássica de qualidade", emoji: "👜", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Acessórios minimalistas", emoji: "〰️", styleBonus: { elegante: 1, classica: 1, minimal: 3, romantica: 0 } },
          { text: "Detalhes delicados e femininos", emoji: "🎀", styleBonus: { elegante: 0, classica: 0, minimal: 0, romantica: 3 } },
        ],
      },
      {
        id: 3,
        question: "Casamento: qual é seu estilo?",
        subtext: "Look de convidada perfeito 💒",
        options: [
          { text: "Vestido midi elegante", emoji: "👗", styleBonus: { elegante: 3, classica: 2, minimal: 1, romantica: 1 } },
          { text: "Conjunto com alfaiataria", emoji: "✨", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Vestido longo fluido", emoji: "🌸", styleBonus: { elegante: 1, classica: 1, minimal: 0, romantica: 3 } },
          { text: "Jumpsuit sofisticado", emoji: "💫", styleBonus: { elegante: 2, classica: 1, minimal: 3, romantica: 0 } },
        ],
      },
      {
        id: 4,
        question: "Qual salto você prefere em eventos?",
        subtext: "Conforto vs altura? 👠",
        options: [
          { text: "Stiletto alto", emoji: "👠", styleBonus: { elegante: 3, classica: 1, minimal: 0, romantica: 1 } },
          { text: "Bloco confortável", emoji: "👡", styleBonus: { elegante: 1, classica: 3, minimal: 2, romantica: 0 } },
          { text: "Mule elegante", emoji: "✨", styleBonus: { elegante: 2, classica: 2, minimal: 3, romantica: 0 } },
          { text: "Sandália com amarração", emoji: "🩴", styleBonus: { elegante: 0, classica: 0, minimal: 0, romantica: 3 } },
        ],
      },
      {
        id: 5,
        question: "Seu make em ocasiões especiais?",
        subtext: "Complementa o look 💄",
        options: [
          { text: "Batom vermelho marcante", emoji: "💋", styleBonus: { elegante: 3, classica: 2, minimal: 0, romantica: 0 } },
          { text: "Olho marcado + boca nude", emoji: "👁️", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Natural e iluminado", emoji: "✨", styleBonus: { elegante: 1, classica: 1, minimal: 3, romantica: 1 } },
          { text: "Rosa romântico", emoji: "🌸", styleBonus: { elegante: 0, classica: 0, minimal: 0, romantica: 3 } },
        ],
      },
    ],
  },
];

// Kept for backwards compatibility
export const MISSION_POINTS_REWARD = MISSION_POINTS.completionBonus + (5 * MISSION_POINTS.perQuestion);

// Get missions that user hasn't completed yet
export function getAvailableMissions(completedMissionIds: string[]): Mission[] {
  return availableMissions.filter(m => !completedMissionIds.includes(m.id));
}

// Get mission by ID
export function getMissionById(missionId: string): Mission | undefined {
  return availableMissions.find(m => m.id === missionId);
}

// Check if user can redo mission (7 days since last completion)
export function canRedoMission(lastCompletedAt: Date | null): boolean {
  if (!lastCompletedAt) return true;
  const daysSince = Math.floor((Date.now() - new Date(lastCompletedAt).getTime()) / (1000 * 60 * 60 * 24));
  return daysSince >= 7;
}
