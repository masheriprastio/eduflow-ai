import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Role, Student } from '../types';
import { Lock, User, KeyRound, X, School, Info, Eye, EyeOff, Loader2 } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (role: Role, userData?: any) => void;
  students: Student[]; // This prop is kept for compatibility but main check is done via DB
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLogin }) => {
  const [activeTab, setActiveTab] = useState<'ADMIN' | 'STUDENT'>('STUDENT');
  
  // Admin Form State
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  
  // Student Form State
  const [nis, setNis] = useState('');
  const [studentPass, setStudentPass] = useState('');
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Password Visibility State
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [showStudentPass, setShowStudentPass] = useState(false);

  if (!isOpen) return null;

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Static Admin Credentials for this Demo App
    if (adminUser === 'admin' && adminPass === 'admin12345') {
      onLogin('ADMIN', { name: 'Admin Guru' });
      onClose();
    } else {
      setError('Username atau password admin salah!');
    }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
        // Query database for student
        const { data: student, error } = await supabase
            .from('students')
            .select('*')
            .eq('nis', nis)
            .single();

        if (error || !student) {
            setError('NIS tidak ditemukan.');
        } else if (student.password !== studentPass) {
            setError('Password salah.');
        } else {
            onLogin('STUDENT', student);
            onClose();
        }
    } catch (err) {
        setError('Terjadi kesalahan koneksi.');
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
            <X size={20}/>
        </button>

        <div className="text-center pt-8 pb-6 px-6 bg-slate-50 border-b border-slate-100">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 mx-auto mb-3">
                <Lock size={24} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Masuk ke EduFlow</h2>
            <p className="text-sm text-slate-500 mt-1">Silakan login untuk mengakses materi</p>
        </div>

        <div className="flex border-b border-slate-200">
            <button 
                onClick={() => { setActiveTab('STUDENT'); setError(''); }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'STUDENT' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                Siswa
            </button>
            <button 
                onClick={() => { setActiveTab('ADMIN'); setError(''); }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'ADMIN' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                Admin Guru
            </button>
        </div>

        <div className="p-6">
            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center gap-2">
                    <span className="font-bold">Error:</span> {error}
                </div>
            )}

            {activeTab === 'ADMIN' ? (
                <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-start gap-2">
                         <Info size={16} className="text-blue-600 mt-0.5 shrink-0" />
                         <p className="text-xs text-blue-700">
                            Demo Login: Username <b>admin</b>, Password <b>admin12345</b>
                         </p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Username</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                            <input 
                                type="text" 
                                value={adminUser}
                                onChange={(e) => setAdminUser(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Username Admin"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Password</label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                            <input 
                                type={showAdminPass ? "text" : "password"}
                                value={adminPass}
                                onChange={(e) => setAdminPass(e.target.value)}
                                className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Password Admin"
                            />
                            <button 
                                type="button"
                                onClick={() => setShowAdminPass(!showAdminPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showAdminPass ? <EyeOff size={18}/> : <Eye size={18}/>}
                            </button>
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 mt-2">
                        Login sebagai Guru
                    </button>
                </form>
            ) : (
                <form onSubmit={handleStudentLogin} className="space-y-4">
                     <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">NIS (Nomor Induk Siswa)</label>
                        <div className="relative">
                            <School className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                            <input 
                                type="text" 
                                value={nis}
                                onChange={(e) => setNis(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Masukkan NIS"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Password</label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                            <input 
                                type={showStudentPass ? "text" : "password"}
                                value={studentPass}
                                onChange={(e) => setStudentPass(e.target.value)}
                                className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Password Siswa"
                            />
                             <button 
                                type="button"
                                onClick={() => setShowStudentPass(!showStudentPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showStudentPass ? <EyeOff size={18}/> : <Eye size={18}/>}
                            </button>
                        </div>
                    </div>
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-emerald-600 text-white py-2.5 rounded-lg font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 mt-2 flex items-center justify-center gap-2"
                    >
                        {isLoading && <Loader2 size={18} className="animate-spin"/>}
                        {isLoading ? 'Memverifikasi...' : 'Login Siswa'}
                    </button>
                </form>
            )}
        </div>
      </div>
    </div>
  );
};

export default LoginModal;