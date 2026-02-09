import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GetLiveCartPublicRequest {
  live_cart_id: string;
  public_token?: string;
  // Legacy: bagId used by BagTracker (merchant-side, will be authenticated)
  bagId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const body: GetLiveCartPublicRequest = await req.json();
    
    // Support both live_cart_id and bagId (legacy BagTracker)
    const live_cart_id = body?.live_cart_id || body?.bagId;

    if (!live_cart_id || typeof live_cart_id !== "string") {
      return new Response(JSON.stringify({ error: "live_cart_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(live_cart_id)) {
      return new Response(JSON.stringify({ error: "Formato inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Determine access method:
    // 1. If public_token is provided → public checkout access (anon)
    // 2. If Authorization header → authenticated merchant/admin access
    // 3. Otherwise → reject
    const authHeader = req.headers.get("Authorization");
    const public_token = body?.public_token;
    let isAuthenticated = false;

    if (public_token) {
      // Validate token format
      if (typeof public_token !== "string" || !uuidRegex.test(public_token)) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Will verify token against DB below
    } else if (authHeader?.startsWith("Bearer ")) {
      // Authenticated user (merchant using BagTracker, etc.)
      const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await anonClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      isAuthenticated = true;
    } else {
      return new Response(JSON.stringify({ error: "Token ou autenticação necessários" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch cart with token validation
    let cartQuery = supabase
      .from("live_carts")
      .select(
        `
          id,
          bag_number,
          status,
          total,
          frete,
          mp_checkout_url,
          created_at,
          order_id,
          public_token,
          live_event:live_events(titulo),
          live_customer:live_customers(instagram_handle, nome, whatsapp)
        `
      )
      .eq("id", live_cart_id);

    // If using public_token, validate it matches
    if (public_token && !isAuthenticated) {
      cartQuery = cartQuery.eq("public_token", public_token);
    }

    const { data: cart, error: cartError } = await cartQuery.maybeSingle();

    if (cartError) {
      console.error("Error fetching live cart:", cartError);
      return new Response(JSON.stringify({ error: "Erro ao buscar sacola" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!cart) {
      return new Response(JSON.stringify({ error: "Sacola não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch delivery method from linked order
    let delivery_method: string | null = null;
    if (cart.order_id) {
      const { data: order } = await supabase
        .from("orders")
        .select("delivery_method")
        .eq("id", cart.order_id)
        .maybeSingle();
      delivery_method = (order?.delivery_method as string) || null;
    }

    // Fetch items
    const { data: items, error: itemsError } = await supabase
      .from("live_cart_items")
      .select(
        `
          id,
          qtd,
          preco_unitario,
          status,
          variante,
          product:product_catalog(name)
        `
      )
      .eq("live_cart_id", live_cart_id)
      .in("status", ["reservado", "confirmado", "expirado"]);

    if (itemsError) {
      console.error("Error fetching live cart items:", itemsError);
      return new Response(JSON.stringify({ error: "Erro ao buscar itens" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeItems = (items || []).map((item: any) => ({
      id: item.id,
      productName: item.product?.name ?? "Produto",
      color: item.variante?.cor ?? null,
      size: item.variante?.tamanho ?? null,
      quantity: item.qtd ?? 1,
      unitPrice: Number(item.preco_unitario ?? 0),
      status: item.status,
    }));

    const totalItems = safeItems.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0);

    const liveCustomer = Array.isArray((cart as any).live_customer)
      ? (cart as any).live_customer[0]
      : (cart as any).live_customer;
    const liveEvent = Array.isArray((cart as any).live_event)
      ? (cart as any).live_event[0]
      : (cart as any).live_event;

    // For BagTracker (legacy format) - authenticated merchants
    if (body?.bagId && isAuthenticated) {
      return new Response(
        JSON.stringify({
          bag: {
            id: cart.id,
            bag_number: cart.bag_number,
            status: cart.status,
            total: cart.total,
            mp_checkout_url: cart.mp_checkout_url,
            created_at: cart.created_at,
            order_id: cart.order_id,
            live_customers: liveCustomer,
            live_events: liveEvent,
          },
          items: safeItems,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Standard public format
    return new Response(
      JSON.stringify({
        id: cart.id,
        bagNumber: cart.bag_number ?? 0,
        instagramHandle: liveCustomer?.instagram_handle ?? "@cliente",
        customerName: liveCustomer?.nome ?? null,
        status: cart.status,
        totalItems,
        subtotal: Number(cart.total ?? 0) - Number(cart.frete ?? 0),
        totalValue: Number(cart.total ?? 0),
        frete: Number(cart.frete ?? 0),
        items: safeItems,
        deliveryMethod: delivery_method,
        mpCheckoutUrl: cart.mp_checkout_url ?? null,
        eventTitle: liveEvent?.titulo ?? "Live",
        createdAt: cart.created_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
