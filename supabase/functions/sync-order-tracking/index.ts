import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const melhorEnvioToken = Deno.env.get('MELHOR_ENVIO_TOKEN');
    if (!melhorEnvioToken) {
      return new Response(JSON.stringify({ error: "Configuração de envio não encontrada" }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Corpo da requisição inválido" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

    const orderId = typeof body.orderId === "string" ? body.orderId : undefined;
    if (!orderId || orderId.length < 10 || orderId.length > 50) {
      return new Response(JSON.stringify({ error: "orderId é obrigatório e deve ser um UUID válido" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[sync-order-tracking] Syncing tracking for order: ${orderId}`);

    const { data: order, error: orderError } = await supabase.from("orders").select("id, me_shipment_id, tracking_code, address_snapshot").eq("id", orderId).single();
    if (orderError || !order) return new Response(JSON.stringify({ error: "Pedido não encontrado" }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (order.tracking_code) return new Response(JSON.stringify({ success: true, tracking_code: order.tracking_code, already_synced: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!order.me_shipment_id) return new Response(JSON.stringify({ error: "Etiqueta ainda não foi gerada" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const shipmentId = order.me_shipment_id;
    const isCorreiosTracking = (code: string) => /^[A-Z]{2}\d{9}BR$/.test(code);
    const isNumericTracking = (code: string) => /^\d{8,20}$/.test(code);
    const isValidTrackingCode = (code: string) => { if (!code || code.startsWith('ORD')) return false; return isCorreiosTracking(code) || isNumericTracking(code); };
    
    const extractTracking = (obj: Record<string, unknown>): string => {
      if (!obj || typeof obj !== 'object') return "";
      for (const field of ['tracking', 'tracking_code', 'tracking_number', 'authorization_code', 'self_tracking', 'codigo_rastreio', 'objeto']) {
        const value = obj[field]; if (typeof value === 'string' && isValidTrackingCode(value)) return value;
      }
      if (obj.shipment && typeof obj.shipment === 'object') { const n = extractTracking(obj.shipment as Record<string, unknown>); if (n) return n; }
      const protocol = obj.protocol; if (typeof protocol === 'string' && isValidTrackingCode(protocol)) return protocol;
      return "";
    };

    let trackingCode = "";

    try {
      const trackingResponse = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/tracking', { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': `Bearer ${melhorEnvioToken}`, 'User-Agent': 'LepoaApp/1.0' }, body: JSON.stringify({ orders: [shipmentId] }) });
      const trackingData = await trackingResponse.json();
      const sd = trackingData[shipmentId];
      if (sd && typeof sd === 'object') trackingCode = extractTracking(sd as Record<string, unknown>);
      if (!trackingCode) trackingCode = extractTracking(trackingData as Record<string, unknown>);
    } catch (e) { console.error("Tracking endpoint error:", e); }
    
    if (!trackingCode) {
      try {
        const r = await fetch(`https://melhorenvio.com.br/api/v2/me/orders/${shipmentId}`, { headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${melhorEnvioToken}`, 'User-Agent': 'LepoaApp/1.0' } });
        trackingCode = extractTracking(await r.json() as Record<string, unknown>);
      } catch (e) { console.error("Shipment detail error:", e); }
    }
    
    if (trackingCode && !isValidTrackingCode(trackingCode)) trackingCode = "";

    if (!trackingCode) return new Response(JSON.stringify({ error: "Rastreio ainda não disponível", status: "tracking_not_found" }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const currentSnapshot = order.address_snapshot as Record<string, unknown> || {};
    await supabase.from("orders").update({ tracking_code: trackingCode, address_snapshot: { ...currentSnapshot, tracking_code: trackingCode }, updated_at: new Date().toISOString() }).eq("id", orderId);

    return new Response(JSON.stringify({ success: true, tracking_code: trackingCode, shipment_id: shipmentId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error("Sync tracking error:", error);
    return new Response(JSON.stringify({ error: "Erro interno ao sincronizar rastreio" }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
