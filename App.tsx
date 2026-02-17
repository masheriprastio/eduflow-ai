import React, { useState, useMemo, useEffect } from 'react';
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
  Trash2
} from 'lucide-react';

// Seed Data for Classes
const INITIAL_CLASSES: ClassGroup[] = [
  { id: 'c1', name: '10-A', description: 'Kelas 10 Unggulan' },
  { id: 'c2', name: '10-B', description: 'Kelas 10 Reguler' },
  { id: 'c3', name: '11-A', description: 'Kelas 11 Sains' },
  { id: 'c4', name: '12-A', description: 'Kelas 12 Persiapan Ujian' }
];

// Seed Data for Modules
const INITIAL_MODULES: LearningModule[] = [
  {
    id: '1',
    title: 'Pengantar Kalkulus Diferensial',
    description: 'Membahas konsep dasar limit, turunan, dan aplikasinya dalam kehidupan sehari-hari.',
    category: ModuleCategory.MATHEMATICS,
    uploadDate: new Date().toISOString(),
    tags: ['Kalkulus', 'Matematika Dasar', 'Limit'],
    aiSummary: 'Pelajari dasar-dasar perubahan laju sesaat melalui konsep limit dan turunan yang menjadi pondasi analisis matematika modern.',
    fileName: 'kalkulus_dasar.pdf',
    targetClasses: ['11-A', '12-A'] // Example: Only for senior classes
  },
  {
    id: '2',
    title: 'Dasar Pemrograman Python',
    description: 'Modul praktis belajar bahasa pemrograman Python untuk analisis data.',
    category: ModuleCategory.TECHNOLOGY,
    uploadDate: new Date().toISOString(),
    tags: ['Coding', 'Python', 'Data Science'],
    aiSummary: 'Kuasai sintaks dasar Python yang ramah pemula untuk memulai perjalanan karir Anda di dunia Data Science dan otomatisasi.',
    fileName: 'python_101.ipynb'
    // No targetClasses means Public for all
  }
];

// Seed Data for Students (Updated to use 'classes' array)
const INITIAL_STUDENTS: Student[] = [
    { nis: '12345', name: 'Ahmad Dani', classes: ['10-A', '11-A'], password: 'password', needsPasswordChange: true, ipAddress: '192.168.1.10', lastLogin: new Date(Date.now() - 86400000).toISOString() },
    { nis: '54321', name: 'Siti Aminah', classes: ['10-B'], password: 'password', needsPasswordChange: true, ipAddress: '192.168.1.15', lastLogin: new Date(Date.now() - 3600000).toISOString() },
    { nis: '11223', name: 'Budi Santoso', classes: [], password: 'password', ipAddress: undefined, lastLogin: undefined } // Unassigned student
];

