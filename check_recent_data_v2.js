import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    console.log('Checking recent data with corrected schemas...');

    const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('id, customer_name, total, created_at, status')
        .order('created_at', { ascending: false })
        .limit(10);

    if (orderError) console.error('Orders error:', orderError);
    else {
        console.log('\n--- Recent Orders ---');
        console.log(JSON.stringify(orders, null, 2));
    }

    const { data: carts, error: cartError } = await supabase
        .from('live_carts')
        .select('id, total, created_at, status, live_customers(nome)')
        .order('created_at', { ascending: false })
        .limit(10);

    if (cartError) console.error('Carts error:', cartError);
    else {
        console.log('\n--- Recent Live Carts ---');
        console.log(JSON.stringify(carts, null, 2));
    }
}

check();
