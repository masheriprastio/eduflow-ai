import React, { useState, useEffect } from 'react';
import { ModuleCategory } from '../types';
import { generateModuleMetadata } from '../services/geminiService';
import { X, Upload, Sparkles, FileText, CheckCircle, Users, Loader2 } from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (data: any) => void;
  classes?: string[]; // Available classes
  initialTargetClass?: string; // Optional: Pre-select a class
}

const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onUpload, classes = [], initialTargetClass }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ModuleCategory>(ModuleCategory.TECHNOLOGY);
  const [file, setFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiData, setAiData] = useState<{ summary: string; tags: string[] } | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  
  // Target Class State
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  // Effect to pre-select class if provided
  useEffect(() => {
    if (isOpen && initialTargetClass) {
        setSelectedClasses([initialTargetClass]);
    } else if (isOpen && !initialTargetClass) {
        // Reset if opened without specific target
        setSelectedClasses([]);
    }
  }, [isOpen, initialTargetClass]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      // Limit file size to 5MB for Supabase Database Insert (Text Column)
      // Menyimpan di DB lebih stabil daripada Storage Bucket untuk setup pemula
      if (selectedFile.size > 5 * 1024 * 1024) {
          alert("Ukuran file terlalu besar! Maksimal 5MB untuk penyimpanan database langsung.");
          return;
      }
      setFile(selectedFile);
    }
  };

  const handleAutoGenerate = async () => {
    if (!title && !description) return;
    setIsGenerating(true);
    const result = await generateModuleMetadata(title, description);
    if (result) {
      setAiData(result);
    }
    setIsGenerating(false);
  };

  const toggleClass = (cls: string) => {
      setSelectedClasses(prev => 
        prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
      );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    setIsProcessingFile(true);

    try {
        let publicUrl = '';
        
        if (file) {
            // Convert file to Base64 string for direct DB storage
            // This bypasses Supabase Storage buckets to avoid Policy/CORS issues
            publicUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        onUpload({
            title,
            description,
            category,
            fileUrl: publicUrl, // Stored directly in DB row
            fileName: file ? file.name : '',
            aiSummary: aiData?.summary || '',
            tags: aiData?.tags || [],
            targetClasses: selectedClasses.length > 0 ? selectedClasses : undefined,
        });
        
        // Reset form
        setTitle('');
        setDescription('');
        setFile(null);
        setAiData(null);
        setSelectedClasses([]);
        onClose();
    } catch (error) {
        console.error("Error processing file", error);
        alert("Gagal memproses file.");
    } finally {
        setIsProcessingFile(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Upload className="text-indigo-600" size={24} />
            Unggah Materi Baru
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="upload-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* File Input */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Dokumen Materi (PDF/Doc)</label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-indigo-500 hover:bg-indigo-50 transition-colors cursor-pointer group relative">
                <input 
                  type="file" 
                  onChange={handleFileChange} 
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className={`p-3 rounded-full mb-3 ${file ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600 group-hover:bg-white group-hover:scale-110 transition-transform'}`}>
                   {file ? <CheckCircle size={24}/> : <FileText size={24} />}
                </div>
                {file ? (
                  <p className="text-sm font-medium text-slate-800">{file.name}</p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-slate-800">Klik untuk pilih file</p>
                    <p className="text-xs text-slate-500 mt-1">atau tarik file ke sini (Max 5MB)</p>
                  </>
                )}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Judul Materi</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="Contoh: Pengantar Sejarah Indonesia"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Kategori</label>
              <div className="grid grid-cols-2 gap-3">
                {Object.values(ModuleCategory).map((cat) => (
                  <label key={cat} className={`flex items-center justify-center px-4 py-2 rounded-lg border cursor-pointer text-sm font-medium transition-all ${category === cat ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                    <input 
                      type="radio" 
                      name="category" 
                      value={cat} 
                      checked={category === cat}
                      onChange={() => setCategory(cat)}
                      className="hidden"
                    />
                    {cat}
                  </label>
                ))}
              </div>
            </div>

            {/* Target Classes */}
            {classes.length > 0 && (
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <Users size={16}/> Target Kelas <span className="text-xs font-normal text-slate-400">(Opsional)</span>
                    </label>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 mb-2">Pilih kelas spesifik yang dapat mengakses materi ini. Jika kosong, materi dapat diakses oleh semua siswa.</p>
                        <div className="flex flex-wrap gap-2">
                            {classes.map(cls => (
                                <label key={cls} className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-all select-none ${selectedClasses.includes(cls) ? 'bg-indigo-100 text-indigo-700 border-indigo-200 ring-1 ring-indigo-500' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-300'}`}>
                                    <input 
                                        type="checkbox" 
                                        className="hidden" 
                                        checked={selectedClasses.includes(cls)}
                                        onChange={() => toggleClass(cls)}
                                    />
                                    {cls}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Description & AI */}
            <div className="relative">
              <div className="flex justify-between items-center mb-2">
                 <label className="block text-sm font-semibold text-slate-700">Deskripsi / Ringkasan Materi</label>
                 <button 
                   type="button"
                   onClick={handleAutoGenerate}
                   disabled={isGenerating || (!title && !description)}
                   className="text-xs flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
                 >
                   {isGenerating ? (
                     <span className="animate-pulse">Sedang berpikir...</span>
                   ) : (
                     <>
                        <Sparkles size={14} />
                        Auto-Lengkapi dengan AI
                     </>
                   )}
                 </button>
              </div>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                placeholder="PENTING: Tulis atau paste ringkasan materi di sini agar AI bisa membuat soal yang akurat..."
              />
              <p className="text-[10px] text-slate-400 mt-1">*AI akan menggunakan teks ini sebagai sumber soal kuis.</p>
              
              {aiData && (
                 <div className="mt-3 bg-indigo-50 rounded-lg p-4 border border-indigo-100 animate-in slide-in-from-top-2">
                    <p className="text-xs font-bold text-indigo-600 mb-1 flex items-center gap-1">
                      <Sparkles size={12}/> SARAN AI
                    </p>
                    <p className="text-sm text-slate-700 mb-2 italic">"{aiData.summary}"</p>
                    <div className="flex flex-wrap gap-2">
                      {aiData.tags.map(tag => (
                        <span key={tag} className="text-[10px] uppercase font-bold tracking-wider text-indigo-500 bg-white px-2 py-0.5 rounded border border-indigo-100">
                          {tag}
                        </span>
                      ))}
                    </div>
                 </div>
              )}
            </div>
            
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-700 flex flex-col gap-1">
                <div className="flex items-center gap-2 font-bold">
                    <FileText size={16}/>
                    Mode Simpan Langsung:
                </div>
                <p>1. File akan dikonversi dan disimpan langsung ke Database Supabase (Bukan Storage Bucket).</p>
                <p>2. Pastikan ukuran file <strong>di bawah 5MB</strong> agar proses upload berhasil.</p>
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 sticky bottom-0 z-10">
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Batal
          </button>
          <button 
            type="submit" 
            form="upload-form"
            disabled={isProcessingFile}
            className="px-5 py-2.5 rounded-xl font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95 disabled:opacity-70 disabled:scale-100 flex items-center gap-2"
          >
            {isProcessingFile && <Loader2 size={16} className="animate-spin"/>}
            {isProcessingFile ? 'Mengunggah...' : 'Unggah Materi'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;