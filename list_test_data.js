import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    const today = new Date().toISOString().split('T')[0];
    console.log(`Checking data created on or after ${today}...`);

    const { data: orders } = await supabase.from('orders').select('id, customer_name, total_amount, created_at').gte('created_at', today);
    console.log('\n--- Orders ---');
    console.log(JSON.stringify(orders, null, 2));

    const { data: products } = await supabase.from('product_catalog').select('id, name, created_at').gte('created_at', today);
    console.log('\n--- Products ---');
    console.log(JSON.stringify(products, null, 2));

    // Check for other potential test data tables
    const { data: liveCarts } = await supabase.from('live_cart_items').select('id, customer_id, created_at').gte('created_at', today);
    console.log('\n--- Live Cart Items ---');
    console.log(JSON.stringify(liveCarts, null, 2));
}

check();
