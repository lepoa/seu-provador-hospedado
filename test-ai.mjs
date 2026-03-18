import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({path: '.env'});

const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-look`;
console.log("Calling", url);

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`
  },
  body: JSON.stringify({
    input_text: 'oi',
    session_id: 'test',
    history: []
  })
}).then(res => res.json()).then(console.log).catch(console.error);
