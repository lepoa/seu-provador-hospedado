import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    console.log('Checking for Daniella...');

    const { data: p, error: pe } = await supabase
        .from('profiles')
        .select('*')
        .or('name.ilike.%Daniella%,whatsapp.ilike.%991061979%');

    if (pe) console.error('Profile error:', pe);
    else console.log('Profiles found:', JSON.stringify(p, null, 2));

    const { data: c, error: ce } = await supabase
        .from('customers')
        .select('*')
        .or('name.ilike.%Daniella%,phone.ilike.%991061979%');

    if (ce) console.error('Customer error:', ce);
    else console.log('Customers found:', JSON.stringify(c, null, 2));
}

check();
