import { supabase } from "@/integrations/supabase/client";

interface Product {
  id: string;
  category: string | null;
  color: string | null;
  style: string | null;
  occasion: string | null;
  stock_by_size: Record<string, number> | null;
  name: string;
}

interface Customer {
  id: string;
  phone: string;
  name: string | null;
  size: string | null;
  style_title: string | null;
}

interface QuizResponse {
  question: string;
  answer: string;
}

interface SuggestionReason {
  type: "category" | "style" | "occasion" | "color" | "size";
  label: string;
  points: number;
}

interface CustomerSuggestion {
  customer_id: string;
  score: number;
  reasons: SuggestionReason[];
}

// Style mapping from quiz titles to product styles
const STYLE_MAPPINGS: Record<string, string[]> = {
  "elegante estratégica": ["elegante", "clássico", "minimal"],
  "romântica sofisticada": ["romântico", "elegante", "fashion"],
  "moderna urbana": ["moderno", "casual", "minimal"],
  "clássica atemporal": ["clássico", "elegante", "minimal"],
  "fashion ousada": ["fashion", "moderno", "sexy_chic"],
  "casual chic": ["casual", "moderno", "minimal"],
};

// Occasion mapping from quiz answers
const OCCASION_KEYWORDS: Record<string, string[]> = {
  trabalho: ["trabalho", "office", "reunião", "escritório"],
  casual: ["casual", "dia a dia", "passeio", "lazer"],
  festa: ["festa", "balada", "evento", "especial"],
};

// Color preference keywords
const COLOR_KEYWORDS: Record<string, string[]> = {
  neutros: ["preto", "branco", "bege", "cinza", "nude", "off white"],
  cores: ["azul", "verde", "vermelho", "rosa", "amarelo", "laranja", "roxo", "lilás"],
  estampado: ["estampado", "floral", "animal print"],
};

