import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Student, Teacher, Question, QuestionType, QuestionCategory, QuestionPacket, Exam, Role, SchoolSettings } from '../types';
import { Upload, Download, Trash2, Search, Brain, Save, Settings, Plus, X, List, Layout, FileSpreadsheet, Check, Eye, ChevronLeft, ChevronRight, HelpCircle, Edit2, ImageIcon, Users, UserPlus, BarChart2, TrendingUp, AlertTriangle, Table, PieChart, Layers, FileText, ArrowRight, CalendarClock, PlayCircle, StopCircle, Clock, Activity, RefreshCw, BookOpen, GraduationCap, AlignLeft, Image as LucideImage, AlertOctagon, ShieldAlert, Filter } from 'lucide-react';
import { generateQuestionWithAI } from '../services/geminiService';
import { CLASS_LIST, MOCK_EXAMS } from '../constants';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth'; 
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Copying generateMockResults here for completeness of the file content
const generateMockResults = (exam: Exam, studentList: Student[]) => {
    return studentList.map(student => {
        const studentAnswers: Record<string, any> = {};
        let correctCount = 0;
        let literasiCorrect = 0;
        let numerasiCorrect = 0;
        let literasiTotal = 0;
        let numerasiTotal = 0;
        
        exam.questions.forEach(q => {
            const isLiterasi = q.category === QuestionCategory.LITERASI || (!q.category && Math.random() > 0.5);
            
            if (isLiterasi) literasiTotal++; else numerasiTotal++;

            const skillFactor = (parseInt(student.id.replace(/\D/g, '') || '0') % 5) / 10; 
            const isCorrect = Math.random() > (0.3 - skillFactor);
            
            if (q.type === QuestionType.SINGLE) {
                if (isCorrect) {
                    studentAnswers[q.id] = q.correctAnswerIndex;
                    correctCount++;
                    if (isLiterasi) literasiCorrect++; else numerasiCorrect++;
                } else {
                    const opts = [0,1,2,3].filter(x => x !== q.correctAnswerIndex);
                    studentAnswers[q.id] = opts[Math.floor(Math.random() * opts.length)];
                }
            } else {
                 studentAnswers[q.id] = isCorrect ? 'CORRECT' : 'WRONG';
                 if(isCorrect) {
                    correctCount++;
                    if (isLiterasi) literasiCorrect++; else numerasiCorrect++;
                 }
            }
        });
        
        const totalQuestions = exam.questions.length || 1;
        
        return {
            studentId: student.id,
            studentName: student.name,
            studentNis: student.nis,
            answers: studentAnswers,
            score: (correctCount / totalQuestions) * 100,
            literasiScore: literasiTotal > 0 ? (literasiCorrect / literasiTotal) * 100 : 0,
            numerasiScore: numerasiTotal > 0 ? (numerasiCorrect / numerasiTotal) * 100 : 0
        };
    });
};

