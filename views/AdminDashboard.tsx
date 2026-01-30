import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Student, Teacher, Question, QuestionType, QuestionCategory, QuestionPacket, Exam, Role, SchoolSettings, ExamResult } from '../types';
import { Upload, Download, Trash2, Search, Brain, Save, Settings, Plus, X, List, Layout, FileSpreadsheet, Check, Eye, ChevronLeft, ChevronRight, HelpCircle, Edit2, ImageIcon, Users, UserPlus, BarChart2, TrendingUp, AlertTriangle, Table, PieChart, Layers, FileText, ArrowRight, CalendarClock, PlayCircle, StopCircle, Clock, Activity, RefreshCw, BookOpen, GraduationCap, AlignLeft, Image as LucideImage, AlertOctagon, ShieldAlert, Filter, Smartphone, FileImage, UserX } from 'lucide-react';
import { CLASS_LIST } from '../constants';
import * as XLSX from 'xlsx';

interface AdminDashboardProps {
  userRole?: Role; 
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  teachers: Teacher[];
  setTeachers: React.Dispatch<React.SetStateAction<Teacher[]>>;
  questions: Question[];
  setQuestions: React.Dispatch<React.SetStateAction<Question[]>>;
  exams?: Exam[]; 
  setExams?: React.Dispatch<React.SetStateAction<Exam[]>>;
  packets: QuestionPacket[];
  setPackets: React.Dispatch<React.SetStateAction<QuestionPacket[]>>;
  activeTab: string;
  schoolSettings?: SchoolSettings;
  setSchoolSettings?: React.Dispatch<React.SetStateAction<SchoolSettings>>;
  onSyncData?: () => void;
  examResults?: ExamResult[];
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  userRole = Role.ADMIN, students, setStudents, teachers, setTeachers, questions, setQuestions, exams = [], setExams, activeTab,
  packets, setPackets, schoolSettings, setSchoolSettings, onSyncData, examResults = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const studentFileRef = useRef<HTMLInputElement>(null);
  const questionFileRef = useRef<HTMLInputElement>(null); // New ref for Question Import
  const imageUploadRef = useRef<HTMLInputElement>(null); // For Question Image
  
  // --- Student Management State ---
  const [selectedClassFilter, setSelectedClassFilter] = useState(''); 
  const [showAddStudentModal, setShowAddStudentModal] = useState(false); 
  const [newStudent, setNewStudent] = useState({ name: '', class: '', nis: '', nisn: '' });

  // --- Bank Soal State ---
  const [bankSubTab, setBankSubTab] = useState<'config' | 'input'>('config');
  const [selectedPacketId, setSelectedPacketId] = useState<string>('');

  // Config State
  const [editingPacketId, setEditingPacketId] = useState<string | null>(null); 
  const [newPacketName, setNewPacketName] = useState('');
  const [newPacketCategory, setNewPacketCategory] = useState<QuestionCategory>(QuestionCategory.LITERASI);
  const [newPacketTotal, setNewPacketTotal] = useState<number | ''>(''); 

  // Input Manual State
  const [activeSlot, setActiveSlot] = useState<number | null>(null); 
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [manualType, setManualType] = useState<QuestionType>(QuestionType.SINGLE);
  
