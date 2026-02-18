import { MissionQuestion } from "./missionsData";

export interface Mission {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  theme: string;
  pointsReward: number;
  tags: string[];
  expiresAt?: Date;
  photoPrompt: string;
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
  photoUpload: 50,
  completionBonus: 20,
};

// Calculate total possible points for a mission
export function getMissionTotalPoints(mission: Mission): number {
  return (
    mission.questions.length * MISSION_POINTS.perQuestion +
    MISSION_POINTS.photoUpload +
    MISSION_POINTS.completionBonus
  );
}

// ─── MISSIONS ────────────────────────────────────────────────────
// Each mission is a 5-question deep-dive into a specific style area
// to further refine the client's profile and give better suggestions.

export const availableMissions: Mission[] = [
  // ─── BLAZER ────────────────────────────────────────────────
  {
    id: "blazer-week",
    title: "O Blazer Perfeito",
    subtitle: "Descubra qual modelagem e styling combinam com você",
    emoji: "",
    theme: "blazer",
    pointsReward: MISSION_POINTS.completionBonus,
    tags: ["blazer-lover", "power-dressing"],
    photoPrompt: "Envie referências de blazers que te atraem ou que gostaria de ter",
    questions: [
      {
        id: 1,
        question: "Qual modelagem de blazer combina mais com você?",
        subtext: "A modelagem certa muda tudo",
        options: [
          { text: "Oversized e descontraído", styleBonus: { elegante: 0, classica: 1, minimal: 3, romantica: 1 } },
          { text: "Ajustado e estruturado", styleBonus: { elegante: 3, classica: 2, minimal: 0, romantica: 0 } },
          { text: "Alongado — abaixo do quadril", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Com detalhes femininos como laço ou pregas", styleBonus: { elegante: 1, classica: 0, minimal: 0, romantica: 3 } },
        ],
      },
      {
        id: 2,
        question: "Para qual momento você mais usaria blazer?",
        subtext: "Vou sugerir o blazer certo para essa ocasião",
        options: [
          { text: "Reuniões importantes e apresentações", styleBonus: { elegante: 3, classica: 2, minimal: 1, romantica: 0 } },
          { text: "Happy hour e eventos casuais", styleBonus: { elegante: 2, classica: 1, minimal: 0, romantica: 2 } },
          { text: "Dia a dia no escritório", styleBonus: { elegante: 1, classica: 3, minimal: 2, romantica: 0 } },
          { text: "Fim de semana com estilo", styleBonus: { elegante: 0, classica: 1, minimal: 3, romantica: 1 } },
        ],
      },
      {
        id: 3,
        question: "Qual cor de blazer te atrai mais?",
        subtext: "A cor define todo o impacto da peça",
        options: [
          { text: "Preto clássico — sempre seguro", styleBonus: { elegante: 3, classica: 2, minimal: 2, romantica: 0 } },
          { text: "Bege ou caramelo — neutro e sofisticado", styleBonus: { elegante: 1, classica: 3, minimal: 2, romantica: 1 } },
          { text: "Cores vibrantes — vermelho, azul, verde", styleBonus: { elegante: 1, classica: 0, minimal: 0, romantica: 2 } },
          { text: "Branco ou off-white — leveza e modernidade", styleBonus: { elegante: 2, classica: 1, minimal: 3, romantica: 1 } },
        ],
      },
      {
        id: 4,
        question: "Com o que você combinaria seu blazer ideal?",
        subtext: "A composição completa o look",
        options: [
          { text: "Calça de alfaiataria", styleBonus: { elegante: 2, classica: 3, minimal: 2, romantica: 0 } },
          { text: "Jeans bem cortado", styleBonus: { elegante: 1, classica: 2, minimal: 3, romantica: 0 } },
          { text: "Vestido fluido", styleBonus: { elegante: 1, classica: 0, minimal: 0, romantica: 3 } },
          { text: "Saia lápis", styleBonus: { elegante: 3, classica: 2, minimal: 1, romantica: 1 } },
        ],
      },
      {
        id: 5,
        question: "Qual detalhe faria seu blazer especial?",
        subtext: "O que diferencia uma peça comum de uma peça sua",
        options: [
          { text: "Botões dourados ou detalhes metalizados", styleBonus: { elegante: 3, classica: 2, minimal: 0, romantica: 1 } },
          { text: "Nenhum — corte limpo e minimalista", styleBonus: { elegante: 1, classica: 1, minimal: 3, romantica: 0 } },
          { text: "Lapela diferenciada ou corte assimétrico", styleBonus: { elegante: 2, classica: 3, minimal: 0, romantica: 1 } },
          { text: "Bordados, texturas ou aplicações delicadas", styleBonus: { elegante: 0, classica: 0, minimal: 0, romantica: 3 } },
        ],
      },
    ],
  },

  // ─── TRABALHO ──────────────────────────────────────────────
  {
    id: "work-style",
    title: "Seu Visual Profissional",
    subtitle: "Refine seu estilo para o ambiente de trabalho",
    emoji: "",
    theme: "work",
    pointsReward: MISSION_POINTS.completionBonus,
    tags: ["work-ready", "professional"],
    photoPrompt: "Envie referências de looks de trabalho que você admira",
    questions: [
      {
        id: 1,
        question: "Como é o dress code do seu trabalho?",
        subtext: "Cada ambiente pede uma abordagem diferente",
        options: [
          { text: "Formal e sofisticado", styleBonus: { elegante: 3, classica: 2, minimal: 0, romantica: 0 } },
          { text: "Smart casual — elegante mas relaxado", styleBonus: { elegante: 1, classica: 3, minimal: 2, romantica: 0 } },
          { text: "Casual e flexível", styleBonus: { elegante: 0, classica: 1, minimal: 3, romantica: 1 } },
          { text: "Criativo e expressivo", styleBonus: { elegante: 1, classica: 0, minimal: 1, romantica: 3 } },
        ],
      },
      {
        id: 2,
        question: "Qual peça não pode faltar no seu closet de trabalho?",
        subtext: "A base do seu guarda-roupa profissional",
        options: [
          { text: "Calça de alfaiataria bem cortada", styleBonus: { elegante: 2, classica: 3, minimal: 2, romantica: 0 } },
          { text: "Blazer que funciona com tudo", styleBonus: { elegante: 3, classica: 2, minimal: 1, romantica: 0 } },
          { text: "Vestido midi que resolve o look", styleBonus: { elegante: 2, classica: 1, minimal: 0, romantica: 3 } },
          { text: "Camiseta premium — básico elevado", styleBonus: { elegante: 0, classica: 1, minimal: 3, romantica: 1 } },
        ],
      },
      {
        id: 3,
        question: "Reunião importante amanhã. O que você veste?",
        subtext: "A roupa certa te dá confiança antes de abrir a boca",
        options: [
          { text: "Conjunto alfaiataria — impecável", styleBonus: { elegante: 3, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Vestido midi elegante e estruturado", styleBonus: { elegante: 2, classica: 1, minimal: 0, romantica: 2 } },
          { text: "Blazer com jeans premium", styleBonus: { elegante: 1, classica: 2, minimal: 3, romantica: 0 } },
          { text: "Saia e blusa bem combinadas", styleBonus: { elegante: 2, classica: 2, minimal: 1, romantica: 2 } },
        ],
      },
      {
        id: 4,
        question: "Qual sapato te leva do escritório ao happy hour?",
        subtext: "Versatilidade sem abrir mão de estilo",
        options: [
          { text: "Scarpin clássico", styleBonus: { elegante: 3, classica: 2, minimal: 0, romantica: 1 } },
          { text: "Mocassim ou loafer de couro", styleBonus: { elegante: 1, classica: 3, minimal: 2, romantica: 0 } },
          { text: "Tênis elegante — conforto com estilo", styleBonus: { elegante: 0, classica: 1, minimal: 3, romantica: 0 } },
          { text: "Sandália com salto médio", styleBonus: { elegante: 1, classica: 0, minimal: 1, romantica: 3 } },
        ],
      },
      {
        id: 5,
        question: "Qual acessório completa seu visual profissional?",
        subtext: "O detalhe que mostra quem você é sem exagerar",
        options: [
          { text: "Relógio sofisticado", styleBonus: { elegante: 3, classica: 2, minimal: 1, romantica: 0 } },
          { text: "Bolsa estruturada de couro", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Brincos discretos e delicados", styleBonus: { elegante: 1, classica: 2, minimal: 2, romantica: 2 } },
          { text: "Lenço de seda no pescoço", styleBonus: { elegante: 1, classica: 1, minimal: 0, romantica: 3 } },
        ],
      },
    ],
  },

  // ─── FIM DE SEMANA ─────────────────────────────────────────
  {
    id: "weekend-vibes",
    title: "Seu Estilo no Fim de Semana",
    subtitle: "Como você se veste quando é só para se sentir bem",
    emoji: "",
    theme: "casual",
    pointsReward: MISSION_POINTS.completionBonus,
    tags: ["weekend-ready", "casual-chic"],
    photoPrompt: "Envie fotos de looks de fim de semana que você ama ou gostaria de experimentar",
    questions: [
      {
        id: 1,
        question: "O que você mais valoriza num look de lazer?",
        subtext: "Quando não tem compromisso formal",
        options: [
          { text: "Conforto acima de tudo", styleBonus: { elegante: 0, classica: 1, minimal: 3, romantica: 1 } },
          { text: "Quero estar bem vestida mesmo relaxando", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Feminilidade e leveza", styleBonus: { elegante: 1, classica: 0, minimal: 0, romantica: 3 } },
          { text: "Praticidade — vestir rápido e sair", styleBonus: { elegante: 1, classica: 2, minimal: 3, romantica: 0 } },
        ],
      },
      {
        id: 2,
        question: "Qual combinação é a sua cara?",
        subtext: "Aquela que você monta de olhos fechados",
        options: [
          { text: "Jeans reto e camiseta premium", styleBonus: { elegante: 1, classica: 2, minimal: 3, romantica: 0 } },
          { text: "Vestido fluido e rasteirinha de couro", styleBonus: { elegante: 1, classica: 0, minimal: 0, romantica: 3 } },
          { text: "Calça wide e blusa elegante", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Saia midi e tênis branco", styleBonus: { elegante: 0, classica: 1, minimal: 2, romantica: 2 } },
        ],
      },
      {
        id: 3,
        question: "Brunch com amigas — o que você veste?",
        subtext: "Look para se divertir e se sentir bonita",
        options: [
          { text: "Vestido midi com estampa sutil", styleBonus: { elegante: 1, classica: 1, minimal: 0, romantica: 3 } },
          { text: "Calça e blusa elegante", styleBonus: { elegante: 2, classica: 2, minimal: 2, romantica: 0 } },
          { text: "Jeans, blazer leve e sapatilha", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Conjunto confortável e estiloso", styleBonus: { elegante: 0, classica: 1, minimal: 3, romantica: 1 } },
        ],
      },
      {
        id: 4,
        question: "Qual é a sua bolsa ideal para o fim de semana?",
        subtext: "Funcionalidade com personalidade",
        options: [
          { text: "Grande e espaçosa — levo tudo comigo", styleBonus: { elegante: 1, classica: 2, minimal: 2, romantica: 0 } },
          { text: "Crossbody compacta — só o essencial", styleBonus: { elegante: 1, classica: 1, minimal: 3, romantica: 1 } },
          { text: "Bolsa de couro estruturada", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Clutch ou bolsa delicada", styleBonus: { elegante: 2, classica: 0, minimal: 0, romantica: 3 } },
        ],
      },
      {
        id: 5,
        question: "Seu calçado favorito para dias livres?",
        subtext: "O que seus pés escolhem quando são livres",
        options: [
          { text: "Tênis branco minimalista", styleBonus: { elegante: 1, classica: 2, minimal: 3, romantica: 0 } },
          { text: "Sandália colorida ou estampada", styleBonus: { elegante: 0, classica: 0, minimal: 0, romantica: 3 } },
          { text: "Plataforma ou chunky sneaker", styleBonus: { elegante: 2, classica: 1, minimal: 1, romantica: 1 } },
          { text: "Mocassim ou loafer", styleBonus: { elegante: 0, classica: 3, minimal: 2, romantica: 1 } },
        ],
      },
    ],
  },

  // ─── CORES ─────────────────────────────────────────────────
  {
    id: "color-discovery",
    title: "Sua Paleta Pessoal",
    subtitle: "Descubra as cores que mais te valorizam",
    emoji: "",
    theme: "colors",
    pointsReward: MISSION_POINTS.completionBonus,
    tags: ["color-confident", "palette-defined"],
    photoPrompt: "Envie fotos de peças ou looks com cores que te atraem",
    questions: [
      {
        id: 1,
        question: "Qual paleta mais te representa?",
        subtext: "As cores que dominam o seu closet",
        options: [
          { text: "Preto, branco e cinza — seguro e sofisticado", styleBonus: { elegante: 3, classica: 1, minimal: 3, romantica: 0 } },
          { text: "Bege, caramelo e off-white — quente e acolhedor", styleBonus: { elegante: 1, classica: 3, minimal: 2, romantica: 1 } },
          { text: "Rosa, lavanda e pêssego — suave e feminino", styleBonus: { elegante: 0, classica: 0, minimal: 0, romantica: 3 } },
          { text: "Azul, verde e terrosos — natural e moderno", styleBonus: { elegante: 1, classica: 2, minimal: 2, romantica: 1 } },
        ],
      },
      {
        id: 2,
        question: "Qual a sua relação com estampas coloridas?",
        subtext: "Isso define o nível de ousadia da sua curadoria",
        options: [
          { text: "Prefiro tons lisos — a cor fala por si", styleBonus: { elegante: 2, classica: 2, minimal: 3, romantica: 0 } },
          { text: "Gosto de listras e geométricos clássicos", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Adoro florais delicados", styleBonus: { elegante: 0, classica: 1, minimal: 0, romantica: 3 } },
          { text: "Curto animal print e estampas marcantes", styleBonus: { elegante: 3, classica: 1, minimal: 0, romantica: 1 } },
        ],
      },
      {
        id: 3,
        question: "Tem alguma cor que você evita?",
        subtext: "Importante saber isso para a sua curadoria",
        options: [
          { text: "Cores neon e muito chamativas", styleBonus: { elegante: 2, classica: 3, minimal: 2, romantica: 1 } },
          { text: "Tons pastéis — acho que não combinam comigo", styleBonus: { elegante: 2, classica: 1, minimal: 2, romantica: 0 } },
          { text: "Preto total — acho pesado demais", styleBonus: { elegante: 0, classica: 0, minimal: 0, romantica: 3 } },
          { text: "Neutros demais — quero mais vida", styleBonus: { elegante: 1, classica: 0, minimal: 0, romantica: 2 } },
        ],
      },
      {
        id: 4,
        question: "Qual cor você gostaria de usar com mais confiança?",
        subtext: "Aquela que te atrai mas você ainda não ousou",
        options: [
          { text: "Vermelho — poderoso e marcante", styleBonus: { elegante: 3, classica: 1, minimal: 0, romantica: 1 } },
          { text: "Azul profundo — elegância discreta", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Verde — sofisticação natural", styleBonus: { elegante: 1, classica: 2, minimal: 2, romantica: 1 } },
          { text: "Rosa intenso — feminino e ousado", styleBonus: { elegante: 1, classica: 0, minimal: 0, romantica: 3 } },
        ],
      },
      {
        id: 5,
        question: "Como você monta um look colorido?",
        subtext: "A estratégia com cor diz muito sobre seu estilo",
        options: [
          { text: "Uma peça statement e o restante neutro", styleBonus: { elegante: 2, classica: 3, minimal: 2, romantica: 0 } },
          { text: "Total color — uma cor da cabeça aos pés", styleBonus: { elegante: 3, classica: 1, minimal: 1, romantica: 1 } },
          { text: "Mix de tons próximos — monocromático suave", styleBonus: { elegante: 1, classica: 2, minimal: 3, romantica: 1 } },
          { text: "Contrastes ousados — adoro misturar", styleBonus: { elegante: 1, classica: 0, minimal: 0, romantica: 3 } },
        ],
      },
    ],
  },

  // ─── OCASIÕES ESPECIAIS ────────────────────────────────────
  {
    id: "special-occasions",
    title: "Looks para Ocasiões Especiais",
    subtitle: "O que vestir nos momentos mais importantes",
    emoji: "",
    theme: "events",
    pointsReward: MISSION_POINTS.completionBonus,
    tags: ["event-ready", "celebration-style"],
    photoPrompt: "Envie referências de looks de festa ou eventos que te inspiram",
    questions: [
      {
        id: 1,
        question: "Jantar especial — o que você escolheria?",
        subtext: "O look que te faz sentir confiante e bonita",
        options: [
          { text: "Vestido elegante e estruturado", styleBonus: { elegante: 3, classica: 2, minimal: 0, romantica: 1 } },
          { text: "Conjunto sofisticado de alfaiataria", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Look monocromático impactante", styleBonus: { elegante: 1, classica: 1, minimal: 3, romantica: 0 } },
          { text: "Vestido fluido com movimento e cor", styleBonus: { elegante: 0, classica: 0, minimal: 0, romantica: 3 } },
        ],
      },
      {
        id: 2,
        question: "Qual acessório eleva seu look de evento?",
        subtext: "O toque final que transforma o visual",
        options: [
          { text: "Joia statement — brinco ou colar marcante", styleBonus: { elegante: 3, classica: 1, minimal: 0, romantica: 1 } },
          { text: "Bolsa clássica de qualidade", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Peças minimalistas e discretas", styleBonus: { elegante: 1, classica: 1, minimal: 3, romantica: 0 } },
          { text: "Detalhes delicados e femininos", styleBonus: { elegante: 0, classica: 0, minimal: 0, romantica: 3 } },
        ],
      },
      {
        id: 3,
        question: "Casamento como convidada — seu estilo?",
        subtext: "O equilíbrio entre elegância e personalidade",
        options: [
          { text: "Vestido midi elegante e discreto", styleBonus: { elegante: 3, classica: 2, minimal: 1, romantica: 1 } },
          { text: "Conjunto com alfaiataria impecável", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Vestido longo e fluido", styleBonus: { elegante: 1, classica: 1, minimal: 0, romantica: 3 } },
          { text: "Jumpsuit sofisticado e moderno", styleBonus: { elegante: 2, classica: 1, minimal: 3, romantica: 0 } },
        ],
      },
      {
        id: 4,
        question: "Qual salto combina com você em eventos?",
        subtext: "O sapato certo completa todo o visual",
        options: [
          { text: "Stiletto alto — impacto máximo", styleBonus: { elegante: 3, classica: 1, minimal: 0, romantica: 1 } },
          { text: "Salto bloco — elegância com conforto", styleBonus: { elegante: 1, classica: 3, minimal: 2, romantica: 0 } },
          { text: "Mule com salto médio", styleBonus: { elegante: 2, classica: 2, minimal: 3, romantica: 0 } },
          { text: "Sandália delicada com tiras finas", styleBonus: { elegante: 0, classica: 0, minimal: 0, romantica: 3 } },
        ],
      },
      {
        id: 5,
        question: "Como você prefere sua maquiagem em eventos?",
        subtext: "O make complementa a história do look",
        options: [
          { text: "Batom marcante — vermelho ou vinho", styleBonus: { elegante: 3, classica: 2, minimal: 0, romantica: 0 } },
          { text: "Olho marcado e boca nude", styleBonus: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
          { text: "Natural, luminoso e clean", styleBonus: { elegante: 1, classica: 1, minimal: 3, romantica: 1 } },
          { text: "Tons rosados e pele iluminada", styleBonus: { elegante: 0, classica: 0, minimal: 0, romantica: 3 } },
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
