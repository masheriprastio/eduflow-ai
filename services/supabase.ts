import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Helper aman untuk membaca Environment Variables (Mendukung Vite & CRA/Node)
const getEnv = (key: string, fallbackKey?: string): string => {
  let value = '';
  
  // 1. Coba import.meta.env (Vite)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
         // @ts-ignore
        value = import.meta.env[key] || (fallbackKey ? import.meta.env[fallbackKey] : '');
    }
  } catch (e) {}

  // 2. Coba process.env (CRA/Node) - Jika belum ketemu
  if (!value) {
    try {
        if (typeof process !== 'undefined' && process.env) {
            value = process.env[key] || (fallbackKey ? process.env[fallbackKey] : '') || '';
        }
    } catch (e) {}
  }
  
  return value;
};

// Cek kedua format penamaan (VITE_... dan REACT_APP_...)
const supabaseUrl = getEnv('VITE_SUPABASE_URL', 'REACT_APP_SUPABASE_URL');
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY', 'REACT_APP_SUPABASE_ANON_KEY');

const isKeyValid = supabaseUrl && supabaseKey && supabaseUrl !== 'https://your-project.supabase.co';

if (!isKeyValid) {
  console.warn("⚠️ Supabase Config Missing or Invalid! App running in Demo Mode.");
}

// Gunakan dummy URL jika kosong agar aplikasi TIDAK CRASH
const validUrl = isKeyValid ? supabaseUrl : 'https://placeholder.supabase.co';
const validKey = isKeyValid ? supabaseKey : 'placeholder-key';

// Initialize Supabase
export const supabase = createClient(validUrl, validKey);

// Export helper status
export const isSupabaseConfigured = () => isKeyValid;

/**
 * Fungsi sederhana untuk mengecek koneksi ke Supabase.
 */
export const testConnection = async () => {
  try {
    if (!isKeyValid) {
        return { success: false, message: "Mode Offline: API Key belum disetting." };
    }

    const { data, error } = await supabase.from('modules').select('count').limit(1);
    
    if (error) {
      return { success: false, message: `Error Supabase: ${error.message}` };
    }
    
    return { success: true, message: "Terhubung ke Supabase!" };
  } catch (err: any) {
    return { success: false, message: err.message || "Unknown connection error" };
  }
};