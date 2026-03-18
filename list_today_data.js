import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    const today = '2026-03-10';
    console.log(`Checking data created on ${today}...`);

    const { data: products } = await supabase.from('product_catalog').select('name').gte('created_at', today);
    console.log('\nProducts from today:');
    console.log(products.map(p => p.name));

    const { data: orders } = await supabase.from('orders').select('customer_name, total').gte('created_at', today);
    console.log('\nOrders from today:');
    console.log(orders.map(o => `${o.customer_name} (R$ ${o.total})`));

    const { data: carts } = await supabase.from('live_carts').select('id, live_customers(nome)').gte('created_at', today);
    console.log('\nLive Carts from today:');
    console.log(carts.map(c => c.live_customers?.nome || 'Unnamed'));
}

check();
