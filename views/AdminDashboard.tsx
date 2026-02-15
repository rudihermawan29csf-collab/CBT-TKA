import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Student, Teacher, Question, QuestionType, QuestionCategory, QuestionPacket, Exam, Role, SchoolSettings, ExamResult } from '../types';
import { Upload, Download, Trash2, Search, Brain, Save, Settings, Plus, X, List, Layout, FileSpreadsheet, Check, Eye, ChevronLeft, ChevronRight, HelpCircle, Edit2, ImageIcon, Users, UserPlus, BarChart2, TrendingUp, AlertTriangle, Table, PieChart, Layers, FileText, ArrowRight, CalendarClock, PlayCircle, StopCircle, Clock, Activity, RefreshCw, BookOpen, GraduationCap, AlignLeft, Image as LucideImage, AlertOctagon, ShieldAlert, Filter, Smartphone, FileImage, UserX, Sigma, Calculator, Divide, X as MultiplyIcon, Link, RefreshCcw, Key } from 'lucide-react';
import { CLASS_LIST } from '../constants';
import * as XLSX from 'xlsx';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

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
  onUploadImage?: (base64: string, filename: string) => Promise<string>;
  currentScriptUrl?: string; 
  onUpdateScriptUrl?: (url: string) => void; 
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  userRole = Role.ADMIN, students, setStudents, teachers, setTeachers, questions, setQuestions, exams = [], setExams, activeTab,
  packets, setPackets, schoolSettings, setSchoolSettings, onSyncData, examResults = [], onUploadImage, currentScriptUrl, onUpdateScriptUrl
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const studentFileRef = useRef<HTMLInputElement>(null);
  const questionFileRef = useRef<HTMLInputElement>(null);
  const imageUploadRef = useRef<HTMLInputElement>(null);
  
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
  const [newQuestionImage, setNewQuestionImage] = useState(''); // Stores Base64 OR URL
  const [isImageUploading, setIsImageUploading] = useState(false);
  
  // Options State
  const [newOptions, setNewOptions] = useState<string[]>(['', '', '', '']);
  const [singleCorrectIndex, setSingleCorrectIndex] = useState(0);
  const [complexCorrectIndices, setComplexCorrectIndices] = useState<number[]>([]);
  const [matchingPairs, setMatchingPairs] = useState<{left: string, right: string}[]>([{left: '', right: ''}]);

  // --- MATH TOOLBAR STATE ---
  const [lastFocusedField, setLastFocusedField] = useState<{
      name: 'stimulus' | 'question' | 'option' | 'pair-left' | 'pair-right';
      index?: number; 
      cursorPos?: number;
  } | null>(null);

  // --- Exam Management State ---
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamCategory, setNewExamCategory] = useState<QuestionCategory>(QuestionCategory.LITERASI); 
  const [newExamPacketId, setNewExamPacketId] = useState('');
  const [newExamDuration, setNewExamDuration] = useState(120); // Default 120 minutes as requested
  const [newExamClasses, setNewExamClasses] = useState<string[]>([]);
  const [newExamStart, setNewExamStart] = useState('');
  const [newExamEnd, setNewExamEnd] = useState('');

  // --- MONITORING STATE ---
  const [selectedExamForMonitor, setSelectedExamForMonitor] = useState<string>('');
  const [monitoringClassFilter, setMonitoringClassFilter] = useState<string>('');
  const [monitoringStatusFilter, setMonitoringStatusFilter] = useState<'all' | 'finished' | 'unfinished' | 'suspicious'>('all');

  // --- Analysis State ---
  const [analysisSubTab, setAnalysisSubTab] = useState<'item' | 'recap' | 'missing'>('item');
  const [selectedExamIdForAnalysis, setSelectedExamIdForAnalysis] = useState<string>('');

  // --- MEMOIZED FILTERS (ROLE BASED) ---
  const visiblePackets = useMemo(() => {
    const safePackets = packets || [];
    if (userRole === Role.ADMIN) return safePackets;
    if (userRole === Role.TEACHER_LITERASI) return safePackets.filter(p => p?.category === QuestionCategory.LITERASI);
    if (userRole === Role.TEACHER_NUMERASI) return safePackets.filter(p => p?.category === QuestionCategory.NUMERASI);
    return [];
  }, [packets, userRole]);

  const visibleExams = useMemo(() => {
     if (userRole === Role.ADMIN) return exams || [];
     const visiblePacketIds = (visiblePackets || []).map(p => p?.id).filter(Boolean);
     return (exams || []).filter(e => e && visiblePacketIds.includes(e.packetId));
  }, [exams, visiblePackets, userRole]);

  useEffect(() => {
      if (visibleExams.length > 0 && !selectedExamIdForAnalysis) setSelectedExamIdForAnalysis(visibleExams[0].id);
      if (visibleExams.length > 0 && !selectedExamForMonitor) setSelectedExamForMonitor(visibleExams[0].id);
  }, [exams, visibleExams]);

  const selectedExamForAnalysis = useMemo(() => exams.find(e => e.id === selectedExamIdForAnalysis), [exams, selectedExamIdForAnalysis]);

  useEffect(() => {
      if (userRole === Role.TEACHER_LITERASI) {
          setNewPacketCategory(QuestionCategory.LITERASI);
          setNewExamCategory(QuestionCategory.LITERASI);
      }
      else if (userRole === Role.TEACHER_NUMERASI) {
          setNewPacketCategory(QuestionCategory.NUMERASI);
          setNewExamCategory(QuestionCategory.NUMERASI);
      }
  }, [userRole]);

  // --- HELPER FUNCTIONS ---
  const cleanWordHtml = (html: string) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || "";
  };

  const handleInsertMath = (latex: string) => {
      if (!lastFocusedField) {
          setNewQuestionText(prev => prev + latex);
          return;
      }
      const { name, index } = lastFocusedField;
      if (name === 'stimulus') setNewStimulus(prev => prev + latex);
      else if (name === 'question') setNewQuestionText(prev => prev + latex);
      else if (name === 'option' && typeof index === 'number') {
          const updated = [...newOptions];
          updated[index] = (updated[index] || '') + latex;
          setNewOptions(updated);
      } else if (name === 'pair-left' && typeof index === 'number') {
          const updated = [...matchingPairs];
          updated[index].left = (updated[index].left || '') + latex;
          setMatchingPairs(updated);
      }
  };
  
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

  // Handle Image Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = async (event) => {
              const img = new Image();
              img.onload = async () => {
                  const canvas = document.createElement('canvas');
                  let width = img.width;
                  let height = img.height;
                  const MAX_SIZE = 600; 
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
                  if (ctx) {
                      ctx.fillStyle = "#FFFFFF";
                      ctx.fillRect(0, 0, width, height);
                      ctx.drawImage(img, 0, 0, width, height);
                      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                      
                      if (onUploadImage) {
                          setIsImageUploading(true);
                          try {
                              const filename = `img_${Date.now()}.jpg`;
                              const driveUrl = await onUploadImage(dataUrl, filename);
                              setNewQuestionImage(driveUrl);
                              alert("Gambar berhasil diupload ke Google Drive!");
                          } catch (error: any) {
                              const useOffline = confirm("Gagal upload ke Server (Izin DriveApp/Error).\n\nGunakan gambar dalam mode offline (Lokal)?");
                              if (useOffline) {
                                  setNewQuestionImage(dataUrl); 
                              } else {
                                  setNewQuestionImage(''); 
                              }
                          } finally {
                              setIsImageUploading(false);
                              if (imageUploadRef.current) imageUploadRef.current.value = '';
                          }
                      } else {
                          setNewQuestionImage(dataUrl);
                      }
                  }
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
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }).slice(1) as any[][];
      const packet = packets.find(p => p.id === selectedPacketId);
      const packetCategory = packet ? packet.category : QuestionCategory.LITERASI;
      const imported: Question[] = rows
        .filter(row => row[0])
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

  const handleCreateExam = () => {
    if (!newExamTitle || !newExamPacketId || !newExamStart || !newExamEnd || newExamClasses.length === 0) { alert("Lengkapi data ujian."); return; }
    const packet = packets.find(p => p.id === newExamPacketId);
    const maxQuestions = packet ? packet.totalQuestions : 999;
    const pktQuestions = questions
        .filter(q => q.packetId === newExamPacketId && (q.number || 0) <= maxQuestions)
        .sort((a, b) => (a.number || 0) - (b.number || 0));
    if (pktQuestions.length === 0) { alert("Paket soal kosong."); return; }
    const newExam: Exam = { id: `exam-${Date.now()}`, title: newExamTitle, packetId: newExamPacketId, durationMinutes: newExamDuration, classTarget: newExamClasses, scheduledStart: newExamStart, scheduledEnd: newExamEnd, questions: pktQuestions, isActive: true };
    if (setExams) setExams([...exams, newExam]);
    alert("Ujian dijadwalkan!"); setNewExamTitle(''); setNewExamPacketId(''); setNewExamClasses([]); setNewExamStart(''); setNewExamEnd(''); triggerSync();
  };

  const handleDeleteExam = (id: string) => { if (confirm('Hapus jadwal?')) { if (setExams) setExams(exams.filter(e => e.id !== id)); triggerSync(); } };
  const toggleExamStatus = (id: string) => { if (setExams) setExams(exams.map(e => e.id === id ? { ...e, isActive: !e.isActive } : e)); triggerSync(); };
  
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

      if (stimulusType === 'text') { qData.stimulus = newStimulus; qData.image = ''; } 
      else { qData.stimulus = ''; qData.image = newQuestionImage; }

      if (manualType === QuestionType.SINGLE) { qData.options = newOptions; qData.correctAnswerIndex = singleCorrectIndex; }
      else if (manualType === QuestionType.COMPLEX) { qData.options = newOptions; qData.correctAnswerIndices = complexCorrectIndices; }
      else if (manualType === QuestionType.MATCHING) { qData.options = [newOptions[0] || 'Benar', newOptions[1] || 'Salah']; qData.matchingPairs = matchingPairs.filter(p => p.left); }

      const existingQIndex = questions.findIndex(q => q.packetId === selectedPacketId && q.number === activeSlot);
      let newQuestions = [...questions];
      
      if (existingQIndex >= 0) {
          const existingId = newQuestions[existingQIndex].id;
          newQuestions[existingQIndex] = { ...newQuestions[existingQIndex], ...qData };
          setEditingQuestionId(existingId); 
      } else {
          const newId = `q-${Date.now()}`;
          newQuestions.push({ ...qData, id: newId } as Question);
          setEditingQuestionId(newId); 
      }

      setQuestions(newQuestions);
      setPackets(prev => prev.map(p => p.id === selectedPacketId ? { ...p, questionTypes: { ...p.questionTypes, [activeSlot]: manualType } } : p));
      
      alert(`Soal No. ${activeSlot} tersimpan. Sinkronisasi dimulai...`); 
      triggerSync(); 
  };

  const prepareSlotForm = (num: number) => {
      setActiveSlot(num);
      const existingQ = questions.find(q => q.packetId === selectedPacketId && q.number === num);
      const pkt = packets.find(p => p.id === selectedPacketId);
      const type = pkt?.questionTypes[num] || QuestionType.SINGLE;
      setManualType(type);
      setLastFocusedField(null); 
      setIsImageUploading(false);
      
      if (existingQ) {
          setEditingQuestionId(existingQ.id); 
          setNewQuestionText(existingQ.text);
          if (existingQ.image) { setStimulusType('image'); setNewQuestionImage(existingQ.image); setNewStimulus(''); } 
          else { setStimulusType('text'); setNewStimulus(existingQ.stimulus || ''); setNewQuestionImage(''); }

          if (existingQ.type === QuestionType.SINGLE) { setNewOptions(existingQ.options || ['', '', '', '']); setSingleCorrectIndex(existingQ.correctAnswerIndex || 0); setComplexCorrectIndices([]); setMatchingPairs([{left:'', right: ''}]); }
          else if (existingQ.type === QuestionType.COMPLEX) { setNewOptions(existingQ.options || ['', '', '', '']); setComplexCorrectIndices(existingQ.correctAnswerIndices || []); setSingleCorrectIndex(0); setMatchingPairs([{left:'', right: ''}]); }
          else if (existingQ.type === QuestionType.MATCHING) { const opts = existingQ.options && existingQ.options.length >= 2 ? existingQ.options : ['Benar', 'Salah', '', '']; setNewOptions(opts); setMatchingPairs(existingQ.matchingPairs || [{left:'', right: opts[0]}]); setSingleCorrectIndex(0); setComplexCorrectIndices([]); }
      } else {
          setEditingQuestionId(null); setStimulusType('text'); setNewStimulus(''); setNewQuestionImage(''); setNewQuestionText('');
          setSingleCorrectIndex(0); setComplexCorrectIndices([]);
          if (type === QuestionType.MATCHING) { setNewOptions(['Benar', 'Salah', '', '']); setMatchingPairs([{left:'', right: 'Benar'}]); } 
          else { setNewOptions(['', '', '', '']); setMatchingPairs([{left:'', right: 'Benar'}]); }
      }
  };

  const handleDownloadAnalysisExcel = () => {
      if(!selectedExamForAnalysis) return;
      const questionsList = selectedExamForAnalysis.questions || [];
      const stats = questionsList.map((q, idx) => {
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
      <div className="p-8 h-full overflow-y-auto bg-[#F2F4F8] text-slate-800">
        <h2 className="text-3xl font-black mb-6 uppercase tracking-wider flex items-center gap-3"><span className="w-2 h-8 bg-[#00A2FF] block"></span>Dashboard {userRole === Role.ADMIN ? 'Admin' : (userRole === Role.TEACHER_LITERASI ? 'Guru Literasi' : 'Guru Numerasi')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 border-2 border-slate-200 rounded-2xl shadow-sm"><h3 className="text-sm font-bold text-slate-400 uppercase">Total Siswa</h3><p className="text-5xl font-black text-[#00A2FF]">{students.length}</p></div>
          <div className="bg-white p-6 border-2 border-slate-200 rounded-2xl shadow-sm"><h3 className="text-sm font-bold text-slate-400 uppercase">Total Paket Soal</h3><p className="text-5xl font-black text-purple-500">{packets.length}</p></div>
          <div className="bg-white p-6 border-2 border-slate-200 rounded-2xl shadow-sm"><h3 className="text-sm font-bold text-slate-400 uppercase">Ujian Aktif</h3><p className="text-5xl font-black text-[#00B06F]">{exams.filter(e => e.isActive).length}</p></div>
        </div>
      </div>
    );
  }
  
  // STUDENTS TAB
  if (activeTab === 'students' && userRole === Role.ADMIN) {
     const filteredStudents = students.filter(s => 
         (selectedClassFilter === '' || s.class === selectedClassFilter) &&
         (s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.nis.includes(searchTerm))
     );

     return (
        <div className="p-8 h-full flex flex-col bg-[#F2F4F8] text-slate-800">
             <div className="flex justify-between items-center mb-6 flex-none">
                 <h2 className="text-2xl font-black uppercase flex items-center gap-2"><GraduationCap className="text-[#00A2FF]"/> Data Siswa</h2>
                 <div className="flex gap-2">
                     <input type="file" ref={studentFileRef} className="hidden" accept=".xlsx" onChange={handleImportStudentExcel} />
                     <button onClick={handleDownloadTemplateStudent} className="bg-white text-slate-500 border-2 border-slate-200 px-3 py-2 text-xs font-bold uppercase rounded-xl flex items-center gap-2 hover:border-[#00A2FF] hover:text-[#00A2FF] transition-colors"><Download size={14}/> Template</button>
                     <button onClick={() => studentFileRef.current?.click()} className="bg-[#00A2FF] text-white px-3 py-2 text-xs font-bold uppercase rounded-xl flex items-center gap-2 hover:bg-blue-600 transition-colors shadow-sm btn-3d"><Upload size={14}/> Import Excel</button>
                     <button onClick={() => setShowAddStudentModal(true)} className="bg-[#00B06F] text-white px-3 py-2 text-xs font-bold uppercase rounded-xl flex items-center gap-2 hover:bg-[#009e63] transition-colors shadow-sm btn-3d"><Plus size={14}/> Tambah Siswa</button>
                 </div>
             </div>

             <div className="grid grid-cols-4 gap-4 mb-6">
                 {CLASS_LIST.map(c => {
                     const count = students.filter(s => s.class === c).length;
                     return (
                         <div key={c} onClick={() => setSelectedClassFilter(selectedClassFilter === c ? '' : c)} className={`cursor-pointer bg-white p-4 border-2 rounded-xl transition-all shadow-sm ${selectedClassFilter === c ? 'border-[#00A2FF] ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300'}`}>
                             <p className="text-xs font-black text-slate-400 uppercase">KELAS {c}</p>
                             <p className="text-2xl font-black text-slate-800">{count} <span className="text-xs font-medium text-slate-400">Siswa</span></p>
                         </div>
                     )
                 })}
             </div>

             <div className="bg-white border-2 border-slate-200 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-sm">
                 <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                     <div className="relative">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                         <input className="pl-9 pr-4 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00A2FF]" placeholder="Cari Nama / NIS..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                     </div>
                     <span className="text-xs font-bold text-slate-400 uppercase">{filteredStudents.length} Data Ditampilkan</span>
                 </div>
                 <div className="flex-1 overflow-auto">
                     <table className="w-full text-left border-collapse">
                         <thead className="bg-slate-50 sticky top-0 z-10">
                             <tr>
                                 <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">No</th>
                                 <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">Nama Siswa</th>
                                 <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">Kelas</th>
                                 <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">NIS</th>
                                 <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">NISN</th>
                                 <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-200 text-center">Aksi</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                             {filteredStudents.map((s, idx) => (
                                 <tr key={s.id} className="hover:bg-blue-50/50 transition-colors">
                                     <td className="p-4 text-sm font-bold text-slate-500">{idx + 1}</td>
                                     <td className="p-4 text-sm font-bold text-slate-800">{s.name}</td>
                                     <td className="p-4 text-sm font-bold"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">{s.class}</span></td>
                                     <td className="p-4 text-sm font-mono text-slate-500">{s.nis}</td>
                                     <td className="p-4 text-sm font-mono text-slate-500">{s.nisn}</td>
                                     <td className="p-4 text-center">
                                         <button onClick={() => handleDeleteStudent(s.id)} className="text-slate-400 hover:text-red-500 transition-colors bg-slate-50 p-2 rounded-lg hover:bg-red-50"><Trash2 size={16}/></button>
                                     </td>
                                 </tr>
                             ))}
                             {filteredStudents.length === 0 && (
                                 <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold italic">Data siswa tidak ditemukan.</td></tr>
                             )}
                         </tbody>
                     </table>
                 </div>
             </div>
             
             {showAddStudentModal && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm">
                     <div className="bg-white p-6 rounded-3xl w-full max-w-md shadow-2xl border-2 border-slate-200">
                         <h3 className="text-xl font-black text-slate-800 mb-6 uppercase">Tambah Siswa</h3>
                         <div className="space-y-4">
                             <div><label className="text-xs font-bold text-slate-400 uppercase block mb-1">Nama Lengkap</label><input className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-[#00A2FF]" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} /></div>
                             <div>
                                 <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Kelas</label>
                                 <select className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-[#00A2FF]" value={newStudent.class} onChange={e => setNewStudent({...newStudent, class: e.target.value})}>
                                     <option value="">Pilih Kelas</option>
                                     {CLASS_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                                 </select>
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                                 <div><label className="text-xs font-bold text-slate-400 uppercase block mb-1">NIS</label><input className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-[#00A2FF]" value={newStudent.nis} onChange={e => setNewStudent({...newStudent, nis: e.target.value})} /></div>
                                 <div><label className="text-xs font-bold text-slate-400 uppercase block mb-1">NISN</label><input className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-[#00A2FF]" value={newStudent.nisn} onChange={e => setNewStudent({...newStudent, nisn: e.target.value})} /></div>
                             </div>
                             <div className="flex gap-2 mt-6">
                                 <button onClick={() => setShowAddStudentModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-black rounded-xl hover:bg-slate-200">BATAL</button>
                                 <button onClick={handleAddStudent} className="flex-1 py-3 bg-[#00A2FF] text-white font-black rounded-xl hover:bg-blue-600 shadow-lg shadow-blue-200">SIMPAN</button>
                             </div>
                         </div>
                     </div>
                 </div>
             )}
        </div>
     );
  }

  // BANK SOAL
  if (activeTab === 'questions') {
    return (
      <div className="p-8 flex flex-col h-full overflow-hidden bg-[#F2F4F8] text-slate-800">
         <div className="flex justify-between items-center mb-6 flex-none border-b border-slate-200 pb-4">
             <div className="flex items-center gap-4">
                 <h2 className="text-2xl font-black uppercase"><BookOpen className="inline mr-2 text-[#00A2FF]"/> Bank Soal</h2>
                 <div className="flex bg-white rounded-xl border border-slate-200 overflow-hidden">
                     <button onClick={() => setBankSubTab('config')} className={`px-4 py-2 text-xs font-bold uppercase transition-all ${bankSubTab==='config'?'bg-blue-50 text-blue-600 border-b-2 border-blue-600':'text-slate-400 hover:text-slate-600'}`}>Paket</button>
                     <button onClick={() => setBankSubTab('input')} className={`px-4 py-2 text-xs font-bold uppercase transition-all ${bankSubTab==='input'?'bg-blue-50 text-blue-600 border-b-2 border-blue-600':'text-slate-400 hover:text-slate-600'}`}>Input Soal</button>
                 </div>
             </div>
             
             <div className="flex gap-2">
                 <input type="file" ref={questionFileRef} className="hidden" accept=".xlsx" onChange={handleImportQuestions} />
                 <button onClick={handleDownloadTemplateQuestion} className="bg-white text-slate-500 border-2 border-slate-200 px-3 py-2 text-xs font-bold uppercase rounded-xl flex items-center gap-2 hover:border-[#00A2FF] hover:text-[#00A2FF] transition-colors"><Download size={14}/> Template</button>
                 <button onClick={() => questionFileRef.current?.click()} className="bg-[#00B06F] text-white px-3 py-2 text-xs font-bold uppercase rounded-xl flex items-center gap-2 hover:bg-[#009e63] transition-colors shadow-sm btn-3d"><Upload size={14}/> Import Excel</button>
             </div>
         </div>
         
         {bankSubTab === 'config' && (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden min-h-0">
                 <div className="bg-white p-6 border-2 border-slate-200 rounded-3xl h-fit shadow-sm">
                     <h3 className="font-bold text-slate-800 mb-4 uppercase text-sm">{editingPacketId ? 'Edit Paket' : 'Buat Paket'}</h3>
                     <input className="w-full bg-slate-50 p-3 mb-2 text-slate-800 border-2 border-slate-200 rounded-xl font-bold text-sm focus:border-[#00A2FF] outline-none" placeholder="Nama" value={newPacketName} onChange={e=>setNewPacketName(e.target.value)}/>
                     <select className="w-full bg-slate-50 p-3 mb-2 text-slate-800 border-2 border-slate-200 rounded-xl font-bold text-sm focus:border-[#00A2FF] outline-none" value={newPacketCategory} onChange={(e) => setNewPacketCategory(e.target.value as QuestionCategory)} disabled={userRole !== Role.ADMIN}><option value={QuestionCategory.LITERASI}>Literasi</option><option value={QuestionCategory.NUMERASI}>Numerasi</option></select>
                     <input type="number" className="w-full bg-slate-50 p-3 mb-4 text-slate-800 border-2 border-slate-200 rounded-xl font-bold text-sm focus:border-[#00A2FF] outline-none" placeholder="Total Soal" value={newPacketTotal} onChange={e=>setNewPacketTotal(parseInt(e.target.value))}/>
                     <button onClick={handleSavePacket} className="w-full bg-[#00A2FF] text-white py-3 font-black rounded-xl uppercase tracking-wider btn-3d border-b-blue-700">{editingPacketId ? 'Update' : 'Simpan'}</button>
                     {editingPacketId && <button onClick={() => { setEditingPacketId(null); setNewPacketName(''); setNewPacketTotal(''); }} className="w-full bg-slate-200 text-slate-500 py-3 font-bold mt-2 rounded-xl">Batal</button>}
                 </div>
                 <div className="lg:col-span-2 overflow-auto space-y-2">{visiblePackets.map(p=>(
                     <div key={p.id} className="bg-white border-2 border-slate-200 p-4 flex justify-between items-center rounded-2xl hover:border-[#00A2FF] transition-all group shadow-sm">
                         <div><p className="text-slate-800 font-black">{p.name}</p><p className="text-xs text-slate-400 font-bold">{p.category} | {p.totalQuestions} Soal</p></div>
                         <div className="flex gap-2 opacity-50 group-hover:opacity-100">
                             <button onClick={() => handleEditPacket(p)} className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-[#00A2FF] hover:bg-blue-50"><Edit2 size={16}/></button>
                             <button onClick={()=>deletePacket(p.id)} className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={16}/></button>
                         </div>
                     </div>
                 ))}</div>
             </div>
         )}
         {bankSubTab === 'input' && (
             <div className="flex-1 flex flex-col min-h-0">
                 <select className="w-full bg-white border-2 border-slate-200 p-3 rounded-xl text-slate-700 mb-4 flex-none font-bold" value={selectedPacketId} onChange={e => {setSelectedPacketId(e.target.value); setActiveSlot(null);}}><option value="">Pilih Paket Soal</option>{visiblePackets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                 {selectedPacketId && (
                     <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-hidden min-h-0">
                         <div className="bg-white border-2 border-slate-200 overflow-auto p-4 rounded-3xl shadow-sm"><div className="grid grid-cols-4 gap-2">{Array.from({length: visiblePackets.find(p=>p.id===selectedPacketId)?.totalQuestions||0}).map((_,i)=><button key={i} onClick={()=>prepareSlotForm(i+1)} className={`aspect-square rounded-xl text-xs font-black border-2 transition-all ${activeSlot===i+1?'bg-[#00A2FF] text-white border-blue-600 shadow-md transform scale-105':'bg-slate-50 text-slate-400 border-slate-200 hover:border-[#00A2FF]'}`}>{i+1}</button>)}</div></div>
                         <div className="lg:col-span-3 bg-white border-2 border-slate-200 p-6 overflow-y-auto flex flex-col min-h-0 rounded-3xl shadow-sm">
                             {activeSlot ? (
                                 <div className="space-y-6 flex-1">
                                     <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                                        <h3 className="text-slate-800 font-black text-xl">Edit Soal {activeSlot}</h3>
                                        <div className="flex items-center gap-2">
                                            <div className="bg-slate-50 border-2 border-slate-200 rounded-xl flex items-center gap-1 p-1">
                                                <button onClick={() => handleInsertMath('$^{}$')} className="p-1 hover:bg-slate-200 text-slate-600 rounded text-xs font-bold" title="Pangkat">x²</button>
                                                <button onClick={() => handleInsertMath('$_{}$')} className="p-1 hover:bg-slate-200 text-slate-600 rounded text-xs font-bold" title="Subscript">x₂</button>
                                                <button onClick={() => handleInsertMath('$\\sqrt{}$')} className="p-1 hover:bg-slate-200 text-slate-600 rounded text-xs font-bold" title="Akar">√x</button>
                                                <button onClick={() => handleInsertMath('$\\frac{a}{b}$')} className="p-1 hover:bg-slate-200 text-slate-600 rounded text-xs font-bold" title="Pecahan">a/b</button>
                                            </div>
                                            <select 
                                                className="bg-slate-50 text-slate-700 p-2 text-xs border-2 border-slate-200 rounded-xl font-bold" 
                                                value={manualType} 
                                                onChange={e => {
                                                    const t = e.target.value as QuestionType;
                                                    setManualType(t);
                                                    if (t === QuestionType.MATCHING) {
                                                        const currentOpts = [...newOptions];
                                                        if (!currentOpts[0]) currentOpts[0] = 'Benar';
                                                        if (!currentOpts[1]) currentOpts[1] = 'Salah';
                                                        setNewOptions(currentOpts);
                                                        if (matchingPairs.length === 0 || (matchingPairs.length === 1 && !matchingPairs[0].left)) {
                                                            setMatchingPairs([{left: '', right: currentOpts[0]}]);
                                                        }
                                                    }
                                                }}
                                            >
                                                <option value={QuestionType.SINGLE}>Pilihan Ganda</option>
                                                <option value={QuestionType.COMPLEX}>PG Kompleks</option>
                                                <option value={QuestionType.MATCHING}>Menjodohkan</option>
                                            </select>
                                        </div>
                                     </div>
                                     
                                     <div className="space-y-2 border-b border-slate-100 pb-6">
                                         <div className="flex gap-2 mb-2">
                                             <button onClick={() => setStimulusType('text')} className={`text-xs px-3 py-1 rounded-lg font-bold border-2 ${stimulusType === 'text' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>Teks</button>
                                             <button onClick={() => setStimulusType('image')} className={`text-xs px-3 py-1 rounded-lg font-bold border-2 ${stimulusType === 'image' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>Gambar</button>
                                         </div>
                                         
                                         {stimulusType === 'text' ? (
                                             <textarea 
                                                className="w-full bg-slate-50 p-4 text-slate-700 border-2 border-slate-200 rounded-xl font-medium focus:border-[#00A2FF] focus:outline-none" 
                                                rows={4} 
                                                placeholder="Masukkan teks stimulus di sini..." 
                                                value={newStimulus} 
                                                onFocus={() => setLastFocusedField({ name: 'stimulus' })}
                                                onChange={e=>setNewStimulus(cleanWordHtml(e.target.value))}
                                             />
                                         ) : (
                                             <div className="space-y-2">
                                                 <input type="file" accept="image/*" ref={imageUploadRef} onChange={handleImageUpload} className="hidden" />
                                                 <div className="flex gap-2 items-center">
                                                     <button disabled={isImageUploading} onClick={() => imageUploadRef.current?.click()} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 text-sm rounded-xl font-bold flex items-center gap-2 border-2 border-slate-200 disabled:opacity-50 transition-colors">
                                                         <Upload size={14}/> {isImageUploading ? 'Mengupload...' : 'Upload Gambar'}
                                                     </button>
                                                     {isImageUploading && <RefreshCw size={14} className="animate-spin text-[#00A2FF]"/>}
                                                     {newQuestionImage && <button onClick={() => setNewQuestionImage('')} className="text-red-500 text-xs font-bold">Hapus</button>}
                                                 </div>
                                                 {newQuestionImage && <img src={newQuestionImage} alt="Stimulus" className="max-h-40 object-contain border-2 border-slate-200 bg-white rounded-xl shadow-sm"/>}
                                             </div>
                                         )}
                                     </div>

                                     <div className="space-y-2">
                                         <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Pertanyaan</label>
                                         <textarea 
                                            className="w-full bg-white p-4 text-slate-800 border-2 border-slate-200 rounded-xl font-medium focus:border-[#00A2FF] focus:outline-none shadow-sm" 
                                            rows={3} 
                                            placeholder="Tulis pertanyaan..." 
                                            value={newQuestionText} 
                                            onFocus={() => setLastFocusedField({ name: 'question' })}
                                            onChange={e=>setNewQuestionText(cleanWordHtml(e.target.value))}
                                         />
                                     </div>
                                     
                                     <div className="border-t border-slate-100 pt-6">
                                         <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-4">Jawaban ({manualType})</label>
                                         
                                         {manualType === QuestionType.SINGLE && newOptions.map((o,i)=>(
                                             <div key={i} className="flex gap-2 mb-2 items-center">
                                                 <button onClick={()=>setSingleCorrectIndex(i)} className={`w-10 h-10 flex items-center justify-center border-2 rounded-xl font-black transition-all ${singleCorrectIndex===i?'bg-[#00B06F] border-green-600 text-white shadow-md':'bg-slate-50 border-slate-200 text-slate-400'}`}>{String.fromCharCode(65+i)}</button>
                                                 <input 
                                                    className="flex-1 bg-slate-50 p-3 text-slate-700 text-sm border-2 border-slate-200 rounded-xl font-medium focus:border-[#00A2FF] focus:outline-none" 
                                                    value={o} 
                                                    onFocus={() => setLastFocusedField({ name: 'option', index: i })}
                                                    onChange={e=>{const c=[...newOptions];c[i]=e.target.value;setNewOptions(c)}}
                                                 />
                                             </div>
                                         ))}

                                         {manualType === QuestionType.COMPLEX && newOptions.map((o,i)=>(
                                             <div key={i} className="flex gap-2 mb-2 items-center">
                                                 <button 
                                                     onClick={() => {
                                                         if (complexCorrectIndices.includes(i)) setComplexCorrectIndices(complexCorrectIndices.filter(idx => idx !== i));
                                                         else setComplexCorrectIndices([...complexCorrectIndices, i]);
                                                     }} 
                                                     className={`w-10 h-10 flex items-center justify-center border-2 rounded-xl transition-all ${complexCorrectIndices.includes(i) ? 'bg-[#00A2FF] border-blue-600 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-300'}`}
                                                 >
                                                     <Check size={20} className={complexCorrectIndices.includes(i) ? 'opacity-100' : 'opacity-0'} strokeWidth={3}/>
                                                 </button>
                                                 <input 
                                                    className="flex-1 bg-slate-50 p-3 text-slate-700 text-sm border-2 border-slate-200 rounded-xl font-medium focus:border-[#00A2FF] focus:outline-none" 
                                                    value={o} 
                                                    onFocus={() => setLastFocusedField({ name: 'option', index: i })}
                                                    onChange={e=>{const c=[...newOptions];c[i]=e.target.value;setNewOptions(c)}}
                                                 />
                                             </div>
                                         ))}

                                         {manualType === QuestionType.MATCHING && (
                                             <div className="space-y-4">
                                                 <div className="grid grid-cols-2 gap-4">
                                                     <div>
                                                         <label className="text-[10px] text-blue-500 font-black uppercase mb-1 block">Label Kiri (Benar)</label>
                                                         <input className="w-full bg-slate-50 p-3 text-slate-700 text-sm border-2 border-slate-200 rounded-xl font-bold" value={newOptions[0]} onChange={e => {const n = [...newOptions]; n[0] = e.target.value; setNewOptions(n)}} />
                                                     </div>
                                                     <div>
                                                         <label className="text-[10px] text-red-500 font-black uppercase mb-1 block">Label Kanan (Salah)</label>
                                                         <input className="w-full bg-slate-50 p-3 text-slate-700 text-sm border-2 border-slate-200 rounded-xl font-bold" value={newOptions[1]} onChange={e => {const n = [...newOptions]; n[1] = e.target.value; setNewOptions(n)}} />
                                                     </div>
                                                 </div>
                                                 
                                                 <div className="bg-slate-50 p-4 rounded-xl border-2 border-slate-200">
                                                     <label className="text-[10px] text-slate-400 font-black uppercase mb-3 block">Pasangan Jawaban</label>
                                                     {matchingPairs.map((pair, idx) => (
                                                         <div key={idx} className="flex gap-2 items-center mb-2">
                                                             <span className="text-slate-400 font-black text-xs w-6 text-center">{idx+1}.</span>
                                                             <input 
                                                                className="flex-1 bg-white p-3 text-slate-700 text-sm border-2 border-slate-200 rounded-xl focus:border-[#00A2FF] focus:outline-none font-medium" 
                                                                placeholder="Pernyataan..." 
                                                                value={pair.left} 
                                                                onFocus={() => setLastFocusedField({ name: 'pair-left', index: idx })}
                                                                onChange={e => {const n = [...matchingPairs]; n[idx].left = e.target.value; setMatchingPairs(n)}} 
                                                             />
                                                             <div className="w-32">
                                                                <select className="w-full bg-white text-slate-700 p-3 text-sm border-2 border-slate-200 rounded-xl font-bold" value={pair.right} onChange={e => {const n = [...matchingPairs]; n[idx].right = e.target.value; setMatchingPairs(n)}}>
                                                                    <option value={newOptions[0]}>{newOptions[0] || 'Opsi 1'}</option>
                                                                    <option value={newOptions[1]}>{newOptions[1] || 'Opsi 2'}</option>
                                                                </select>
                                                             </div>
                                                             <button onClick={() => setMatchingPairs(matchingPairs.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 p-2"><X size={18}/></button>
                                                         </div>
                                                     ))}
                                                     <button onClick={() => setMatchingPairs([...matchingPairs, {left:'', right: newOptions[0]}])} className="text-xs bg-blue-50 text-blue-600 px-4 py-2 rounded-lg font-black mt-2 hover:bg-blue-100">+ Tambah Baris</button>
                                                 </div>
                                             </div>
                                         )}
                                     </div>

                                     {/* --- PREVIEW SECTION (Light Mode) --- */}
                                     <div className="mt-8 pt-8 border-t-2 border-slate-100">
                                        <h4 className="text-slate-400 font-black uppercase text-xs tracking-widest mb-4 flex items-center gap-2"><Eye size={16}/> Preview Tampilan Siswa</h4>
                                        <div className="bg-white border-2 border-slate-200 p-6 rounded-3xl relative shadow-[0_8px_0_0_#E2E8F0]">
                                            
                                            {/* Stimulus Preview */}
                                            {stimulusType === 'text' && newStimulus && (
                                                <div className="mb-6 p-6 bg-blue-50 border-2 border-blue-100 rounded-2xl text-slate-700 font-medium leading-relaxed">
                                                     <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{newStimulus}</ReactMarkdown>
                                                </div>
                                            )}
                                            {stimulusType === 'image' && newQuestionImage && (
                                                <div className="mb-6 rounded-2xl overflow-hidden border-2 border-slate-200 flex justify-center bg-slate-50 p-4">
                                                    <img src={newQuestionImage} alt="Stimulus" className="max-h-60 object-contain"/>
                                                </div>
                                            )}
                                            
                                            {/* Question Text Preview */}
                                            <div className="text-xl md:text-2xl font-bold text-slate-800 mb-8 leading-snug font-display">
                                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{newQuestionText || '(Teks Pertanyaan...)'}</ReactMarkdown>
                                            </div>

                                            {/* Options Preview */}
                                            <div className="space-y-3">
                                                {manualType === QuestionType.SINGLE && newOptions.map((opt, i) => (
                                                    <div key={i} className={`p-4 rounded-xl border-2 flex items-center gap-4 ${i === singleCorrectIndex ? 'bg-blue-50 border-[#00A2FF] shadow-sm' : 'bg-white border-slate-200'}`}>
                                                        <div className={`w-8 h-8 flex items-center justify-center rounded-lg font-black text-sm ${i === singleCorrectIndex ? 'bg-[#00A2FF] text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                            {String.fromCharCode(65+i)}
                                                        </div>
                                                        <div className="text-sm font-bold text-slate-600 flex-1">
                                                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{p:'span'}}>{opt}</ReactMarkdown>
                                                        </div>
                                                        {i === singleCorrectIndex && <Check size={18} className="text-[#00A2FF]"/>}
                                                    </div>
                                                ))}

                                                {manualType === QuestionType.COMPLEX && newOptions.map((opt, i) => (
                                                    <div key={i} className={`p-4 rounded-xl border-2 flex items-center gap-4 ${complexCorrectIndices.includes(i) ? 'bg-blue-50 border-[#00A2FF]' : 'bg-white border-slate-200'}`}>
                                                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${complexCorrectIndices.includes(i) ? 'bg-[#00A2FF] border-[#00A2FF]' : 'border-slate-300'}`}>
                                                            {complexCorrectIndices.includes(i) && <Check size={14} className="text-white" strokeWidth={4}/>}
                                                        </div>
                                                        <div className="text-sm font-bold text-slate-600">
                                                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{p:'span'}}>{opt}</ReactMarkdown>
                                                        </div>
                                                    </div>
                                                ))}

                                                {manualType === QuestionType.MATCHING && (
                                                    <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
                                                        <table className="w-full text-sm text-left text-slate-600">
                                                            <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-400">
                                                                <tr>
                                                                    <th className="px-4 py-3">Pernyataan</th>
                                                                    <th className="px-4 py-3 text-center border-l-2 border-slate-100 bg-green-50 text-green-600">{newOptions[0] || 'Benar'}</th>
                                                                    <th className="px-4 py-3 text-center border-l-2 border-slate-100 bg-red-50 text-red-600">{newOptions[1] || 'Salah'}</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {matchingPairs.map((pair, idx) => (
                                                                    <tr key={idx}>
                                                                        <td className="px-4 py-3 font-medium">
                                                                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{p:'span'}}>{pair.left}</ReactMarkdown>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center border-l-2 border-slate-100">
                                                                            {pair.right === newOptions[0] && <div className="w-4 h-4 bg-green-500 rounded-full mx-auto shadow-sm"></div>}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center border-l-2 border-slate-100">
                                                                            {pair.right === newOptions[1] && <div className="w-4 h-4 bg-red-500 rounded-full mx-auto shadow-sm"></div>}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                     </div>

                                     <button onClick={handleSaveQuestionSlot} className="w-full bg-[#00A2FF] text-white py-4 font-black text-lg uppercase tracking-widest mt-6 rounded-2xl shadow-[0_6px_0_0_#007ACC] active:shadow-none active:translate-y-2 transition-all border-b-4 border-blue-700">Simpan Soal</button>
                                 </div>
                             ) : <div className="flex flex-col items-center justify-center h-full text-slate-300">
                                    <Layout size={64} className="mb-4 opacity-50"/>
                                    <p className="font-bold text-slate-400">Pilih nomor soal disebelah kiri untuk mulai mengedit.</p>
                                 </div>}
                         </div>
                     </div>
                 )}
             </div>
         )}
      </div>
    );
  }

  // EXAMS TAB
  if (activeTab === 'exams' && userRole === Role.ADMIN) {
      return (
        <div className="p-8 h-full flex flex-col bg-[#F2F4F8] text-slate-800">
            <h2 className="text-2xl font-black uppercase mb-6 flex items-center gap-2"><CalendarClock className="text-[#00A2FF]"/> Jadwal Ujian</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden min-h-0">
                <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 h-fit shadow-sm">
                    <h3 className="text-sm font-black uppercase text-slate-800 mb-4">Buat Jadwal Baru</h3>
                    <input className="w-full bg-slate-50 border-2 border-slate-200 p-3 rounded-xl mb-3 text-sm font-bold outline-none focus:border-[#00A2FF]" placeholder="Judul Ujian" value={newExamTitle} onChange={e => setNewExamTitle(e.target.value)} />
                    
                    <div className="mb-3">
                        <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Waktu Pelaksanaan (Akses Dibuka - Ditutup)</label>
                        <div className="grid grid-cols-2 gap-2">
                             <input type="datetime-local" className="w-full bg-slate-50 border-2 border-slate-200 p-3 rounded-xl text-xs font-bold outline-none focus:border-[#00A2FF]" value={newExamStart} onChange={e => setNewExamStart(e.target.value)} />
                             <input type="datetime-local" className="w-full bg-slate-50 border-2 border-slate-200 p-3 rounded-xl text-xs font-bold outline-none focus:border-[#00A2FF]" value={newExamEnd} onChange={e => setNewExamEnd(e.target.value)} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Paket Soal</label>
                            <select className="w-full bg-slate-50 border-2 border-slate-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-[#00A2FF]" value={newExamPacketId} onChange={e => setNewExamPacketId(e.target.value)}>
                                <option value="">Pilih Paket Soal</option>
                                {visiblePackets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Durasi (Menit)</label>
                            <input type="number" className="w-full bg-slate-50 border-2 border-slate-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-[#00A2FF]" placeholder="Contoh: 120" value={newExamDuration} onChange={e => setNewExamDuration(parseInt(e.target.value))} />
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Target Kelas</label>
                        <div className="flex flex-wrap gap-2">
                            {CLASS_LIST.map(c => (
                                <button key={c} onClick={() => {
                                    if(newExamClasses.includes(c)) setNewExamClasses(newExamClasses.filter(x => x !== c));
                                    else setNewExamClasses([...newExamClasses, c]);
                                }} className={`px-3 py-1 rounded-lg text-xs font-bold border-2 transition-all ${newExamClasses.includes(c) ? 'bg-[#00A2FF] text-white border-blue-600' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button onClick={handleCreateExam} className="w-full bg-[#00B06F] text-white py-3 font-black rounded-xl uppercase tracking-wider btn-3d border-b-green-700">Jadwalkan</button>
                </div>

                <div className="lg:col-span-2 overflow-y-auto space-y-3 pr-2">
                    {exams.map(exam => {
                        const isActive = exam.isActive;
                        return (
                            <div key={exam.id} className="bg-white p-4 rounded-2xl border-2 border-slate-200 flex justify-between items-center group hover:border-[#00A2FF] transition-all shadow-sm">
                                <div>
                                    <h4 className="font-black text-slate-800 text-lg uppercase">{exam.title}</h4>
                                    <div className="flex items-center gap-3 text-xs font-bold text-slate-500 mt-1">
                                        <span className="flex items-center gap-1"><Clock size={12}/> {exam.durationMinutes} Menit</span>
                                        <span className="flex items-center gap-1"><Users size={12}/> {exam.classTarget.join(', ')}</span>
                                        <span className={`px-2 py-0.5 rounded ${isActive ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>{isActive ? 'AKTIF' : 'NON-AKTIF'}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2 font-mono uppercase">{formatDateRange(exam.scheduledStart, exam.scheduledEnd)}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => toggleExamStatus(exam.id)} className={`p-3 rounded-xl transition-colors ${isActive ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-green-50 text-green-500 hover:bg-green-100'}`}>
                                        {isActive ? <StopCircle size={20}/> : <PlayCircle size={20}/>}
                                    </button>
                                    <button onClick={() => handleDeleteExam(exam.id)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors">
                                        <Trash2 size={20}/>
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                    {exams.length === 0 && <div className="text-center p-8 text-slate-400 font-bold italic border-2 border-dashed border-slate-200 rounded-2xl">Belum ada jadwal ujian.</div>}
                </div>
            </div>
        </div>
      );
  }

  // MONITORING TAB
  if (activeTab === 'monitor' && userRole === Role.ADMIN) {
      const selectedExamData = exams.find(e => e.id === selectedExamForMonitor);
      
      // Filter results for this exam
      const resultsForExam = examResults.filter(r => r.examId === selectedExamForMonitor);
      
      // Get all eligible students
      let eligibleStudents = students.filter(s => selectedExamData?.classTarget.includes(s.class));
      if (monitoringClassFilter) eligibleStudents = eligibleStudents.filter(s => s.class === monitoringClassFilter);

      // Map status
      const monitorData = eligibleStudents.map(s => {
          const res = resultsForExam.find(r => r.studentId === s.id);
          const isDone = !!res;
          // In real-time scenario, we would need a 'working' status from server.
          // For now, we only know Done or Not Started (or we assume working if not done but active).
          return { student: s, result: res, status: isDone ? 'SELESAI' : 'BELUM' };
      });
      
      // Filter by status
      const displayedMonitorData = monitorData.filter(d => {
          if (monitoringStatusFilter === 'all') return true;
          if (monitoringStatusFilter === 'finished') return d.status === 'SELESAI';
          if (monitoringStatusFilter === 'unfinished') return d.status === 'BELUM';
          if (monitoringStatusFilter === 'suspicious') return d.result?.violationCount && d.result.violationCount > 0;
          return true;
      });

      return (
          <div className="p-8 h-full flex flex-col bg-[#F2F4F8] text-slate-800">
               <div className="flex justify-between items-center mb-6">
                   <h2 className="text-2xl font-black uppercase flex items-center gap-2"><Activity className="text-[#00A2FF]"/> Live Monitoring</h2>
                   <select className="bg-white border-2 border-slate-200 p-2 rounded-xl text-sm font-bold outline-none focus:border-[#00A2FF]" value={selectedExamForMonitor} onChange={e => setSelectedExamForMonitor(e.target.value)}>
                       <option value="">-- PILIH UJIAN --</option>
                       {visibleExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                   </select>
               </div>

               {selectedExamForMonitor ? (
                   <>
                       <div className="grid grid-cols-4 gap-4 mb-6">
                           <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-sm">
                               <p className="text-xs font-black text-slate-400 uppercase">Total Peserta</p>
                               <p className="text-2xl font-black text-slate-800">{monitorData.length}</p>
                           </div>
                           <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-sm">
                               <p className="text-xs font-black text-slate-400 uppercase">Selesai</p>
                               <p className="text-2xl font-black text-green-500">{monitorData.filter(d=>d.status==='SELESAI').length}</p>
                           </div>
                           <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-sm">
                               <p className="text-xs font-black text-slate-400 uppercase">Belum Selesai</p>
                               <p className="text-2xl font-black text-red-500">{monitorData.filter(d=>d.status==='BELUM').length}</p>
                           </div>
                           <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-sm">
                               <p className="text-xs font-black text-slate-400 uppercase">Rata-rata Nilai</p>
                               <p className="text-2xl font-black text-blue-500">
                                   {resultsForExam.length > 0 ? (resultsForExam.reduce((a,b)=>a+b.score,0)/resultsForExam.length).toFixed(1) : '0'}
                               </p>
                           </div>
                       </div>

                       <div className="flex gap-2 mb-4">
                           <button onClick={() => setMonitoringStatusFilter('all')} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${monitoringStatusFilter==='all'?'bg-slate-800 text-white':'bg-white text-slate-500 border border-slate-200'}`}>Semua</button>
                           <button onClick={() => setMonitoringStatusFilter('finished')} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${monitoringStatusFilter==='finished'?'bg-green-600 text-white':'bg-white text-slate-500 border border-slate-200'}`}>Selesai</button>
                           <button onClick={() => setMonitoringStatusFilter('unfinished')} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${monitoringStatusFilter==='unfinished'?'bg-red-500 text-white':'bg-white text-slate-500 border border-slate-200'}`}>Belum</button>
                           <button onClick={() => setMonitoringStatusFilter('suspicious')} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${monitoringStatusFilter==='suspicious'?'bg-orange-500 text-white':'bg-white text-slate-500 border border-slate-200'}`}>Pelanggaran</button>
                           
                           <div className="ml-auto">
                               <select className="bg-white border-2 border-slate-200 p-2 rounded-xl text-xs font-bold outline-none" value={monitoringClassFilter} onChange={e => setMonitoringClassFilter(e.target.value)}>
                                   <option value="">Semua Kelas</option>
                                   {selectedExamData?.classTarget.map(c => <option key={c} value={c}>{c}</option>)}
                               </select>
                           </div>
                       </div>

                       <div className="bg-white rounded-2xl border-2 border-slate-200 flex-1 overflow-hidden shadow-sm">
                           <div className="overflow-auto h-full">
                               <table className="w-full text-left">
                                   <thead className="bg-slate-50 sticky top-0">
                                       <tr>
                                           <th className="p-4 text-xs font-black text-slate-400 uppercase border-b border-slate-200">Peserta</th>
                                           <th className="p-4 text-xs font-black text-slate-400 uppercase border-b border-slate-200">Kelas</th>
                                           <th className="p-4 text-xs font-black text-slate-400 uppercase border-b border-slate-200 text-center">Status</th>
                                           <th className="p-4 text-xs font-black text-slate-400 uppercase border-b border-slate-200 text-center">Nilai</th>
                                           <th className="p-4 text-xs font-black text-slate-400 uppercase border-b border-slate-200 text-center">Info</th>
                                           <th className="p-4 text-xs font-black text-slate-400 uppercase border-b border-slate-200 text-center">Aksi</th>
                                       </tr>
                                   </thead>
                                   <tbody className="divide-y divide-slate-100">
                                       {displayedMonitorData.map((d, idx) => (
                                           <tr key={idx} className="hover:bg-slate-50">
                                               <td className="p-4 text-sm font-bold text-slate-800">{d.student.name}</td>
                                               <td className="p-4 text-sm font-bold text-slate-500">{d.student.class}</td>
                                               <td className="p-4 text-center">
                                                   <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${d.status==='SELESAI'?'bg-green-100 text-green-600':'bg-slate-100 text-slate-400'}`}>{d.status}</span>
                                               </td>
                                               <td className="p-4 text-center text-sm font-black text-slate-800">{d.result ? d.result.score.toFixed(0) : '-'}</td>
                                               <td className="p-4 text-center">
                                                   {d.result?.violationCount ? (
                                                       <span className="text-red-500 font-bold text-xs flex items-center justify-center gap-1"><AlertTriangle size={12}/> {d.result.violationCount}x</span>
                                                   ) : <span className="text-green-500 text-xs font-bold">Aman</span>}
                                               </td>
                                               <td className="p-4 text-center">
                                                   <button className="text-xs font-bold text-blue-500 hover:text-blue-700 underline">Reset Login</button>
                                               </td>
                                           </tr>
                                       ))}
                                   </tbody>
                               </table>
                           </div>
                       </div>
                   </>
               ) : (
                   <div className="flex-1 flex items-center justify-center text-slate-400 font-bold italic border-2 border-dashed border-slate-200 rounded-3xl">Pilih ujian untuk memantau.</div>
               )}
          </div>
      );
  }

  // ANALYSIS TAB
  if (activeTab === 'analysis') {
      return (
          <div className="p-8 h-full flex flex-col bg-[#F2F4F8] text-slate-800">
              <div className="flex justify-between items-center mb-6">
                   <h2 className="text-2xl font-black uppercase flex items-center gap-2"><BarChart2 className="text-[#00A2FF]"/> Analisis Hasil</h2>
                   <div className="flex gap-4">
                       <select className="bg-white border-2 border-slate-200 p-2 rounded-xl text-sm font-bold outline-none focus:border-[#00A2FF]" value={selectedExamIdForAnalysis} onChange={e => setSelectedExamIdForAnalysis(e.target.value)}>
                           <option value="">-- PILIH UJIAN --</option>
                           {visibleExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                       </select>
                   </div>
               </div>

               {selectedExamIdForAnalysis && selectedExamForAnalysis ? (
                   <>
                       <div className="flex gap-2 mb-4 bg-white p-1 rounded-xl w-fit border border-slate-200">
                           <button onClick={() => setAnalysisSubTab('item')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${analysisSubTab==='item'?'bg-[#00A2FF] text-white shadow-md':'text-slate-400 hover:text-slate-600'}`}>Analisis Butir Soal</button>
                           <button onClick={() => setAnalysisSubTab('recap')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${analysisSubTab==='recap'?'bg-[#00A2FF] text-white shadow-md':'text-slate-400 hover:text-slate-600'}`}>Rekap Nilai</button>
                       </div>

                       <div className="bg-white rounded-3xl border-2 border-slate-200 flex-1 overflow-hidden shadow-sm flex flex-col">
                           {analysisSubTab === 'item' && (
                               <div className="flex-1 flex flex-col">
                                   <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                                       <h3 className="text-sm font-black text-slate-600 uppercase">Analisis Per Soal</h3>
                                       <button onClick={handleDownloadAnalysisExcel} className="flex items-center gap-2 text-green-600 font-bold text-xs uppercase hover:bg-green-50 px-3 py-1 rounded-lg transition-colors"><FileSpreadsheet size={16}/> Download Excel</button>
                                   </div>
                                   <div className="flex-1 overflow-auto p-4">
                                       <table className="w-full text-left text-sm">
                                           <thead className="bg-slate-100 text-slate-500 uppercase font-bold text-xs">
                                               <tr>
                                                   <th className="p-3 rounded-l-lg">No</th>
                                                   <th className="p-3 w-1/3">Pertanyaan</th>
                                                   <th className="p-3 text-center">Tingkat Kesukaran</th>
                                                   <th className="p-3 text-center">Daya Pembeda</th>
                                                   <th className="p-3 text-center bg-green-50 text-green-600 rounded-r-lg">% Menjawab Benar</th>
                                               </tr>
                                           </thead>
                                           <tbody className="divide-y divide-slate-100">
                                               {selectedExamForAnalysis.questions.map((q, idx) => {
                                                   const stats = getItemAnalysis(q.id, q);
                                                   let difficulty = "Sedang";
                                                   if (stats.correctRate > 80) difficulty = "Mudah";
                                                   if (stats.correctRate < 30) difficulty = "Sukar";
                                                   
                                                   return (
                                                       <tr key={q.id}>
                                                           <td className="p-3 font-bold text-slate-400">{idx+1}</td>
                                                           <td className="p-3 font-medium text-slate-700 truncate max-w-xs">{q.text.substring(0, 100)}...</td>
                                                           <td className="p-3 text-center">
                                                               <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${difficulty==='Mudah'?'bg-green-100 text-green-600':difficulty==='Sukar'?'bg-red-100 text-red-600':'bg-yellow-100 text-yellow-600'}`}>{difficulty}</span>
                                                           </td>
                                                           <td className="p-3 text-center font-mono text-slate-500">-</td>
                                                           <td className="p-3 text-center font-black text-slate-800">{stats.correctRate.toFixed(1)}%</td>
                                                       </tr>
                                                   )
                                               })}
                                           </tbody>
                                       </table>
                                   </div>
                               </div>
                           )}

                           {analysisSubTab === 'recap' && (
                               <div className="flex-1 flex flex-col">
                                   <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                                       <h3 className="text-sm font-black text-slate-600 uppercase">Rekapitulasi Nilai Siswa</h3>
                                       <button onClick={handleDownloadRecapExcel} className="flex items-center gap-2 text-green-600 font-bold text-xs uppercase hover:bg-green-50 px-3 py-1 rounded-lg transition-colors"><FileSpreadsheet size={16}/> Download Excel</button>
                                   </div>
                                   <div className="flex-1 overflow-auto p-4">
                                       <table className="w-full text-left text-sm">
                                           <thead className="bg-slate-100 text-slate-500 uppercase font-bold text-xs">
                                               <tr>
                                                   <th className="p-3 rounded-l-lg">Peringkat</th>
                                                   <th className="p-3">Nama Siswa</th>
                                                   <th className="p-3 text-center">Kelas</th>
                                                   <th className="p-3 text-center">Waktu Submit</th>
                                                   <th className="p-3 text-center bg-blue-50 text-blue-600 rounded-r-lg">Nilai Akhir</th>
                                               </tr>
                                           </thead>
                                           <tbody className="divide-y divide-slate-100">
                                               {examResults
                                                 .filter(r => r.examId === selectedExamIdForAnalysis)
                                                 .sort((a,b) => b.score - a.score)
                                                 .map((r, idx) => (
                                                   <tr key={r.id}>
                                                       <td className="p-3 text-center font-black text-slate-400">{idx+1}</td>
                                                       <td className="p-3 font-bold text-slate-800">{r.studentName}</td>
                                                       <td className="p-3 text-center font-bold text-slate-500">{r.studentClass}</td>
                                                       <td className="p-3 text-center font-mono text-xs text-slate-400">{new Date(r.timestamp).toLocaleString()}</td>
                                                       <td className="p-3 text-center font-black text-xl text-blue-600">{r.score.toFixed(0)}</td>
                                                   </tr>
                                               ))}
                                               {examResults.filter(r => r.examId === selectedExamIdForAnalysis).length === 0 && (
                                                   <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Belum ada data nilai.</td></tr>
                                               )}
                                           </tbody>
                                       </table>
                                   </div>
                               </div>
                           )}
                       </div>
                   </>
               ) : (
                   <div className="flex-1 flex items-center justify-center text-slate-400 font-bold italic border-2 border-dashed border-slate-200 rounded-3xl">Pilih ujian untuk melihat analisis.</div>
               )}
          </div>
      );
  }

  // SETTINGS TAB
  if (activeTab === 'settings' && userRole === Role.ADMIN) {
      return (
          <div className="p-8 h-full flex flex-col bg-[#F2F4F8] text-slate-800">
              <h2 className="text-2xl font-black uppercase mb-6 flex items-center gap-2"><Settings className="text-[#00A2FF]"/> Pengaturan Sekolah</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-3xl border-2 border-slate-200 shadow-sm">
                      <h3 className="text-lg font-black text-slate-800 uppercase mb-6 flex items-center gap-2"><AlignLeft size={20}/> Identitas Aplikasi</h3>
                      <div className="space-y-4">
                          <div>
                              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Nama Sekolah</label>
                              <input className="w-full bg-slate-50 border-2 border-slate-200 p-3 rounded-xl font-bold text-sm outline-none focus:border-[#00A2FF]" value={schoolSettings?.schoolName} onChange={e => setSchoolSettings && setSchoolSettings({...schoolSettings!, schoolName: e.target.value})} />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Judul Aplikasi CBT</label>
                              <input className="w-full bg-slate-50 border-2 border-slate-200 p-3 rounded-xl font-bold text-sm outline-none focus:border-[#00A2FF]" value={schoolSettings?.cbtTitle} onChange={e => setSchoolSettings && setSchoolSettings({...schoolSettings!, cbtTitle: e.target.value})} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Tahun Ajaran</label>
                                  <input className="w-full bg-slate-50 border-2 border-slate-200 p-3 rounded-xl font-bold text-sm outline-none focus:border-[#00A2FF]" value={schoolSettings?.academicYear} onChange={e => setSchoolSettings && setSchoolSettings({...schoolSettings!, academicYear: e.target.value})} />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Semester</label>
                                  <input className="w-full bg-slate-50 border-2 border-slate-200 p-3 rounded-xl font-bold text-sm outline-none focus:border-[#00A2FF]" value={schoolSettings?.semester} onChange={e => setSchoolSettings && setSchoolSettings({...schoolSettings!, semester: e.target.value})} />
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className="bg-white p-8 rounded-3xl border-2 border-slate-200 shadow-sm">
                      <h3 className="text-lg font-black text-slate-800 uppercase mb-6 flex items-center gap-2"><Key size={20}/> Keamanan & Akses</h3>
                      <div className="space-y-4">
                          <div>
                              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Password Admin Utama</label>
                              <input type="password" className="w-full bg-slate-50 border-2 border-slate-200 p-3 rounded-xl font-bold text-sm outline-none focus:border-[#00A2FF]" value={schoolSettings?.adminPassword} onChange={e => setSchoolSettings && setSchoolSettings({...schoolSettings!, adminPassword: e.target.value})} />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Password Guru Literasi</label>
                              <input type="password" className="w-full bg-slate-50 border-2 border-slate-200 p-3 rounded-xl font-bold text-sm outline-none focus:border-[#00A2FF]" value={schoolSettings?.teacherLiterasiPassword} onChange={e => setSchoolSettings && setSchoolSettings({...schoolSettings!, teacherLiterasiPassword: e.target.value})} />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Password Guru Numerasi</label>
                              <input type="password" className="w-full bg-slate-50 border-2 border-slate-200 p-3 rounded-xl font-bold text-sm outline-none focus:border-[#00A2FF]" value={schoolSettings?.teacherNumerasiPassword} onChange={e => setSchoolSettings && setSchoolSettings({...schoolSettings!, teacherNumerasiPassword: e.target.value})} />
                          </div>
                      </div>
                  </div>
                  
                  <div className="bg-white p-8 rounded-3xl border-2 border-slate-200 shadow-sm lg:col-span-2">
                      <h3 className="text-lg font-black text-slate-800 uppercase mb-6 flex items-center gap-2"><RefreshCcw size={20}/> Server Sinkronisasi</h3>
                      <div>
                          <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Google Apps Script Web App URL</label>
                          <input className="w-full bg-slate-50 border-2 border-slate-200 p-3 rounded-xl font-mono text-xs text-slate-600 outline-none focus:border-[#00A2FF]" value={currentScriptUrl} onChange={e => onUpdateScriptUrl && onUpdateScriptUrl(e.target.value)} placeholder="https://script.google.com/..." />
                          <p className="text-[10px] text-slate-400 mt-2 font-bold">Pastikan script dideploy sebagai Web App dengan akses 'Anyone'.</p>
                      </div>
                  </div>
              </div>
              
              <div className="mt-8 flex justify-end">
                  <button onClick={() => { onSyncData && onSyncData(); alert("Pengaturan disimpan!"); }} className="bg-[#00B06F] text-white px-8 py-4 rounded-xl font-black uppercase text-lg shadow-lg hover:bg-[#009e63] btn-3d border-b-green-700 flex items-center gap-2"><Save size={20}/> Simpan Semua Pengaturan</button>
              </div>
          </div>
      );
  }

  return null;
};