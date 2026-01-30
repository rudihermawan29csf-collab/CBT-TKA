import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Student, Teacher, Question, QuestionType, QuestionCategory, QuestionPacket, Exam, Role, SchoolSettings, ExamResult } from '../types';
import { Upload, Download, Trash2, Search, Brain, Save, Settings, Plus, X, List, Layout, FileSpreadsheet, Check, Eye, ChevronLeft, ChevronRight, HelpCircle, Edit2, ImageIcon, Users, UserPlus, BarChart2, TrendingUp, AlertTriangle, Table, PieChart, Layers, FileText, ArrowRight, CalendarClock, PlayCircle, StopCircle, Clock, Activity, RefreshCw, BookOpen, GraduationCap, AlignLeft, Image as LucideImage, AlertOctagon, ShieldAlert, Filter, Smartphone } from 'lucide-react';
import { CLASS_LIST } from '../constants';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth'; 
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  examResults?: ExamResult[]; // Add exam results for analysis
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  userRole = Role.ADMIN, students, setStudents, teachers, setTeachers, questions, setQuestions, exams = [], setExams, activeTab,
  packets, setPackets, schoolSettings, setSchoolSettings, onSyncData, examResults = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const studentFileRef = useRef<HTMLInputElement>(null);
  const excelQuestionInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null); 

  // --- Student Management State ---
  const [selectedClassFilter, setSelectedClassFilter] = useState(''); 
  const [showAddStudentModal, setShowAddStudentModal] = useState(false); 
  const [showImportModal, setShowImportModal] = useState(false); 
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
  const [mediaType, setMediaType] = useState<'text' | 'image'>('text');

  const [newStimulus, setNewStimulus] = useState(''); 
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionImage, setNewQuestionImage] = useState('');
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
  const [monitoringData, setMonitoringData] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // --- Analysis State ---
  const [analysisSubTab, setAnalysisSubTab] = useState<'item' | 'recap'>('item');
  const [selectedExamIdForAnalysis, setSelectedExamIdForAnalysis] = useState<string>('');
  const [selectedClassForRecap, setSelectedClassForRecap] = useState<string>(CLASS_LIST[0]);

  // Ensure default selection when exams load
  useEffect(() => {
      if (exams.length > 0 && !selectedExamIdForAnalysis) {
          setSelectedExamIdForAnalysis(exams[0].id);
      }
  }, [exams, selectedExamIdForAnalysis]);

  const selectedExamForAnalysis = useMemo(() => 
      exams.find(e => e.id === selectedExamIdForAnalysis),
  [exams, selectedExamIdForAnalysis]);

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

  // Set default category based on role when component mounts
  useEffect(() => {
      if (userRole === Role.TEACHER_LITERASI) setNewPacketCategory(QuestionCategory.LITERASI);
      else if (userRole === Role.TEACHER_NUMERASI) setNewPacketCategory(QuestionCategory.NUMERASI);
  }, [userRole]);

  // --- ACTIONS (WITH SYNC TRIGGER) ---

  const triggerSync = () => {
      if (onSyncData) onSyncData();
  };

  const handleCreateExam = () => {
    if (!newExamTitle || !newExamPacketId || !newExamStart || !newExamEnd || newExamClasses.length === 0) {
      alert("Mohon lengkapi semua data ujian.");
      return;
    }
    const pktQuestions = questions.filter(q => q.packetId === newExamPacketId);
    if (pktQuestions.length === 0) {
        alert("Paket soal ini masih kosong.");
        return;
    }
    const newExam: Exam = {
        id: `exam-${Date.now()}`,
        title: newExamTitle,
        packetId: newExamPacketId,
        durationMinutes: newExamDuration,
        classTarget: newExamClasses,
        scheduledStart: newExamStart,
        scheduledEnd: newExamEnd,
        questions: pktQuestions, 
        isActive: true
    };
    if (setExams) setExams([...exams, newExam]);
    alert("Ujian berhasil dijadwalkan!");
    setNewExamTitle(''); setNewExamPacketId(''); setNewExamClasses([]); setNewExamStart(''); setNewExamEnd('');
    triggerSync();
  };

  const handleDeleteExam = (id: string) => {
      if (confirm('Yakin hapus jadwal ujian ini?')) {
          if (setExams) setExams(exams.filter(e => e.id !== id));
          triggerSync();
      }
  };

  const toggleExamStatus = (id: string) => {
      if (setExams) setExams(exams.map(e => e.id === id ? { ...e, isActive: !e.isActive } : e));
      triggerSync();
  };

  const handleAddStudent = () => {
      if (!newStudent.name || !newStudent.class || !newStudent.nis) { alert("Nama, Kelas, dan NIS wajib diisi!"); return; }
      const student: Student = { id: `s-${Date.now()}`, no: students.length + 1, name: newStudent.name, class: newStudent.class, nis: newStudent.nis, nisn: newStudent.nisn || '-' };
      setStudents([...students, student]); 
      setNewStudent({ name: '', class: '', nis: '', nisn: '' }); 
      alert("Siswa berhasil ditambahkan!");
      setShowAddStudentModal(false);
      triggerSync();
  };

  const handleDeleteStudent = (id: string) => { 
      if(confirm('Yakin hapus data siswa ini?')) {
          setStudents(students.filter(s => s.id !== id));
          triggerSync();
      }
  };

  const handleImportStudentExcel = (e: React.ChangeEvent<HTMLInputElement>) => { 
      const file = e.target.files?.[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws);
          const newStudents = data.map((d: any, idx) => ({
              id: `imp-${Date.now()}-${idx}`,
              no: idx + 1,
              name: d.Nama || d.NAME || d.nama || 'Siswa',
              class: d.Kelas || d.CLASS || d.kelas || 'VII A',
              nis: String(d.NIS || d.nis || Math.floor(Math.random()*10000)),
              nisn: String(d.NISN || d.nisn || '-')
          }));
          setStudents([...students, ...newStudents]);
          alert(`Berhasil import ${newStudents.length} siswa`);
          setShowImportModal(false);
          triggerSync();
      };
      reader.readAsBinaryString(file);
      if(studentFileRef.current) studentFileRef.current.value = '';
  };

  const handleSavePacket = () => {
    if (!newPacketName || !newPacketTotal) { alert("Nama paket dan total soal harus diisi"); return; }
    let types: Record<number, QuestionType> = {};
    if (editingPacketId) {
        const existing = packets.find(p => p.id === editingPacketId);
        types = existing?.questionTypes || {};
    } else {
        for(let i=1; i<= Number(newPacketTotal); i++) { types[i] = QuestionType.SINGLE; }
    }
    const updatedPacket: QuestionPacket = {
        id: editingPacketId || `pkt-${Date.now()}`,
        name: newPacketName,
        category: newPacketCategory,
        totalQuestions: Number(newPacketTotal),
        questionTypes: types
    };
    if (editingPacketId) {
      setPackets(packets.map(p => p.id === editingPacketId ? updatedPacket : p));
      alert("Paket soal berhasil diperbarui!");
    } else {
      setPackets([...packets, updatedPacket]);
      alert("Paket soal berhasil dibuat!");
      setSelectedPacketId(updatedPacket.id);
      if (!editingPacketId) setBankSubTab('input');
    }
    setNewPacketName(''); setNewPacketTotal(''); setEditingPacketId(null);
    triggerSync();
  };

  const deletePacket = (id: string) => {
    if (confirm("Apakah Anda yakin menghapus paket ini?")) {
      setPackets(packets.filter(p => p.id !== id));
      setQuestions(questions.filter(q => q.packetId !== id));
      if (selectedPacketId === id) setSelectedPacketId('');
      if (editingPacketId === id) { setNewPacketName(''); setEditingPacketId(null); }
      triggerSync();
    }
  };

  const handleSaveQuestionSlot = () => {
      if (!selectedPacketId || activeSlot === null) return;
      if (!newQuestionText) { alert("Pertanyaan wajib diisi"); return; }
      
      // Update the question object
      const questionData: Partial<Question> = {
          packetId: selectedPacketId,
          number: activeSlot,
          stimulus: mediaType === 'text' ? newStimulus : '',
          text: newQuestionText,
          image: newQuestionImage,
          type: manualType, // Use the selected manual type
          category: packets.find(p => p.id === selectedPacketId)?.category
      };
      if (mediaType === 'image') questionData.stimulus = '';
      if (mediaType === 'text') questionData.image = '';

      if (manualType === QuestionType.SINGLE) {
        if(newOptions.some(o => !o.trim())) { alert('Isi semua opsi!'); return; }
        questionData.options = newOptions; questionData.correctAnswerIndex = singleCorrectIndex;
      } else if (manualType === QuestionType.COMPLEX) {
        if(newOptions.some(o => !o.trim())) { alert('Isi semua opsi!'); return; }
        if(complexCorrectIndices.length === 0) { alert('Pilih minimal satu jawaban benar!'); return; }
        questionData.options = newOptions; questionData.correctAnswerIndices = complexCorrectIndices;
      } else if (manualType === QuestionType.MATCHING) {
        if(matchingPairs.some(p => !p.left.trim() || !p.right.trim())) { alert('Isi semua pernyataan dan kunci jawaban!'); return; }
        questionData.options = [newOptions[0] || 'Benar', newOptions[1] || 'Salah']; questionData.matchingPairs = matchingPairs;
      }

      // Update Questions State
      if (editingQuestionId) {
          setQuestions(prev => prev.map(q => q.id === editingQuestionId ? { ...q, ...questionData } as Question : q));
      } else {
          const newQ = { ...questionData, id: `q-${Date.now()}` } as Question;
          setQuestions(prev => [...prev, newQ]);
      }

      // CRITICAL: Also update the Packet's questionTypes record to persist this choice
      setPackets(prevPackets => prevPackets.map(p => {
          if (p.id === selectedPacketId) {
              return {
                  ...p,
                  questionTypes: {
                      ...p.questionTypes,
                      [activeSlot]: manualType
                  }
              };
          }
          return p;
      }));

      alert(`Soal No. ${activeSlot} (${manualType}) disimpan`);
      // Optional: Auto advance to next slot could go here
      triggerSync();
  };

  // --- NEW: EXCEL IMPORT/EXPORT FOR QUESTIONS ---
  
  const handleDownloadExcelTemplate = () => {
      const data = [
          ["No", "Jenis (1=PG, 2=PGK, 3=Jodoh)", "Stimulus", "Pertanyaan", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Opsi E", "Kunci (A/B/C/D atau Index)"],
          [1, 1, "Teks Stimulus...", "Pertanyaan Pilihan Ganda?", "Opsi 1", "Opsi 2", "Opsi 3", "Opsi 4", "", "A"],
          [2, 2, "", "Pertanyaan PG Kompleks?", "Opsi 1", "Opsi 2", "Opsi 3", "Opsi 4", "", "A,C"],
          [3, 3, "", "Pertanyaan Jodohkan (Abaikan Opsi)", "", "", "", "", "", "Kiri1=Kanan1, Kiri2=Kanan2"]
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template Soal");
      XLSX.writeFile(wb, "Template_Soal_Excel.xlsx");
  };

  const handleImportExcelQuestions = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!selectedPacketId) { alert("Pilih paket soal terlebih dahulu!"); return; }

      const reader = new FileReader();
      reader.onload = (evt) => {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          // Convert to JSON array of arrays, starting from row 2 (skip header)
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1) as any[][];
          
          const importedQuestions: Question[] = [];
          
          rows.forEach((row, idx) => {
              // Map columns based on template
              // 0: No, 1: Jenis, 2: Stimulus, 3: Pertanyaan, 4-8: Opsi, 9: Kunci
              const typeCode = parseInt(row[1]) || 1;
              const stimulus = row[2] ? String(row[2]) : '';
              const text = row[3] ? String(row[3]) : `Pertanyaan ${idx+1}`;
              const options = [row[4], row[5], row[6], row[7]].filter(o => o !== undefined && o !== null).map(String);
              const keyRaw = row[9] ? String(row[9]).trim() : '';

              let qType = QuestionType.SINGLE;
              let correctIndex = 0;
              let correctIndices: number[] = [];
              let matchingPairs: {left:string, right:string}[] = [];

              if (typeCode === 1) { // SINGLE
                  qType = QuestionType.SINGLE;
                  const map: Record<string, number> = {'A':0, 'B':1, 'C':2, 'D':3, 'E':4};
                  correctIndex = map[keyRaw.toUpperCase()] || 0;
              } else if (typeCode === 2) { // COMPLEX
                  qType = QuestionType.COMPLEX;
                  const keys = keyRaw.split(',').map(k => k.trim().toUpperCase());
                  const map: Record<string, number> = {'A':0, 'B':1, 'C':2, 'D':3, 'E':4};
                  keys.forEach(k => { if(map[k] !== undefined) correctIndices.push(map[k]); });
              } else if (typeCode === 3) { // MATCHING
                  qType = QuestionType.MATCHING;
                  // Format Kunci: "Kiri=Kanan, Kiri2=Kanan2"
                  const pairs = keyRaw.split(',').map(p => p.trim());
                  pairs.forEach(p => {
                      const [l, r] = p.split('=').map(s => s.trim());
                      if(l && r) matchingPairs.push({left: l, right: r});
                  });
              }

              if (text) {
                  importedQuestions.push({
                      id: `imp-xl-${Date.now()}-${idx}`,
                      packetId: selectedPacketId,
                      number: importedQuestions.length + 1, // Temporary number, ideally check active slot
                      stimulus,
                      text,
                      type: qType,
                      options,
                      correctAnswerIndex: correctIndex,
                      correctAnswerIndices: correctIndices,
                      matchingPairs: matchingPairs.length > 0 ? matchingPairs : undefined
                  });
              }
          });

          if (importedQuestions.length > 0) {
              setQuestions(prev => [...prev, ...importedQuestions]);
              alert(`Berhasil mengimpor ${importedQuestions.length} soal dari Excel!`);
              triggerSync();
          } else {
              alert("Gagal membaca file atau file kosong.");
          }
      };
      reader.readAsBinaryString(file);
      if(excelQuestionInputRef.current) excelQuestionInputRef.current.value = '';
  };

  const handleDownloadStudentTemplate = () => { 
     const ws = XLSX.utils.json_to_sheet([{ No: 1, Nama: "Contoh Siswa", Kelas: "IX A", NIS: "12345", NISN: "00123" }]);
     const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "TemplateSiswa");
     XLSX.writeFile(wb, "Template_Siswa.xlsx");
  };
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setNewQuestionImage(reader.result as string); };
      reader.readAsDataURL(file);
    }
  };
  const handleRemoveImage = () => { setNewQuestionImage(''); if (imageInputRef.current) imageInputRef.current.value = ''; };

  const handleAddPair = () => {
    setMatchingPairs([...matchingPairs, { left: '', right: '' }]);
  };

  const handleRemovePair = (index: number) => {
    if (matchingPairs.length > 1) {
      setMatchingPairs(matchingPairs.filter((_, i) => i !== index));
    }
  };
  
  const prepareSlotForm = (num: number) => {
      setActiveSlot(num);
      const existingQ = questions.find(q => q.packetId === selectedPacketId && q.number === num);
      const selectedPacket = packets.find(p => p.id === selectedPacketId);
      const typeForSlot = selectedPacket?.questionTypes[num] || QuestionType.SINGLE;
      setManualType(typeForSlot);
      if (existingQ) {
          setEditingQuestionId(existingQ.id); setNewStimulus(existingQ.stimulus || ''); setNewQuestionText(existingQ.text); setNewQuestionImage(existingQ.image || '');
          if (existingQ.image) setMediaType('image'); else setMediaType('text');
          if (existingQ.type === QuestionType.SINGLE) { setNewOptions(existingQ.options || ['', '', '', '']); setSingleCorrectIndex(existingQ.correctAnswerIndex || 0); }
          else if (existingQ.type === QuestionType.COMPLEX) { setNewOptions(existingQ.options || ['', '', '', '']); setComplexCorrectIndices(existingQ.correctAnswerIndices || []); }
          else if (existingQ.type === QuestionType.MATCHING) { setNewOptions(existingQ.options || ['Benar', 'Salah']); setMatchingPairs(existingQ.matchingPairs || [{left: '', right: ''}]); }
      } else {
          setEditingQuestionId(null); setNewStimulus(''); setNewQuestionText(''); setNewQuestionImage(''); setMediaType('text');
          if (typeForSlot === QuestionType.MATCHING) { setNewOptions(['Benar', 'Salah']); setMatchingPairs([{left: '', right: ''}]); }
          else { setNewOptions(['', '', '', '']); setSingleCorrectIndex(0); setComplexCorrectIndices([]); }
      }
  };
  const handleEditPacket = (pkt: QuestionPacket) => { setNewPacketName(pkt.name); setNewPacketCategory(pkt.category); setNewPacketTotal(pkt.totalQuestions); setEditingPacketId(pkt.id); };

  const handleDownloadAnalysisExcel = () => { 
      if(!selectedExamForAnalysis) { alert("Pilih ujian terlebih dahulu!"); return; }
      
      const data = selectedExamForAnalysis.questions.map((q, idx) => ({
          "No": idx + 1, 
          "Pertanyaan": q.text.substring(0,100), 
          "Tipe": q.type,
          "Kunci Jawaban": q.type === QuestionType.SINGLE ? String.fromCharCode(65 + (q.correctAnswerIndex || 0)) : '-'
      }));
      
      const ws = XLSX.utils.json_to_sheet(data); 
      const wb = XLSX.utils.book_new(); 
      XLSX.utils.book_append_sheet(wb, ws, "Analisis Butir Soal"); 
      XLSX.writeFile(wb, `Analisis_${selectedExamForAnalysis.title.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleRefreshMonitor = () => { if(selectedExamForMonitor) { const data = generateLiveMonitoringData(selectedExamForMonitor); setMonitoringData(data); setLastUpdated(new Date()); } };
  const generateLiveMonitoringData = (examId: string) => { 
      const exam = exams.find(e => e.id === examId);
      if(!exam) return [];
      return students.filter(s => exam.classTarget.includes(s.class)).map(s => ({
          student: s, status: Math.random() > 0.5 ? 'WORKING' : 'OFFLINE', violationCount: Math.random() > 0.8 ? 1 : 0, score: 0, answers: []
      }));
  };
  
  // Real results for the selected exam
  const realResults = useMemo(() => {
     if(!selectedExamForAnalysis) return [];
     return examResults.filter(r => r.examId === selectedExamForAnalysis.id);
  }, [selectedExamForAnalysis, examResults]);

  const handleDownloadRecapExcel = () => { 
      if(!selectedExamForAnalysis) { alert("Pilih ujian terlebih dahulu!"); return; }
      if(realResults.length === 0) { alert("Belum ada data hasil ujian."); return; }

      const data = realResults.map((r,i) => ({
          "No": i+1, 
          "Nama Siswa": r.studentName, 
          "Kelas": r.studentClass,
          "Nilai Literasi": r.literasiScore.toFixed(2),
          "Nilai Numerasi": r.numerasiScore.toFixed(2),
          "Nilai Akhir": r.score.toFixed(2),
          "Waktu Submit": new Date(r.timestamp).toLocaleString()
      }));
      const ws = XLSX.utils.json_to_sheet(data); 
      const wb = XLSX.utils.book_new(); 
      XLSX.utils.book_append_sheet(wb, ws, "Rekap Nilai"); 
      XLSX.writeFile(wb, `Rekap_${selectedExamForAnalysis.title.replace(/\s+/g, '_')}.xlsx`);
  };


  // --- RENDER VIEWS ---

  if (activeTab === 'dashboard') {
    return (
      <div className="p-8 h-full overflow-y-auto">
        <h2 className="text-3xl font-black mb-6 text-white uppercase tracking-wider flex items-center gap-3">
            <span className="w-2 h-8 bg-yellow-500 block"></span>
            Dashboard {userRole === Role.ADMIN ? 'Admin' : (userRole === Role.TEACHER_LITERASI ? 'Guru Literasi' : 'Guru Numerasi')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/80 p-6 border border-white/10 relative overflow-hidden group">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Total Siswa</h3>
            <p className="text-5xl font-black text-blue-500">{students.length}</p>
          </div>
          <div className="bg-slate-900/80 p-6 border border-white/10 relative overflow-hidden group">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Total Soal</h3>
            <p className="text-5xl font-black text-purple-500">{questions.length}</p>
          </div>
          <div className="bg-slate-900/80 p-6 border border-white/10 relative overflow-hidden group">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Ujian Terjadwal</h3>
            <p className="text-5xl font-black text-green-500">{exams.length}</p>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'settings') {
      return (
          <div className="p-8 h-full flex flex-col overflow-y-auto">
              <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-wider mb-6"><Settings className="text-yellow-500"/> Pengaturan Sekolah</h2>
              <div className="max-w-2xl bg-slate-900/80 border border-white/10 p-8 rounded-lg shadow-xl">
                  <div className="space-y-6">
                      <div>
                          <label className="text-xs font-bold text-blue-400 uppercase tracking-widest block mb-2">Nama Sekolah</label>
                          <input type="text" className="w-full bg-black/50 border border-slate-700 p-3 text-white text-sm outline-none" value={schoolSettings?.schoolName || ''} onChange={e => setSchoolSettings && setSchoolSettings({...schoolSettings!, schoolName: e.target.value})} />
                      </div>
                      <div className="border-t border-white/10 pt-4">
                          <label className="text-xs font-bold text-yellow-500 uppercase tracking-widest block mb-4">Pengaturan Akun</label>
                          <div className="space-y-4">
                              <div>
                                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Password Admin Utama</label>
                                  <input type="text" className="w-full bg-black/50 border border-slate-700 p-3 text-white text-sm outline-none" value={schoolSettings?.adminPassword || ''} onChange={e => setSchoolSettings && setSchoolSettings({...schoolSettings!, adminPassword: e.target.value})} />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Pass. Guru Literasi</label>
                                      <input type="text" className="w-full bg-black/50 border border-slate-700 p-3 text-white text-sm outline-none" value={schoolSettings?.teacherLiterasiPassword || ''} onChange={e => setSchoolSettings && setSchoolSettings({...schoolSettings!, teacherLiterasiPassword: e.target.value})} />
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Pass. Guru Numerasi</label>
                                      <input type="text" className="w-full bg-black/50 border border-slate-700 p-3 text-white text-sm outline-none" value={schoolSettings?.teacherNumerasiPassword || ''} onChange={e => setSchoolSettings && setSchoolSettings({...schoolSettings!, teacherNumerasiPassword: e.target.value})} />
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="pt-4 border-t border-white/10 flex justify-end">
                          <button className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-widest text-xs rounded flex items-center gap-2" onClick={() => { alert("Pengaturan berhasil disimpan!"); triggerSync(); }}><Save size={16}/> Simpan</button>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  if (activeTab === 'monitor') {
     return (
          <div className="p-8 h-full flex flex-col overflow-y-auto">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-wider"><Activity className="text-red-500"/> Monitoring Ujian Live</h2>
                <button onClick={handleRefreshMonitor} className="px-4 py-2 bg-blue-600 text-white font-bold rounded text-xs flex items-center gap-2"><RefreshCw size={14}/> Refresh</button>
             </div>
             <div className="bg-slate-900/80 p-6 border border-white/10 mb-6">
                 <select value={selectedExamForMonitor} onChange={(e) => setSelectedExamForMonitor(e.target.value)} className="bg-black text-white p-3 border border-slate-700 w-full md:w-1/2 outline-none">
                     <option value="">-- Pilih Jadwal Ujian --</option>
                     {exams.filter(e => e.isActive).map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                 </select>
             </div>
             {selectedExamForMonitor && monitoringData.length > 0 && (
                 <div className="bg-slate-900 border border-white/10 overflow-hidden flex-1">
                     <div className="grid grid-cols-5 bg-black/50 p-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                         <div className="col-span-1">Nama Siswa</div><div className="col-span-1 text-center">Status</div><div className="col-span-1 text-center">Pelanggaran</div><div className="col-span-1 text-center">Progress</div><div className="col-span-1 text-right">Skor</div>
                     </div>
                     <div className="overflow-y-auto h-[400px] custom-scrollbar">
                         {monitoringData.map((d, i) => (
                             <div key={i} className={`grid grid-cols-5 p-3 border-b border-white/5 items-center hover:bg-white/5 transition text-sm ${d.violationCount > 0 ? 'bg-red-900/10' : ''}`}>
                                 <div className="font-bold text-white col-span-1 flex items-center gap-2">{d.student.name} {d.violationCount > 0 && <AlertOctagon size={14} className="text-red-500" />}</div>
                                 <div className="text-center col-span-1"><span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${d.status === 'DONE' ? 'bg-green-900 text-green-400' : 'bg-slate-800 text-slate-500'}`}>{d.status}</span></div>
                                 <div className="text-center col-span-1 font-mono">{d.violationCount}</div>
                                 <div className="text-center col-span-1">--</div>
                                 <div className="text-right col-span-1 text-yellow-500">{d.score}</div>
                             </div>
                         ))}
                     </div>
                 </div>
             )}
          </div>
     );
  }

  if (activeTab === 'exams') {
      return (
          <div className="p-8 h-full flex flex-col overflow-y-auto">
              <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-wider mb-6"><CalendarClock className="text-yellow-500"/> Manajemen Jadwal Ujian</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                  <div className="lg:col-span-1 bg-slate-900/80 p-6 border border-white/10 h-fit">
                      <h3 className="font-bold text-white uppercase tracking-wider mb-6 border-b border-white/10 pb-2">Buat Jadwal Baru</h3>
                      <div className="space-y-4">
                          <input type="text" className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm" placeholder="Nama Ujian" value={newExamTitle} onChange={e => setNewExamTitle(e.target.value)}/>
                          <select className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm" value={newExamPacketId} onChange={e => setNewExamPacketId(e.target.value)}><option value="">-- Pilih Paket --</option>{visiblePackets.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}</select>
                          <div className="grid grid-cols-2 gap-2"><input type="datetime-local" className="w-full bg-black/50 border border-slate-700 p-2 text-white text-xs" value={newExamStart} onChange={e => setNewExamStart(e.target.value)}/><input type="datetime-local" className="w-full bg-black/50 border border-slate-700 p-2 text-white text-xs" value={newExamEnd} onChange={e => setNewExamEnd(e.target.value)}/></div>
                          <input type="number" className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm" placeholder="Durasi (Menit)" value={newExamDuration} onChange={e => setNewExamDuration(parseInt(e.target.value))}/>
                          <div className="grid grid-cols-3 gap-2">{CLASS_LIST.map(cls => (<button key={cls} onClick={() => { if (newExamClasses.includes(cls)) setNewExamClasses(newExamClasses.filter(c => c !== cls)); else setNewExamClasses([...newExamClasses, cls]); }} className={`py-1 text-[10px] font-bold border ${newExamClasses.includes(cls) ? 'bg-yellow-600 border-yellow-500 text-black' : 'border-slate-700 text-slate-500'}`}>{cls}</button>))}</div>
                          <button onClick={handleCreateExam} className="w-full py-3 bg-green-600 text-white font-black uppercase text-xs">Jadwalkan</button>
                      </div>
                  </div>
                  <div className="lg:col-span-2 overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {exams.map(exam => (
                              <div key={exam.id} className={`bg-slate-900 border p-5 relative overflow-hidden group ${exam.isActive ? 'border-green-500' : 'border-slate-700 opacity-75'}`}>
                                  <div className={`absolute top-0 right-0 px-2 py-1 text-[9px] font-black uppercase ${exam.isActive ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}>{exam.isActive ? 'Active' : 'Stopped'}</div>
                                  <h4 className="font-bold text-white text-lg uppercase italic truncate pr-16">{exam.title}</h4>
                                  <p className="text-xs text-blue-400 font-bold uppercase mb-4">{packets.find(p => p.id === exam.packetId)?.name}</p>
                                  <div className="flex gap-2 mt-4"><button onClick={() => toggleExamStatus(exam.id)} className={`flex-1 py-2 font-bold uppercase text-[10px] ${exam.isActive ? 'bg-slate-800 text-slate-300' : 'bg-green-600 text-white'}`}>{exam.isActive ? 'Stop' : 'Start'}</button><button onClick={() => handleDeleteExam(exam.id)} className="px-3 bg-red-900/20 text-red-500 border border-red-900/50"><Trash2 size={16}/></button></div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  if (activeTab === 'analysis') {
      return (
          <div className="p-8 h-full flex flex-col overflow-y-auto">
               <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-wider mb-6"><BarChart2 className="text-yellow-500"/> Analisis Hasil Ujian</h2>
               <div className="bg-slate-900/80 p-4 border border-white/10 mb-6 flex flex-wrap gap-4 items-end">
                   <div className="flex-1"><label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Pilih Ujian</label><select className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm" value={selectedExamIdForAnalysis} onChange={e => setSelectedExamIdForAnalysis(e.target.value)}>{visibleExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select></div>
                   <div className="flex bg-black/50 p-1 border border-slate-700"><button onClick={() => setAnalysisSubTab('item')} className={`px-4 py-2 text-xs font-bold uppercase ${analysisSubTab === 'item' ? 'bg-yellow-600 text-black' : 'text-slate-500'}`}>Analisis Butir</button><button onClick={() => setAnalysisSubTab('recap')} className={`px-4 py-2 text-xs font-bold uppercase ${analysisSubTab === 'recap' ? 'bg-yellow-600 text-black' : 'text-slate-500'}`}>Rekap Nilai</button></div>
               </div>
               <div className="flex-1 bg-slate-900 border border-white/10 overflow-hidden relative">
                   {analysisSubTab === 'item' && (
                       <div className="h-full flex flex-col">
                           <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20"><h3 className="font-bold text-white uppercase">Statistik Butir Soal</h3><button onClick={handleDownloadAnalysisExcel} className="px-3 py-1.5 bg-green-700 text-white text-xs font-bold uppercase rounded flex items-center gap-2"><FileSpreadsheet size={14}/> Excel</button></div>
                           <div className="flex-1 overflow-y-auto p-6 custom-scrollbar"><div className="grid grid-cols-1 gap-4">{selectedExamForAnalysis?.questions.map((q, idx) => (<div key={q.id} className="bg-black/40 border border-slate-800 p-4"><div className="flex justify-between items-start mb-2"><span className="font-bold text-yellow-500 text-sm">Soal No. {idx + 1}</span></div><p className="text-slate-300 text-sm mb-3 line-clamp-2">{q.text}</p></div>))}</div></div>
                       </div>
                   )}
                   {analysisSubTab === 'recap' && (
                       <div className="h-full flex flex-col">
                           <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20"><h3 className="font-bold text-white uppercase">Rekap Nilai</h3><button onClick={handleDownloadRecapExcel} className="px-3 py-1.5 bg-green-700 text-white text-xs font-bold uppercase rounded flex items-center gap-2"><FileSpreadsheet size={14}/> Excel</button></div>
                           <div className="overflow-auto custom-scrollbar flex-1"><table className="w-full text-left border-collapse"><thead className="bg-slate-950 text-xs text-slate-400 uppercase font-bold sticky top-0 z-10"><tr><th className="p-3 border-b border-slate-800">No</th><th className="p-3 border-b border-slate-800">Nama Siswa</th><th className="p-3 border-b border-slate-800 text-right text-yellow-500">Nilai Akhir</th></tr></thead><tbody className="text-sm text-slate-300 divide-y divide-slate-800">{realResults.length > 0 ? realResults.map((r, i) => (<tr key={i}><td className="p-3 text-center w-12">{i + 1}</td><td className="p-3 font-medium">{r.studentName}</td><td className="p-3 text-right font-bold text-white">{r.score.toFixed(1)}</td></tr>)) : (<tr><td colSpan={3} className="p-4 text-center text-slate-500">Belum ada data hasil ujian.</td></tr>)}</tbody></table></div>
                       </div>
                   )}
               </div>
          </div>
      );
  }

  if (activeTab === 'students') {
      const filteredStudents = students.filter(s => (s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.nis.includes(searchTerm)) && (selectedClassFilter === '' || s.class === selectedClassFilter));
      return (
          <div className="p-8 h-full flex flex-col relative overflow-hidden">
               <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-wider mb-6"><GraduationCap className="text-yellow-500"/> Data Siswa</h2>
               <div className="bg-slate-900 border border-white/10 p-4 mb-4 flex flex-wrap gap-4 items-center justify-between">
                   <div className="flex items-center gap-4 flex-1"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14}/><input type="text" className="bg-black/50 border border-slate-700 rounded-full py-2 pl-9 pr-4 text-xs text-white outline-none w-[200px]" placeholder="Cari..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div><div className="relative"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14}/><select className="bg-black/50 border border-slate-700 rounded-full py-2 pl-9 pr-8 text-xs text-white outline-none appearance-none cursor-pointer" value={selectedClassFilter} onChange={e => setSelectedClassFilter(e.target.value)}><option value="">Semua Kelas</option>{CLASS_LIST.map(c => <option key={c} value={c}>{c}</option>)}</select></div></div>
                   <div className="flex gap-2">
                       <button onClick={() => setShowAddStudentModal(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 rounded"><UserPlus size={16}/> Tambah Siswa</button>
                       <button onClick={() => setShowImportModal(true)} className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 rounded"><FileSpreadsheet size={16}/> Import Excel</button>
                       <button onClick={handleDownloadStudentTemplate} className="px-4 py-2 border border-slate-600 text-slate-300 font-bold text-xs uppercase tracking-wider flex items-center gap-2 rounded hover:bg-white/5"><Download size={16}/> Template</button>
                   </div>
               </div>
               <div className="flex-1 bg-slate-900 border border-white/10 flex flex-col overflow-hidden"><div className="flex-1 overflow-auto custom-scrollbar"><table className="w-full text-left border-collapse"><thead className="bg-slate-950 text-xs text-slate-400 uppercase font-bold sticky top-0 z-10"><tr><th className="p-3 border-b border-slate-800 w-12 text-center">No</th><th className="p-3 border-b border-slate-800">Nama</th><th className="p-3 border-b border-slate-800">Kelas</th><th className="p-3 border-b border-slate-800">NIS</th><th className="p-3 border-b border-slate-800">NISN</th><th className="p-3 border-b border-slate-800 text-center">Aksi</th></tr></thead><tbody className="text-sm text-slate-300 divide-y divide-slate-800">{filteredStudents.map((s, idx) => (<tr key={s.id} className="hover:bg-white/5"><td className="p-3 text-center">{idx + 1}</td><td className="p-3">{s.name}</td><td className="p-3">{s.class}</td><td className="p-3">{s.nis}</td><td className="p-3">{s.nisn}</td><td className="p-3 text-center"><button onClick={() => handleDeleteStudent(s.id)} className="text-slate-600 hover:text-red-500"><Trash2 size={16}/></button></td></tr>))}</tbody></table></div></div>
               {showAddStudentModal && (
                   <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                       <div className="bg-slate-900 border border-white/10 w-full max-w-md shadow-2xl relative animate-fade-in">
                           <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40"><h3 className="font-bold text-white uppercase tracking-wider">Tambah Siswa</h3><button onClick={() => setShowAddStudentModal(false)}><X size={20}/></button></div>
                           <div className="p-6 space-y-4">
                               <div><label className="text-xs font-bold text-blue-400 block mb-1">Nama Siswa</label><input type="text" className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})}/></div>
                               <div><label className="text-xs font-bold text-blue-400 block mb-1">Kelas</label><select className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm" value={newStudent.class} onChange={e => setNewStudent({...newStudent, class: e.target.value})}><option value="">Pilih</option>{CLASS_LIST.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                               <div className="grid grid-cols-2 gap-4">
                                   <div><label className="text-xs font-bold text-blue-400 block mb-1">NIS</label><input type="text" className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm" value={newStudent.nis} onChange={e => setNewStudent({...newStudent, nis: e.target.value})}/></div>
                                   <div><label className="text-xs font-bold text-blue-400 block mb-1">NISN</label><input type="text" className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm" value={newStudent.nisn} onChange={e => setNewStudent({...newStudent, nisn: e.target.value})}/></div>
                               </div>
                               <button onClick={handleAddStudent} className="w-full py-3 bg-blue-600 text-white font-bold uppercase text-xs hover:bg-blue-500">Simpan Data</button>
                           </div>
                       </div>
                   </div>
               )}
               {showImportModal && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"><div className="bg-slate-900 border border-white/10 w-full max-w-md shadow-2xl relative animate-fade-in"><div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40"><h3 className="font-bold text-white uppercase tracking-wider">Import Excel</h3><button onClick={() => setShowImportModal(false)}><X size={20}/></button></div><div className="p-6 text-center"><p className="text-slate-400 mb-4">Upload file .xlsx data siswa.</p><input type="file" ref={studentFileRef} onChange={handleImportStudentExcel} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"/></div></div></div>)}
          </div>
      );
  }

  if (activeTab === 'questions') {
    return (
      <div className="p-8 flex flex-col h-full overflow-hidden">
         <div className="flex items-center justify-between mb-6 flex-none">
              <h2 className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-3"><BookOpen className="text-yellow-500" /> Bank Soal</h2>
              <div className="flex bg-black/50 p-1 border border-white/10"><button onClick={() => setBankSubTab('config')} className={`px-4 py-2 text-xs font-bold uppercase ${bankSubTab === 'config' ? 'bg-blue-600' : 'text-slate-500'}`}>Konfigurasi</button><button onClick={() => setBankSubTab('input')} className={`px-4 py-2 text-xs font-bold uppercase ${bankSubTab === 'input' ? 'bg-blue-600' : 'text-slate-500'}`}>Input Soal</button></div>
         </div>
         {bankSubTab === 'config' && (
             <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
                 <div className="lg:col-span-1 bg-slate-900/80 p-6 border border-white/10 h-fit">
                     <h3 className="font-bold text-white uppercase mb-4">Buat/Edit Paket</h3>
                     <div className="space-y-4">
                         <input type="text" className="w-full bg-black/50 border border-slate-700 p-2 text-white" placeholder="Nama Paket" value={newPacketName} onChange={e => setNewPacketName(e.target.value)} />
                         {/* RESTRICTED CATEGORY SELECTION */}
                         <select 
                            className="w-full bg-black/50 border border-slate-700 p-2 text-white outline-none disabled:opacity-50 disabled:bg-slate-800" 
                            value={newPacketCategory} 
                            onChange={(e) => setNewPacketCategory(e.target.value as QuestionCategory)}
                            disabled={userRole !== Role.ADMIN}
                         >
                            {(userRole === Role.ADMIN || userRole === Role.TEACHER_LITERASI) && <option value={QuestionCategory.LITERASI}>Literasi</option>}
                            {(userRole === Role.ADMIN || userRole === Role.TEACHER_NUMERASI) && <option value={QuestionCategory.NUMERASI}>Numerasi</option>}
                         </select>
                         <input type="number" className="w-full bg-black/50 border border-slate-700 p-2 text-white" placeholder="Jml Soal" value={newPacketTotal} onChange={e => setNewPacketTotal(parseInt(e.target.value))} />
                         <button onClick={handleSavePacket} className="w-full py-3 bg-blue-600 text-white font-bold uppercase text-xs">Simpan Paket</button>
                     </div>
                 </div>
                 <div className="lg:col-span-2 overflow-y-auto custom-scrollbar">
                     {visiblePackets.map(pkt => (
                         <div key={pkt.id} className="bg-slate-900 border border-slate-700 p-4 mb-2 flex justify-between items-center">
                             <div><h4 className="font-bold text-white">{pkt.name}</h4><p className="text-xs text-slate-400">{pkt.totalQuestions} Soal • {pkt.category}</p></div>
                             <div className="flex gap-2"><button onClick={() => handleEditPacket(pkt)} className="p-2 bg-slate-800"><Edit2 size={14}/></button><button onClick={() => deletePacket(pkt.id)} className="p-2 bg-slate-800 text-red-500"><Trash2 size={14}/></button></div>
                         </div>
                     ))}
                 </div>
             </div>
         )}
         {bankSubTab === 'input' && (
             <div className="flex-1 flex flex-col overflow-hidden">
                 <div className="bg-slate-900 p-4 mb-4 border border-white/10 flex-none flex flex-wrap gap-4 justify-between items-center">
                     <select value={selectedPacketId} onChange={(e) => { setSelectedPacketId(e.target.value); setActiveSlot(null); }} className="bg-black/50 border border-slate-700 p-2 text-white w-full md:w-64"><option value="">-- Pilih Paket --</option>{visiblePackets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                     {selectedPacketId && (
                         <div className="flex gap-2">
                             <input type="file" ref={excelQuestionInputRef} onChange={handleImportExcelQuestions} className="hidden" accept=".xlsx"/>
                             <button onClick={() => excelQuestionInputRef.current?.click()} className="bg-green-700 hover:bg-green-600 px-4 py-2 text-xs font-bold text-white rounded flex items-center gap-2"><FileSpreadsheet size={16}/> Import Excel</button>
                             <button onClick={handleDownloadExcelTemplate} className="border border-slate-600 px-4 py-2 text-xs font-bold text-slate-300 rounded hover:bg-white/5 flex items-center gap-2"><Download size={16}/> Template Excel</button>
                         </div>
                     )}
                 </div>
                 {selectedPacketId && (
                     <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-hidden">
                         {/* SLOT SELECTOR (LEFT) */}
                         <div className="lg:col-span-1 bg-slate-900 border border-white/10 flex flex-col"><div className="flex-1 overflow-y-auto p-4 custom-scrollbar"><div className="grid grid-cols-5 gap-2">{Array.from({ length: visiblePackets.find(p => p.id === selectedPacketId)?.totalQuestions || 0 }).map((_, idx) => (<button key={idx+1} onClick={() => prepareSlotForm(idx+1)} className={`aspect-square border flex items-center justify-center font-bold text-sm ${activeSlot === idx+1 ? 'bg-yellow-500 text-black' : questions.some(q => q.packetId === selectedPacketId && q.number === idx+1) ? 'bg-blue-900/30 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>{idx+1}</button>))}</div></div></div>
                         
                         {/* SPLIT VIEW: EDITOR & PREVIEW */}
                         <div className="lg:col-span-3 bg-slate-900 border border-white/10 flex flex-col md:flex-row overflow-hidden">
                             {activeSlot !== null ? (
                                 <>
                                     {/* EDITOR COLUMN */}
                                     <div className="flex-1 overflow-y-auto custom-scrollbar border-r border-slate-800 p-6 space-y-4">
                                         <h3 className="font-bold text-white border-b border-white/10 pb-2 mb-4">Edit Soal No. {activeSlot}</h3>
                                         <div className="flex justify-between items-center mb-2">
                                            <div className="flex gap-2"><button onClick={() => setMediaType('text')} className={`px-3 py-1.5 text-xs font-bold uppercase rounded ${mediaType==='text'?'bg-blue-600 text-white':'bg-slate-800 text-slate-400'}`}>Teks</button><button onClick={() => setMediaType('image')} className={`px-3 py-1.5 text-xs font-bold uppercase rounded ${mediaType==='image'?'bg-blue-600 text-white':'bg-slate-800 text-slate-400'}`}>Gambar</button></div>
                                            <select className="bg-slate-800 text-white text-xs p-2 border border-slate-600 rounded outline-none" value={manualType} onChange={(e) => setManualType(e.target.value as QuestionType)}>
                                                <option value={QuestionType.SINGLE}>Pilihan Ganda</option>
                                                <option value={QuestionType.COMPLEX}>PG Kompleks</option>
                                                <option value={QuestionType.MATCHING}>Menjodohkan</option>
                                            </select>
                                         </div>

                                         {mediaType === 'text' && (
                                            <div>
                                                <label className="text-xs text-slate-400 font-bold block mb-1">Stimulus (Bacaan)</label>
                                                <textarea className="w-full bg-black/50 border border-slate-700 p-3 text-white text-sm" rows={6} placeholder="Masukkan teks stimulus atau bacaan di sini..." value={newStimulus} onChange={e => setNewStimulus(e.target.value)} />
                                            </div>
                                         )}
                                         {mediaType === 'image' && (
                                            <div className="border border-dashed border-slate-700 p-4 text-center">
                                                {newQuestionImage ? <div className="relative inline-block"><img src={newQuestionImage} className="h-40 object-contain"/><button onClick={handleRemoveImage} className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1"><X size={10}/></button></div> : <input type="file" onChange={handleImageUpload} className="text-sm text-slate-500"/>}
                                            </div>
                                         )}
                                         
                                         <div>
                                            <label className="text-xs text-slate-400 font-bold block mb-1">Pertanyaan</label>
                                            <textarea className="w-full bg-black/50 border border-slate-700 p-3 text-white text-sm" rows={3} placeholder="Tuliskan pertanyaan utama..." value={newQuestionText} onChange={e => setNewQuestionText(e.target.value)} />
                                         </div>
                                         
                                         {/* OPTIONS EDITOR */}
                                         <div className="space-y-3 bg-slate-800/30 p-4 rounded border border-slate-800">
                                             {manualType === QuestionType.SINGLE && (
                                                <>
                                                    <p className="text-xs text-slate-400 font-bold uppercase mb-2">Pilihan Jawaban (Klik Huruf untuk Kunci)</p>
                                                    {newOptions.map((opt, i) => (
                                                        <div key={i} className="flex gap-2 items-center">
                                                            <button onClick={() => setSingleCorrectIndex(i)} className={`w-8 h-8 flex-none flex items-center justify-center font-bold border rounded ${singleCorrectIndex === i ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>{String.fromCharCode(65+i)}</button>
                                                            <textarea className="flex-1 bg-black/50 border border-slate-700 p-2 text-white text-sm h-10 resize-none" value={opt} onChange={e => { const c = [...newOptions]; c[i] = e.target.value; setNewOptions(c); }} placeholder={`Opsi ${String.fromCharCode(65+i)}`}/>
                                                        </div>
                                                    ))}
                                                </>
                                             )}
                                             {manualType === QuestionType.COMPLEX && (
                                                <>
                                                    <p className="text-xs text-slate-400 font-bold uppercase mb-2">Pilihan Jawaban (Klik Checkbox untuk Kunci)</p>
                                                    {newOptions.map((opt, i) => {
                                                        const isChecked = complexCorrectIndices.includes(i);
                                                        return (
                                                            <div key={i} className="flex gap-2 items-center">
                                                                <button onClick={() => { if(isChecked) setComplexCorrectIndices(complexCorrectIndices.filter(idx => idx !== i)); else setComplexCorrectIndices([...complexCorrectIndices, i]); }} className={`w-8 h-8 flex-none flex items-center justify-center font-bold border rounded ${isChecked ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-500'}`}><Check size={14}/></button>
                                                                <textarea className="flex-1 bg-black/50 border border-slate-700 p-2 text-white text-sm h-10 resize-none" value={opt} onChange={e => { const c = [...newOptions]; c[i] = e.target.value; setNewOptions(c); }} placeholder={`Opsi ${String.fromCharCode(65+i)}`}/>
                                                            </div>
                                                        );
                                                    })}
                                                </>
                                             )}
                                             {manualType === QuestionType.MATCHING && (
                                                <>
                                                    <div className="flex justify-between items-center mb-2"><p className="text-xs text-slate-400 font-bold uppercase">Tabel Benar / Salah</p><button onClick={handleAddPair} className="text-xs bg-slate-700 px-2 py-1 rounded text-white flex items-center gap-1"><Plus size={12}/> Tambah Baris</button></div>
                                                    <div className="flex gap-2 mb-2"><input type="text" className="w-1/2 bg-slate-800 border border-slate-600 p-1 text-center text-xs text-white" value={newOptions[0] || 'Benar'} onChange={e => { const c = [...newOptions]; c[0] = e.target.value; setNewOptions(c); }} placeholder="Kolom 1 (Benar)" /><input type="text" className="w-1/2 bg-slate-800 border border-slate-600 p-1 text-center text-xs text-white" value={newOptions[1] || 'Salah'} onChange={e => { const c = [...newOptions]; c[1] = e.target.value; setNewOptions(c); }} placeholder="Kolom 2 (Salah)" /></div>
                                                    {matchingPairs.map((pair, i) => (
                                                        <div key={i} className="flex gap-2 items-center mb-2">
                                                            <input type="text" className="flex-1 bg-black/50 border border-slate-700 p-2 text-white text-sm" value={pair.left} onChange={e => { const c = [...matchingPairs]; c[i].left = e.target.value; setMatchingPairs(c); }} placeholder="Pernyataan"/>
                                                            <select className="w-24 bg-black/50 border border-slate-700 p-2 text-white text-sm" value={pair.right} onChange={e => { const c = [...matchingPairs]; c[i].right = e.target.value; setMatchingPairs(c); }}>
                                                                <option value="">Kunci</option>
                                                                <option value={newOptions[0] || 'Benar'}>{newOptions[0] || 'Benar'}</option>
                                                                <option value={newOptions[1] || 'Salah'}>{newOptions[1] || 'Salah'}</option>
                                                            </select>
                                                            <button onClick={() => handleRemovePair(i)} className="text-slate-600 hover:text-red-500"><Trash2 size={14}/></button>
                                                        </div>
                                                    ))}
                                                </>
                                             )}
                                         </div>
                                         <button onClick={handleSaveQuestionSlot} className="w-full py-3 bg-blue-600 text-white font-bold uppercase text-xs hover:bg-blue-500">Simpan Soal</button>
                                     </div>

                                     {/* PREVIEW COLUMN */}
                                     <div className="flex-1 bg-black border-l border-white/10 p-6 overflow-y-auto custom-scrollbar relative">
                                         <div className="absolute top-4 right-4 bg-yellow-600 text-black px-2 py-1 text-[10px] font-black uppercase tracking-widest opacity-50 pointer-events-none">Live Preview</div>
                                         <div className="max-w-xl mx-auto">
                                             {/* STIMULUS PREVIEW */}
                                             {newStimulus && mediaType === 'text' && (
                                                <div className="mb-6 p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-sm relative">
                                                    <div className="absolute top-0 left-0 bg-emerald-600 text-black text-[10px] font-black px-2 py-0.5 uppercase tracking-widest">INTEL</div>
                                                    <p className="text-emerald-100/90 leading-relaxed text-sm mt-2 font-medium whitespace-pre-wrap">{newStimulus}</p>
                                                </div>
                                             )}
                                             {newQuestionImage && mediaType === 'image' && (
                                                <div className="w-full mb-6 flex flex-col items-center bg-slate-900/50 p-2 rounded border border-slate-700">
                                                    <img src={newQuestionImage} className="max-w-full h-auto max-h-[300px] object-contain" />
                                                </div>
                                             )}
                                             
                                             {/* QUESTION TEXT */}
                                             <p className="text-xl text-white leading-relaxed mb-6 font-bold whitespace-pre-wrap">{newQuestionText || "Pertanyaan akan muncul di sini..."}</p>
                                             
                                             {/* OPTIONS PREVIEW */}
                                             <div className="space-y-3">
                                                 {manualType === QuestionType.SINGLE && newOptions.map((opt, idx) => (
                                                     <div key={idx} className="w-full text-left p-3 flex items-center bg-slate-800/50 border-l-4 border-slate-600">
                                                         <div className="w-8 h-8 flex items-center justify-center mr-4 font-bold border-2 border-slate-500 text-slate-400">{String.fromCharCode(65 + idx)}</div>
                                                         <span className="text-slate-300">{opt || `Opsi ${String.fromCharCode(65 + idx)}`}</span>
                                                     </div>
                                                 ))}
                                                 {manualType === QuestionType.COMPLEX && newOptions.map((opt, idx) => (
                                                     <div key={idx} className="w-full text-left p-3 flex items-center bg-slate-800/50 border border-slate-700">
                                                         <div className="w-5 h-5 border-2 border-slate-500 mr-4"></div>
                                                         <span className="text-slate-300">{opt || `Opsi ${String.fromCharCode(65 + idx)}`}</span>
                                                     </div>
                                                 ))}
                                                 {manualType === QuestionType.MATCHING && (
                                                     <div className="border border-slate-700 rounded overflow-hidden">
                                                         <table className="w-full text-sm text-slate-300">
                                                             <thead className="bg-slate-800 text-xs uppercase font-bold text-slate-400">
                                                                 <tr><th className="p-2">Pernyataan</th><th className="p-2 text-center bg-emerald-900/20">{newOptions[0]||'Benar'}</th><th className="p-2 text-center bg-red-900/20">{newOptions[1]||'Salah'}</th></tr>
                                                             </thead>
                                                             <tbody className="divide-y divide-slate-700">
                                                                 {matchingPairs.map((p, i) => (
                                                                     <tr key={i}><td className="p-2">{p.left || '...'}</td><td className="p-2 text-center bg-emerald-900/10"><input type="radio" disabled/></td><td className="p-2 text-center bg-red-900/10"><input type="radio" disabled/></td></tr>
                                                                 ))}
                                                             </tbody>
                                                         </table>
                                                     </div>
                                                 )}
                                             </div>
                                         </div>
                                     </div>
                                 </>
                             ) : <div className="h-full w-full flex flex-col items-center justify-center text-slate-500 bg-slate-900/20"><Layout size={48} className="mb-4 opacity-20"/><p>Pilih nomor soal di panel kiri untuk mulai mengedit.</p></div>}
                         </div>
                     </div>
                 )}
             </div>
         )}
    </div>
    );
  }

  return null;
};