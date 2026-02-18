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
import { setGlobalApiKey } from './services/geminiService';

const CONFIG_MODULE_ID = '00000000-0000-0000-0000-000000000000';
const CONFIG_MODULE_TITLE = 'SYSTEM_CONFIG_DO_NOT_DELETE';

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
      // 1. Create a timeout promise that resolves after 5 seconds to prevent infinite loading
      const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => {
              console.warn("Data fetching timed out - forcing app load.");
              resolve('TIMEOUT');
          }, 5000);
      });

      // 2. Create the actual data fetching promise
      const fetchDataPromise = async () => {
          // Helper to fetch data safely
          const fetchTable = async (table: string, setter: React.Dispatch<React.SetStateAction<any[]>>, orderBy = 'created_at') => {
              if (!isSupabaseConfigured()) return; // Skip fetch if not configured
              try {
                  const { data, error } = await supabase.from(table).select('*').order(orderBy, { ascending: false });
                  if (error) {
                      console.warn(`Error fetching ${table}:`, error.message);
                  } else {
                      setter(data || []);
                  }
              } catch (err) {
                  console.warn(`Exception fetching ${table}:`, err);
              }
          };

          // Helper to fetch system settings (API Key) - NOW USING MODULES TABLE FALLBACK
          const fetchSettings = async () => {
              if (!isSupabaseConfigured()) return;
              try {
                  // Attempt to fetch API Key from 'modules' table using specific ID or Title
                  // We reuse the 'modules' table because 'system_settings' might not exist
                  
                  // Try explicit ID first
                  let { data, error } = await supabase.from('modules').select('description').eq('id', CONFIG_MODULE_ID).single();
                  
                  // If not found by ID, try by Title (Fallback for auto-generated UUIDs)
                  if (!data || error) {
                      const titleResult = await supabase.from('modules').select('description').eq('title', CONFIG_MODULE_TITLE).limit(1).single();
                      data = titleResult.data;
                      error = titleResult.error;
                  }

                  if (data && data.description) {
                      console.log("Global API Key loaded from database (Module Storage).");
                      setGlobalApiKey(data.description);
                  } else if (error) {
                      console.debug("System settings not found or error:", error.message);
                  }
              } catch (e) {
                  console.debug("Failed to fetch system settings");
              }
          };

          await Promise.all([
              fetchTable('classes', setClasses),
              fetchTable('modules', setModules, 'uploadDate'), // Order by uploadDate
              fetchTable('students', setStudents),
              fetchTable('results', setQuizResults, 'submittedAt'),
              fetchTable('grades', setManualGrades, 'date'),
              fetchSettings() // Fetch API key
          ]);
      };

      try {
          // Race between fetching and timeout
          // If fetching is fast, good. If it hangs, timeout wins and we proceed.
          await Promise.race([fetchDataPromise(), timeoutPromise]);
      } catch (error) {
          console.error("Critical error during initial data load:", error);
      } finally {
          // ALWAYS turn off loading screen
          setIsLoadingData(false);
      }
  };

  useEffect(() => {
    // 1. Initial Fetch
    fetchAllData();

    // 2. Setup Realtime Subscription (Only if configured)
    let channel: any;
    if (isSupabaseConfigured()) {
        try {
            channel = supabase.channel('public-db-changes')
                .on(
                    'postgres_changes', 
                    { event: '*', schema: 'public' }, 
                    (payload) => {
                        const table = payload.table;
                        // Refresh data silently on change
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
        } catch (err) {
            console.error("Realtime subscription error:", err);
        }
    }

    return () => {
        if (channel) supabase.removeChannel(channel);
    };
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
  
  const confirmDeleteModule = async () => {
    const id = deleteConfirmation.id;
    try {
        if (isSupabaseConfigured()) {
            await supabase.from('modules').delete().eq('id', id);
        }
        setModules(prev => prev.filter(m => m.id !== id));
        setDeleteConfirmation({ isOpen: false, type: 'MODULE', id: '' });
    } catch (e) {
        alert("Gagal menghapus modul.");
    }
  };

  const handleAddStudent = async (student: Student) => {
    const fallbackStudent = { ...student, id: `local-${Date.now()}` };
    try {
        if (!isSupabaseConfigured()) throw new Error("Offline Mode");
        const { id, ...insertData } = student as any; 
        
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
          const localStudents = newStudents.map(s => ({...s, id: `local-${Date.now()}-${Math.random()}` }));
          setStudents(prev => [...localStudents, ...prev]);
          alert("Mode Offline: Siswa diimpor secara lokal.");
      }
  };

  const handleUpdateStudent = async (student: Student) => {
      try {
        if (isSupabaseConfigured()) {
             // Try to find the student ID if we have it, otherwise update by NIS
             // Assuming NIS is unique
             const { error } = await supabase.from('students').update({
                 name: student.name,
                 classes: student.classes,
                 password: student.password
             }).eq('nis', student.nis);
             if (error) throw error;
        }
        setStudents(prev => prev.map(s => s.nis === student.nis ? student : s));
      } catch (e: any) {
        console.error("Update student error", e);
      }
  };

  const handleDeleteStudent = async (nis: string) => {
      if (window.confirm("Yakin ingin menghapus siswa ini?")) {
        try {
            if (isSupabaseConfigured()) {
                await supabase.from('students').delete().eq('nis', nis);
            }
            setStudents(prev => prev.filter(s => s.nis !== nis));
        } catch (e) {
            console.error("Delete student error", e);
        }
      }
  };

  const handleUpdateClasses = (newClasses: ClassGroup[]) => {
     setClasses(newClasses);
  };

  // --- QUIZ & RESULTS HANDLERS ---

  const handleQuizSubmit = async (moduleId: string, quizTitle: string, score: number, detailedAnswers: StudentAnswer[], violations = 0, isDisqualified = false) => {
    if (!currentUser) return;

    const resultData: QuizResult = {
        id: `res-${Date.now()}`,
        studentName: currentUser.name,
        studentNis: currentUser.nis,
        moduleTitle: modules.find(m => m.id === moduleId)?.title || 'Unknown Module',
        quizTitle: quizTitle,
        score: score,
        submittedAt: new Date().toISOString(),
        answers: detailedAnswers,
        violations,
        isDisqualified
    };

    try {
        if (isSupabaseConfigured()) {
            // Note: answers jsonb, score int, etc.
            const { error } = await supabase.from('results').insert({
                ...resultData,
                answers: detailedAnswers // Supabase handles JSON automatically if column is jsonb
            });
            if (error) throw error;
        }
        
        setQuizResults(prev => [resultData, ...prev]);
    } catch (e) {
        console.error("Submit quiz error", e);
        // Save locally fallback
        setQuizResults(prev => [resultData, ...prev]);
    }
  };

  const handleUpdateResult = async (updatedResult: QuizResult) => {
      try {
        if (isSupabaseConfigured()) {
            const { error } = await supabase.from('results').update({
                score: updatedResult.score,
                answers: updatedResult.answers
            }).eq('id', updatedResult.id);
            if (error) throw error;
        }
        setQuizResults(prev => prev.map(r => r.id === updatedResult.id ? updatedResult : r));
      } catch (e) {
          console.error("Update result error", e);
      }
  };
  
  const handleResetExam = async (resultId: string) => {
      try {
        if (isSupabaseConfigured()) {
            await supabase.from('results').delete().eq('id', resultId);
        }
        setQuizResults(prev => prev.filter(r => r.id !== resultId));
      } catch (e) {
        console.error("Reset exam error", e);
      }
  };

  // --- MANUAL GRADES HANDLERS ---
  
  const handleAddManualGrade = async (grade: ManualGrade) => {
      try {
        if (isSupabaseConfigured()) {
             const { id, ...data } = grade;
             const { data: inserted, error } = await supabase.from('grades').insert(data).select().single();
             if (error) throw error;
             if (inserted) {
                 setManualGrades(prev => [inserted, ...prev]);
                 return;
             }
        }
        setManualGrades(prev => [grade, ...prev]);
      } catch (e) {
        console.error("Add manual grade error", e);
        setManualGrades(prev => [grade, ...prev]); // Fallback
      }
  };

  const handleUpdateManualGrade = async (grade: ManualGrade) => {
      try {
        if (isSupabaseConfigured()) {
             const { error } = await supabase.from('grades').update({
                 score: grade.score,
                 moduleId: grade.moduleId,
                 title: grade.title
             }).eq('id', grade.id);
             if (error) throw error;
        }
        setManualGrades(prev => prev.map(g => g.id === grade.id ? grade : g));
      } catch (e) {
        console.error("Update manual grade error", e);
      }
  };

  const handleDeleteManualGrade = async (gradeId: string) => {
      try {
        if (isSupabaseConfigured()) {
             const { error } = await supabase.from('grades').delete().eq('id', gradeId);
             if (error) throw error;
        }
        setManualGrades(prev => prev.filter(g => g.id !== gradeId));
      } catch (e) {
        console.error("Delete manual grade error", e);
      }
  };

  // --- RENDER HELPERS ---

  const filteredModules = useMemo(() => {
    return modules.filter(m => {
        // EXCLUDE SYSTEM CONFIG MODULE (STRICT CHECK)
        if (m.id === CONFIG_MODULE_ID || m.title === CONFIG_MODULE_TITLE || m.tags?.includes('hidden')) return false;

        const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) 
                            || m.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
        
        // Student Access Control: 
        if (role === 'STUDENT' && currentUser) {
             const studentClasses = currentUser.classes || [];
             const isPublic = !m.targetClasses || m.targetClasses.length === 0;
             const isAssigned = m.targetClasses?.some(c => studentClasses.includes(c));
             
             if (!isPublic && !isAssigned) return false;
        }

        return matchesSearch && matchesCategory;
    });
  }, [modules, searchQuery, selectedCategory, role, currentUser]);

  if (isLoadingData) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
              <Loader2 size={48} className="text-indigo-600 animate-spin"/>
              <p className="text-slate-500 font-medium animate-pulse">Memuat Data Sekolah...</p>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      
      {/* NAVBAR */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-200">
                <GraduationCap size={24} />
              </div>
              <div>
                 <h1 className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 tracking-tight">
                    EduFlow AI
                 </h1>
                 <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Learning System</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
               {!isSupabaseConfigured() && (
                   <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-100 rounded-full text-red-600 text-xs font-bold" title="Database tidak terhubung">
                       <WifiOff size={12}/> Offline Mode
                   </div>
               )}

               {role === 'GUEST' ? (
                 <button 
                   onClick={() => setIsLoginOpen(true)}
                   className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-slate-800 transition-all shadow-md hover:shadow-lg active:scale-95"
                 >
                   <LogIn size={18} /> Masuk
                 </button>
               ) : (
                 <div className="relative">
                   <button 
                      onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                      className="flex items-center gap-3 pl-3 pr-2 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 transition-all bg-white shadow-sm"
                   >
                     <div className="text-right hidden sm:block">
                        <p className="text-xs font-bold text-slate-800">{currentUser?.name}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{role === 'ADMIN' ? 'Guru / Admin' : `Siswa ${currentUser?.classes?.[0] || ''}`}</p>
                     </div>
                     <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-full flex items-center justify-center text-white font-bold shadow-inner">
                        {currentUser?.name?.charAt(0) || <UserCircle size={20}/>}
                     </div>
                     <ChevronDown size={14} className="text-slate-400 mr-1"/>
                   </button>

                   {/* Dropdown Menu */}
                   {isProfileMenuOpen && (
                       <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-2 animate-in fade-in slide-in-from-top-5 z-50">
                           <div className="px-4 py-3 border-b border-slate-100 sm:hidden">
                                <p className="text-sm font-bold text-slate-800">{currentUser?.name}</p>
                                <p className="text-xs text-slate-500">{role}</p>
                           </div>
                           
                           {role === 'ADMIN' && (
                               <>
                                   <button 
                                      onClick={() => { setIsSettingsOpen(true); setIsProfileMenuOpen(false); }}
                                      className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2"
                                   >
                                       <Settings size={16}/> Pengaturan Sistem
                                   </button>
                                   <button 
                                      onClick={() => { setIsStudentManagerOpen(true); setIsProfileMenuOpen(false); }}
                                      className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2"
                                   >
                                       <Users size={16}/> Kelola Siswa & Kelas
                                   </button>
                                   <button 
                                      onClick={() => { setIsQuizManagerOpen(true); setIsProfileMenuOpen(false); }}
                                      className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2"
                                   >
                                       <BrainCircuit size={16}/> Bank Soal & Kuis
                                   </button>
                                   <button 
                                      onClick={() => { setIsReportsOpen(true); setIsProfileMenuOpen(false); }}
                                      className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2"
                                   >
                                       <BarChart3 size={16}/> Laporan & Nilai
                                   </button>
                                   <div className="h-px bg-slate-100 my-2"></div>
                               </>
                           )}

                           <button 
                              onClick={() => { setIsChangePassOpen(true); setIsProfileMenuOpen(false); }}
                              className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-amber-50 hover:text-amber-600 flex items-center gap-2"
                           >
                               <Settings size={16}/> Ganti Password
                           </button>
                           
                           <button 
                              onClick={handleLogout}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                           >
                               <LogOut size={16}/> Keluar
                           </button>
                       </div>
                   )}
                 </div>
               )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Welcome Banner */}
        {role === 'GUEST' ? (
             <div className="bg-indigo-600 rounded-3xl p-8 md:p-12 mb-10 text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
                <div className="relative z-10 max-w-2xl">
                    <span className="inline-block py-1 px-3 rounded-full bg-indigo-500/50 border border-indigo-400 backdrop-blur-md text-xs font-bold mb-4">
                        Learning Management System v2.0
                    </span>
                    <h2 className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight">
                        Belajar Lebih Cerdas dengan <span className="text-yellow-300">Bantuan AI</span>
                    </h2>
                    <p className="text-indigo-100 text-lg mb-8 leading-relaxed">
                        Akses ribuan materi pelajaran, latihan soal interaktif, dan dapatkan bimbingan langsung dari Tutor AI kapan saja.
                    </p>
                    <button 
                        onClick={() => setIsLoginOpen(true)}
                        className="bg-white text-indigo-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-indigo-50 transition-all shadow-lg active:scale-95 flex items-center gap-2"
                    >
                        Mulai Belajar Sekarang <ArrowRight size={20}/>
                    </button>
                </div>
                
                {/* Decoration Circles */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-20 w-60 h-60 bg-indigo-400/20 rounded-full blur-2xl"></div>
             </div>
        ) : (
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-800">Halo, {currentUser?.name} 👋</h2>
                <p className="text-slate-500">Selamat datang kembali di dashboard pembelajaran.</p>
            </div>
        )}

        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 sticky top-20 z-30 bg-slate-50/90 backdrop-blur-sm py-2">
            <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari materi pembelajaran..." 
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-700 transition-all"
                />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                <button 
                    onClick={() => setSelectedCategory('All')}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all border ${selectedCategory === 'All' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                >
                    Semua
                </button>
                {(Object.values(ModuleCategory) as string[]).map((cat) => (
                    <button 
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all border ${selectedCategory === cat ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>
        </div>

        {/* Action Bar (Admin Only) */}
        {role === 'ADMIN' && (
            <div className="mb-8 flex justify-end">
                <button 
                    onClick={() => {
                        setUploadTargetClass(undefined);
                        setIsUploadOpen(true);
                    }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95"
                >
                    <PlusCircle size={20} />
                    Upload Materi Baru
                </button>
            </div>
        )}

        {/* Content Grid */}
        {filteredModules.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredModules.map((module) => (
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
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <BookOpen size={40} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Tidak ada materi ditemukan</h3>
                <p className="text-slate-500 max-w-md mx-auto">
                    {searchQuery || selectedCategory !== 'All' 
                        ? 'Coba ubah kata kunci pencarian atau kategori filter Anda.' 
                        : 'Belum ada materi yang diunggah oleh guru.'}
                </p>
                {(role === 'ADMIN' && !searchQuery) && (
                    <button 
                        onClick={() => setIsUploadOpen(true)}
                        className="mt-6 text-indigo-600 font-bold hover:underline"
                    >
                        + Upload Materi Pertama
                    </button>
                )}
            </div>
        )}

      </main>

      {/* --- MODALS --- */}

      <LoginModal 
        isOpen={isLoginOpen} 
        onClose={() => setIsLoginOpen(false)} 
        onLogin={handleLogin}
        students={students}
      />

      <UploadModal 
        isOpen={isUploadOpen} 
        onClose={() => setIsUploadOpen(false)}
        onUpload={handleUpload}
        classes={classNames}
        initialTargetClass={uploadTargetClass}
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
        onUploadModule={(className) => {
            setUploadTargetClass(className);
            setIsUploadOpen(true);
        }}
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
        modules={modules}
        onUpdateResult={handleUpdateResult}
        onAddManualGrade={handleAddManualGrade}
        onUpdateManualGrade={handleUpdateManualGrade}
        onDeleteManualGrade={handleDeleteManualGrade}
        onResetExam={handleResetExam}
      />

      <ChangePasswordModal 
         isOpen={isChangePassOpen}
         onClose={handleLogout}
         onChangePassword={handleChangePassword}
      />

      <SettingsModal
         isOpen={isSettingsOpen}
         onClose={() => setIsSettingsOpen(false)}
      />

      {/* Delete Confirmation Modal (Global) */}
      {deleteConfirmation.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in-95 duration-200">
                  <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4 mx-auto">
                      <Trash2 size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-center text-slate-800 mb-2">Hapus Materi?</h3>
                  <p className="text-sm text-slate-500 text-center mb-6">
                      Materi dan kuis yang terkait akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
                  </p>
                  <div className="flex gap-3">
                      <button 
                        onClick={() => setDeleteConfirmation({isOpen: false, type: 'MODULE', id: ''})}
                        className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors"
                      >
                          Batal
                      </button>
                      <button 
                        onClick={confirmDeleteModule}
                        className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                      >
                          Ya, Hapus
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default App;