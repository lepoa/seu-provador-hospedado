import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function manualSync() {
    console.log('Starting manual sync...');

    // 1. Get all profiles
    const { data: profiles, error: pe } = await supabase.from('profiles').select('*');
    if (pe) {
        console.error('Error fetching profiles:', pe);
        return;
    }

    // 2. Get all existing customers (to check for missing ones)
    const { data: customers, error: ce } = await supabase.from('customers').select('user_id');
    if (ce) {
        console.error('Error fetching customers:', ce);
        return;
    }

    const existingUserIds = new Set(customers.map(c => c.user_id).filter(Boolean));
    const missingProfiles = profiles.filter(p => !existingUserIds.has(p.user_id) && (p.name || p.whatsapp));

    console.log(`Found ${missingProfiles.length} missing customers.`);

    for (const profile of missingProfiles) {
        console.log(`Syncing profile: ${profile.name} (${profile.whatsapp})...`);

        const { error: syncError } = await supabase.from('customers').insert({
            user_id: profile.user_id,
            name: profile.name,
            phone: profile.whatsapp,
            instagram_handle: profile.instagram_handle
        });

        if (syncError) {
            console.error(`Error syncing user ${profile.user_id}:`, syncError);
        } else {
            console.log(`Successfully synced ${profile.name}.`);
        }
    }

    console.log('Manual sync complete!');
}

manualSync();
