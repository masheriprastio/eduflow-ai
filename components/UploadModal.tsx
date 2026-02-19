import React, { useState, useMemo, useRef } from 'react';
import { Student, LearningModule, ClassGroup } from '../types';
import { X, UserPlus, Trash2, ShieldCheck, Search, Pencil, Save, RotateCcw, User, List, Plus, Download, Filter, Upload, FileSpreadsheet, Eye, BookOpen, Users, GraduationCap, LayoutGrid, Tag, PlusCircle, CheckSquare, Square, EyeOff, Check, Lock } from 'lucide-react';

interface StudentManagerProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  modules?: LearningModule[];
  classes: ClassGroup[];
  onAddStudent: (student: Student) => void;
  onImportStudents?: (students: Student[]) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (nis: string) => void;
  onUpdateClasses: (classes: ClassGroup[]) => void;
  onUploadModule?: (className: string) => void; 
}

const StudentManager: React.FC<StudentManagerProps> = ({ 
    isOpen, 
    onClose, 
    students, 
    modules = [],
    classes = [],
    onAddStudent, 
    onImportStudents,
    onUpdateStudent, 
    onDeleteStudent,
    onUpdateClasses,
    onUploadModule
}) => {
  // Tab State: 'STUDENTS' or 'CLASSES'
  const [managerTab, setManagerTab] = useState<'STUDENTS' | 'CLASSES'>('STUDENTS');

  // Student Form State
  const [nis, setNis] = useState('');
  const [name, setName] = useState('');
  const [studentClasses, setStudentClasses] = useState<string[]>([]); // Array of selected classes
  const [password, setPassword] = useState('password');
  
  // Class Form State
  const [className, setClassName] = useState('');
  const [classDesc, setClassDesc] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('All');
  
  // Mobile Tab State (for Student View)
  const [mobileTab, setMobileTab] = useState<'list' | 'form'>('list');
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  
  // Detail View State
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);

  // Password Visibility
  const [showPass, setShowPass] = useState(false);

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.nis.includes(search);
        
        let matchesClass = true;
        if (selectedClassFilter === 'All') {
            matchesClass = true;
        } else if (selectedClassFilter === 'Unassigned') {
            matchesClass = !s.classes || s.classes.length === 0;
        } else {
            // Check if student is enrolled in the selected filter class
            matchesClass = s.classes?.includes(selectedClassFilter) || false;
        }

        return matchesSearch && matchesClass;
    });
  }, [students, search, selectedClassFilter]);

  if (!isOpen) return null;

  // --- STUDENT HANDLERS ---

  const toggleClassSelection = (cls: string) => {
      setStudentClasses(prev => 
        prev.includes(cls) 
            ? prev.filter(c => c !== cls) 
            : [...prev, cls]
      );
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nis || !name || !password) return;

    const newStudentData: Student = {
        nis,
        name,
        classes: studentClasses,
        password,
        // Preserve existing fields if editing
        needsPasswordChange: isEditing ? students.find(s => s.nis === nis)?.needsPasswordChange : true
    };

    if (isEditing) {
        onUpdateStudent(newStudentData);
        alert('Data siswa berhasil diperbarui!');
        resetStudentForm();
    } else {
        if (students.some(s => s.nis === nis)) {
            alert('NIS sudah terdaftar!');
            return;
        }
        onAddStudent(newStudentData);
        resetStudentForm();
    }
    setMobileTab('list');
  };

  const handleEditStudent = (student: Student) => {
    setNis(student.nis);
    setName(student.name);
    setStudentClasses(student.classes || []);
    setPassword(student.password);
    setIsEditing(true);
    setManagerTab('STUDENTS');
    setMobileTab('form');
  };

  const resetStudentForm = () => {
    setNis('');
    setName('');
    setStudentClasses([]); 
    setPassword('password');
    setIsEditing(false);
  };

  // --- CLASS HANDLERS ---

  const handleAddClass = (e: React.FormEvent) => {
      e.preventDefault();
      if(!className.trim()) return;

      const newClass: ClassGroup = {
          id: Date.now().toString(),
          name: className.trim(),
          description: classDesc
      };
      
      onUpdateClasses([...classes, newClass]);
      setClassName('');
      setClassDesc('');
  };

  const handleDeleteClass = (id: string) => {
      if(window.confirm("Hapus kelas ini? Siswa yang terdaftar di kelas ini akan kehilangan akses kelas tersebut.")) {
          const classToDelete = classes.find(c => c.id === id);
          if(!classToDelete) return;

          // Remove class
          onUpdateClasses(classes.filter(c => c.id !== id));
          
          // Update affected students: Remove deleted class from their list
          students.forEach(s => {
              if (s.classes?.includes(classToDelete.name)) {
                  onUpdateStudent({ 
                      ...s, 
                      classes: s.classes.filter(c => c !== classToDelete.name) 
                  });
              }
          });
      }
  };


  // --- IMPORT / EXPORT ---

  const handleExportCSV = () => {
    const headers = ['NIS', 'Nama Lengkap', 'Kelas (Pisahkan dengan ;)', 'Password'];
    const rows = filteredStudents.map(s => [
      s.nis, 
      s.name, 
      s.classes?.join(';') || '', 
      s.password
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `data_siswa_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImportStudents) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        const text = evt.target?.result as string;
        const lines = text.split('\n');
        // Skip header
        const newStudents: Student[] = [];
        for(let i=1; i<lines.length; i++) {
            const cols = lines[i].split(',');
            if (cols.length >= 2) {
                const classStr = cols[2]?.trim();
                newStudents.push({
                    nis: cols[0].trim(),
                    name: cols[1].trim(),
                    classes: classStr ? classStr.split(';').map(c => c.trim()) : [],
                    password: cols[3]?.trim() || 'password',
                    needsPasswordChange: true
                });
            }
        }
        onImportStudents(newStudents);
        alert(`Berhasil mengimpor ${newStudents.length} siswa.`);
    };
    reader.readAsText(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Users className="text-indigo-600" size={24} />
                Manajemen Siswa & Kelas
            </h2>
            <p className="text-sm text-slate-500">Kelola data akun siswa, kelas, dan akses materi.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full">
            <X size={24} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
            <button 
                onClick={() => setManagerTab('STUDENTS')}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors border-b-2 ${managerTab === 'STUDENTS' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <User size={18}/> Data Siswa
            </button>
            <button 
                onClick={() => setManagerTab('CLASSES')}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors border-b-2 ${managerTab === 'CLASSES' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <LayoutGrid size={18}/> Daftar Kelas
            </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            {managerTab === 'STUDENTS' ? (
                /* --- STUDENT MANAGEMENT --- */
                <div className="flex flex-col md:flex-row flex-1 h-full overflow-hidden">
                    
                    {/* Left/Top: Form Panel */}
                    <div className={`w-full md:w-[350px] bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col overflow-y-auto transition-transform ${mobileTab === 'list' ? 'hidden md:flex' : 'flex'}`}>
                        <div className="p-5">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                                {isEditing ? <Pencil size={18}/> : <UserPlus size={18}/>}
                                {isEditing ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
                            </h3>
                            
                            <form onSubmit={handleStudentSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">NIS (Nomor Induk)</label>
                                    <input 
                                        type="text" 
                                        value={nis}
                                        onChange={(e) => setNis(e.target.value)}
                                        className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                        placeholder="12345"
                                        required
                                        disabled={isEditing} // NIS cannot be changed
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Nama Lengkap</label>
                                    <input 
                                        type="text" 
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                        placeholder="Nama Siswa"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Kelas (Bisa &gt; 1)</label>
                                    <div className="border border-slate-300 rounded-lg p-2 max-h-32 overflow-y-auto bg-slate-50">
                                        {classes.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic p-1">Belum ada kelas.</p>
                                        ) : (
                                            classes.map(cls => (
                                                <label key={cls.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer">
                                                    <div className={`w-4 h-4 border rounded flex items-center justify-center ${studentClasses.includes(cls.name) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}>
                                                        {studentClasses.includes(cls.name) && <Check size={12}/>}
                                                    </div>
                                                    <input 
                                                        type="checkbox" 
                                                        className="hidden" 
                                                        checked={studentClasses.includes(cls.name)}
                                                        onChange={() => toggleClassSelection(cls.name)}
                                                    />
                                                    <span className="text-sm text-slate-700 font-medium">{cls.name}</span>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Password</label>
                                    <div className="relative">
                                        <input 
                                            type={showPass ? "text" : "password"} 
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full p-2.5 pr-10 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                            placeholder="Default: password"
                                            required
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setShowPass(!showPass)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                                        </button>
                                    </div>
                                    {isEditing && (
                                        <p className="text-[10px] text-orange-500 mt-1 flex items-center gap-1">
                                            <ShieldCheck size={10}/> Mengubah password akan mereset status wajib ganti password.
                                        </p>
                                    )}
                                </div>

                                <div className="flex gap-2 pt-2">
                                    {isEditing && (
                                        <button 
                                            type="button"
                                            onClick={resetStudentForm}
                                            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200"
                                        >
                                            Batal
                                        </button>
                                    )}
                                    <button 
                                        type="submit"
                                        className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                                    >
                                        <Save size={16}/> {isEditing ? 'Simpan Perubahan' : 'Tambah Siswa'}
                                    </button>
                                </div>
                            </form>
                            
                            {/* CSV Import / Export */}
                            <div className="mt-8 pt-6 border-t border-slate-100">
                                <h4 className="text-xs font-bold uppercase text-slate-500 mb-3">Bulk Actions</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={handleExportCSV} className="flex flex-col items-center justify-center p-3 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-indigo-200 transition-colors text-slate-600">
                                        <Download size={18} className="mb-1 text-emerald-500"/>
                                        <span className="text-xs font-bold">Export CSV</span>
                                    </button>
                                    <div className="relative">
                                        <input 
                                            type="file" 
                                            ref={fileInputRef}
                                            accept=".csv" 
                                            onChange={handleImportCSV}
                                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                        />
                                        <div className="flex flex-col items-center justify-center p-3 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-indigo-200 transition-colors text-slate-600 h-full">
                                            <FileSpreadsheet size={18} className="mb-1 text-blue-500"/>
                                            <span className="text-xs font-bold">Import CSV</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right/Bottom: List Panel */}
                    <div className={`flex-1 flex flex-col bg-slate-50 h-full overflow-hidden transition-transform ${mobileTab === 'form' ? 'hidden md:flex' : 'flex'}`}>
                         
                         {/* Filter Bar */}
                         <div className="p-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
                             <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <input 
                                    type="text" 
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari nama atau NIS..."
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                             </div>
                             
                             <div className="flex items-center gap-2 w-full sm:w-auto">
                                <Filter size={16} className="text-slate-400"/>
                                <select 
                                    value={selectedClassFilter}
                                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                                    className="p-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-40"
                                >
                                    <option value="All">Semua Kelas</option>
                                    <option value="Unassigned">Tanpa Kelas</option>
                                    {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                             </div>

                             {/* Mobile Toggle */}
                             <button 
                                onClick={() => setMobileTab('form')}
                                className="md:hidden w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold shadow-md flex items-center justify-center gap-2"
                             >
                                <Plus size={16}/> Tambah Siswa
                             </button>
                         </div>

                         {/* Student List */}
                         <div className="flex-1 overflow-y-auto p-4">
                            {filteredStudents.length === 0 ? (
                                <div className="text-center py-10">
                                    <p className="text-slate-400">Tidak ada siswa ditemukan.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                    {filteredStudents.map(student => (
                                        <div key={student.nis} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center group hover:border-indigo-300 transition-colors">
                                            <div>
                                                <h4 className="font-bold text-slate-800">{student.name}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                        {student.nis}
                                                    </span>
                                                    {student.classes && student.classes.length > 0 ? (
                                                        <div className="flex gap-1">
                                                            {student.classes.map(c => (
                                                                <span key={c} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                                                    {c}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400 italic">Belum masuk kelas</span>
                                                    )}
                                                </div>
                                                {/* Password visibility hint for Admin */}
                                                <div className="mt-1 flex items-center gap-2">
                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                        <Lock size={10}/> {student.password}
                                                    </span>
                                                    {student.needsPasswordChange && (
                                                        <span className="text-[10px] text-orange-500 font-medium">
                                                            (Wajib Ganti)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleEditStudent(student)}
                                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Pencil size={18}/>
                                                </button>
                                                <button 
                                                    onClick={() => onDeleteStudent(student.nis)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Hapus"
                                                >
                                                    <Trash2 size={18}/>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                         </div>
                    </div>
                </div>
            ) : (
                /* --- CLASS MANAGEMENT --- */
                <div className="flex flex-col flex-1 h-full overflow-hidden bg-white">
                    <div className="p-6 max-w-4xl mx-auto w-full flex flex-col h-full">
                        
                        {/* Class Form */}
                        <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100 mb-6 shrink-0">
                            <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
                                <PlusCircle size={18}/> Buat Kelas Baru
                            </h4>
                            <form onSubmit={handleAddClass} className="flex flex-col md:flex-row gap-4 items-end">
                                <div className="w-full md:w-1/3">
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nama Kelas</label>
                                    <input 
                                        type="text" 
                                        value={className}
                                        onChange={(e) => setClassName(e.target.value)}
                                        className="w-full p-2.5 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                        placeholder="Contoh: 10-A"
                                        required
                                    />
                                </div>
                                <div className="w-full md:flex-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Deskripsi (Opsional)</label>
                                    <input 
                                        type="text" 
                                        value={classDesc}
                                        onChange={(e) => setClassDesc(e.target.value)}
                                        className="w-full p-2.5 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                        placeholder="Keterangan singkat..."
                                    />
                                </div>
                                <button type="submit" className="w-full md:w-auto px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-md">
                                    Tambah
                                </button>
                            </form>
                        </div>

                        {/* Class List */}
                        <div className="flex-1 overflow-y-auto">
                            <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                <List size={18}/> Daftar Kelas Aktif
                            </h4>
                            {classes.length === 0 ? (
                                <p className="text-slate-400 italic">Belum ada kelas yang dibuat.</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {classes.map(cls => {
                                        const studentCount = students.filter(s => s.classes?.includes(cls.name)).length;
                                        
                                        return (
                                            <div key={cls.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h5 className="text-xl font-bold text-slate-800">{cls.name}</h5>
                                                    <div className="flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold">
                                                        <Users size={12}/> {studentCount}
                                                    </div>
                                                </div>
                                                <p className="text-sm text-slate-500 mb-4 h-10 line-clamp-2">{cls.description || 'Tidak ada deskripsi'}</p>
                                                
                                                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                                                    <button 
                                                        onClick={() => {
                                                            if (onUploadModule) {
                                                                onUploadModule(cls.name);
                                                                onClose(); // Close Student Manager to show Upload Modal
                                                            }
                                                        }}
                                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                                    >
                                                        <Upload size={12}/> Upload Materi
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteClass(cls.id)}
                                                        className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                                        title="Hapus Kelas"
                                                    >
                                                        <Trash2 size={16}/>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default StudentManager;