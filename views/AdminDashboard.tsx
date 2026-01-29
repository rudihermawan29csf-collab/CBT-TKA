import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Student, Teacher, Question, QuestionType, QuestionCategory, QuestionPacket, Exam, Role } from '../types';
import { Upload, Download, Trash2, Search, Brain, Save, Settings, Plus, X, List, Layout, FileSpreadsheet, Check, Eye, ChevronLeft, ChevronRight, HelpCircle, Edit2, ImageIcon, Users, UserPlus, BarChart2, TrendingUp, AlertTriangle, Table, PieChart, Layers, FileText, ArrowRight, CalendarClock, PlayCircle, StopCircle, Clock, Activity, RefreshCw, BookOpen, GraduationCap } from 'lucide-react';
import { generateQuestionWithAI } from '../services/geminiService';
import { CLASS_LIST, MOCK_EXAMS } from '../constants';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth'; // Browser-compatible import via importmap

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
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  userRole = Role.ADMIN, students, setStudents, teachers, setTeachers, questions, setQuestions, exams = [], setExams, activeTab,
  packets, setPackets
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const studentFileRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // --- Student Management State ---
  const [studentSubTab, setStudentSubTab] = useState<'list' | 'input'>('list');
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

  // ... (Monitoring Logic remains same) ...
  const generateLiveMonitoringData = (examId: string) => {
    // ... (same as before) ...
    const exam = exams.find(e => e.id === examId);
    if (!exam) return [];
    const targetStudents = students.filter(s => exam.classTarget.includes(s.class));
    return targetStudents.map(student => {
        const rand = Math.random();
        let status: 'OFFLINE' | 'WORKING' | 'DONE' = 'OFFLINE';
        if (rand > 0.2) status = 'WORKING';
        if (rand > 0.8) status = 'DONE';
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
        return { student, status, answers, score: (correctCount / exam.questions.length) * 100 };
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
  };
  const handleDeleteStudent = (id: string) => { if(confirm('Yakin hapus data siswa ini?')) setStudents(students.filter(s => s.id !== id)); };
  
  // Reuse existing student excel functions for simplicity as requested change focused on Question Bank
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
      reader.onloadend = () => setNewQuestionImage(reader.result as string);
      reader.readAsDataURL(file);
    }
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
          stimulus: newStimulus,
          text: newQuestionText,
          image: newQuestionImage,
          type: manualType,
      };

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

  // --- WORD TEMPLATE EXPORT (F4 LANDSCAPE) ---
  const handleDownloadWordTemplate = () => {
    if (!selectedPacket) return;

    // Construct HTML Table
    let tableRows = '';
    
    // Add instruction rows based on Packet Configuration
    for (let i = 1; i <= selectedPacket.totalQuestions; i++) {
        const type = selectedPacket.questionTypes[i] || QuestionType.SINGLE;
        tableRows += `
        <tr>
            <td>${i}</td>
            <td>${type}</td>
            <td>Tulis stimulus/narasi disini (jika ada)...</td>
            <td>Tulis pertanyaan soal no ${i} disini...</td>
            <td>Opsi A / Kiri 1</td>
            <td>Opsi B / Kanan 1</td>
            <td>Opsi C / Kiri 2</td>
            <td>Opsi D / Kanan 2</td>
            <td>Kunci</td>
        </tr>`;
    }

    const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
        <meta charset="utf-8">
        <style>
            @page {
                size: 33.02cm 21.59cm; /* F4 Landscape */
                mso-page-orientation: landscape;
                margin: 1cm;
            }
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 5px; vertical-align: top; }
            th { background-color: #f0f0f0; }
        </style>
    </head>
    <body>
        <h2>Template Soal: ${selectedPacket.name}</h2>
        <p><i>Jangan ubah kolom No dan Tipe Soal. Isi kolom lainnya sesuai kebutuhan.</i></p>
        <table>
            <thead>
                <tr>
                    <th style="width: 5%">No</th>
                    <th style="width: 15%">Tipe Soal</th>
                    <th style="width: 20%">Stimulus</th>
                    <th style="width: 20%">Pertanyaan</th>
                    <th style="width: 8%">Opsi A</th>
                    <th style="width: 8%">Opsi B</th>
                    <th style="width: 8%">Opsi C</th>
                    <th style="width: 8%">Opsi D</th>
                    <th style="width: 8%">Kunci</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    </body>
    </html>`;

    const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/msword'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Template_Soal_${selectedPacket.name.replace(/\s+/g, '_')}.doc`; // .doc opens in Word as HTML
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- WORD IMPORT (MAMMOTH) ---
  const handleImportWord = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !selectedPacketId) return;

      try {
          const arrayBuffer = await file.arrayBuffer();
          // @ts-ignore
          const result = await window.mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
          const html = result.value;

          // Parse HTML Table
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const rows = Array.from(doc.querySelectorAll('table tr'));

          const imported: Question[] = [];
          
          // Skip Header (row 0)
          for (let i = 1; i < rows.length; i++) {
              const cells = Array.from(rows[i].querySelectorAll('td')).map(td => td.innerText.trim());
              if (cells.length < 9) continue;

              const num = parseInt(cells[0]);
              if (isNaN(num)) continue;

              const typeRaw = cells[1];
              const stim = cells[2];
              const text = cells[3];
              const colA = cells[4];
              const colB = cells[5];
              const colC = cells[6];
              const colD = cells[7];
              const key = cells[8];

              // Determine Type
              let type = QuestionType.SINGLE;
              if (typeRaw.includes("Kompleks")) type = QuestionType.COMPLEX;
              else if (typeRaw.includes("Tabel") || typeRaw.includes("Benar")) type = QuestionType.MATCHING;

              const q: Question = {
                  id: `imp-${Date.now()}-${i}`,
                  packetId: selectedPacketId,
                  number: num,
                  stimulus: stim,
                  text: text,
                  type: type,
                  options: [],
                  matchingPairs: []
              };

              if (type === QuestionType.SINGLE) {
                  q.options = [colA, colB, colC, colD];
                  let k = 0;
                  if (key.toUpperCase().includes('B')) k = 1;
                  else if (key.toUpperCase().includes('C')) k = 2;
                  else if (key.toUpperCase().includes('D')) k = 3;
                  q.correctAnswerIndex = k;
              } else if (type === QuestionType.COMPLEX) {
                  q.options = [colA, colB, colC, colD];
                  const indices: number[] = [];
                  if (key.includes('1') || key.includes('A')) indices.push(0);
                  if (key.includes('2') || key.includes('B')) indices.push(1);
                  if (key.includes('3') || key.includes('C')) indices.push(2);
                  if (key.includes('4') || key.includes('D')) indices.push(3);
                  q.correctAnswerIndices = indices;
              } else if (type === QuestionType.MATCHING) {
                  q.options = ['Benar', 'Salah']; // Default headers
                  q.matchingPairs = [];
                  if(colA && colB) q.matchingPairs.push({left: colA, right: colB});
                  if(colC && colD) q.matchingPairs.push({left: colC, right: colD});
              }

              imported.push(q);
          }

          // Merge imported questions: Replace existing ones with same number, or add new
          setQuestions(prev => {
              const otherQuestions = prev.filter(q => q.packetId !== selectedPacketId);
              const existingPacketQuestions = prev.filter(q => q.packetId === selectedPacketId);
              
              // Remove existing with same numbers as imported
              const keptQuestions = existingPacketQuestions.filter(epq => !imported.some(imp => imp.number === epq.number));
              
              return [...otherQuestions, ...keptQuestions, ...imported];
          });

          alert(`Berhasil mengimpor ${imported.length} soal dari Word.`);

      } catch (err) {
          console.error(err);
          alert("Gagal membaca file Word. Pastikan format tabel sesuai template.");
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  // --- 1. MONITORING UJIAN TAB ---
  if (activeTab === 'monitor') {
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
                         <div className="grid grid-cols-4 bg-black/50 p-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-white/10">
                             <div>Nama Siswa</div>
                             <div className="text-center">Status</div>
                             <div className="text-center">Progress</div>
                             <div className="text-right">Estimasi Skor</div>
                         </div>
                         <div className="overflow-y-auto h-[400px] custom-scrollbar">
                             {monitoringData.map((d, i) => (
                                 <div key={i} className="grid grid-cols-4 p-3 border-b border-white/5 items-center hover:bg-white/5 transition text-sm">
                                     <div className="font-bold text-white">{d.student.name}</div>
                                     <div className="text-center">
                                         <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                             d.status === 'DONE' ? 'bg-green-900 text-green-400' :
                                             d.status === 'WORKING' ? 'bg-blue-900 text-blue-400 animate-pulse' :
                                             'bg-slate-800 text-slate-500'
                                         }`}>
                                             {d.status}
                                         </span>
                                     </div>
                                     <div className="px-4">
                                         <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                             <div 
                                                className="bg-yellow-500 h-full transition-all duration-500" 
                                                style={{ width: `${(d.answers.filter((a: any) => a !== null).length / d.answers.length) * 100}%` }}
                                             ></div>
                                         </div>
                                     </div>
                                     <div className="text-right font-mono text-yellow-500">
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
                       <div className="h-full overflow-y-auto p-6 custom-scrollbar">
                           <h3 className="font-bold text-white uppercase tracking-wider mb-4 border-b border-white/10 pb-2">Statistik Butir Soal</h3>
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
                   )}

                   {/* View: RECAP */}
                   {analysisSubTab === 'recap' && (
                       <div className="h-full flex flex-col">
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

  // --- 4. DATA SISWA TAB ---
  if (activeTab === 'students') {
      const filteredStudents = students.filter(s => 
          (s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.nis.includes(searchTerm)) &&
          (studentSubTab === 'list' ? true : true)
      );

      return (
          <div className="p-8 h-full flex flex-col">
               <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-wider mb-6">
                   <GraduationCap className="text-yellow-500"/> Data Siswa
               </h2>

               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full overflow-hidden">
                   {/* Form Input */}
                   <div className="lg:col-span-1 bg-slate-900/80 p-6 border border-white/10 h-fit">
                       <h3 className="font-bold text-white uppercase tracking-wider mb-6 border-b border-white/10 pb-2 flex items-center gap-2">
                           <UserPlus size={18}/> Tambah Siswa
                       </h3>
                       <div className="space-y-4">
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
                           <div className="grid grid-cols-2 gap-2">
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
                           <button 
                             onClick={handleAddStudent}
                             className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest mt-4 text-xs shadow-lg"
                           >
                               Simpan Data
                           </button>

                           <div className="mt-8 pt-4 border-t border-white/10">
                               <p className="text-[10px] text-slate-500 mb-2 uppercase font-bold text-center">Import Data Excel</p>
                               <div className="flex gap-2">
                                   <button onClick={handleDownloadStudentTemplate} className="flex-1 py-2 border border-slate-600 text-slate-400 hover:text-white text-[10px] font-bold uppercase">Template</button>
                                   <div className="flex-1 relative">
                                       <input type="file" ref={studentFileRef} onChange={handleImportStudentExcel} className="absolute inset-0 opacity-0 cursor-pointer" accept=".xlsx"/>
                                       <button className="w-full h-full bg-green-900/30 border border-green-800 text-green-500 text-[10px] font-bold uppercase flex items-center justify-center gap-1"><Upload size={10}/> Upload</button>
                                   </div>
                               </div>
                           </div>
                       </div>
                   </div>

                   {/* List Students */}
                   <div className="lg:col-span-2 bg-slate-900 border border-white/10 flex flex-col h-full overflow-hidden">
                       <div className="p-4 border-b border-white/10 bg-black/20 flex justify-between items-center">
                           <div className="relative">
                               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14}/>
                               <input 
                                 type="text" 
                                 className="bg-black/50 border border-slate-700 rounded-full py-1.5 pl-9 pr-4 text-xs text-white focus:border-blue-500 outline-none w-[200px]"
                                 placeholder="Cari nama / NIS..."
                                 value={searchTerm}
                                 onChange={e => setSearchTerm(e.target.value)}
                               />
                           </div>
                           <div className="text-xs text-slate-500 font-mono">
                               TOTAL: <span className="text-white font-bold">{students.length}</span>
                           </div>
                       </div>
                       <div className="flex-1 overflow-auto custom-scrollbar">
                           <table className="w-full text-left border-collapse">
                               <thead className="bg-slate-950 text-xs text-slate-400 uppercase font-bold sticky top-0">
                                   <tr>
                                       <th className="p-3 border-b border-slate-800 w-12 text-center">No</th>
                                       <th className="p-3 border-b border-slate-800">Nama Lengkap</th>
                                       <th className="p-3 border-b border-slate-800">Kelas</th>
                                       <th className="p-3 border-b border-slate-800">NIS / NISN</th>
                                       <th className="p-3 border-b border-slate-800 text-center w-16">Aksi</th>
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
                                               <button onClick={() => handleDeleteStudent(s.id)} className="text-slate-600 hover:text-red-500 transition-colors">
                                                   <Trash2 size={16}/>
                                               </button>
                                           </td>
                                       </tr>
                                   ))}
                               </tbody>
                           </table>
                       </div>
                   </div>
               </div>
          </div>
      );
  }

  // --- BANK SOAL VIEW (MODIFIED) ---
  if (activeTab === 'questions') {
    return (
      <div className="p-8 flex flex-col min-h-full">
        {/* ... Header Bank Soal ... */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-3">
             <BookOpen className="text-yellow-500" /> Bank Soal
          </h2>
          <div className="flex bg-black/50 p-1 border border-white/10">
            <button 
              onClick={() => setBankSubTab('config')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${bankSubTab === 'config' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}
            >
              <span className="flex items-center gap-2"><Layout size={14}/> Konfigurasi Paket</span>
            </button>
            <button 
              onClick={() => setBankSubTab('input')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${bankSubTab === 'input' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}
            >
              <span className="flex items-center gap-2"><List size={14}/> Input & Daftar Soal</span>
            </button>
          </div>
        </div>

        {/* SUBTAB: CONFIGURATION */}
        {bankSubTab === 'config' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             <div className="md:col-span-1 bg-slate-900/80 p-6 border border-white/10 h-fit">
                <h3 className="text-white font-bold mb-6 flex items-center justify-between uppercase tracking-wider border-b border-white/10 pb-2">
                  <span className="flex items-center gap-2">
                     <Settings size={18} className="text-slate-500" />
                     {editingPacketId ? 'Edit Paket' : 'Buat Paket Baru'}
                  </span>
                  {editingPacketId && (
                     <button onClick={resetPacketForm} className="text-[10px] bg-red-900/50 text-red-400 px-2 py-1 hover:bg-red-900">
                       Batal
                     </button>
                  )}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1 tracking-widest">Nama Paket</label>
                    <input 
                      type="text" 
                      className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm focus:border-blue-500 outline-none"
                      placeholder="CONTOH: LITERASI B.INDO KELAS 9"
                      value={newPacketName}
                      onChange={e => setNewPacketName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1 tracking-widest">Kategori</label>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setNewPacketCategory(QuestionCategory.LITERASI)}
                        disabled={userRole !== Role.ADMIN && userRole !== Role.TEACHER_LITERASI}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition border ${newPacketCategory === QuestionCategory.LITERASI ? 'bg-purple-600 text-white border-purple-500' : 'bg-transparent text-slate-500 border-slate-700 hover:text-white'} disabled:opacity-30 disabled:cursor-not-allowed`}
                      >
                        Literasi
                      </button>
                      <button 
                        onClick={() => setNewPacketCategory(QuestionCategory.NUMERASI)}
                         disabled={userRole !== Role.ADMIN && userRole !== Role.TEACHER_NUMERASI}
                         className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition border ${newPacketCategory === QuestionCategory.NUMERASI ? 'bg-orange-600 text-white border-orange-500' : 'bg-transparent text-slate-500 border-slate-700 hover:text-white'} disabled:opacity-30 disabled:cursor-not-allowed`}
                      >
                        Numerasi
                      </button>
                    </div>
                  </div>

                  <div>
                     <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1 tracking-widest">Total Soal</label>
                     <input 
                      type="number" min="1"
                      className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm focus:border-blue-500 outline-none"
                      value={newPacketTotal}
                      onChange={e => setNewPacketTotal(e.target.value === '' ? '' : parseInt(e.target.value))}
                      placeholder="Contoh: 40"
                     />
                     <p className="text-[10px] text-slate-500 mt-1 italic">Tentukan jumlah soal terlebih dahulu.</p>
                  </div>
                   
                   <div className="pt-2">
                     <button 
                      onClick={handleSavePacket}
                      className="w-full bg-green-600 hover:bg-green-500 text-white py-3 text-xs font-black uppercase tracking-widest transition flex items-center justify-center gap-2 shadow-lg shadow-green-900/30"
                     >
                       <Save size={14} /> {editingPacketId ? 'Simpan Perubahan' : 'Simpan Paket Baru'}
                     </button>
                   </div>
                </div>
             </div>

             <div className="md:col-span-2 bg-slate-900/80 p-6 border border-white/10">
               <h3 className="font-bold text-white mb-6 uppercase tracking-wider">Daftar Paket Soal Tersedia</h3>
               {visiblePackets.length === 0 ? (
                 <p className="text-slate-600 italic text-center py-10 border-2 border-dashed border-slate-800">
                    {userRole === Role.ADMIN ? "Belum ada paket soal dibuat." : "Belum ada paket soal untuk kategori ini."}
                 </p>
               ) : (
                 <div className="grid grid-cols-1 gap-4">
                   {visiblePackets.map(pkt => (
                       <div key={pkt.id} className={`border p-4 transition flex justify-between items-center group relative overflow-hidden ${editingPacketId === pkt.id ? 'border-blue-500 bg-blue-900/20' : 'border-white/10 bg-black/40 hover:border-blue-500/50'}`}>
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${pkt.category === QuestionCategory.LITERASI ? 'bg-purple-600' : 'bg-orange-600'}`}></div>
                          <div className="pl-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${pkt.category === QuestionCategory.LITERASI ? 'text-purple-400 bg-purple-900/30' : 'text-orange-400 bg-orange-900/30'}`}>
                                {pkt.category}
                              </span>
                              <h4 className="font-bold text-white uppercase">{pkt.name}</h4>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                               TOTAL SOAL: <span className="text-white font-bold">{pkt.totalQuestions}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                             <button onClick={() => handleEditPacket(pkt)} className="text-blue-500 hover:text-blue-400 p-2 border border-slate-800 hover:border-blue-500 transition-colors">
                               <Edit2 size={16} />
                             </button>
                             <button onClick={() => deletePacket(pkt.id)} className="text-slate-600 hover:text-red-500 p-2 border border-slate-800 hover:border-red-500 transition-colors">
                               <Trash2 size={16} />
                             </button>
                          </div>
                       </div>
                   ))}
                 </div>
               )}
             </div>
          </div>
        )}

        {/* SUBTAB: INPUT & LIST (SLOT BASED) */}
        {bankSubTab === 'input' && (
          <div className="flex flex-col gap-6">
            <div className="bg-slate-900/80 p-4 border border-white/10 flex flex-wrap items-center justify-between gap-4">
               {/* Header Input Tools */}
               <div className="flex items-center gap-4 flex-1">
                 <label className="text-xs font-bold text-blue-400 uppercase tracking-widest">Pilih Paket</label>
                 <select 
                  className="bg-black border border-slate-700 text-white text-sm py-2 px-4 rounded outline-none focus:border-blue-500 min-w-[300px]"
                  value={selectedPacketId}
                  onChange={(e) => { setSelectedPacketId(e.target.value); setActiveSlot(null); setEditingQuestionId(null); }}
                 >
                   <option value="">-- PILIH PAKET --</option>
                   {visiblePackets.map(p => (
                     <option key={p.id} value={p.id}>{p.name} ({p.totalQuestions} Soal)</option>
                   ))}
                 </select>
               </div>
               
               {selectedPacket && (
                 <div className="flex items-center gap-3">
                    <button 
                      onClick={handleDownloadWordTemplate}
                      className="px-4 py-2 border border-blue-600 text-blue-500 hover:bg-blue-900/20 transition flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                    >
                      <FileText size={14} /> Template Word (F4)
                    </button>
                    <div className="relative">
                      <input 
                        type="file" 
                        accept=".docx, .doc"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        ref={fileInputRef}
                        onChange={handleImportWord}
                      />
                      <button className="px-4 py-2 bg-blue-700 text-white hover:bg-blue-600 transition flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                        <Upload size={14} /> Import Word
                      </button>
                    </div>
                 </div>
               )}
            </div>

            {selectedPacket ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 {/* LEFT: SLOT LIST */}
                 <div className="bg-slate-900/80 border border-white/10 flex flex-col h-[600px]">
                     <div className="p-4 border-b border-white/10 bg-black/20">
                         <h3 className="font-bold text-white uppercase tracking-wider text-sm">Daftar Slot Soal</h3>
                         <p className="text-xs text-slate-500 mt-1">Pilih tipe soal untuk setiap nomor, lalu klik tombol Simpan.</p>
                     </div>
                     <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                         {Array.from({ length: selectedPacket.totalQuestions }).map((_, idx) => {
                             const num = idx + 1;
                             const type = selectedPacket.questionTypes[num] || QuestionType.SINGLE;
                             const hasContent = questions.some(q => q.packetId === selectedPacketId && q.number === num);
                             const isActive = activeSlot === num;

                             return (
                                 <div key={num} className={`flex items-center gap-2 p-2 border transition-colors ${isActive ? 'bg-yellow-900/20 border-yellow-500' : 'bg-black/40 border-slate-800'}`}>
                                     <div className={`w-8 h-8 flex items-center justify-center font-bold text-sm ${hasContent ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                         {num}
                                     </div>
                                     <div className="flex-1 flex gap-2">
                                         <select 
                                            className="w-full bg-transparent text-xs text-white outline-none border-b border-slate-700 pb-1"
                                            value={type}
                                            onChange={(e) => handleTypeChange(num, e.target.value as QuestionType)}
                                         >
                                             <option value={QuestionType.SINGLE}>Pilihan Ganda</option>
                                             <option value={QuestionType.COMPLEX}>Pilihan Ganda Kompleks</option>
                                             <option value={QuestionType.MATCHING}>Benar / Salah (Tabel)</option>
                                         </select>
                                         <button 
                                            onClick={() => handleSaveTypeConfig(num)}
                                            className="text-blue-500 hover:text-white p-1"
                                            title="Simpan Tipe Soal"
                                         >
                                            <Save size={14} />
                                         </button>
                                     </div>
                                     <button 
                                        onClick={() => prepareSlotForm(num)}
                                        className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider border ${isActive ? 'bg-yellow-600 text-black border-yellow-600' : 'text-blue-400 border-blue-900 hover:bg-blue-900/30'}`}
                                     >
                                         {isActive ? 'Editing' : (hasContent ? 'Edit' : 'Isi')}
                                     </button>
                                 </div>
                             );
                         })}
                     </div>
                 </div>

                 {/* RIGHT: EDITOR FORM */}
                 <div className="bg-slate-900/80 border border-white/10 p-6 h-fit sticky top-0">
                     {activeSlot !== null ? (
                         <div className="space-y-4">
                            <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-4">
                                <h3 className="font-bold text-white uppercase tracking-wider">Editor Soal No. {activeSlot}</h3>
                                <span className="text-xs text-yellow-500 font-bold border border-yellow-500 px-2 py-0.5">{manualType}</span>
                            </div>

                            <div>
                               <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1 tracking-widest">Stimulus / Wacana (Opsional)</label>
                               <textarea
                                 className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm focus:border-blue-500 outline-none"
                                 rows={4}
                                 value={newStimulus}
                                 onChange={e => setNewStimulus(e.target.value)}
                                 placeholder="Tulis bacaan..."
                               />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-blue-400 uppercase mb-1 tracking-widest">Pertanyaan Inti</label>
                              <textarea 
                                className="w-full bg-black/50 border border-slate-700 p-2 text-white text-sm focus:border-blue-500 outline-none font-medium"
                                rows={3}
                                value={newQuestionText}
                                onChange={e => setNewQuestionText(e.target.value)}
                                placeholder="Tulis pertanyaan..."
                              />
                            </div>

                            {/* Options Logic (Same as before but filtered by current type) */}
                            {manualType === QuestionType.SINGLE && (
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pilihan Jawaban (Pilih Kunci)</p>
                                {newOptions.map((opt, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <input type="radio" name="man-single" checked={singleCorrectIndex === idx} onChange={() => setSingleCorrectIndex(idx)} className="accent-blue-500" />
                                    <input type="text" className="flex-1 bg-black/50 border border-slate-700 p-2 text-white text-sm focus:border-blue-500 outline-none" value={opt} onChange={e => { const n = [...newOptions]; n[idx] = e.target.value; setNewOptions(n); }} placeholder={`Opsi ${idx+1}`} />
                                  </div>
                                ))}
                              </div>
                            )}

                            {manualType === QuestionType.COMPLEX && (
                              <div className="space-y-2">
                                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pilihan Jawaban (Centang Benar)</p>
                                 {newOptions.map((opt, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <input type="checkbox" checked={complexCorrectIndices.includes(idx)} onChange={() => { if(complexCorrectIndices.includes(idx)) setComplexCorrectIndices(complexCorrectIndices.filter(i=>i!==idx)); else setComplexCorrectIndices([...complexCorrectIndices, idx]); }} className="accent-blue-500"/>
                                    <input type="text" className="flex-1 bg-black/50 border border-slate-700 p-2 text-white text-sm focus:border-blue-500 outline-none" value={opt} onChange={e => { const n = [...newOptions]; n[idx] = e.target.value; setNewOptions(n); }} placeholder={`Opsi ${idx+1}`} />
                                    <button onClick={() => handleRemoveOption(idx)} className="text-red-500"><X size={14}/></button>
                                  </div>
                                ))}
                                <button onClick={handleAddOption} className="text-xs text-blue-400 flex items-center gap-1 hover:text-blue-300 uppercase font-bold">+ Tambah Opsi</button>
                              </div>
                            )}

                            {manualType === QuestionType.MATCHING && (
                              <div className="space-y-4 border border-slate-700 p-4 bg-black/20">
                                 <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Label Kiri</label><input type="text" className="w-full bg-black border border-slate-700 p-2 text-white text-sm" value={newOptions[0]} onChange={e => { const n = [...newOptions]; n[0] = e.target.value; setNewOptions(n); }} /></div>
                                    <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Label Kanan</label><input type="text" className="w-full bg-black border border-slate-700 p-2 text-white text-sm" value={newOptions[1]} onChange={e => { const n = [...newOptions]; n[1] = e.target.value; setNewOptions(n); }} /></div>
                                 </div>
                                 <div className="space-y-3">
                                     {matchingPairs.map((pair, idx) => (
                                       <div key={idx} className="flex flex-col gap-2 p-3 bg-black border border-slate-700 relative">
                                         <input type="text" className="w-full bg-slate-900 border border-slate-700 p-2 text-white text-sm" placeholder="Pernyataan" value={pair.left} onChange={e => { const n = [...matchingPairs]; n[idx].left = e.target.value; setMatchingPairs(n); }} />
                                         <div className="flex items-center gap-4 text-xs">
                                             <label className="flex items-center gap-1"><input type="radio" name={`key-${idx}`} checked={pair.right === newOptions[0]} onChange={() => { const n = [...matchingPairs]; n[idx].right = newOptions[0]; setMatchingPairs(n); }} className="accent-green-500"/> <span className="text-green-500">{newOptions[0]}</span></label>
                                             <label className="flex items-center gap-1"><input type="radio" name={`key-${idx}`} checked={pair.right === newOptions[1]} onChange={() => { const n = [...matchingPairs]; n[idx].right = newOptions[1]; setMatchingPairs(n); }} className="accent-red-500"/> <span className="text-red-500">{newOptions[1]}</span></label>
                                         </div>
                                         <button onClick={() => handleRemovePair(idx)} className="absolute top-2 right-2 text-slate-600 hover:text-red-500"><X size={14}/></button>
                                       </div>
                                     ))}
                                     <button onClick={handleAddPair} className="text-xs font-bold text-blue-400 flex items-center gap-1 mt-2 uppercase"><Plus size={14}/> Tambah Pernyataan</button>
                                 </div>
                              </div>
                            )}

                            <button 
                              onClick={handleSaveQuestionSlot}
                              className="w-full py-3 bg-green-600 text-white font-black uppercase tracking-widest hover:bg-green-500 shadow-lg mt-4 text-xs flex items-center justify-center gap-2"
                            >
                                <Save size={16}/> Simpan Soal No. {activeSlot}
                            </button>
                         </div>
                     ) : (
                         <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                             <Edit2 size={48} className="mb-4"/>
                             <p className="uppercase font-bold tracking-widest text-center">Pilih nomor soal di sebelah kiri<br/>untuk mulai mengedit</p>
                         </div>
                     )}
                 </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-800 bg-black/20">
                <Layout size={64} className="mb-4 opacity-20" />
                <p className="uppercase font-bold tracking-widest">Pilih paket soal untuk memulai operasi</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return <div>Loading...</div>; // Fallback
};