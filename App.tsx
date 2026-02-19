
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
  Settings,
  Lock,
  Menu,
  LayoutDashboard,
  X
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
  
  // Edit State
  const [editingModule, setEditingModule] = useState<LearningModule | undefined>(undefined);

  // Sidebar Mobile State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    setIsSidebarOpen(false);
    setActiveView('MODULES');
    // Reset all modals
    setIsStudentManagerOpen(false);
    setIsQuizManagerOpen(false);
    setIsReportsOpen(false);
    setIsSettingsOpen(false);
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

  // Helper to close modals when navigating
  const resetModals = () => {
      setIsStudentManagerOpen(false);
      setIsQuizManagerOpen(false);
      setIsReportsOpen(false);
      setIsSettingsOpen(false);
      setIsChangePassOpen(false);
      setIsSidebarOpen(false); // Close sidebar on mobile after click
  };

  // --- CRUD HANDLERS WITH OFFLINE FALLBACK ---

  // Unified Handler for Upload (Create) and Edit (Update)
  const handleFormSubmit = async (data: Partial<LearningModule>) => {
    // Check if it's an update (ID exists in payload or editingModule state)
    if (data.id) {
        const updatedModule = { ...editingModule, ...data } as LearningModule;
        await handleUpdateModule(updatedModule);
        setEditingModule(undefined); // Clear edit state
    } else {
        // Create new
        await handleUpload(data);
    }
    setIsUploadOpen(false);
  };

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
        
        // Update local state immediately for responsiveness
        setModules(prev => prev.map(m => m.id === updatedModule.id ? updatedModule : m));
    } catch (e: any) {
        console.error("Update error:", e);
        // Local Update Fallback
        if (e.message === "Offline Mode") {
             setModules(prev => prev.map(m => m.id === updatedModule.id ? updatedModule : m));
             alert("⚠️ Mode Offline: Perubahan disimpan sementara.");
        } else {
             alert("Gagal menyimpan perubahan: " + e.message);
        }
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
    return (modules || []).filter(m => {
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
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* --- LEFT SIDEBAR (PERSISTENT NAV FOR AUTH USERS) --- */}
      {role !== 'GUEST' && (
          <>
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar Content */}
            <aside className={`fixed md:relative inset-y-0 left-0 w-64 bg-slate-900 text-white z-50 flex flex-col transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} shadow-xl`}>
                
                {/* Brand */}
                <div className="p-6 flex items-center gap-3 border-b border-slate-800">
                    <div className="bg-indigo-600 p-2 rounded-lg">
                        <GraduationCap size={24} className="text-white"/>
                    </div>
                    <div>
                        <h1 className="font-bold text-lg tracking-tight">EduFlow AI</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Learning System</p>
                    </div>
                    <button 
                        onClick={() => setIsSidebarOpen(false)} 
                        className="md:hidden ml-auto text-slate-400 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Nav Links */}
                <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
                    <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Menu Utama</p>
                    
                    <button 
                        onClick={() => resetModals()}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-left"
                    >
                        <LayoutDashboard size={20} />
                        Materi Pembelajaran
                    </button>

                    {role === 'ADMIN' && (
                        <>
                            <button 
                                onClick={() => { resetModals(); setIsStudentManagerOpen(true); }}
                                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-left"
                            >
                                <Users size={20} />
                                Kelola Siswa & Kelas
                            </button>
                            <button 
                                onClick={() => { resetModals(); setIsQuizManagerOpen(true); }}
                                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-left"
                            >
                                <BrainCircuit size={20} />
                                Bank Soal & Kuis
                            </button>
                            <button 
                                onClick={() => { resetModals(); setIsReportsOpen(true); }}
                                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-left"
                            >
                                <BarChart3 size={20} />
                                Laporan & Nilai
                            </button>
                            
                            <div className="my-4 h-px bg-slate-800 mx-3"></div>
                            <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Sistem</p>
                            
                            <button 
                                onClick={() => { resetModals(); setIsSettingsOpen(true); }}
                                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-left"
                            >
                                <Settings size={20} />
                                Pengaturan
                            </button>
                        </>
                    )}

                    {role === 'STUDENT' && (
                        <>
                            <button 
                                onClick={() => { resetModals(); setIsChangePassOpen(true); }}
                                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-left"
                            >
                                <Settings size={20} />
                                Ganti Password
                            </button>
                        </>
                    )}
                </div>

                {/* User Profile Footer */}
                <div className="p-4 bg-slate-950/50 border-t border-slate-800">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold shadow-md">
                            {currentUser?.name?.charAt(0) || <UserCircle size={20}/>}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{currentUser?.name}</p>
                            <p className="text-xs text-slate-400 truncate capitalize">{role === 'ADMIN' ? 'Administrator' : 'Siswa'}</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 bg-red-600/10 text-red-400 hover:bg-red-600 hover:text-white py-2 rounded-lg text-xs font-bold transition-all"
                    >
                        <LogOut size={14} /> Keluar Aplikasi
                    </button>
                </div>
            </aside>
          </>
      )}

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full">
        
        {/* Mobile Header (Only for Auth Users on Mobile) */}
        {role !== 'GUEST' && (
            <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600 hover:text-slate-900">
                        <Menu size={24} />
                    </button>
                    <span className="font-bold text-lg text-slate-800">EduFlow AI</span>
                </div>
                <div className="flex items-center gap-2">
                    {!isSupabaseConfigured() && (
                        <WifiOff size={16} className="text-red-500"/>
                    )}
                </div>
            </div>
        )}

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8 scrollbar-hide">
            
            {/* GUEST LANDING PAGE */}
            {role === 'GUEST' ? (
                <div className="min-h-full flex flex-col items-center justify-center text-center">
                    <div className="w-full max-w-4xl px-6">
                        <div className="bg-white rounded-3xl p-8 md:p-16 shadow-2xl border border-slate-100 relative overflow-hidden">
                            
                            {/* Background decoration */}
                            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
                            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-purple-50 rounded-full blur-3xl opacity-50"></div>

                            <div className="relative z-10 flex flex-col items-center">
                                <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg shadow-indigo-200 mb-8 transform hover:scale-110 transition-transform duration-500">
                                    <GraduationCap size={48} />
                                </div>
                                
                                <span className="inline-block py-1.5 px-4 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-extrabold tracking-widest uppercase mb-6">
                                    Learning Management System v2.0
                                </span>
                                
                                <h1 className="text-4xl md:text-6xl font-black text-slate-900 mb-6 leading-tight tracking-tight">
                                    Belajar Lebih Cerdas <br/>
                                    dengan <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Bantuan AI</span>
                                </h1>
                                
                                <p className="text-slate-500 text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
                                    Platform pembelajaran modern dengan integrasi Tutor AI, bank soal otomatis, dan manajemen kelas yang efisien.
                                </p>
                                
                                <button 
                                    onClick={() => setIsLoginOpen(true)}
                                    className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:scale-95 flex items-center gap-3 group"
                                >
                                    <LogIn size={20} className="group-hover:translate-x-1 transition-transform"/> 
                                    Masuk ke Aplikasi
                                </button>

                                <div className="mt-12 flex items-center justify-center gap-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                                    {/* Mock logos or indicators */}
                                    <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
                                        <Database size={16}/> Supabase DB
                                    </div>
                                    <div className="h-4 w-px bg-slate-300"></div>
                                    <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
                                        <BrainCircuit size={16}/> Gemini AI
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* AUTHENTICATED DASHBOARD CONTENT */
                <div className="max-w-7xl mx-auto">
                    
                    {/* Page Header */}
                    <div className="mb-8">
                        <h2 className="text-3xl font-bold text-slate-800">
                            {role === 'ADMIN' ? 'Dashboard Guru' : 'Ruang Belajar'}
                        </h2>
                        <p className="text-slate-500">Selamat datang kembali, {currentUser?.name}.</p>
                    </div>

                    {/* Filter Bar & Actions */}
                    <div className="flex flex-col gap-4 mb-8 sticky top-0 z-30 bg-slate-50/95 backdrop-blur-sm py-4 border-b border-slate-200 xl:border-none xl:bg-transparent xl:static">
                        
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                            {/* Search Input */}
                            <div className="relative flex-1 w-full">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                                <input 
                                    type="text" 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Cari materi pembelajaran..." 
                                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-700 transition-all bg-white"
                                />
                            </div>

                            {/* Admin Action */}
                            {role === 'ADMIN' && (
                                <button 
                                    onClick={() => {
                                        setEditingModule(undefined); 
                                        setUploadTargetClass(undefined);
                                        setIsUploadOpen(true);
                                    }}
                                    className="flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-3.5 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all active:scale-95 shrink-0 w-full md:w-auto"
                                >
                                    <PlusCircle size={20} />
                                    <span>Upload Materi</span>
                                </button>
                            )}
                        </div>
                        
                        {/* Category Filter */}
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide w-full">
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

                    {/* Content Grid */}
                    {filteredModules.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {filteredModules.map((module) => (
                                <ModuleCard 
                                    key={module.id} 
                                    module={module} 
                                    role={role}
                                    onDelete={handleDeleteModule}
                                    onEdit={(mod) => {
                                        setEditingModule(mod);
                                        setIsUploadOpen(true);
                                    }}
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
                </div>
            )}
        </main>
      </div>

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
        onUpload={handleFormSubmit}
        classes={classNames}
        initialTargetClass={uploadTargetClass}
        initialData={editingModule}
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
            setEditingModule(undefined); // Ensure fresh create mode
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
