import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    console.log('Listing all live events...');
    const { data, error } = await supabase.from('live_events').select('id, titulo, created_at, status').order('created_at', { ascending: false });

    if (error) {
        console.error('Error listing lives:', error);
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

check();
