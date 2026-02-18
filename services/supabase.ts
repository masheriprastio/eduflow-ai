import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

/**
 * Helper robust untuk membaca Environment Variables dari berbagai sumber (.env.local)
 * Mendukung: Vite (import.meta.env), Next.js/CRA/Node (process.env)
 */
const getEnvVar = (keys: string[]): string => {
  for (const key of keys) {
    // 1. Coba import.meta.env (Vite standard)
    try {
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
        // @ts-ignore
        return import.meta.env[key];
      }
    } catch (e) {}

    // 2. Coba process.env (Standard Node / Webpack / CRA)
    try {
      // @ts-ignore
      if (typeof process !== 'undefined' && process.env && process.env[key]) {
        // @ts-ignore
        return process.env[key];
      }
    } catch (e) {}
  }
  return '';
};

// Cek berbagai kemungkinan nama variabel yang umum digunakan di .env
const supabaseUrl = getEnvVar([
  'VITE_SUPABASE_URL', 
  'REACT_APP_SUPABASE_URL', 
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL'
]);

const supabaseKey = getEnvVar([
  'VITE_SUPABASE_ANON_KEY', 
  'REACT_APP_SUPABASE_ANON_KEY', 
  'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
  'SUPABASE_ANON_KEY'
]);

const isKeyValid = !!supabaseUrl && !!supabaseKey && supabaseUrl !== 'https://your-project.supabase.co';

if (!isKeyValid) {
  console.warn("⚠️ Supabase Config Missing or Invalid! Please check your .env.local file.");
  console.warn("Expected keys: VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY (or REACT_APP_*, NEXT_PUBLIC_*, SUPABASE_*)");
}

// Gunakan dummy URL jika kosong agar aplikasi TIDAK CRASH saat inisialisasi awal (Fallboack mode)
const validUrl = isKeyValid ? supabaseUrl : 'https://placeholder.supabase.co';
const validKey = isKeyValid ? supabaseKey : 'placeholder-key';

// Initialize Supabase
export const supabase = createClient(validUrl, validKey);

export const isSupabaseConfigured = () => isKeyValid;
