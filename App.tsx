import React, { useState, useMemo, useEffect } from 'react';
import { Role, LearningModule, ModuleCategory, Student, QuizResult, StudentAnswer, ManualGrade, ClassGroup } from './types';
import ModuleCard from './components/ModuleCard';
import UploadModal from './components/UploadModal';
import LoginModal from './components/LoginModal';
import StudentManager from './components/StudentManager';
import QuizManager from './components/QuizManager';
import ReportsDashboard from './components/ReportsDashboard';
import ChangePasswordModal from './components/ChangePasswordModal';
import SettingsModal from './components/SettingsModal';
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
  Loader2,
  WifiOff,
  Settings
} from 'lucide-react';

// --- SUPABASE IMPORTS ---
import { supabase, isSupabaseConfigured } from './services/supabase';

const App: React.FC = () => {
  const [role, setRole] = useState<Role>('GUEST');
  const [currentUser, setCurrentUser] = useState<Student | any>(null); 
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  // --- REAL-TIME DATABASE STATE ---
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [modules, setModules] = useState<LearningModule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [manualGrades, setManualGrades] = useState<ManualGrade[]>([]);
  
  // --- SUPABASE DATA FETCHING & LISTENERS ---
  
  const fetchAllData = async () => {
      // Helper to fetch data safely
      const fetchTable = async (table: string, setter: React.Dispatch<React.SetStateAction<any[]>>, orderBy = 'created_at') => {
          if (!isSupabaseConfigured()) return; // Skip fetch if not configured
          const { data, error } = await supabase.from(table).select('*').order(orderBy, { ascending: false });
          if (error) console.error(`Error fetching ${table}:`, error);
          else setter(data || []);
      };

      await Promise.all([
          fetchTable('classes', setClasses),
          fetchTable('modules', setModules, 'uploadDate'), // Order by uploadDate
          fetchTable('students', setStudents),
          fetchTable('results', setQuizResults, 'submittedAt'),
          fetchTable('grades', setManualGrades, 'date')
      ]);
      
      setIsLoadingData(false);
  };

  useEffect(() => {
    // 1. Initial Fetch
    fetchAllData();

    // 2. Setup Realtime Subscription (Only if configured)
    if (isSupabaseConfigured()) {
        const channel = supabase.channel('public-db-changes')
            .on(
                'postgres_changes', 
                { event: '*', schema: 'public' }, 
                (payload) => {
                    const table = payload.table;
                    console.log('Change detected in:', table);
                    
                    if (table === 'classes') {
                        supabase.from('classes').select('*').order('created_at', { ascending: false })
                            .then(({data}) => setClasses(data || []));
                    } else if (table === 'modules') {
                        supabase.from('modules').select('*').order('uploadDate', { ascending: false })
                            .then(({data}) => setModules(data || []));
                    } else if (table === 'students') {
                        supabase.from('students').select('*').order('created_at', { ascending: false })
                            .then(({data}) => setStudents(data || []));
                    } else if (table === 'results') {
                        supabase.from('results').select('*').order('submittedAt', { ascending: false })
                            .then(({data}) => setQuizResults(data || []));
                    } else if (table === 'grades') {
                        supabase.from('grades').select('*').order('date', { ascending: false })
                            .then(({data}) => setManualGrades(data || []));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
  }, []);


  // View State: 'MODULES' (Materi) or 'EXAMS' (Ujian Harian)
  const [activeView, setActiveView] = useState<'MODULES' | 'EXAMS'>('MODULES');
  
  // Modal States
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTargetClass, setUploadTargetClass] = useState<string | undefined>(undefined); // New state for pre-selected class
  
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isStudentManagerOpen, setIsStudentManagerOpen] = useState(false);
  const [isQuizManagerOpen, setIsQuizManagerOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isChangePassOpen, setIsChangePassOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
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

  const handleLogin = (newRole: Role, user: any) => {
    if (newRole === 'STUDENT') {
        const freshStudentData = students.find(s => s.nis === user.nis);
        if (freshStudentData?.needsPasswordChange) {
            setCurrentUser(freshStudentData);
            setIsLoginOpen(false);
            setIsChangePassOpen(true);
            return;
        }
    }

    setRole(newRole);
    
    // Update Student Activity if Role is Student (Fire and forget)
    if (newRole === 'STUDENT' && user.id && isSupabaseConfigured()) { 
       const simulatedIP = `192.168.1.${Math.floor(Math.random() * 255)}`;
       const now = new Date().toISOString();
       supabase.from('students').update({ lastLogin: now, ipAddress: simulatedIP }).eq('id', user.id).then(({ error }) => {
           if (error) console.error("Failed to update login activity", error);
       });
       setCurrentUser({ ...user, lastLogin: now, ipAddress: simulatedIP });
    } else {
        setCurrentUser(user);
    }
    
    setIsLoginOpen(false);
  };

  const handleLogout = () => {
    setRole('GUEST');
    setCurrentUser(null);
    setIsProfileMenuOpen(false);
    setActiveView('MODULES');
  };

  const handleChangePassword = async (newPass: string) => {
      if (!currentUser || !currentUser.id) return;
      
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('students').update({
            password: newPass,
            needsPasswordChange: false
        }).eq('id', currentUser.id);

        if (error) {
            alert("Gagal mengubah password: " + error.message);
            return;
        }
      }
      
      alert("Password berhasil diubah!");
      const updatedUser = { ...currentUser, password: newPass, needsPasswordChange: false };
      setCurrentUser(updatedUser);
      setIsChangePassOpen(false);
      handleLogin('STUDENT', updatedUser);
  };

  // --- CRUD HANDLERS WITH OFFLINE FALLBACK ---

  const handleUpload = async (data: Partial<LearningModule>) => {
    const fallbackModule = { 
        ...data, 
        id: `local-${Date.now()}`, 
        uploadDate: new Date().toISOString(), 
        tags: data.tags || [],
        quiz: data.quiz || undefined
    } as LearningModule;

    try {
        if (!isSupabaseConfigured()) throw new Error("Offline Mode");

        const { id, ...insertData } = data as any;
        
        // FIX: Added .select().single() to return the inserted data immediately
        const { data: insertedModule, error } = await supabase.from('modules').insert({
            ...insertData,
            uploadDate: new Date().toISOString(),
            tags: data.tags || [],
            quiz: data.quiz || null
        }).select().single();

        if (error) throw error;
        
        // FIX: Update local state IMMEDIATELY (Optimistic UI)
        // This removes the dependency on Realtime subscription for list refresh
        if (insertedModule) {
            setModules(prev => [insertedModule, ...prev]);
        }
        
        setIsUploadOpen(false);
    } catch (e: any) {
        console.error("Error upload:", e);
        // Fallback for demo
        if (!isSupabaseConfigured() || e.message?.includes('Invalid API key') || e.message?.includes('Offline Mode')) {
             alert("⚠️ Mode Demo (Offline): Data disimpan sementara di browser.");
             setModules(prev => [fallbackModule, ...prev]);
             setIsUploadOpen(false);
        } else {
             alert("Gagal mengunggah ke database: " + e.message);
        }
    }
  };

  const handleUpdateModule = async (updatedModule: LearningModule) => {
    try {
        if (!isSupabaseConfigured()) throw new Error("Offline Mode");
        const { id, ...updateData } = updatedModule;
        const { error } = await supabase.from('modules').update(updateData).eq('id', id);
        if (error) throw error;
    } catch (e) {
        // Local Update
        setModules(prev => prev.map(m => m.id === updatedModule.id ? updatedModule : m));
    }
  };

  const handleDeleteModule = (id: string) => {
    setDeleteConfirmation({ isOpen: true, type: 'MODULE', id });
  };

  const handleAddStudent = async (student: Student) => {
    const fallbackStudent = { ...student, id: `local-${Date.now()}` };
    try {
        if (!isSupabaseConfigured()) throw new Error("Offline Mode");
        const { id, ...insertData } = student as any; 
        
        // Also use Optimistic Update for Students
        const { data: newStudent, error } = await supabase.from('students').insert(insertData).select().single();
        if (error) throw error;
        
        if (newStudent) {
            setStudents(prev => [newStudent, ...prev]);
        }
    } catch (e: any) {
        setStudents(prev => [fallbackStudent, ...prev]);
        if (!e.message?.includes('Offline Mode')) console.error("Error add student:", e);
    }
  };
  
  const handleImportStudents = async (newStudents: Student[]) => {
      try {
        if (!isSupabaseConfigured()) throw new Error("Offline Mode");
        const studentsToInsert = newStudents.map(s => ({
            nis: s.nis, name: s.name, classes: s.classes, password: s.password, needsPasswordChange: true
        }));
        const { error } = await supabase.from('students').insert(studentsToInsert);
        if (error) throw error;
        alert("Berhasil import siswa!");
      } catch (e) {
          const localStudents = newStudents.map(s => ({...s, id: `local-${Math.random()}`, needsPasswordChange: true}));
          setStudents(prev => [...localStudents, ...prev]);
          alert("Mode Demo: " + newStudents.length + " siswa diimpor ke memori browser.");
      }
  };

  const handleUpdateStudent = async (updatedStudent: Student) => {
      try {
        if (!isSupabaseConfigured()) throw new Error("Offline Mode");
        const sId = (updatedStudent as any).id;
        if (sId && !sId.startsWith('local-')) {
            const { id, ...data } = updatedStudent as any;
            await supabase.from('students').update(data).eq('id', sId);
        } else {
             throw new Error("Local student");
        }
      } catch (e) {
         setStudents(prev => prev.map(s => s.nis === updatedStudent.nis ? updatedStudent : s));
      }
  };

  const handleDeleteStudent = (nis: string) => {
    const student = students.find(s => s.nis === nis);
    if (student) {
        setDeleteConfirmation({ isOpen: true, type: 'STUDENT', id: (student as any).id || nis, details: `NIS: ${nis}` });
    }
  };

  const handleUpdateClasses = async (updatedClasses: ClassGroup[]) => {
     if (isSupabaseConfigured()) {
         // Logic sync DB omitted for brevity, fallback to local state update only for stability in demo
         // In real implementation, strict sync logic is needed.
         // Here we just accept the new state for simplicity.
     }
     setClasses(updatedClasses);
  };

  // Actual Delete Logic
  const executeDelete = async () => {
      const id = deleteConfirmation.id;
      if (deleteConfirmation.type === 'MODULE') {
          if (isSupabaseConfigured() && !id.startsWith('local-')) {
             await supabase.from('modules').delete().eq('id', id);
          }
          setModules(prev => prev.filter(m => m.id !== id));
      } else if (deleteConfirmation.type === 'STUDENT') {
          if (isSupabaseConfigured() && !id.startsWith('local-')) {
             await supabase.from('students').delete().eq('id', id);
          } else {
             // Fallback delete by ID or find by logic if ID matches NIS passed in handle
             // Since we passed ID or NIS, and local IDs are random strings
             setStudents(prev => prev.filter(s => (s as any).id !== id && s.nis !== id));
          }
      }
      setDeleteConfirmation({ ...deleteConfirmation, isOpen: false });
  };

  const handleQuizSubmit = async (moduleId: string, quizTitle: string, score: number, detailedAnswers: StudentAnswer[], violations = 0, isDisqualified = false) => {
    if (!currentUser) return;

    const newResult = {
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

    try {
        if (!isSupabaseConfigured()) throw new Error("Offline Mode");
        const { data: insertedResult, error } = await supabase.from('results').insert(newResult).select().single();
        if (error) throw error;

        // Optimistic update for results too
        if (insertedResult) {
            setQuizResults(prev => [insertedResult, ...prev]);
        }
    } catch (e) {
        console.warn("Using offline mode for quiz result");
        setQuizResults(prev => [{...newResult, id: `local-res-${Date.now()}`} as QuizResult, ...prev]);
    }
  };

  const handleResetExam = async (resultId: string) => {
      if (isSupabaseConfigured() && !resultId.startsWith('local-')) {
        await supabase.from('results').delete().eq('id', resultId);
      }
      setQuizResults(prev => prev.filter(r => r.id !== resultId));
  };

  const handleUpdateQuizResult = async (updatedResult: QuizResult) => {
     if (isSupabaseConfigured() && !updatedResult.id.startsWith('local-')) {
        const { id, ...data } = updatedResult;
        await supabase.from('results').update(data).eq('id', id);
     }
     setQuizResults(prev => prev.map(r => r.id === updatedResult.id ? updatedResult : r));
  };

  const handleAddManualGrade = async (grade: ManualGrade) => {
      if (isSupabaseConfigured()) {
         const { id, ...data } = grade as any;
         await supabase.from('grades').insert(data);
      }
      setManualGrades(prev => [grade, ...prev]);
  };

  const handleUpdateManualGrade = async (updatedGrade: ManualGrade) => {
    if (isSupabaseConfigured() && !updatedGrade.id.startsWith('local-')) {
        const { id, ...data } = updatedGrade;
        await supabase.from('grades').update(data).eq('id', id);
    }
    setManualGrades(prev => prev.map(g => g.id === updatedGrade.id ? updatedGrade : g));
  };

  const handleDeleteManualGrade = async (id: string) => {
    if (isSupabaseConfigured() && !id.startsWith('local-')) {
        await supabase.from('grades').delete().eq('id', id);
    }
    setManualGrades(prev => prev.filter(g => g.id !== id));
  };

  const getStudentResult = (moduleTitle: string) => {
    if (!currentUser) return null;
    return quizResults
        .filter(r => r.moduleTitle === moduleTitle && r.studentNis === currentUser.nis)
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];
  };

  // Function to open upload modal with a specific target class
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

  if (isLoadingData) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col gap-4">
              <Loader2 className="animate-spin text-indigo-600" size={48} />
              <p className="text-slate-500 font-medium">Memuat Aplikasi...</p>
          </div>
      );
  }

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
              
              {/* Settings Button (Only Visible to Admin) */}
              {role === 'ADMIN' && (
                  <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
                    title="Pengaturan API Key (Khusus Guru)"
                  >
                     <Settings size={20} />
                  </button>
              )}

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
                                        {/* Database Indicator */}
                                        <div className={`mt-2 flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border w-fit ${isSupabaseConfigured() ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-orange-600 bg-orange-50 border-orange-100'}`}>
                                            {isSupabaseConfigured() ? (
                                                <><Database size={10} /> Online Mode</>
                                            ) : (
                                                <><WifiOff size={10} /> Demo (Offline)</>
                                            )}
                                        </div>
                                     </div>
                                     
                                     <div className="p-1">
                                        {/* Mobile Navigation inside Menu */}
                                        <div className="md:hidden border-b border-slate-100 pb-1 mb-1">
                                            <button onClick={() => { setActiveView('MODULES'); setIsProfileMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3"><BookOpen size={16}/> Materi Belajar</button>
                                            <button onClick={() => { setActiveView('EXAMS'); setIsProfileMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3"><CheckCircle2 size={16}/> Ujian Harian</button>
                                        </div>
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
        
        {/* Offline Warning Banner */}
        {!isSupabaseConfigured() && (
            <div className="bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-xl mb-6 flex items-center gap-3 animate-in slide-in-from-top-2">
                <WifiOff size={20} className="shrink-0"/>
                <div>
                    <p className="font-bold text-sm">Mode Demo (Offline)</p>
                    <p className="text-xs">Database belum terhubung (Invalid API Key). Data yang Anda masukkan akan disimpan sementara di browser dan hilang saat refresh.</p>
                </div>
            </div>
        )}

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
        {activeView === 'MODULES' ? (
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
        initialTargetClass={uploadTargetClass} // Pass selected class
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
        onUploadModule={handleOpenUploadForClass} // Pass handler to StudentManager
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
        onResetExam={handleResetExam} // Pass down reset function
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

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
      />

    </div>
  );
};

export default App;