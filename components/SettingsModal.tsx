import React, { useState, useEffect } from 'react';
import { X, Key, Save, Trash2, ExternalLink, Database, Globe, HardDrive, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../services/supabase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
        // 1. Coba baca dari Local Storage dulu (Prioritas cache lokal)
        const stored = localStorage.getItem('USER_API_KEY');
        if (stored) {
            setApiKey(stored);
        } else if (isSupabaseConfigured()) {
            // 2. Jika lokal kosong, coba ambil dari Database (Sinkronisasi Global)
            // STRATEGY: Check 'system_settings' first, then 'modules' fallback
            const fetchFromDB = async () => {
                let foundKey = '';
                
                // Try clean table
                const { data: cleanData } = await supabase
                    .from('system_settings')
                    .select('value')
                    .eq('key', 'gemini_api_key')
                    .single();
                
                if (cleanData && cleanData.value) foundKey = cleanData.value;
                
                // Try fallback table if not found
                if (!foundKey) {
                     const { data: modData } = await supabase
                        .from('modules')
                        .select('description')
                        .eq('id', 'config_api_key')
                        .single();
                     if (modData && modData.description) foundKey = modData.description;
                }

                if (foundKey) setApiKey(foundKey);
            };
            
            fetchFromDB();
        }
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setIsSaving(true);
    const trimmedKey = apiKey.trim();

    // 1. Selalu simpan ke Local Storage (Fallback Cepat)
    localStorage.setItem('USER_API_KEY', trimmedKey);

    // 2. Coba simpan ke Supabase System Settings (Agar tersinkron ke Siswa)
    let dbSuccess = false;
    let dbErrorMsg = '';

    if (isSupabaseConfigured()) {
        try {
            // STRATEGY: Try to save to 'system_settings'. 
            // If it fails (likely due to missing table), fallback to saving as a hidden 'module'.
            
            const { error } = await supabase
                .from('system_settings')
                .upsert({ key: 'gemini_api_key', value: trimmedKey }, { onConflict: 'key' });

            if (!error) {
                dbSuccess = true;
            } else {
                console.warn("Table 'system_settings' missing. Falling back to 'modules' table storage.", error.message);
                
                // FALLBACK: Store in 'modules' table with a specific ID
                const { error: fallbackError } = await supabase
                    .from('modules')
                    .upsert({
                        id: 'config_api_key',
                        title: 'SYSTEM_CONFIG_DO_NOT_DELETE',
                        description: trimmedKey,
                        category: 'System',
                        uploadDate: new Date().toISOString(),
                        tags: ['system', 'hidden']
                    });
                
                if (!fallbackError) {
                    dbSuccess = true;
                } else {
                    dbErrorMsg = fallbackError.message;
                }
            }
        } catch (e: any) {
            dbErrorMsg = e.message || 'Connection Error';
        }
    }

    setIsSaving(false);

    if (dbSuccess) {
        alert("BERHASIL! API Key tersimpan di Database Pusat.\n\nSemua siswa sekarang dapat menggunakan fitur Tutor AI tanpa perlu memasukkan key manual.");
        window.location.reload(); 
    } else {
        const msg = isSupabaseConfigured() 
            ? `Gagal menyimpan ke Database (${dbErrorMsg}).\nKey tersimpan di browser ini saja.`
            : "Mode Offline: API Key disimpan di browser ini saja (Local Storage).";
        alert(msg);
        window.location.reload();
    }
  };

  const handleClear = async () => {
    if (confirm("Yakin ingin menghapus API Key dari sistem? Fitur AI akan kembali ke Mode Demo.")) {
        setIsSaving(true);
        localStorage.removeItem('USER_API_KEY');
        
        if (isSupabaseConfigured()) {
            // Delete from both potential locations
            await supabase.from('system_settings').delete().eq('key', 'gemini_api_key');
            await supabase.from('modules').delete().eq('id', 'config_api_key');
        }

        setApiKey('');
        setIsSaving(false);
        alert("API Key dihapus.");
        window.location.reload();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"><X size={20}/></button>
            
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                    <Key size={20}/>
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Pengaturan API Key</h2>
                    <p className="text-xs text-slate-500">Konfigurasi Akses Gemini AI (Global)</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-xs text-indigo-800 leading-relaxed shadow-sm">
                    <p className="font-bold mb-2 flex items-center gap-1.5"><Globe size={14}/> Sinkronisasi Otomatis</p>
                    Sebagai Admin/Guru, API Key yang Anda masukkan di sini akan <strong>disimpan ke database pusat</strong>.
                    <br/><br/>
                    Artinya, <strong>Siswa TIDAK PERLU</strong> memasukkan API Key lagi. Mereka akan otomatis menggunakan key yang Anda atur di sini untuk mengakses Tutor AI.
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Google Gemini API Key</label>
                    <input 
                        type="password" 
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Contoh: AIzaSy..."
                        className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                    />
                    <div className="flex items-center gap-2 mt-2">
                        {isSupabaseConfigured() ? (
                            <span className="text-[10px] flex items-center gap-1 text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                <Database size={10}/> Database Terhubung
                            </span>
                        ) : (
                             <span className="text-[10px] flex items-center gap-1 text-orange-600 font-medium bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                                <HardDrive size={10}/> Mode Offline (Local Only)
                            </span>
                        )}
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline ml-auto flex items-center gap-1">
                            Dapatkan Key <ExternalLink size={10}/>
                        </a>
                    </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100 mt-2">
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70"
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} 
                        {isSaving ? 'Menyimpan...' : 'Simpan ke Database'}
                    </button>
                    {(localStorage.getItem('USER_API_KEY') || apiKey) && (
                        <button 
                            onClick={handleClear}
                            disabled={isSaving}
                            className="px-4 bg-red-50 text-red-600 border border-red-100 rounded-lg font-bold text-sm hover:bg-red-100 transition-colors"
                            title="Hapus Key / Reset"
                        >
                            <Trash2 size={16}/>
                        </button>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default SettingsModal;