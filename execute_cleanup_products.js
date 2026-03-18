import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function cleanup() {
    const today = '2026-03-10';
    console.log(`Final product cleanup for data created on ${today}...`);

    try {
        const { data: products } = await supabase.from('product_catalog').select('id').gte('created_at', today);
        const productIds = products?.map(p => p.id) || [];

        if (productIds.length > 0) {
            console.log(`Clearing waitlist for ${productIds.length} products...`);
            await supabase.from('live_waitlist').delete().in('product_id', productIds);

            console.log('Deleting products...');
            const { error: prodError } = await supabase.from('product_catalog').delete().in('id', productIds);
            if (prodError) throw prodError;
            console.log('Test products deleted successfully.');
        } else {
            console.log('No products found to delete.');
        }

        console.log('\n--- CLEANUP COMPLETE ---');
    } catch (err) {
        console.error('Final cleanup failed:', err.message);
    }
}

cleanup();