function normalizeString(str: string | null): string {
  if (!str) return "";
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function calculateMatchScore(
  product: Product, 
  customer: Customer, 
  quizResponses: QuizResponse[]
): CustomerSuggestion | null {
  const reasons: SuggestionReason[] = [];
  let score = 0;

  // Get normalized values
  const productCategory = normalizeString(product.category);
  const productStyle = normalizeString(product.style);
  const productOccasion = normalizeString(product.occasion);
  const productColor = normalizeString(product.color);
  const customerStyleTitle = normalizeString(customer.style_title);

  // Aggregate quiz answers for analysis
  const allAnswers = quizResponses.map(q => normalizeString(q.answer)).join(" ");
  const allQuestions = quizResponses.map(q => normalizeString(q.question)).join(" ");

  // +3 if category matches quiz preferences (check if quiz mentions category-related words)
  if (productCategory) {
    const categoryKeywords: Record<string, string[]> = {
      vestidos: ["vestido", "dress"],
      blusas: ["blusa", "top", "camisa"],
      calças: ["calca", "pants"],
      saias: ["saia", "skirt"],
      conjuntos: ["conjunto", "set"],
      blazers: ["blazer", "casaco"],
    };
    
    const keywords = categoryKeywords[productCategory] || [productCategory];
    if (keywords.some(kw => allAnswers.includes(kw))) {
      score += 3;
      reasons.push({ type: "category", label: `Categoria ${product.category}`, points: 3 });
    }
  }

  // +3 if style matches customer's quiz style
  if (productStyle && customerStyleTitle) {
    // Check direct match
    if (customerStyleTitle.includes(productStyle)) {
      score += 3;
      reasons.push({ type: "style", label: `Estilo ${product.style}`, points: 3 });
    } else {
      // Check mapped styles
      for (const [quizStyle, mappedStyles] of Object.entries(STYLE_MAPPINGS)) {
        if (customerStyleTitle.includes(normalizeString(quizStyle))) {
          if (mappedStyles.includes(productStyle)) {
            score += 3;
            reasons.push({ type: "style", label: `Estilo combina com ${customer.style_title}`, points: 3 });
            break;
          }
        }
      }
    }
  }

  // +2 if occasion matches (trabalho/festa/casual)
  if (productOccasion) {
    for (const [occasionKey, keywords] of Object.entries(OCCASION_KEYWORDS)) {
      if (keywords.some(kw => productOccasion.includes(kw))) {
        // Check if quiz answers mention this occasion
        if (keywords.some(kw => allAnswers.includes(kw))) {
          score += 2;
          reasons.push({ type: "occasion", label: `Ocasião ${product.occasion}`, points: 2 });
          break;
        }
      }
    }
  }

  // +2 if color matches preferences
  if (productColor) {
    // Check if quiz answers mention color preferences
    if (allAnswers.includes(productColor)) {
      score += 2;
      reasons.push({ type: "color", label: `Cor ${product.color}`, points: 2 });
    } else {
      // Check color category preferences
      for (const [colorCat, colors] of Object.entries(COLOR_KEYWORDS)) {
        if (colors.includes(productColor)) {
          if (allAnswers.includes(colorCat) || allAnswers.includes(colors[0])) {
            score += 2;
            reasons.push({ type: "color", label: `Cor ${product.color}`, points: 2 });
            break;
          }
        }
      }
    }
  }

  // +5 if stock exists in customer's size
  if (customer.size && product.stock_by_size) {
    const stock = product.stock_by_size as Record<string, number>;
    const sizeStock = stock[customer.size] || 0;
    if (sizeStock > 0) {
      score += 5;
      reasons.push({ type: "size", label: `Tamanho ${customer.size} disponível`, points: 5 });
    }
  }

  // Only return if score > 0
  if (score === 0) return null;

  return {
    customer_id: customer.id,
    score,
    reasons,
  };
}

export async function suggestCustomersForProduct(productId: string): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  try {
    // Load product
    const { data: product, error: productError } = await supabase
      .from("product_catalog")
      .select("id, category, color, style, occasion, stock_by_size, name")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return { success: false, count: 0, error: "Produto não encontrado" };
    }

    // Load all customers with quiz data
    const { data: customers, error: customersError } = await supabase
      .from("customers")
      .select("id, phone, name, size, style_title");

    if (customersError) {
      return { success: false, count: 0, error: "Erro ao carregar clientes" };
    }

    // Only process customers who have completed the quiz (have style_title)
    const customersWithQuiz = (customers || []).filter(c => c.style_title);

    if (customersWithQuiz.length === 0) {
      return { success: true, count: 0 };
    }

    // Load quiz responses for all customers
    const customerIds = customersWithQuiz.map(c => c.id);
    const { data: quizResponses } = await supabase
      .from("quiz_responses")
      .select("customer_id, question, answer")
      .in("customer_id", customerIds);

    // Group quiz responses by customer
    const quizByCustomer: Record<string, QuizResponse[]> = {};
    (quizResponses || []).forEach(qr => {
      if (!quizByCustomer[qr.customer_id]) {
        quizByCustomer[qr.customer_id] = [];
      }
      quizByCustomer[qr.customer_id].push(qr);
    });

    // Calculate suggestions for each customer
    const suggestions: CustomerSuggestion[] = [];
    for (const customer of customersWithQuiz) {
      const customerQuiz = quizByCustomer[customer.id] || [];
      const suggestion = calculateMatchScore(product as Product, customer, customerQuiz);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    if (suggestions.length === 0) {
      // Clear any existing suggestions for this product
      await supabase
        .from("customer_product_suggestions")
        .delete()
        .eq("product_id", productId);
      
      return { success: true, count: 0 };
    }

    // Delete existing suggestions for this product
    await supabase
      .from("customer_product_suggestions")
      .delete()
      .eq("product_id", productId);

    // Insert new suggestions
    const insertData = suggestions.map(s => ({
      product_id: productId,
      customer_id: s.customer_id,
      score: s.score,
      reasons: JSON.parse(JSON.stringify(s.reasons)),
    }));

    const { error: insertError } = await supabase
      .from("customer_product_suggestions")
      .insert(insertData);

    if (insertError) {
      console.error("Error inserting suggestions:", insertError);
      return { success: false, count: 0, error: "Erro ao salvar sugestões" };
    }

    return { success: true, count: suggestions.length };
  } catch (error) {
    console.error("Error in suggestCustomersForProduct:", error);
    return { success: false, count: 0, error: "Erro inesperado" };
  }
}
