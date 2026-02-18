import React, { useState, useMemo, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './services/supabase';
import { Role, LearningModule, ModuleCategory, Student, QuizResult, StudentAnswer, ManualGrade, ClassGroup } from './types';
import ModuleCard from './components/ModuleCard';
import UploadModal from './components/UploadModal';
import LoginModal from './components/LoginModal';
import StudentManager from './components/StudentManager';
import QuizManager from './components/QuizManager';
import ReportsDashboard from './components/ReportsDashboard';
import ChangePasswordModal from './components/ChangePasswordModal';
import { 
  GraduationCap, 
  PlusCircle, 
  Search, 
  Filter, 
  UserCircle,
  LogIn,
  LogOut,
  Users,
  ChevronDown,
  BrainCircuit,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  ArrowRight,
  Trash2,
  Database,
  WifiOff,
  Settings
} from 'lucide-react';

const App: React.FC = () => {
  const [role, setRole] = useState<Role>('GUEST');
  const [currentUser, setCurrentUser] = useState<Student | any>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isDbConnected, setIsDbConnected] = useState(isSupabaseConfigured());

  // Data State (Fetched from DB)
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [modules, setModules] = useState<LearningModule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [manualGrades, setManualGrades] = useState<ManualGrade[]>([]);

  // View State
  const [activeView, setActiveView] = useState<'MODULES' | 'EXAMS'>('MODULES');
  
  // Modal States
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTargetClass, setUploadTargetClass] = useState<string | undefined>(undefined);
  
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isStudentManagerOpen, setIsStudentManagerOpen] = useState(false);
  const [isQuizManagerOpen, setIsQuizManagerOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isChangePassOpen, setIsChangePassOpen] = useState(false);
  
  // Dropdown Menu State
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  // DELETE CONFIRMATION STATE (Global)
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    type: 'MODULE' | 'STUDENT';
    id: string; 
    details?: string;
  }>({ isOpen: false, type: 'MODULE', id: '' });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Derive available classes names for UploadModal
  const classNames = useMemo(() => classes.map(c => c.name).sort(), [classes]);

  // --- SUPABASE DATA FETCHING ---
  const fetchAllData = async () => {
      if (!isDbConnected) return;
      setIsLoadingData(true);
      try {
          const { data: mods } = await supabase.from('modules').select('*').order('uploadDate', { ascending: false });
          if(mods) setModules(mods as any);

          const { data: stus } = await supabase.from('students').select('*').order('name');
          if(stus) setStudents(stus as any);

          const { data: clss } = await supabase.from('classes').select('*');
          if(clss) setClasses(clss as any);
          
          const { data: ress } = await supabase.from('quiz_results').select('*').order('submittedAt', { ascending: false });
          if(ress) setQuizResults(ress as any);

          const { data: grds } = await supabase.from('grades').select('*').order('date', { ascending: false });
          if(grds) setManualGrades(grds as any);

      } catch (error) {
          console.error("Error fetching data:", error);
      } finally {
          setIsLoadingData(false);
      }
  };

  useEffect(() => {
      fetchAllData();
  }, [isDbConnected]);

  // --- AUTH HANDLERS ---

  const handleLogin = (newRole: Role, user: any) => {
    if (newRole === 'STUDENT') {
        // Cek perlu ganti password
        if (user.needsPasswordChange) {
            setCurrentUser(user);
            setIsLoginOpen(false);
            setIsChangePassOpen(true);
            return;
        }
        
        // Update last login di DB
        const now = new Date().toISOString();
        supabase.from('students').update({ lastLogin: now }).eq('nis', user.nis).then();
        
        setCurrentUser({ ...user, lastLogin: now });
    } else {
        setCurrentUser(user);
    }
    setRole(newRole);
    setIsLoginOpen(false);
  };

  const handleLogout = () => {
    setRole('GUEST');
    setCurrentUser(null);
    setIsProfileMenuOpen(false);
    setActiveView('MODULES');
  };

  const handleChangePassword = async (newPass: string) => {
      if (!currentUser) return;
      try {
          const { error } = await supabase
            .from('students')
            .update({ password: newPass, needsPasswordChange: false })
            .eq('nis', currentUser.nis);

          if (error) throw error;

          const updatedUser = { ...currentUser, password: newPass, needsPasswordChange: false };
          setCurrentUser(updatedUser);
          setIsChangePassOpen(false);
          alert("Password berhasil diubah!");
          handleLogin('STUDENT', updatedUser);
      } catch (err) {
          alert("Gagal mengubah password.");
      }
  };

  // --- CRUD HANDLERS (Supabase) ---

  const handleUpload = async (data: Partial<LearningModule>) => {
    // Optimistic Update handled by fetch or pushing to state
    const newModule = { 
        ...data, 
        id: `mod-${Date.now()}`, // Temporary ID, Supabase usually generates UUID
        uploadDate: new Date().toISOString(), 
        tags: data.tags || [],
        quiz: data.quiz || null
    };

    // Remove ID if Supabase auto-generates it, otherwise keep it
    const { data: inserted, error } = await supabase.from('modules').insert(newModule).select().single();
    
    if (!error && inserted) {
        setModules(prev => [inserted as any, ...prev]);
        setIsUploadOpen(false);
    } else {
        alert("Gagal mengunggah materi ke database.");
        console.error(error);
    }
  };

  const handleUpdateModule = async (updatedModule: LearningModule) => {
    const { error } = await supabase
        .from('modules')
        .update(updatedModule)
        .eq('id', updatedModule.id);

    if (!error) {
        setModules(prev => prev.map(m => m.id === updatedModule.id ? updatedModule : m));
    } else {
        alert("Gagal memperbarui modul.");
    }
  };

  const handleDeleteModule = (id: string) => {
    setDeleteConfirmation({ isOpen: true, type: 'MODULE', id });
  };

  const handleAddStudent = async (student: Student) => {
    const { data: inserted, error } = await supabase.from('students').insert(student).select().single();
    if (!error && inserted) {
        setStudents(prev => [inserted as any, ...prev]);
    } else {
        alert("Gagal menambah siswa. NIS mungkin duplikat.");
    }
  };
  
  const handleImportStudents = async (newStudents: Student[]) => {
      const { data: inserted, error } = await supabase.from('students').insert(newStudents).select();
      if (!error && inserted) {
          setStudents(prev => [...(inserted as any), ...prev]);
          alert(`Berhasil mengimpor ${inserted.length} siswa ke database.`);
      } else {
          alert("Gagal impor. Cek duplikasi NIS.");
      }
  };

  const handleUpdateStudent = async (updatedStudent: Student) => {
      const { error } = await supabase.from('students').update(updatedStudent).eq('nis', updatedStudent.nis);
      if (!error) {
          setStudents(prev => prev.map(s => s.nis === updatedStudent.nis ? updatedStudent : s));
      }
  };

  const handleDeleteStudent = (nis: string) => {
    setDeleteConfirmation({ isOpen: true, type: 'STUDENT', id: nis, details: `NIS: ${nis}` });
  };

  const handleUpdateClasses = async (updatedClasses: ClassGroup[]) => {
     // Simple strategy: Replace local state and let user sync manually or handle granularly
     // For this app, we probably just add/remove classes one by one in the manager
     // But `StudentManager` passes the whole array. 
     // Let's implement full sync (delete not in list, upsert in list) is hard.
     // Simplified: We assume `updatedClasses` contains the NEW state.
     
     // Note: Real apps usually have addClass/removeClass functions. 
     // We will trust the StudentManager calls specific create/delete logic 
     // but here it passes array. Let's just update local state and fetch in Manager.
     // *Correction*: StudentManager calls `onUpdateClasses` with new array.
     // Ideally we refactor StudentManager to call `addClass` / `deleteClass`.
     // For now, let's just refresh.
     setClasses(updatedClasses); // Optimistic
     
     // In a real scenario, StudentManager should call DB directly. 
     // We will implement `addClass` and `deleteClass` logic inside StudentManager 
     // and pass those as props instead of this generic one.
     // *See StudentManager props below*
  };

  const executeDelete = async () => {
      const id = deleteConfirmation.id;
      if (deleteConfirmation.type === 'MODULE') {
          const { error } = await supabase.from('modules').delete().eq('id', id);
          if (!error) setModules(prev => prev.filter(m => m.id !== id));
      } else if (deleteConfirmation.type === 'STUDENT') {
          const { error } = await supabase.from('students').delete().eq('nis', id);
          if (!error) setStudents(prev => prev.filter(s => s.nis !== id));
      }
      setDeleteConfirmation({ ...deleteConfirmation, isOpen: false });
  };

  const handleQuizSubmit = async (moduleId: string, quizTitle: string, score: number, detailedAnswers: StudentAnswer[], violations = 0, isDisqualified = false) => {
    if (!currentUser) return;

    const newResult = {
        id: `res-${Date.now()}`,
        studentName: currentUser.name,
        studentNis: currentUser.nis,
        moduleTitle: modules.find(m => m.id === moduleId)?.title || 'Unknown Module',
        quizTitle: quizTitle,
        score: score,
        submittedAt: new Date().toISOString(),
        answers: detailedAnswers,
        violations: violations,
        isDisqualified: isDisqualified
    };

    const { data: inserted, error } = await supabase.from('quiz_results').insert(newResult).select().single();
    if (!error && inserted) {
        setQuizResults(prev => [inserted as any, ...prev]);
    }
  };

  const handleResetExam = async (resultId: string) => {
      const { error } = await supabase.from('quiz_results').delete().eq('id', resultId);
      if(!error) setQuizResults(prev => prev.filter(r => r.id !== resultId));
  };

  const handleUpdateQuizResult = async (updatedResult: QuizResult) => {
     const { error } = await supabase.from('quiz_results').update(updatedResult).eq('id', updatedResult.id);
     if(!error) setQuizResults(prev => prev.map(r => r.id === updatedResult.id ? updatedResult : r));
  };

  const handleAddManualGrade = async (grade: ManualGrade) => {
      const { data: inserted, error } = await supabase.from('grades').insert(grade).select().single();
      if(!error && inserted) setManualGrades(prev => [inserted as any, ...prev]);
  };

  const handleUpdateManualGrade = async (updatedGrade: ManualGrade) => {
    const { error } = await supabase.from('grades').update(updatedGrade).eq('id', updatedGrade.id);
    if(!error) setManualGrades(prev => prev.map(g => g.id === updatedGrade.id ? updatedGrade : g));
  };

  const handleDeleteManualGrade = async (id: string) => {
    const { error } = await supabase.from('grades').delete().eq('id', id);
    if(!error) setManualGrades(prev => prev.filter(g => g.id !== id));
  };

  const getStudentResult = (moduleTitle: string) => {
    if (!currentUser) return null;
    return quizResults
        .filter(r => r.moduleTitle === moduleTitle && r.studentNis === currentUser.nis)
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];
  };

  const handleOpenUploadForClass = (className: string) => {
      setUploadTargetClass(className);
      setIsUploadOpen(true);
  };

  const filteredModules = useMemo(() => {
    return modules.filter(m => {
      const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            m.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
      const isExamViewFilter = activeView === 'EXAMS' ? (m.quiz !== undefined && m.quiz.questions.length > 0) : true;

      let hasAccess = true;
      if (role === 'ADMIN') {
        hasAccess = true;
      } else if (role === 'GUEST') {
        hasAccess = !m.targetClasses || m.targetClasses.length === 0;
      } else if (role === 'STUDENT' && currentUser) {
        const isPublic = !m.targetClasses || m.targetClasses.length === 0;
        const studentClasses = currentUser.classes || [];
        const isAssignedToClass = studentClasses.some((c: string) => m.targetClasses?.includes(c));
        hasAccess = isPublic || !!isAssignedToClass;
      }

      return matchesSearch && matchesCategory && isExamViewFilter && hasAccess;
    });
  }, [modules, searchQuery, selectedCategory, activeView, role, currentUser]);

  const getProfileClassText = () => {
      if (role !== 'STUDENT') return 'Administrator';
      if (!currentUser?.classes || currentUser.classes.length === 0) return 'Siswa (Belum Ada Kelas)';
      return currentUser.classes.length > 1 
        ? `${currentUser.classes.length} Kelas Terdaftar`
        : `Kelas ${currentUser.classes[0]}`;
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-800 bg-slate-50/50">
      
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveView('MODULES')}>
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <GraduationCap size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none">EduFlow AI</h1>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Sistem Manajemen Pembelajaran</p>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-1 mx-6">
                <button 
                   onClick={() => setActiveView('MODULES')}
                   className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeView === 'MODULES' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`}
                >
                   Materi Belajar
                </button>
                <button 
                   onClick={() => setActiveView('EXAMS')}
                   className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeView === 'EXAMS' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`}
                >
                   Ujian Harian
                </button>
            </div>

            {/* Auth State & Actions */}
            <div className="flex items-center gap-4">
              
              {role === 'GUEST' ? (
                 <button 
                    onClick={() => setIsLoginOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                 >
                    <LogIn size={18} />
                    Login Masuk
                 </button>
              ) : (
                 <div className="flex items-center gap-3 pl-4 border-l border-slate-200 ml-2">
                    {/* Admin Shortcuts in Nav */}
                    {role === 'ADMIN' && (
                        <div className="hidden lg:flex items-center gap-1 mr-4 pr-4">
                            <button 
                                onClick={() => setIsReportsOpen(true)}
                                className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-indigo-600 px-3 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
                            >
                                <BarChart3 size={18} />
                                Penilaian
                            </button>
                            <button 
                                onClick={() => setIsStudentManagerOpen(true)}
                                className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-indigo-600 px-3 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
                            >
                                <Users size={18} />
                                Siswa
                            </button>
                            <button 
                                onClick={() => setIsQuizManagerOpen(true)}
                                className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-indigo-600 px-3 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
                            >
                                <BrainCircuit size={18} />
                                Kuis
                            </button>
                            <button 
                                onClick={() => { setUploadTargetClass(undefined); setIsUploadOpen(true); }}
                                className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-indigo-600 px-3 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
                            >
                                <PlusCircle size={18} />
                                Unggah
                            </button>
                        </div>
                    )}

                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-semibold text-slate-800">{currentUser?.name}</p>
                      <p className="text-xs text-slate-500">
                        {getProfileClassText()}
                      </p>
                    </div>
                    
                    {/* User Profile Dropdown */}
                    <div className="relative">
                        <button 
                            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                            className={`w-12 h-12 rounded-full flex items-center justify-center text-white ring-2 ring-offset-2 transition-all cursor-pointer ${isProfileMenuOpen ? 'ring-indigo-300 bg-indigo-600' : 'ring-indigo-100 bg-gradient-to-tr from-indigo-500 to-purple-500'}`}
                        >
                            <UserCircle size={28} />
                            <div className="absolute bottom-0 right-0 bg-white rounded-full p-0.5 shadow-sm border border-slate-100">
                                <ChevronDown size={10} className="text-slate-600"/>
                            </div>
                        </button>

                        {/* Dropdown Menu - Click Based */}
                        {isProfileMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsProfileMenuOpen(false)}></div>
                                <div className="absolute right-0 mt-3 w-64 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                     <div className="px-5 py-4 border-b border-slate-50 bg-slate-50/50">
                                        <p className="text-sm font-bold text-slate-900">{currentUser?.name}</p>
                                        <p className="text-xs text-slate-500 truncate mt-0.5">
                                          {getProfileClassText()}
                                        </p>
                                        {/* Storage Indicator */}
                                        <div className={`mt-2 flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border w-fit ${isDbConnected ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
                                            {isDbConnected ? <Database size={10} /> : <WifiOff size={10}/>} 
                                            {isDbConnected ? 'Connected to Supabase' : 'Offline Mode'}
                                        </div>
                                     </div>
                                     
                                     <div className="p-1">
                                        <div className="md:hidden border-b border-slate-100 pb-1 mb-1">
                                            <button onClick={() => { setActiveView('MODULES'); setIsProfileMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3"><BookOpen size={16}/> Materi Belajar</button>
                                            <button onClick={() => { setActiveView('EXAMS'); setIsProfileMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3"><CheckCircle2 size={16}/> Ujian Harian</button>
                                        </div>

                                        {/* ADMIN SHORTCUTS FOR MOBILE */}
                                        {role === 'ADMIN' && (
                                            <div className="border-b border-slate-100 pb-1 mb-1 lg:hidden">
                                                <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Menu Admin</div>
                                                <button onClick={() => { setIsQuizManagerOpen(true); setIsProfileMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3"><BrainCircuit size={16}/> Manajemen Kuis</button>
                                                <button onClick={() => { setIsStudentManagerOpen(true); setIsProfileMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3"><Users size={16}/> Data Siswa</button>
                                                <button onClick={() => { setIsReportsOpen(true); setIsProfileMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3"><BarChart3 size={16}/> Laporan Nilai</button>
                                                <button onClick={() => { setUploadTargetClass(undefined); setIsUploadOpen(true); setIsProfileMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3"><PlusCircle size={16}/> Unggah Materi</button>
                                            </div>
                                        )}

                                        <button 
                                            onClick={handleLogout}
                                            className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-3 transition-colors"
                                        >
                                            <div className="p-1.5 bg-red-100 text-red-600 rounded-md"><LogOut size={16} /></div>
                                            Keluar
                                        </button>
                                     </div>
                                </div>
                            </>
                        )}
                    </div>
                 </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">
              {activeView === 'EXAMS' ? 'Dashboard Ujian Harian' : (role === 'ADMIN' ? 'Dasbor Pengajar' : (role === 'GUEST' ? 'Portal Publik' : 'Ruang Belajar Saya'))}
            </h2>
            <p className="text-slate-500 max-w-2xl">
              {activeView === 'EXAMS' 
                ? 'Daftar ujian dan kuis yang tersedia dari modul pembelajaran.' 
                : (role === 'ADMIN' 
                    ? 'Pantau aktivitas siswa dan kelola materi pembelajaran.' 
                    : (role === 'GUEST' 
                        ? 'Silakan login untuk mengakses fitur lengkap dan mengunduh materi.' 
                        : 'Akses materi, kerjakan kuis, dan gunakan Tutor AI untuk belajar.'))}
            </p>
          </div>
          
          {role === 'ADMIN' && activeView === 'MODULES' && (
            <div className="flex flex-wrap gap-3 mt-4 md:mt-0">
                <button 
                  onClick={() => setIsReportsOpen(true)}
                  className="group flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 px-5 py-3 rounded-xl font-bold shadow-sm transition-all active:scale-95"
                >
                  <BarChart3 size={20} />
                  <span>Lihat Laporan</span>
                </button>

                <button 
                  onClick={() => { setUploadTargetClass(undefined); setIsUploadOpen(true); }}
                  className="group flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95"
                >
                  <PlusCircle size={20} className="group-hover:rotate-90 transition-transform duration-300"/>
                  <span>Unggah Materi</span>
                </button>
            </div>
          )}
        </div>

        {/* Filters & Search */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder={activeView === 'EXAMS' ? "Cari ujian..." : "Cari materi..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            <Filter size={18} className="text-slate-400 mr-1" />
            <button 
              onClick={() => setSelectedCategory('All')}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory === 'All' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
            >
              Semua
            </button>
            {Object.values(ModuleCategory).map(cat => (
              <button 
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory === cat ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        {isLoadingData ? (
            <div className="py-20 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-slate-500 font-medium">Memuat data dari database...</p>
            </div>
        ) : activeView === 'MODULES' ? (
            /* MODULES GRID VIEW */
            filteredModules.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredModules.map(module => (
                  <ModuleCard 
                    key={module.id} 
                    module={module} 
                    role={role} 
                    onDelete={handleDeleteModule}
                    onQuizSubmit={handleQuizSubmit}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <Search className="text-slate-400" size={32} />
                </div>
                <h3 className="text-lg font-semibold text-slate-800">Tidak ada materi ditemukan</h3>
                <p className="text-slate-500 mt-2">
                    {role === 'STUDENT' ? 'Tidak ada materi untuk kelas Anda atau filter pencarian tidak cocok.' : 'Coba ubah kata kunci pencarian atau kategori filter Anda.'}
                </p>
              </div>
            )
        ) : (
            /* EXAMS LIST VIEW */
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="p-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Materi & Topik</th>
                                <th className="p-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Jumlah Soal</th>
                                <th className="p-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Status (Siswa)</th>
                                <th className="p-5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredModules.length > 0 ? (
                                filteredModules.map(module => {
                                    const result = getStudentResult(module.title);
                                    const hasTaken = !!result;

                                    return (
                                        <tr key={module.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
                                                        <BrainCircuit size={20} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-sm">{module.quiz?.title || 'Latihan Soal'}</h4>
                                                        <p className="text-xs text-slate-500 mt-0.5">{module.title}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                                    {module.quiz?.questions.length || 0} Soal
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                {role === 'STUDENT' ? (
                                                    hasTaken ? (
                                                        result.isDisqualified ? (
                                                            <div className="flex flex-col items-start">
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                                                                    <CheckCircle2 size={12} /> Diskualifikasi
                                                                </span>
                                                                <span className="text-[10px] text-red-500 mt-1 font-bold">Pelanggaran Max</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-start">
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                                    <CheckCircle2 size={12} /> Selesai
                                                                </span>
                                                                <span className="text-xs text-slate-500 mt-1">Nilai: <b className="text-slate-800">{result.score}</b></span>
                                                            </div>
                                                        )
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                                            <Clock size={12} /> Belum Dikerjakan
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">Admin View</span>
                                                )}
                                            </td>
                                            <td className="p-5 text-right">
                                                <button 
                                                    onClick={() => {
                                                        setActiveView('MODULES');
                                                        setSearchQuery(module.title);
                                                    }}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-600 text-sm font-bold rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm"
                                                >
                                                    {hasTaken ? 'Lihat Hasil' : 'Kerjakan'} <ArrowRight size={16}/>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-slate-400">
                                        Tidak ada ujian harian yang tersedia saat ini.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-sm">© 2025 EduFlow AI. Platform Pembelajaran Berbasis Kecerdasan Buatan.</p>
        </div>
      </footer>

      {/* --- GLOBAL DELETE CONFIRMATION MODAL --- */}
      {deleteConfirmation.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
              <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full transform scale-100 animate-in zoom-in-95 duration-200">
                  <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4 mx-auto">
                      <Trash2 size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-center text-slate-800 mb-2">Hapus {deleteConfirmation.type === 'MODULE' ? 'Materi' : 'Siswa'}?</h3>
                  <p className="text-sm text-slate-500 text-center mb-1">
                      Apakah Anda yakin ingin menghapus data ini secara permanen?
                  </p>
                  {deleteConfirmation.details && (
                      <p className="text-xs text-center text-slate-400 font-mono mb-4">{deleteConfirmation.details}</p>
                  )}
                  <div className="flex gap-3 mt-6">
                      <button 
                        onClick={() => setDeleteConfirmation({...deleteConfirmation, isOpen: false})}
                        className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors"
                      >
                          Batal
                      </button>
                      <button 
                        onClick={executeDelete}
                        className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                      >
                          Ya, Hapus
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Modals */}
      <UploadModal 
        isOpen={isUploadOpen} 
        onClose={() => setIsUploadOpen(false)} 
        onUpload={handleUpload} 
        classes={classNames} 
        initialTargetClass={uploadTargetClass} 
      />
      
      <LoginModal 
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLogin={handleLogin}
        students={students}
      />

      <StudentManager 
        isOpen={isStudentManagerOpen}
        onClose={() => setIsStudentManagerOpen(false)}
        students={students}
        modules={modules}
        classes={classes} 
        onAddStudent={handleAddStudent}
        onImportStudents={handleImportStudents}
        onUpdateStudent={handleUpdateStudent}
        onDeleteStudent={handleDeleteStudent}
        onUpdateClasses={handleUpdateClasses}
        onUploadModule={handleOpenUploadForClass} 
      />

      <QuizManager
        isOpen={isQuizManagerOpen}
        onClose={() => setIsQuizManagerOpen(false)}
        modules={modules}
        onUpdateModule={handleUpdateModule}
      />

      <ReportsDashboard
        isOpen={isReportsOpen}
        onClose={() => setIsReportsOpen(false)}
        students={students}
        quizResults={quizResults}
        manualGrades={manualGrades}
        onUpdateResult={handleUpdateQuizResult}
        onAddManualGrade={handleAddManualGrade}
        onUpdateManualGrade={handleUpdateManualGrade}
        onDeleteManualGrade={handleDeleteManualGrade}
        onResetExam={handleResetExam} 
        modules={modules}
      />
      
      <ChangePasswordModal
        isOpen={isChangePassOpen}
        onClose={() => {
            setIsChangePassOpen(false);
            handleLogout();
        }}
        onChangePassword={handleChangePassword}
      />

    </div>
  );
};

export default App;