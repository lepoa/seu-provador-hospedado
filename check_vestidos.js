import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    console.log('Checking vestidos...');
    const { data, error } = await supabase
        .from('product_catalog')
        .select('name, category, color')
        .ilike('category', '%vestido%');

    if (error) console.error('Error:', error);
    else {
        console.log(`Found ${data.length} vestidos.`);
        console.log(data);
    }
}

check();
