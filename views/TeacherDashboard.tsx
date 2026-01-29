import React, { useState, useRef } from 'react';
import { Teacher, Question, Exam, QuestionType } from '../types';
import { Plus, Trash2, Brain, Save, PlayCircle, StopCircle, Download, Upload } from 'lucide-react';
import { CLASS_LIST } from '../constants';
import { generateQuestionWithAI } from '../services/geminiService';
import * as XLSX from 'xlsx';

interface TeacherDashboardProps {
  teacher: Teacher;
  questions: Question[];
  setQuestions: React.Dispatch<React.SetStateAction<Question[]>>;
  exams: Exam[];
  setExams: React.Dispatch<React.SetStateAction<Exam[]>>;
  activeTab: string;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  teacher, questions, setQuestions, exams, setExams, activeTab
}) => {
  // Question Management State
  const [newQuestion, setNewQuestion] = useState<Partial<Question>>({
    text: '',
    options: ['', '', '', ''],
    correctAnswerIndex: 0,
    type: QuestionType.SINGLE
  });
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Exam Management State
  const [newExam, setNewExam] = useState<Partial<Exam>>({
    title: '',
    durationMinutes: 60,
    classTarget: [],
    questions: [],
    isActive: false
  });

  // --- Question Logic ---

  const handleAiGenerate = async () => {
    if (!aiTopic) return;
    setIsAiLoading(true);
    const result = await generateQuestionWithAI(aiTopic, teacher.subject, teacher.teachingClasses[0] || 'VII');
    if (result) {
      setNewQuestion({ ...result, type: QuestionType.SINGLE });
    } else {
      alert("Gagal membuat soal dengan AI. Pastikan API KEY dikonfigurasi.");
    }
    setIsAiLoading(false);
  };

  const handleAddQuestion = () => {
    if (newQuestion.text && newQuestion.options?.every(o => o)) {
      setQuestions([...questions, { ...newQuestion, id: `q-${Date.now()}`, type: QuestionType.SINGLE } as Question]);
      setNewQuestion({ text: '', options: ['', '', '', ''], correctAnswerIndex: 0, type: QuestionType.SINGLE });
      setAiTopic('');
    }
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
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
            text: text,
            options: opts,
            correctAnswerIndex: correctIndex,
            type: QuestionType.SINGLE
          };
        });
      setQuestions([...questions, ...imported]);
    };
    reader.readAsBinaryString(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Exam Logic ---

  const handleCreateExam = () => {
    if (newExam.title && newExam.classTarget && newExam.classTarget.length > 0) {
      setExams([...exams, { ...newExam, id: `exam-${Date.now()}`, questions: questions } as Exam]);
      setNewExam({ title: '', durationMinutes: 60, classTarget: [], questions: [], isActive: false });
      alert("Jadwal Ujian berhasil dibuat!");
    }
  };

  const toggleExamStatus = (id: string) => {
    setExams(exams.map(e => e.id === id ? { ...e, isActive: !e.isActive } : e));
  };

  if (activeTab === 'dashboard') {
    return (
      <div className="p-8">
        <h2 className="text-3xl font-bold mb-2">Selamat Datang, {teacher.name}</h2>
        <p className="text-gray-500 mb-8">NIP: {teacher.nip} | Mapel: {teacher.subject}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-gray-500 text-sm font-medium">Total Soal di Bank</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">{questions.length}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-gray-500 text-sm font-medium">Ujian Aktif</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">{exams.filter(e => e.isActive).length}</p>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'exams') {
    return (
      <div className="p-8 h-full flex flex-col">
        <h2 className="text-2xl font-bold mb-6">Manajemen Jadwal Ujian</h2>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <h3 className="text-lg font-semibold mb-4">Buat Ujian Baru</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input 
              type="text" 
              placeholder="Nama Ujian (misal: UH 1 IPA)" 
              className="border p-2 rounded"
              value={newExam.title}
              onChange={e => setNewExam({...newExam, title: e.target.value})}
            />
            <input 
              type="number" 
              placeholder="Durasi (menit)" 
              className="border p-2 rounded"
              value={newExam.durationMinutes}
              onChange={e => setNewExam({...newExam, durationMinutes: parseInt(e.target.value)})}
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Kelas:</label>
            <div className="flex flex-wrap gap-2">
              {teacher.teachingClasses.map(cls => (
                <button
                  key={cls}
                  onClick={() => {
                    const current = newExam.classTarget || [];
                    const updated = current.includes(cls) ? current.filter(c => c !== cls) : [...current, cls];
                    setNewExam({...newExam, classTarget: updated});
                  }}
                  className={`px-3 py-1 rounded-full text-sm border ${
                    newExam.classTarget?.includes(cls) 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-white text-gray-600 border-gray-300'
                  }`}
                >
                  {cls}
                </button>
              ))}
            </div>
          </div>
          <button 
            onClick={handleCreateExam}
            disabled={questions.length === 0}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            Simpan Jadwal Ujian
          </button>
          {questions.length === 0 && <p className="text-red-500 text-sm mt-2">Bank soal kosong, isi bank soal terlebih dahulu.</p>}
        </div>

        <div className="flex-1 overflow-auto">
          <h3 className="text-lg font-semibold mb-4">Daftar Ujian</h3>
          <div className="space-y-4">
            {exams.map(exam => (
              <div key={exam.id} className="bg-white p-4 rounded-xl border border-gray-200 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-lg">{exam.title}</h4>
                  <p className="text-sm text-gray-500">{exam.classTarget.join(", ")} | {exam.questions.length} Soal | {exam.durationMinutes} Menit</p>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${exam.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {exam.isActive ? 'AKTIF' : 'NON-AKTIF'}
                  </span>
                  <button 
                    onClick={() => toggleExamStatus(exam.id)}
                    className={`p-2 rounded-full text-white ${exam.isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                  >
                    {exam.isActive ? <StopCircle size={20} /> : <PlayCircle size={20} />}
                  </button>
                  <button onClick={() => setExams(exams.filter(e => e.id !== exam.id))} className="text-red-500 p-2">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Question Bank View
  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Bank Soal: {teacher.subject}</h2>
        <div className="flex space-x-2">
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleImportQuestions}
          />
          <button onClick={handleDownloadTemplateQuestion} className="px-3 py-2 border rounded hover:bg-gray-50 flex items-center gap-2">
            <Download size={16} /> Template Excel
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2">
            <Upload size={16} /> Import Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 overflow-hidden">
        {/* Create/Edit Column */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-200 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4 border-b pb-2">Tambah Soal</h3>
          
          {/* AI Generator Section */}
          <div className="bg-purple-50 p-4 rounded-lg mb-6 border border-purple-100">
            <div className="flex items-center space-x-2 mb-2 text-purple-800 font-medium">
              <Brain size={18} />
              <span>AI Question Generator</span>
            </div>
            <textarea 
              className="w-full p-2 text-sm border border-purple-200 rounded mb-2 focus:ring-2 focus:ring-purple-300 outline-none"
              placeholder="Topik soal (misal: Ekosistem Sawah)"
              rows={2}
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
            />
            <button 
              onClick={handleAiGenerate}
              disabled={isAiLoading || !aiTopic}
              className="w-full bg-purple-600 text-white text-sm py-2 rounded hover:bg-purple-700 transition disabled:opacity-50 flex justify-center items-center"
            >
              {isAiLoading ? 'Sedang membuat...' : 'Buat Soal dengan Gemini AI'}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Pertanyaan</label>
              <textarea 
                className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                rows={3}
                value={newQuestion.text}
                onChange={e => setNewQuestion({...newQuestion, text: e.target.value})}
              />
            </div>
            {newQuestion.options?.map((opt, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <input 
                  type="radio" 
                  name="correct" 
                  checked={newQuestion.correctAnswerIndex === idx}
                  onChange={() => setNewQuestion({...newQuestion, correctAnswerIndex: idx})}
                  className="w-4 h-4 text-blue-600"
                />
                <input 
                  type="text" 
                  placeholder={`Pilihan ${String.fromCharCode(65 + idx)}`}
                  className="flex-1 border p-2 rounded text-sm"
                  value={opt}
                  onChange={e => {
                    const newOpts = [...(newQuestion.options || [])];
                    newOpts[idx] = e.target.value;
                    setNewQuestion({...newQuestion, options: newOpts});
                  }}
                />
              </div>
            ))}
            <button 
              onClick={handleAddQuestion}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
            >
              <Save size={18} />
              <span>Simpan ke Bank Soal</span>
            </button>
          </div>
        </div>

        {/* List Column */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          <div className="p-4 bg-gray-50 border-b font-medium text-gray-700">
            Daftar Soal ({questions.length})
          </div>
          <div className="overflow-y-auto p-4 space-y-4 flex-1">
            {questions.length === 0 && <p className="text-center text-gray-500 py-10">Belum ada soal.</p>}
            {questions.map((q, i) => (
              <div key={q.id} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition group relative">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-8">
                    <p className="font-medium text-gray-900 mb-2"><span className="font-bold mr-2">{i+1}.</span>{q.text}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                      {q.options?.map((opt, idx) => (
                        <div key={idx} className={`flex items-center space-x-2 ${idx === q.correctAnswerIndex ? 'text-green-600 font-semibold' : ''}`}>
                          <span className="w-5 h-5 rounded-full border flex items-center justify-center text-xs">
                            {String.fromCharCode(65+idx)}
                          </span>
                          <span>{opt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
}