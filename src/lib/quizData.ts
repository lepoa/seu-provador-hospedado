export interface QuizQuestion {
  id: number;
  question: string;
  subtext?: string;
  options: {
    text: string;
    points: { elegante: number; classica: number; minimal: number; romantica: number };
  }[];
}

export const quizQuestions: QuizQuestion[] = [
  {
    id: 1,
    question: "Como você se sente mais você?",
    subtext: "Escolha a opção que mais combina com seu dia a dia",
    options: [
      { text: "Sofisticada e imponente", points: { elegante: 3, classica: 1, minimal: 0, romantica: 0 } },
      { text: "Clássica e atemporal", points: { elegante: 1, classica: 3, minimal: 1, romantica: 0 } },
      { text: "Simples e descomplicada", points: { elegante: 0, classica: 1, minimal: 3, romantica: 0 } },
      { text: "Delicada e feminina", points: { elegante: 0, classica: 0, minimal: 1, romantica: 3 } },
    ],
  },
  {
    id: 2,
    question: "Qual peça não pode faltar no seu closet?",
    options: [
      { text: "Blazer estruturado", points: { elegante: 3, classica: 2, minimal: 1, romantica: 0 } },
      { text: "Camisa branca impecável", points: { elegante: 1, classica: 3, minimal: 2, romantica: 0 } },
      { text: "Calça de alfaiataria reta", points: { elegante: 2, classica: 2, minimal: 3, romantica: 0 } },
      { text: "Vestido midi fluido", points: { elegante: 1, classica: 0, minimal: 0, romantica: 3 } },
    ],
  },
  {
    id: 3,
    question: "Você usa mais certinho ou mais soltinho?",
    subtext: "Amei essa escolha! Me conta...",
    options: [
      { text: "Bem ajustado ao corpo", points: { elegante: 3, classica: 1, minimal: 0, romantica: 1 } },
      { text: "Na medida certa", points: { elegante: 1, classica: 3, minimal: 2, romantica: 1 } },
      { text: "Mais soltinho e confortável", points: { elegante: 0, classica: 1, minimal: 3, romantica: 2 } },
      { text: "Depende do meu humor", points: { elegante: 1, classica: 1, minimal: 1, romantica: 2 } },
    ],
  },
  {
    id: 4,
    question: "Qual cor você mais veste?",
    options: [
      { text: "Preto, sempre", points: { elegante: 3, classica: 1, minimal: 2, romantica: 0 } },
      { text: "Tons neutros e terrosos", points: { elegante: 1, classica: 2, minimal: 3, romantica: 1 } },
      { text: "Branco e off-white", points: { elegante: 2, classica: 2, minimal: 3, romantica: 1 } },
      { text: "Cores suaves e pastéis", points: { elegante: 0, classica: 1, minimal: 0, romantica: 3 } },
    ],
  },
  {
    id: 5,
    question: "Qual acessório define você?",
    options: [
      { text: "Relógio elegante", points: { elegante: 3, classica: 2, minimal: 1, romantica: 0 } },
      { text: "Bolsa estruturada", points: { elegante: 2, classica: 3, minimal: 1, romantica: 0 } },
      { text: "Brincos discretos", points: { elegante: 1, classica: 1, minimal: 3, romantica: 1 } },
      { text: "Lenço ou echarpe", points: { elegante: 1, classica: 1, minimal: 0, romantica: 3 } },
    ],
  },
  {
    id: 6,
    question: "Como é seu look de fim de semana?",
    subtext: "Perfeito, já estou entendendo seu estilo!",
    options: [
      { text: "Igual ao da semana, impecável", points: { elegante: 3, classica: 2, minimal: 0, romantica: 0 } },
      { text: "Jeans e peças atemporais", points: { elegante: 1, classica: 3, minimal: 2, romantica: 0 } },
      { text: "O mais confortável possível", points: { elegante: 0, classica: 0, minimal: 3, romantica: 1 } },
      { text: "Vestido leve ou saia fluida", points: { elegante: 0, classica: 1, minimal: 0, romantica: 3 } },
    ],
  },
];

export interface StyleProfile {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  emoji: string;
}

export const styleProfiles: Record<string, StyleProfile> = {
  elegante: {
    id: "elegante",
    title: "Elegante Estratégica",
    subtitle: "Poder e sofisticação em cada detalhe",
    description: "Você transmite confiança e autoridade. Suas escolhas são intencionais e você sabe exatamente o impacto que quer causar.",
    tags: ["elegante", "power", "luxo", "trabalho"],
    emoji: "👑",
  },
  classica: {
    id: "classica",
    title: "Clássica Moderna",
    subtitle: "Atemporal com um toque contemporâneo",
    description: "Você valoriza qualidade e peças que atravessam temporadas. Seu guarda-roupa é um investimento consciente.",
    tags: ["clássico", "atemporal", "básico", "trabalho"],
    emoji: "✨",
  },
  minimal: {
    id: "minimal",
    title: "Chic Minimal",
    subtitle: "Menos é mais, e você prova isso",
    description: "Você encontra beleza na simplicidade. Cortes limpos, cores neutras e uma curadoria impecável definem seu estilo.",
    tags: ["minimal", "moderno", "versátil", "confortável"],
    emoji: "🤍",
  },
  romantica: {
    id: "romantica",
    title: "Romântica Contemporânea",
    subtitle: "Delicadeza com personalidade",
    description: "Você celebra sua feminilidade com graça. Texturas suaves, estampas florais e detalhes delicados contam sua história.",
    tags: ["romântico", "floral", "delicado", "feminino"],
    emoji: "🌸",
  },
};

export function calculateStyleProfile(answers: { questionId: number; answer: string; points: typeof quizQuestions[0]["options"][0]["points"] }[]): StyleProfile {
  const totals = { elegante: 0, classica: 0, minimal: 0, romantica: 0 };
  
  answers.forEach(answer => {
    totals.elegante += answer.points.elegante;
    totals.classica += answer.points.classica;
    totals.minimal += answer.points.minimal;
    totals.romantica += answer.points.romantica;
  });

  const winner = Object.entries(totals).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
  return styleProfiles[winner as keyof typeof styleProfiles];
}
