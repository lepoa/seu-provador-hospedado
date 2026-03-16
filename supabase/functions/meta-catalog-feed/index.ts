import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch products
    const { data: products, error } = await supabase
      .from('product_catalog')
      .select('id, name, description, price, image_url, images, main_image_index, is_active, color')
      .eq('is_active', true)

    if (error) {
      throw error
    }

    const { data: stocks, error: stockError } = await supabase
      .from('product_available_stock')
      .select('product_id, size, available');

    const stockMap = new Map();
    if (!stockError && stocks) {
       for (const s of stocks) {
          if (!stockMap.has(s.product_id)) stockMap.set(s.product_id, []);
          stockMap.get(s.product_id).push(s);
       }
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n`;
    xml += `  <channel>\n`;
    xml += `    <title>Catálogo Le.Poá</title>\n`;
    xml += `    <link>https://lepoa.online</link>\n`;
    xml += `    <description>Catálogo unificado de peças Le.Poá gerado automaticamente.</description>\n`;

    for (const product of products) {
      const id = product.id;
      const title = escapeXml(product.name || "Produto Le.Poá");
      const description = escapeXml(product.description || title);
      const price = parseFloat(product.price || 0).toFixed(2);
      
      let imageUrl = product.image_url;
      if (!imageUrl && product.images && product.images.length > 0) {
        imageUrl = product.images[product.main_image_index || 0] || product.images[0];
      }
      imageUrl = imageUrl ? escapeXml(imageUrl) : "https://lepoa.online/placeholder.png";
      
      const link = escapeXml(`https://lepoa.online/produto/${id}`);
      
      const variants = stockMap.get(id) || [];
      const color = escapeXml(product.color || extractColorFromName(product.name));
      const googleCategory = "212"; // 212 = Apparel & Accessories > Clothing

      if (variants.length === 0) {
        // Fallback for products without size tracked
        xml += `    <item>\n`;
        xml += `      <g:id>${id}</g:id>\n`;
        xml += `      <g:title>${title}</g:title>\n`;
        xml += `      <g:description>${description}</g:description>\n`;
        xml += `      <g:availability>in stock</g:availability>\n`;
        xml += `      <g:condition>new</g:condition>\n`;
        xml += `      <g:price>${price} BRL</g:price>\n`;
        xml += `      <g:link>${link}</g:link>\n`;
        xml += `      <g:image_link>${imageUrl}</g:image_link>\n`;
        xml += `      <g:brand>Le.Poá</g:brand>\n`;
        xml += `      <g:color>${color}</g:color>\n`;
        xml += `      <g:google_product_category>${googleCategory}</g:google_product_category>\n`;
        xml += `    </item>\n`;
      } else {
        // Emit one product variation per size
        for (const variant of variants) {
          const variantId = escapeXml(`${id}_${variant.size}`);
          const availability = variant.available > 0 ? "in stock" : "out of stock";
          const size = escapeXml(variant.size);

          xml += `    <item>\n`;
          xml += `      <g:id>${variantId}</g:id>\n`;
          xml += `      <g:item_group_id>${id}</g:item_group_id>\n`;
          xml += `      <g:title>${title} - ${size}</g:title>\n`;
          xml += `      <g:description>${description}</g:description>\n`;
          xml += `      <g:availability>${availability}</g:availability>\n`;
          xml += `      <g:condition>new</g:condition>\n`;
          xml += `      <g:price>${price} BRL</g:price>\n`;
          xml += `      <g:link>${link}</g:link>\n`;
          xml += `      <g:image_link>${imageUrl}</g:image_link>\n`;
          xml += `      <g:brand>Le.Poá</g:brand>\n`;
          xml += `      <g:size>${size}</g:size>\n`;
          xml += `      <g:color>${color}</g:color>\n`;
          xml += `      <g:google_product_category>${googleCategory}</g:google_product_category>\n`;
          xml += `    </item>\n`;
        }
      }
    }

    xml += `  </channel>\n`;
    xml += `</rss>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate'
      },
      status: 200,
    })

  } catch (err: any) {
    console.error('Error generating XML feed:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

function extractColorFromName(name: string): string {
  if (!name) return "Única";
  const n = name.toLowerCase();
  const colors = [
    "preto", "preta", "branco", "branca", "off white", "off-white", "rosa", "azul",
    "verde", "amarelo", "amarela", "vermelho", "vermelha", "roxo", "roxa", "lilás", "lilas",
    "marrom", "bege", "nude", "cinza", "prata", "dourado", "dourada", "laranja", "coral",
    "marsala", "mostarda", "marinho", "oliva", "pink", "fúcsia", "fucsia", "estampado", "estampada"
  ];
  
  for (const c of colors) {
    if (n.includes(c)) {
      return c.charAt(0).toUpperCase() + c.slice(1); // Capitalize
    }
  }
  return "Única"; // Default if no color found
}

function escapeXml(unsafe: string) {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
    }
    return c;
  });
}
