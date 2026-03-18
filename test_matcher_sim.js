import { findMatchingProductsWithFallback } from './src/lib/productMatcher';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function testMatch() {
    console.log('Fetching products...');
    const { data: products } = await supabase.from('product_catalog').select('*');

    const analysis = {
        categoria: { value: "vestido", confidence: 0.99 },
        cor: { value: "azul", confidence: 0.99 },
        estilo: { value: "elegante", confidence: 0.9 },
        ocasiao: { value: "eventos", confidence: 0.8 },
        modelagem: { value: "longo", confidence: 0.9 },
        tags_extras: ["alças largas", "flor decorativa", "decote"],
        resumo_visual: "Vestido longo azul com alças largas e flor decorativa no decote."
    };

    const options = {
        letterSizes: ["P"],
        numberSizes: ["38"],
        refinementMode: "default"
    };

    console.log('Running matcher...');
    const result = findMatchingProductsWithFallback(products, analysis, options);

    console.log('--- IDENTIFIED PRODUCT ---');
    console.log(result.identifiedProduct ? `${result.identifiedProduct.name} (Score: ${result.identifiedProduct.score})` : 'None');
    if (result.identifiedProduct) {
        console.log('Match Details:', result.identifiedProduct.matchDetails);
        console.log('Match Reasons:', result.identifiedProduct.matchReasons);
    }

    console.log('\n--- ALTERNATIVES ---');
    result.alternatives.slice(0, 3).forEach(p => {
        console.log(`${p.name} (Score: ${p.score}) - Reasons: ${p.matchReasons.join(', ')}`);
    });
}

testMatch();
