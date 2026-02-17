import React, { useState, useEffect, useRef } from 'react';
import { LearningModule, Role, Question, StudentAnswer } from '../types';
import { askAboutModule } from '../services/geminiService';
import { 
  BookOpen, 
  Download, 
  Sparkles, 
  MessageCircle, 
  Send,
  Trash2,
  BrainCircuit,
  X,
  CheckCircle,
  XCircle,
  Trophy,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Pencil,
  ImageIcon,
  Users,
  Timer,
  AlertTriangle,
  Maximize2,
  Lock,
  Ban,
  GraduationCap,
  CalendarClock,
  Clock,
  List
} from 'lucide-react';

interface ModuleCardProps {
  module: LearningModule;
  role: Role;
  onDelete?: (id: string) => void;
  onQuizSubmit?: (moduleId: string, quizTitle: string, score: number, detailedAnswers: StudentAnswer[], violations?: number, isDisqualified?: boolean) => void;
}

const ModuleCard: React.FC<ModuleCardProps> = ({ module, role, onDelete, onQuizSubmit }) => {
  const [showAIHelp, setShowAIHelp] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Quiz State
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizStatus, setQuizStatus] = useState<'IDLE' | 'RUNNING' | 'COMPLETED' | 'DISQUALIFIED'>('IDLE');
  const [score, setScore] = useState(0);
  
  // New: Shuffled questions for the current session
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
  // New: Current Question Index for Pagination
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // --- EXAM & ANTI-CHEAT STATE ---
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const [violations, setViolations] = useState(0);
  const MAX_VIOLATIONS = 3;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [violationMsg, setViolationMsg] = useState<string | null>(null);

  const handleAskAI = async () => {
    if (!question.trim()) return;
    setIsLoading(true);
    const response = await askAboutModule(module.title, module.description + (module.aiSummary || ''), question);
    setAnswer(response || 'Tidak ada respons.');
    setIsLoading(false);
  };

  // Check Schedule Validity
  const checkSchedule = (): { status: 'OPEN' | 'NOT_STARTED' | 'EXPIRED'; message?: string } => {
      if (!module.quiz?.startDate && !module.quiz?.endDate) return { status: 'OPEN' };
      
      const now = new Date();
      if (module.quiz.startDate && now < new Date(module.quiz.startDate)) {
          const start = new Date(module.quiz.startDate).toLocaleString('id-ID');
          return { status: 'NOT_STARTED', message: `Ujian belum dimulai. Dibuka: ${start}` };
      }
      if (module.quiz.endDate && now > new Date(module.quiz.endDate)) {
          const end = new Date(module.quiz.endDate).toLocaleString('id-ID');
          return { status: 'EXPIRED', message: `Ujian sudah ditutup pada: ${end}` };
      }
      return { status: 'OPEN' };
  };

  const openQuizModal = () => {
      const schedule = checkSchedule();
      if (role === 'STUDENT' && schedule.status !== 'OPEN') {
          alert(schedule.message);
          return;
      }
      setIsQuizOpen(true);
  };

  // --- QUIZ LOGIC ---
  
  const startExam = () => {
      if (!module.quiz) return;
      
      // Double check schedule before starting
      const schedule = checkSchedule();
      if (role === 'STUDENT' && schedule.status !== 'OPEN') {
          alert(schedule.message);
          setIsQuizOpen(false);
          return;
      }
      
      // Request Fullscreen
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
          elem.requestFullscreen().catch((err) => console.log("Fullscreen blocked", err));
      }

      // Initialize Timer (if duration exists)
      const durationMin = module.quiz.duration || 0;
      if (durationMin > 0) {
          setTimeLeft(durationMin * 60);
      } else {
          setTimeLeft(-1); // Infinite
      }

      // SHUFFLE QUESTIONS (Randomization)
      const shuffled = [...module.quiz.questions].sort(() => Math.random() - 0.5);
      setShuffledQuestions(shuffled);

      setQuizStatus('RUNNING');
      setCurrentQuestionIndex(0); // Start at first question
      setViolations(0);
      setQuizAnswers({});
  };

  const handleOptionSelect = (questionId: string, option: string) => {
    if (quizStatus !== 'RUNNING') return;
    setQuizAnswers(prev => ({
        ...prev,
        [questionId]: option
    }));
  };

  const handleSubmitQuiz = (forceSubmit = false, disqualified = false) => {
    if (!module.quiz) return;
    if (quizStatus === 'COMPLETED' || quizStatus === 'DISQUALIFIED') return;

    // Clear intervals and listeners
    if (timerRef.current) clearInterval(timerRef.current);
    
    // Exit Fullscreen
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.log("Exit fullscreen failed", err));
    }
    
    const detailedAnswers: StudentAnswer[] = [];
    let totalScore = 0;
    const maxScorePerQuestion = 10; 

    // Calculate score based on ORIGINAL questions (not shuffled, or use ID map)
    module.quiz.questions.forEach(q => {
        const studentAns = quizAnswers[q.id] || '';
        let currentScore = 0;

        if (q.type === 'MULTIPLE_CHOICE') {
            if (studentAns === q.correctAnswer) {
                currentScore = maxScorePerQuestion;
            }
        } else {
            currentScore = 0; // Essay manual grading
        }

        totalScore += currentScore;

        detailedAnswers.push({
            questionId: q.id,
            questionText: q.question,
            type: q.type,
            studentAnswer: studentAns,
            correctAnswer: q.correctAnswer,
            score: currentScore,
            maxScore: maxScorePerQuestion
        });
    });

    // Score Calculation
    const maxPossibleScore = module.quiz.questions.length * maxScorePerQuestion;
    const finalNormalizedScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
    
    // Penalize if disqualified
    const finalScore = disqualified ? 0 : finalNormalizedScore;

    setScore(finalScore);
    setQuizStatus(disqualified ? 'DISQUALIFIED' : 'COMPLETED');

    if (onQuizSubmit && role === 'STUDENT') {
        // Here we could also pass the violations count if API supported it
        onQuizSubmit(module.id, module.quiz.title, finalScore, detailedAnswers, violations, disqualified);
    }
  };

  const resetQuiz = () => {
    setQuizAnswers({});
    setQuizStatus('IDLE');
    setScore(0);
    setViolations(0);
    setTimeLeft(0);
    setCurrentQuestionIndex(0);
    setShuffledQuestions([]);
  };

  const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- ANTI-CHEAT EFFECTS ---

  useEffect(() => {
      let interval: ReturnType<typeof setInterval>;
      
      if (quizStatus === 'RUNNING') {
          // Timer Logic
          if (timeLeft > 0) {
              interval = setInterval(() => {
                  setTimeLeft((prev) => {
                      if (prev <= 1) {
                          clearInterval(interval);
                          handleSubmitQuiz(true, false); // Auto submit
                          return 0;
                      }
                      return prev - 1;
                  });
              }, 1000);
              timerRef.current = interval;
          }

          // Cheating Detection Listeners
          const handleVisibilityChange = () => {
              if (document.hidden) {
                  triggerViolation("Anda meninggalkan tab ujian!");
              }
          };

          const handleBlur = () => {
              triggerViolation("Fokus jendela hilang. Dilarang membuka aplikasi lain!");
          };

          document.addEventListener("visibilitychange", handleVisibilityChange);
          window.addEventListener("blur", handleBlur);

          return () => {
              clearInterval(interval);
              document.removeEventListener("visibilitychange", handleVisibilityChange);
              window.removeEventListener("blur", handleBlur);
          };
      }
  }, [quizStatus, timeLeft]);

  const triggerViolation = (msg: string) => {
      if (quizStatus !== 'RUNNING') return;
      
      setViolations(prev => {
          const newCount = prev + 1;
          setViolationMsg(`${msg} (Peringatan ${newCount}/${MAX_VIOLATIONS})`);
          
          // Clear toast after 3s
          setTimeout(() => setViolationMsg(null), 4000);

          if (newCount >= MAX_VIOLATIONS) {
              handleSubmitQuiz(true, true); // Disqualify
          }
          return newCount;
      });
  };

  const renderScheduleBadge = () => {
      if (!module.quiz || (!module.quiz.startDate && !module.quiz.endDate)) return null;
      
      const status = checkSchedule().status;
      if (status === 'NOT_STARTED') {
           return (
               <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-bold border border-slate-200">
                   <CalendarClock size={14}/> Belum Mulai
               </div>
           );
      } else if (status === 'EXPIRED') {
           return (
               <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold border border-red-100">
                   <Lock size={14}/> Ditutup
               </div>
           );
      } else {
           // Show deadline if open and deadline exists
           if (module.quiz.endDate) {
               return (
                   <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                       <Clock size={14}/> Sisa Waktu
                   </div>
               );
           }
      }
      return null;
  };

  return (
    <>
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col h-full group">
      {/* Card Header with Icon and Category */}
      <div className={`h-32 p-6 flex flex-col justify-between relative overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600 opacity-90"></div>
        <div className="absolute -right-4 -top-4 text-white opacity-10 transform rotate-12">
            <BookOpen size={120} />
        </div>
        
        <div className="relative z-10 flex justify-between items-start">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white backdrop-blur-sm">
            {module.category}
          </span>
          {role === 'ADMIN' && onDelete && (
             <button 
                onClick={() => onDelete(module.id)}
                className="text-white/70 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                title="Hapus Modul"
             >
                <Trash2 size={18} />
             </button>
          )}
        </div>
        
        <h3 className="relative z-10 text-xl font-bold text-white leading-tight line-clamp-2">
          {module.title}
        </h3>
      </div>

      {/* Card Body */}
      <div className="p-6 flex-1 flex flex-col">
        <div className="mb-4">
           {module.aiSummary ? (
             <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 mb-3">
               <div className="flex items-center gap-2 text-indigo-700 mb-1">
                 <Sparkles size={14} />
                 <span className="text-xs font-bold uppercase tracking-wider">Ringkasan AI</span>
               </div>
               <p className="text-sm text-slate-700 leading-relaxed">{module.aiSummary}</p>
             </div>
           ) : (
             <p className="text-sm text-slate-500 line-clamp-3 mb-4">{module.description}</p>
           )}
           
           <div className="flex flex-wrap gap-2 mt-2">
             {module.tags.map(tag => (
               <span key={tag} className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                 #{tag}
               </span>
             ))}
           </div>
           
           <div className="flex flex-wrap gap-2 mt-3">
               {/* Quiz Indicator Badge */}
               {module.quiz && (
                   <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                       <BrainCircuit size={14}/>
                       {module.quiz.questions.length} Soal
                   </div>
               )}
               {/* Duration Badge */}
                {module.quiz?.duration ? (
                   <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-100">
                       <Timer size={14}/>
                       {module.quiz.duration} Menit
                   </div>
                ) : null}

               {/* Schedule Badge */}
               {renderScheduleBadge()}

               {/* Target Classes Badge */}
               {module.targetClasses && module.targetClasses.length > 0 && (
                   <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100" title={`Kelas: ${module.targetClasses.join(', ')}`}>
                       <Users size={14}/>
                       {module.targetClasses.length > 2 ? `${module.targetClasses.length} Kelas` : module.targetClasses.join(', ')}
                   </div>
               )}
           </div>

        </div>

        <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-3">
            <div className="flex gap-2">
                {module.quiz && (
                    <button 
                        onClick={openQuizModal}
                        disabled={role === 'STUDENT' && checkSchedule().status !== 'OPEN'}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white shadow-md transition-all ${
                            role === 'STUDENT' && checkSchedule().status !== 'OPEN' 
                            ? 'bg-slate-400 cursor-not-allowed opacity-70' 
                            : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200 hover:scale-[1.02]'
                        }`}
                    >
                        {role === 'STUDENT' && checkSchedule().status === 'EXPIRED' ? <Lock size={18} /> : <BrainCircuit size={18} />}
                        {
                            role === 'STUDENT' && checkSchedule().status === 'NOT_STARTED' ? 'Belum Dibuka' :
                            role === 'STUDENT' && checkSchedule().status === 'EXPIRED' ? 'Ujian Ditutup' :
                            (module.quiz.quizType === 'EXAM' ? 'Kerjakan Ujian' : 'Mulai Latihan')
                        }
                    </button>
                )}
                
                <a 
                href={module.fileUrl || '#'} 
                download={module.fileName}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-all shadow-md hover:shadow-lg ${!module.fileUrl ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
                onClick={(e) => !module.fileUrl && e.preventDefault()}
                >
                <Download size={18} />
                Unduh
                </a>
            </div>

            {role === 'STUDENT' && (
              <button 
                onClick={() => setShowAIHelp(!showAIHelp)}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showAIHelp ? 'bg-indigo-100 text-indigo-700' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
              >
                <MessageCircle size={16} />
                {showAIHelp ? 'Tutup Tutor AI' : 'Tanya Tutor AI'}
              </button>
            )}
        </div>
      </div>

      {/* AI Chat Drawer */}
      {showAIHelp && (
        <div className="bg-slate-50 border-t border-slate-200 p-4 animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center justify-between mb-3">
             <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
               <Sparkles size={14} className="text-indigo-500"/> Tutor AI
             </h4>
             <button onClick={() => setAnswer('')} className="text-xs text-slate-400 hover:text-indigo-600">Reset</button>
          </div>
          
          {answer && (
            <div className="mb-4 p-3 bg-white rounded-lg border border-indigo-100 text-sm text-slate-700 shadow-sm">
              {answer}
            </div>
          )}

          <div className="relative">
            <input 
              type="text" 
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
              placeholder="Tanya tentang materi ini..."
              className="w-full pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button 
              onClick={handleAskAI}
              disabled={isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-500 hover:text-indigo-700 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
        </div>
      )}
    </div>

    {/* QUIZ MODAL OVERLAY */}
    {isQuizOpen && module.quiz && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* VIOLATION TOAST */}
            {violationMsg && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[120] bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce font-bold border-2 border-white/20">
                    <AlertTriangle size={24} className="animate-pulse"/>
                    <span>{violationMsg}</span>
                </div>
            )}

            <div className="bg-white w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
                
                {/* Timer Bar (Top) */}
                {quizStatus === 'RUNNING' && timeLeft !== -1 && (
                    <div className="h-1.5 w-full bg-slate-100">
                        <div 
                            className={`h-full transition-all duration-1000 ${timeLeft < 60 ? 'bg-red-500' : 'bg-indigo-500'}`}
                            style={{ width: `${(timeLeft / ((module.quiz.duration || 1) * 60)) * 100}%` }}
                        ></div>
                    </div>
                )}

                {/* Quiz Header */}
                <div className="p-4 md:p-6 border-b border-slate-200 flex justify-between items-center bg-white z-10">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-600 mb-1">
                            {module.quiz.quizType === 'EXAM' ? <GraduationCap size={20} /> : <BrainCircuit size={20} />}
                            <span className="text-xs font-bold uppercase tracking-wider">
                                {module.quiz.quizType === 'EXAM' ? 'Ujian Resmi' : 'Mode Latihan'}
                            </span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-bold text-slate-800 line-clamp-1">{module.quiz.title}</h2>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {quizStatus === 'RUNNING' && (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-bold ${timeLeft < 60 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-700'}`}>
                                <Timer size={18}/>
                                {timeLeft === -1 ? '∞' : formatTime(timeLeft)}
                            </div>
                        )}
                        
                        {/* Violations Counter */}
                        {quizStatus === 'RUNNING' && violations > 0 && (
                            <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 text-red-600 font-bold text-xs" title="Peringatan Pelanggaran">
                                <AlertTriangle size={16}/> {violations}/{MAX_VIOLATIONS}
                            </div>
                        )}

                        <button 
                            onClick={() => setIsQuizOpen(false)}
                            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Quiz Body */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 flex flex-col">
                    {quizStatus === 'IDLE' ? (
                        /* --- START SCREEN --- */
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
                                <Lock size={48} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-2">Persiapan {module.quiz.quizType === 'EXAM' ? 'Ujian' : 'Latihan'}</h3>
                            <p className="text-slate-500 max-w-md mb-8">
                                {module.quiz.quizType === 'EXAM' 
                                    ? 'Ujian ini bersifat rahasia. Soal akan diacak dan hasil tidak akan ditampilkan setelah pengerjaan.'
                                    : 'Latihan ini untuk menguji pemahaman Anda. Hasil dan kunci jawaban akan ditampilkan setelah selesai.'
                                }
                            </p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg w-full mb-8 text-left">
                                <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-start gap-3">
                                    <Timer className="text-indigo-500 shrink-0 mt-0.5" size={20}/>
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm">Durasi Waktu</p>
                                        <p className="text-xs text-slate-500">{module.quiz.duration ? `${module.quiz.duration} Menit` : 'Tidak Dibatasi'}</p>
                                    </div>
                                </div>
                                <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-start gap-3">
                                    <CalendarClock className="text-indigo-500 shrink-0 mt-0.5" size={20}/>
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm">Tenggat Waktu</p>
                                        <p className="text-xs text-slate-500">
                                            {module.quiz.endDate 
                                                ? new Date(module.quiz.endDate).toLocaleString('id-ID')
                                                : 'Tidak ada tenggat'}
                                        </p>
                                    </div>
                                </div>
                                <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-start gap-3 md:col-span-2">
                                    <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20}/>
                                    <div>
                                        <p className="font-bold text-red-600 text-sm">Peringatan Anti-Cheat</p>
                                        <p className="text-xs text-slate-500">Dilarang pindah tab, minimize browser, atau membuka aplikasi lain. 3x pelanggaran = Diskualifikasi.</p>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={startExam}
                                className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                            >
                                <CheckCircle size={20}/> Mulai Kerjakan Sekarang
                            </button>
                        </div>
                    ) : quizStatus === 'RUNNING' ? (
                        /* --- ACTIVE QUESTIONS (ONE PER PAGE) --- */
                        <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
                            
                            {/* Question Navigation Map */}
                            <div className="mb-6 overflow-x-auto pb-2 scrollbar-hide">
                                <div className="flex gap-2">
                                    {shuffledQuestions.map((_, idx) => {
                                        const isAnswered = !!quizAnswers[shuffledQuestions[idx].id];
                                        const isCurrent = currentQuestionIndex === idx;
                                        return (
                                            <button 
                                                key={idx}
                                                onClick={() => setCurrentQuestionIndex(idx)}
                                                className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-all border shrink-0
                                                    ${isCurrent 
                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-110 z-10' 
                                                        : (isAnswered 
                                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                                                            : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300')
                                                    }`}
                                            >
                                                {idx + 1}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Active Question Card */}
                            {shuffledQuestions.length > 0 && (
                                (() => {
                                    const activeQ = shuffledQuestions[currentQuestionIndex];
                                    return (
                                        <div key={activeQ.id} className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 flex-1 overflow-y-auto animate-in fade-in slide-in-from-right-4 duration-300">
                                            <div className="flex items-start gap-4 mb-6">
                                                <span className="flex-shrink-0 w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-lg">
                                                    {currentQuestionIndex + 1}
                                                </span>
                                                <div className="flex-1">
                                                    <p className="text-xl font-medium text-slate-800 leading-relaxed">{activeQ.question}</p>
                                                </div>
                                            </div>

                                            {activeQ.imageUrl && (
                                                <div className="mb-6 rounded-xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50 max-h-[400px] flex items-center justify-center">
                                                    <img 
                                                        src={activeQ.imageUrl} 
                                                        alt="Ilustrasi Soal" 
                                                        className="max-w-full max-h-[400px] object-contain"
                                                        loading="lazy"
                                                    />
                                                </div>
                                            )}
                                            
                                            <div className="pl-0 md:pl-14">
                                                {activeQ.type === 'MULTIPLE_CHOICE' && activeQ.options ? (
                                                    <div className="grid grid-cols-1 gap-3">
                                                        {activeQ.options.map((opt, i) => (
                                                            <label 
                                                                key={i} 
                                                                className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                                                                    quizAnswers[activeQ.id] === opt 
                                                                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' 
                                                                    : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50'
                                                                }`}
                                                            >
                                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${quizAnswers[activeQ.id] === opt ? 'border-indigo-600' : 'border-slate-300'}`}>
                                                                    {quizAnswers[activeQ.id] === opt && <div className="w-3 h-3 bg-indigo-600 rounded-full"></div>}
                                                                </div>
                                                                <input 
                                                                    type="radio" 
                                                                    name={`question-${activeQ.id}`}
                                                                    value={opt}
                                                                    checked={quizAnswers[activeQ.id] === opt}
                                                                    onChange={() => handleOptionSelect(activeQ.id, opt)}
                                                                    className="hidden"
                                                                />
                                                                <span className={`text-base ${quizAnswers[activeQ.id] === opt ? 'text-indigo-900 font-semibold' : 'text-slate-600'}`}>{opt}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="relative">
                                                        <textarea 
                                                            className="w-full p-5 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-0 outline-none text-slate-700 min-h-[200px] text-base leading-relaxed bg-slate-50 focus:bg-white transition-colors"
                                                            placeholder="Tulis jawaban esai Anda secara lengkap di sini..."
                                                            value={quizAnswers[activeQ.id] || ''}
                                                            onChange={(e) => handleOptionSelect(activeQ.id, e.target.value)}
                                                        />
                                                        <div className="absolute bottom-4 right-4 text-slate-400 pointer-events-none">
                                                            <Pencil size={18}/>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()
                            )}

                            {/* Bottom Navigation Buttons */}
                            <div className="mt-6 flex justify-between items-center pt-4 border-t border-slate-200">
                                <button 
                                    onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                                    disabled={currentQuestionIndex === 0}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft size={20} /> Sebelumnya
                                </button>

                                {currentQuestionIndex === shuffledQuestions.length - 1 ? (
                                    <button 
                                        onClick={() => handleSubmitQuiz(false)}
                                        className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-transform active:scale-95"
                                    >
                                        Selesai & Kirim <CheckCircle size={20}/>
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => setCurrentQuestionIndex(prev => Math.min(shuffledQuestions.length - 1, prev + 1))}
                                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-900 shadow-md transition-colors"
                                    >
                                        Selanjutnya <ChevronRight size={20}/>
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* --- RESULT SCREEN --- */
                        <div className="max-w-2xl mx-auto w-full">
                            <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 p-8 text-center mb-8 relative overflow-hidden">
                                {quizStatus === 'DISQUALIFIED' ? (
                                    <>
                                        <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
                                        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Ban size={40} />
                                        </div>
                                        <h3 className="text-2xl font-bold text-red-600">Akses Diblokir!</h3>
                                        <p className="text-slate-500 mb-4 font-medium">Anda telah melakukan {MAX_VIOLATIONS}x pelanggaran.</p>
                                        
                                        <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-sm text-red-700 inline-block mb-6">
                                            <p className="font-bold mb-1 flex items-center justify-center gap-2">
                                                <Lock size={16}/> Akun Dikunci Sementara
                                            </p>
                                            Hubungi Administrator / Guru untuk mereset pelanggaran dan membuka kembali akses ujian ini.
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                                        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                                            <CheckCircle size={40} />
                                        </div>
                                        <h3 className="text-2xl font-bold text-slate-800">Ujian Telah Diserahkan</h3>
                                        <p className="text-slate-500 mb-4">Jawaban Anda berhasil disimpan ke sistem.</p>
                                        
                                        {/* HIDE SCORE IF EXAM MODE */}
                                        {module.quiz.quizType === 'EXAM' ? (
                                            <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl text-left">
                                                <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                                                    <Lock size={18}/> Menunggu Hasil
                                                </h4>
                                                <p className="text-sm text-blue-700">
                                                    Karena ini adalah <strong>Ujian Resmi</strong>, nilai dan kunci jawaban tidak ditampilkan saat ini.
                                                </p>
                                                <p className="text-sm text-blue-700 mt-2">
                                                    Guru akan memeriksa jawaban esai (jika ada) dan merilis nilai akhir nanti.
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">
                                                    {score} <span className="text-xl text-slate-400 font-medium">/ 100</span>
                                                </div>
                                                
                                                {/* Essay Pending Notification */}
                                                {module.quiz.questions.some(q => q.type === 'ESSAY') && (
                                                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3 text-left">
                                                        <div className="p-2 bg-amber-100 rounded-full text-amber-600 shrink-0">
                                                            <Sparkles size={16} />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-amber-800">Nilai Menunggu Koreksi</p>
                                                            <p className="text-xs text-amber-700">Soal esai akan dinilai manual oleh guru. Nilai total Anda akan diperbarui setelah dikoreksi.</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Review Answers (Only if not disqualified AND not Exam mode) */}
                            {quizStatus !== 'DISQUALIFIED' && module.quiz.quizType !== 'EXAM' && (
                                <div className="space-y-6">
                                    <h4 className="font-bold text-slate-700 border-b pb-2 flex items-center gap-2">
                                        <List size={20}/> Review Jawaban
                                    </h4>
                                    {module.quiz.questions.map((q, index) => {
                                        const isCorrect = quizAnswers[q.id] === q.correctAnswer;
                                        const isEssay = q.type === 'ESSAY';

                                        return (
                                            <div key={q.id} className={`p-5 rounded-xl border ${isEssay ? 'bg-white border-slate-200' : (isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}`}>
                                                <div className="flex gap-3">
                                                    <div className="mt-1">
                                                        {isEssay ? (
                                                            <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs">{index + 1}</div>
                                                        ) : (
                                                            isCorrect ? <CheckCircle className="text-green-600" size={24} /> : <XCircle className="text-red-600" size={24} />
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-medium text-slate-800 mb-2">{q.question}</p>
                                                        
                                                        {/* User Answer */}
                                                        <div className="mb-2">
                                                            <span className="text-xs font-bold text-slate-500 uppercase">Jawaban Kamu:</span>
                                                            <p className={`text-sm mt-1 whitespace-pre-wrap ${isEssay ? 'text-slate-700 italic border-l-2 border-slate-300 pl-3' : (isCorrect ? 'text-green-700 font-bold' : 'text-red-700 font-bold line-through')}`}>
                                                                {quizAnswers[q.id] || '(Tidak dijawab)'}
                                                            </p>
                                                        </div>

                                                        {/* Correct Answer */}
                                                        {(!isCorrect || isEssay) && (
                                                            <div className="bg-white/50 p-2 rounded border border-black/5 mt-2">
                                                                <span className="text-xs font-bold text-slate-500 uppercase">{isEssay ? 'Kunci Jawaban / Referensi:' : 'Jawaban Benar:'}</span>
                                                                <p className="text-sm text-slate-800 font-semibold">{q.correctAnswer}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions (Only visible in IDLE or RESULT state, hidden in RUNNING because buttons are now inside content) */}
                {quizStatus !== 'RUNNING' && (
                    <div className="p-4 md:p-6 border-t border-slate-200 bg-white flex justify-end gap-3 z-10">
                        {quizStatus === 'IDLE' ? (
                            <button 
                                onClick={() => setIsQuizOpen(false)}
                                className="px-6 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                            >
                                Batal
                            </button>
                        ) : (
                            <>
                                {quizStatus !== 'DISQUALIFIED' && module.quiz.quizType !== 'EXAM' && (
                                    <button 
                                        onClick={resetQuiz}
                                        className="px-6 py-3 rounded-xl font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors flex items-center gap-2"
                                    >
                                        <RotateCcw size={18}/> Ulangi Kuis
                                    </button>
                                )}
                                <button 
                                    onClick={() => setIsQuizOpen(false)}
                                    className="px-6 py-3 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-900 shadow-lg transition-transform active:scale-95"
                                >
                                    Tutup
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )}
    </>
  );
};

export default ModuleCard;