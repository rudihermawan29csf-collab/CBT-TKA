import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { UserSession, Role, Student, Question, Exam, QuestionPacket, SchoolSettings, ExamResult } from './types';
import { MOCK_STUDENTS, MOCK_QUESTIONS, MOCK_EXAMS, CLASS_LIST, MOCK_PACKETS } from './constants';
import { Sidebar } from './components/Sidebar';
import { AdminDashboard } from './views/AdminDashboard';
import { StudentDashboard } from './views/StudentDashboard';
import { User, Lock, AlertTriangle, ChevronRight, ChevronDown, Cloud, CloudOff, RefreshCw, Loader2, Play, Shield, Target, Crosshair } from 'lucide-react';

const DEFAULT_SETTINGS: SchoolSettings = {
  schoolName: 'SMPN 3 Pacet',
  cbtTitle: 'CBT BATTLE', // Default Title
  academicYear: '2024/2025',
  semester: 'Ganjil',
  adminPassword: 'admin123',
  teacherLiterasiPassword: 'guru123',
  teacherNumerasiPassword: 'guru123'
};

// --- CONFIGURATION ---
const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwiI1HFdBD-ai0nV9VudBp4XCn__wiqq1AIQ6iJ-dHzcYzey_LTCEPNNoDPmjEjjllc0Q/exec"; 

