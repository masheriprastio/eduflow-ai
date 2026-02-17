import { createClient } from '@supabase/supabase-js';

// Konfigurasi Supabase dari Environment Variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase URL or Key is missing. Check your .env file.");
}

// Initialize Supabase
export const supabase = createClient(supabaseUrl, supabaseKey);