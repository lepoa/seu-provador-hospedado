import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ========== AUTH HELPER ==========
async function requireAuth(req: Request): Promise<{ userId: string; error?: undefined } | { userId?: undefined; error: Response }> {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return { error: new Response(JSON.stringify({ error: "Token de autorização ausente ou inválido" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
    });
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
        return { error: new Response(JSON.stringify({ error: "Sessão expirada ou inválida" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
    }
    return { userId: data.user.id };
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    // ========== AUTH CHECK ==========
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;
    const authenticatedUserId = auth.userId;

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const body = await req.json().catch(() => ({}));
        const { input_text, session_id, history = [] } = body;

        if (!input_text) {
            return new Response(JSON.stringify({ error: "Input text is required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 1. Fetch 50 active products
        console.log("Fetching products...");
        const { data: products, error: productsError } = await supabase
            .from("product_catalog")
            .select("id, name, price, category, occasion")
            .eq("is_active", true)
            .limit(50);

        if (productsError) {
            console.error("Database Error (Fetch Products):", productsError);
            throw new Error(`Erro ao buscar catálogo: ${productsError.message}`);
        }

        console.log(`Found ${products?.length || 0} products.`);

        const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
        if (!OPENAI_API_KEY) {
            console.error("Critical Error: OPENAI_API_KEY is not set.");
            throw new Error("Configuração da OpenAI ausente (OPENAI_API_KEY).");
        }

        const systemPrompt = `Você é uma consultora de moda elegante da marca Le.Poá.
Sua missão é ajudar a cliente a encontrar o visual perfeito e COLETAR dados estratégicos.

LOGICA DE RESPOSTA (DEVE SER JSON):
- Se for saudações: use type "chat", responda elegantemente e PERGUNTE que tipo de roupa ela gosta ou que tamanho ela veste.
- Se a cliente pedir sugestão sem dizer o tamanho: use type "chat", sugira que você pode ser mais precisa se souber o TAMANHO (P, M, G, GG) que ela veste.
- Se a cliente demonstrar intenção clara ou já tiver dito o tamanho: use type "look" e escolha os produtos.

ESTRATÉGIA:
- Seja curiosa sobre o estilo dela (clássico, moderno, romântico).
- Sempre tente descobrir o TAMANHO se ela ainda não mencionou.
- Se ela mencionar uma ocasião, priorize produtos que tenham essa ocasião em suas tags ou campo 'occasion'.

REGRAS PARA LOOKS (type: "look"):
- Use APENAS os IDs de produtos abaixo.
- Escolha de 2 a 4 produtos.
- O campo "text" deve ser o seu comentário de Stylist.

PRODUTOS DISPONÍVEIS:
${JSON.stringify(products)}

FORMATO DE RETORNO OBRIGATÓRIO (JSON):
{
  "type": "chat" ou "look",
  "text": "Sua resposta elegante",
  "title": "Título sofisticado do look",
  "products": ["ID1", "ID2"]
}`;

        // Map history to OpenAI format, filtering out the current processing message if sent
        const historyMessages = history
            .filter((m: any) => m.text !== input_text)
            .map((m: any) => ({
                role: m.type === "user" ? "user" : "assistant",
                content: m.text
            }));

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...historyMessages,
                    { role: "user", content: input_text },
                ],
                max_tokens: 800,
                temperature: 0.7,
                response_format: { type: "json_object" }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("OpenAI Error:", errorText);
            throw new Error(`Erro na OpenAI: ${response.status}`);
        }

        const aiData = await response.json();
        const contentStr = aiData.choices?.[0]?.message?.content;

        if (!contentStr) {
            throw new Error("Resposta da IA veio vazia.");
        }

        const content = JSON.parse(contentStr);

        // Validation & Cleanup
        const isLook = content.type === "look" && Array.isArray(content.products) && content.products.length > 0;

        if (isLook) {
            const validIds = products.map(p => p.id);
            content.products = content.products.filter((id: string) => validIds.includes(id));
        } else {
            content.products = [];
            content.title = content.title || "";
        }

        // 3. Save session
        await supabase.from("ai_look_sessions").insert({
            user_id: authenticatedUserId,
            session_id: session_id || null,
            input_text,
            generated_title: content.title || null,
            generated_description: content.text,
            generated_product_ids: isLook ? content.products : []
        });

        return new Response(JSON.stringify({ success: true, data: content }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Error in generate-ai-look:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
