import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ========== AUTH HELPER ==========
async function requireAuth(req: Request): Promise<{ userId: string; error?: undefined } | { userId?: undefined; error: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { error: new Response(JSON.stringify({ error: "Sessão inválida" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }
  return { userId: data.user.id };
}

interface BusinessMetrics {
  paymentBehavior: {
    avgTimeToPayHours: number;
    paidRate: number;
    canceledRate: number;
    expiredRate: number;
    totalCarts: number;
  };
  liveConversion: {
    avgConversionTimeMinutes: number;
    conversionRate: number;
    topPerformingHour: string;
    worstPerformingHour: string;
  };
  abandonmentPatterns: {
    topAbandonedProducts: { name: string; size: string; count: number }[];
    avgAbandonmentRate: number;
  };
  customerBehavior: {
    newVsReturning: { new: number; returning: number };
    returningCustomerRevenue: number;
    newCustomerRevenue: number;
    avgOrdersReturning: number;
  };
  waitlistImpact: {
    waitlistConversions: number;
    totalWaitlistEntries: number;
  };
  livePerformance: {
    peakHours: string[];
    revenueByHour: { hour: string; revenue: number }[];
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ========== AUTH CHECK ==========
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  // ========== ROLE CHECK: merchant/admin only ==========
  const roleClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roleData } = await roleClient
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.userId)
    .in("role", ["merchant", "admin"]);
  
  if (!roleData || roleData.length === 0) {
    return new Response(JSON.stringify({ error: "Acesso restrito a administradores" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Date range: last 7 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    // Fetch all relevant data in parallel
    const [liveCartsResult, ordersResult, customersResult, waitlistResult, liveEventsResult] = await Promise.all([
      supabase.from("live_carts").select(`*, live_customer:live_customers(instagram_handle, client_id), items:live_cart_items(product_id, variante, qtd, status)`).gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
      supabase.from("orders").select("*").gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
      supabase.from("customers").select("*").order("total_orders", { ascending: false }).limit(100),
      supabase.from("live_waitlist").select("*").gte("created_at", startDate.toISOString()),
      supabase.from("live_events").select("*").gte("created_at", startDate.toISOString()),
    ]);

    const liveCarts = liveCartsResult.data || [];
    const orders = ordersResult.data || [];
    const customers = customersResult.data || [];
    const waitlist = waitlistResult.data || [];
    const liveEvents = liveEventsResult.data || [];

    const metrics: BusinessMetrics = calculateMetrics(liveCarts, orders, customers, waitlist, liveEvents);
    const insights = await generateAIInsights(metrics, LOVABLE_API_KEY);

    // Store insights
    const today = new Date().toISOString().split("T")[0];
    const { data: existingInsight } = await supabase.from("ai_business_insights").select("id").eq("insight_date", today).maybeSingle();

    if (existingInsight) {
      await supabase.from("ai_business_insights").update({ insights, raw_metrics: metrics, analysis_period_start: startDate.toISOString(), analysis_period_end: endDate.toISOString(), updated_at: new Date().toISOString() }).eq("id", existingInsight.id);
    } else {
      await supabase.from("ai_business_insights").insert({ insight_date: today, insights, raw_metrics: metrics, analysis_period_start: startDate.toISOString(), analysis_period_end: endDate.toISOString() });
    }

    return new Response(JSON.stringify({ success: true, insights, period: { start: startDate.toISOString(), end: endDate.toISOString() } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error generating insights:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function calculateMetrics(liveCarts: any[], orders: any[], customers: any[], waitlist: any[], liveEvents: any[]): BusinessMetrics {
  const paidCarts = liveCarts.filter((c) => c.status === "pago");
  const canceledCarts = liveCarts.filter((c) => c.status === "cancelado");
  const expiredCarts = liveCarts.filter((c) => c.status === "expirado");
  
  const avgTimeToPayHours = paidCarts.length > 0
    ? paidCarts.reduce((sum, c) => {
        const created = new Date(c.created_at).getTime();
        const updated = new Date(c.updated_at).getTime();
        return sum + (updated - created) / (1000 * 60 * 60);
      }, 0) / paidCarts.length
    : 0;

  const cartsByHour: Record<string, { total: number; paid: number; revenue: number }> = {};
  liveCarts.forEach((cart) => {
    const hour = new Date(cart.created_at).getHours();
    const hourKey = `${hour}h`;
    if (!cartsByHour[hourKey]) cartsByHour[hourKey] = { total: 0, paid: 0, revenue: 0 };
    cartsByHour[hourKey].total++;
    if (cart.status === "pago") { cartsByHour[hourKey].paid++; cartsByHour[hourKey].revenue += cart.total || 0; }
  });

  const hourlyConversion = Object.entries(cartsByHour).map(([hour, data]) => ({ hour, rate: data.total > 0 ? data.paid / data.total : 0, revenue: data.revenue })).sort((a, b) => b.rate - a.rate);

  const abandonedItems: Record<string, { name: string; size: string; count: number }> = {};
  liveCarts.filter((c) => ["cancelado", "expirado"].includes(c.status)).forEach((cart) => {
    (cart.items || []).forEach((item: any) => {
      const key = `${item.product_id}-${item.variante?.tamanho || "N/A"}`;
      if (!abandonedItems[key]) abandonedItems[key] = { name: item.variante?.nome || "Produto", size: item.variante?.tamanho || "N/A", count: 0 };
      abandonedItems[key].count += item.qtd || 1;
    });
  });

  const topAbandoned = Object.values(abandonedItems).sort((a, b) => b.count - a.count).slice(0, 5);
  const customersWithOrders = customers.filter((c) => c.total_orders > 0);
  const returningCustomers = customersWithOrders.filter((c) => c.total_orders > 1);
  const newCustomers = customersWithOrders.filter((c) => c.total_orders === 1);
  const waitlistConversions = waitlist.filter((w) => w.status === "atendida").length;
  const revenueByHour = Object.entries(cartsByHour).map(([hour, data]) => ({ hour, revenue: data.revenue })).sort((a, b) => b.revenue - a.revenue);
  const peakHours = revenueByHour.slice(0, 3).map((h) => h.hour);

  return {
    paymentBehavior: { avgTimeToPayHours: Math.round(avgTimeToPayHours * 10) / 10, paidRate: liveCarts.length > 0 ? paidCarts.length / liveCarts.length : 0, canceledRate: liveCarts.length > 0 ? canceledCarts.length / liveCarts.length : 0, expiredRate: liveCarts.length > 0 ? expiredCarts.length / liveCarts.length : 0, totalCarts: liveCarts.length },
    liveConversion: { avgConversionTimeMinutes: avgTimeToPayHours * 60, conversionRate: liveCarts.length > 0 ? paidCarts.length / liveCarts.length : 0, topPerformingHour: hourlyConversion[0]?.hour || "N/A", worstPerformingHour: hourlyConversion[hourlyConversion.length - 1]?.hour || "N/A" },
    abandonmentPatterns: { topAbandonedProducts: topAbandoned, avgAbandonmentRate: liveCarts.length > 0 ? (canceledCarts.length + expiredCarts.length) / liveCarts.length : 0 },
    customerBehavior: { newVsReturning: { new: newCustomers.length, returning: returningCustomers.length }, returningCustomerRevenue: returningCustomers.reduce((sum, c) => sum + (c.total_spent || 0), 0), newCustomerRevenue: newCustomers.reduce((sum, c) => sum + (c.total_spent || 0), 0), avgOrdersReturning: returningCustomers.length > 0 ? returningCustomers.reduce((sum, c) => sum + c.total_orders, 0) / returningCustomers.length : 0 },
    waitlistImpact: { waitlistConversions, totalWaitlistEntries: waitlist.length },
    livePerformance: { peakHours, revenueByHour },
  };
}

async function generateAIInsights(metrics: BusinessMetrics, apiKey: string): Promise<string[]> {
  const systemPrompt = `Você é um consultor de negócios premium para uma loja de moda feminina que vende via Instagram Lives.
Sua tarefa é gerar 3 a 5 insights ESTRATÉGICOS e ACIONÁVEIS baseados nos dados fornecidos.
REGRAS: NÃO repita números diretamente. Use linguagem consultiva. Foque em PADRÕES OCULTOS. Cada insight máx 2 frases.`;

  const userPrompt = `Analise estes dados dos últimos 7 dias:
PAGAMENTO: Taxa pagamento: ${(metrics.paymentBehavior.paidRate * 100).toFixed(1)}%, Cancelamento: ${(metrics.paymentBehavior.canceledRate * 100).toFixed(1)}%, Expiração: ${(metrics.paymentBehavior.expiredRate * 100).toFixed(1)}%, Tempo médio: ${metrics.paymentBehavior.avgTimeToPayHours}h, Total: ${metrics.paymentBehavior.totalCarts}
CONVERSÃO: Melhor: ${metrics.liveConversion.topPerformingHour}, Pior: ${metrics.liveConversion.worstPerformingHour}, Taxa: ${(metrics.liveConversion.conversionRate * 100).toFixed(1)}%
ABANDONO: Taxa: ${(metrics.abandonmentPatterns.avgAbandonmentRate * 100).toFixed(1)}%
CLIENTES: Novos: ${metrics.customerBehavior.newVsReturning.new}, Recorrentes: ${metrics.customerBehavior.newVsReturning.returning}
PICO: ${metrics.livePerformance.peakHours.join(", ") || "N/A"}
Retorne APENAS um array JSON com 3 a 5 strings.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], temperature: 0.7 }),
    });
    if (!response.ok) return getDefaultInsights(metrics);
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const match = content.match(/\[[\s\S]*\]/);
    if (match) { const parsed = JSON.parse(match[0]); if (Array.isArray(parsed) && parsed.length >= 3) return parsed.slice(0, 5); }
    return getDefaultInsights(metrics);
  } catch { return getDefaultInsights(metrics); }
}

function getDefaultInsights(metrics: BusinessMetrics): string[] {
  const insights: string[] = [];
  if (metrics.paymentBehavior.expiredRate > 0.3) insights.push("Pode haver oportunidade de ajustar o timing de follow-up.");
  if (metrics.customerBehavior.newVsReturning.returning > metrics.customerBehavior.newVsReturning.new) insights.push("A base de clientes fiéis parece estar respondendo bem.");
  if (metrics.livePerformance.peakHours.length > 0) insights.push("Os horários de maior engajamento merecem atenção especial.");
  if (insights.length < 3) insights.push("O período analisado pode revelar padrões interessantes com mais dados.");
  return insights.slice(0, 5);
}
