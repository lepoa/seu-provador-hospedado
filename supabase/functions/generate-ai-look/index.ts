import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { scoreProductPriority } from "./stylingRules.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = {
    ...corsHeaders,
    "Content-Type": "application/json; charset=utf-8",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    let authenticatedUserId: string | undefined;

    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
        const supabaseAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data } = await supabaseAuth.auth.getUser();
        if (data?.user) {
            authenticatedUserId = data.user.id;
        }
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const body = await req.json().catch(() => ({}));
        const { input_text = "", session_id, history = [] } = body;

        if (!input_text.trim()) {
            return new Response(JSON.stringify({ error: "Input text is required" }), {
                status: 400,
                headers: jsonHeaders,
            });
        }

        let userProfile = { name: "", size_letter: "", size_number: "", style_title: "" };
        if (authenticatedUserId) {
            const { data: customer, error: customerError } = await supabase
                .from("customers")
                .select("name, size_letter, size_number, style_title")
                .eq("user_id", authenticatedUserId)
                .maybeSingle();
            
            if (customerError && customerError.code !== 'PGRST116') {
                 console.error("Customer fetch error:", customerError);
            }
            if (customer) userProfile = customer;
        }

        const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
        if (!OPENAI_API_KEY) throw new Error("Configuração da OpenAI ausente.");

        const previouslySuggestedIds = new Set<string>();
        for (const msg of history) {
            if (msg.products && Array.isArray(msg.products)) {
                for (const pid of msg.products) {
                    previouslySuggestedIds.add(pid);
                }
            }
        }

        const historyMessages = history
            .filter((m: any) => m.text !== input_text)
            .map((m: any) => ({
                role: m.type === "user" ? "user" : "assistant",
                content: m.text ? String(m.text) : " "
            }));

        // PASSO 1: O Extrator de Contexto (Router)
        const routerSystemPrompt = `Você é a Consultora de Imagem Senior da marca feminina Le.Poá.
Sua missão é interpretar a solicitação da cliente e decidir se já temos informações suficientes para montar um look, ou se precisamos de mais contexto.

Aja com extrema inteligência para inferir intenções implícitas.
Exemplos de inferência:
- "advogada" -> Ocasião: trabalho. Estilo provável: elegante/clássico.
- "noivado", "casamento" -> Ocasião: eventos. Estilo provável: romântico/elegante.
- "praia" -> Ocasião: viagem/dia a dia. Estilo: casual/resort.

**PERFIS SUPORTADOS PELO NOSSO SISTEMA (MAPEIE PARA ESSES TERMOS SE POSSÍVEL):**
- Ocasiões Suportadas: trabalho, jantar, eventos, igreja, viagem, dia a dia.
- Estilos Suportados: elegante, clássico, romântico, moderno, sexy chic, minimal, casual, fashion.
- Modelagens Suportadas: soltinho, ajustado, acinturado.
- Numerações: PP, P, M, G, GG, EXG, 34, 36, 38, 40, 42, 44, 46, 48, U.

**DADOS DA CLIENTE LOGADA:**
- Numeração cadastrada dela: ${userProfile.size_letter || userProfile.size_number || "Desconhecido"}

**REGRA DE OURO MÁXIMA E ABSOLUTA:**
**Se houver QUALQUER MENSAGEM NO HISTÓRICO da cliente informando a ocasião (ex: "casamento", "trabalho") e ela já respondeu sua primeira pergunta sobre estilo ou modelagem, VOCÊ É OBRIGADA A RETORNAR "status": "search". NUNCA, SOB HIPÓTESE ALGUMA, FAÇA UMA SEGUNDA PERGUNTA.**
Nosso sistema NÃO SUPORTA conversas longas de triagem. Apenas 1 (UMA) pergunta é permitida em toda a sessão de consultoria.

**QUANDO O STATUS É "ask":**
USE APENAS SE FOR A PRIMEIRA INTERAÇÃO DA CLIENTE e ela não disse absolutamente nada que dê pra inferir ocasião nem estilo.
Retorne "status": "ask" e faça UMA ÚNICA pergunta natural.

**QUANDO O STATUS É "search" (BUSCAR PRODUTOS):**
Se você já sabe minimamente a ocasião (mesmo que inferida, ex: "trabalho") e tem alguma pista de estilo ou modelagem, RETORNE "search" IMEDIATAMENTE.
Retorne "status": "search" e extraia os "inferred_filters" com base no que você entendeu de TODA a conversa.

RETORNE EXATAMENTE NESTE FORMATO JSON (SEM NADA A MAIS):
{
  "status": "ask" ou "search",
  "inferred_filters": {
    "occasion": "string inferida ou nulo",
    "style": "string inferida ou nulo",
    "fit": "string inferida ou nulo",
    "size": "string inferida da fala (ou utilize a cadastrada se a cliente não mencionou outra mas sabemos qual é) ou nulo"
  },
  "message": "Mensagem natural (só preencha se status for 'ask')"
}`;

        const routerResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: routerSystemPrompt },
                    ...historyMessages,
                    { role: "user", content: input_text },
                ],
                max_tokens: 400,
                temperature: 0.3,
                response_format: { type: "json_object" }
            }),
        });

        if (!routerResponse.ok) throw new Error(`OpenAI Router Error: ${routerResponse.status}`);
        
        const routerData = await routerResponse.json();
        const routerStateStr = routerData.choices?.[0]?.message?.content;
        if (!routerStateStr) throw new Error("Empty response from OpenAI Router");
        
        let routerState;
        try {
            const cleanStr = routerStateStr.replace(/```json/g, "").replace(/```/g, "").trim();
            routerState = JSON.parse(cleanStr);
        } catch (e) {
            console.error("Failed to parse Router JSON:", routerStateStr);
            routerState = { status: "search", inferred_filters: {} };
        }

        // SE NÃO TIVERMOS O SUFICIENTE -> O LLM CONVERSA E A GENTE PARA AQUI.
        if (routerState.status === "ask") {
            const finalContent = {
                type: "chat",
                text: routerState.message || "Me conta mais sobre o que você procura?",
                products: [],
                title: "CONSULTORIA"
            };
            return new Response(JSON.stringify({ success: true, data: finalContent }), { headers: jsonHeaders });
        }

        // SE TIVERMOS O SUFICIENTE -> VAMOS AO BANCO (PASSO 2 - BUSCAR E REDIGIR)
        const filters = routerState.inferred_filters || { occasion: null, style: null, fit: null, size: null };
        const sizeToSearch = filters.size || userProfile.size_letter || userProfile.size_number;

        const { data: products, error: productsError } = await supabase
            .from("product_catalog")
            .select("id, name, price, category, occasion, style, description, sizes")
            .eq("is_active", true);

        if (productsError) throw productsError;

        const { data: stockData, error: stockError } = await supabase
            .from("product_available_stock")
            .select("product_id, size, available")
            .gt("available", 0);
            
        if (stockError) throw stockError;

        const stockMap = new Map<string, string[]>();
        if (stockData) {
            for (const item of stockData) {
                if (!stockMap.has(item.product_id)) stockMap.set(item.product_id, []);
                stockMap.get(item.product_id)!.push(item.size);
            }
        }

        const scoredProducts = (products || [])
            .map(p => {
                const availableSizes = stockMap.get(p.id) || [];
                if (availableSizes.length === 0) return null;
                if (previouslySuggestedIds.has(p.id)) return null; // Nunca repete IDs na mesma conversa

                if (sizeToSearch && sizeToSearch !== "Não sei") {
                    const hasCompatibleSize = availableSizes.some(s => 
                        s === sizeToSearch || s === "U" || s === "U (ÚNICO)"
                    );
                    if (!hasCompatibleSize) return null; // Filtro cego de tamanho
                }

                // O scorePriority pontua fortemente os match exatos com a nossa rules engine (estilo, ocasião e fit)
                const baseScore = scoreProductPriority(p, filters);
                return { ...p, score: baseScore, availableSizes };
            })
            .filter(p => p !== null && p.score > 0);

        scoredProducts.sort((a, b) => b!.score - a!.score);
        const finalSelection = scoredProducts.slice(0, 3);
        const finalIds = finalSelection.map(p => p!.id);

        let finalProductsListTxt = "A lista de peças elegíveis está VAZIA (nada no estoque no tamanho dela combina com o pedido).";
        if (finalSelection.length > 0) {
             finalProductsListTxt = finalSelection.map((p, idx) => `${idx+1}. ID: ${p!.id} - NOME DA PEÇA: ${p!.name} (Descritivo no site: ${p!.description?.substring(0, 150) || ''})`).join("\n");
        }

        // PASSO 3: A Redatora (Writer)
        const writerSystemPrompt = `Você é a Consultora de Imagem da marca feminina parceira Le.Poá.
O nosso motor interno de algoritmos FEZ A SELEÇÃO DAS ROUPAS. Você NÃO PODE Escolher e NÃO PODE Mudar os Produtos.
Seu papel É APRESENTAR ESTES PRODUTOS PARA A CLIENTE de forma elegantíssima, fundamentando a escolha com o contexto que ela deu.

**CONTEXTO DETECTADO DA CLIENTE E DA CENA**
- Falas da Cliente: "${input_text}"
- Ocasião inferida: ${filters.occasion || "Não detectada claramente"}
- Estilo inferido: ${filters.style || "Não detectado claramente"}
- Tamanho desejado: ${sizeToSearch || "Não detectado"}

**LISTA OFICIAL DE PRODUTOS SELECIONADOS NO NOSSO BANCO (SÓ FALE DESSES!)**
${finalProductsListTxt}

REGRAS ESTILÍSTICAS (OBRIGATÓRIO):
1. **Tom e Empatia**: Seja puramente humana, calorosa e sofisticada. Use emojis elegantemente (✨, 🤎, 🥰, 👗, etc) para trazer carisma.
2. **Estrutura Visual**: PULE LINHAS constantemente (use \n\n dupla) para separar o texto em parágrafos curtinhos e fluídos. É proibido retornar um "paredão de texto". Se for citar as peças, coloque cada uma em uma nova linha com um emoji na frente.
3. **Mencione TODAS as Peças**: Você PRECISA citar individualmente e fazer um pitch rápido para TODAS as peças presentes na [LISTA OFICIAL]. Não resuma, cite o nome delas!
4. **Naturalidade Total**: NUNCA exponha "ID: xxxx". NUNCA use "Com base nas suas solicitações". Aja como uma amiga e personal stylist (ex: "Menina, para esse evento de dia eu iria fácil nessas opções aqui...").
5. **Fechamento**: Termine SEMPRE com uma pergunta natural para continuar o papo. ("Dessas opções, qual linha atrai mais seu curte mais?" ou "Quer tentar algo mais acinturado?").
6. **Vazia?**: Se a [LISTA OFICIAL] estiver VAZIA, assuma a culpa com polidez. Diga que hoje no estoque desse perfil estava esgotada a peça ideal e tente sugerir outra pegada para salvar a venda.

Você DEVE retornar APENAS este formato JSON:
{
  "text": "Seu texto final incrivelmente diagramado com \n\n e emojis aqui..."
}`;

        const writerResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: writerSystemPrompt },
                    ...historyMessages, // Passa o contexto da conversa inteira
                    { role: "user", content: input_text },
                ],
                max_tokens: 600,
                temperature: 0.5,
                response_format: { type: "json_object" }
            }),
        });

        if (!writerResponse.ok) throw new Error(`OpenAI Writer Error: ${writerResponse.status}`);
        
        const writerData = await writerResponse.json();
        const writerContentStr = writerData.choices?.[0]?.message?.content;
        if (!writerContentStr) throw new Error("Empty response from OpenAI Writer");
        
        let writerContent;
        try {
            const cleanStr = writerContentStr.replace(/```json/g, "").replace(/```/g, "").trim();
            writerContent = JSON.parse(cleanStr);
        } catch (e) {
            console.error("Failed to parse Writer JSON:", writerContentStr);
            writerContent = { text: "Aqui estão algumas opções incríveis para o seu perfil!" };
        }
        writerContent.type = finalIds.length > 0 ? "look" : "chat";
        writerContent.products = finalIds;
        writerContent.title = filters.occasion ? filters.occasion.toUpperCase() : "SUGESTÃO LE.POÁ";

        if (authenticatedUserId && finalIds.length > 0) {
            const { error: insertError } = await supabase.from("ai_look_sessions").insert({
                user_id: authenticatedUserId,
                session_id: session_id || null,
                input_text,
                generated_title: writerContent.title,
                generated_description: writerContent.text,
                generated_product_ids: writerContent.products
            });
            if (insertError) {
                console.error("Error saving session:", insertError);
            }
        }

        return new Response(JSON.stringify({ success: true, data: writerContent }), { headers: jsonHeaders });

    } catch (err: any) {
        console.error("AI Look Error:", err);
        return new Response(JSON.stringify({ 
            success: false, 
            error: err.message || "Tive uma instabilidade temporária ao buscar suas peças.",
            details: String(err)
        }), { 
            status: 200, // Retornar 200 pro front não cair no catch(err) dele 
            headers: jsonHeaders 
        });
    }
});
