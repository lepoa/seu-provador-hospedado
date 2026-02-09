import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This is an internal/cron function. We validate via a shared secret OR auth token.
async function requireAuthOrCronSecret(req: Request): Promise<{ ok: boolean; error?: Response }> {
  // Allow if called with a valid auth token (merchant/admin calling manually)
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) return { ok: true };
  }
  
  // Allow if called with service role key (internal cron)
  if (authHeader === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return { ok: true };
  }

  return { ok: false, error: new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const auth = await requireAuthOrCronSecret(req);
  if (!auth.ok) return auth.error!;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[expire-reservations] Running reservation expiration check...');

    const { data, error } = await supabase.rpc('expire_order_reservations');

    if (error) {
      console.error('[expire-reservations] Error:', error);
      throw error;
    }

    const expiredCount = data?.length || 0;
    console.log(`[expire-reservations] Expired ${expiredCount} reservation(s)`);

    if (expiredCount > 0) {
      const liveExpired = data.filter((r: any) => r.order_source === 'live').length;
      if (liveExpired > 0) console.log(`[expire-reservations] ${liveExpired} live order(s) marked for physical cancellation`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        expired_count: expiredCount,
        expired_orders: data || [],
        live_orders_needing_attention: data?.filter((r: any) => r.order_source === 'live').length || 0,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[expire-reservations] Error:', errorMessage);
    return new Response(JSON.stringify({ success: false, error: errorMessage, timestamp: new Date().toISOString() }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
