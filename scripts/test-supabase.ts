import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!url || !key) {
  console.error('Missing URL or Key');
  process.exit(1);
}

const supabase = createClient(url, key);

async function testConnection() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Supabase Auth error:', error.message);
      process.exit(1);
    }
    console.log('Supabase connected successfully. Session:', !!data?.session);
    process.exit(0);
  } catch (err) {
    console.error('Supabase connection failed:', err);
    process.exit(1);
  }
}

testConnection();