const App: React.FC = () => {
  const [role, setRole] = useState<Role>('GUEST');
  const [currentUser, setCurrentUser] = useState<Student | any>(null); 
  
  // --- PERSISTENT STATE INITIALIZATION ---
  // We initialize state from LocalStorage if available, otherwise use Seed Data.
  // This fixes the issue where data (like password changes) is lost on refresh.
  
  const [classes, setClasses] = useState<ClassGroup[]>(() => {
      const saved = localStorage.getItem('eduflow_classes');
      return saved ? JSON.parse(saved) : INITIAL_CLASSES;
  });

  const [modules, setModules] = useState<LearningModule[]>(() => {
      const saved = localStorage.getItem('eduflow_modules');
      return saved ? JSON.parse(saved) : INITIAL_MODULES;
  });

  const [students, setStudents] = useState<Student[]>(() => {
      const saved = localStorage.getItem('eduflow_students');
      return saved ? JSON.parse(saved) : INITIAL_STUDENTS;
  });

  const [quizResults, setQuizResults] = useState<QuizResult[]>(() => {
      const saved = localStorage.getItem('eduflow_results');
      return saved ? JSON.parse(saved) : [];
  });

  const [manualGrades, setManualGrades] = useState<ManualGrade[]>(() => {
      const saved = localStorage.getItem('eduflow_grades');
      return saved ? JSON.parse(saved) : [];
  });
  
  // --- STATE PERSISTENCE EFFECTS ---
  // Save to LocalStorage whenever state changes
  useEffect(() => { localStorage.setItem('eduflow_classes', JSON.stringify(classes)); }, [classes]);
  useEffect(() => { localStorage.setItem('eduflow_modules', JSON.stringify(modules)); }, [modules]);
  useEffect(() => { localStorage.setItem('eduflow_students', JSON.stringify(students)); }, [students]);
  useEffect(() => { localStorage.setItem('eduflow_results', JSON.stringify(quizResults)); }, [quizResults]);
  useEffect(() => { localStorage.setItem('eduflow_grades', JSON.stringify(manualGrades)); }, [manualGrades]);


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
    // FORCE PASSWORD CHANGE CHECK
    // If student needs password change, direct them to change password modal immediately
    if (newRole === 'STUDENT') {
        // Find fresh student data from state to ensure we check the latest flag
        const freshStudentData = students.find(s => s.nis === user.nis);
        if (freshStudentData?.needsPasswordChange) {
            setCurrentUser(freshStudentData);
            setIsLoginOpen(false);
            setIsChangePassOpen(true);
            return;
        }
    }

    setRole(newRole);
    
    // Update Student Activity if Role is Student
    if (newRole === 'STUDENT' && user.nis) {
       // Simulate capturing IP and timestamp
       const simulatedIP = `192.168.1.${Math.floor(Math.random() * 255)}`;
       const now = new Date().toISOString();
       
       const updatedStudents = students.map(s => 
         s.nis === user.nis 
            ? { ...s, lastLogin: now, ipAddress: simulatedIP } 
            : s
       );
       setStudents(updatedStudents);
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
    setActiveView('MODULES'); // Reset view on logout
  };

  const handleChangePassword = (newPass: string) => {
      if (!currentUser) return;
      
      const updatedStudents = students.map(s => 
          s.nis === currentUser.nis 
          ? { ...s, password: newPass, needsPasswordChange: false } 
          : s
      );
      setStudents(updatedStudents);
      
      // Update Current User context
      const updatedUser = { ...currentUser, password: newPass, needsPasswordChange: false };
      setCurrentUser(updatedUser);
      
      setIsChangePassOpen(false);
      
      // Log them in fully now
      handleLogin('STUDENT', updatedUser);
  };

  const handleUpload = (data: Partial<LearningModule>) => {
    const newModule: LearningModule = {
      id: Math.random().toString(36).substr(2, 9),
      uploadDate: new Date().toISOString(),
      tags: [],
      title: data.title || 'Untitled',
      description: data.description || '',
      category: data.category as string,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      aiSummary: data.aiSummary,
      targetClasses: data.targetClasses, // Save selected classes
      quiz: data.quiz,
      ...data
    } as LearningModule;
    
    setModules([newModule, ...modules]);
  };

  // Function to open upload modal with a specific target class
  const handleOpenUploadForClass = (className: string) => {
      setUploadTargetClass(className);
      setIsUploadOpen(true);
  };

  const handleUpdateModule = (updatedModule: LearningModule) => {
    setModules(modules.map(m => m.id === updatedModule.id ? updatedModule : m));
  };

  // Replaced window.confirm with Custom Modal Trigger
  const handleDeleteModule = (id: string) => {
    setDeleteConfirmation({ isOpen: true, type: 'MODULE', id });
  };

  const handleAddStudent = (student: Student) => {
    setStudents([...students, student]);
  };
  
  const handleImportStudents = (newStudents: Student[]) => {
      // Merge unique students based on NIS
      const existingNis = new Set(students.map(s => s.nis));
      const filteredNew = newStudents.filter(s => !existingNis.has(s.nis));
      setStudents([...students, ...filteredNew]);
  };

  const handleUpdateStudent = (updatedStudent: Student) => {
    setStudents(students.map(s => s.nis === updatedStudent.nis ? updatedStudent : s));
  };

  // Replaced window.confirm with Custom Modal Trigger
  const handleDeleteStudent = (nis: string) => {
    setDeleteConfirmation({ isOpen: true, type: 'STUDENT', id: nis, details: `NIS: ${nis}` });
  };

  const handleUpdateClasses = (updatedClasses: ClassGroup[]) => {
    setClasses(updatedClasses);
  };

  // Actual Delete Logic
  const executeDelete = () => {
      if (deleteConfirmation.type === 'MODULE') {
          setModules(modules.filter(m => m.id !== deleteConfirmation.id));
      } else if (deleteConfirmation.type === 'STUDENT') {
          setStudents(students.filter(s => s.nis !== deleteConfirmation.id));
      }
      setDeleteConfirmation({ ...deleteConfirmation, isOpen: false });
  };

  // Callback when a student finishes a quiz
  const handleQuizSubmit = (moduleId: string, quizTitle: string, score: number, detailedAnswers: StudentAnswer[], violations = 0, isDisqualified = false) => {
    if (!currentUser) return;

    // Check if result already exists for this module attempt (simple logic, assume overwrite or new attempt)
    // For simplicity, we just add new result to history
    const newResult: QuizResult = {
        id: Date.now().toString(),
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

    setQuizResults([newResult, ...quizResults]);
  };

  // Reset Exam Violation (Deletes the attempt so they can retake)
  const handleResetExam = (resultId: string) => {
      setQuizResults(prev => prev.filter(r => r.id !== resultId));
  };

  // Callback to update quiz results (after grading)
  const handleUpdateQuizResult = (updatedResult: QuizResult) => {
     setQuizResults(prev => prev.map(r => r.id === updatedResult.id ? updatedResult : r));
  };

  const handleAddManualGrade = (grade: ManualGrade) => {
    setManualGrades(prev => [grade, ...prev]);
  };

  const handleUpdateManualGrade = (updatedGrade: ManualGrade) => {
    setManualGrades(prev => prev.map(g => g.id === updatedGrade.id ? updatedGrade : g));
  };

  const handleDeleteManualGrade = (id: string) => {
    setManualGrades(currentGrades => currentGrades.filter(g => g.id !== id));
  };

  // Helper to find student's result for a module
  const getStudentResult = (moduleTitle: string) => {
    if (!currentUser) return null;
    // Find the latest submission for this module by this student
    return quizResults
        .filter(r => r.moduleTitle === moduleTitle && r.studentNis === currentUser.nis)
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];
  };

  const filteredModules = useMemo(() => {
    return modules.filter(m => {
      // 1. Basic Search & Category Filter
      const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            m.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
      
      // 2. Exam View Filter
      const isExamViewFilter = activeView === 'EXAMS' ? (m.quiz !== undefined && m.quiz.questions.length > 0) : true;

      // 3. Class/Enrollment Filter (Access Control)
      let hasAccess = true;
      if (role === 'ADMIN') {
        hasAccess = true; // Admin sees all
      } else if (role === 'GUEST') {
        // Guest only sees public modules (targetClasses is undefined or empty)
        hasAccess = !m.targetClasses || m.targetClasses.length === 0;
      } else if (role === 'STUDENT' && currentUser) {
        // Student sees public modules OR modules assigned to ANY of their classes
        const isPublic = !m.targetClasses || m.targetClasses.length === 0;
        
        // CHECK: Is any of student's classes in the module's targetClasses?
        const studentClasses = currentUser.classes || [];
        const isAssignedToClass = studentClasses.some((c: string) => m.targetClasses?.includes(c));
        
        hasAccess = isPublic || !!isAssignedToClass;
      }

      return matchesSearch && matchesCategory && isExamViewFilter && hasAccess;
    });
  }, [modules, searchQuery, selectedCategory, activeView, role, currentUser]);

  // Helper text for profile
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
                                Penilaian & Laporan
                            </button>
                            <button 
                                onClick={() => setIsStudentManagerOpen(true)}
                                className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-indigo-600 px-3 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
                            >
                                <Users size={18} />
                                Data Siswa
                            </button>
                            <button 
                                onClick={() => setIsQuizManagerOpen(true)}
                                className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-indigo-600 px-3 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
                            >
                                <BrainCircuit size={18} />
                                Kelola Kuis
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
                                     </div>
                                     
                                     <div className="p-1">
                                        {/* Mobile Navigation inside Menu */}
                                        <div className="md:hidden border-b border-slate-100 pb-1 mb-1">
                                            <button 
                                                onClick={() => { setActiveView('MODULES'); setIsProfileMenuOpen(false); }}
                                                className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                                            >
                                                <BookOpen size={16}/> Materi Belajar
                                            </button>
                                            <button 
                                                onClick={() => { setActiveView('EXAMS'); setIsProfileMenuOpen(false); }}
                                                className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                                            >
                                                <CheckCircle2 size={16}/> Ujian Harian
                                            </button>
                                        </div>

                                        {role === 'ADMIN' && (
                                            <div className="lg:hidden border-b border-slate-100 pb-1 mb-1">
                                                <button onClick={() => { setIsReportsOpen(true); setIsProfileMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3"><BarChart3 size={16}/> Penilaian & Laporan</button>
                                                <button onClick={() => { setIsStudentManagerOpen(true); setIsProfileMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3"><Users size={16}/> Data Siswa</button>
                                                <button onClick={() => { setIsQuizManagerOpen(true); setIsProfileMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3"><BrainCircuit size={16}/> Kelola Kuis</button>
                                                <button onClick={() => { setUploadTargetClass(undefined); setIsUploadOpen(true); setIsProfileMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3"><PlusCircle size={16}/> Unggah Materi</button>
                                            </div>
                                        )}
                                        <button 
                                            onClick={handleLogout}
                                            className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-3 transition-colors"
                                        >
                                            <div className="p-1.5 bg-red-100 text-red-600 rounded-md">
                                                <LogOut size={16} />
                                            </div>
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
        {/* ... (Header content omitted for brevity, logic handled) ... */}
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

        {/* ... (Stats and Search sections remain the same) ... */}
        {/* ADMIN STATS - Only on Modules View */}
        {role === 'ADMIN' && activeView === 'MODULES' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div onClick={() => setIsReportsOpen(true)} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all group relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-3">
                         <div className="bg-blue-50 text-blue-600 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">Laporan Lengkap</div>
                    </div>
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform"><BarChart3 size={28} /></div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium mb-0.5">Hasil Ujian Siswa</p>
                        <h3 className="text-2xl font-bold text-slate-800">{quizResults.length} <span className="text-sm font-normal text-slate-400">Data Masuk</span></h3>
                    </div>
                </div>
                {/* ... other stats ... */}
                <div onClick={() => setIsStudentManagerOpen(true)} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all group relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-3">
                         <div className="bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">Kelola</div>
                    </div>
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-110 transition-transform"><Users size={28} /></div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium mb-0.5">Siswa Terdaftar</p>
                        <h3 className="text-2xl font-bold text-slate-800">{students.length} <span className="text-sm font-normal text-slate-400">Akun</span></h3>
                    </div>
                </div>
                <div onClick={() => setIsQuizManagerOpen(true)} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all group relative overflow-hidden">
                     <div className="absolute right-0 top-0 p-3">
                         <div className="bg-amber-50 text-amber-600 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">Edit Kuis</div>
                    </div>
                     <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl group-hover:scale-110 transition-transform"><BrainCircuit size={28} /></div>
                     <div>
                        <p className="text-sm text-slate-500 font-medium mb-0.5">Bank Soal</p>
                        <h3 className="text-2xl font-bold text-slate-800">{modules.filter(m => m.quiz).length} <span className="text-sm font-normal text-slate-400">Aktif</span></h3>
                    </div>
                </div>
            </div>
        )}

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

    </div>
  );
};

export default App;