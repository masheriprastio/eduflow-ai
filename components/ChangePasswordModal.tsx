import React, { useState } from 'react';
import { Lock, Save, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void; // Usually logs out if cancelled
  onChangePassword: (newPass: string) => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, onChangePassword }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
        setError('Password minimal 6 karakter.');
        return;
    }
    if (newPassword !== confirmPassword) {
        setError('Konfirmasi password tidak cocok.');
        return;
    }
    onChangePassword(newPassword);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
        <div className="text-center pt-8 pb-4 px-6 bg-amber-50 border-b border-amber-100">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shadow-sm mx-auto mb-3">
                <Lock size={24} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Ganti Password</h2>
            <p className="text-sm text-slate-600 mt-1">Demi keamanan, Anda wajib mengganti password default saat login pertama.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center gap-2">
                    <AlertCircle size={16}/> {error}
                </div>
            )}

            <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Password Baru</label>
                <div className="relative">
                    <input 
                        type={showNewPass ? "text" : "password"} 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2.5 pr-10 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none"
                        placeholder="Minimal 6 karakter"
                        required
                    />
                    <button 
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                        {showNewPass ? <EyeOff size={18}/> : <Eye size={18}/>}
                    </button>
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Konfirmasi Password</label>
                <div className="relative">
                    <input 
                        type={showConfirmPass ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-2.5 pr-10 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none"
                        placeholder="Ulangi password baru"
                        required
                    />
                    <button 
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                        {showConfirmPass ? <EyeOff size={18}/> : <Eye size={18}/>}
                    </button>
                </div>
            </div>

            <button type="submit" className="w-full bg-amber-500 text-white py-2.5 rounded-lg font-bold hover:bg-amber-600 transition-colors shadow-lg shadow-amber-200 mt-2 flex items-center justify-center gap-2">
                <Save size={18} /> Simpan Password & Lanjutkan
            </button>
            
            <button 
                type="button" 
                onClick={onClose}
                className="w-full text-slate-400 hover:text-slate-600 text-sm font-medium mt-2"
            >
                Batal (Logout)
            </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;