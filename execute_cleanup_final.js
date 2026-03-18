import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function cleanup() {
    const today = '2026-03-10';
    console.log(`Starting definitive cleanup for data created on ${today}...`);

    try {
        const { data: orders } = await supabase.from('orders').select('id').gte('created_at', today);
        const orderIds = orders?.map(o => o.id) || [];

        const { data: carts } = await supabase.from('live_carts').select('id').gte('created_at', today);
        const cartIds = carts?.map(c => c.id) || [];

        console.log(`Found ${orderIds.length} orders and ${cartIds.length} carts to process.`);

        // 1. Break ALL foreign key links first
        console.log('Breaking foreign key links between orders and carts...');
        if (orderIds.length > 0) {
            await supabase.from('orders').update({ live_cart_id: null }).in('id', orderIds);
        }
        if (cartIds.length > 0) {
            await supabase.from('live_carts').update({ order_id: null }).in('id', cartIds);
        }

        // 2. Clear related tables
        if (orderIds.length > 0) {
            console.log('Cleaning order related tables...');
            await supabase.from('order_items').delete().in('order_id', orderIds);
            await supabase.from('payments').delete().in('order_id', orderIds);
            await supabase.from('coupon_uses').delete().in('order_id', orderIds);
        }

        if (cartIds.length > 0) {
            console.log('Cleaning cart related tables...');
            await supabase.from('live_cart_items').delete().in('live_cart_id', cartIds);
            await supabase.from('coupon_uses').delete().in('live_cart_id', cartIds);
            await supabase.from('order_items').delete().in('live_cart_id', cartIds).filter('order_id', 'is', null); // Just in case
        }

        // 3. Delete the main records
        console.log('Deleting carts...');
        if (cartIds.length > 0) {
            const { error: cartDelErr } = await supabase.from('live_carts').delete().in('id', cartIds);
            if (cartDelErr) console.error('Error deleting carts:', cartDelErr.message);
        }

        console.log('Deleting orders...');
        if (orderIds.length > 0) {
            const { error: orderDelErr } = await supabase.from('orders').delete().in('id', orderIds);
            if (orderDelErr) console.error('Error deleting orders:', orderDelErr.message);
        }

        // 4. Delete products
        console.log('Deleting test products...');
        const { error: prodError } = await supabase.from('product_catalog').delete().gte('created_at', today);
        if (prodError) console.error('Error deleting products:', prodError.message);

        console.log('\n--- CLEANUP COMPLETE ---');
    } catch (err) {
        console.error('Cleanup failed with unexpected error:', err);
    }
}

cleanup();
