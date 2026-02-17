import { createClient } from '@supabase/supabase-js';

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

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ Supabase Config Missing! Pastikan Anda sudah setting Environment Variables (VITE_SUPABASE_URL atau REACT_APP_SUPABASE_URL).");
}

// Gunakan dummy URL jika kosong agar aplikasi TIDAK CRASH (Blank Screen),
// meskipun nanti request data akan gagal, setidaknya UI bisa muncul.
const validUrl = supabaseUrl || 'https://placeholder.supabase.co';
const validKey = supabaseKey || 'placeholder-key';

// Initialize Supabase
export const supabase = createClient(validUrl, validKey);

/**
 * Fungsi sederhana untuk mengecek koneksi ke Supabase.
 * Mencoba mengambil data dari tabel 'modules' (walaupun kosong).
 */
export const testConnection = async () => {
  try {
    if (!supabaseUrl || !supabaseKey) {
        return { success: false, message: "Environment Variables belum terdeteksi. Cek console log." };
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