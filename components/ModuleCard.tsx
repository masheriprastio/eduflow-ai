
import React, { useState, useEffect, useRef } from 'react';
import { LearningModule, Role, StudentAnswer } from '../types';
import { askAboutModule } from '../services/geminiService';
import { 
  FileText, 
  Play, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  HelpCircle, 
  Trash2, 
  Download,
  Lock, 
  Unlock,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  MessageSquare,
  X,
  Send,
  Loader2,
  Edit,
  AlertCircle,
  CalendarClock,
  Timer,
  Archive,
  Globe,
  Ban
} from 'lucide-react';

interface ModuleCardProps {
  module: LearningModule;
  role: Role;
  onDelete?: (id: string) => void;
  onEdit?: (module: LearningModule) => void;
  onQuizSubmit?: (moduleId: string, quizTitle: string, score: number, detailedAnswers: StudentAnswer[], violations: number, isDisqualified: boolean) => void;
}

const ModuleCard: React.FC<ModuleCardProps> = ({ module, role, onDelete, onEdit, onQuizSubmit }) => {
  // UI State
  const [isExpanded, setIsExpanded] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Quiz State
  const [quizStatus, setQuizStatus] = useState<'IDLE' | 'IN_PROGRESS' | 'COMPLETED' | 'DISQUALIFIED'>('IDLE');
  const [quizAnswers, setQuizAnswers] = useState<{[key: string]: string}>({});
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [violations, setViolations] = useState(0);

  const timerRef = useRef<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll chat to bottom
  useEffect(() => {
    if (isChatOpen) {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isChatOpen]);

  // Clean up timer on unmount
  useEffect(() => {
      return () => {
          if (timerRef.current) clearInterval(timerRef.current);
      };
  }, []);

  // Handle Fullscreen & Violation logic for EXAM
  useEffect(() => {
    if (quizStatus === 'IN_PROGRESS') {
        const handleVisibilityChange = () => {
            if (document.hidden && module.quiz?.quizType === 'EXAM') {
                setViolations(v => {
                    const newV = v + 1;
                    if (newV >= 3) {
                        handleSubmitQuiz(true, true); // Auto submit disqualified
                        alert("ANDA DIDISKUALIFIKASI! Terdeteksi meninggalkan halaman ujian lebih dari 3 kali.");
                    } else {
                        alert(`PERINGATAN PELANGGARAN! (${newV}/3)\nAnda meninggalkan halaman ujian. Jangan membuka tab lain!`);
                    }
                    return newV;
                });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }
  }, [quizStatus, module.quiz?.quizType]);

  // Helper: Check Schedule Validity
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

  const handleStartQuiz = () => {
      if (!module.quiz) return;
      
      // Access Control Checks
      if (role === 'GUEST') {
          alert("Silakan Login terlebih dahulu untuk mengerjakan kuis.");
          return;
      }

      const isPublished = module.quiz.isPublished ?? false;
      if (role === 'STUDENT' && !isPublished) {
          alert("Ujian ini masih dalam draft dan belum dipublikasikan oleh guru.");
          return;
      }

      const schedule = checkSchedule();
      if (role === 'STUDENT' && schedule.status !== 'OPEN') {
          alert(schedule.message);
          return;
      }

      // Init state
      setQuizStatus('IN_PROGRESS');
      setScore(0);
      setViolations(0);
      setQuizAnswers({});

      // Set timer if exists
      if (module.quiz.duration && module.quiz.duration > 0) {
          setTimeLeft(module.quiz.duration * 60);
          timerRef.current = window.setInterval(() => {
              setTimeLeft(prev => {
                  if (prev <= 1) {
                      handleSubmitQuiz(true); // Time's up
                      return 0;
                  }
                  return prev - 1;
              });
          }, 1000);
      }

      // Request Fullscreen for Exams
      if (module.quiz.quizType === 'EXAM') {
          document.documentElement.requestFullscreen().catch(e => {
              console.warn("Fullscreen denied:", e);
          });
      }
  };

  const handleSubmitQuiz = (forceSubmit = false, disqualified = false) => {
    if (!module.quiz) return;
    if (quizStatus === 'COMPLETED' || quizStatus === 'DISQUALIFIED') return;

    // Clear intervals and listeners
    if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
    }
    
    // Exit Fullscreen
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.log("Exit fullscreen failed", err));
    }
    
    const detailedAnswers: StudentAnswer[] = [];
    let totalScore = 0;
    
    // SCORING UPDATE: Base score 100 per question
    const maxScorePerQuestion = 100; 

    // Calculate score based on ORIGINAL questions order
    module.quiz.questions.forEach(q => {
        const studentAns = quizAnswers[q.id] || '';
        let currentScore = 0;

        if (q.type === 'MULTIPLE_CHOICE') {
            if (studentAns === q.correctAnswer) {
                currentScore = maxScorePerQuestion;
            }
        } else {
            // Essay score starts at 0 (Pending Grading), max is 100.
            currentScore = 0; 
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

    // Score Normalization: (Total Earned / Total Possible) * 100
    // Example: 2 Questions. Total Possible = 200. Earned = 100. (100/200)*100 = 50.
    const maxPossibleScore = module.quiz.questions.length * maxScorePerQuestion;
    const finalNormalizedScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
    
    // Penalize if disqualified
    const finalScore = disqualified ? 0 : finalNormalizedScore;

    setScore(finalScore);
    setQuizStatus(disqualified ? 'DISQUALIFIED' : 'COMPLETED');

    if (onQuizSubmit && role === 'STUDENT') {
        onQuizSubmit(module.id, module.quiz.title, finalScore, detailedAnswers, violations, disqualified);
    }
  };

  const handleAnswerChange = (qId: string, val: string) => {
      setQuizAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatHistory(prev => [...prev, {role: 'user', text: userMsg}]);
    setChatInput('');
    setIsChatLoading(true);

    const answer = await askAboutModule(module.title, module.description, userMsg);
    
    setChatHistory(prev => [...prev, {role: 'ai', text: answer || 'Maaf, saya tidak bisa menjawab saat ini.'}]);
    setIsChatLoading(false);
  };
  
  // Format Time: MM:SS
  const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isExam = module.quiz?.quizType === 'EXAM';
  const isPublished = module.quiz?.isPublished ?? false;

  const renderScheduleBadge = () => {
      if (!module.quiz || (!module.quiz.startDate && !module.quiz.endDate)) return null;
      
      const schedule = checkSchedule();
      if (schedule.status === 'NOT_STARTED') {
           return (
               <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-bold border border-slate-200">
                   <CalendarClock size={12}/> Belum Mulai
               </div>
           );
      } else if (schedule.status === 'EXPIRED') {
           return (
               <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-bold border border-red-100">
                   <Lock size={12}/> Ditutup
               </div>
           );
      } else if (module.quiz.endDate) {
           return (
               <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100">
                   <Clock size={12}/> Terjadwal
               </div>
           );
      }
      return null;
  };

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow relative ${quizStatus === 'IN_PROGRESS' && isExam ? 'z-[100] fixed inset-0 m-0 rounded-none' : ''}`}>
        
        {/* === EXAM MODE FULLSCREEN OVERLAY === */}
        {quizStatus === 'IN_PROGRESS' && isExam && (
            <div className="absolute top-0 left-0 right-0 bg-slate-900 text-white p-4 flex justify-between items-center z-50">
                <div className="flex items-center gap-4">
                    <BrainCircuit size={24} className="text-yellow-400 animate-pulse"/>
                    <div>
                        <h3 className="font-bold text-lg">MODE UJIAN</h3>
                        <p className="text-xs text-slate-400">Jangan keluar dari layar penuh atau membuka tab lain.</p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                     <div className="text-center">
                         <p className="text-xs font-bold text-slate-400 uppercase">Sisa Waktu</p>
                         <p className={`text-xl font-mono font-bold ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{formatTime(timeLeft)}</p>
                     </div>
                     <button 
                        onClick={() => handleSubmitQuiz(false)}
                        className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg font-bold text-sm"
                     >
                        Selesai
                     </button>
                </div>
            </div>
        )}

        {/* === NORMAL CARD VIEW === */}
        <div className={`p-5 flex flex-col h-full ${quizStatus === 'IN_PROGRESS' && isExam ? 'pt-24 h-screen overflow-y-auto' : ''}`}>
            
            {/* Header: Type & Action */}
            <div className="flex items-start justify-between mb-4">
                <div className={`p-2 rounded-xl ${module.quiz ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                    {module.quiz ? <BrainCircuit size={24} /> : <FileText size={24} />}
                </div>
                {role === 'ADMIN' && (
                    <div className="flex gap-2">
                        <button onClick={() => onEdit?.(module)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors">
                            <Edit size={16}/>
                        </button>
                        <button onClick={() => onDelete?.(module.id)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-600 transition-colors">
                            <Trash2 size={16}/>
                        </button>
                    </div>
                )}
            </div>

            {/* Content Info */}
            <h3 className="text-lg font-bold text-slate-800 mb-2 line-clamp-2" title={module.title}>
                {module.title}
            </h3>
            
            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded uppercase tracking-wider">
                    {module.category}
                </span>
                
                {module.quiz && (
                    <>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1 ${isPublished ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                            {isPublished ? <Globe size={10}/> : <Archive size={10}/>}
                            {isPublished ? 'Terbit' : 'Draft'}
                        </span>
                        {isPublished && renderScheduleBadge()}
                    </>
                )}
            </div>

            {/* Description/Summary */}
            <div className={`text-sm text-slate-600 mb-6 relative transition-all duration-300 ${isExpanded ? 'line-clamp-none' : 'line-clamp-3'}`}>
                {module.aiSummary ? (
                    <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-50">
                        <p className="text-xs font-bold text-indigo-600 mb-1 flex items-center gap-1">
                            <BrainCircuit size={12}/> Ringkasan AI
                        </p>
                        {module.aiSummary}
                    </div>
                ) : (
                    module.description
                )}
            </div>

            {/* --- QUIZ AREA (Inside Card) --- */}
            {module.quiz && (
                <div className="mt-auto bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                {module.quiz.quizType === 'EXAM' ? 'Ujian Resmi' : 'Latihan Soal'}
                            </p>
                            <p className="text-sm font-bold text-slate-800">
                                {module.quiz.questions.length} Soal
                            </p>
                        </div>
                        {module.quiz.duration && module.quiz.duration > 0 && (
                            <div className="text-right">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Durasi</p>
                                <p className="text-sm font-bold text-slate-800 flex items-center gap-1 justify-end">
                                    <Timer size={14}/> {module.quiz.duration} Menit
                                </p>
                            </div>
                        )}
                    </div>

                    {quizStatus === 'IDLE' ? (
                        <button 
                            onClick={handleStartQuiz}
                            disabled={role === 'STUDENT' && (!isPublished || checkSchedule().status !== 'OPEN')}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                            <Play size={16} fill="currentColor"/> 
                            {role === 'STUDENT' && !isPublished ? 'Belum Rilis' :
                             role === 'STUDENT' && checkSchedule().status === 'NOT_STARTED' ? 'Belum Mulai' :
                             role === 'STUDENT' && checkSchedule().status === 'EXPIRED' ? 'Ditutup' :
                             'Mulai Kerjakan'}
                        </button>
                    ) : quizStatus === 'COMPLETED' || quizStatus === 'DISQUALIFIED' ? (
                        <div className="text-center py-2">
                             {quizStatus === 'DISQUALIFIED' ? (
                                <div className="text-red-600 font-bold flex flex-col items-center">
                                    <Ban size={32} className="mb-2"/>
                                    <p>DISKUALIFIKASI</p>
                                </div>
                             ) : (
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Nilai Anda</p>
                                    {module.quiz.quizType === 'EXAM' ? (
                                        <div className="bg-blue-50 text-blue-700 p-2 rounded text-xs font-bold">
                                            Menunggu Hasil
                                        </div>
                                    ) : (
                                        <p className="text-3xl font-black text-emerald-600">{score}</p>
                                    )}
                                </div>
                             )}
                        </div>
                    ) : (
                        <div className="text-center py-2">
                            <p className="text-sm font-bold text-indigo-600 animate-pulse">Sedang Mengerjakan...</p>
                        </div>
                    )}
                </div>
            )}

            {/* IN-PROGRESS QUIZ QUESTIONS RENDER */}
            {quizStatus === 'IN_PROGRESS' && (
                <div className={`mt-6 ${isExam ? 'max-w-3xl mx-auto w-full' : ''}`}>
                    {module.quiz?.questions.map((q, idx) => (
                        <div key={q.id} className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="flex gap-3 mb-3">
                                <span className="bg-slate-200 text-slate-700 w-6 h-6 flex items-center justify-center rounded font-bold text-xs shrink-0">
                                    {idx + 1}
                                </span>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-800 mb-2">{q.question}</p>
                                    {q.imageUrl && (
                                        <img src={q.imageUrl} alt="Soal" className="max-w-full h-auto max-h-48 rounded-lg mb-3 object-contain border border-slate-200 bg-white"/>
                                    )}
                                </div>
                            </div>
                            
                            <div className="pl-9 space-y-2">
                                {q.type === 'MULTIPLE_CHOICE' ? (
                                    q.options?.map((opt, optIdx) => (
                                        <label key={optIdx} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${quizAnswers[q.id] === opt ? 'bg-indigo-100 border-indigo-300' : 'bg-white border-slate-200 hover:bg-slate-100'}`}>
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${quizAnswers[q.id] === opt ? 'border-indigo-600' : 'border-slate-300'}`}>
                                                {quizAnswers[q.id] === opt && <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>}
                                            </div>
                                            <input 
                                                type="radio" 
                                                name={q.id} 
                                                value={opt}
                                                checked={quizAnswers[q.id] === opt}
                                                onChange={() => handleAnswerChange(q.id, opt)}
                                                className="hidden"
                                            />
                                            <span className="text-sm text-slate-700">{opt}</span>
                                        </label>
                                    ))
                                ) : (
                                    <textarea 
                                        value={quizAnswers[q.id] || ''}
                                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                        className="w-full p-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        rows={3}
                                        placeholder="Tulis jawaban esai Anda..."
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {!isExam && (
                        <button 
                            onClick={() => handleSubmitQuiz(false)}
                            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700"
                        >
                            Kirim Jawaban
                        </button>
                    )}
                </div>
            )}

            {/* Footer Actions */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <button 
                    onClick={() => setIsExpanded(!isExpanded)} 
                    className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1"
                >
                    {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                    {isExpanded ? 'Tutup' : 'Selengkapnya'}
                </button>
                
                <div className="flex gap-2">
                    {module.fileUrl && (
                        <a 
                            href={module.fileUrl} 
                            download={module.fileName || 'Materi'}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Download Materi"
                        >
                            <Download size={18}/>
                        </a>
                    )}
                    {role === 'STUDENT' && (
                        <button 
                            onClick={() => setIsChatOpen(!isChatOpen)}
                            className={`p-2 rounded-lg transition-colors ${isChatOpen ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            title="Tanya AI"
                        >
                            <MessageSquare size={18}/>
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* AI Chat Drawer */}
        {isChatOpen && (
            <div className="bg-slate-50 border-t border-slate-200 h-80 flex flex-col animate-in slide-in-from-bottom-10">
                <div className="p-3 bg-white border-b border-slate-100 flex justify-between items-center shadow-sm">
                    <p className="text-xs font-bold text-indigo-600 flex items-center gap-1.5">
                        <BrainCircuit size={14}/> Tutor AI
                    </p>
                    <button onClick={() => setIsChatOpen(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={16}/>
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {chatHistory.length === 0 && (
                        <div className="text-center py-8 text-slate-400 text-xs">
                            <p>Tanyakan apa saja tentang materi ini.</p>
                        </div>
                    )}
                    {chatHistory.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-2xl text-xs ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'}`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {isChatLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-sm">
                                <Loader2 size={16} className="animate-spin text-indigo-600"/>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleAskAI} className="p-3 bg-white border-t border-slate-200 flex gap-2">
                    <input 
                        type="text" 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Ketik pertanyaan..."
                        className="flex-1 text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:border-indigo-500"
                        disabled={isChatLoading}
                    />
                    <button 
                        type="submit" 
                        disabled={!chatInput.trim() || isChatLoading}
                        className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                        <Send size={16}/>
                    </button>
                </form>
            </div>
        )}
    </div>
  );
};

export default ModuleCard;