interface AdminDashboardProps {
  userRole?: Role; // Added role prop
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
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  userRole = Role.ADMIN, students, setStudents, teachers, setTeachers, questions, setQuestions, exams = [], setExams, activeTab,
  packets, setPackets, schoolSettings, setSchoolSettings
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const studentFileRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null); // Ref for question image upload

  // --- Student Management State ---
  const [studentSubTab, setStudentSubTab] = useState<'list' | 'input'>('list');
  const [selectedClassFilter, setSelectedClassFilter] = useState(''); // NEW: Filter Class
  const [showAddStudentModal, setShowAddStudentModal] = useState(false); // NEW: Toggle Modal
  const [showImportModal, setShowImportModal] = useState(false); // NEW: Toggle Import Modal
  const [newStudent, setNewStudent] = useState({ name: '', class: '', nis: '', nisn: '' });

  // --- Bank Soal State ---
  const [bankSubTab, setBankSubTab] = useState<'config' | 'input'>('config');
  const [selectedPacketId, setSelectedPacketId] = useState<string>('');

  // Config State
  const [editingPacketId, setEditingPacketId] = useState<string | null>(null); 
  const [newPacketName, setNewPacketName] = useState('');
  const [newPacketCategory, setNewPacketCategory] = useState<QuestionCategory>(QuestionCategory.LITERASI);
  const [newPacketTotal, setNewPacketTotal] = useState<number | ''>(''); // CHANGED: Single total input

  // Input Manual State
  const [activeSlot, setActiveSlot] = useState<number | null>(null); // New: Track which question number is being edited
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [manualType, setManualType] = useState<QuestionType>(QuestionType.SINGLE);
  
  // Media Type Toggle State
  const [mediaType, setMediaType] = useState<'text' | 'image'>('text');

  const [newStimulus, setNewStimulus] = useState(''); 
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionImage, setNewQuestionImage] = useState('');
  const [newOptions, setNewOptions] = useState<string[]>(['', '', '', '']);
  const [singleCorrectIndex, setSingleCorrectIndex] = useState(0);
  const [complexCorrectIndices, setComplexCorrectIndices] = useState<number[]>([]);
  const [matchingPairs, setMatchingPairs] = useState<{left: string, right: string}[]>([{left: '', right: ''}]);

  // Group Input Mode State (New Feature)
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupDraftQuestions, setGroupDraftQuestions] = useState<Question[]>([]);

  // --- Exam Management State (NEW) ---
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamPacketId, setNewExamPacketId] = useState('');
  const [newExamDuration, setNewExamDuration] = useState(60);
  const [newExamClasses, setNewExamClasses] = useState<string[]>([]);
  const [newExamStart, setNewExamStart] = useState('');
  const [newExamEnd, setNewExamEnd] = useState('');

  // --- MONITORING STATE (NEW) ---
  const [selectedExamForMonitor, setSelectedExamForMonitor] = useState<string>('');
  const [monitoringData, setMonitoringData] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Preview State (Interactive)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewQIndex, setPreviewQIndex] = useState(0);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>({}); 

  // --- Analysis State ---
  const [analysisSubTab, setAnalysisSubTab] = useState<'item' | 'recap'>('item');
  const [selectedExamIdForAnalysis, setSelectedExamIdForAnalysis] = useState<string>(exams[0]?.id || '');
  const [selectedClassForRecap, setSelectedClassForRecap] = useState<string>(CLASS_LIST[0]);

  const selectedExamForAnalysis = exams.find(e => e.id === selectedExamIdForAnalysis) || exams[0];

  // --- FILTER PACKETS BASED ON ROLE ---
  const visiblePackets = useMemo(() => {
    if (userRole === Role.ADMIN) return packets;
    if (userRole === Role.TEACHER_LITERASI) return packets.filter(p => p.category === QuestionCategory.LITERASI);
    if (userRole === Role.TEACHER_NUMERASI) return packets.filter(p => p.category === QuestionCategory.NUMERASI);
    return [];
  }, [packets, userRole]);

  // --- FILTER EXAMS BASED ON ROLE (For Analysis Dropdown) ---
  const visibleExams = useMemo(() => {
     if (userRole === Role.ADMIN) return exams;
     // Hanya tampilkan ujian yang menggunakan paket soal yang visible bagi guru tersebut
     const visiblePacketIds = visiblePackets.map(p => p.id);
     return exams.filter(e => visiblePacketIds.includes(e.packetId));
  }, [exams, visiblePackets, userRole]);

  // Initialize form default category based on role
  useEffect(() => {
      if (userRole === Role.TEACHER_LITERASI) setNewPacketCategory(QuestionCategory.LITERASI);
      if (userRole === Role.TEACHER_NUMERASI) setNewPacketCategory(QuestionCategory.NUMERASI);
  }, [userRole]);


  // For ITEM ANALYSIS
  const mockItemResults = useMemo(() => {
      if (!selectedExamForAnalysis) return [];
      const sampleStudents = students.slice(0, 30);
      return generateMockResults(selectedExamForAnalysis, sampleStudents);
  }, [selectedExamForAnalysis, students]);

  // For CLASS RECAP
  const recapResults = useMemo(() => {
      if (!selectedExamForAnalysis || !selectedClassForRecap) return [];
      const studentsInClass = students.filter(s => s.class === selectedClassForRecap);
      return generateMockResults(selectedExamForAnalysis, studentsInClass);
  }, [selectedExamForAnalysis, selectedClassForRecap, students]);

  // --- DOWNLOAD ANALYSIS LOGIC ---
  const handleDownloadAnalysisExcel = () => {
      if (!selectedExamForAnalysis || mockItemResults.length === 0) return;
      
      const data = selectedExamForAnalysis.questions.map((q, idx) => {
          const correctCount = mockItemResults.filter(r => r.answers[q.id] === q.correctAnswerIndex || r.answers[q.id] === 'CORRECT').length;
          const percent = (correctCount / mockItemResults.length) * 100;
          return {
              "No": idx + 1,
              "Pertanyaan": q.text.substring(0, 50) + "...",
              "Tipe Soal": q.type,
              "Jumlah Benar": correctCount,
              "Persentase Benar": `${percent.toFixed(1)}%`
          };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Analisis Butir");
      XLSX.writeFile(wb, `Analisis_Butir_${selectedExamForAnalysis.title}.xlsx`);
  };

  const handleDownloadAnalysisPDF = () => {
      if (!selectedExamForAnalysis || mockItemResults.length === 0) return;
      const doc = new jsPDF();
      
      doc.text(`Analisis Butir: ${selectedExamForAnalysis.title}`, 14, 15);
      doc.text(`Sekolah: ${schoolSettings?.schoolName || 'SMPN 3 Pacet'}`, 14, 22);

      const tableData = selectedExamForAnalysis.questions.map((q, idx) => {
          const correctCount = mockItemResults.filter(r => r.answers[q.id] === q.correctAnswerIndex || r.answers[q.id] === 'CORRECT').length;
          const percent = (correctCount / mockItemResults.length) * 100;
          return [idx + 1, q.type, correctCount, `${percent.toFixed(1)}%`];
      });

      autoTable(doc, {
          startY: 30,
          head: [['No', 'Tipe Soal', 'Jml Benar', '% Benar']],
          body: tableData,
      });

      doc.save(`Analisis_Butir_${selectedExamForAnalysis.title}.pdf`);
  };

  const handleDownloadRecapExcel = () => {
      if (!recapResults.length) return;
      
      const data = recapResults.map((r, i) => ({
          "No": i + 1,
          "Nama Siswa": r.studentName,
          "NIS": r.studentNis,
          "Literasi": r.literasiScore.toFixed(0),
          "Numerasi": r.numerasiScore.toFixed(0),
          "Nilai Akhir": r.score.toFixed(1)
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Rekap Nilai");
      XLSX.writeFile(wb, `Rekap_Nilai_${selectedClassForRecap}.xlsx`);
  };

  const handleDownloadRecapPDF = () => {
      if (!recapResults.length) return;
      const doc = new jsPDF();

      doc.text(`Rekap Nilai: ${selectedClassForRecap}`, 14, 15);
      doc.text(`Ujian: ${selectedExamForAnalysis.title}`, 14, 22);

      const tableData = recapResults.map((r, i) => [
          i + 1, r.studentName, r.studentNis, r.literasiScore.toFixed(0), r.numerasiScore.toFixed(0), r.score.toFixed(1)
      ]);

      autoTable(doc, {
          startY: 30,
          head: [['No', 'Nama', 'NIS', 'Lit', 'Num', 'Skor']],
          body: tableData,
      });

      doc.save(`Rekap_Nilai_${selectedClassForRecap}.pdf`);
  };


  // ... (Monitoring Logic remains same) ...
  const generateLiveMonitoringData = (examId: string) => {
    const exam = exams.find(e => e.id === examId);
    if (!exam) return [];
    const targetStudents = students.filter(s => exam.classTarget.includes(s.class));
    
    return targetStudents.map(student => {
        // SIMULASI RANDOM STATUS & CHEATING
        const rand = Math.random();
        let status: 'OFFLINE' | 'WORKING' | 'DONE' | 'DISQUALIFIED' = 'OFFLINE';
        
        // Random Violations (0, 1, 2, 3)
        // 20% chance of having violations
        let violationCount = 0;
        if (rand > 0.2) {
             status = 'WORKING';
             if (Math.random() > 0.7) {
                 violationCount = Math.floor(Math.random() * 4); // 0 to 3
             }
        }
        if (rand > 0.8) status = 'DONE';

        // Force DISQUALIFIED if 3 violations
        if (violationCount >= 3) {
            status = 'DISQUALIFIED';
        }

        const answers: boolean[] = []; 
        let correctCount = 0;
        if (status !== 'OFFLINE') {
            exam.questions.forEach((q, idx) => {
                if (status === 'WORKING' && idx > exam.questions.length / 2 && Math.random() > 0.5) {
                    answers.push(null as any); 
                } else {
                    const isCorrect = Math.random() > 0.3; 
                    answers.push(isCorrect);
                    if (isCorrect) correctCount++;
                }
            });
        } else {
            exam.questions.forEach(() => answers.push(null as any));
        }
        return { 
            student, 
            status, 
            answers, 
            score: (correctCount / exam.questions.length) * 100,
            violationCount // New field
        };
    });
  };

  const handleRefreshMonitor = () => {
      if(selectedExamForMonitor) {
          const data = generateLiveMonitoringData(selectedExamForMonitor);
          setMonitoringData(data);
          setLastUpdated(new Date());
      }
  };

  useEffect(() => {
      if(selectedExamForMonitor) handleRefreshMonitor();
      else setMonitoringData([]);
  }, [selectedExamForMonitor]);

  // ... (Exam Management Logic remains same) ...
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
  };

  const handleDeleteExam = (id: string) => {
      if (confirm('Yakin hapus jadwal ujian ini?')) {
          if (setExams) setExams(exams.filter(e => e.id !== id));
      }
  };

  const toggleExamStatus = (id: string) => {
      if (setExams) setExams(exams.map(e => e.id === id ? { ...e, isActive: !e.isActive } : e));
  };

  // ... (Student Logic remains same, including excel import) ...
  const handleAddStudent = () => {
      // ... (same as before)
      if (!newStudent.name || !newStudent.class || !newStudent.nis) { alert("Nama, Kelas, dan NIS wajib diisi!"); return; }
      const student: Student = { id: `s-${Date.now()}`, no: students.length + 1, name: newStudent.name, class: newStudent.class, nis: newStudent.nis, nisn: newStudent.nisn || '-' };
      setStudents([...students, student]); setNewStudent({ name: '', class: '', nis: '', nisn: '' }); alert("Siswa berhasil ditambahkan!");
      setShowAddStudentModal(false);
  };
  const handleDeleteStudent = (id: string) => { if(confirm('Yakin hapus data siswa ini?')) setStudents(students.filter(s => s.id !== id)); };
  
  const handleDownloadStudentTemplate = () => { 
     const ws = XLSX.utils.json_to_sheet([{ No: 1, Nama: "Contoh Siswa", Kelas: "IX A", NIS: "12345", NISN: "00123" }]);
     const wb = XLSX.utils.book_new();
     XLSX.utils.book_append_sheet(wb, ws, "TemplateSiswa");
     XLSX.writeFile(wb, "Template_Siswa.xlsx");
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
              name: d.Nama || d.NAME || 'Siswa',
              class: d.Kelas || d.CLASS || 'VII A',
              nis: String(d.NIS || d.nis || Math.floor(Math.random()*10000)),
              nisn: String(d.NISN || '-')
          }));
          setStudents([...students, ...newStudents]);
          alert(`Berhasil import ${newStudents.length} siswa`);
          setShowImportModal(false);
      };
      reader.readAsBinaryString(file);
      if(studentFileRef.current) studentFileRef.current.value = '';
  };


  // --- QUESTION PACKET LOGIC (UPDATED) ---
  const resetPacketForm = () => {
    setNewPacketName('');
    // Reset category to default allowed for role
    if (userRole === Role.TEACHER_LITERASI) setNewPacketCategory(QuestionCategory.LITERASI);
    else if (userRole === Role.TEACHER_NUMERASI) setNewPacketCategory(QuestionCategory.NUMERASI);
    else setNewPacketCategory(QuestionCategory.LITERASI);
    
    setNewPacketTotal('');
    setEditingPacketId(null);
  };

  const handleEditPacket = (pkt: QuestionPacket) => {
    setNewPacketName(pkt.name);
    setNewPacketCategory(pkt.category);
    setNewPacketTotal(pkt.totalQuestions);
    setEditingPacketId(pkt.id);
  };

  const handleSavePacket = () => {
    if (!newPacketName || !newPacketTotal) {
      alert("Nama paket dan total soal harus diisi");
      return;
    }
    
    // Initialize question types map for new packet, or preserve existing for edit
    let types: Record<number, QuestionType> = {};
    if (editingPacketId) {
        const existing = packets.find(p => p.id === editingPacketId);
        types = existing?.questionTypes || {};
    } else {
        // Initialize all as Single by default
        for(let i=1; i<= Number(newPacketTotal); i++) {
            types[i] = QuestionType.SINGLE;
        }
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
      alert("Paket soal berhasil dibuat! Silakan ke tab 'Input & Daftar Soal'.");
      setSelectedPacketId(updatedPacket.id);
      if (!editingPacketId) setBankSubTab('input');
    }
    resetPacketForm();
  };

  const deletePacket = (id: string) => {
    if (confirm("Apakah Anda yakin menghapus paket ini? Semua soal di dalamnya juga akan terhapus.")) {
      setPackets(packets.filter(p => p.id !== id));
      setQuestions(questions.filter(q => q.packetId !== id));
      if (selectedPacketId === id) setSelectedPacketId('');
      if (editingPacketId === id) resetPacketForm();
    }
  };

  // --- Helpers: Input & List ---
  const getFilteredQuestions = () => questions.filter(q => q.packetId === selectedPacketId);
  const selectedPacket = packets.find(p => p.id === selectedPacketId);
  
  const handleAddOption = () => setNewOptions([...newOptions, '']);
  const handleRemoveOption = (idx: number) => { if(newOptions.length <= 2) return; setNewOptions(newOptions.filter((_, i) => i !== idx)); };
  const handleAddPair = () => setMatchingPairs([...matchingPairs, {left: '', right: ''}]);
  const handleRemovePair = (idx: number) => { if(matchingPairs.length <= 1) return; setMatchingPairs(matchingPairs.filter((_, i) => i !== idx)); };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
          setNewQuestionImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
      setNewQuestionImage('');
      if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleDownloadWordTemplate = () => {
      const content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Template Soal</title></head>
      <body>
      <p><b>FORMAT IMPORT SOAL (WORD)</b></p>
      <p>Pastikan format persis seperti dibawah ini:</p>
      <br/>
      <p>1. Pertanyaan nomor satu ditulis disini?</p>
      <p>A. Pilihan A</p>
      <p>B. Pilihan B</p>
      <p>C. Pilihan C</p>
      <p>D. Pilihan D</p>
      <p>Kunci: A</p>
      <br/>
      <p>2. Pertanyaan nomor dua?</p>
      <p>A. Opsi satu</p>
      <p>B. Opsi dua</p>
      <p>C. Opsi tiga</p>
      <p>D. Opsi empat</p>
      <p>Kunci: C</p>
      </body></html>`;
      
      const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Template_Soal.doc';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleImportWord = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!selectedPacketId) {
          alert("Silakan pilih paket soal terlebih dahulu sebelum import.");
          return;
      }

      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const arrayBuffer = evt.target?.result as ArrayBuffer;
              const result = await mammoth.extractRawText({ arrayBuffer });
              const text = result.value;
              
              const lines = text.split('\n').map(l => l.trim()).filter(l => l);
              const importedQuestions: Question[] = [];
              let currentQ: Partial<Question> | null = null;
              
              for (let i = 0; i < lines.length; i++) {
                  const line = lines[i];
                  // Detect Question start (e.g. "1. Soal...")
                  if (/^\d+\./.test(line)) {
                      if (currentQ && currentQ.text && currentQ.options && currentQ.options.length >= 2) {
                          importedQuestions.push(currentQ as Question);
                      }
                      currentQ = {
                          id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                          packetId: selectedPacketId,
                          number: importedQuestions.length + 1,
                          text: line.replace(/^\d+\.\s*/, ''),
                          type: QuestionType.SINGLE,
                          options: [],
                          correctAnswerIndex: 0
                      };
                  }
                  // Detect Option (e.g. "A. Opsi...")
                  else if (/^[A-E]\./.test(line) && currentQ) {
                      const optText = line.replace(/^[A-E]\.\s*/, '');
                      currentQ.options = [...(currentQ.options || []), optText];
                  }
                  // Detect Key (e.g. "Kunci: A")
                  else if (/^Kunci:/i.test(line) && currentQ) {
                      const keyChar = line.split(':')[1].trim().toUpperCase().charAt(0);
                      const keyMap: {[key: string]: number} = {'A':0, 'B':1, 'C':2, 'D':3, 'E':4};
                      if (keyMap[keyChar] !== undefined) {
                          currentQ.correctAnswerIndex = keyMap[keyChar];
                      }
                  }
              }
              // Push last question
              if (currentQ && currentQ.text && currentQ.options && currentQ.options.length >= 2) {
                  importedQuestions.push(currentQ as Question);
              }

              if (importedQuestions.length > 0) {
                  setQuestions(prev => [...prev, ...importedQuestions]);
                  alert(`Berhasil mengimpor ${importedQuestions.length} soal!`);
              } else {
                  alert("Gagal membaca soal. Pastikan format sesuai template (No. Soal, A. Opsi, Kunci: X).");
              }
          } catch (error) {
              console.error("Error parsing Word:", error);
              alert("Gagal membaca file Word.");
          }
      };
      reader.readAsArrayBuffer(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- NEW: Handle Type Change for Specific Number ---
  const handleTypeChange = (num: number, type: QuestionType) => {
      if(!selectedPacket) return;
      const updatedTypes = { ...selectedPacket.questionTypes, [num]: type };
      setPackets(packets.map(p => p.id === selectedPacketId ? { ...p, questionTypes: updatedTypes } : p));
  };

  const handleSaveTypeConfig = (num: number) => {
     alert(`Tipe soal No. ${num} berhasil disimpan.`);
  };

  // Reset form now prepares for a specific slot
  const prepareSlotForm = (num: number) => {
      setActiveSlot(num);
      
      // Check if question exists for this number
      const existingQ = questions.find(q => q.packetId === selectedPacketId && q.number === num);
      
      const typeForSlot = selectedPacket?.questionTypes[num] || QuestionType.SINGLE;
      setManualType(typeForSlot);

      if (existingQ) {
          setEditingQuestionId(existingQ.id);
          setNewStimulus(existingQ.stimulus || '');
          setNewQuestionText(existingQ.text);
          setNewQuestionImage(existingQ.image || '');
          
          // Determine Media Type Tab
          if (existingQ.image) setMediaType('image');
          else setMediaType('text');
          
          if (existingQ.type === QuestionType.SINGLE) {
              setNewOptions(existingQ.options || ['', '', '', '']);
              setSingleCorrectIndex(existingQ.correctAnswerIndex || 0);
          } else if (existingQ.type === QuestionType.COMPLEX) {
              setNewOptions(existingQ.options || ['', '', '', '']);
              setComplexCorrectIndices(existingQ.correctAnswerIndices || []);
          } else if (existingQ.type === QuestionType.MATCHING) {
              setNewOptions(existingQ.options || ['Benar', 'Salah']);
              setMatchingPairs(existingQ.matchingPairs || [{left: '', right: ''}]);
          }
      } else {
          // New Question for this slot
          setEditingQuestionId(null);
          setNewStimulus('');
          setNewQuestionText('');
          setNewQuestionImage('');
          setMediaType('text'); // Default to text
          
          if (typeForSlot === QuestionType.MATCHING) {
              setNewOptions(['Benar', 'Salah']);
              setMatchingPairs([{left: '', right: ''}]);
          } else {
              setNewOptions(['', '', '', '']);
              setSingleCorrectIndex(0);
              setComplexCorrectIndices([]);
          }
      }
      
      // Scroll to form
      window.scrollTo({ top: 100, behavior: 'smooth' });
  };

  const handleSaveQuestionSlot = () => {
      if (!selectedPacketId || activeSlot === null) return;
      if (!newQuestionText) { alert("Pertanyaan wajib diisi"); return; }

      const questionData: Partial<Question> = {
          packetId: selectedPacketId,
          number: activeSlot, // Force number
          stimulus: mediaType === 'text' ? newStimulus : '', // Only save stimulus if in text mode, or keep logic loose? 
          // Better logic: If image mode selected and image exists, save image, clear stimulus? 
          // Or just save whatever is in the active state variables. 
          // Let's keep logic simple: Save both if they exist, but generally user uses one.
          text: newQuestionText,
          image: newQuestionImage,
          type: manualType,
      };
      
      // Optional: Clear the non-selected media type to be clean
      if (mediaType === 'image') questionData.stimulus = '';
      if (mediaType === 'text') questionData.image = '';

      // Validation & Data Structuring based on Type
      if (manualType === QuestionType.SINGLE) {
        if(newOptions.some(o => !o.trim())) { alert('Isi semua opsi!'); return; }
        questionData.options = newOptions;
        questionData.correctAnswerIndex = singleCorrectIndex;
      } else if (manualType === QuestionType.COMPLEX) {
        if(newOptions.some(o => !o.trim())) { alert('Isi semua opsi!'); return; }
        if(complexCorrectIndices.length === 0) { alert('Pilih minimal satu jawaban benar!'); return; }
        questionData.options = newOptions;
        questionData.correctAnswerIndices = complexCorrectIndices;
      } else if (manualType === QuestionType.MATCHING) {
        if(matchingPairs.some(p => !p.left.trim() || !p.right.trim())) { alert('Isi semua pernyataan dan kunci jawaban!'); return; }
        questionData.options = [newOptions[0] || 'Benar', newOptions[1] || 'Salah'];
        questionData.matchingPairs = matchingPairs;
      }

      if (editingQuestionId) {
          // Update Existing
          setQuestions(prev => prev.map(q => q.id === editingQuestionId ? { ...q, ...questionData } as Question : q));
          alert(`Soal No. ${activeSlot} diperbarui`);
      } else {
          // Create New
          const newQ = { ...questionData, id: `q-${Date.now()}` } as Question;
          setQuestions(prev => [...prev, newQ]);
          alert(`Soal No. ${activeSlot} disimpan`);
      }
      setActiveSlot(null); // Close form
  };

  // --- Render Views ---

  if (activeTab === 'dashboard') {
    return (
      <div className="p-8">
        <h2 className="text-3xl font-black mb-6 text-white uppercase tracking-wider flex items-center gap-3">
            <span className="w-2 h-8 bg-yellow-500 block"></span>
            Dashboard {userRole === Role.ADMIN ? 'Admin' : 'Guru'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/80 p-6 border border-white/10 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Total Siswa</h3>
            <p className="text-5xl font-black text-blue-500">{students.length}</p>
          </div>
          <div className="bg-slate-900/80 p-6 border border-white/10 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Total Soal</h3>
            <p className="text-5xl font-black text-purple-500">{questions.length}</p>
          </div>
          <div className="bg-slate-900/80 p-6 border border-white/10 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-all"></div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Ujian Terjadwal</h3>
            <p className="text-5xl font-black text-green-500">{exams.length}</p>
          </div>
        </div>
      </div>
    );
  }

  // --- SETTINGS TAB (NEW) ---
  if (activeTab === 'settings') {
      return (
          <div className="p-8 h-full flex flex-col">
              <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-wider mb-6">
                  <Settings className="text-yellow-500"/> Pengaturan Sekolah
              </h2>
              
              <div className="max-w-2xl bg-slate-900/80 border border-white/10 p-8 rounded-lg shadow-xl">
                  <div className="space-y-6">
                      <div>
                          <label className="text-xs font-bold text-blue-400 uppercase tracking-widest block mb-2">Nama Sekolah</label>
                          <input 
                            type="text" 
                            className="w-full bg-black/50 border border-slate-700 p-3 text-white text-sm focus:border-blue-500 outline-none"
                            value={schoolSettings?.schoolName || ''}
                            onChange={e => setSchoolSettings && setSchoolSettings({...schoolSettings!, schoolName: e.target.value})}
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                          <div>
                              <label className="text-xs font-bold text-blue-400 uppercase tracking-widest block mb-2">Tahun Pelajaran</label>
                              <input 
                                type="text" 
                                className="w-full bg-black/50 border border-slate-700 p-3 text-white text-sm focus:border-blue-500 outline-none"
                                value={schoolSettings?.academicYear || ''}
                                onChange={e => setSchoolSettings && setSchoolSettings({...schoolSettings!, academicYear: e.target.value})}
                              />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-blue-400 uppercase tracking-widest block mb-2">Semester</label>
                              <select
                                className="w-full bg-black/50 border border-slate-700 p-3 text-white text-sm focus:border-blue-500 outline-none"
                                value={schoolSettings?.semester || 'Ganjil'}
                                onChange={e => setSchoolSettings && setSchoolSettings({...schoolSettings!, semester: e.target.value})}
                              >
                                  <option value="Ganjil">Ganjil</option>
                                  <option value="Genap">Genap</option>
                              </select>
                          </div>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-blue-400 uppercase tracking-widest block mb-2">Password Admin Login</label>
                          <input 
                            type="text" 
                            className="w-full bg-black/50 border border-slate-700 p-3 text-white text-sm focus:border-blue-500 outline-none font-mono text-yellow-500"
                            value={schoolSettings?.adminPassword || ''}
                            onChange={e => setSchoolSettings && setSchoolSettings({...schoolSettings!, adminPassword: e.target.value})}
                          />
                          <p className="text-[10px] text-slate-500 mt-2 italic">* Password ini digunakan untuk login sebagai Admin Utama.</p>
                      </div>
                      <div className="pt-4 border-t border-white/10 flex justify-end">
                          <button 
                            className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-widest text-xs rounded flex items-center gap-2"
                            onClick={() => alert("Pengaturan berhasil disimpan!")}
                          >
                              <Save size={16}/> Simpan Perubahan
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  // --- 1. MONITORING UJIAN TAB ---
  if (activeTab === 'monitor') {
     // ... (Monitor code remains same) ...
     // Skipping brevity but assuming it's part of the file as per instructions to return full content or updated parts.
     // To keep response efficient, I will only include the changed parts fully, but since I have to return full files if they are updated significantly...
     // I will include the monitor section briefly or fully if needed. The prompt implies modifying AdminDashboard.
     // Since I'm replacing AdminDashboard.tsx, I must include ALL existing logic + new logic.
     
     const cheatingStudents = monitoringData.filter(d => d.violationCount > 0);
     
     return (
          <div className="p-8 h-full flex flex-col">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-wider">
                    <Activity className="text-red-500"/> Monitoring Ujian Live
                </h2>
                <div className="flex items-center gap-4">
                    {lastUpdated && <span className="text-xs text-slate-500 font-mono">Last Update: {lastUpdated.toLocaleTimeString()}</span>}
                    <button onClick={handleRefreshMonitor} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded uppercase tracking-wider text-xs flex items-center gap-2">
                        <RefreshCw size={14}/> Refresh Data
                    </button>
                </div>
             </div>
             
             {/* ALERT CHEATING */}
             {cheatingStudents.length > 0 && (
                <div className="mb-6 bg-red-900/30 border border-red-500 p-4 flex items-start gap-4 animate-pulse">
                    <div className="bg-red-500 p-2 rounded-full text-white mt-1">
                        <ShieldAlert size={24} />
                    </div>
                    <div>
                        <h3 className="text-red-400 font-black uppercase text-lg">Peringatan Keamanan!</h3>
                        <p className="text-red-200 text-sm">Terdeteksi {cheatingStudents.length} siswa melakukan aktivitas mencurigakan (Keluar dari Tab Ujian).</p>
                    </div>
                </div>
             )}
             
             <div className="bg-slate-900/80 p-6 border border-white/10 mb-6">
                 <label className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2 block">Pilih Ujian Aktif</label>
                 <select 
                    value={selectedExamForMonitor} 
                    onChange={(e) => setSelectedExamForMonitor(e.target.value)} 
                    className="bg-black text-white p-3 border border-slate-700 w-full md:w-1/2 outline-none focus:border-blue-500"
                 >
                     <option value="">-- Pilih Jadwal Ujian --</option>
                     {exams.filter(e => e.isActive).map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                 </select>
             </div>

             {selectedExamForMonitor ? (
                 monitoringData.length > 0 ? (
                     <div className="bg-slate-900 border border-white/10 overflow-hidden flex-1">
                         <div className="grid grid-cols-5 bg-black/50 p-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-white/10">
                             <div className="col-span-1">Nama Siswa</div>
                             <div className="col-span-1 text-center">Status</div>
                             <div className="col-span-1 text-center">Pelanggaran</div>
                             <div className="col-span-1 text-center">Progress</div>
                             <div className="col-span-1 text-right">Estimasi Skor</div>
                         </div>
                         <div className="overflow-y-auto h-[400px] custom-scrollbar">
                             {monitoringData.map((d, i) => (
                                 <div key={i} className={`grid grid-cols-5 p-3 border-b border-white/5 items-center hover:bg-white/5 transition text-sm ${d.violationCount > 0 ? 'bg-red-900/10' : ''}`}>
                                     <div className="font-bold text-white col-span-1 flex items-center gap-2">
                                        {d.student.name}
                                        {d.violationCount > 0 && <AlertOctagon size={14} className="text-red-500" />}
                                     </div>
                                     <div className="text-center col-span-1">
                                         <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                             d.status === 'DONE' ? 'bg-green-900 text-green-400' :
                                             d.status === 'DISQUALIFIED' ? 'bg-red-600 text-white' :
                                             d.status === 'WORKING' ? 'bg-blue-900 text-blue-400 animate-pulse' :
                                             'bg-slate-800 text-slate-500'
                                         }`}>
                                             {d.status === 'DISQUALIFIED' ? 'DISKUALIFIKASI' : d.status}
                                         </span>
                                     </div>
                                     <div className="text-center col-span-1 font-mono">
                                         <span className={`font-bold ${d.violationCount > 0 ? 'text-red-500' : 'text-slate-500'}`}>
                                            {d.violationCount} / 3
                                         </span>
                                     </div>
                                     <div className="px-4 col-span-1">
                                         <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                             <div 
                                                className="bg-yellow-500 h-full transition-all duration-500" 
                                                style={{ width: `${(d.answers.filter((a: any) => a !== null).length / d.answers.length) * 100}%` }}
                                             ></div>
                                         </div>
                                     </div>
                                     <div className="text-right col-span-1 font-mono text-yellow-500">
                                         {d.score > 0 ? d.score.toFixed(0) : '-'}
                                     </div>
                                 </div>
                             ))}
                         </div>
                     </div>
                 ) : (
                     <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-black/20 border border-dashed border-slate-800">
                         <Users size={48} className="mb-4 opacity-20"/>
                         <p className="uppercase tracking-widest font-bold">Menunggu Data Peserta...</p>
                     </div>
                 )
             ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-black/20 border border-dashed border-slate-800">
                     <Activity size={48} className="mb-4 opacity-20"/>
                     <p className="uppercase tracking-widest font-bold">Pilih ujian untuk mulai memantau</p>
                 </div>
             )}
          </div>
     );
  }

  // --- 2. JADWAL UJIAN TAB ---
  if (activeTab === 'exams') {
      return (
          <div className="p-8 h-full flex flex-col">
              <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-wider mb-6">
                  <CalendarClock className="text-yellow-500"/> Manajemen Jadwal Ujian
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full overflow-hidden">
                  {/* Form Create Exam */}
                  <div className="lg:col-span-1 bg-slate-900/80 p-6 border border-white/10 h-fit overflow-y-auto">
                      <h3 className="font-bold text-white uppercase tracking-wider mb-6 border-b border-white/10 pb-2">Buat Jadwal Baru</h3>
                      <div className="space-y-4">
                          <div>
                              <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Nama Ujian</label>
                              <input 
                                type="text" 
                                className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm focus:border-blue-500 outline-none"
                                placeholder="CONTOH: PAS GANJIL 2024"
                                value={newExamTitle}
                                onChange={e => setNewExamTitle(e.target.value)}
                              />
                          </div>
                          <div>
                              <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Paket Soal</label>
                              <select 
                                className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm focus:border-blue-500 outline-none"
                                value={newExamPacketId}
                                onChange={e => setNewExamPacketId(e.target.value)}
                              >
                                  <option value="">-- PILIH PAKET SOAL --</option>
                                  {visiblePackets.map(p => (
                                      <option key={p.id} value={p.id}>{p.name} ({p.totalQuestions} Soal)</option>
                                  ))}
                              </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                              <div>
                                  <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Mulai</label>
                                  <input 
                                    type="datetime-local" 
                                    className="w-full bg-black/50 border border-slate-700 p-2 text-white text-xs focus:border-blue-500 outline-none"
                                    value={newExamStart}
                                    onChange={e => setNewExamStart(e.target.value)}
                                  />
                              </div>
                              <div>
                                  <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Selesai</label>
                                  <input 
                                    type="datetime-local" 
                                    className="w-full bg-black/50 border border-slate-700 p-2 text-white text-xs focus:border-blue-500 outline-none"
                                    value={newExamEnd}
                                    onChange={e => setNewExamEnd(e.target.value)}
                                  />
                              </div>
                          </div>
                          <div>
                              <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Durasi (Menit)</label>
                              <input 
                                type="number" 
                                className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm focus:border-blue-500 outline-none"
                                value={newExamDuration}
                                onChange={e => setNewExamDuration(parseInt(e.target.value))}
                              />
                          </div>
                          <div>
                              <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-2">Target Kelas</label>
                              <div className="grid grid-cols-3 gap-2">
                                  {CLASS_LIST.map(cls => (
                                      <button 
                                        key={cls}
                                        onClick={() => {
                                            if (newExamClasses.includes(cls)) setNewExamClasses(newExamClasses.filter(c => c !== cls));
                                            else setNewExamClasses([...newExamClasses, cls]);
                                        }}
                                        className={`py-1 text-[10px] font-bold border transition-colors ${newExamClasses.includes(cls) ? 'bg-yellow-600 border-yellow-500 text-black' : 'bg-transparent border-slate-700 text-slate-500 hover:border-yellow-500'}`}
                                      >
                                          {cls}
                                      </button>
                                  ))}
                              </div>
                          </div>
                          <button 
                            onClick={handleCreateExam}
                            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-widest mt-4 text-xs shadow-lg"
                          >
                              Jadwalkan Ujian
                          </button>
                      </div>
                  </div>

                  {/* List Exams */}
                  <div className="lg:col-span-2 overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {exams.length === 0 ? (
                              <div className="col-span-2 text-center p-10 border-2 border-dashed border-slate-800 text-slate-500">
                                  Belum ada ujian terjadwal.
                              </div>
                          ) : (
                              exams.map(exam => {
                                  const isActive = exam.isActive;
                                  const packetName = packets.find(p => p.id === exam.packetId)?.name || 'Paket Terhapus';
                                  
                                  return (
                                      <div key={exam.id} className={`bg-slate-900 border p-5 relative overflow-hidden group ${isActive ? 'border-green-500' : 'border-slate-700 opacity-75'}`}>
                                          <div className={`absolute top-0 right-0 px-2 py-1 text-[9px] font-black uppercase tracking-widest ${isActive ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                              {isActive ? 'Active' : 'Stopped'}
                                          </div>
                                          
                                          <h4 className="font-bold text-white text-lg uppercase italic truncate pr-16">{exam.title}</h4>
                                          <p className="text-xs text-blue-400 font-bold uppercase mb-4 tracking-wider">{packetName}</p>
                                          
                                          <div className="grid grid-cols-2 gap-y-2 text-xs text-slate-400 mb-4 font-mono">
                                              <div className="flex items-center gap-2"><Clock size={12}/> {exam.durationMinutes} Menit</div>
                                              <div className="flex items-center gap-2"><Users size={12}/> {exam.classTarget.length} Kelas</div>
                                              <div className="col-span-2 text-[10px] mt-1 pt-2 border-t border-white/5">
                                                  {new Date(exam.scheduledStart).toLocaleString()}
                                              </div>
                                          </div>

                                          <div className="flex gap-2 mt-4">
                                              <button 
                                                onClick={() => toggleExamStatus(exam.id)}
                                                className={`flex-1 py-2 font-bold uppercase text-[10px] tracking-wider flex items-center justify-center gap-2 ${isActive ? 'bg-slate-800 text-slate-300 hover:bg-red-900/50 hover:text-red-500' : 'bg-green-600 text-white hover:bg-green-500'}`}
                                              >
                                                  {isActive ? <><StopCircle size={14}/> Stop</> : <><PlayCircle size={14}/> Start</>}
                                              </button>
                                              <button 
                                                onClick={() => handleDeleteExam(exam.id)}
                                                className="px-3 bg-red-900/20 text-red-500 border border-red-900/50 hover:bg-red-900/50"
                                              >
                                                  <Trash2 size={16}/>
                                              </button>
                                          </div>
                                      </div>
                                  );
                              })
                          )}
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  // --- 3. ANALISIS NILAI TAB ---
  if (activeTab === 'analysis') {
      return (
          <div className="p-8 h-full flex flex-col">
               <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-wider mb-6">
                  <BarChart2 className="text-yellow-500"/> Analisis Hasil Ujian
               </h2>

               <div className="bg-slate-900/80 p-4 border border-white/10 mb-6 flex flex-wrap gap-4 items-end">
                   <div className="flex-1 min-w-[200px]">
                       <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Pilih Ujian</label>
                       <select 
                          className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm outline-none"
                          value={selectedExamIdForAnalysis}
                          onChange={e => setSelectedExamIdForAnalysis(e.target.value)}
                       >
                           {visibleExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                       </select>
                   </div>
                   <div className="w-[150px]">
                       <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Filter Kelas</label>
                       <select 
                          className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm outline-none"
                          value={selectedClassForRecap}
                          onChange={e => setSelectedClassForRecap(e.target.value)}
                       >
                           {CLASS_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                   </div>
                   <div className="flex bg-black/50 p-1 border border-slate-700">
                       <button 
                         onClick={() => setAnalysisSubTab('item')}
                         className={`px-4 py-2 text-xs font-bold uppercase tracking-wider ${analysisSubTab === 'item' ? 'bg-yellow-600 text-black' : 'text-slate-500 hover:text-white'}`}
                       >
                           Analisis Butir
                       </button>
                       <button 
                         onClick={() => setAnalysisSubTab('recap')}
                         className={`px-4 py-2 text-xs font-bold uppercase tracking-wider ${analysisSubTab === 'recap' ? 'bg-yellow-600 text-black' : 'text-slate-500 hover:text-white'}`}
                       >
                           Rekap Nilai
                       </button>
                   </div>
               </div>

               <div className="flex-1 bg-slate-900 border border-white/10 overflow-hidden relative">
                   {/* View: ITEM ANALYSIS */}
                   {analysisSubTab === 'item' && (
                       <div className="h-full flex flex-col">
                           <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
                               <h3 className="font-bold text-white uppercase tracking-wider">Statistik Butir Soal</h3>
                               <div className="flex gap-2">
                                   <button onClick={handleDownloadAnalysisExcel} className="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-bold uppercase rounded flex items-center gap-2"><FileSpreadsheet size={14}/> Excel</button>
                                   <button onClick={handleDownloadAnalysisPDF} className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs font-bold uppercase rounded flex items-center gap-2"><FileText size={14}/> PDF</button>
                               </div>
                           </div>
                           <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                               {mockItemResults.length > 0 ? (
                                   <div className="grid grid-cols-1 gap-4">
                                       {selectedExamForAnalysis?.questions.map((q, idx) => {
                                           // Calculate fake stats
                                           const correctCount = mockItemResults.filter(r => r.answers[q.id] === q.correctAnswerIndex || r.answers[q.id] === 'CORRECT').length;
                                           const percent = (correctCount / mockItemResults.length) * 100;
                                           
                                           return (
                                               <div key={q.id} className="bg-black/40 border border-slate-800 p-4">
                                                   <div className="flex justify-between items-start mb-2">
                                                       <span className="font-bold text-yellow-500 text-sm">Soal No. {idx + 1}</span>
                                                       <span className={`text-xs font-bold px-2 py-0.5 rounded ${percent > 70 ? 'bg-green-900 text-green-400' : percent < 40 ? 'bg-red-900 text-red-400' : 'bg-yellow-900 text-yellow-400'}`}>
                                                           {percent.toFixed(0)}% Benar
                                                       </span>
                                                   </div>
                                                   <p className="text-slate-300 text-sm mb-3 line-clamp-2">{q.text}</p>
                                                   <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                                       <div className="bg-blue-500 h-full" style={{ width: `${percent}%` }}></div>
                                                   </div>
                                               </div>
                                           )
                                       })}
                                   </div>
                               ) : <div className="text-center text-slate-500 mt-10">Pilih ujian untuk melihat data.</div>}
                           </div>
                       </div>
                   )}

                   {/* View: RECAP */}
                   {analysisSubTab === 'recap' && (
                       <div className="h-full flex flex-col">
                           <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
                               <h3 className="font-bold text-white uppercase tracking-wider">Rekap Nilai Kelas: {selectedClassForRecap}</h3>
                               <div className="flex gap-2">
                                   <button onClick={handleDownloadRecapExcel} className="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-bold uppercase rounded flex items-center gap-2"><FileSpreadsheet size={14}/> Excel</button>
                                   <button onClick={handleDownloadRecapPDF} className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs font-bold uppercase rounded flex items-center gap-2"><FileText size={14}/> PDF</button>
                               </div>
                           </div>
                           <div className="overflow-auto custom-scrollbar flex-1">
                               <table className="w-full text-left border-collapse">
                                   <thead className="bg-slate-950 text-xs text-slate-400 uppercase font-bold sticky top-0 z-10">
                                       <tr>
                                           <th className="p-3 border-b border-slate-800">No</th>
                                           <th className="p-3 border-b border-slate-800">Nama Siswa</th>
                                           <th className="p-3 border-b border-slate-800">NIS</th>
                                           {(userRole === Role.ADMIN || userRole === Role.TEACHER_LITERASI) && (
                                              <th className="p-3 border-b border-slate-800 text-center text-purple-400">Literasi</th>
                                           )}
                                           {(userRole === Role.ADMIN || userRole === Role.TEACHER_NUMERASI) && (
                                              <th className="p-3 border-b border-slate-800 text-center text-orange-400">Numerasi</th>
                                           )}
                                           <th className="p-3 border-b border-slate-800 text-right text-yellow-500">Nilai Akhir</th>
                                       </tr>
                                   </thead>
                                   <tbody className="text-sm text-slate-300 divide-y divide-slate-800">
                                       {recapResults.map((r, i) => (
                                           <tr key={i} className="hover:bg-white/5">
                                               <td className="p-3 text-center w-12">{i + 1}</td>
                                               <td className="p-3 font-medium">{r.studentName}</td>
                                               <td className="p-3 font-mono text-slate-500">{r.studentNis}</td>
                                               {(userRole === Role.ADMIN || userRole === Role.TEACHER_LITERASI) && (
                                                  <td className="p-3 text-center">{r.literasiScore.toFixed(0)}</td>
                                               )}
                                               {(userRole === Role.ADMIN || userRole === Role.TEACHER_NUMERASI) && (
                                                  <td className="p-3 text-center">{r.numerasiScore.toFixed(0)}</td>
                                               )}
                                               <td className="p-3 text-right font-bold text-white">{r.score.toFixed(1)}</td>
                                           </tr>
                                       ))}
                                       {recapResults.length === 0 && (
                                           <tr><td colSpan={6} className="p-8 text-center text-slate-500 italic">Tidak ada data untuk kelas ini.</td></tr>
                                       )}
                                   </tbody>
                               </table>
                           </div>
                       </div>
                   )}
               </div>
          </div>
      );
  }

  // --- 4. DATA SISWA TAB (UPDATED) ---
  if (activeTab === 'students') {
      const filteredStudents = students.filter(s => 
          (s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.nis.includes(searchTerm)) &&
          (selectedClassFilter === '' || s.class === selectedClassFilter)
      );

      return (
          <div className="p-8 h-full flex flex-col relative">
               <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-wider mb-6">
                   <GraduationCap className="text-yellow-500"/> Data Siswa
               </h2>

               {/* TOOLBAR */}
               <div className="bg-slate-900 border border-white/10 p-4 mb-4 flex flex-wrap gap-4 items-center justify-between">
                   <div className="flex items-center gap-4 flex-1">
                       {/* Search */}
                       <div className="relative">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14}/>
                           <input 
                             type="text" 
                             className="bg-black/50 border border-slate-700 rounded-full py-2 pl-9 pr-4 text-xs text-white focus:border-blue-500 outline-none w-[200px]"
                             placeholder="Cari nama / NIS..."
                             value={searchTerm}
                             onChange={e => setSearchTerm(e.target.value)}
                           />
                       </div>
                       {/* Class Filter */}
                       <div className="relative">
                           <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14}/>
                           <select
                                className="bg-black/50 border border-slate-700 rounded-full py-2 pl-9 pr-8 text-xs text-white focus:border-blue-500 outline-none appearance-none cursor-pointer"
                                value={selectedClassFilter}
                                onChange={e => setSelectedClassFilter(e.target.value)}
                           >
                               <option value="">Semua Kelas</option>
                               {CLASS_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                           </select>
                           <ArrowRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 rotate-90" size={12}/>
                       </div>
                   </div>

                   <div className="flex gap-2">
                       <button 
                         onClick={() => setShowAddStudentModal(true)}
                         className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 rounded"
                       >
                           <UserPlus size={16}/> Tambah Siswa
                       </button>
                       <button 
                         onClick={() => setShowImportModal(true)}
                         className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 rounded"
                       >
                           <FileSpreadsheet size={16}/> Import Excel
                       </button>
                   </div>
               </div>

               {/* LIST TABLE (FULL WIDTH) */}
               <div className="flex-1 bg-slate-900 border border-white/10 flex flex-col overflow-hidden">
                   <div className="p-3 border-b border-white/10 bg-black/20 text-xs text-slate-500 font-mono text-right">
                       TOTAL: <span className="text-white font-bold">{filteredStudents.length}</span> SISWA
                   </div>
                   <div className="flex-1 overflow-auto custom-scrollbar">
                       <table className="w-full text-left border-collapse">
                           <thead className="bg-slate-950 text-xs text-slate-400 uppercase font-bold sticky top-0 z-10">
                               <tr>
                                   <th className="p-3 border-b border-slate-800 w-12 text-center">No</th>
                                   <th className="p-3 border-b border-slate-800">Nama Lengkap</th>
                                   <th className="p-3 border-b border-slate-800">Kelas</th>
                                   <th className="p-3 border-b border-slate-800">NIS / NISN</th>
                                   <th className="p-3 border-b border-slate-800 text-center w-24">Aksi</th>
                               </tr>
                           </thead>
                           <tbody className="text-sm text-slate-300 divide-y divide-slate-800">
                               {filteredStudents.map((s, idx) => (
                                   <tr key={s.id} className="hover:bg-white/5 group">
                                       <td className="p-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                                       <td className="p-3 font-medium text-white">{s.name}</td>
                                       <td className="p-3">
                                           <span className="bg-slate-800 text-yellow-500 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-700">{s.class}</span>
                                       </td>
                                       <td className="p-3 font-mono text-xs text-slate-400">{s.nis} <span className="text-slate-600">/</span> {s.nisn}</td>
                                       <td className="p-3 text-center">
                                           <button onClick={() => handleDeleteStudent(s.id)} className="text-slate-600 hover:text-red-500 transition-colors p-1 border border-transparent hover:border-red-500/30 rounded">
                                               <Trash2 size={16}/>
                                           </button>
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>
               </div>

               {/* MODAL: ADD STUDENT */}
               {showAddStudentModal && (
                   <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                       <div className="bg-slate-900 border border-white/10 w-full max-w-md shadow-2xl relative animate-fade-in">
                           <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
                               <h3 className="font-bold text-white uppercase tracking-wider flex items-center gap-2"><UserPlus size={18}/> Tambah Siswa Manual</h3>
                               <button onClick={() => setShowAddStudentModal(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
                           </div>
                           <div className="p-6 space-y-4">
                               <div>
                                   <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Nama Lengkap</label>
                                   <input 
                                     type="text" 
                                     className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm focus:border-blue-500 outline-none"
                                     placeholder="Nama Siswa"
                                     value={newStudent.name}
                                     onChange={e => setNewStudent({...newStudent, name: e.target.value})}
                                   />
                               </div>
                               <div>
                                   <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Kelas</label>
                                   <select 
                                     className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm focus:border-blue-500 outline-none"
                                     value={newStudent.class}
                                     onChange={e => setNewStudent({...newStudent, class: e.target.value})}
                                   >
                                       <option value="">-- Pilih Kelas --</option>
                                       {CLASS_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                                   </select>
                               </div>
                               <div className="grid grid-cols-2 gap-4">
                                   <div>
                                       <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">NIS</label>
                                       <input 
                                         type="text" 
                                         className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm focus:border-blue-500 outline-none"
                                         value={newStudent.nis}
                                         onChange={e => setNewStudent({...newStudent, nis: e.target.value})}
                                       />
                                   </div>
                                   <div>
                                       <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">NISN</label>
                                       <input 
                                         type="text" 
                                         className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm focus:border-blue-500 outline-none"
                                         value={newStudent.nisn}
                                         onChange={e => setNewStudent({...newStudent, nisn: e.target.value})}
                                       />
                                   </div>
                               </div>
                               <div className="pt-4">
                                   <button 
                                     onClick={handleAddStudent}
                                     className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-xs shadow-lg"
                                   >
                                       Simpan Data
                                   </button>
                               </div>
                           </div>
                       </div>
                   </div>
               )}

               {/* MODAL: IMPORT EXCEL */}
               {showImportModal && (
                   <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                       <div className="bg-slate-900 border border-white/10 w-full max-w-md shadow-2xl relative animate-fade-in">
                           <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
                               <h3 className="font-bold text-white uppercase tracking-wider flex items-center gap-2"><FileSpreadsheet size={18}/> Import Data Excel</h3>
                               <button onClick={() => setShowImportModal(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
                           </div>
                           <div className="p-6 space-y-6">
                               <div className="text-center">
                                   <div className="w-16 h-16 bg-green-900/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                       <FileSpreadsheet size={32} className="text-green-500"/>
                                   </div>
                                   <p className="text-slate-300 text-sm mb-4">Upload file Excel (.xlsx) berisi data siswa. Pastikan format sesuai template.</p>
                                   <button onClick={handleDownloadStudentTemplate} className="text-blue-400 hover:text-blue-300 text-xs font-bold uppercase underline">Download Template</button>
                               </div>

                               <div className="border-2 border-dashed border-slate-700 bg-black/20 p-8 rounded-lg relative hover:border-blue-500 transition-colors">
                                   <input type="file" ref={studentFileRef} onChange={handleImportStudentExcel} className="absolute inset-0 opacity-0 cursor-pointer" accept=".xlsx"/>
                                   <div className="text-center pointer-events-none">
                                       <Upload size={24} className="mx-auto text-slate-500 mb-2"/>
                                       <p className="text-xs text-slate-400 font-bold uppercase">Klik atau Drag File Disini</p>
                                   </div>
                               </div>
                           </div>
                       </div>
                   </div>
               )}

          </div>
      );
  }

  // --- BANK SOAL VIEW (FIXED) ---
  if (activeTab === 'questions') {
    return (
      <div className="p-8 flex flex-col min-h-full">
         <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-3">
             <BookOpen className="text-yellow-500" /> Bank Soal
          </h2>
          <div className="flex bg-black/50 p-1 border border-white/10">
            <button onClick={() => setBankSubTab('config')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${bankSubTab === 'config' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>
              <span className="flex items-center gap-2"><Layout size={14}/> Konfigurasi Paket</span>
            </button>
            <button onClick={() => setBankSubTab('input')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${bankSubTab === 'input' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>
              <span className="flex items-center gap-2"><List size={14}/> Input & Daftar Soal</span>
            </button>
          </div>
        </div>
        
        {/* Sub-View: CONFIG PACKET */}
        {bankSubTab === 'config' && (
             <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
                 {/* Form Config */}
                 <div className="lg:col-span-1 bg-slate-900/80 p-6 border border-white/10 h-fit">
                     <h3 className="font-bold text-white uppercase tracking-wider mb-6 border-b border-white/10 pb-2">
                         {editingPacketId ? 'Edit Paket' : 'Buat Paket Baru'}
                     </h3>
                     <div className="space-y-4">
                         <div>
                             <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Nama Paket</label>
                             <input 
                               type="text" 
                               className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm focus:border-blue-500 outline-none"
                               value={newPacketName}
                               onChange={e => setNewPacketName(e.target.value)}
                               placeholder="Contoh: Literasi Kelas 7 Bab 1"
                             />
                         </div>
                         <div>
                             <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Kategori</label>
                             <select 
                               className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm focus:border-blue-500 outline-none"
                               value={newPacketCategory}
                               onChange={e => setNewPacketCategory(e.target.value as QuestionCategory)}
                               disabled={userRole !== Role.ADMIN} // Guru restricted
                             >
                                 <option value={QuestionCategory.LITERASI}>Literasi</option>
                                 <option value={QuestionCategory.NUMERASI}>Numerasi</option>
                             </select>
                         </div>
                         <div>
                             <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Jumlah Soal</label>
                             <input 
                               type="number" 
                               className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm focus:border-blue-500 outline-none"
                               value={newPacketTotal}
                               onChange={e => setNewPacketTotal(parseInt(e.target.value))}
                               placeholder="Total soal dalam paket"
                             />
                         </div>
                         <div className="flex gap-2 mt-4">
                             {editingPacketId && (
                                 <button onClick={resetPacketForm} className="flex-1 py-3 bg-slate-800 text-slate-400 font-bold uppercase tracking-widest text-xs hover:bg-slate-700">Batal</button>
                             )}
                             <button onClick={handleSavePacket} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-xs shadow-lg">Simpan Paket</button>
                         </div>
                     </div>
                 </div>

                 {/* List Packets */}
                 <div className="lg:col-span-2 overflow-y-auto custom-scrollbar">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {visiblePackets.map(pkt => (
                             <div key={pkt.id} className="bg-slate-900 border border-slate-700 p-4 relative group hover:border-blue-500 transition-colors">
                                 <div className="flex justify-between items-start mb-2">
                                     <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${pkt.category === QuestionCategory.LITERASI ? 'bg-purple-900/30 text-purple-400 border-purple-500/50' : 'bg-orange-900/30 text-orange-400 border-orange-500/50'}`}>
                                         {pkt.category}
                                     </span>
                                     <div className="flex gap-2">
                                         <button onClick={() => handleEditPacket(pkt)} className="p-1.5 bg-slate-800 hover:bg-blue-600 text-white rounded transition"><Edit2 size={14}/></button>
                                         <button onClick={() => deletePacket(pkt.id)} className="p-1.5 bg-slate-800 hover:bg-red-600 text-white rounded transition"><Trash2 size={14}/></button>
                                     </div>
                                 </div>
                                 <h4 className="font-bold text-white text-lg mb-4">{pkt.name}</h4>
                                 <div className="flex justify-between items-end text-xs text-slate-400 font-mono">
                                     <span>ID: {pkt.id}</span>
                                     <span className="font-bold text-white">{pkt.totalQuestions} Soal</span>
                                 </div>
                             </div>
                         ))}
                         {visiblePackets.length === 0 && <div className="col-span-2 text-center text-slate-500 p-8 border border-dashed border-slate-700">Belum ada paket soal.</div>}
                     </div>
                 </div>
             </div>
        )}

        {/* Sub-View: INPUT SOAL */}
        {bankSubTab === 'input' && (
             <div className="flex-1 flex flex-col h-full overflow-hidden">
                 {/* Selector Packet */}
                 <div className="bg-slate-900/80 p-4 border border-white/10 mb-4 flex items-center gap-4">
                     <div className="flex-1">
                         <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Pilih Paket Soal</label>
                         <select 
                            value={selectedPacketId} 
                            onChange={(e) => { setSelectedPacketId(e.target.value); setActiveSlot(null); }} 
                            className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm focus:border-blue-500 outline-none"
                         >
                             <option value="">-- Pilih Paket untuk Edit Soal --</option>
                             {visiblePackets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                         </select>
                     </div>
                     {selectedPacketId && (
                         <div className="flex gap-2 pt-5">
                             <input type="file" ref={fileInputRef} onChange={handleImportWord} className="hidden" accept=".docx"/>
                             <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-xs font-bold uppercase rounded flex items-center gap-2"><FileText size={14}/> Import Word</button>
                             <button onClick={handleDownloadWordTemplate} className="px-4 py-2 border border-slate-600 hover:border-white text-slate-300 hover:text-white text-xs font-bold uppercase rounded flex items-center gap-2"><Download size={14}/> Template</button>
                         </div>
                     )}
                 </div>

                 {selectedPacketId ? (
                     <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
                         {/* Question Navigator */}
                         <div className="lg:col-span-1 bg-slate-900 border border-white/10 flex flex-col h-full">
                             <div className="p-3 bg-black/20 border-b border-white/10">
                                 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Navigator Soal</h4>
                             </div>
                             <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                 <div className="grid grid-cols-5 gap-2">
                                     {Array.from({ length: selectedPacket?.totalQuestions || 0 }).map((_, idx) => {
                                         const num = idx + 1;
                                         const hasQ = questions.some(q => q.packetId === selectedPacketId && q.number === num);
                                         const type = selectedPacket?.questionTypes[num] || QuestionType.SINGLE;
                                         let typeCode = 'PG';
                                         if (type === QuestionType.COMPLEX) typeCode = 'PK';
                                         if (type === QuestionType.MATCHING) typeCode = 'JD';

                                         return (
                                             <button 
                                                key={num} 
                                                onClick={() => prepareSlotForm(num)}
                                                className={`aspect-square border flex flex-col items-center justify-center relative ${activeSlot === num ? 'bg-yellow-500 text-black border-yellow-400' : hasQ ? 'bg-blue-900/30 text-blue-400 border-blue-500/50' : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-500'}`}
                                             >
                                                 <span className="font-black text-sm">{num}</span>
                                                 <span className="text-[8px] uppercase opacity-70">{typeCode}</span>
                                             </button>
                                         );
                                     })}
                                 </div>
                             </div>
                         </div>

                         {/* Editor Form */}
                         <div className="lg:col-span-2 bg-slate-900 border border-white/10 flex flex-col h-full overflow-y-auto custom-scrollbar">
                             {activeSlot !== null ? (
                                 <div className="p-6 space-y-6">
                                     <div className="flex justify-between items-center border-b border-white/10 pb-4">
                                         <h3 className="font-bold text-white text-lg">Edit Soal No. {activeSlot}</h3>
                                         <div className="flex items-center gap-2">
                                             <select 
                                                className="bg-black/50 border border-slate-700 text-white text-xs p-2 outline-none"
                                                value={manualType}
                                                onChange={(e) => {
                                                    const newType = e.target.value as QuestionType;
                                                    setManualType(newType);
                                                    handleTypeChange(activeSlot!, newType);
                                                }}
                                             >
                                                 <option value={QuestionType.SINGLE}>Pilihan Ganda</option>
                                                 <option value={QuestionType.COMPLEX}>Pilihan Ganda Kompleks</option>
                                                 <option value={QuestionType.MATCHING}>Menjodohkan (Tabel)</option>
                                             </select>
                                             <button onClick={() => setActiveSlot(null)} className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded ml-2" title="Tutup Editor"><X size={16}/></button>
                                         </div>
                                     </div>

                                     {/* Stimulus / Image / Text Toggle */}
                                     <div>
                                         <div className="flex gap-2 mb-2">
                                             <button onClick={() => setMediaType('text')} className={`px-3 py-1 text-xs font-bold uppercase ${mediaType === 'text' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>Teks Stimulus</button>
                                             <button onClick={() => setMediaType('image')} className={`px-3 py-1 text-xs font-bold uppercase ${mediaType === 'image' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>Gambar</button>
                                         </div>
                                         {mediaType === 'text' && (
                                             <textarea 
                                                className="w-full bg-black/50 border border-slate-700 p-3 text-white text-sm h-24 focus:border-blue-500 outline-none"
                                                placeholder="Masukkan narasi / stimulus soal..."
                                                value={newStimulus}
                                                onChange={e => setNewStimulus(e.target.value)}
                                             />
                                         )}
                                         {mediaType === 'image' && (
                                             <div className="border-2 border-dashed border-slate-700 p-4 text-center">
                                                 {newQuestionImage ? (
                                                     <div className="relative inline-block">
                                                         <img src={newQuestionImage} className="max-h-48 rounded" alt="Preview"/>
                                                         <button onClick={handleRemoveImage} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1"><X size={12}/></button>
                                                     </div>
                                                 ) : (
                                                     <>
                                                         <input type="file" ref={imageInputRef} onChange={handleImageUpload} className="hidden" accept="image/*"/>
                                                         <button onClick={() => imageInputRef.current?.click()} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold uppercase rounded">Upload Gambar</button>
                                                     </>
                                                 )}
                                             </div>
                                         )}
                                     </div>

                                     {/* Question Text */}
                                     <div>
                                         <label className="text-xs font-bold text-blue-400 uppercase tracking-widest block mb-2">Pertanyaan</label>
                                         <textarea 
                                            className="w-full bg-black/50 border border-slate-700 p-3 text-white text-sm h-20 focus:border-blue-500 outline-none font-medium"
                                            placeholder="Tulis pertanyaan..."
                                            value={newQuestionText}
                                            onChange={e => setNewQuestionText(e.target.value)}
                                         />
                                     </div>

                                     {/* Options Logic based on Type */}
                                     <div className="bg-black/20 p-4 border border-white/5 rounded">
                                         <label className="text-xs font-bold text-yellow-500 uppercase tracking-widest block mb-4">Jawaban & Kunci</label>
                                         
                                         {/* SINGLE CHOICE */}
                                         {manualType === QuestionType.SINGLE && (
                                             <div className="space-y-3">
                                                 {newOptions.map((opt, idx) => (
                                                     <div key={idx} className="flex gap-2 items-center">
                                                         <button 
                                                            onClick={() => setSingleCorrectIndex(idx)}
                                                            className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs ${singleCorrectIndex === idx ? 'bg-green-600 border-green-500 text-white' : 'border-slate-600 text-slate-500 hover:border-slate-400'}`}
                                                         >
                                                             {String.fromCharCode(65 + idx)}
                                                         </button>
                                                         <input 
                                                            type="text" 
                                                            className="flex-1 bg-black/50 border border-slate-700 p-2 text-white text-sm focus:border-blue-500 outline-none"
                                                            placeholder={`Opsi ${String.fromCharCode(65 + idx)}`}
                                                            value={opt}
                                                            onChange={e => {
                                                                const copy = [...newOptions];
                                                                copy[idx] = e.target.value;
                                                                setNewOptions(copy);
                                                            }}
                                                         />
                                                         {newOptions.length > 2 && (
                                                             <button onClick={() => handleRemoveOption(idx)} className="text-slate-600 hover:text-red-500"><X size={16}/></button>
                                                         )}
                                                     </div>
                                                 ))}
                                                 <button onClick={handleAddOption} className="text-xs text-blue-400 hover:text-white font-bold uppercase flex items-center gap-1 mt-2"><Plus size={12}/> Tambah Opsi</button>
                                             </div>
                                         )}

                                         {/* COMPLEX CHOICE */}
                                         {manualType === QuestionType.COMPLEX && (
                                             <div className="space-y-3">
                                                 {newOptions.map((opt, idx) => {
                                                     const isSelected = complexCorrectIndices.includes(idx);
                                                     return (
                                                         <div key={idx} className="flex gap-2 items-center">
                                                             <button 
                                                                onClick={() => {
                                                                    if (isSelected) setComplexCorrectIndices(complexCorrectIndices.filter(i => i !== idx));
                                                                    else setComplexCorrectIndices([...complexCorrectIndices, idx]);
                                                                }}
                                                                className={`w-8 h-8 border flex items-center justify-center font-bold text-xs rounded ${isSelected ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 text-slate-500 hover:border-slate-400'}`}
                                                             >
                                                                 {isSelected ? <Check size={14}/> : ''}
                                                             </button>
                                                             <input 
                                                                type="text" 
                                                                className="flex-1 bg-black/50 border border-slate-700 p-2 text-white text-sm focus:border-blue-500 outline-none"
                                                                placeholder={`Pernyataan ${idx + 1}`}
                                                                value={opt}
                                                                onChange={e => {
                                                                    const copy = [...newOptions];
                                                                    copy[idx] = e.target.value;
                                                                    setNewOptions(copy);
                                                                }}
                                                             />
                                                             <button onClick={() => handleRemoveOption(idx)} className="text-slate-600 hover:text-red-500"><X size={16}/></button>
                                                         </div>
                                                     );
                                                 })}
                                                 <button onClick={handleAddOption} className="text-xs text-blue-400 hover:text-white font-bold uppercase flex items-center gap-1 mt-2"><Plus size={12}/> Tambah Opsi</button>
                                             </div>
                                         )}

                                         {/* MATCHING */}
                                         {manualType === QuestionType.MATCHING && (
                                             <div className="space-y-4">
                                                 <div className="grid grid-cols-2 gap-4 mb-2">
                                                     <input 
                                                        type="text" 
                                                        className="bg-slate-800 border border-slate-600 p-2 text-center text-white text-xs font-bold uppercase"
                                                        value={newOptions[0]} // Header Kiri (ex: Benar)
                                                        onChange={e => setNewOptions([e.target.value, newOptions[1]])}
                                                        placeholder="Label Kiri (ex: Benar)"
                                                     />
                                                     <input 
                                                        type="text" 
                                                        className="bg-slate-800 border border-slate-600 p-2 text-center text-white text-xs font-bold uppercase"
                                                        value={newOptions[1]} // Header Kanan (ex: Salah)
                                                        onChange={e => setNewOptions([newOptions[0], e.target.value])}
                                                        placeholder="Label Kanan (ex: Salah)"
                                                     />
                                                 </div>
                                                 {matchingPairs.map((pair, idx) => (
                                                     <div key={idx} className="flex gap-2 items-center">
                                                         <span className="text-slate-500 font-mono text-xs w-4">{idx+1}.</span>
                                                         <input 
                                                            type="text" 
                                                            className="flex-1 bg-black/50 border border-slate-700 p-2 text-white text-sm focus:border-blue-500 outline-none"
                                                            placeholder="Pernyataan"
                                                            value={pair.left}
                                                            onChange={e => {
                                                                const copy = [...matchingPairs];
                                                                copy[idx].left = e.target.value;
                                                                setMatchingPairs(copy);
                                                            }}
                                                         />
                                                         <select 
                                                            className="w-32 bg-black/50 border border-slate-700 p-2 text-white text-sm outline-none"
                                                            value={pair.right}
                                                            onChange={e => {
                                                                const copy = [...matchingPairs];
                                                                copy[idx].right = e.target.value;
                                                                setMatchingPairs(copy);
                                                            }}
                                                         >
                                                             <option value="">- Kunci -</option>
                                                             <option value={newOptions[0]}>{newOptions[0]}</option>
                                                             <option value={newOptions[1]}>{newOptions[1]}</option>
                                                         </select>
                                                         <button onClick={() => handleRemovePair(idx)} className="text-slate-600 hover:text-red-500"><X size={16}/></button>
                                                     </div>
                                                 ))}
                                                 <button onClick={handleAddPair} className="text-xs text-blue-400 hover:text-white font-bold uppercase flex items-center gap-1 mt-2"><Plus size={12}/> Tambah Baris</button>
                                             </div>
                                         )}
                                     </div>

                                     <div className="pt-4 flex justify-end">
                                         <button onClick={handleSaveQuestionSlot} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-xs shadow-lg flex items-center gap-2">
                                             <Save size={16}/> Simpan Soal
                                         </button>
                                     </div>
                                 </div>
                             ) : (
                                <div className="p-6 space-y-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-white text-lg">Preview Soal Paket: {selectedPacket?.name}</h3>
                                        <div className="text-xs text-slate-400 font-mono bg-black/40 px-2 py-1 rounded border border-slate-700">Total: <span className="text-white font-bold">{questions.filter(q => q.packetId === selectedPacketId).length}</span> / {selectedPacket?.totalQuestions}</div>
                                    </div>
                                    
                                    {questions.filter(q => q.packetId === selectedPacketId).sort((a,b) => (a.number || 0) - (b.number || 0)).map(q => (
                                        <div key={q.id} className="bg-black/40 border border-slate-700 p-4 rounded hover:border-slate-500 transition-all group relative">
                                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => prepareSlotForm(q.number || 0)} className="p-2 bg-blue-600 text-white rounded hover:bg-blue-500 shadow-lg"><Edit2 size={16}/></button>
                                            </div>
                                            <div className="flex gap-3">
                                                <span className="flex-none w-8 h-8 bg-slate-800 text-yellow-500 font-black flex items-center justify-center rounded border border-slate-700">{q.number}</span>
                                                <div className="flex-1">
                                                    {q.image && <img src={q.image} className="max-h-32 rounded mb-2 border border-slate-700" alt="Soal"/>}
                                                    <p className="text-white font-medium mb-2 whitespace-pre-wrap text-sm leading-relaxed">{q.text}</p>
                                                    
                                                    {/* Render Options Preview based on Type */}
                                                    <div className="text-xs text-slate-400 space-y-1">
                                                        {q.type === QuestionType.SINGLE && q.options?.map((opt, i) => (
                                                            <div key={i} className={`flex items-center gap-2 ${i === q.correctAnswerIndex ? 'text-green-400 font-bold' : ''}`}>
                                                                <span className={`w-4 h-4 border flex items-center justify-center rounded-full text-[10px] ${i === q.correctAnswerIndex ? 'border-green-500 bg-green-900/20' : 'border-slate-600'}`}>{String.fromCharCode(65+i)}</span>
                                                                <span>{opt}</span>
                                                                {i === q.correctAnswerIndex && <Check size={12}/>}
                                                            </div>
                                                        ))}
                                                        {q.type === QuestionType.COMPLEX && q.options?.map((opt, i) => (
                                                            <div key={i} className={`flex items-center gap-2 ${(q.correctAnswerIndices || []).includes(i) ? 'text-blue-400 font-bold' : ''}`}>
                                                                <span className={`w-4 h-4 border flex items-center justify-center rounded-sm text-[10px] ${(q.correctAnswerIndices || []).includes(i) ? 'border-blue-500 bg-blue-900/20' : 'border-slate-600'}`}>{(q.correctAnswerIndices || []).includes(i) ? <Check size={10}/> : ''}</span>
                                                                <span>{opt}</span>
                                                            </div>
                                                        ))}
                                                        {q.type === QuestionType.MATCHING && (
                                                            <div className="grid grid-cols-1 gap-1 mt-2">
                                                                {q.matchingPairs?.map((pair, idx) => (
                                                                    <div key={idx} className="flex items-center gap-2 text-[10px]">
                                                                        <span className="text-slate-500">{pair.left}</span>
                                                                        <ArrowRight size={10} className="text-slate-600"/>
                                                                        <span className="text-yellow-500 font-bold">{pair.right}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {questions.filter(q => q.packetId === selectedPacketId).length === 0 && (
                                         <div className="text-center text-slate-500 py-10 border-2 border-dashed border-slate-800 bg-black/20 rounded">
                                             <p className="text-sm font-bold uppercase tracking-widest mb-2">Paket Masih Kosong</p>
                                             <p className="text-xs">Klik nomor pada navigator di sebelah kiri untuk mulai membuat soal.</p>
                                         </div>
                                    )}
                                </div>
                             )}
                         </div>
                     </div>
                 ) : (
                     <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-10 border border-dashed border-slate-800 bg-black/20">
                         <BookOpen size={48} className="mb-4 opacity-20"/>
                         <p className="text-sm font-bold uppercase tracking-widest">Pilih paket soal terlebih dahulu.</p>
                     </div>
                 )}
             </div>
        )}
      </div>
    );
  }

  // Fallback for other tabs
  return <div className="p-8 text-center text-slate-500">Fitur sedang dalam pengembangan.</div>;
};