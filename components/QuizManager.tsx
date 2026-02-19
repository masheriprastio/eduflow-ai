
import React, { useState, useEffect, useRef } from 'react';
import { LearningModule, Question } from '../types';
import { generateQuizQuestions } from '../services/geminiService';
import { X, Save, Plus, Trash2, CheckCircle, HelpCircle, FileText, ChevronRight, BrainCircuit, AlertCircle, Sparkles, Loader2, ImageIcon, Pencil, Upload, Image as LucideImage, Clock, ChevronDown, PenTool, PlusCircle, Check, BookOpen, GraduationCap, Calendar, Layers, Settings, Info } from 'lucide-react';

interface QuizManagerProps {
  isOpen: boolean;
  onClose: () => void;
  modules: LearningModule[];
  onUpdateModule: (updatedModule: LearningModule) => void;
}

const QuizManager: React.FC<QuizManagerProps> = ({ isOpen, onClose, modules, onUpdateModule }) => {
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  
  // Quiz Meta Data
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDuration, setQuizDuration] = useState<number>(0); // 0 = No Limit
  const [quizType, setQuizType] = useState<'PRACTICE' | 'EXAM'>('PRACTICE');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // AI Generator State
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [selectedSourceModules, setSelectedSourceModules] = useState<string[]>([]); // New: Multi-source selection
  const [aiConfig, setAiConfig] = useState({
    count: 3,
    type: 'MULTIPLE_CHOICE' as 'MULTIPLE_CHOICE' | 'ESSAY',
    difficulty: 'MIX' as 'HOTS' | 'BASIC' | 'MIX'
  });
  
  // Form State for New/Edit Question
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  
  const [qType, setQType] = useState<'MULTIPLE_CHOICE' | 'ESSAY'>('MULTIPLE_CHOICE');
  const [qText, setQText] = useState('');
  const [qImageUrl, setQImageUrl] = useState('');
  const [qOptions, setQOptions] = useState<string[]>(['', '', '', '']);
  const [qCorrect, setQCorrect] = useState('');

  // UI Feedback State
  const [tempSuccessMsg, setTempSuccessMsg] = useState<string | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null); // State for delete confirmation modal

  // Mobile/Layout state
  const [showList, setShowList] = useState(true);
  
  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load module data when selected
  useEffect(() => {
    if (selectedModuleId) {
        // FIX: Guard modules
        const module = (modules || []).find(m => m.id === selectedModuleId);
        if (module) {
            setQuestions(module.quiz?.questions || []);
            setQuizTitle(module.quiz?.title || `Kuis: ${module.title}`);
            setQuizDuration(module.quiz?.duration || 0);
            setQuizType(module.quiz?.quizType || 'PRACTICE');
            setStartDate(module.quiz?.startDate || '');
            setEndDate(module.quiz?.endDate || '');
            
            // Default source is current module
            setSelectedSourceModules([module.id]);
            
            setShowList(false); // On mobile, move to detail view
        }
    }
  }, [selectedModuleId, modules]); // Added modules dependency

  if (!isOpen) return null;

  const showToast = (msg: string) => {
      setTempSuccessMsg(msg);
      setTimeout(() => setTempSuccessMsg(null), 3000);
  };

  // Helper to sync changes to parent immediately
  const saveToModule = (updatedQuestions: Question[]) => {
    if (!selectedModuleId) return;
    const module = (modules || []).find(m => m.id === selectedModuleId);
    if (!module) return;

    const updatedModule: LearningModule = {
        ...module,
        quiz: {
            title: quizTitle,
            duration: quizDuration,
            quizType: quizType,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            questions: updatedQuestions
        }
    };

    onUpdateModule(updatedModule);
  };

  const handleSaveQuizGlobal = () => {
    saveToModule(questions);
    showToast('Kuis & Jadwal berhasil disimpan!');
  };

  const handleDeleteQuiz = () => {
      if (!selectedModuleId) return;
      if (confirm("Yakin ingin menghapus seluruh data kuis ini? Semua soal akan hilang.")) {
          const module = (modules || []).find(m => m.id === selectedModuleId);
          if (!module) return;
          
          onUpdateModule({ ...module, quiz: undefined });
          setQuestions([]);
          setSelectedModuleId(null);
          setShowList(true);
          showToast('Data kuis berhasil dihapus.');
      }
  };

  const toggleSourceModule = (modId: string) => {
      setSelectedSourceModules(prev => 
        prev.includes(modId) ? prev.filter(id => id !== modId) : [...prev, modId]
      );
  };

  // Helper to parse data URL
  const parseDataUrl = (dataUrl: string) => {
    const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      return { mimeType: matches[1], data: matches[2] };
    }
    return null;
  };

  const handleAiGenerate = async () => {
    if (!selectedModuleId) return;
    
    if (selectedSourceModules.length === 0) {
        alert("Pilih minimal satu materi sumber untuk generate soal.");
        return;
    }

    setIsGeneratingAi(true);
    
    // Combine context from ALL selected modules
    // FIX: Guard modules
    const sourceModules = (modules || []).filter(m => selectedSourceModules.includes(m.id));
    const combinedTitles = sourceModules.map(m => m.title).join(', ');
    
    let combinedContext = `Gabungan Materi dari: ${combinedTitles}.\n\n`;
    const filesToUpload: { mimeType: string; data: string }[] = [];

    sourceModules.forEach((m, idx) => {
        combinedContext += `[Materi ${idx+1}: ${m.title}]\nDeskripsi: ${m.description}\nRingkasan: ${m.aiSummary || '-'}\n\n`;
        
        // Extract File Data if available (PDF/Doc)
        if (m.fileUrl && m.fileUrl.startsWith('data:')) {
            const parsed = parseDataUrl(m.fileUrl);
            if (parsed) {
                // Only push if it's a supported type (PDF or Image, usually)
                filesToUpload.push(parsed);
            }
        }
    });

    try {
        const generatedQuestions = await generateQuizQuestions(
            combinedTitles, 
            combinedContext, 
            aiConfig.type,
            aiConfig.difficulty,
            aiConfig.count,
            filesToUpload // Pass files to AI
        );

        if (generatedQuestions && generatedQuestions.length > 0) {
            const newQuestions = generatedQuestions.map(q => ({
                ...q,
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5)
            }));
            
            const updatedList = [...questions, ...newQuestions];
            setQuestions(updatedList);
            saveToModule(updatedList); // Auto-save AI questions
            showToast(`${newQuestions.length} soal AI (dari ${filesToUpload.length > 0 ? 'Dokumen PDF' : 'Teks Ringkasan'}) berhasil ditambahkan!`);
        } else {
            alert("Gagal membuat soal. Pastikan API Key valid atau kurangi jumlah soal.");
        }
    } catch (e) {
        console.error(e);
        alert("Terjadi kesalahan saat menghubungi AI.");
    } finally {
        setIsGeneratingAi(false);
    }
  };

  // --- CRUD OPERATIONS ---

  const handleSaveQuestion = (closeForm: boolean) => {
    if (!qText.trim()) {
        alert("Pertanyaan wajib diisi");
        return;
    }

    const questionPayload: Question = {
        id: editingQuestionId || Date.now().toString() + Math.random().toString(36).substr(2, 5),
        type: qType,
        question: qText,
        imageUrl: qImageUrl || undefined,
        options: qType === 'MULTIPLE_CHOICE' ? qOptions.map(o => o.trim()).filter(o => o !== '') : undefined,
        correctAnswer: qCorrect
    };
    
    if (qType === 'MULTIPLE_CHOICE' && (!questionPayload.options || questionPayload.options.length < 2)) {
        alert("Pilihan ganda minimal harus memiliki 2 opsi jawaban.");
        return;
    }

    let newQuestionsList: Question[] = [];
    if (editingQuestionId) {
        newQuestionsList = questions.map(q => q.id === editingQuestionId ? questionPayload : q);
        showToast('Soal berhasil diperbarui!');
    } else {
        newQuestionsList = [...questions, questionPayload];
        showToast('Soal ditambahkan ke daftar!');
    }

    setQuestions(newQuestionsList);
    saveToModule(newQuestionsList);
    
    if (closeForm) {
        resetQuestionForm();
    } else {
        setEditingQuestionId(null);
        setQText('');
        setQImageUrl('');
        setQOptions(['', '', '', '']);
        setQCorrect('');
        if(fileInputRef.current) fileInputRef.current.value = '';
        const formContainer = document.querySelector('#form-scroll-container');
        if(formContainer) formContainer.scrollTop = 0;
    }
  };

  const handleEditQuestion = (q: Question) => {
    setEditingQuestionId(q.id);
    setQType(q.type);
    setQText(q.question);
    setQImageUrl(q.imageUrl || '');
    if (q.type === 'MULTIPLE_CHOICE' && q.options) {
        setQOptions(q.options.length > 0 ? [...q.options] : ['', '', '', '']);
    } else {
        setQOptions(['', '', '', '']);
    }
    setQCorrect(q.correctAnswer || '');
    setIsFormOpen(true);
  };

  const handleDeleteQuestion = (id: string) => {
      setQuestionToDelete(id);
  };

  const confirmDeleteQuestion = () => {
      if (questionToDelete) {
          // Use functional update to ensure we have latest state
          setQuestions(currentQuestions => {
              const newQuestions = currentQuestions.filter(q => q.id !== questionToDelete);
              // Save to module inside callback or right after to ensure sync
              saveToModule(newQuestions);
              return newQuestions;
          });
          
          setQuestionToDelete(null);
          showToast('Soal berhasil dihapus');
      }
  };

  const resetQuestionForm = () => {
    setEditingQuestionId(null);
    setQText('');
    setQImageUrl('');
    setQOptions(['', '', '', '']);
    setQCorrect('');
    setIsFormOpen(false);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOpts = [...qOptions];
    newOpts[index] = value;
    setQOptions(newOpts);
  };

  const handleAddOption = () => {
    setQOptions([...qOptions, '']);
  };

  const handleDeleteOption = (index: number) => {
    if (qOptions.length <= 2) return; 
    const newOpts = [...qOptions];
    newOpts.splice(index, 1);
    setQOptions(newOpts);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        if (file.size > 2 * 1024 * 1024) {
            alert("Ukuran file terlalu besar. Maksimal 2MB.");
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setQImageUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
      setQImageUrl('');
      if(fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      
      {tempSuccessMsg && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[80] bg-emerald-600 text-white px-6 py-3 rounded-full shadow-lg font-bold flex items-center gap-2 animate-in slide-in-from-top-5 fade-out duration-300">
            <Check size={18} /> {tempSuccessMsg}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {questionToDelete && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in-95 duration-200 border border-slate-200">
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4 mx-auto">
                    <Trash2 size={24} />
                </div>
                <h3 className="text-lg font-bold text-center text-slate-800 mb-2">Hapus Soal?</h3>
                <p className="text-sm text-slate-500 text-center mb-6">
                    Apakah Anda yakin ingin menghapus soal ini secara permanen?
                </p>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setQuestionToDelete(null)}
                        className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors"
                    >
                        Batal
                    </button>
                    <button 
                        onClick={confirmDeleteQuestion}
                        className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                    >
                        Hapus
                    </button>
                </div>
            </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <BrainCircuit className="text-indigo-600" size={24} />
                Manajemen Bank Soal & Ujian
            </h2>
            <p className="text-sm text-slate-500">Kelola soal dari berbagai materi dan atur jadwal ujian.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
            
            {/* Left Panel: Module List */}
            <div className={`w-full md:w-80 bg-slate-50 border-r border-slate-200 flex flex-col absolute md:relative inset-0 z-10 transition-transform duration-300 ${showList ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="p-4 border-b border-slate-200 bg-slate-50 sticky top-0">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pilih Kuis Materi</h3>
                </div>
                <div className="overflow-y-auto flex-1 p-2 space-y-2">
                    {/* FIX: Guard modules array */}
                    {(modules || []).map(m => (
                        <button
                            key={m.id}
                            onClick={() => setSelectedModuleId(m.id)}
                            className={`w-full text-left p-3 rounded-lg text-sm transition-all border ${selectedModuleId === m.id ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500' : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm'}`}
                        >
                            <p className="font-bold text-slate-800 line-clamp-1">{m.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{m.category}</span>
                                {m.quiz ? (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                                        <CheckCircle size={10}/> {m.quiz.questions.length} Soal
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-slate-400 italic">Belum ada kuis</span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Panel: Quiz Editor */}
            <div className={`flex-1 bg-white flex flex-col w-full absolute md:relative inset-0 transition-transform duration-300 ${!showList ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
                {selectedModuleId ? (
                    <div className="flex flex-col h-full relative overflow-hidden">
                        
                        {/* Editor Header (Fixed Title Only) */}
                        <div className="p-4 border-b border-slate-100 bg-white shrink-0">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setShowList(true)} className="md:hidden p-2 -ml-2 text-slate-500">
                                    <ChevronRight className="rotate-180" size={20}/>
                                </button>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Judul Kuis / Ujian</label>
                                    <input 
                                        type="text" 
                                        value={quizTitle}
                                        onChange={(e) => setQuizTitle(e.target.value)}
                                        className="w-full text-lg font-bold text-slate-800 border-none focus:ring-0 p-0 placeholder-slate-300"
                                        placeholder="Masukkan Judul Kuis..."
                                    />
                                </div>
                                <button 
                                    onClick={handleDeleteQuiz}
                                    className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-red-100 transition-colors mr-2"
                                    title="Hapus Semua Soal & Data Kuis Ini"
                                >
                                    <Trash2 size={16}/> Hapus Data
                                </button>
                                <button 
                                    id="save-quiz-btn"
                                    onClick={handleSaveQuizGlobal}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                                >
                                    <Save size={16}/> Simpan
                                </button>
                            </div>
                        </div>

                        {/* SCROLLABLE BODY: Settings + Generator + Questions */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                            
                            {/* --- 1. CONFIGURATION SECTION (MOVED HERE TO FIX SCROLL) --- */}
                            <div className="bg-white p-5 rounded-xl border border-slate-200 mb-6 shadow-sm">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                                    <Settings size={14}/> Konfigurasi Ujian
                                </h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    {/* Type */}
                                    <div className="flex flex-col">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
                                            <Layers size={12}/> Tipe Ujian
                                        </label>
                                        <select 
                                            value={quizType}
                                            onChange={(e) => setQuizType(e.target.value as 'PRACTICE' | 'EXAM')}
                                            className="p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 w-full"
                                        >
                                            <option value="PRACTICE">Latihan Soal (Hasil Langsung Terbuka)</option>
                                            <option value="EXAM">Ujian Harian (Hasil Rahasia & Terjadwal)</option>
                                        </select>
                                    </div>
                                    {/* Duration */}
                                    <div className="flex flex-col">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-1">
                                            <Clock size={12}/> Durasi Timer (Menit)
                                        </label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                min="0"
                                                value={quizDuration}
                                                onChange={(e) => setQuizDuration(Math.max(0, parseInt(e.target.value)))}
                                                className="p-2.5 pl-4 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 w-full font-semibold text-slate-700"
                                                placeholder="0"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">Menit</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                            <Info size={10}/> Waktu hitung mundur saat siswa mengerjakan. 0 = Tanpa batas.
                                        </p>
                                    </div>
                                </div>

                                {/* Dates */}
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-3 flex items-center gap-1">
                                        <Calendar size={12}/> Periode Akses Ujian (Jadwal Buka - Tutup)
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-500 font-medium mb-1">Mulai Dibuka</span>
                                            <input 
                                                type="datetime-local" 
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                className="p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white w-full"
                                            />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-500 font-medium mb-1">Ditutup Otomatis</span>
                                            <input 
                                                type="datetime-local" 
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                                className="p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white w-full"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-orange-600 mt-2 flex items-center gap-1">
                                        <AlertCircle size={10}/> Siswa hanya bisa menekan tombol "Mulai" di antara waktu ini.
                                    </p>
                                </div>
                            </div>

                            {/* --- 2. GENERATOR AI PANEL --- */}
                            <div className="bg-gradient-to-r from-violet-500 to-indigo-600 rounded-xl p-5 mb-6 text-white shadow-lg shadow-indigo-200">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <h4 className="font-bold flex items-center gap-2 text-lg">
                                            <Sparkles size={18} className="text-yellow-300"/> 
                                            Generator Soal AI (Otomatis dari Dokumen)
                                        </h4>
                                        <p className="text-indigo-100 text-sm mt-1 mb-3">
                                            Pilih modul di bawah ini. AI akan membaca <span className="font-bold text-white bg-white/20 px-1 rounded">Dokumen PDF/Word</span> yang Anda upload di modul tersebut untuk membuat soal.
                                        </p>
                                        
                                        {/* Source Selection */}
                                        <div className="bg-white/10 rounded-lg p-3 border border-white/20">
                                            <label className="text-[10px] text-indigo-200 uppercase font-bold flex items-center gap-1 mb-2">
                                                <Layers size={10}/> Materi Sumber (Centang untuk gabung)
                                            </label>
                                            <div className="max-h-24 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {/* FIX: Guard modules */}
                                                {(modules || []).map(m => (
                                                    <label key={m.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white/10 p-1 rounded">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedSourceModules.includes(m.id)}
                                                            onChange={() => toggleSourceModule(m.id)}
                                                            className="rounded text-indigo-600 focus:ring-0"
                                                        />
                                                        <span className="truncate text-white" title={m.title}>{m.title} {m.fileUrl ? '(Ada File)' : ''}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Config Controls */}
                                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[10px] text-indigo-200 block mb-0.5">Tipe</label>
                                                <select 
                                                    value={aiConfig.type}
                                                    onChange={(e) => setAiConfig({...aiConfig, type: e.target.value as any})}
                                                    className="w-full bg-white/20 border border-white/30 text-white text-xs rounded p-1.5 outline-none"
                                                >
                                                    <option value="MULTIPLE_CHOICE" className="text-slate-800">Pil-Gan</option>
                                                    <option value="ESSAY" className="text-slate-800">Esai</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-indigo-200 block mb-0.5">Jumlah</label>
                                                <select 
                                                    value={aiConfig.count}
                                                    onChange={(e) => setAiConfig({...aiConfig, count: parseInt(e.target.value)})}
                                                    className="w-full bg-white/20 border border-white/30 text-white text-xs rounded p-1.5 outline-none"
                                                >
                                                    <option value="1" className="text-slate-800">1</option>
                                                    <option value="3" className="text-slate-800">3</option>
                                                    <option value="5" className="text-slate-800">5</option>
                                                    <option value="10" className="text-slate-800">10</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-indigo-200 block mb-0.5">Level</label>
                                            <select 
                                                value={aiConfig.difficulty}
                                                onChange={(e) => setAiConfig({...aiConfig, difficulty: e.target.value as any})}
                                                className="w-full bg-white/20 border border-white/30 text-white text-xs rounded p-1.5 outline-none"
                                            >
                                                <option value="HOTS" className="text-slate-800">HOTS (Analisis)</option>
                                                <option value="BASIC" className="text-slate-800">Dasar (Hafalan)</option>
                                                <option value="MIX" className="text-slate-800">Campuran</option>
                                            </select>
                                        </div>
                                        <button 
                                            onClick={handleAiGenerate}
                                            disabled={isGeneratingAi}
                                            className="mt-1 bg-white text-indigo-600 px-3 py-2 rounded-lg text-xs font-bold shadow hover:bg-indigo-50 flex items-center justify-center gap-2"
                                        >
                                            {isGeneratingAi ? <Loader2 size={14} className="animate-spin"/> : <BrainCircuit size={14}/>}
                                            Buat Soal
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* --- 3. QUESTIONS LIST --- */}
                            {questions.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-slate-300">
                                        <FileText size={32}/>
                                    </div>
                                    <h3 className="text-slate-600 font-bold">Belum ada soal</h3>
                                    <p className="text-slate-400 text-sm">Gunakan Generator AI di atas atau klik "Input Manual" di bawah.</p>
                                </div>
                            ) : (
                                <div className="space-y-4 max-w-3xl mx-auto pb-24"> {/* pb-24 for space for fixed button */}
                                    {questions.map((q, idx) => (
                                        <div key={q.id} className={`bg-white p-4 rounded-xl border shadow-sm group transition-all ${editingQuestionId === q.id ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/20' : 'border-slate-200'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded flex items-center justify-center text-xs font-bold">
                                                        {idx + 1}
                                                    </span>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                                        {q.type === 'MULTIPLE_CHOICE' ? 'Pilihan Ganda' : 'Esai'}
                                                    </span>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button 
                                                        onClick={() => handleEditQuestion(q)}
                                                        className="p-1.5 rounded-lg text-amber-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                                                        title="Edit Soal"
                                                    >
                                                        <Pencil size={16}/>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteQuestion(q.id)} 
                                                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                        title="Hapus Soal"
                                                    >
                                                        <Trash2 size={16}/>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Preview Image in List */}
                                            {q.imageUrl && (
                                                <div className="mb-3 relative group/img">
                                                    <img 
                                                        src={q.imageUrl} 
                                                        alt="Visual Soal" 
                                                        className="h-32 rounded-lg border border-slate-200 object-cover bg-slate-100"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                        }}
                                                    />
                                                </div>
                                            )}

                                            <p className="font-medium text-slate-800 mb-3">{q.question}</p>
                                            
                                            {q.type === 'MULTIPLE_CHOICE' && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                                                    {q.options?.map((opt, i) => (
                                                        <div key={i} className={`text-xs px-3 py-2 rounded border ${opt === q.correctAnswer ? 'bg-green-50 border-green-200 text-green-700 font-bold' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                                                            {String.fromCharCode(65 + i)}. {opt}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {q.type === 'ESSAY' && (
                                                <div className="bg-amber-50 p-2 rounded border border-amber-100 text-xs text-amber-800">
                                                    <span className="font-bold">Kunci/Referensi:</span> {q.correctAnswer}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Trigger Button (Fixed at bottom) */}
                        {!isFormOpen && (
                            <div className="absolute bottom-6 right-6 z-10">
                                <button 
                                    onClick={() => setIsFormOpen(true)}
                                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-4 rounded-full font-bold shadow-xl hover:bg-indigo-700 hover:scale-105 transition-all"
                                >
                                    <PenTool size={20} />
                                    Input Manual
                                </button>
                            </div>
                        )}

                        {/* Full Screen Form Overlay (unchanged logic, reused from existing) */}
                        {isFormOpen && (
                            <div id="question-form-overlay" className="absolute inset-0 z-20 bg-white flex flex-col animate-in slide-in-from-bottom-5 duration-300">
                                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white shrink-0">
                                    <h4 className="font-bold text-indigo-900 flex items-center gap-2 text-lg">
                                        {editingQuestionId ? <Pencil size={20}/> : <PenTool size={20}/>}
                                        {editingQuestionId ? 'Edit Soal Manual' : 'Input Soal Manual'}
                                    </h4>
                                    <button onClick={resetQuestionForm} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100"><X size={24}/></button>
                                </div>
                                
                                <div id="form-scroll-container" className="flex-1 overflow-y-auto p-6 bg-slate-50">
                                    <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-indigo-100">
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                                            <div className="md:col-span-1">
                                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Tipe Soal</label>
                                                <select 
                                                    value={qType} 
                                                    onChange={(e) => setQType(e.target.value as any)}
                                                    className="w-full p-3 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                                                >
                                                    <option value="MULTIPLE_CHOICE">Pilihan Ganda</option>
                                                    <option value="ESSAY">Esai / Uraian</option>
                                                </select>
                                            </div>
                                            <div className="md:col-span-3">
                                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Pertanyaan (Teks Utama)</label>
                                                <textarea 
                                                    value={qText}
                                                    onChange={(e) => setQText(e.target.value)}
                                                    className="w-full p-3 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none min-h-[120px] resize-y"
                                                    placeholder="Tulis pertanyaan lengkap di sini..."
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Image Upload Area */}
                                        <div className="mb-6">
                                            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                                                <ImageIcon size={16}/> Lampiran Gambar (Opsional)
                                            </label>
                                            
                                            <div className="flex flex-col md:flex-row gap-4">
                                                {/* File Input */}
                                                <div 
                                                    className={`flex-1 border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group relative ${qImageUrl ? 'border-green-300 bg-green-50' : 'border-slate-300 hover:bg-slate-50 hover:border-indigo-400'}`}
                                                    onClick={() => fileInputRef.current?.click()}
                                                >
                                                    <input 
                                                        type="file" 
                                                        ref={fileInputRef} 
                                                        onChange={handleFileSelect} 
                                                        className="hidden" 
                                                        accept="image/*"
                                                    />
                                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-transform group-hover:scale-110 ${qImageUrl ? 'bg-green-200 text-green-700' : 'bg-indigo-50 text-indigo-500'}`}>
                                                        {qImageUrl ? <CheckCircle size={24}/> : <Upload size={24} />}
                                                    </div>
                                                    <p className="text-sm font-bold text-slate-700">{qImageUrl ? 'Ganti Gambar' : 'Klik untuk Upload Gambar'}</p>
                                                    <p className="text-xs text-slate-400">JPG, PNG (Max 2MB)</p>
                                                </div>

                                                {/* Preview Area */}
                                                {qImageUrl && (
                                                    <div className="w-full md:w-64 h-40 bg-slate-100 rounded-xl border border-slate-200 relative group overflow-hidden shrink-0">
                                                        <img 
                                                            src={qImageUrl} 
                                                            alt="Preview" 
                                                            className="w-full h-full object-contain bg-black/5"
                                                        />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleRemoveImage(); }}
                                                                className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 shadow-lg"
                                                                title="Hapus Gambar"
                                                            >
                                                                <Trash2 size={20} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {qType === 'MULTIPLE_CHOICE' && (
                                            <div className="mb-6">
                                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Pilihan Jawaban</label>
                                                <div className="space-y-3">
                                                    {qOptions.map((opt, i) => (
                                                        <div key={i} className="flex items-center gap-2">
                                                            <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 text-slate-500 font-bold flex items-center justify-center text-xs">{String.fromCharCode(65 + i)}</span>
                                                            <input 
                                                                type="text" 
                                                                value={opt}
                                                                onChange={(e) => handleOptionChange(i, e.target.value)}
                                                                className="flex-1 p-3 text-sm border border-slate-300 rounded-xl focus:border-indigo-500 outline-none"
                                                                placeholder={`Pilihan ${String.fromCharCode(65 + i)}`}
                                                            />
                                                            {qOptions.length > 2 && (
                                                                <button 
                                                                    onClick={() => handleDeleteOption(i)}
                                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                    title="Hapus Pilihan Ini"
                                                                >
                                                                    <Trash2 size={18}/>
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <button 
                                                        onClick={handleAddOption}
                                                        className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                                                    >
                                                        <PlusCircle size={14}/> Tambah Pilihan Lain
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="mb-6">
                                            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                                                {qType === 'MULTIPLE_CHOICE' ? 'Kunci Jawaban Benar' : 'Referensi Jawaban (Untuk koreksi mandiri)'}
                                            </label>
                                            {qType === 'MULTIPLE_CHOICE' ? (
                                                <select 
                                                    value={qCorrect}
                                                    onChange={(e) => setQCorrect(e.target.value)}
                                                    className="w-full p-3 text-sm border border-slate-300 rounded-xl bg-green-50 border-green-200 text-green-800 font-bold"
                                                >
                                                    <option value="">-- Pilih Jawaban Benar --</option>
                                                    {qOptions.filter(o => o.trim() !== '').map((opt, i) => (
                                                        <option key={i} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <textarea 
                                                    value={qCorrect}
                                                    onChange={(e) => setQCorrect(e.target.value)}
                                                    className="w-full p-3 text-sm border border-slate-300 rounded-xl focus:border-indigo-500 outline-none"
                                                    rows={3}
                                                    placeholder="Jawaban yang diharapkan..."
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 p-4 border-t border-slate-200 bg-white shrink-0">
                                    <button onClick={resetQuestionForm} className="px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Batal</button>
                                    
                                    {!editingQuestionId && (
                                        <button 
                                            onClick={() => handleSaveQuestion(false)} 
                                            className="px-5 py-3 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all flex items-center gap-2"
                                        >
                                            <PlusCircle size={18}/> Simpan & Tambah Lagi
                                        </button>
                                    )}

                                    <button onClick={() => handleSaveQuestion(true)} className="px-8 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95">
                                        {editingQuestionId ? 'Simpan Perubahan' : 'Simpan Soal'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50">
                        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-4 text-indigo-300">
                            <HelpCircle size={40}/>
                        </div>
                        <h3 className="text-xl font-bold text-slate-700">Pilih Materi di Samping</h3>
                        <p className="text-slate-500 max-w-md mt-2">Pilih salah satu materi pembelajaran dari daftar di sebelah kiri untuk mulai membuat atau mengedit soal kuis.</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default QuizManager;
