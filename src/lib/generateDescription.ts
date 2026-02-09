interface ProductData {
  name: string;
  category: string | null;
  color: string | null;
  style: string | null;
  occasion: string | null;
  modeling: string | null;
  price: number;
}

export async function generateProductDescription(product: ProductData): Promise<string> {
  const styleDescriptions: Record<string, string> = {
    elegante: "com elegância sofisticada",
    clássico: "com um toque clássico atemporal",
    minimal: "com design minimalista e clean",
    romântico: "com charme romântico e delicado",
    casual: "perfeito para o dia a dia descontraído",
    moderno: "com linhas modernas e contemporâneas",
    fashion: "seguindo as últimas tendências da moda",
    sexy_chic: "com um toque sexy e sofisticado",
  };

  const occasionDescriptions: Record<string, string> = {
    trabalho: "ideal para o ambiente profissional",
    casual: "perfeito para ocasiões casuais",
    festa: "perfeito para arrasar nas festas",
    "dia a dia": "versátil para usar no dia a dia",
    especial: "para momentos especiais e marcantes",
    casual_chic: "para um visual casual mas elegante",
    eventos: "perfeito para eventos e ocasiões importantes",
    viagem: "prático e estiloso para viagens",
  };

  const modelingDescriptions: Record<string, string> = {
    ajustado: "Modelagem ajustada que valoriza a silhueta",
    regular: "Modelagem regular com caimento confortável",
    soltinho: "Modelagem soltinha para máximo conforto",
    oversized: "Modelagem oversized trendy e despojada",
    acinturado: "Modelagem acinturada que marca a cintura",
    slim: "Modelagem slim com corte moderno",
    reto: "Modelagem reta com visual clean",
    amplo: "Modelagem ampla com movimento fluido",
  };

  let description = "";

  // Opening with name and category
  if (product.category) {
    description += `${product.name} é ${product.category === "Acessórios" ? "um acessório" : product.category?.toLowerCase().startsWith("a") ? `uma ${product.category?.toLowerCase().slice(0, -1)}` : `um ${product.category?.toLowerCase().slice(0, -1) || "peça"}`} `;
  } else {
    description += `${product.name} é uma peça `;
  }

  // Add style
  if (product.style && styleDescriptions[product.style]) {
    description += `${styleDescriptions[product.style]}. `;
  } else {
    description += "que combina estilo e versatilidade. ";
  }

  // Add color
  if (product.color) {
    description += `Na cor ${product.color.toLowerCase()}, `;
  }

  // Add occasion
  if (product.occasion && occasionDescriptions[product.occasion]) {
    description += `${occasionDescriptions[product.occasion]}. `;
  }

  // Add modeling
  if (product.modeling && modelingDescriptions[product.modeling]) {
    description += `${modelingDescriptions[product.modeling]}. `;
  }

  // Closing
  description += "Uma peça indispensável para o seu guarda-roupa.";

  return description.trim();
}
