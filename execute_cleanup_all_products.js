import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function cleanupAllProducts() {
    console.log('Starting total product cleanup (Active + Archived)...');

    try {
        const { data: allProducts } = await supabase.from('product_catalog').select('id');
        const productIds = allProducts?.map(p => p.id) || [];

        if (productIds.length === 0) {
            console.log('No products found to delete.');
            return;
        }

        console.log(`Processing ${productIds.length} products to be removed...`);

        // 1. Delete from leaf tables that depend on products
        console.log('Cleaning product dependencies (waitlist, favorites, cart items)...');

        // Live related
        await supabase.from('live_waitlist').delete().in('product_id', productIds);
        await supabase.from('live_products').delete().in('product_id', productIds);
        await supabase.from('live_cart_items').delete().in('product_id', productIds);

        // Order related (already cleaned orders, but just in case orphaned items exist)
        await supabase.from('order_items').delete().in('product_id', productIds);

        // User related
        await supabase.from('print_requests').delete().in('linked_product_id', productIds);

        // 2. Delete the main product records
        console.log('Deleting products from catalog...');
        const { error: prodDelErr } = await supabase.from('product_catalog').delete().in('id', productIds);

        if (prodDelErr) {
            console.error('Error deleting products:', prodDelErr.message);
            throw prodDelErr;
        }

        console.log('\n--- TOTAL PRODUCT CLEANUP COMPLETE ---');
    } catch (err) {
        console.error('Product cleanup failed:', err.message);
    }
}

cleanupAllProducts();