const App = () => {
  const usePersistentState = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const [state, setState] = useState<T>(() => {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : initialValue;
      } catch (error) {
        console.error("Error reading localStorage key:", key, error);
        return initialValue;
      }
    });

    useEffect(() => {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch (error) {
        console.error("Error saving to localStorage key:", key, error);
      }
    }, [key, state]);

    return [state, setState];
  };

  const [scriptUrl, setScriptUrl] = useState<string>(() => {
      const stored = localStorage.getItem('cbt_script_url_v4');
      return stored || DEFAULT_SCRIPT_URL;
  });

  useEffect(() => {
      localStorage.setItem('cbt_script_url_v4', scriptUrl);
  }, [scriptUrl]);

  // Global App State
  const [session, setSession] = useState<UserSession | null>(null);
  
  // Data State with Persistence
  const [students, setStudents] = usePersistentState<Student[]>('cbt_students_v4', MOCK_STUDENTS);
  const [questions, setQuestions] = usePersistentState<Question[]>('cbt_questions_v4', MOCK_QUESTIONS);
  const [exams, setExams] = usePersistentState<Exam[]>('cbt_exams_v4', MOCK_EXAMS); 
  const [packets, setPackets] = usePersistentState<QuestionPacket[]>('cbt_packets_v4', MOCK_PACKETS);
  const [examResults, setExamResults] = usePersistentState<ExamResult[]>('cbt_results_v4', []); 
  const [schoolSettings, setSchoolSettings] = usePersistentState<SchoolSettings>('cbt_settings_v4', DEFAULT_SETTINGS);

  const stateRef = useRef({ students, questions, exams, packets, examResults, schoolSettings });
  useEffect(() => {
      stateRef.current = { students, questions, exams, packets, examResults, schoolSettings };
  }, [students, questions, exams, packets, examResults, schoolSettings]);

  // Server Connection State
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string>('');
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Login Form State
  const [loginRole, setLoginRole] = useState<Role>(Role.STUDENT);
  const [selectedAdminUser, setSelectedAdminUser] = useState('admin'); 
  const [adminPass, setAdminPass] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- SYNC ENGINE ---
  useEffect(() => {
      if(scriptUrl) {
          fetchDataFromServer();
      }
  }, [scriptUrl]); 

  const safeJsonParse = (str: any, fallback: any) => {
    if (typeof str !== 'string') return str || fallback;
    if (!str || str.trim() === '') return fallback;
    try { return JSON.parse(str); } catch (e) { return fallback; }
  };

  const fetchDataFromServer = async () => {
      if(!scriptUrl) return;
      setIsSyncing(true);
      setSyncError('');
      
      try {
          const res = await fetch(`${scriptUrl}?action=read&t=${Date.now()}`, {
             method: 'GET',
             redirect: 'follow',
             headers: { 'Content-Type': 'text/plain;charset=utf-8' }
          });
          
          if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
          const text = await res.text();
          let json;
          try { json = JSON.parse(text); } catch (e) { throw new Error("JSON Parse Failed"); }

          if(json.status === 'success') {
              let loadedQuestions: Question[] = [];
              let loadedPackets: QuestionPacket[] = [];

              if(json.data.Students?.length > 0) setStudents(json.data.Students);
              
              if(json.data.Questions?.length > 0) {
                  loadedQuestions = json.data.Questions.map((q: any) => ({
                      ...q,
                      packetId: String(q.packetId || ''),
                      number: parseInt(q.number || '0'), 
                      options: safeJsonParse(q.options, []),
                      correctAnswerIndices: safeJsonParse(q.correctAnswerIndices, []),
                      matchingPairs: safeJsonParse(q.matchingPairs, [])
                  }));
                  setQuestions(loadedQuestions);
              }
              
              if(json.data.Packets?.length > 0) {
                  loadedPackets = json.data.Packets.map((p: any) => ({
                      ...p,
                      id: String(p.id || ''), 
                      questionTypes: safeJsonParse(p.questionTypes, {})
                  }));
                  setPackets(loadedPackets);
              }

              if(json.data.Exams?.length > 0) {
                  const parsedExams = json.data.Exams.map((e: any) => {
                      let isActiveBool = e.isActive;
                      if (typeof e.isActive === 'string') { isActiveBool = e.isActive.toLowerCase() === 'true'; }
                      const examPacketId = String(e.packetId || '');
                      let examQuestions: Question[] = [];
                      if (examPacketId && loadedQuestions.length > 0) {
                          const relatedPacket = loadedPackets.find(p => String(p.id) === examPacketId);
                          const limit = relatedPacket ? Number(relatedPacket.totalQuestions) : 999;
                          examQuestions = loadedQuestions
                              .filter(q => q.packetId === examPacketId && (q.number || 0) <= limit)
                              .sort((a, b) => (a.number || 0) - (b.number || 0));
                      }
                      if (examQuestions.length === 0) { examQuestions = safeJsonParse(e.questions, []); }
                      return {
                          ...e,
                          packetId: examPacketId,
                          classTarget: safeJsonParse(e.classTarget, []),
                          questions: examQuestions,
                          isActive: isActiveBool
                      };
                  });
                  setExams(parsedExams);
              }

              if(json.data.Results?.length > 0) {
                  const parsedResults = json.data.Results.map((r: any) => ({
                      ...r,
                      answers: safeJsonParse(r.answers, {})
                  }));
                  setExamResults(prevLocalResults => {
                      const serverMap = new Map(parsedResults.map((r: any) => [r.id, r]));
                      const merged = [...parsedResults];
                      prevLocalResults.forEach(localRes => {
                          if (!serverMap.has(localRes.id)) { merged.push(localRes); }
                      });
                      return merged as ExamResult[];
                  });
              }
              
              if(json.data.Settings) {
                  setSchoolSettings(prev => ({ ...DEFAULT_SETTINGS, ...json.data.Settings }));
              }
              
              setIsConnected(true);
          }
      } catch (err: any) {
          console.error("Failed to connect to server:", err);
          setSyncError(err.message || "Connection Failed");
          setIsConnected(false);
      } finally {
          setIsSyncing(false);
      }
  };

  const uploadImageToServer = async (base64Data: string, filename: string): Promise<string> => {
      if(!scriptUrl) throw new Error("Server URL not configured");
      const cleanBase64 = base64Data.split(',')[1] || base64Data;
      const payload = {
          action: 'upload',
          data: {
              image: cleanBase64,
              mimeType: 'image/jpeg', 
              name: filename
          }
      };

      try {
          const res = await fetch(scriptUrl, {
              method: 'POST',
              redirect: 'follow',
              headers: { 'Content-Type': 'text/plain' },
              body: JSON.stringify(payload)
          });

          if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
          const text = await res.text();
          let json;
          try {
             json = JSON.parse(text);
          } catch(e) {
             if (text.includes("DriveApp") || text.includes("Exception")) {
                 throw new Error(`SERVER PERMISSION ERROR: ${text.replace(/<[^>]*>?/gm, '').substring(0, 150)}`);
             }
             throw new Error("Invalid JSON response");
          }

          if (json.status === 'success' && json.url) return json.url;
          else throw new Error(json.message || "Upload failed");
      } catch (e: any) {
          throw e; 
      }
  };

  const saveDataToServer = async () => {
      if(!scriptUrl) return;
      setIsSyncing(true);
      setSyncError('');

      const payload = {
          action: 'write',
          data: {
              Students: stateRef.current.students,
              Questions: stateRef.current.questions.map(q => ({
                  ...q,
                  packetId: String(q.packetId || ''),
                  number: q.number || 0,
                  options: JSON.stringify(q.options || []),
                  correctAnswerIndices: JSON.stringify(q.correctAnswerIndices || []),
                  matchingPairs: JSON.stringify(q.matchingPairs || [])
              })),
              Packets: stateRef.current.packets.map(p => ({
                  ...p,
                  questionTypes: JSON.stringify(p.questionTypes || {})
              })),
              Exams: stateRef.current.exams.map(e => ({
                  ...e,
                  packetId: String(e.packetId || ''),
                  classTarget: JSON.stringify(e.classTarget || []),
                  questions: "[]", 
                  isActive: e.isActive 
              })),
              Results: stateRef.current.examResults.map(r => ({
                  ...r,
                  answers: JSON.stringify(r.answers || {})
              })), 
              Settings: stateRef.current.schoolSettings 
          }
      };

      try {
          const res = await fetch(scriptUrl, {
              method: 'POST',
              redirect: 'follow', 
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify(payload)
          });

          if (!res.ok) throw new Error("HTTP Error");
          const text = await res.text();
          const json = JSON.parse(text);

          if (json.status === 'success') {
              setIsConnected(true);
              console.log("Data upload SUCCESS");
          } else {
              throw new Error(json.message || "Server Script Error");
          }

      } catch (err: any) {
          console.error("Upload failed:", err);
          setSyncError("Upload Failed");
          setIsConnected(false);
          alert(`GAGAL MENYIMPAN!\n\nDetail Error: ${err.message}\n\nSolusi:\n1. Cek koneksi internet.\n2. Pastikan Deploy Apps Script -> 'Who has access' = 'Anyone'.\n3. Coba refresh halaman.`);
      } finally {
          setIsSyncing(false);
      }
  };

  const handleStudentSaveResult = async (result: ExamResult) => {
      setExamResults(prev => {
          if(prev.some(r => r.id === result.id)) return prev;
          return [...prev, result];
      });

      setIsSyncing(true);
      try {
          if(scriptUrl) {
              const res = await fetch(`${scriptUrl}?action=read&t=${Date.now()}`);
              const text = await res.text();
              const json = JSON.parse(text);
              if(json.status === 'success') {
                  const serverResults = json.data.Results || [];
                  const parsedServerResults = serverResults.map((r: any) => ({
                      ...r,
                      answers: safeJsonParse(r.answers, {})
                  }));
                  const otherResults = parsedServerResults.filter((r: ExamResult) => r.id !== result.id);
                  const mergedResults = [...otherResults, result];
                  stateRef.current.examResults = mergedResults;
                  if (json.data.Students) stateRef.current.students = json.data.Students;
              }
          }
          await saveDataToServer();
          alert("Jawaban BERHASIL terkirim ke server!");
      } catch (e) {
          alert("Gagal sinkronisasi otomatis. Data tersimpan di browser, silakan coba tekan tombol Sync/Refresh nanti.");
      } finally {
          setIsSyncing(false);
      }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const currentAdminPass = schoolSettings.adminPassword || DEFAULT_SETTINGS.adminPassword;
    const currentLitPass = schoolSettings.teacherLiterasiPassword || DEFAULT_SETTINGS.teacherLiterasiPassword;
    const currentNumPass = schoolSettings.teacherNumerasiPassword || DEFAULT_SETTINGS.teacherNumerasiPassword;

    if (loginRole === Role.ADMIN) {
      if (selectedAdminUser === 'admin') {
        if (adminPass === currentAdminPass) {
           setSession({ role: Role.ADMIN, name: 'Administrator', id: 'admin' });
           setActiveTab('dashboard');
        } else {
           setLoginError('Password Admin Salah');
        }
      } else if (selectedAdminUser === 'guru_numerasi') {
         if (adminPass === currentNumPass) { 
           setSession({ role: Role.TEACHER_NUMERASI, name: 'Guru Numerasi', id: 'guru_num' });
           setActiveTab('questions'); 
        } else {
           setLoginError('Password Guru Numerasi Salah');
        }
      } else if (selectedAdminUser === 'guru_literasi') {
         if (adminPass === currentLitPass) {
           setSession({ role: Role.TEACHER_LITERASI, name: 'Guru Literasi', id: 'guru_lit' });
           setActiveTab('questions');
        } else {
           setLoginError('Password Guru Literasi Salah');
        }
      } else {
         setLoginError('User tidak valid.');
      }

    } else if (loginRole === Role.STUDENT) {
      if (!selectedClass || !selectedStudentId) {
        setLoginError('Pilih Kelas dan Nama Siswa.');
        return;
      }
      const student = students.find(s => s.id === selectedStudentId);
      if (student) {
        setSession({ role: Role.STUDENT, name: student.name, id: student.id, details: student });
        setActiveTab('dashboard');
      } else {
        setLoginError('Data siswa tidak valid.');
      }
    }
  };

  const handleLogout = () => {
    setSession(null);
    setSelectedAdminUser('admin');
    setAdminPass('');
    setSelectedClass('');
    setSelectedStudentId('');
    setLoginError('');
  };

  // --- Login View (Free Fire Light Theme) ---
  if (!session) {
    const studentsInClass = students.filter(s => s.class === selectedClass);
    const isStudent = loginRole === Role.STUDENT;

    return (
      <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-center bg-[#F2F4F8] overflow-hidden font-sans text-slate-800">
        
        {/* Tactical Background Elements */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(226,232,240,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(226,232,240,0.4)_1px,transparent_1px)] bg-[size:40px_40px] z-0 pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-yellow-200/30 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-200/30 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
        
        {/* Status Indicators */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
            {isSyncing ? (
                <div className="bg-white/80 backdrop-blur border border-blue-200 text-blue-600 px-4 py-2 text-xs font-black uppercase tracking-widest skew-x-[-12deg] flex items-center gap-2 shadow-sm">
                    <div className="skew-x-[12deg] flex items-center gap-2"><RefreshCw size={12} className="animate-spin"/> Syncing</div>
                </div>
            ) : isConnected ? (
                <div className="bg-white/80 backdrop-blur border border-green-200 text-green-600 px-4 py-2 text-xs font-black uppercase tracking-widest skew-x-[-12deg] flex items-center gap-2 shadow-sm">
                    <div className="skew-x-[12deg] flex items-center gap-2"><Cloud size={12}/> Online</div>
                </div>
            ) : (
                <div className="bg-white/80 backdrop-blur border border-red-200 text-red-600 px-4 py-2 text-xs font-black uppercase tracking-widest skew-x-[-12deg] flex items-center gap-2 shadow-sm">
                   <div className="skew-x-[12deg] flex items-center gap-2"><CloudOff size={12}/> Offline</div>
                </div>
            )}
        </div>

        <div className="relative z-10 w-full max-w-md p-4">
          {/* Logo Section */}
          <div className="text-center mb-10 relative">
             <div className="relative inline-block group">
                <div className="absolute inset-0 bg-yellow-400 rotate-[10deg] rounded-3xl blur-md opacity-40 group-hover:rotate-[20deg] transition-transform duration-500"></div>
                <div className="w-28 h-28 flex items-center justify-center bg-white border-4 border-yellow-500 relative z-10 shadow-xl transform rotate-[10deg] group-hover:rotate-0 transition-transform duration-300 rounded-[2rem]">
                     <div className="transform -rotate-[10deg] group-hover:rotate-0 transition-transform duration-300">
                        <img src="https://image2url.com/r2/default/images/1769001049680-d981c280-6340-4989-8563-7b08134c189a.png" alt="Logo" className="h-16 w-16 object-contain" />
                     </div>
                </div>
             </div>
             <div className="mt-8">
                 <h1 className="text-5xl font-black italic tracking-tighter text-slate-800 uppercase drop-shadow-sm leading-none">
                    {schoolSettings?.cbtTitle || 'BATTLE ARENA'}
                 </h1>
                 <div className="flex items-center justify-center gap-2 mt-2">
                    <div className="h-1 w-8 bg-yellow-500 skew-x-[-20deg]"></div>
                    <p className="text-slate-500 text-sm font-black uppercase tracking-[0.3em]">{schoolSettings.schoolName}</p>
                    <div className="h-1 w-8 bg-yellow-500 skew-x-[-20deg]"></div>
                 </div>
             </div>
          </div>

          {/* Login Card */}
          <div className="bg-white/90 backdrop-blur-sm p-1 shadow-2xl relative">
            {/* Decorative Corners */}
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-yellow-500 z-20"></div>
            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-yellow-500 z-20"></div>
            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-yellow-500 z-20"></div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-yellow-500 z-20"></div>

            <div className="bg-white p-8 border border-slate-200 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400"></div>
              
              {/* Role Toggle */}
              <div className="flex gap-2 mb-8">
                 <button onClick={() => { setLoginRole(Role.STUDENT); setLoginError(''); }} className={`flex-1 h-12 skew-x-[-12deg] transition-all duration-300 border-2 flex items-center justify-center group ${isStudent ? 'bg-yellow-500 border-yellow-500 text-white shadow-lg shadow-yellow-200' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-yellow-300'}`}>
                    <div className="skew-x-[12deg] font-black uppercase tracking-widest text-sm flex items-center gap-2">
                        <Target size={16} className={isStudent ? "animate-pulse" : ""}/> SISWA
                    </div>
                 </button>
                 <button onClick={() => { setLoginRole(Role.ADMIN); setLoginError(''); }} className={`flex-1 h-12 skew-x-[-12deg] transition-all duration-300 border-2 flex items-center justify-center group ${!isStudent ? 'bg-slate-800 border-slate-800 text-white shadow-lg' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-400'}`}>
                    <div className="skew-x-[12deg] font-black uppercase tracking-widest text-sm flex items-center gap-2">
                        <Shield size={16} /> GURU
                    </div>
                 </button>
              </div>

              <form onSubmit={handleLogin} className="space-y-6 relative z-10">
                {!isStudent ? (
                  /* Admin Inputs */
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] text-slate-400 uppercase font-black tracking-widest flex items-center gap-1"><User size={12}/> Access Level</label>
                      <div className="relative group">
                        <select className="w-full bg-slate-50 border-2 border-slate-200 text-slate-700 text-sm py-3 px-4 focus:outline-none focus:border-slate-800 font-bold appearance-none transition-all uppercase rounded-none" value={selectedAdminUser} onChange={(e) => setSelectedAdminUser(e.target.value)}>
                            <option value="admin">Admin Utama</option>
                            <option value="guru_literasi">Guru Literasi</option>
                            <option value="guru_numerasi">Guru Numerasi</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18}/>
                        <div className="absolute bottom-0 left-0 w-0 h-[2px] bg-slate-800 transition-all duration-300 group-hover:w-full"></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-slate-400 uppercase font-black tracking-widest flex items-center gap-1"><Lock size={12}/> Security Code</label>
                      <div className="relative group">
                        <input type="password" className="w-full bg-slate-50 border-2 border-slate-200 text-slate-700 text-sm py-3 px-4 focus:outline-none focus:border-slate-800 transition-colors font-bold uppercase rounded-none" placeholder="ENTER PASSWORD" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} />
                        <div className="absolute bottom-0 left-0 w-0 h-[2px] bg-slate-800 transition-all duration-300 group-hover:w-full"></div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Student Inputs */
                  <>
                     <div className="space-y-2">
                        <label className="text-[10px] text-slate-400 uppercase font-black tracking-widest flex items-center gap-1"><Shield size={12}/> Class Selection</label>
                        <div className="relative group">
                          <select className="w-full bg-slate-50 border-2 border-slate-200 text-slate-700 text-sm py-3 px-4 focus:outline-none focus:border-yellow-500 appearance-none font-bold cursor-pointer transition-all uppercase rounded-none" value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setSelectedStudentId(''); }}>
                            <option value="">-- SELECT CLASS --</option>
                            {CLASS_LIST.map((cls) => (<option key={cls} value={cls}>{cls}</option>))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18}/>
                          <div className="absolute bottom-0 left-0 w-0 h-[2px] bg-yellow-500 transition-all duration-300 group-hover:w-full"></div>
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] text-slate-400 uppercase font-black tracking-widest flex items-center gap-1"><User size={12}/> Operator Name</label>
                        <div className="relative group">
                          <select className="w-full bg-slate-50 border-2 border-slate-200 text-slate-700 text-sm py-3 px-4 focus:outline-none focus:border-yellow-500 appearance-none font-bold cursor-pointer disabled:opacity-50 transition-all uppercase rounded-none" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} disabled={!selectedClass}>
                            <option value="">-- SELECT IDENTITY --</option>
                            {studentsInClass.map((s) => (<option key={s.id} value={s.id}>{s.name} ({s.nis})</option>))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18}/>
                          <div className="absolute bottom-0 left-0 w-0 h-[2px] bg-yellow-500 transition-all duration-300 group-hover:w-full"></div>
                        </div>
                     </div>
                  </>
                )}
                
                {loginError && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-3 animate-bounce-in">
                        <p className="text-red-500 text-xs font-black flex items-center gap-2 uppercase tracking-wide"><AlertTriangle size={14} /> {loginError}</p>
                    </div>
                )}
                
                <button type="submit" className={`w-full text-white font-black text-lg uppercase tracking-[0.2em] py-4 mt-6 transition-all shadow-lg skew-x-[-12deg] group relative overflow-hidden active:scale-[0.98] ${!isStudent ? 'bg-slate-800 hover:bg-slate-700 border-b-4 border-slate-950' : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 border-b-4 border-orange-700 shadow-orange-200'}`}>
                  <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>
                  <span className="skew-x-[12deg] flex justify-center items-center gap-3">
                    {loginRole === Role.ADMIN ? (
                        <>ADMIN ACCESS <Lock size={18} /></>
                    ) : (
                        <>START MISSION <ChevronRight size={20} strokeWidth={3}/></>
                    )}
                  </span>
                </button>
              </form>
            </div>
          </div>
          
          <p className="text-center text-slate-400 text-[10px] font-bold mt-8 uppercase tracking-widest opacity-60">
              Secured by CBT Battle System v4.0
          </p>
        </div>
      </div>
    );
  }

  // --- Main App View (Authenticated) ---
  return (
    <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-center bg-[#F2F4F8] text-slate-800 font-sans overflow-hidden">
      
      <div className="flex w-full h-full relative z-10 overflow-hidden">
        {session.role !== Role.STUDENT && (
          <div className="flex-none z-20 h-full border-r border-slate-200 bg-white shadow-xl">
             <Sidebar user={session} activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout} />
          </div>
        )}

        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            {/* Sync Indicator for Admin */}
            {session.role !== Role.STUDENT && (
                <div className="absolute top-4 right-8 z-50 flex items-center gap-2">
                    {isSyncing ? (
                        <div className="bg-blue-100 px-3 py-1 rounded-full text-xs font-bold text-blue-600 shadow border border-blue-200 flex items-center gap-2">
                            <RefreshCw size={12} className="animate-spin"/> Syncing...
                        </div>
                    ) : (
                        <button onClick={saveDataToServer} className="bg-white hover:bg-slate-50 px-3 py-1 rounded-full text-xs font-bold text-slate-500 hover:text-[#00A2FF] border border-slate-200 shadow flex items-center gap-2 transition-all">
                            <Cloud size={14}/> {isConnected ? 'Data Synced' : 'Sync to Server'}
                        </button>
                    )}
                </div>
            )}

            <div className="flex-1 h-full overflow-hidden relative">
                {session.role !== Role.STUDENT && (
                  <AdminDashboard
                    userRole={session.role}
                    students={students}
                    setStudents={setStudents}
                    teachers={[]}
                    setTeachers={() => {}}
                    questions={questions}
                    setQuestions={setQuestions}
                    activeTab={activeTab}
                    exams={exams}
                    setExams={setExams}
                    packets={packets}
                    setPackets={setPackets}
                    schoolSettings={schoolSettings}
                    setSchoolSettings={setSchoolSettings}
                    examResults={examResults} 
                    onSyncData={() => {
                        stateRef.current = { students, questions, exams, packets, examResults, schoolSettings };
                        setTimeout(saveDataToServer, 500); 
                    }}
                    onUploadImage={uploadImageToServer}
                    currentScriptUrl={scriptUrl}
                    onUpdateScriptUrl={setScriptUrl}
                  />
                )}
                {session.role === Role.STUDENT && session.details && (
                  <StudentDashboard
                    student={session.details}
                    exams={exams}
                    activeTab={activeTab}
                    onLogout={handleLogout}
                    examResults={examResults} 
                    onSaveResult={handleStudentSaveResult}
                  />
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);