import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface QuizAnswer {
  question: string;
  answer: string;
  points: number;
}

interface AnalysisRequest {
  answers: QuizAnswer[];
  size: string;
  additionalNotes?: string;
  totalPoints: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // === Authentication ===
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Input validation ===
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { answers, size, additionalNotes, totalPoints } = body as AnalysisRequest;

    if (!Array.isArray(answers) || answers.length === 0 || answers.length > 50) {
      return new Response(JSON.stringify({ error: "answers must be a non-empty array (max 50)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof size !== "string" || size.length > 20) {
      return new Response(JSON.stringify({ error: "size is required and must be a short string" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof totalPoints !== "number" || totalPoints < 0) {
      return new Response(JSON.stringify({ error: "totalPoints must be a non-negative number" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const answersText = answers.map(a => `- ${a.question}: ${a.answer}`).join("\n");

    const prompt = `Você é uma consultora de imagem experiente do Provador VIP. Analise as respostas do quiz de estilo abaixo e gere uma análise personalizada como se estivesse conversando com a cliente.

IMPORTANTE: Não use linguagem de vendas. Seja como uma amiga consultora de moda.

## Respostas do Quiz:
${answersText}

## Tamanho da cliente: ${size}
## Pontuação total: ${totalPoints} pontos
${additionalNotes ? `## Notas adicionais da cliente: ${additionalNotes}` : ""}

Retorne APENAS um JSON válido (sem markdown, sem código) com a seguinte estrutura:
{
  "styleId": "elegante|classica|minimal|romantica",
  "styleTitle": "Nome do Estilo (ex: Elegante Estratégica)",
  "styleSubtitle": "Frase curta que descreve o estilo de forma poética",
  "description": "Descrição de 2-3 frases sobre o estilo da cliente, como uma amiga falaria",
  "highlights": [
    "Primeira característica marcante dela (ex: Você valoriza qualidade sobre quantidade)",
    "Segunda característica (ex: Seu olhar é atraído por cortes impecáveis)",
    "Terceira característica (ex: Você sabe que a roupa é uma ferramenta de expressão)"
  ],
  "valorizes": ["característica 1", "característica 2", "característica 3"],
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "personalTip": "Uma dica personalizada de moda para essa cliente, como uma consultora falaria",
  "colorPalette": ["cor1", "cor2", "cor3"],
  "avoidColors": ["cor a evitar"],
  "keyPieces": ["peça essencial 1", "peça essencial 2", "peça essencial 3"]
}

Regras:
- As "highlights" devem ser 3 frases curtas sobre quem ela é (não sobre produtos)
- "valorizes" são 3 palavras/termos que definem o que ela busca em roupas
- Seja criativa mas precisa
- Os styleIds válidos são: elegante, classica, minimal, romantica
- Use linguagem acolhedora e empática, nunca comercial`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é uma consultora de moda experiente e amigável. Responda sempre em JSON válido. Use linguagem calorosa e empática." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log("AI Response structure:", JSON.stringify(aiResponse, null, 2));
    
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      console.error("Empty content. Full response:", JSON.stringify(aiResponse));
      // Return default analysis instead of throwing
      return new Response(JSON.stringify({
        styleId: "classica",
        styleTitle: "Clássica Moderna",
        styleSubtitle: "Atemporal com um toque contemporâneo",
        description: "Você valoriza qualidade e peças que atravessam temporadas. Seu guarda-roupa é um investimento consciente.",
        highlights: [
          "Você prefere peças atemporais a tendências passageiras",
          "Seu closet é curado com intenção",
          "Elegância discreta é sua marca registrada"
        ],
        valorizes: ["versatilidade", "cortes clean", "paleta neutra"],
        tags: ["clássico", "atemporal", "básico", "trabalho"],
        personalTip: "Invista em peças atemporais de qualidade que podem ser combinadas de várias formas.",
        colorPalette: ["bege", "marinho", "branco"],
        avoidColors: ["neon"],
        keyPieces: ["Camisa branca", "Calça de alfaiataria", "Trench coat"],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse the JSON from the response
    let analysis;
    try {
      // Clean up the response - remove any markdown code blocks
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Return a default analysis based on points
      analysis = {
        styleId: "classica",
        styleTitle: "Clássica Moderna",
        styleSubtitle: "Atemporal com um toque contemporâneo",
        description: "Você valoriza qualidade e peças que atravessam temporadas. Seu guarda-roupa é um investimento consciente.",
        highlights: [
          "Você prefere peças atemporais a tendências passageiras",
          "Seu closet é curado com intenção",
          "Elegância discreta é sua marca registrada"
        ],
        valorizes: ["versatilidade", "cortes clean", "paleta neutra"],
        tags: ["clássico", "atemporal", "básico", "trabalho"],
        personalTip: "Invista em peças atemporais de qualidade que podem ser combinadas de várias formas.",
        colorPalette: ["bege", "marinho", "branco"],
        avoidColors: ["neon"],
        keyPieces: ["Camisa branca", "Calça de alfaiataria", "Trench coat"],
      };
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-quiz error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
