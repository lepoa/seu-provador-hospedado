import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    console.log('Checking catalog...');
    const { data, error } = await supabase
        .from('product_catalog')
        .select('*')
        .or('name.ilike.%Blazer Cora%,name.ilike.%Vestido Melissa%');

    if (error) console.error('Error:', error);
    else console.log(JSON.stringify(data, null, 2));
}

check();
