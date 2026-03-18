// test-ai-look.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Invoking edge function...");
  const { data, error } = await supabase.functions.invoke('generate-ai-look', {
    body: {
      input_text: "Quero um look para um casamento de dia",
      session_id: "test-session",
      history: []
    }
  });

  if (error) {
    console.error("Function Error:", error);
    return;
  }

  console.log("Success:", JSON.stringify(data, null, 2));
}

run();
