import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ShippingRequest {
  toZipCode?: string;
  to_zip?: string; // Alternative param name
  weight?: number;
  height?: number;
  width?: number;
  length?: number;
}

// Default dimensions if not provided (MVP fallback)
const DEFAULT_WEIGHT = 0.5; // kg
const DEFAULT_HEIGHT = 10;  // cm
const DEFAULT_WIDTH = 20;   // cm
const DEFAULT_LENGTH = 30;  // cm

// Store origin ZIP code (Anápolis, GO)
const ORIGIN_ZIP_CODE = "75024050";

interface MelhorEnvioQuote {
  id: number;
  name: string;
  price: string;
  custom_price: string;
  discount: string;
  currency: string;
  delivery_time: number;
  delivery_range: { min: number; max: number };
  custom_delivery_time: number;
  custom_delivery_range: { min: number; max: number };
  packages: unknown[];
  company: { id: number; name: string; picture: string };
  error?: string;
}

interface ErrorResponse {
  error: string;
  details?: string;
  debugInfo?: Record<string, unknown>;
}

function logRequest(message: string, data?: unknown) {
  console.log(`[SHIPPING] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

function buildErrorResponse(
  status: number, 
  error: string, 
  details?: string, 
  debugInfo?: Record<string, unknown>
): Response {
  const body: ErrorResponse = { error };
  if (details) body.details = details;
  if (debugInfo) body.debugInfo = debugInfo;
  
  logRequest(`Error response (${status}):`, body);
  
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  logRequest("=== Shipping calculation started ===");

  try {
    // === Authentication: require any authenticated user ===
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return buildErrorResponse(401, "Unauthorized", "Authorization header missing");
    }
    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return buildErrorResponse(401, "Invalid session", "Token inválido ou expirado");
    }

    // Check for Melhor Envio token
    const melhorEnvioToken = Deno.env.get('MELHOR_ENVIO_TOKEN');
    if (!melhorEnvioToken) {
      logRequest("ERROR: Missing MELHOR_ENVIO_TOKEN secret");
      return buildErrorResponse(
        500, 
        "Configuração de frete não encontrada",
        "Token do Melhor Envio não configurado",
        { missingSecret: "MELHOR_ENVIO_TOKEN" }
      );
    }

    // Parse request body
    let requestBody: ShippingRequest;
    try {
      requestBody = await req.json();
      logRequest("Request body received:", requestBody);
    } catch (parseError) {
      logRequest("ERROR: Failed to parse request body", parseError);
      return buildErrorResponse(
        400,
        "Corpo da requisição inválido",
        "O corpo da requisição deve ser um JSON válido"
      );
    }

    // Extract and normalize parameters (support both naming conventions)
    const toZipCode = requestBody.toZipCode || requestBody.to_zip;
    const weight = requestBody.weight ?? DEFAULT_WEIGHT;
    const height = requestBody.height ?? DEFAULT_HEIGHT;
    const width = requestBody.width ?? DEFAULT_WIDTH;
    const length = requestBody.length ?? DEFAULT_LENGTH;

    // Validate destination ZIP
    if (!toZipCode) {
      return buildErrorResponse(
        400,
        "CEP de destino é obrigatório",
        "Informe o CEP de destino para calcular o frete",
        { receivedParams: requestBody }
      );
    }

    // Clean zip code (remove non-digits)
    const cleanZip = toZipCode.toString().replace(/\D/g, '');
    if (cleanZip.length !== 8) {
      return buildErrorResponse(
        400,
        "CEP inválido",
        `O CEP deve ter 8 dígitos. Recebido: "${toZipCode}" (${cleanZip.length} dígitos após limpeza)`,
        { originalZip: toZipCode, cleanedZip: cleanZip }
      );
    }

    // Validate weight
    const numWeight = Number(weight);
    if (isNaN(numWeight) || numWeight <= 0) {
      return buildErrorResponse(
        400,
        "Peso inválido",
        `O peso deve ser um número positivo. Recebido: ${weight}`,
        { weight }
      );
    }

    // Validate dimensions
    const numHeight = Number(height);
    const numWidth = Number(width);
    const numLength = Number(length);

    if (isNaN(numHeight) || numHeight < 2 || numHeight > 100 ||
        isNaN(numWidth) || numWidth < 11 || numWidth > 100 ||
        isNaN(numLength) || numLength < 16 || numLength > 100) {
      logRequest("Dimensions out of range, using defaults", { height, width, length });
      // Don't fail, just use defaults
    }

    // Prepare validated dimensions (ensure within Correios limits)
    const safeHeight = Math.max(2, Math.min(100, numHeight || DEFAULT_HEIGHT));
    const safeWidth = Math.max(11, Math.min(100, numWidth || DEFAULT_WIDTH));
    const safeLength = Math.max(16, Math.min(100, numLength || DEFAULT_LENGTH));
    const safeWeight = Math.max(0.1, Math.min(30, numWeight));

    logRequest(`Shipping params:`, {
      from: ORIGIN_ZIP_CODE,
      to: cleanZip,
      weight: safeWeight,
      dimensions: `${safeLength}x${safeWidth}x${safeHeight}cm`
    });

    // Build Melhor Envio payload
    const mePayload = {
      from: { postal_code: ORIGIN_ZIP_CODE },
      to: { postal_code: cleanZip },
      products: [
        {
          id: "package-1",
          width: safeWidth,
          height: safeHeight,
          length: safeLength,
          weight: safeWeight,
          insurance_value: 100,
          quantity: 1
        }
      ],
      services: "1,2" // 1 = PAC, 2 = SEDEX
    };

    logRequest("Calling Melhor Envio API with payload:", mePayload);

    // Call Melhor Envio API for quotes
    const response = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/calculate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${melhorEnvioToken}`,
        'User-Agent': 'LepoaApp/1.0'
      },
      body: JSON.stringify(mePayload)
    });

    const responseText = await response.text();
    logRequest(`Melhor Envio response status: ${response.status}`);
    logRequest(`Melhor Envio response body:`, responseText);

    // Parse response
    let data: MelhorEnvioQuote[];
    try {
      data = JSON.parse(responseText);
    } catch (jsonError) {
      logRequest("ERROR: Failed to parse Melhor Envio response as JSON", jsonError);
      return buildErrorResponse(
        500,
        "Erro ao processar resposta do serviço de frete",
        "A resposta do Melhor Envio não é um JSON válido",
        { responseStatus: response.status, responseBody: responseText.slice(0, 500) }
      );
    }

    if (!response.ok) {
      logRequest("ERROR: Melhor Envio API returned error status", { status: response.status, body: data });
      
      // Try to extract meaningful error message
      let errorMessage = "Erro ao calcular frete";
      if (typeof data === 'object' && data !== null) {
        if ('message' in data) errorMessage = String((data as any).message);
        else if ('error' in data) errorMessage = String((data as any).error);
      }
      
      return buildErrorResponse(
        500,
        errorMessage,
        `Melhor Envio retornou status ${response.status}`,
        { apiStatus: response.status, apiResponse: data }
      );
    }

    // Check if response is an array
    if (!Array.isArray(data)) {
      logRequest("ERROR: Unexpected Melhor Envio response format (not array)", data);
      return buildErrorResponse(
        500,
        "Formato de resposta inesperado",
        "O Melhor Envio retornou dados em formato inválido",
        { receivedType: typeof data, data }
      );
    }

    // Filter valid quotes (no errors) and format response
    const quotes = data
      .filter(q => !q.error && q.price)
      .map(q => ({
        id: String(q.id),
        service: q.name?.toLowerCase().includes('sedex') ? 'SEDEX' : 'PAC',
        serviceName: q.name,
        name: q.name,
        price: parseFloat(q.custom_price || q.price),
        deliveryDays: q.custom_delivery_time || q.delivery_time,
        deliveryTime: q.custom_delivery_time || q.delivery_time,
        deliveryRange: q.custom_delivery_range || q.delivery_range,
        company: q.company?.name || 'Correios'
      }))
      .sort((a, b) => a.price - b.price);

    // Log quotes with errors for debugging
    const failedQuotes = data.filter(q => q.error);
    if (failedQuotes.length > 0) {
      logRequest("Some quotes returned errors:", failedQuotes.map(q => ({ name: q.name, error: q.error })));
    }

    const elapsed = Date.now() - startTime;
    logRequest(`=== Shipping calculation complete (${elapsed}ms) ===`, { 
      quotesReturned: quotes.length, 
      failedQuotes: failedQuotes.length 
    });

    if (quotes.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "Não foi possível calcular o frete para este CEP",
          details: failedQuotes.length > 0 
            ? `Serviços indisponíveis: ${failedQuotes.map(q => `${q.name}: ${q.error}`).join('; ')}`
            : "Nenhum serviço disponível para esta rota",
          quotes: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        quotes,
        debug: {
          originZip: ORIGIN_ZIP_CODE,
          destinationZip: cleanZip,
          weight: safeWeight,
          dimensions: { length: safeLength, width: safeWidth, height: safeHeight },
          elapsedMs: elapsed
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const elapsed = Date.now() - startTime;
    logRequest(`FATAL ERROR after ${elapsed}ms:`, error);
    
    return buildErrorResponse(
      500,
      "Erro interno ao calcular frete",
      error instanceof Error ? error.message : "Erro desconhecido",
      { errorType: error?.constructor?.name, elapsed }
    );
  }
});
