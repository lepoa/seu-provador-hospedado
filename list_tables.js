import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function listTables() {
    console.log('Listing tables using information_schema...');
    const { data, error } = await supabase.rpc('get_tables_info'); // Checking if custom RPC exists

    if (error) {
        console.log('RPC get_tables_info not found, using SQL query if possible...');
        // Try to query common tables to see if they exist
        const potentialTables = ['orders', 'order_items', 'live_orders', 'live_cart_items', 'live_checkout', 'payments'];
        for (const table of potentialTables) {
            const { error: tableError } = await supabase.from(table).select('*').limit(0);
            if (!tableError) {
                console.log(`Table exists: ${table}`);
            } else {
                console.log(`Table NOT found or error: ${table} (${tableError.message})`);
            }
        }
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

listTables();
