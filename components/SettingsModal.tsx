import React, { useState, useEffect } from 'react';
import { X, Key, Save, Trash2, ExternalLink } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  
  useEffect(() => {
    if (isOpen) {
        const stored = localStorage.getItem('USER_API_KEY');
        if (stored) setApiKey(stored);
    }
  }, [isOpen]);

  const handleSave = () => {
    if (apiKey.trim()) {
        localStorage.setItem('USER_API_KEY', apiKey.trim());
        alert("API Key berhasil disimpan! Fitur AI sekarang aktif menggunakan key Anda.");
        window.location.reload(); // Reload to refresh services
    }
  };

  const handleClear = () => {
    localStorage.removeItem('USER_API_KEY');
    setApiKey('');
    alert("API Key dihapus. Aplikasi kembali ke Mode Demo (Simulasi).");
    window.location.reload();
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
                    <p className="text-xs text-slate-500">Konfigurasi akses Google Gemini AI</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-700 leading-relaxed">
                    <p className="font-bold mb-1 flex items-center gap-1"><ExternalLink size={12}/> Info:</p>
                    Saat ini aplikasi berjalan dalam <strong>Mode Demo</strong> (Simulasi) karena server tidak memiliki API Key.
                    <br/><br/>
                    Agar Tutor AI dan Generator Soal berfungsi sungguhan, silakan masukkan <strong>Google Gemini API Key</strong> Anda sendiri di bawah ini.
                    <br/><br/>
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline font-bold hover:text-blue-800">Dapatkan API Key Gratis di sini</a>
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Paste Gemini API Key</label>
                    <input 
                        type="password" 
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Contoh: AIzaSy..."
                        className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Key disimpan secara lokal di browser Anda.</p>
                </div>

                <div className="flex gap-2 pt-2">
                    <button 
                        onClick={handleSave}
                        className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                    >
                        <Save size={16}/> Simpan & Aktifkan
                    </button>
                    {localStorage.getItem('USER_API_KEY') && (
                        <button 
                            onClick={handleClear}
                            className="px-4 bg-red-50 text-red-600 border border-red-100 rounded-lg font-bold text-sm hover:bg-red-100"
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