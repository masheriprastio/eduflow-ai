
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QuizResult, Student, ManualGrade, LearningModule } from '../types';
import { X, BarChart3, Activity, Users, FileCheck, Clock, Monitor, Search, TrendingUp, Circle, Eye, Printer, Save, ChevronLeft, Loader2, Calculator, Plus, Pencil, Trash2, Edit, AlertCircle, Check, Unlock, Lock } from 'lucide-react';

interface ReportsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  quizResults: QuizResult[];
  manualGrades?: ManualGrade[];
  modules?: LearningModule[]; // Added modules prop for selection
  onUpdateResult?: (result: QuizResult) => void;
  onAddManualGrade?: (grade: ManualGrade) => void;
  onUpdateManualGrade?: (grade: ManualGrade) => void;
  onDeleteManualGrade?: (gradeId: string) => void;
  onResetExam?: (resultId: string) => void; // New prop for resetting exam
}

const ReportsDashboard: React.FC<ReportsDashboardProps> = ({ 
    isOpen, 
    onClose, 
    students, 
    quizResults, 
    manualGrades = [],
    modules = [],
    onUpdateResult,
    onAddManualGrade,
    onUpdateManualGrade,
    onDeleteManualGrade,
    onResetExam
}) => {
  const [activeTab, setActiveTab] = useState<'ACTIVITY' | 'RESULTS' | 'GRADING'>('RESULTS');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Grading / Detail View State
  const [selectedResult, setSelectedResult] = useState<QuizResult | null>(null);
  const [studentForDetails, setStudentForDetails] = useState<Student | null>(null); // For Manual Grade Details
  const [editingGrade, setEditingGrade] = useState<ManualGrade | null>(null); // For Inline Editing
  const [isPrinting, setIsPrinting] = useState(false);
  
  // Manual Grading Form State
  const [isAddingGrade, setIsAddingGrade] = useState(false);
  const [manualNis, setManualNis] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState(''); 
  const [manualScore, setManualScore] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // DELETE CONFIRMATION STATE (Custom Modal)
  const [gradeToDelete, setGradeToDelete] = useState<string | null>(null);
  const [resetExamId, setResetExamId] = useState<string | null>(null); // New state for reset confirmation

  // Ref for the content to be printed
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Filter Logic
  // FIX: Guard students array
  const filteredStudents = useMemo(() => (students || []).filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.nis.includes(searchQuery)
  ), [students, searchQuery]);

  // FIX: Guard quizResults array
  const filteredResults = (quizResults || []).filter(r => 
    r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.moduleTitle.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  // Helper to check if user is "Online" (Active within last 30 mins)
  const isUserOnline = (lastLogin?: string) => {
    if (!lastLogin) return false;
    const diff = currentTime.getTime() - new Date(lastLogin).getTime();
    return diff < 30 * 60 * 1000; // 30 minutes threshold
  };

  // --- GRADING CALCULATION LOGIC ---
  const studentGrades = useMemo(() => {
    return filteredStudents.map(student => {
        // FIX: Guard quizResults and manualGrades
        // 1. Calculate Average Quiz Score (Nilai Ujian Harian)
        const studentQuizzes = (quizResults || []).filter(r => r.studentNis === student.nis);
        // Exclude disqualified scores (0) from average? Usually counted as 0. 
        // We include them as 0 to penalize.
        const quizSum = studentQuizzes.reduce((acc, curr) => acc + curr.score, 0);
        const quizAvg = studentQuizzes.length > 0 ? Math.round(quizSum / studentQuizzes.length) : 0;

        // 2. Calculate Average Manual Grade (Nilai Harian - PR/Tugas)
        const studentManuals = (manualGrades || []).filter(g => g.studentNis === student.nis);
        const manualSum = studentManuals.reduce((acc, curr) => acc + curr.score, 0);
        const manualAvg = studentManuals.length > 0 ? Math.round(manualSum / studentManuals.length) : 0;

        // 3. Final Score = Average of (Quiz Avg + Manual Avg)
        const finalScore = (studentQuizzes.length > 0 && studentManuals.length > 0)
            ? Math.round((quizAvg + manualAvg) / 2)
            : (studentQuizzes.length > 0 ? quizAvg : manualAvg);

        return {
            ...student,
            quizCount: studentQuizzes.length,
            quizAvg,
            manualCount: studentManuals.length,
            manualAvg,
            finalScore
        };
    });
  }, [filteredStudents, quizResults, manualGrades]);


  if (!isOpen) return null;

  // Statistics
  // FIX: Safe access
  const totalQuizzesTaken = (quizResults || []).length;
  const averageScore = totalQuizzesTaken > 0 
    ? Math.round((quizResults || []).reduce((acc, curr) => acc + curr.score, 0) / totalQuizzesTaken) 
    : 0;
  const onlineStudentsCount = (students || []).filter(s => isUserOnline(s.lastLogin)).length;

  const handleScoreChange = (questionIndex: number, newScoreStr: string) => {
    if (!selectedResult) return;
    let newScore = parseFloat(newScoreStr);
    if (isNaN(newScore)) newScore = 0;
    const updatedAnswers = [...selectedResult.answers];
    const max = updatedAnswers[questionIndex].maxScore;
    if (newScore > max) newScore = max;
    if (newScore < 0) newScore = 0;
    updatedAnswers[questionIndex] = { ...updatedAnswers[questionIndex], score: newScore };
    const totalMaxScore = updatedAnswers.reduce((acc, curr) => acc + curr.maxScore, 0);
    const totalEarnedScore = updatedAnswers.reduce((acc, curr) => acc + curr.score, 0);
    const finalScore = totalMaxScore > 0 ? Math.round((totalEarnedScore / totalMaxScore) * 100) : 0;
    setSelectedResult({ ...selectedResult, answers: updatedAnswers, score: finalScore });
  };

  const handleSaveGrade = () => {
    if (selectedResult && onUpdateResult) {
        onUpdateResult(selectedResult);
        setSaveSuccessMsg('Nilai berhasil disimpan!');
        setTimeout(() => setSaveSuccessMsg(null), 2000);
        setSelectedResult(null); 
    }
  };

  const handleSubmitManualGrade = (e: React.FormEvent) => {
      e.preventDefault();
      if (!manualNis || !selectedModuleId || !manualScore) return;
      
      // FIX: Guard modules
      const selectedModule = (modules || []).find(m => m.id === selectedModuleId);
      if (!selectedModule) return;

      const newGrade: ManualGrade = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5), 
          studentNis: manualNis,
          moduleId: selectedModuleId,
          title: `Tugas: ${selectedModule.title}`,
          score: parseInt(manualScore),
          date: new Date().toISOString()
      };

      if (onAddManualGrade) {
          onAddManualGrade(newGrade);
          // Removed alert, use local feedback
          setIsAddingGrade(false);
          setSelectedModuleId('');
          setManualScore('');
          setManualNis('');
      }
  };

  const handleUpdateEditingGrade = () => {
      if(!editingGrade || !onUpdateManualGrade) return;
      const selectedModule = (modules || []).find(m => m.id === editingGrade.moduleId);
      const updatedGrade = {
          ...editingGrade,
          title: selectedModule ? `Tugas: ${selectedModule.title}` : editingGrade.title
      };
      
      onUpdateManualGrade(updatedGrade);
      setEditingGrade(null);
  };

  // 1. Trigger the custom modal
  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setGradeToDelete(id);
  };

  // 2. Execute delete after confirmation
  const confirmDelete = () => {
    if (gradeToDelete && onDeleteManualGrade) {
        onDeleteManualGrade(gradeToDelete);
        setGradeToDelete(null);
    }
  };

  const confirmResetExam = () => {
      if (resetExamId && onResetExam) {
          onResetExam(resetExamId);
          setResetExamId(null);
          setSaveSuccessMsg('Status ujian berhasil direset. Siswa dapat ujian kembali.');
          setTimeout(() => setSaveSuccessMsg(null), 3000);
      }
  };

  const handleDownloadPDF = () => {
    // Determine context: Detailed result OR Grading Summary
    const element = printRef.current;
    if (!element) return;

    setIsPrinting(true);
    
    // Determine Filename
    let filename = 'Dokumen_Laporan.pdf';
    if (selectedResult) {
        filename = `Hasil_Ujian_${selectedResult.studentName.replace(/\s+/g, '_')}.pdf`;
    } else if (activeTab === 'GRADING') {
        filename = `Rekap_Nilai_Siswa_${new Date().toISOString().split('T')[0]}.pdf`;
    }

    const opt = {
      margin: 10, 
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const html2pdf = (window as any).html2pdf;
    if (html2pdf) {
        html2pdf().set(opt).from(element).save().then(() => setIsPrinting(false));
    } else {
        alert("Library PDF (html2pdf) tidak ditemukan. Pastikan koneksi internet aktif untuk memuat library.");
        setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* --- CUSTOM CONFIRMATION MODAL --- */}
      {(gradeToDelete || resetExamId) && (
          <div className="absolute inset-0 z-[80] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full m-4 transform scale-100 animate-in zoom-in-95 duration-200">
                  <div className={`w-12 h-12 rounded-full ${resetExamId ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'} flex items-center justify-center mb-4 mx-auto`}>
                      {resetExamId ? <Unlock size={24}/> : <Trash2 size={24} />}
                  </div>
                  <h3 className="text-lg font-bold text-center text-slate-800 mb-2">
                      {resetExamId ? 'Reset Pelanggaran Ujian?' : 'Hapus Nilai?'}
                  </h3>
                  <p className="text-sm text-slate-500 text-center mb-6">
                      {resetExamId 
                        ? 'Tindakan ini akan menghapus rekam jejak ujian siswa ini (termasuk status diskualifikasi), sehingga siswa dapat mengerjakan ulang ujian.' 
                        : 'Apakah Anda yakin ingin menghapus data nilai ini secara permanen? Tindakan ini tidak dapat dibatalkan.'}
                  </p>
                  <div className="flex gap-3">
                      <button 
                        onClick={() => { setGradeToDelete(null); setResetExamId(null); }}
                        className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors"
                      >
                          Batal
                      </button>
                      <button 
                        onClick={resetExamId ? confirmResetExam : confirmDelete}
                        className={`flex-1 px-4 py-2 text-white font-bold rounded-lg transition-colors shadow-lg ${resetExamId ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}
                      >
                          {resetExamId ? 'Ya, Buka Blokir' : 'Ya, Hapus'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- SUCCESS TOAST --- */}
      {saveSuccessMsg && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[80] bg-emerald-600 text-white px-6 py-3 rounded-full shadow-lg font-bold flex items-center gap-2 animate-in slide-in-from-top-5 fade-out duration-300">
            <Check size={18} /> {saveSuccessMsg}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col h-[90vh] overflow-hidden relative">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <BarChart3 className="text-indigo-600" size={28} />
                Laporan & Penilaian
            </h2>
            <p className="text-sm text-slate-500">Manajemen nilai harian, ujian, dan rapor siswa.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full">
            <X size={24} />
          </button>
        </div>

        {/* DETAIL / GRADING VIEW */}
        {selectedResult ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
                 {/* ... Detail View ... */}
                 <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setSelectedResult(null)}
                            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div>
                            <h3 className="font-bold text-lg text-slate-800">{selectedResult.studentName}</h3>
                            <p className="text-sm text-slate-500">{selectedResult.quizTitle}</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                         <button 
                            onClick={handleDownloadPDF}
                            disabled={isPrinting}
                            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                            {isPrinting ? <Loader2 size={16} className="animate-spin"/> : <Printer size={16}/>} 
                            {isPrinting ? 'Memproses...' : 'Cetak PDF'}
                        </button>
                        <button 
                            onClick={handleSaveGrade}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-lg text-sm font-bold text-white hover:bg-indigo-700 shadow-md shadow-indigo-200"
                        >
                            <Save size={16}/> Simpan Nilai
                        </button>
                    </div>
                 </div>

                 <div className="flex-1 overflow-y-auto p-6">
                    <div ref={printRef} className="bg-white max-w-4xl mx-auto rounded-xl shadow-sm border border-slate-200 p-8">
                         {/* ... Printable Content ... */}
                         <div className="border-b-2 border-slate-800 pb-6 mb-8 text-center">
                            <h1 className="text-2xl font-bold uppercase tracking-wider">Laporan Hasil Ujian</h1>
                            <p className="text-sm text-slate-500">EduFlow AI Learning Management System</p>
                         </div>
                         <div className="grid grid-cols-2 gap-8 mb-8">
                             <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Identitas Siswa</p>
                                <p className="text-lg font-bold text-slate-800">{selectedResult.studentName}</p>
                                <p className="font-mono text-slate-500">NIS: {selectedResult.studentNis}</p>
                             </div>
                             <div className="text-right">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Detail Ujian</p>
                                <p className="font-medium text-slate-800">{selectedResult.moduleTitle}</p>
                                <p className="text-sm text-slate-500">{new Date(selectedResult.submittedAt).toLocaleString('id-ID')}</p>
                             </div>
                         </div>
                         
                         {/* DISQUALIFICATION BANNER */}
                         {selectedResult.isDisqualified && (
                             <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-center">
                                 <p className="text-red-700 font-bold text-lg flex items-center justify-center gap-2">
                                     <AlertCircle size={24}/> DISKUALIFIKASI SISTEM
                                 </p>
                                 <p className="text-red-600 text-sm mt-1">Siswa ini terdeteksi melakukan pelanggaran ujian (tab switching/focus lost) secara berulang.</p>
                             </div>
                         )}

                         <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8 flex justify-between items-center">
                             <div>
                                <p className="text-sm font-medium text-slate-500">Total Skor Akhir</p>
                             </div>
                             <div className="text-right">
                                <span className={`text-4xl font-extrabold ${selectedResult.score >= 60 ? 'text-indigo-600' : 'text-red-600'}`}>
                                    {selectedResult.score}
                                </span>
                                <span className="text-lg text-slate-400 font-medium">/100</span>
                             </div>
                         </div>
                         <h4 className="font-bold text-slate-700 mb-4 border-b pb-2">Rincian Jawaban</h4>
                         <div className="space-y-6">
                             {selectedResult.answers?.map((ans, idx) => (
                                 <div key={idx} className="border-b border-slate-100 pb-6 last:border-0 page-break-inside-avoid">
                                     <div className="flex justify-between items-start mb-2">
                                         <div className="flex items-center gap-2">
                                             <span className="bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded text-xs">No. {idx + 1}</span>
                                             <span className="text-[10px] font-bold border border-slate-200 px-1.5 py-0.5 rounded uppercase">{ans.type === 'MULTIPLE_CHOICE' ? 'Pilgan' : 'Esai'}</span>
                                         </div>
                                         <div className="flex items-center gap-2" data-html2canvas-ignore="true">
                                             <label className="text-xs font-bold text-slate-500">Nilai:</label>
                                             <input 
                                                type="number" min="0" max={ans.maxScore} value={ans.score}
                                                onChange={(e) => handleScoreChange(idx, e.target.value)}
                                                className="w-16 p-1 text-right text-sm border border-slate-300 rounded focus:border-indigo-500 font-bold text-indigo-700"
                                             />
                                             <span className="text-xs text-slate-400">/ {ans.maxScore}</span>
                                         </div>
                                     </div>
                                     <p className="text-slate-800 font-medium mb-3">{ans.questionText}</p>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                         <div className={`p-3 rounded-lg border ${ans.type === 'MULTIPLE_CHOICE' && ans.studentAnswer === ans.correctAnswer ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                                             <p className="text-xs font-bold text-slate-400 uppercase mb-1">Jawaban Siswa</p>
                                             <p className="text-sm text-slate-700 whitespace-pre-wrap">{ans.studentAnswer || '-'}</p>
                                         </div>
                                         <div className="p-3 rounded-lg border border-slate-100 bg-slate-50">
                                             <p className="text-xs font-bold text-slate-400 uppercase mb-1">Kunci / Referensi</p>
                                             <p className="text-sm text-slate-600">{ans.correctAnswer || '-'}</p>
                                         </div>
                                     </div>
                                 </div>
                             ))}
                         </div>
                    </div>
                 </div>
            </div>
        ) : (
            /* LIST VIEW (Default) */
            <>
                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-slate-50 border-b border-slate-200 shrink-0">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                            <FileCheck size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Ujian Masuk</p>
                            <h3 className="text-2xl font-bold text-slate-800">{totalQuizzesTaken}</h3>
                        </div>
                    </div>
                    {/* ... other stats ... */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                            <Calculator size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Nilai Rata-rata</p>
                            <h3 className="text-2xl font-bold text-slate-800">{averageScore}</h3>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                            <Activity size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Sedang Online</p>
                            <h3 className="text-2xl font-bold text-slate-800">{onlineStudentsCount} <span className="text-sm font-normal text-slate-400">/ {(students || []).length} Siswa</span></h3>
                        </div>
                    </div>
                </div>

                {/* Tabs & Search */}
                <div className="px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-100 shrink-0">
                    <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto">
                        <button 
                            onClick={() => setActiveTab('RESULTS')}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'RESULTS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Hasil Kuis
                        </button>
                        <button 
                            onClick={() => setActiveTab('GRADING')}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'GRADING' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Rekap Nilai
                        </button>
                        <button 
                            onClick={() => setActiveTab('ACTIVITY')}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'ACTIVITY' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Aktivitas
                        </button>
                    </div>
                    
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Cari Siswa / Materi..."
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                {/* Data Content */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
                    
                    {activeTab === 'GRADING' && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                             <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                 <div>
                                    <h3 className="font-bold text-slate-800">Rekapitulasi Nilai Siswa</h3>
                                    <p className="text-xs text-slate-500">Formula: (Rata-rata Harian + Rata-rata Ujian) / 2</p>
                                 </div>
                                 <div className="flex gap-2">
                                     <button 
                                        onClick={handleDownloadPDF}
                                        disabled={isPrinting}
                                        className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-50 hover:text-indigo-600 transition-colors disabled:opacity-50"
                                     >
                                         {isPrinting ? <Loader2 size={16} className="animate-spin"/> : <Printer size={16}/>}
                                         {isPrinting ? 'Memproses...' : 'Cetak Rapor'}
                                     </button>
                                     <button 
                                        onClick={() => setIsAddingGrade(true)}
                                        className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-sm"
                                     >
                                         <Plus size={16}/> Input Nilai Harian
                                     </button>
                                 </div>
                             </div>

                             {isAddingGrade && (
                                 <div className="p-4 bg-indigo-50 border-b border-indigo-100 animate-in slide-in-from-top-2">
                                     <h4 className="font-bold text-indigo-900 mb-3 text-sm">Input Nilai Manual (PR / Tugas / Keaktifan)</h4>
                                     <form onSubmit={handleSubmitManualGrade} className="flex flex-col md:flex-row gap-3 items-end">
                                         <div className="flex-1 w-full">
                                             <label className="text-xs font-bold text-slate-500">Pilih Siswa</label>
                                             <select 
                                                 value={manualNis} 
                                                 onChange={e => setManualNis(e.target.value)}
                                                 className="w-full p-2 rounded border border-slate-300 text-sm"
                                                 required
                                             >
                                                 <option value="">-- Pilih Siswa --</option>
                                                 {(students || []).map(s => (
                                                     <option key={s.nis} value={s.nis}>{s.name} ({s.classes?.join(', ') || 'Umum'})</option>
                                                 ))}
                                             </select>
                                         </div>
                                         <div className="flex-1 w-full">
                                             <label className="text-xs font-bold text-slate-500">Pilih Materi / Modul</label>
                                             <select 
                                                 value={selectedModuleId} 
                                                 onChange={e => setSelectedModuleId(e.target.value)}
                                                 className="w-full p-2 rounded border border-slate-300 text-sm"
                                                 required
                                             >
                                                 <option value="">-- Pilih Materi Penugasan --</option>
                                                 {(modules || []).map(m => (
                                                     <option key={m.id} value={m.id}>{m.title}</option>
                                                 ))}
                                             </select>
                                         </div>
                                         <div className="w-24">
                                             <label className="text-xs font-bold text-slate-500">Nilai (0-100)</label>
                                             <input 
                                                 type="number" min="0" max="100"
                                                 value={manualScore} 
                                                 onChange={e => setManualScore(e.target.value)}
                                                 className="w-full p-2 rounded border border-slate-300 text-sm"
                                                 required
                                             />
                                         </div>
                                         <div className="flex gap-2">
                                             <button type="button" onClick={() => setIsAddingGrade(false)} className="px-3 py-2 text-sm bg-white border rounded hover:bg-slate-50">Batal</button>
                                             <button type="submit" className="px-3 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold">Simpan</button>
                                         </div>
                                     </form>
                                 </div>
                             )}

                             {/* TABLE WRAPPER FOR PDF PRINTING */}
                             <div ref={activeTab === 'GRADING' ? printRef : null} className="bg-white">
                                 {/* Only visible in PDF via CSS or temporary render */}
                                 <div className="hidden p-6 border-b border-black/10 text-center" style={{ display: isPrinting ? 'block' : 'none' }}>
                                     <h1 className="text-2xl font-bold uppercase tracking-wider text-slate-900">Laporan Rekapitulasi Nilai</h1>
                                     <p className="text-sm text-slate-500">EduFlow AI Learning Management System</p>
                                     <p className="text-xs text-slate-400 mt-1">Dicetak pada: {new Date().toLocaleString('id-ID')}</p>
                                 </div>

                                 <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="p-4 text-xs font-bold text-slate-500 uppercase">Siswa</th>
                                            <th className="p-4 text-xs font-bold text-slate-500 uppercase">Kelas</th>
                                            <th className="p-4 text-xs font-bold text-slate-500 uppercase text-center">Rata-rata Harian<br/><span className="text-[10px] font-normal text-slate-400">(Manual)</span></th>
                                            <th className="p-4 text-xs font-bold text-slate-500 uppercase text-center">Rata-rata Ujian<br/><span className="text-[10px] font-normal text-slate-400">(App Quiz)</span></th>
                                            <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Nilai Akhir</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {studentGrades.length === 0 ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">Tidak ada data siswa.</td></tr>
                                        ) : (
                                            studentGrades.map((sg) => (
                                                <tr key={sg.nis} className="hover:bg-slate-50">
                                                    <td className="p-4">
                                                        <p className="font-bold text-slate-800">{sg.name}</p>
                                                        <p className="text-xs text-slate-500 font-mono">NIS: {sg.nis}</p>
                                                    </td>
                                                    <td className="p-4">
                                                        {sg.classes && sg.classes.length > 0 ? (
                                                            <span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold">{sg.classes.join(', ')}</span>
                                                        ) : '-'}
                                                    </td>
                                                    <td className="p-4 text-center group cursor-pointer" onClick={() => !isPrinting && setStudentForDetails(sg)}>
                                                        <div className="flex items-center justify-center gap-2 hover:bg-indigo-50 p-2 rounded-lg transition-colors border border-transparent hover:border-indigo-100">
                                                            {sg.manualCount > 0 ? (
                                                                <div className="text-center">
                                                                    <span className="font-bold text-slate-700">{sg.manualAvg}</span>
                                                                    <p className="text-[10px] text-slate-400">{sg.manualCount} Penilaian</p>
                                                                </div>
                                                            ) : <span className="text-slate-300">-</span>}
                                                            <Edit size={14} className="text-indigo-300 group-hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100" data-html2canvas-ignore="true" />
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                         {sg.quizCount > 0 ? (
                                                            <div>
                                                                <span className="font-bold text-slate-700">{sg.quizAvg}</span>
                                                                <p className="text-[10px] text-slate-400">{sg.quizCount} Kuis</p>
                                                            </div>
                                                        ) : <span className="text-slate-300">-</span>}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                                                            sg.finalScore >= 80 ? 'bg-emerald-100 text-emerald-700' :
                                                            sg.finalScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-red-100 text-red-700'
                                                        }`}>
                                                            {sg.finalScore}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                 </table>
                             </div>
                        </div>
                    )}

                    {activeTab === 'RESULTS' && (
                        // --- QUIZ RESULTS TABLE ---
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Siswa</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Judul Materi / Kuis</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Tanggal</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Nilai</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredResults.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-slate-400">
                                                Belum ada data hasil kuis yang masuk.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredResults.map((result) => (
                                            <tr key={result.id} className="hover:bg-indigo-50/30 transition-colors group">
                                                <td className="p-4">
                                                    <p className="font-bold text-slate-800">{result.studentName}</p>
                                                    <p className="text-xs text-slate-500 font-mono">NIS: {result.studentNis}</p>
                                                </td>
                                                <td className="p-4">
                                                    <p className="text-sm font-medium text-slate-700">{result.moduleTitle}</p>
                                                    <p className="text-xs text-indigo-500">{result.quizTitle}</p>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2 text-slate-600 text-sm">
                                                        <Clock size={14}/>
                                                        {new Date(result.submittedAt).toLocaleDateString('id-ID', {
                                                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    {result.isDisqualified ? (
                                                        <span className="inline-block px-2 py-1 rounded-full text-xs font-bold bg-red-600 text-white shadow-sm">
                                                            DISKUALIFIKASI
                                                        </span>
                                                    ) : (
                                                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                                                            result.score >= 80 ? 'bg-emerald-100 text-emerald-700' :
                                                            result.score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-red-100 text-red-700'
                                                        }`}>
                                                            {result.score}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button 
                                                            onClick={() => setSelectedResult(result)}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                            title="Lihat Detail & Koreksi"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                        {result.isDisqualified && onResetExam && (
                                                            <button 
                                                                onClick={() => setResetExamId(result.id)}
                                                                className="p-2 text-orange-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                                                title="Reset Pelanggaran / Buka Blokir"
                                                            >
                                                                <Unlock size={18} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                    
                    {activeTab === 'ACTIVITY' && (
                         // --- STUDENT ACTIVITY TABLE ---
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Identitas Siswa</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Network / IP</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredStudents.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="p-12 text-center text-slate-400">
                                                Data siswa tidak ditemukan.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredStudents.map((s) => {
                                            const isOnline = isUserOnline(s.lastLogin);
                                            
                                            return (
                                                <tr key={s.nis} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs relative">
                                                                {s.name.charAt(0)}
                                                                {isOnline && (
                                                                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-800">{s.name}</p>
                                                                <p className="text-xs text-slate-500 font-mono">NIS: {s.nis}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        {s.lastLogin ? (
                                                            <div className="flex flex-col gap-1">
                                                                {isOnline ? (
                                                                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded w-fit">
                                                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                                                        Sedang Online
                                                                    </span>
                                                                ) : (
                                                                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded w-fit">
                                                                        <Circle size={8} className="fill-slate-400 text-slate-400"/>
                                                                        Offline
                                                                    </span>
                                                                )}
                                                                
                                                                <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                                                    {isOnline ? 'Aktif sekarang' : `Terakhir: ${new Date(s.lastLogin).toLocaleString('id-ID', {
                                                                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                                                    })}`}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-400 italic px-2 py-0.5 bg-slate-50 rounded border border-slate-100 w-fit">
                                                                Belum pernah login
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        {s.ipAddress && s.lastLogin ? (
                                                            <div className="flex items-center gap-2">
                                                                <Monitor size={14} className={isOnline ? "text-indigo-400" : "text-slate-300"}/>
                                                                <div>
                                                                    <p className={`text-sm font-mono ${isOnline ? "text-slate-700" : "text-slate-400"}`}>{s.ipAddress}</p>
                                                                    <p className="text-[10px] text-slate-400">{s.deviceInfo || 'Web Browser'}</p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-300">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </>
        )}
        
        {/* STUDENT GRADE DETAILS MODAL */}
        {studentForDetails && (
            <div className="absolute inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-right duration-300">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
                    <div className="flex items-center gap-4">
                         <button 
                            onClick={() => {
                                setStudentForDetails(null);
                                setEditingGrade(null);
                            }}
                            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                         >
                            <ChevronLeft size={24} />
                         </button>
                         <div>
                             <h3 className="text-lg font-bold text-slate-800">Detail Nilai Harian</h3>
                             <p className="text-sm text-slate-500">{studentForDetails.name} (NIS: {studentForDetails.nis})</p>
                         </div>
                    </div>
                </div>
                
                <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
                    <div className="max-w-4xl mx-auto space-y-4">
                        {(manualGrades || []).filter(g => g.studentNis === studentForDetails.nis).length === 0 ? (
                            <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-300">
                                <p className="text-slate-500">Belum ada nilai harian untuk siswa ini.</p>
                            </div>
                        ) : (
                            (manualGrades || []).filter(g => g.studentNis === studentForDetails.nis).map(grade => (
                                <div key={grade.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group">
                                    {editingGrade?.id === grade.id ? (
                                        <div className="flex-1 flex gap-3 items-end">
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-slate-500">Pilih Materi Modul</label>
                                                <select 
                                                    value={editingGrade.moduleId} 
                                                    onChange={e => setEditingGrade({...editingGrade, moduleId: e.target.value})}
                                                    className="w-full p-2 text-sm border border-slate-300 rounded-lg"
                                                >
                                                    {(modules || []).map(m => (
                                                        <option key={m.id} value={m.id}>{m.title}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="w-24">
                                                <label className="text-xs font-bold text-slate-500">Nilai</label>
                                                <input 
                                                    type="number" 
                                                    value={editingGrade.score}
                                                    onChange={e => setEditingGrade({...editingGrade, score: parseInt(e.target.value)})}
                                                    className="w-full p-2 text-sm border border-slate-300 rounded-lg"
                                                />
                                            </div>
                                            <button 
                                                onClick={handleUpdateEditingGrade}
                                                className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700"
                                            >
                                                <Save size={18}/>
                                            </button>
                                            <button 
                                                onClick={() => setEditingGrade(null)}
                                                className="bg-slate-100 text-slate-600 p-2 rounded-lg hover:bg-slate-200"
                                            >
                                                <X size={18}/>
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div>
                                                <h4 className="font-bold text-slate-800">{grade.title}</h4>
                                                <p className="text-xs text-slate-500">{new Date(grade.date).toLocaleDateString('id-ID')}</p>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <span className={`text-xl font-bold ${grade.score >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                    {grade.score}
                                                </span>
                                                <div className="flex gap-2 transition-opacity">
                                                    <button 
                                                        onClick={() => setEditingGrade(grade)}
                                                        className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"
                                                    >
                                                        <Pencil size={16}/>
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => handleDeleteClick(e, grade.id)}
                                                        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                                                    >
                                                        <Trash2 size={16}/>
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ReportsDashboard;
