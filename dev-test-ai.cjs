// test-edge.cjs
const fs = require('fs');
const dotenvStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of dotenvStr.split('\n')) {
  if (line.includes('=')) {
    const [key, ...rest] = line.split('=');
    env[key.trim()] = rest.join('=').trim().replace(/\"/g, '');
  }
}

import('@supabase/supabase-js').then(({createClient}) => {
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  supabase.functions.invoke('generate-ai-look', {
    body: { input_text: 'oi', session_id: '123', history: [] }
  }).then(({data, error}) => {
    if (error) console.error('INVOKE ERROR:', error.message || error);
    else console.log('DATA:', JSON.stringify(data, null, 2));
  }).catch(e => console.error('CATCH ERROR:', e));
})
