import { createClient } from '@supabase/supabase-js';

// Konfigurasi Supabase dari Environment Variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase URL or Key is missing. Check your .env file.");
}

// Initialize Supabase
export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Fungsi sederhana untuk mengecek koneksi ke Supabase.
 * Mencoba mengambil data dari tabel 'modules' (walaupun kosong).
 */
export const testConnection = async () => {
  try {
    const { data, error } = await supabase.from('modules').select('count').limit(1);
    
    if (error) {
      return { success: false, message: error.message };
    }
    
    return { success: true, message: "Terhubung ke Supabase!" };
  } catch (err: any) {
    return { success: false, message: err.message || "Unknown error" };
  }
};