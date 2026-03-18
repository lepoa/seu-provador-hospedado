import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function cleanupLives() {
    console.log('Starting full cleanup of live test events...');

    try {
        const { data: lives } = await supabase.from('live_events').select('id');
        const liveIds = lives?.map(l => l.id) || [];

        if (liveIds.length === 0) {
            console.log('No live events found to delete.');
            return;
        }

        console.log(`Processing ${liveIds.length} live events...`);

        // 1. Delete dependent leaf nodes
        console.log('Deleting raffles, waitlist, pendencias...');
        await supabase.from('live_raffles').delete().in('live_event_id', liveIds);
        await supabase.from('live_waitlist').delete().in('live_event_id', liveIds);
        await supabase.from('live_pendencias').delete().in('live_event_id', liveIds);

        // 2. Clear order ID references in live_carts and vice-versa
        console.log('Clearing order/cart cross-references...');
        const { data: carts } = await supabase.from('live_carts').select('id').in('live_event_id', liveIds);
        const cartIds = carts?.map(c => c.id) || [];

        if (cartIds.length > 0) {
            await supabase.from('orders').update({ live_cart_id: null }).in('live_cart_id', cartIds);
            await supabase.from('live_carts').update({ order_id: null }).in('id', cartIds);

            console.log('Deleting cart items and charge logs...');
            await supabase.from('live_cart_items').delete().in('live_cart_id', cartIds);
            await supabase.from('live_charge_logs').delete().in('live_cart_id', cartIds);
            await supabase.from('coupon_uses').delete().in('live_cart_id', cartIds);
        }

        // 3. Delete carts
        console.log('Deleting live carts...');
        await supabase.from('live_carts').delete().in('live_event_id', liveIds);

        // 4. Delete live products and customers
        console.log('Deleting live products and customers...');
        await supabase.from('live_products').delete().in('live_event_id', liveIds);
        await supabase.from('live_customers').delete().in('live_event_id', liveIds);

        // 5. Finally delete the live events themselves
        console.log('Deleting live events...');
        const { error: liveDelError } = await supabase.from('live_events').delete().in('id', liveIds);
        if (liveDelError) throw liveDelError;

        console.log('\n--- LIVE CLEANUP COMPLETE ---');
    } catch (err) {
        console.error('Live cleanup failed:', err.message);
    }
}

cleanupLives();
