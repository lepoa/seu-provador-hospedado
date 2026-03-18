import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function cleanup() {
    const today = '2026-03-10';
    console.log(`Starting cleanup for data created on ${today}...`);

    try {
        // 1. Delete live_cart_items and live_carts
        console.log('Deleting live_carts and items...');
        const { data: cartsToClean } = await supabase.from('live_carts').select('id, order_id').gte('created_at', today);
        const cartIds = cartsToClean?.map(c => c.id) || [];

        if (cartIds.length > 0) {
            // Clear order_id in live_carts first to avoid blocking order deletion
            const { error: clearRefError } = await supabase.from('live_carts').update({ order_id: null }).in('id', cartIds);
            if (clearRefError) console.warn('Could not clear order_id in live_carts:', clearRefError.message);

            const { error: cartItemError } = await supabase.from('live_cart_items').delete().in('live_cart_id', cartIds);
            if (cartItemError) throw cartItemError;

            const { error: cartError } = await supabase.from('live_carts').delete().in('id', cartIds);
            if (cartError) throw cartError;
            console.log(`Deleted ${cartIds.length} live carts and their items.`);
        }

        // 2. Delete order_items and orders
        console.log('Deleting order_items and orders...');
        const { data: ordersToClean } = await supabase.from('orders').select('id').gte('created_at', today);
        const orderIds = ordersToClean?.map(o => o.id) || [];

        if (orderIds.length > 0) {
            const { error: itemError } = await supabase.from('order_items').delete().in('order_id', orderIds);
            if (itemError) throw itemError;

            const { error: paymentError } = await supabase.from('payments').delete().in('order_id', orderIds);
            if (paymentError) console.warn('Payment deletion skipped/errored:', paymentError.message);

            const { error: orderError } = await supabase.from('orders').delete().in('id', orderIds);
            if (orderError) throw orderError;
            console.log(`Deleted ${orderIds.length} orders and their items.`);
        }

        // 3. Delete products
        console.log('Deleting test products...');
        const { error: prodError } = await supabase.from('product_catalog').delete().gte('created_at', today);
        if (prodError) throw prodError;
        console.log('Deleted test products created today.');

        console.log('\n--- CLEANUP COMPLETE ---');
    } catch (err) {
        console.error('Cleanup failed:', err);
    }
}

cleanup();
