import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    console.log('Checking stock for Melissa...');
    const { data, error } = await supabase
        .from('public_product_stock')
        .select('*')
        .eq('product_id', 'e3981c4e-f117-4fce-835d-eada3493dfd6');

    if (error) console.error('Error:', error);
    else console.log(JSON.stringify(data, null, 2));
}

check();
