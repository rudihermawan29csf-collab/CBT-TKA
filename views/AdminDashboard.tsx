import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Student, Teacher, Question, QuestionType, QuestionCategory, QuestionPacket, Exam, Role, SchoolSettings, ExamResult } from '../types';
import { Upload, Download, Trash2, Search, Brain, Save, Settings, Plus, X, List, Layout, FileSpreadsheet, Check, Eye, ChevronLeft, ChevronRight, HelpCircle, Edit2, ImageIcon, Users, UserPlus, BarChart2, TrendingUp, AlertTriangle, Table, PieChart, Layers, FileText, ArrowRight, CalendarClock, PlayCircle, StopCircle, Clock, Activity, RefreshCw, BookOpen, GraduationCap, AlignLeft, Image as LucideImage, AlertOctagon, ShieldAlert, Filter, Smartphone, FileImage, UserX, Sigma, Calculator, Divide, X as MultiplyIcon } from 'lucide-react';
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

  // --- MATH TOOLBAR STATE ---
  // Tracks which input field was last focused so we know where to insert the math formula
  const [lastFocusedField, setLastFocusedField] = useState<{
      name: 'stimulus' | 'question' | 'option' | 'pair-left' | 'pair-right';
      index?: number; // For arrays like options or pairs
      cursorPos?: number;
  } | null>(null);

  // --- Exam Management State ---
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamCategory, setNewExamCategory] = useState<QuestionCategory>(QuestionCategory.LITERASI); // NEW: Category Filter for Exam Creation
  const [newExamPacketId, setNewExamPacketId] = useState('');
  const [newExamDuration, setNewExamDuration] = useState(60);
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
  const [analysisClassFilter, setAnalysisClassFilter] = useState<string>('');

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
  
  // Word/HTML Cleanup Helper
  const cleanWordHtml = (html: string) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || "";
  };

  // --- MATH INSERTION LOGIC ---
  const handleInsertMath = (latex: string) => {
      if (!lastFocusedField) {
          // If no field is focused, default to Question Text
          setNewQuestionText(prev => prev + latex);
          return;
      }

      const { name, index } = lastFocusedField;

      if (name === 'stimulus') {
          setNewStimulus(prev => prev + latex);
      } else if (name === 'question') {
          setNewQuestionText(prev => prev + latex);
      } else if (name === 'option' && typeof index === 'number') {
          const updated = [...newOptions];
          updated[index] = (updated[index] || '') + latex;
          setNewOptions(updated);
      } else if (name === 'pair-left' && typeof index === 'number') {
          const updated = [...matchingPairs];
          updated[index].left = (updated[index].left || '') + latex;
          setMatchingPairs(updated);
      } else if (name === 'pair-right' && typeof index === 'number') {
          // pair-right is usually a dropdown, but keeping logic just in case we change it to text later
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

  // Handle Image Upload (OPTIMIZED FOR GOOGLE DRIVE UPLOAD)
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
                  
                  // NEW: Increased limit to 1024px for decent quality (HD Ready)
                  // The backend will now upload this to Drive, so we don't need to fit in a cell
                  const MAX_SIZE = 1024; 

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
                      // Add white background (prevents transparency issues)
                      ctx.fillStyle = "#FFFFFF";
                      ctx.fillRect(0, 0, width, height);
                      
                      ctx.drawImage(img, 0, 0, width, height);
                      // High Quality JPEG (0.8) for Drive storage
                      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                      
                      setNewQuestionImage(dataUrl);
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
    
    // VALIDASI: Hanya ambil soal sesuai jumlah "Total Soal" pada paket
    const packet = packets.find(p => p.id === newExamPacketId);
    const maxQuestions = packet ? packet.totalQuestions : 999;
    
    const pktQuestions = questions
        .filter(q => q.packetId === newExamPacketId && (q.number || 0) <= maxQuestions) // Pastikan tidak ada soal hantu (misal nomor 11 jika total 10)
        .sort((a, b) => (a.number || 0) - (b.number || 0)); // Urutkan berdasarkan nomor soal

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
          qData.image = newQuestionImage; // This will now use the compressed image
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
          // New Logic for Matching: options contain [Label1, Label2], matchingPairs contains {left: statement, right: answer}
          qData.options = [newOptions[0] || 'Benar', newOptions[1] || 'Salah']; 
          qData.matchingPairs = matchingPairs.filter(p => p.left); 
      }

      // STRICT ID/SLOT CHECK: Find if question already exists for this slot to avoid duplicates
      const existingQIndex = questions.findIndex(q => q.packetId === selectedPacketId && q.number === activeSlot);
      let newQuestions = [...questions];
      
      if (existingQIndex >= 0) {
          // Update Existing Question
          const existingId = newQuestions[existingQIndex].id;
          newQuestions[existingQIndex] = { ...newQuestions[existingQIndex], ...qData };
          setEditingQuestionId(existingId); 
      } else {
          // Create New Question
          const newId = `q-${Date.now()}`;
          newQuestions.push({ ...qData, id: newId } as Question);
          setEditingQuestionId(newId); 
      }

      setQuestions(newQuestions);
      setPackets(prev => prev.map(p => p.id === selectedPacketId ? { ...p, questionTypes: { ...p.questionTypes, [activeSlot]: manualType } } : p));
      
      alert(`Soal No. ${activeSlot} tersimpan. Sinkronisasi dimulai...`); 
      triggerSync(); // Trigger sync
  };

  const prepareSlotForm = (num: number) => {
      setActiveSlot(num);
      const existingQ = questions.find(q => q.packetId === selectedPacketId && q.number === num);
      const pkt = packets.find(p => p.id === selectedPacketId);
      const type = pkt?.questionTypes[num] || QuestionType.SINGLE;
      setManualType(type);
      setLastFocusedField(null); // Reset focus
      
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

          // Strict State Reset based on loaded type
          if (existingQ.type === QuestionType.SINGLE) { 
              setNewOptions(existingQ.options || ['', '', '', '']); 
              setSingleCorrectIndex(existingQ.correctAnswerIndex || 0);
              
              // Reset others
              setComplexCorrectIndices([]);
              setMatchingPairs([{left:'', right: ''}]);
          }
          else if (existingQ.type === QuestionType.COMPLEX) { 
              setNewOptions(existingQ.options || ['', '', '', '']); 
              setComplexCorrectIndices(existingQ.correctAnswerIndices || []);
              
              // Reset others
              setSingleCorrectIndex(0);
              setMatchingPairs([{left:'', right: ''}]);
          }
          else if (existingQ.type === QuestionType.MATCHING) {
              const opts = existingQ.options && existingQ.options.length >= 2 ? existingQ.options : ['Benar', 'Salah', '', ''];
              setNewOptions(opts);
              setMatchingPairs(existingQ.matchingPairs || [{left:'', right: opts[0]}]);
              
              // Reset others
              setSingleCorrectIndex(0);
              setComplexCorrectIndices([]);
          }
      } else {
          setEditingQuestionId(null); 
          setStimulusType('text'); setNewStimulus(''); setNewQuestionImage(''); setNewQuestionText('');
          
          // Reset ALL states for new question to prevent leakage
          setSingleCorrectIndex(0);
          setComplexCorrectIndices([]);
          
          if (type === QuestionType.MATCHING) { 
              setNewOptions(['Benar', 'Salah', '', '']);
              setMatchingPairs([{left:'', right: 'Benar'}]); 
          } else { 
              setNewOptions(['', '', '', '']); 
              setMatchingPairs([{left:'', right: 'Benar'}]); // Default reset
          }
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

  // DATA SISWA
  if (activeTab === 'students') {
    const filteredStudents = students.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (selectedClassFilter === '' || s.class === selectedClassFilter)
    );

    return (
      <div className="p-8 h-full flex flex-col">
        <h2 className="text-2xl font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2"><GraduationCap className="text-yellow-500"/> Data Siswa</h2>
        
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between">
           <div className="flex gap-2 flex-1">
               <div className="relative flex-1 max-w-md">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                   <input className="w-full bg-black border border-slate-700 rounded p-2 pl-10 text-white text-sm" placeholder="Cari Siswa..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
               </div>
               <select className="bg-black border border-slate-700 text-white rounded p-2 text-sm" value={selectedClassFilter} onChange={e=>setSelectedClassFilter(e.target.value)}>
                   <option value="">Semua Kelas</option>
                   {CLASS_LIST.map(c=><option key={c} value={c}>{c}</option>)}
               </select>
           </div>
           <div className="flex gap-2">
               <button onClick={handleDownloadTemplateStudent} className="bg-slate-800 text-white px-3 py-2 rounded text-xs font-bold uppercase border border-slate-600 flex items-center gap-2 hover:bg-slate-700"><Download size={14}/> Template</button>
               <div className="relative">
                   <input type="file" ref={studentFileRef} className="hidden" accept=".xlsx" onChange={handleImportStudentExcel} />
                   <button onClick={() => studentFileRef.current?.click()} className="bg-green-700 text-white px-3 py-2 rounded text-xs font-bold uppercase border border-green-600 flex items-center gap-2 hover:bg-green-600"><FileSpreadsheet size={14}/> Import Excel</button>
               </div>
               <button onClick={() => setShowAddStudentModal(true)} className="bg-blue-600 text-white px-3 py-2 rounded text-xs font-bold uppercase border border-blue-500 flex items-center gap-2 hover:bg-blue-500"><Plus size={14}/> Tambah</button>
           </div>
        </div>

        {/* Table */}
        <div className="bg-slate-900 border border-white/10 rounded overflow-hidden flex-1 flex flex-col">
            <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs text-slate-400 uppercase bg-black sticky top-0">
                        <tr>
                            <th className="px-6 py-3">No</th>
                            <th className="px-6 py-3">Nama</th>
                            <th className="px-6 py-3">Kelas</th>
                            <th className="px-6 py-3">NIS</th>
                            <th className="px-6 py-3">NISN</th>
                            <th className="px-6 py-3 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredStudents.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-500">Tidak ada data siswa.</td></tr>}
                        {filteredStudents.map((s, i) => (
                            <tr key={s.id} className="border-b border-slate-800 hover:bg-white/5">
                                <td className="px-6 py-3">{i+1}</td>
                                <td className="px-6 py-3 font-bold text-white">{s.name}</td>
                                <td className="px-6 py-3"><span className="bg-slate-800 px-2 py-1 rounded text-xs">{s.class}</span></td>
                                <td className="px-6 py-3 font-mono">{s.nis}</td>
                                <td className="px-6 py-3 font-mono">{s.nisn}</td>
                                <td className="px-6 py-3 text-center">
                                    <button onClick={() => handleDeleteStudent(s.id)} className="text-red-500 hover:text-red-400"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="bg-black p-2 border-t border-slate-800 text-xs text-slate-500 px-6">Total: {filteredStudents.length} Siswa</div>
        </div>

        {/* Modal Add Student */}
        {showAddStudentModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="bg-slate-900 border border-slate-700 p-6 rounded w-full max-w-sm">
                    <h3 className="font-bold text-white mb-4">Tambah Siswa Manual</h3>
                    <input className="w-full bg-black border border-slate-700 p-2 mb-2 text-white text-sm" placeholder="Nama Lengkap" value={newStudent.name} onChange={e=>setNewStudent({...newStudent, name:e.target.value})} />
                    <select className="w-full bg-black border border-slate-700 p-2 mb-2 text-white text-sm" value={newStudent.class} onChange={e=>setNewStudent({...newStudent, class:e.target.value})}>
                        <option value="">Pilih Kelas</option>
                        {CLASS_LIST.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                    <input className="w-full bg-black border border-slate-700 p-2 mb-2 text-white text-sm" placeholder="NIS" value={newStudent.nis} onChange={e=>setNewStudent({...newStudent, nis:e.target.value})} />
                    <input className="w-full bg-black border border-slate-700 p-2 mb-4 text-white text-sm" placeholder="NISN" value={newStudent.nisn} onChange={e=>setNewStudent({...newStudent, nisn:e.target.value})} />
                    <div className="flex gap-2">
                        <button onClick={handleAddStudent} className="flex-1 bg-blue-600 text-white py-2 font-bold text-sm">Simpan</button>
                        <button onClick={() => setShowAddStudentModal(false)} className="flex-1 bg-slate-700 text-white py-2 font-bold text-sm">Batal</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    );
  }

  // SETTINGS
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

  // MONITORING
  if (activeTab === 'monitor') {
    const activeExam = exams.find(e => e.id === selectedExamForMonitor);
    // Filter students: Must be in exam target class AND (if filter active) match filter
    const eligibleStudents = activeExam 
      ? students.filter(s => {
          const targetClasses = activeExam.classTarget.map(c => c.replace(/\s/g, '').toUpperCase());
          const sClass = s.class.replace(/\s/g, '').toUpperCase();
          const matchesTarget = targetClasses.includes(sClass);
          const matchesFilter = monitoringClassFilter === '' || s.class === monitoringClassFilter;
          return matchesTarget && matchesFilter;
        })
      : [];
    
    // Map status
    const data = eligibleStudents.map(s => {
        const res = examResults.find(r => r.examId === activeExam?.id && r.studentId === s.id);
        const status = res ? (res.isDisqualified ? 'DISQUALIFIED' : 'SELESAI') : 'BELUM';
        return { ...s, status, score: res?.score || 0, violations: res?.violationCount || 0, timestamp: res?.timestamp };
    });

    // Apply Status Filter
    const filteredData = data.filter(d => {
        if(monitoringStatusFilter === 'finished') return d.status === 'SELESAI' || d.status === 'DISQUALIFIED';
        if(monitoringStatusFilter === 'unfinished') return d.status === 'BELUM';
        if(monitoringStatusFilter === 'suspicious') return d.violations > 0;
        return true;
    });

    return (
        <div className="p-8 h-full flex flex-col">
            <h2 className="text-2xl font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2"><Activity className="text-yellow-500"/> Live Monitoring</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-900 p-4 border border-slate-700">
                    <label className="text-[10px] text-blue-400 uppercase font-bold block mb-1">Pilih Ujian</label>
                    <select className="w-full bg-black text-white border border-slate-700 p-2 text-sm" value={selectedExamForMonitor} onChange={e=>setSelectedExamForMonitor(e.target.value)}>
                        <option value="">-- Pilih Ujian --</option>
                        {exams.filter(e=>e.isActive).map(e=><option key={e.id} value={e.id}>{e.title}</option>)}
                        {exams.filter(e=>e.isActive).length===0 && <option disabled>Tidak ada ujian aktif</option>}
                    </select>
                </div>
                <div className="bg-slate-900 p-4 border border-slate-700">
                    <label className="text-[10px] text-blue-400 uppercase font-bold block mb-1">Filter Kelas</label>
                    <select className="w-full bg-black text-white border border-slate-700 p-2 text-sm" value={monitoringClassFilter} onChange={e=>setMonitoringClassFilter(e.target.value)}>
                        <option value="">Semua Kelas</option>
                        {activeExam?.classTarget.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                 <div className="bg-slate-900 p-4 border border-slate-700">
                    <label className="text-[10px] text-blue-400 uppercase font-bold block mb-1">Status</label>
                    <select className="w-full bg-black text-white border border-slate-700 p-2 text-sm" value={monitoringStatusFilter} onChange={e=>setMonitoringStatusFilter(e.target.value as any)}>
                        <option value="all">Semua Status</option>
                        <option value="finished">Selesai</option>
                        <option value="unfinished">Belum Mengerjakan</option>
                        <option value="suspicious">Terindikasi Curang</option>
                    </select>
                </div>
                <div className="bg-slate-900 p-4 border border-slate-700 flex flex-col justify-center items-center">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Progress</span>
                    <span className="text-2xl font-black text-white">{data.filter(d=>d.status!=='BELUM').length} / {data.length}</span>
                </div>
            </div>

            <div className="bg-slate-900 border border-white/10 rounded overflow-hidden flex-1 flex flex-col">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="w-full text-sm text-left text-slate-300">
                        <thead className="text-xs text-slate-400 uppercase bg-black sticky top-0">
                            <tr>
                                <th className="px-6 py-3">Nama</th>
                                <th className="px-6 py-3">Kelas</th>
                                <th className="px-6 py-3 text-center">Status</th>
                                <th className="px-6 py-3 text-center">Nilai</th>
                                <th className="px-6 py-3 text-center">Pelanggaran</th>
                                <th className="px-6 py-3 text-right">Waktu</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeExam && filteredData.map((s, i) => (
                                <tr key={i} className="border-b border-slate-800 hover:bg-white/5">
                                    <td className="px-6 py-3 font-bold text-white">{s.name}</td>
                                    <td className="px-6 py-3"><span className="bg-slate-800 px-2 py-1 rounded text-xs">{s.class}</span></td>
                                    <td className="px-6 py-3 text-center">
                                        {s.status === 'SELESAI' && <span className="text-green-500 font-bold text-xs bg-green-900/30 px-2 py-1 rounded">SELESAI</span>}
                                        {s.status === 'DISQUALIFIED' && <span className="text-red-500 font-bold text-xs bg-red-900/30 px-2 py-1 rounded">DISKUALIFIKASI</span>}
                                        {s.status === 'BELUM' && <span className="text-slate-500 font-bold text-xs bg-slate-800 px-2 py-1 rounded">BELUM</span>}
                                    </td>
                                    <td className="px-6 py-3 text-center font-mono text-yellow-500 font-bold">{s.status !== 'BELUM' ? Math.round(s.score) : '-'}</td>
                                    <td className="px-6 py-3 text-center">
                                        {s.violations > 0 ? (
                                            <span className="text-red-500 flex items-center justify-center gap-1 font-bold"><AlertTriangle size={12}/> {s.violations}</span>
                                        ) : <span className="text-slate-600">-</span>}
                                    </td>
                                    <td className="px-6 py-3 text-right font-mono text-xs">{s.timestamp ? new Date(s.timestamp).toLocaleTimeString() : '-'}</td>
                                </tr>
                            ))}
                            {!activeExam && <tr><td colSpan={6} className="text-center py-10 text-slate-500">Pilih ujian terlebih dahulu.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
  }

  // ANALISIS
  if (activeTab === 'analysis') {
      const activeExam = exams.find(e => e.id === selectedExamIdForAnalysis);

      return (
          <div className="p-8 h-full flex flex-col">
              <h2 className="text-2xl font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2"><BarChart2 className="text-yellow-500"/> Analisis Hasil</h2>
              
              <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-start md:items-center">
                  <div className="flex gap-2">
                       <select className="bg-black border border-slate-700 text-white rounded p-2 text-sm" value={selectedExamIdForAnalysis} onChange={e=>setSelectedExamIdForAnalysis(e.target.value)}>
                           <option value="">-- Pilih Ujian --</option>
                           {visibleExams.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}
                       </select>
                  </div>
                  {activeExam && (
                      <div className="flex gap-2">
                          <button onClick={() => setAnalysisSubTab('recap')} className={`px-4 py-2 rounded text-xs font-bold uppercase ${analysisSubTab==='recap' ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-white'}`}>Rekap Nilai</button>
                          <button onClick={() => setAnalysisSubTab('item')} className={`px-4 py-2 rounded text-xs font-bold uppercase ${analysisSubTab==='item' ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-white'}`}>Analisis Soal</button>
                      </div>
                  )}
              </div>

              {activeExam ? (
                  <div className="bg-slate-900 border border-white/10 rounded overflow-hidden flex-1 flex flex-col">
                      {/* Toolbar Inside Panel */}
                      <div className="p-4 border-b border-slate-800 flex justify-end">
                           {analysisSubTab === 'recap' ? (
                               <button onClick={handleDownloadRecapExcel} className="text-green-500 text-xs font-bold uppercase flex items-center gap-2 hover:text-green-400"><FileSpreadsheet size={16}/> Download Excel</button>
                           ) : (
                               <button onClick={handleDownloadAnalysisExcel} className="text-green-500 text-xs font-bold uppercase flex items-center gap-2 hover:text-green-400"><FileSpreadsheet size={16}/> Download Analisis</button>
                           )}
                      </div>

                      <div className="overflow-auto flex-1 custom-scrollbar p-4">
                          {analysisSubTab === 'recap' && (
                              <table className="w-full text-sm text-left text-slate-300">
                                  <thead className="text-xs text-slate-400 uppercase bg-black">
                                      <tr>
                                          <th className="px-4 py-2">Rank</th>
                                          <th className="px-4 py-2">Nama</th>
                                          <th className="px-4 py-2">Kelas</th>
                                          <th className="px-4 py-2 text-center">Score</th>
                                          <th className="px-4 py-2 text-center">Literasi</th>
                                          <th className="px-4 py-2 text-center">Numerasi</th>
                                          <th className="px-4 py-2 text-right">Waktu</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {examResults.filter(r => r.examId === activeExam.id).sort((a,b) => b.score - a.score).map((r, i) => (
                                          <tr key={i} className="border-b border-slate-800 hover:bg-white/5">
                                              <td className="px-4 py-2 font-mono text-slate-500">#{i+1}</td>
                                              <td className="px-4 py-2 font-bold text-white">{r.studentName}</td>
                                              <td className="px-4 py-2"><span className="bg-slate-800 px-2 py-0.5 rounded text-[10px]">{r.studentClass}</span></td>
                                              <td className="px-4 py-2 text-center font-black text-yellow-500">{Math.round(r.score)}</td>
                                              <td className="px-4 py-2 text-center text-blue-400">{Math.round(r.literasiScore)}</td>
                                              <td className="px-4 py-2 text-center text-green-400">{Math.round(r.numerasiScore)}</td>
                                              <td className="px-4 py-2 text-right text-xs font-mono">{new Date(r.timestamp).toLocaleString()}</td>
                                          </tr>
                                      ))}
                                      {examResults.filter(r => r.examId === activeExam.id).length === 0 && <tr><td colSpan={7} className="text-center py-10">Belum ada data nilai.</td></tr>}
                                  </tbody>
                              </table>
                          )}

                          {analysisSubTab === 'item' && (
                              <div className="space-y-4">
                                  {activeExam.questions.map((q, idx) => {
                                      const stats = getItemAnalysis(q.id, q);
                                      return (
                                          <div key={q.id} className="bg-black/40 border border-slate-800 p-4 rounded flex gap-4">
                                              <div className={`w-12 h-12 flex items-center justify-center font-black text-lg rounded ${stats.correctRate > 70 ? 'bg-green-600 text-white' : stats.correctRate > 40 ? 'bg-yellow-600 text-black' : 'bg-red-600 text-white'}`}>
                                                  {Math.round(stats.correctRate)}%
                                              </div>
                                              <div className="flex-1">
                                                  <div className="flex justify-between mb-1">
                                                      <span className="font-bold text-white text-sm">Soal No. {idx+1}</span>
                                                      <span className="text-xs text-slate-500">Dijawab Benar: {stats.correctCount} / {stats.totalAttempts} Siswa</span>
                                                  </div>
                                                  <p className="text-slate-400 text-sm line-clamp-2 mb-2">{q.text}</p>
                                                  
                                                  {/* Distractor Bar (Simple) */}
                                                  {q.type === QuestionType.SINGLE && (
                                                      <div className="flex h-2 rounded overflow-hidden bg-slate-800 mt-2">
                                                          {['A','B','C','D'].map((opt, i) => {
                                                              const count = stats.answerDist[i];
                                                              const pct = stats.totalAttempts > 0 ? (count / stats.totalAttempts) * 100 : 0;
                                                              if(pct === 0) return null;
                                                              return (
                                                                  <div key={i} className={`h-full ${i === q.correctAnswerIndex ? 'bg-green-500' : 'bg-red-500 opacity-50'}`} style={{width: `${pct}%`}} title={`${opt}: ${count} (${Math.round(pct)}%)`}></div>
                                                              );
                                                          })}
                                                      </div>
                                                  )}
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                          )}
                      </div>
                  </div>
              ) : (
                  <div className="flex-1 border border-dashed border-slate-700 rounded flex items-center justify-center text-slate-500">
                      Pilih ujian untuk melihat analisis data.
                  </div>
              )}
          </div>
      );
  }

  // BANK SOAL (Existing Logic preserved)
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
                 {/* (Packet Config Form remains the same) */}
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
                                     <div className="flex justify-between">
                                        <h3 className="text-white font-bold">Edit Soal {activeSlot}</h3>
                                        <div className="flex items-center gap-2">
                                            {/* Math Toolbar Container */}
                                            <div className="bg-black border border-slate-600 rounded flex items-center gap-1 p-1">
                                                <button onClick={() => handleInsertMath('$^{}$')} className="p-1 hover:bg-slate-800 text-white rounded text-xs border border-transparent hover:border-slate-500" title="Pangkat">x²</button>
                                                <button onClick={() => handleInsertMath('$_{}$')} className="p-1 hover:bg-slate-800 text-white rounded text-xs border border-transparent hover:border-slate-500" title="Subscript">x₂</button>
                                                <button onClick={() => handleInsertMath('$\\sqrt{}$')} className="p-1 hover:bg-slate-800 text-white rounded text-xs border border-transparent hover:border-slate-500" title="Akar">√x</button>
                                                <button onClick={() => handleInsertMath('$\\frac{a}{b}$')} className="p-1 hover:bg-slate-800 text-white rounded text-xs border border-transparent hover:border-slate-500" title="Pecahan">a/b</button>
                                                <button onClick={() => handleInsertMath('$\\times$')} className="p-1 hover:bg-slate-800 text-white rounded text-xs border border-transparent hover:border-slate-500" title="Kali"><MultiplyIcon size={12}/></button>
                                                <button onClick={() => handleInsertMath('$\\div$')} className="p-1 hover:bg-slate-800 text-white rounded text-xs border border-transparent hover:border-slate-500" title="Bagi"><Divide size={12}/></button>
                                                <button onClick={() => handleInsertMath('$\\pi$')} className="p-1 hover:bg-slate-800 text-white rounded text-xs border border-transparent hover:border-slate-500" title="Pi">π</button>
                                                <button onClick={() => handleInsertMath('$^{\\circ}$')} className="p-1 hover:bg-slate-800 text-white rounded text-xs border border-transparent hover:border-slate-500" title="Derajat">°</button>
                                            </div>
                                            <select 
                                                className="bg-black text-white p-1 text-xs border border-slate-700" 
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
                                                <option value={QuestionType.MATCHING}>Menjodohkan / Benar Salah</option>
                                            </select>
                                        </div>
                                     </div>
                                     
                                     {/* STIMULUS SECTION */}
                                     <div className="space-y-2 border-b border-slate-700 pb-4">
                                         <div className="flex gap-2 mb-2">
                                             <button onClick={() => setStimulusType('text')} className={`text-xs px-3 py-1 rounded ${stimulusType === 'text' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Teks</button>
                                             <button onClick={() => setStimulusType('image')} className={`text-xs px-3 py-1 rounded ${stimulusType === 'image' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Gambar</button>
                                         </div>
                                         
                                         {stimulusType === 'text' ? (
                                             <textarea 
                                                className="w-full bg-black p-2 text-white border border-slate-700 font-serif leading-relaxed focus:border-yellow-500 focus:outline-none" 
                                                rows={4} 
                                                placeholder="Masukkan teks stimulus di sini..." 
                                                value={newStimulus} 
                                                onFocus={() => setLastFocusedField({ name: 'stimulus' })}
                                                onChange={e=>setNewStimulus(cleanWordHtml(e.target.value))}
                                             />
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
                                         <textarea 
                                            className="w-full bg-black p-2 text-white border border-slate-700 font-medium focus:border-yellow-500 focus:outline-none" 
                                            rows={3} 
                                            placeholder="Pertanyaan..." 
                                            value={newQuestionText} 
                                            onFocus={() => setLastFocusedField({ name: 'question' })}
                                            onChange={e=>setNewQuestionText(cleanWordHtml(e.target.value))}
                                         />
                                     </div>
                                     
                                     {/* ANSWER INPUTS */}
                                     <div className="border-t border-slate-700 pt-4">
                                         <label className="text-xs text-slate-400 block mb-2">Jawaban ({manualType})</label>
                                         
                                         {manualType === QuestionType.SINGLE && newOptions.map((o,i)=>(
                                             <div key={i} className="flex gap-2 mb-2">
                                                 <button onClick={()=>setSingleCorrectIndex(i)} className={`w-8 h-8 flex items-center justify-center border ${singleCorrectIndex===i?'bg-green-600 border-green-500 text-white':'bg-slate-800 border-slate-700 text-slate-500'}`}>{String.fromCharCode(65+i)}</button>
                                                 <input 
                                                    className="flex-1 bg-black p-1 text-white text-sm border border-slate-700 focus:border-yellow-500 focus:outline-none" 
                                                    value={o} 
                                                    onFocus={() => setLastFocusedField({ name: 'option', index: i })}
                                                    onChange={e=>{const c=[...newOptions];c[i]=e.target.value;setNewOptions(c)}}
                                                 />
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
                                                 <input 
                                                    className="flex-1 bg-black p-1 text-white text-sm border border-slate-700 focus:border-yellow-500 focus:outline-none" 
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
                                                         <label className="text-[10px] text-blue-400 font-bold uppercase mb-1 block">Label Kolom 1 (Misal: Benar/Sesuai)</label>
                                                         <input className="w-full bg-black p-2 text-white text-sm border border-slate-700" placeholder="Contoh: Benar" value={newOptions[0]} onChange={e => {const n = [...newOptions]; n[0] = e.target.value; setNewOptions(n)}} />
                                                     </div>
                                                     <div>
                                                         <label className="text-[10px] text-red-400 font-bold uppercase mb-1 block">Label Kolom 2 (Misal: Salah/Tidak Sesuai)</label>
                                                         <input className="w-full bg-black p-2 text-white text-sm border border-slate-700" placeholder="Contoh: Salah" value={newOptions[1]} onChange={e => {const n = [...newOptions]; n[1] = e.target.value; setNewOptions(n)}} />
                                                     </div>
                                                 </div>
                                                 
                                                 <div className="bg-slate-800/30 p-2 rounded">
                                                     <label className="text-[10px] text-slate-400 font-bold uppercase mb-2 block">Daftar Pernyataan & Kunci Jawaban</label>
                                                     {matchingPairs.map((pair, idx) => (
                                                         <div key={idx} className="flex gap-2 items-center mb-2">
                                                             <span className="text-slate-500 font-mono text-xs w-6 text-center">{idx+1}.</span>
                                                             <input 
                                                                className="flex-1 bg-black p-2 text-white text-sm border border-slate-700 focus:border-yellow-500 focus:outline-none" 
                                                                placeholder="Isi Pernyataan..." 
                                                                value={pair.left} 
                                                                onFocus={() => setLastFocusedField({ name: 'pair-left', index: idx })}
                                                                onChange={e => {const n = [...matchingPairs]; n[idx].left = e.target.value; setMatchingPairs(n)}} 
                                                             />
                                                             <div className="w-32">
                                                                <select className="w-full bg-black text-white p-2 text-sm border border-slate-700 cursor-pointer" value={pair.right} onChange={e => {const n = [...matchingPairs]; n[idx].right = e.target.value; setMatchingPairs(n)}}>
                                                                    <option value={newOptions[0]}>{newOptions[0] || 'Opsi 1'}</option>
                                                                    <option value={newOptions[1]}>{newOptions[1] || 'Opsi 2'}</option>
                                                                </select>
                                                             </div>
                                                             <button onClick={() => setMatchingPairs(matchingPairs.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-400 p-2"><X size={14}/></button>
                                                         </div>
                                                     ))}
                                                     <button onClick={() => setMatchingPairs([...matchingPairs, {left:'', right: newOptions[0]}])} className="text-xs bg-blue-600/20 text-blue-400 px-3 py-1 rounded font-bold hover:bg-blue-600/30">+ Tambah Pernyataan</button>
                                                 </div>
                                             </div>
                                         )}
                                     </div>

                                     {/* PREVIEW BOX */}
                                     <div className="mt-6 bg-slate-800/50 p-4 border border-slate-700 rounded-lg">
                                         <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Preview Tampilan Soal</p>
                                         {stimulusType === 'image' && newQuestionImage && <img src={newQuestionImage} className="max-h-32 mb-2 rounded border border-slate-600"/>}
                                         
                                         {/* Markdown Render for Stimulus */}
                                         {stimulusType === 'text' && newStimulus && (
                                            <div className="text-sm text-slate-300 mb-2 italic bg-black/20 p-2 border-l-2 border-blue-500 prose prose-invert max-w-none">
                                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{newStimulus}</ReactMarkdown>
                                            </div>
                                         )}
                                         
                                         {/* Markdown Render for Question Text */}
                                         <div className="text-white font-bold text-sm mb-4 prose prose-invert max-w-none">
                                             <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{newQuestionText || "[Teks Pertanyaan]"}</ReactMarkdown>
                                         </div>
                                         
                                         {/* OPTION PREVIEW */}
                                         {manualType === QuestionType.SINGLE && (
                                             <div className="mt-3 space-y-2">
                                                 {newOptions.map((opt, i) => (
                                                     <div key={i} className={`p-2 rounded border text-xs flex items-center gap-2 ${singleCorrectIndex === i ? 'bg-green-900/30 border-green-600 text-green-400' : 'border-slate-700 text-slate-400'}`}>
                                                         <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${singleCorrectIndex === i ? 'border-green-500 bg-green-500 text-black' : 'border-slate-500'}`}>
                                                             {singleCorrectIndex === i && <div className="w-2 h-2 bg-black rounded-full" />}
                                                         </div>
                                                         {/* Markdown for Options */}
                                                         <span className="flex-1">
                                                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{p: 'span'}}>{opt || `Opsi ${String.fromCharCode(65+i)}`}</ReactMarkdown>
                                                         </span>
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
                                                         <span className="flex-1">
                                                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{p: 'span'}}>{opt || `Opsi ${i+1}`}</ReactMarkdown>
                                                         </span>
                                                     </div>
                                                 ))}
                                             </div>
                                         )}
                                         {manualType === QuestionType.MATCHING && (
                                             <div className="mt-3 border border-slate-700 rounded overflow-hidden">
                                                 <table className="w-full text-xs text-slate-300">
                                                     <thead className="bg-slate-900 text-slate-400 font-bold uppercase">
                                                         <tr>
                                                             <th className="p-2 w-8 text-center border-r border-slate-700">No</th>
                                                             <th className="p-2 text-left border-r border-slate-700">Pernyataan</th>
                                                             <th className="p-2 text-center w-20 bg-green-900/20 text-green-500 border-r border-slate-700">{newOptions[0] || 'Opsi 1'}</th>
                                                             <th className="p-2 text-center w-20 bg-red-900/20 text-red-500">{newOptions[1] || 'Opsi 2'}</th>
                                                         </tr>
                                                     </thead>
                                                     <tbody>
                                                         {matchingPairs.map((pair, i) => (
                                                             <tr key={i} className="border-b border-slate-800 last:border-0 hover:bg-white/5">
                                                                 <td className="p-2 text-center border-r border-slate-800 font-mono text-slate-500">{i+1}</td>
                                                                 <td className="p-2 border-r border-slate-800">
                                                                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{p: 'span'}}>{pair.left || '-'}</ReactMarkdown>
                                                                 </td>
                                                                 <td className="p-2 text-center border-r border-slate-800">
                                                                     <div className={`w-4 h-4 rounded-full border mx-auto flex items-center justify-center ${pair.right === newOptions[0] ? 'bg-green-500 border-green-400' : 'border-slate-600'}`}>
                                                                         {pair.right === newOptions[0] && <div className="w-2 h-2 bg-black rounded-full"/>}
                                                                     </div>
                                                                 </td>
                                                                 <td className="p-2 text-center">
                                                                     <div className={`w-4 h-4 rounded-full border mx-auto flex items-center justify-center ${pair.right === newOptions[1] ? 'bg-red-500 border-red-400' : 'border-slate-600'}`}>
                                                                         {pair.right === newOptions[1] && <div className="w-2 h-2 bg-black rounded-full"/>}
                                                                     </div>
                                                                 </td>
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

  // (Exam Tab remains unchanged)
  if (activeTab === 'exams') {
      return (
          <div className="p-8 h-full flex flex-col">
              <h2 className="text-2xl font-black text-white uppercase mb-6"><CalendarClock className="inline mr-2 text-yellow-500"/> Jadwal Ujian</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
                  <div className="bg-slate-900 p-6 border border-white/10 h-fit">
                      <h3 className="font-bold text-white mb-4">Buat Jadwal</h3>
                      <input className="w-full bg-black p-2 mb-2 text-white border border-slate-700" placeholder="Nama Ujian" value={newExamTitle} onChange={e=>setNewExamTitle(e.target.value)}/>
                      
                      {/* NEW: Category Selector */}
                      <div className="mb-2">
                        <label className="text-[10px] text-blue-400 font-bold uppercase mb-1 block">Kategori</label>
                        <select 
                            className="w-full bg-black p-2 text-white border border-slate-700 text-sm" 
                            value={newExamCategory} 
                            onChange={e => {
                                setNewExamCategory(e.target.value as QuestionCategory);
                                setNewExamPacketId(''); // Reset packet selection when category changes
                            }}
                        >
                            <option value={QuestionCategory.LITERASI}>Literasi</option>
                            <option value={QuestionCategory.NUMERASI}>Numerasi</option>
                        </select>
                      </div>

                      <div className="mb-2">
                        <label className="text-[10px] text-blue-400 font-bold uppercase mb-1 block">Pilih Paket Soal</label>
                        <select 
                            className="w-full bg-black p-2 text-white border border-slate-700 text-sm" 
                            value={newExamPacketId} 
                            onChange={e=>setNewExamPacketId(e.target.value)}
                        >
                            <option value="">-- Pilih Paket {newExamCategory} --</option>
                            {visiblePackets
                                .filter(p => p.category === newExamCategory) // Apply filter based on selected category
                                .map(p=><option key={p.id} value={p.id}>{p.name} ({p.totalQuestions} Soal)</option>)
                            }
                        </select>
                      </div>

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