  // Stimulus State
  const [stimulusType, setStimulusType] = useState<'text' | 'image'>('text');
  const [newStimulus, setNewStimulus] = useState(''); 
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionImage, setNewQuestionImage] = useState(''); // Stores Base64
  
  // Options State
  const [newOptions, setNewOptions] = useState<string[]>(['', '', '', '']);
  const [singleCorrectIndex, setSingleCorrectIndex] = useState(0);
  const [complexCorrectIndices, setComplexCorrectIndices] = useState<number[]>([]);
  const [matchingPairs, setMatchingPairs] = useState<{left: string, right: string}[]>([{left: '', right: ''}]);

  // --- Exam Management State ---
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamPacketId, setNewExamPacketId] = useState('');
  const [newExamDuration, setNewExamDuration] = useState(60);
  const [newExamClasses, setNewExamClasses] = useState<string[]>([]);
  const [newExamStart, setNewExamStart] = useState('');
  const [newExamEnd, setNewExamEnd] = useState('');

  // --- MONITORING STATE ---
  const [selectedExamForMonitor, setSelectedExamForMonitor] = useState<string>('');
  const [monitoringClassFilter, setMonitoringClassFilter] = useState<string>('');
  const [monitoringStatusFilter, setMonitoringStatusFilter] = useState<'all' | 'finished' | 'unfinished'>('all');

  // --- Analysis State ---
  const [analysisSubTab, setAnalysisSubTab] = useState<'item' | 'recap' | 'missing'>('item');
  const [selectedExamIdForAnalysis, setSelectedExamIdForAnalysis] = useState<string>('');
  const [analysisClassFilter, setAnalysisClassFilter] = useState<string>('');

  // --- MEMOIZED FILTERS (ROLE BASED) ---
  const visiblePackets = useMemo(() => {
    if (userRole === Role.ADMIN) return packets;
    if (userRole === Role.TEACHER_LITERASI) return packets.filter(p => p.category === QuestionCategory.LITERASI);
    if (userRole === Role.TEACHER_NUMERASI) return packets.filter(p => p.category === QuestionCategory.NUMERASI);
    return [];
  }, [packets, userRole]);

  const visibleExams = useMemo(() => {
     if (userRole === Role.ADMIN) return exams;
     const visiblePacketIds = visiblePackets.map(p => p.id);
     return exams.filter(e => visiblePacketIds.includes(e.packetId));
  }, [exams, visiblePackets, userRole]);

  useEffect(() => {
      if (visibleExams.length > 0 && !selectedExamIdForAnalysis) setSelectedExamIdForAnalysis(visibleExams[0].id);
      if (visibleExams.length > 0 && !selectedExamForMonitor) setSelectedExamForMonitor(visibleExams[0].id);
  }, [exams, visibleExams]);

  const selectedExamForAnalysis = useMemo(() => exams.find(e => e.id === selectedExamIdForAnalysis), [exams, selectedExamIdForAnalysis]);

  useEffect(() => {
      if (userRole === Role.TEACHER_LITERASI) setNewPacketCategory(QuestionCategory.LITERASI);
      else if (userRole === Role.TEACHER_NUMERASI) setNewPacketCategory(QuestionCategory.NUMERASI);
  }, [userRole]);

  // --- HELPER FUNCTIONS ---
  const getItemAnalysis = (questionId: string, question: Question) => {
      const results = examResults.filter(r => r.examId === selectedExamIdForAnalysis);
      const totalAttempts = results.length;
      if(totalAttempts === 0) return { correctRate: 0, answerDist: [0,0,0,0,0], totalAttempts: 0, correctCount: 0 };

      let correctCount = 0;
      const answerDist = [0,0,0,0,0];

      results.forEach(r => {
          const ans = r.answers[questionId];
          let isCorrect = false;
          if (question.type === QuestionType.SINGLE) {
              if (ans === question.correctAnswerIndex) isCorrect = true;
              if (typeof ans === 'number' && ans >= 0 && ans < 5) answerDist[ans]++;
          } else if (question.type === QuestionType.COMPLEX) {
             const userSet = new Set(ans as number[]);
             const correctSet = new Set(question.correctAnswerIndices);
             if (userSet.size === correctSet.size && [...userSet].every(x => correctSet.has(x))) isCorrect = true;
          }
          if (isCorrect) correctCount++;
      });
      return { totalAttempts, correctCount, correctRate: (correctCount / totalAttempts) * 100, answerDist };
  };

  const triggerSync = () => { if (onSyncData) onSyncData(); };
  const formatDateRange = (start: string, end: string) => {
      const s = new Date(start); const e = new Date(end);
      return `${s.toLocaleString('id-ID', {day: 'numeric', month: 'short', hour:'2-digit', minute:'2-digit'})} s.d ${e.toLocaleString('id-ID', {day: 'numeric', month: 'short', hour:'2-digit', minute:'2-digit'})}`;
  };

  // Handle Image Upload with Compression/Resizing
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
              const img = new Image();
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  let width = img.width;
                  let height = img.height;
                  const MAX_SIZE = 800; // Resize large images to max 800px

                  if (width > height) {
                      if (width > MAX_SIZE) {
                          height *= MAX_SIZE / width;
                          width = MAX_SIZE;
                      }
                  } else {
                      if (height > MAX_SIZE) {
                          width *= MAX_SIZE / height;
                          height = MAX_SIZE;
                      }
                  }
                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  ctx?.drawImage(img, 0, 0, width, height);
                  
                  // Compress to JPEG 70% quality to save space
                  const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                  setNewQuestionImage(dataUrl);
              };
              img.src = event.target?.result as string;
          };
          reader.readAsDataURL(file);
      }
  };

  const handleDownloadTemplateQuestion = () => {
    const data = [
      ["Pertanyaan", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Kunci Jawaban (A/B/C/D)"],
      ["Siapa presiden pertama RI?", "Soekarno", "Hatta", "Syahrir", "Sudirman", "A"],
      ["Siapa proklamator?", "Hatta", "Soekarno", "Yamin", "Supomo", "B"]
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Soal");
    XLSX.writeFile(wb, 'Template_Soal_Guru.xlsx');
  };

  const handleImportQuestions = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      // Skip header row
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }).slice(1) as any[][];

      const packet = packets.find(p => p.id === selectedPacketId);
      const packetCategory = packet ? packet.category : QuestionCategory.LITERASI;

      const imported: Question[] = rows
        .filter(row => row[0]) // Ensure question text exists
        .map((row, idx) => {
          const text = row[0];
          const opts = [row[1], row[2], row[3], row[4]];
          const keyRaw = row[5];
          
          let correctIndex = 0;
          if (keyRaw && typeof keyRaw === 'string') {
             const k = keyRaw.trim().toUpperCase();
             if (k === 'A') correctIndex = 0;
             else if (k === 'B') correctIndex = 1;
             else if (k === 'C') correctIndex = 2;
             else if (k === 'D') correctIndex = 3;
          }

          return {
            id: `imp-q-${Date.now()}-${idx}`,
            packetId: selectedPacketId || undefined,
            text: text,
            options: opts,
            correctAnswerIndex: correctIndex,
            type: QuestionType.SINGLE,
            category: packetCategory
          };
        });
      setQuestions([...questions, ...imported]);
      alert(`Berhasil mengimpor ${imported.length} soal.`);
      triggerSync();
    };
    reader.readAsBinaryString(file);
    if(questionFileRef.current) questionFileRef.current.value = '';
  };

  // --- HANDLERS ---
  const handleCreateExam = () => {
    if (!newExamTitle || !newExamPacketId || !newExamStart || !newExamEnd || newExamClasses.length === 0) { alert("Lengkapi data ujian."); return; }
    const pktQuestions = questions.filter(q => q.packetId === newExamPacketId);
    if (pktQuestions.length === 0) { alert("Paket soal kosong."); return; }
    const newExam: Exam = { id: `exam-${Date.now()}`, title: newExamTitle, packetId: newExamPacketId, durationMinutes: newExamDuration, classTarget: newExamClasses, scheduledStart: newExamStart, scheduledEnd: newExamEnd, questions: pktQuestions, isActive: true };
    if (setExams) setExams([...exams, newExam]);
    alert("Ujian dijadwalkan!"); setNewExamTitle(''); setNewExamPacketId(''); setNewExamClasses([]); setNewExamStart(''); setNewExamEnd(''); triggerSync();
  };

  const handleDeleteExam = (id: string) => { if (confirm('Hapus jadwal?')) { if (setExams) setExams(exams.filter(e => e.id !== id)); triggerSync(); } };
  const toggleExamStatus = (id: string) => { if (setExams) setExams(exams.map(e => e.id === id ? { ...e, isActive: !e.isActive } : e)); triggerSync(); };
  
  // Student Handlers
  const handleAddStudent = () => { if (!newStudent.name || !newStudent.class || !newStudent.nis) return; setStudents([...students, { id: `s-${Date.now()}`, no: students.length + 1, ...newStudent }]); setNewStudent({ name: '', class: '', nis: '', nisn: '' }); alert("Siswa ditambahkan!"); setShowAddStudentModal(false); triggerSync(); };
  const handleDeleteStudent = (id: string) => { if(confirm('Hapus siswa?')) { setStudents(students.filter(s => s.id !== id)); triggerSync(); } };
  
  const handleDownloadTemplateStudent = () => {
    const ws = XLSX.utils.json_to_sheet([{ "Nama": "Contoh Siswa", "Kelas": "VII A", "NIS": "12345", "NISN": "0012345678" }]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Template"); XLSX.writeFile(wb, "Template_Siswa.xlsx");
  };

  const handleImportStudentExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
          const bstr = evt.target?.result; const wb = XLSX.read(bstr, { type: 'binary' }); const wsName = wb.SheetNames[0]; const ws = wb.Sheets[wsName];
          const data = XLSX.utils.sheet_to_json(ws) as any[];
          const imported: Student[] = data.map((row: any, idx: number) => ({ id: `s-imp-${Date.now()}-${idx}`, no: students.length + 1 + idx, name: row['Nama'] || row['nama'], class: row['Kelas'] || row['kelas'], nis: String(row['NIS'] || row['nis']), nisn: String(row['NISN'] || row['nisn'] || '-') }));
          setStudents([...students, ...imported]); alert(`${imported.length} siswa berhasil diimpor.`); triggerSync();
      };
      reader.readAsBinaryString(file); if (studentFileRef.current) studentFileRef.current.value = '';
  };

  const handleEditPacket = (p: QuestionPacket) => {
    setEditingPacketId(p.id);
    setNewPacketName(p.name);
    setNewPacketCategory(p.category);
    setNewPacketTotal(p.totalQuestions);
  };

  const handleSavePacket = () => {
    if (!newPacketName || !newPacketTotal) return;
    const types: Record<number, QuestionType> = {};
    if (editingPacketId) { const existing = packets.find(p => p.id === editingPacketId); Object.assign(types, existing?.questionTypes); } 
    else { for(let i=1; i<= Number(newPacketTotal); i++) types[i] = QuestionType.SINGLE; }
    const updated: QuestionPacket = { id: editingPacketId || `pkt-${Date.now()}`, name: newPacketName, category: newPacketCategory, totalQuestions: Number(newPacketTotal), questionTypes: types };
    if (editingPacketId) { setPackets(packets.map(p => p.id === editingPacketId ? updated : p)); } 
    else { setPackets([...packets, updated]); setSelectedPacketId(updated.id); setBankSubTab('input'); }
    setNewPacketName(''); setNewPacketTotal(''); setEditingPacketId(null); triggerSync();
  };

  const deletePacket = (id: string) => { if (confirm("Hapus paket?")) { setPackets(packets.filter(p => p.id !== id)); setQuestions(questions.filter(q => q.packetId !== id)); triggerSync(); } };

  const handleSaveQuestionSlot = () => {
      if (!selectedPacketId || activeSlot === null) return;
      if (!newQuestionText) { alert("Pertanyaan wajib diisi"); return; }
      
      const qData: Partial<Question> = { 
          packetId: selectedPacketId, 
          number: activeSlot, 
          text: newQuestionText, 
          type: manualType, 
          category: packets.find(p => p.id === selectedPacketId)?.category 
      };

      // Handle Stimulus
      if (stimulusType === 'text') {
          qData.stimulus = newStimulus;
          qData.image = '';
      } else {
          qData.stimulus = '';
          qData.image = newQuestionImage;
      }

      // Handle Answers based on Type
      if (manualType === QuestionType.SINGLE) { 
          qData.options = newOptions; 
          qData.correctAnswerIndex = singleCorrectIndex; 
      }
      else if (manualType === QuestionType.COMPLEX) { 
          qData.options = newOptions; 
          qData.correctAnswerIndices = complexCorrectIndices; 
      }
      else if (manualType === QuestionType.MATCHING) { 
          // For Matching, options are usually labels for columns e.g. "Benar", "Salah" if simple, or we rely on matchingPairs logic
          // Here we assume simple matchingPairs logic.
          qData.options = ['Benar', 'Salah']; 
          qData.matchingPairs = matchingPairs.filter(p => p.left && p.right); 
      }

      if (editingQuestionId) setQuestions(prev => prev.map(q => q.id === editingQuestionId ? { ...q, ...qData } as Question : q));
      else setQuestions(prev => [...prev, { ...qData, id: `q-${Date.now()}` } as Question]);
      
      setPackets(prev => prev.map(p => p.id === selectedPacketId ? { ...p, questionTypes: { ...p.questionTypes, [activeSlot]: manualType } } : p));
      alert(`Soal No. ${activeSlot} tersimpan`); triggerSync();
  };

  const prepareSlotForm = (num: number) => {
      setActiveSlot(num);
      const existingQ = questions.find(q => q.packetId === selectedPacketId && q.number === num);
      const pkt = packets.find(p => p.id === selectedPacketId);
      const type = pkt?.questionTypes[num] || QuestionType.SINGLE;
      setManualType(type);
      
      if (existingQ) {
          setEditingQuestionId(existingQ.id); 
          setNewQuestionText(existingQ.text);
          
          if (existingQ.image) {
              setStimulusType('image');
              setNewQuestionImage(existingQ.image);
              setNewStimulus('');
          } else {
              setStimulusType('text');
              setNewStimulus(existingQ.stimulus || '');
              setNewQuestionImage('');
          }

          if (existingQ.type === QuestionType.SINGLE) { 
              setNewOptions(existingQ.options || ['', '', '', '']); 
              setSingleCorrectIndex(existingQ.correctAnswerIndex || 0); 
          }
          else if (existingQ.type === QuestionType.COMPLEX) { 
              setNewOptions(existingQ.options || ['', '', '', '']); 
              setComplexCorrectIndices(existingQ.correctAnswerIndices || []); 
          }
          else if (existingQ.type === QuestionType.MATCHING) { 
              setMatchingPairs(existingQ.matchingPairs || [{left:'', right:''}]); 
          }
      } else {
          setEditingQuestionId(null); 
          setStimulusType('text'); setNewStimulus(''); setNewQuestionImage(''); setNewQuestionText('');
          
          if (type === QuestionType.MATCHING) { 
              setMatchingPairs([{left:'', right:''}]); 
          } else { 
              setNewOptions(['', '', '', '']); 
              setSingleCorrectIndex(0); 
              setComplexCorrectIndices([]); 
          }
      }
  };

  const handleDownloadAnalysisExcel = () => {
      if(!selectedExamForAnalysis) return;
      const stats = selectedExamForAnalysis.questions.map((q, idx) => {
          const a = getItemAnalysis(q.id, q);
          return { "No": idx+1, "Pertanyaan": q.text, "Benar": a.correctCount, "Total": a.totalAttempts, "Persen": a.correctRate.toFixed(0)+'%', "Dist_A": a.answerDist[0], "Dist_B": a.answerDist[1], "Dist_C": a.answerDist[2], "Dist_D": a.answerDist[3] };
      });
      const ws = XLSX.utils.json_to_sheet(stats); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Analisis"); XLSX.writeFile(wb, "Analisis.xlsx");
  };

  const handleDownloadRecapExcel = () => {
      if(!selectedExamForAnalysis) return;
      const results = examResults.filter(r => r.examId === selectedExamIdForAnalysis);
      const data = results.map((r, i) => ({ "No": i+1, "Nama": r.studentName, "Kelas": r.studentClass, "Nilai": r.score.toFixed(2), "Waktu": new Date(r.timestamp).toLocaleString() }));
      const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Rekap"); XLSX.writeFile(wb, "Rekap_Nilai.xlsx");
  };

  // --- RENDER ---
  if (activeTab === 'dashboard') {
    return (
      <div className="p-8 h-full overflow-y-auto">
        <h2 className="text-3xl font-black mb-6 text-white uppercase tracking-wider flex items-center gap-3"><span className="w-2 h-8 bg-yellow-500 block"></span>Dashboard {userRole === Role.ADMIN ? 'Admin' : (userRole === Role.TEACHER_LITERASI ? 'Guru Literasi' : 'Guru Numerasi')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/80 p-6 border border-white/10"><h3 className="text-sm font-bold text-slate-400 uppercase">Total Siswa</h3><p className="text-5xl font-black text-blue-500">{students.length}</p></div>
          <div className="bg-slate-900/80 p-6 border border-white/10"><h3 className="text-sm font-bold text-slate-400 uppercase">Total Paket Soal</h3><p className="text-5xl font-black text-purple-500">{packets.length}</p></div>
          <div className="bg-slate-900/80 p-6 border border-white/10"><h3 className="text-sm font-bold text-slate-400 uppercase">Ujian Aktif</h3><p className="text-5xl font-black text-green-500">{exams.filter(e => e.isActive).length}</p></div>
        </div>
      </div>
    );
  }

  if (activeTab === 'settings') {
      return (
          <div className="p-8 h-full overflow-y-auto">
              <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-wider mb-6"><Settings className="text-yellow-500"/> Pengaturan</h2>
              <div className="max-w-2xl bg-slate-900/80 border border-white/10 p-8 rounded-lg">
                  <div className="space-y-4">
                      <div><label className="text-xs font-bold text-blue-400 uppercase block mb-1">Nama Sekolah</label><input type="text" className="w-full bg-black/50 border border-slate-700 p-3 text-white text-sm" value={schoolSettings?.schoolName} onChange={e => setSchoolSettings && setSchoolSettings({...schoolSettings!, schoolName: e.target.value})} /></div>
                      <div><label className="text-xs font-bold text-blue-400 uppercase block mb-1">Judul Login (CBT)</label><input type="text" className="w-full bg-black/50 border border-slate-700 p-3 text-white text-sm" value={schoolSettings?.cbtTitle || ''} onChange={e => setSchoolSettings && setSchoolSettings({...schoolSettings!, cbtTitle: e.target.value})} /></div>
                      <div><label className="text-xs font-bold text-blue-400 uppercase block mb-1">Password Admin</label><input type="text" className="w-full bg-black/50 border border-slate-700 p-3 text-white text-sm" value={schoolSettings?.adminPassword} onChange={e => setSchoolSettings && setSchoolSettings({...schoolSettings!, adminPassword: e.target.value})} /></div>
                      <div><label className="text-xs font-bold text-blue-400 uppercase block mb-1">Password Guru Literasi</label><input type="text" className="w-full bg-black/50 border border-slate-700 p-3 text-white text-sm" value={schoolSettings?.teacherLiterasiPassword} onChange={e => setSchoolSettings && setSchoolSettings({...schoolSettings!, teacherLiterasiPassword: e.target.value})} /></div>
                      <div><label className="text-xs font-bold text-blue-400 uppercase block mb-1">Password Guru Numerasi</label><input type="text" className="w-full bg-black/50 border border-slate-700 p-3 text-white text-sm" value={schoolSettings?.teacherNumerasiPassword} onChange={e => setSchoolSettings && setSchoolSettings({...schoolSettings!, teacherNumerasiPassword: e.target.value})} /></div>
                      <button className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-black uppercase text-xs" onClick={() => { alert("Disimpan!"); triggerSync(); }}>Simpan</button>
                  </div>
              </div>
          </div>
      );
  }

  if (activeTab === 'analysis') {
      const targetExam = exams.find(e => e.id === selectedExamIdForAnalysis);
      const targetStudents = targetExam ? students.filter(s => targetExam.classTarget.includes(s.class)) : [];
      const filteredTargetStudents = analysisClassFilter ? targetStudents.filter(s => s.class === analysisClassFilter) : targetStudents;
      
      const finishedResults = selectedExamIdForAnalysis ? examResults.filter(r => r.examId === selectedExamIdForAnalysis) : [];
      const finishedStudentIds = new Set(finishedResults.map(r => r.studentId));
      
      const missingStudents = filteredTargetStudents.filter(s => !finishedStudentIds.has(s.id));

      return (
          <div className="p-8 h-full flex flex-col overflow-hidden">
               <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-wider mb-6 flex-none"><BarChart2 className="text-yellow-500"/> Analisis Hasil Ujian</h2>
               <div className="bg-slate-900/80 p-4 border border-white/10 mb-6 flex flex-col md:flex-row gap-4 items-end flex-none">
                   <div className="flex-1 w-full"><label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Pilih Ujian</label><select className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm" value={selectedExamIdForAnalysis} onChange={e => setSelectedExamIdForAnalysis(e.target.value)}>{visibleExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select></div>
                   {(analysisSubTab === 'recap' || analysisSubTab === 'missing') && (
                       <div className="w-full md:w-48">
                           <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Filter Kelas</label>
                           <select className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm" value={analysisClassFilter} onChange={e => setAnalysisClassFilter(e.target.value)}>
                               <option value="">Semua Kelas</option>
                               {CLASS_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                           </select>
                       </div>
                   )}
                   <div className="flex bg-slate-900 border border-slate-700 p-1 rounded shrink-0">
                       <button onClick={() => setAnalysisSubTab('item')} className={`px-4 py-2 text-xs font-bold uppercase rounded ${analysisSubTab === 'item' ? 'bg-yellow-600 text-black' : 'text-slate-400'}`}>Butir Soal</button>
                       <button onClick={() => setAnalysisSubTab('recap')} className={`px-4 py-2 text-xs font-bold uppercase rounded ${analysisSubTab === 'recap' ? 'bg-yellow-600 text-black' : 'text-slate-400'}`}>Rekap Nilai</button>
                       <button onClick={() => setAnalysisSubTab('missing')} className={`px-4 py-2 text-xs font-bold uppercase rounded ${analysisSubTab === 'missing' ? 'bg-yellow-600 text-black' : 'text-slate-400'}`}>Belum Ujian</button>
                   </div>
               </div>
               
               {analysisSubTab === 'item' && (
                   <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0">
                       <div className="mb-4 flex justify-end"><button onClick={handleDownloadAnalysisExcel} className="px-3 py-2 bg-green-700 text-white text-xs font-bold uppercase rounded flex items-center gap-2"><FileSpreadsheet size={14}/> Download Excel</button></div>
                       {selectedExamForAnalysis ? (
                           <div className="grid grid-cols-1 gap-4">{selectedExamForAnalysis.questions.map((q, idx) => { const stats = getItemAnalysis(q.id, q); return (<div key={q.id} className="bg-slate-900 border border-slate-800 p-4 rounded"><div className="flex justify-between items-start mb-2"><span className="font-bold text-yellow-500 text-sm">Soal No. {idx + 1} ({q.type})</span><span className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${stats.correctRate > 70 ? 'bg-green-900 text-green-400' : stats.correctRate > 30 ? 'bg-yellow-900 text-yellow-400' : 'bg-red-900 text-red-400'}`}>{stats.correctRate > 70 ? 'Mudah' : stats.correctRate > 30 ? 'Sedang' : 'Sukar'}</span></div><p className="text-slate-300 text-sm mb-3 bg-black/20 p-2 rounded">{q.text}</p><div className="flex items-center gap-4 text-xs mb-4"><div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-red-500 to-green-500" style={{ width: `${stats.correctRate}%` }}></div></div><span className="font-mono text-white">{stats.correctRate.toFixed(0)}% Benar ({stats.correctCount}/{stats.totalAttempts})</span></div></div>); })}</div>
                       ) : <p className="text-slate-500">Pilih ujian untuk melihat data.</p>}
                   </div>
               )}
               
               {analysisSubTab === 'recap' && (
                   <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0">
                        <div className="mb-4 flex justify-between items-center flex-none">
                            <div className="text-sm text-slate-400">Total: <span className="text-white font-bold">{finishedResults.length}</span> Selesai</div>
                            <button onClick={handleDownloadRecapExcel} className="px-3 py-2 bg-green-700 text-white text-xs font-bold uppercase rounded flex items-center gap-2"><FileSpreadsheet size={14}/> Download Excel</button>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded overflow-hidden flex-none">
                            <table className="w-full text-left text-sm text-slate-300">
                                <thead className="bg-black/50 text-slate-400 text-xs uppercase font-bold"><tr><th className="p-3">No</th><th className="p-3">Nama Siswa</th><th className="p-3">Kelas</th><th className="p-3 text-right">Nilai Akhir</th></tr></thead>
                                <tbody>
                                    {selectedExamIdForAnalysis ? 
                                        finishedResults
                                        .filter(r => !analysisClassFilter || r.studentClass === analysisClassFilter)
                                        .map((r, i) => (
                                            <tr key={i} className="border-b border-slate-800 hover:bg-white/5">
                                                <td className="p-3 text-center w-12">{i+1}</td>
                                                <td className="p-3 font-medium text-white">{r.studentName}</td>
                                                <td className="p-3">{r.studentClass}</td>
                                                <td className="p-3 text-right font-bold text-yellow-500">{r.score.toFixed(1)}</td>
                                            </tr>
                                        )) 
                                        : <tr><td colSpan={4} className="p-8 text-center text-slate-500">Pilih ujian untuk melihat rekap nilai.</td></tr>
                                    }
                                </tbody>
                            </table>
                        </div>
                   </div>
               )}

               {analysisSubTab === 'missing' && (
                   <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0">
                       <div className="mb-4 flex justify-between items-center flex-none">
                           <div className="text-sm text-slate-400">Total Belum Ujian: <span className="text-red-400 font-bold">{missingStudents.length}</span> Siswa</div>
                       </div>
                       <div className="bg-slate-900 border border-slate-800 rounded overflow-hidden flex-none">
                           <table className="w-full text-left text-sm text-slate-300">
                               <thead className="bg-black/50 text-slate-400 text-xs uppercase font-bold"><tr><th className="p-3">No</th><th className="p-3">Nama Siswa</th><th className="p-3">Kelas</th><th className="p-3">NIS</th><th className="p-3">NISN</th></tr></thead>
                               <tbody>
                                   {selectedExamIdForAnalysis ? missingStudents.map((s, i) => (
                                       <tr key={s.id} className="border-b border-slate-800 hover:bg-white/5">
                                           <td className="p-3 text-center w-12">{i+1}</td>
                                           <td className="p-3 font-medium text-white">{s.name}</td>
                                           <td className="p-3">{s.class}</td>
                                           <td className="p-3">{s.nis}</td>
                                           <td className="p-3">{s.nisn}</td>
                                       </tr>
                                   )) : <tr><td colSpan={5} className="p-8 text-center text-slate-500">Pilih ujian untuk melihat data.</td></tr>}
                                   {selectedExamIdForAnalysis && missingStudents.length === 0 && (
                                       <tr><td colSpan={5} className="p-8 text-center text-green-500 font-bold">Semua siswa pada filter ini sudah mengerjakan ujian!</td></tr>
                                   )}
                               </tbody>
                           </table>
                       </div>
                   </div>
               )}
          </div>
      );
  }

  // --- STUDENTS TAB ---
  if (activeTab === 'students') {
      const filteredStudents = selectedClassFilter ? students.filter(s => s.class === selectedClassFilter) : students;
      return (
          <div className="p-8 h-full flex flex-col">
               <div className="flex justify-between items-center mb-6">
                   <h2 className="text-2xl font-black text-white uppercase"><Users className="inline mr-2 text-yellow-500"/> Data Siswa</h2>
                   <div className="flex gap-2">
                       <input type="file" ref={studentFileRef} className="hidden" accept=".xlsx" onChange={handleImportStudentExcel} />
                       <button onClick={handleDownloadTemplateStudent} className="bg-green-700 text-white px-3 py-2 text-xs font-bold uppercase rounded flex items-center gap-2"><Download size={14}/> Template</button>
                       <button onClick={() => studentFileRef.current?.click()} className="bg-blue-700 text-white px-3 py-2 text-xs font-bold uppercase rounded flex items-center gap-2"><Upload size={14}/> Import</button>
                       <button onClick={() => setShowAddStudentModal(true)} className="bg-yellow-600 text-black px-4 py-2 text-xs font-bold uppercase rounded flex items-center gap-2"><Plus size={14}/> Manual</button>
                   </div>
               </div>
               <div className="mb-4 flex gap-4">
                   <select className="bg-slate-900 text-white p-2 text-sm border border-slate-700" value={selectedClassFilter} onChange={e => setSelectedClassFilter(e.target.value)}>
                       <option value="">Semua Kelas</option>
                       {CLASS_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                   <input className="bg-slate-900 text-white p-2 text-sm border border-slate-700 flex-1" placeholder="Cari siswa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
               </div>
               <div className="flex-1 bg-slate-900 border border-white/10 overflow-auto">
                   <table className="w-full text-left text-sm text-slate-300">
                       <thead><tr className="bg-black/50 text-slate-500 uppercase text-xs"><th className="p-3">No</th><th className="p-3">Nama</th><th className="p-3">Kelas</th><th className="p-3">NIS</th><th className="p-3">NISN</th><th className="p-3">Aksi</th></tr></thead>
                       <tbody>
                           {filteredStudents.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).map((s,i) => (
                               <tr key={s.id} className="border-b border-white/5 hover:bg-white/5">
                                   <td className="p-3 text-center w-12">{i+1}</td>
                                   <td className="p-3">{s.name}</td>
                                   <td className="p-3">{s.class}</td>
                                   <td className="p-3">{s.nis}</td>
                                   <td className="p-3">{s.nisn}</td>
                                   <td className="p-3"><button onClick={() => handleDeleteStudent(s.id)} className="text-red-500 hover:text-red-400"><Trash2 size={14}/></button></td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
               {showAddStudentModal && <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"><div className="bg-slate-900 p-6 w-96 border border-white/10"><h3 className="text-white font-bold mb-4">Tambah Siswa</h3><input className="w-full bg-black p-2 mb-2 text-white border border-slate-700" placeholder="Nama" value={newStudent.name} onChange={e=>setNewStudent({...newStudent, name:e.target.value})}/><input className="w-full bg-black p-2 mb-2 text-white border border-slate-700" placeholder="Kelas" value={newStudent.class} onChange={e=>setNewStudent({...newStudent, class:e.target.value})}/><input className="w-full bg-black p-2 mb-2 text-white border border-slate-700" placeholder="NIS" value={newStudent.nis} onChange={e=>setNewStudent({...newStudent, nis:e.target.value})}/><input className="w-full bg-black p-2 mb-4 text-white border border-slate-700" placeholder="NISN" value={newStudent.nisn} onChange={e=>setNewStudent({...newStudent, nisn:e.target.value})}/><div className="flex gap-2"><button onClick={handleAddStudent} className="flex-1 bg-blue-600 text-white py-2 font-bold">Simpan</button><button onClick={()=>setShowAddStudentModal(false)} className="flex-1 bg-slate-700 text-white py-2 font-bold">Batal</button></div></div></div>}
          </div>
      );
  }

  // --- MONITORING TAB (Updated) ---
  if (activeTab === 'monitor') {
      const selectedMonitorExam = exams.find(e => e.id === selectedExamForMonitor);
      // Determine student list based on class target and filter
      const allTargetedStudents = selectedMonitorExam ? students.filter(s => selectedMonitorExam.classTarget.includes(s.class)) : [];
      const targetedStudents = monitoringClassFilter ? allTargetedStudents.filter(s => s.class === monitoringClassFilter) : allTargetedStudents;
      
      // Get Results
      const currentResults = examResults.filter(r => r.examId === selectedExamForMonitor);

      // PREPARE DISPLAY DATA (Filter Status & Sort by Finished then Score)
      const displayData = targetedStudents.map(s => {
          const res = currentResults.find(r => r.studentId === s.id);
          return { ...s, result: res };
      }).filter(item => {
          if (monitoringStatusFilter === 'finished') return !!item.result;
          if (monitoringStatusFilter === 'unfinished') return !item.result;
          return true;
      }).sort((a, b) => {
          // 1. Sort by Status (Finished first)
          const aFinished = !!a.result;
          const bFinished = !!b.result;
          if (aFinished && !bFinished) return -1;
          if (!aFinished && bFinished) return 1;
          
          // 2. Sort by Score (High to Low) if both finished
          if (aFinished && bFinished) {
              return (b.result?.score || 0) - (a.result?.score || 0);
          }
          return 0; // Keep original order for unfinished
      });

      // Cheating Analysis
      const suspiciousCount = displayData.filter(i => i.result && (i.result.violationCount! > 0 || i.result.isDisqualified)).length;

      return (
          <div className="p-8 h-full flex flex-col">
              <h2 className="text-2xl font-black text-white uppercase mb-6"><Activity className="inline mr-2 text-yellow-500"/> Live Monitoring</h2>
              
              {/* Alert Notification for Cheating */}
              {suspiciousCount > 0 && (
                  <div className="bg-red-900/50 border border-red-500 p-4 mb-6 rounded flex items-center gap-4 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                      <AlertOctagon size={32} className="text-red-500" />
                      <div>
                          <h3 className="font-bold text-white uppercase tracking-wider text-sm">Terdeteksi Kecurangan!</h3>
                          <p className="text-sm text-red-200">Ada <span className="font-black text-white">{suspiciousCount}</span> siswa yang terdeteksi melakukan pelanggaran atau didiskualifikasi.</p>
                      </div>
                  </div>
              )}

              <div className="mb-6 flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                      <label className="text-xs font-bold text-blue-400 uppercase block mb-1">Pilih Ujian Aktif</label>
                      <select className="w-full bg-slate-900 border border-slate-700 text-white p-2" value={selectedExamForMonitor} onChange={e => setSelectedExamForMonitor(e.target.value)}>
                          {visibleExams.map(e => <option key={e.id} value={e.id}>{e.title} ({e.isActive ? 'Aktif' : 'Non-Aktif'})</option>)}
                      </select>
                  </div>
                  <div className="w-full md:w-48">
                      <label className="text-xs font-bold text-blue-400 uppercase block mb-1">Filter Kelas</label>
                      <select className="w-full bg-slate-900 border border-slate-700 text-white p-2" value={monitoringClassFilter} onChange={e => setMonitoringClassFilter(e.target.value)}>
                          <option value="">Semua Kelas</option>
                          {CLASS_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                  </div>
                  <div className="w-full md:w-48">
                      <label className="text-xs font-bold text-blue-400 uppercase block mb-1">Status</label>
                      <select className="w-full bg-slate-900 border border-slate-700 text-white p-2" value={monitoringStatusFilter} onChange={e => setMonitoringStatusFilter(e.target.value as any)}>
                          <option value="all">Semua Status</option>
                          <option value="finished">Sudah Selesai</option>
                          <option value="unfinished">Belum Mengerjakan</option>
                      </select>
                  </div>
              </div>

              {selectedMonitorExam ? (
                  <div className="flex-1 bg-slate-900 border border-white/10 overflow-auto">
                      <div className="p-4 border-b border-white/10 flex gap-6 text-sm">
                          <div className="text-slate-400">Total Peserta: <span className="text-white font-bold">{targetedStudents.length}</span></div>
                          <div className="text-slate-400">Sudah Mengerjakan: <span className="text-green-400 font-bold">{targetedStudents.filter(s => currentResults.some(r => r.studentId === s.id)).length}</span></div>
                          <div className="text-slate-400">Belum: <span className="text-slate-500 font-bold">{targetedStudents.filter(s => !currentResults.some(r => r.studentId === s.id)).length}</span></div>
                      </div>
                      <table className="w-full text-left text-sm text-slate-300">
                          <thead className="bg-black/50 text-slate-500 uppercase text-xs">
                              <tr>
                                  <th className="p-3">No</th>
                                  <th className="p-3">Nama Siswa</th>
                                  <th className="p-3">Kelas</th>
                                  <th className="p-3">Status</th>
                                  <th className="p-3">Nilai</th>
                                  <th className="p-3">Waktu Submit</th>
                              </tr>
                          </thead>
                          <tbody>
                              {displayData.map((item, idx) => {
                                  const res = item.result;
                                  return (
                                      <tr key={item.id} className="border-b border-white/5 hover:bg-white/5">
                                          <td className="p-3 w-12 text-center">{idx + 1}</td>
                                          <td className="p-3 font-medium text-white">{item.name}</td>
                                          <td className="p-3">{item.class}</td>
                                          <td className="p-3">
                                              {res?.isDisqualified ? (
                                                  <span className="bg-red-600 text-white px-2 py-1 text-[10px] font-black uppercase rounded flex items-center w-fit gap-1"><ShieldAlert size={10}/> DISKUALIFIKASI</span>
                                              ) : res?.violationCount && res.violationCount > 0 ? (
                                                  <span className="bg-orange-600 text-white px-2 py-1 text-[10px] font-black uppercase rounded flex items-center w-fit gap-1"><AlertTriangle size={10}/> PELANGGARAN: {res.violationCount}</span>
                                              ) : res ? (
                                                   <span className="bg-green-600 text-white px-2 py-1 text-[10px] font-black uppercase rounded flex items-center w-fit gap-1"><Check size={10}/> AMAN</span>
                                              ) : (
                                                   <span className="bg-slate-700 text-slate-400 px-2 py-1 text-[10px] font-bold uppercase rounded">BELUM</span>
                                              )}
                                          </td>
                                          <td className="p-3 font-mono font-bold text-yellow-500">{res ? res.score.toFixed(1) : '-'}</td>
                                          <td className="p-3 text-xs text-slate-400">{res ? new Date(res.timestamp).toLocaleTimeString() : '-'}</td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>
              ) : <p className="text-slate-500">Pilih ujian untuk memonitor.</p>}
          </div>
      );
  }

  // --- BANK SOAL TAB (Enhanced & Scroll Fixed) ---
  if (activeTab === 'questions') {
    return (
      <div className="p-8 flex flex-col h-full overflow-hidden">
         <div className="flex justify-between items-center mb-6 flex-none border-b border-white/10 pb-4">
             <div className="flex items-center gap-4">
                 <h2 className="text-2xl font-black text-white uppercase"><BookOpen className="inline mr-2 text-yellow-500"/> Bank Soal</h2>
                 <div className="flex bg-slate-800 rounded border border-slate-700">
                     <button onClick={() => setBankSubTab('config')} className={`px-4 py-2 text-xs font-bold uppercase transition-all ${bankSubTab==='config'?'bg-blue-600 text-white':'text-slate-400 hover:text-white'}`}>Paket</button>
                     <button onClick={() => setBankSubTab('input')} className={`px-4 py-2 text-xs font-bold uppercase transition-all ${bankSubTab==='input'?'bg-blue-600 text-white':'text-slate-400 hover:text-white'}`}>Input Soal</button>
                 </div>
             </div>
             
             {/* Import/Template Actions */}
             <div className="flex gap-2">
                 <input type="file" ref={questionFileRef} className="hidden" accept=".xlsx" onChange={handleImportQuestions} />
                 <button onClick={handleDownloadTemplateQuestion} className="bg-slate-800 text-slate-300 border border-slate-600 px-3 py-2 text-xs font-bold uppercase rounded flex items-center gap-2 hover:bg-slate-700 transition-colors"><Download size={14}/> Template</button>
                 <button onClick={() => questionFileRef.current?.click()} className="bg-green-700 text-white px-3 py-2 text-xs font-bold uppercase rounded flex items-center gap-2 hover:bg-green-600 transition-colors shadow-lg"><Upload size={14}/> Import Excel</button>
             </div>
         </div>
         
         {bankSubTab === 'config' && (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden min-h-0">
                 <div className="bg-slate-900 p-6 border border-white/10 h-fit">
                     <h3 className="font-bold text-white mb-4">{editingPacketId ? 'Edit Paket' : 'Buat Paket'}</h3>
                     <input className="w-full bg-black p-2 mb-2 text-white border border-slate-700" placeholder="Nama" value={newPacketName} onChange={e=>setNewPacketName(e.target.value)}/>
                     <select className="w-full bg-black p-2 mb-2 text-white border border-slate-700" value={newPacketCategory} onChange={(e) => setNewPacketCategory(e.target.value as QuestionCategory)} disabled={userRole !== Role.ADMIN}><option value={QuestionCategory.LITERASI}>Literasi</option><option value={QuestionCategory.NUMERASI}>Numerasi</option></select>
                     <input type="number" className="w-full bg-black p-2 mb-4 text-white border border-slate-700" placeholder="Total Soal" value={newPacketTotal} onChange={e=>setNewPacketTotal(parseInt(e.target.value))}/>
                     <button onClick={handleSavePacket} className="w-full bg-blue-600 text-white py-2 font-bold">{editingPacketId ? 'Update' : 'Simpan'}</button>
                     {editingPacketId && <button onClick={() => { setEditingPacketId(null); setNewPacketName(''); setNewPacketTotal(''); }} className="w-full bg-slate-700 text-white py-2 font-bold mt-2">Batal</button>}
                 </div>
                 <div className="lg:col-span-2 overflow-auto space-y-2">{visiblePackets.map(p=>(
                     <div key={p.id} className="bg-slate-900 border border-slate-700 p-3 flex justify-between items-center">
                         <div><p className="text-white font-bold">{p.name}</p><p className="text-xs text-slate-500">{p.category} | {p.totalQuestions} Soal</p></div>
                         <div className="flex gap-2">
                             <button onClick={() => handleEditPacket(p)} className="text-yellow-500 hover:text-yellow-400"><Edit2 size={16}/></button>
                             <button onClick={()=>deletePacket(p.id)} className="text-red-500 hover:text-red-400"><Trash2 size={16}/></button>
                         </div>
                     </div>
                 ))}</div>
             </div>
         )}
         {bankSubTab === 'input' && (
             <div className="flex-1 flex flex-col min-h-0">
                 <select className="w-full bg-slate-900 border border-slate-700 p-2 text-white mb-4 flex-none" value={selectedPacketId} onChange={e => {setSelectedPacketId(e.target.value); setActiveSlot(null);}}><option value="">Pilih Paket Soal</option>{visiblePackets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                 {selectedPacketId && (
                     <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 overflow-hidden min-h-0">
                         <div className="bg-slate-900 border border-white/10 overflow-auto p-2"><div className="grid grid-cols-5 gap-1">{Array.from({length: visiblePackets.find(p=>p.id===selectedPacketId)?.totalQuestions||0}).map((_,i)=><button key={i} onClick={()=>prepareSlotForm(i+1)} className={`p-2 text-xs font-bold border ${activeSlot===i+1?'bg-yellow-500 text-black':'text-slate-400 border-slate-700'}`}>{i+1}</button>)}</div></div>
                         <div className="lg:col-span-3 bg-slate-900 border border-white/10 p-4 overflow-y-auto flex flex-col min-h-0">
                             {activeSlot ? (
                                 <div className="space-y-4 flex-1">
                                     <div className="flex justify-between"><h3 className="text-white font-bold">Edit Soal {activeSlot}</h3><select className="bg-black text-white p-1 text-xs" value={manualType} onChange={e=>setManualType(e.target.value as QuestionType)}><option value={QuestionType.SINGLE}>Pilihan Ganda</option><option value={QuestionType.COMPLEX}>PG Kompleks</option><option value={QuestionType.MATCHING}>Menjodohkan</option></select></div>
                                     
                                     {/* STIMULUS SECTION */}
                                     <div className="space-y-2 border-b border-slate-700 pb-4">
                                         <div className="flex gap-2 mb-2">
                                             <button onClick={() => setStimulusType('text')} className={`text-xs px-3 py-1 rounded ${stimulusType === 'text' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Teks</button>
                                             <button onClick={() => setStimulusType('image')} className={`text-xs px-3 py-1 rounded ${stimulusType === 'image' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Gambar</button>
                                         </div>
                                         
                                         {stimulusType === 'text' ? (
                                             <textarea className="w-full bg-black p-2 text-white border border-slate-700 font-serif leading-relaxed" rows={4} placeholder="Masukkan teks stimulus di sini..." value={newStimulus} onChange={e=>setNewStimulus(e.target.value)}/>
                                         ) : (
                                             <div className="space-y-2">
                                                 <input type="file" accept="image/*" ref={imageUploadRef} onChange={handleImageUpload} className="hidden" />
                                                 <div className="flex gap-2">
                                                     <button onClick={() => imageUploadRef.current?.click()} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 text-xs rounded flex items-center gap-2 border border-slate-600"><Upload size={14}/> Upload Gambar</button>
                                                     {newQuestionImage && <button onClick={() => setNewQuestionImage('')} className="text-red-500 text-xs">Hapus</button>}
                                                 </div>
                                                 {newQuestionImage && <img src={newQuestionImage} alt="Stimulus" className="max-h-40 object-contain border border-slate-700 bg-black/50 rounded"/>}
                                             </div>
                                         )}
                                     </div>

                                     {/* QUESTION TEXT */}
                                     <div className="space-y-2">
                                         <label className="text-xs text-slate-400">Pertanyaan</label>
                                         <textarea className="w-full bg-black p-2 text-white border border-slate-700 font-medium" rows={3} placeholder="Pertanyaan..." value={newQuestionText} onChange={e=>setNewQuestionText(e.target.value)}/>
                                     </div>
                                     
                                     {/* ANSWER INPUTS */}
                                     <div className="border-t border-slate-700 pt-4">
                                         <label className="text-xs text-slate-400 block mb-2">Jawaban ({manualType})</label>
                                         
                                         {manualType === QuestionType.SINGLE && newOptions.map((o,i)=>(
                                             <div key={i} className="flex gap-2 mb-2">
                                                 <button onClick={()=>setSingleCorrectIndex(i)} className={`w-8 h-8 flex items-center justify-center border ${singleCorrectIndex===i?'bg-green-600 border-green-500 text-white':'bg-slate-800 border-slate-700 text-slate-500'}`}>{String.fromCharCode(65+i)}</button>
                                                 <input className="flex-1 bg-black p-1 text-white text-sm border border-slate-700" value={o} onChange={e=>{const c=[...newOptions];c[i]=e.target.value;setNewOptions(c)}}/>
                                             </div>
                                         ))}

                                         {manualType === QuestionType.COMPLEX && newOptions.map((o,i)=>(
                                             <div key={i} className="flex gap-2 mb-2">
                                                 <button 
                                                     onClick={() => {
                                                         if (complexCorrectIndices.includes(i)) setComplexCorrectIndices(complexCorrectIndices.filter(idx => idx !== i));
                                                         else setComplexCorrectIndices([...complexCorrectIndices, i]);
                                                     }} 
                                                     className={`w-8 h-8 flex items-center justify-center border ${complexCorrectIndices.includes(i) ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                                                 >
                                                     <Check size={14} className={complexCorrectIndices.includes(i) ? 'opacity-100' : 'opacity-0'}/>
                                                 </button>
                                                 <input className="flex-1 bg-black p-1 text-white text-sm border border-slate-700" value={o} onChange={e=>{const c=[...newOptions];c[i]=e.target.value;setNewOptions(c)}}/>
                                             </div>
                                         ))}

                                         {manualType === QuestionType.MATCHING && (
                                             <div className="space-y-2">
                                                 {matchingPairs.map((pair, idx) => (
                                                     <div key={idx} className="flex gap-2 items-center">
                                                         <input className="flex-1 bg-black p-1 text-white text-sm border border-slate-700" placeholder="Pernyataan Kiri" value={pair.left} onChange={e => {const n = [...matchingPairs]; n[idx].left = e.target.value; setMatchingPairs(n)}} />
                                                         <ArrowRight size={14} className="text-slate-500"/>
                                                         <input className="flex-1 bg-black p-1 text-white text-sm border border-slate-700" placeholder="Pasangan Kanan" value={pair.right} onChange={e => {const n = [...matchingPairs]; n[idx].right = e.target.value; setMatchingPairs(n)}} />
                                                         <button onClick={() => setMatchingPairs(matchingPairs.filter((_, i) => i !== idx))} className="text-red-500"><X size={14}/></button>
                                                     </div>
                                                 ))}
                                                 <button onClick={() => setMatchingPairs([...matchingPairs, {left:'', right:''}])} className="text-xs text-blue-400 font-bold">+ Tambah Baris</button>
                                             </div>
                                         )}
                                     </div>

                                     {/* PREVIEW BOX */}
                                     <div className="mt-6 bg-slate-800/50 p-4 border border-slate-700 rounded-lg">
                                         <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Preview Tampilan Soal</p>
                                         {stimulusType === 'image' && newQuestionImage && <img src={newQuestionImage} className="max-h-32 mb-2 rounded border border-slate-600"/>}
                                         {stimulusType === 'text' && newStimulus && <p className="text-sm text-slate-300 mb-2 italic bg-black/20 p-2 border-l-2 border-blue-500 whitespace-pre-wrap">{newStimulus}</p>}
                                         <p className="text-white font-bold text-sm">{newQuestionText || "[Teks Pertanyaan]"}</p>
                                         
                                         {/* OPTION PREVIEW */}
                                         {manualType === QuestionType.SINGLE && (
                                             <div className="mt-3 space-y-2">
                                                 {newOptions.map((opt, i) => (
                                                     <div key={i} className={`p-2 rounded border text-xs flex items-center gap-2 ${singleCorrectIndex === i ? 'bg-green-900/30 border-green-600 text-green-400' : 'border-slate-700 text-slate-400'}`}>
                                                         <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${singleCorrectIndex === i ? 'border-green-500 bg-green-500 text-black' : 'border-slate-500'}`}>
                                                             {singleCorrectIndex === i && <div className="w-2 h-2 bg-black rounded-full" />}
                                                         </div>
                                                         <span>{opt || `Opsi ${String.fromCharCode(65+i)}`}</span>
                                                     </div>
                                                 ))}
                                             </div>
                                         )}
                                         {manualType === QuestionType.COMPLEX && (
                                             <div className="mt-3 space-y-2">
                                                 {newOptions.map((opt, i) => (
                                                     <div key={i} className={`p-2 rounded border text-xs flex items-center gap-2 ${complexCorrectIndices.includes(i) ? 'bg-blue-900/30 border-blue-600 text-blue-400' : 'border-slate-700 text-slate-400'}`}>
                                                         <div className={`w-4 h-4 rounded border flex items-center justify-center ${complexCorrectIndices.includes(i) ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-500'}`}>
                                                              {complexCorrectIndices.includes(i) && <Check size={10} />}
                                                         </div>
                                                         <span>{opt || `Opsi ${i+1}`}</span>
                                                     </div>
                                                 ))}
                                             </div>
                                         )}
                                         {manualType === QuestionType.MATCHING && (
                                             <div className="mt-3 bg-slate-900 border border-slate-700 rounded p-2">
                                                 <table className="w-full text-xs text-slate-300">
                                                     <thead><tr><th className="text-left p-1 text-slate-500">Kiri</th><th className="p-1"></th><th className="text-left p-1 text-slate-500">Kanan</th></tr></thead>
                                                     <tbody>
                                                         {matchingPairs.map((pair, i) => (
                                                             <tr key={i} className="border-b border-slate-800 last:border-0">
                                                                 <td className="p-2">{pair.left || '-'}</td>
                                                                 <td className="p-2 text-center text-slate-600"><ArrowRight size={12}/></td>
                                                                 <td className="p-2">{pair.right || '-'}</td>
                                                             </tr>
                                                         ))}
                                                     </tbody>
                                                 </table>
                                             </div>
                                         )}
                                     </div>

                                     <button onClick={handleSaveQuestionSlot} className="w-full bg-blue-600 text-white py-3 font-bold text-xs uppercase mt-4">Simpan Soal</button>
                                 </div>
                             ) : <p className="text-slate-500 text-center mt-10">Pilih nomor soal untuk mulai mengedit.</p>}
                         </div>
                     </div>
                 )}
             </div>
         )}
      </div>
    );
  }

  if (activeTab === 'exams') {
      return (
          <div className="p-8 h-full flex flex-col">
              <h2 className="text-2xl font-black text-white uppercase mb-6"><CalendarClock className="inline mr-2 text-yellow-500"/> Jadwal Ujian</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
                  <div className="bg-slate-900 p-6 border border-white/10 h-fit">
                      <h3 className="font-bold text-white mb-4">Buat Jadwal</h3>
                      <input className="w-full bg-black p-2 mb-2 text-white border border-slate-700" placeholder="Nama Ujian" value={newExamTitle} onChange={e=>setNewExamTitle(e.target.value)}/>
                      <select className="w-full bg-black p-2 mb-2 text-white border border-slate-700" value={newExamPacketId} onChange={e=>setNewExamPacketId(e.target.value)}><option value="">Pilih Paket</option>{visiblePackets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
                      <div className="flex gap-2 mb-2"><input type="datetime-local" className="bg-black text-white text-xs p-1 w-1/2" value={newExamStart} onChange={e=>setNewExamStart(e.target.value)}/><input type="datetime-local" className="bg-black text-white text-xs p-1 w-1/2" value={newExamEnd} onChange={e=>setNewExamEnd(e.target.value)}/></div>
                      <div className="mb-2"><input type="number" className="bg-black text-white text-xs p-2 w-full border border-slate-700" placeholder="Durasi (Menit)" value={newExamDuration} onChange={e=>setNewExamDuration(parseInt(e.target.value))}/></div>
                      <div className="grid grid-cols-3 gap-2 mb-4">{CLASS_LIST.map(c=><button key={c} onClick={()=>{if(newExamClasses.includes(c))setNewExamClasses(newExamClasses.filter(x=>x!==c));else setNewExamClasses([...newExamClasses,c])}} className={`text-[10px] border p-1 ${newExamClasses.includes(c)?'bg-yellow-600 text-black':'text-slate-400'}`}>{c}</button>)}</div>
                      <button onClick={handleCreateExam} className="w-full bg-blue-600 text-white py-2 font-bold">Jadwalkan</button>
                  </div>
                  <div className="lg:col-span-2 overflow-auto space-y-3">
                      {visibleExams.map(e => {
                          const pkt = packets.find(p => p.id === e.packetId);
                          return (
                              <div key={e.id} className={`bg-slate-900 border p-4 flex justify-between ${e.isActive?'border-green-500':'border-slate-700'}`}>
                                  <div>
                                      <h4 className="font-bold text-white text-lg">{e.title}</h4>
                                      <div className="flex items-center gap-2 mb-1 mt-1">
                                          <span className="bg-yellow-900 text-yellow-500 border border-yellow-700 px-2 py-0.5 text-[10px] uppercase font-bold rounded">{pkt?.name || 'Paket Tidak Dikenal'}</span>
                                          <span className="bg-purple-900 text-purple-400 border border-purple-700 px-2 py-0.5 text-[10px] uppercase font-bold rounded">{pkt?.category || '-'}</span>
                                      </div>
                                      <p className="text-xs text-slate-400 mb-1">{e.classTarget.join(', ')} <span className="text-slate-600 mx-2">|</span> {e.durationMinutes} Menit</p>
                                      <p className="text-[10px] text-slate-500 font-mono">{formatDateRange(e.scheduledStart, e.scheduledEnd)}</p>
                                  </div>
                                  <div className="flex gap-2 items-start">
                                      <button onClick={()=>toggleExamStatus(e.id)} className={`text-xs px-2 py-1 ${e.isActive?'bg-red-900 text-red-400':'bg-green-900 text-green-400'}`}>{e.isActive?'STOP':'START'}</button>
                                      <button onClick={()=>handleDeleteExam(e.id)} className="text-red-500"><Trash2 size={16}/></button>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
          </div>
      );
  }

  return null;
};