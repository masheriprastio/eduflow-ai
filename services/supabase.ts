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

const supabaseUrl = getEnv('VITE_SUPABASE_URL', 'REACT_APP_SUPABASE_URL');
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY', 'REACT_APP_SUPABASE_ANON_KEY');

const isKeyValid = supabaseUrl && supabaseKey && supabaseUrl !== 'https://your-project.supabase.co';

if (!isKeyValid) {
  console.warn("⚠️ Supabase Config Missing! App may not work correctly.");
}

// Gunakan dummy URL jika kosong agar aplikasi TIDAK CRASH saat inisialisasi awal
const validUrl = isKeyValid ? supabaseUrl : 'https://placeholder.supabase.co';
const validKey = isKeyValid ? supabaseKey : 'placeholder-key';

// Initialize Supabase
export const supabase = createClient(validUrl, validKey);

export const isSupabaseConfigured = () => isKeyValid;

/**
 * Upload file to Supabase Storage bucket 'materials'
 */
export const uploadFile = async (file: File): Promise<string | null> => {
    if (!isKeyValid) return null;

    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('materials')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Upload Error:', uploadError);
            throw uploadError;
        }

        const { data } = supabase.storage.from('materials').getPublicUrl(filePath);
        return data.publicUrl;
    } catch (error) {
        console.error("Supabase Upload Failed:", error);
        return null;
    }
};