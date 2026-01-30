import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { UserSession, Role, Student, Question, Exam, QuestionPacket, SchoolSettings, ExamResult } from './types';
import { MOCK_STUDENTS, MOCK_QUESTIONS, MOCK_EXAMS, CLASS_LIST, MOCK_PACKETS } from './constants';
import { Sidebar } from './components/Sidebar';
import { AdminDashboard } from './views/AdminDashboard';
import { StudentDashboard } from './views/StudentDashboard';
import { User, Lock, Crosshair, Target, AlertTriangle, ChevronRight, ChevronDown, Cloud, CloudOff, RefreshCw, ExternalLink } from 'lucide-react';

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
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby5vRtUkaj69aj9i3T-6_i4ngFHaoEH0Zv5xWGoxRelP54_B5XShSeMgn8qKGJgoS3QRQ/exec"; 

const App = () => {
  // Helper hook for localStorage persistence
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

  // Global App State
  const [session, setSession] = useState<UserSession | null>(null);
  
  // Data State with Persistence (localStorage)
  const [students, setStudents] = usePersistentState<Student[]>('cbt_students', MOCK_STUDENTS);
  const [questions, setQuestions] = usePersistentState<Question[]>('cbt_questions', MOCK_QUESTIONS);
  const [exams, setExams] = usePersistentState<Exam[]>('cbt_exams', []); 
  const [packets, setPackets] = usePersistentState<QuestionPacket[]>('cbt_packets', MOCK_PACKETS);
  const [examResults, setExamResults] = usePersistentState<ExamResult[]>('cbt_results', []); 
  const [schoolSettings, setSchoolSettings] = usePersistentState<SchoolSettings>('cbt_settings', DEFAULT_SETTINGS);

  // REF FOR SYNCING: Keeps track of latest state to avoid stale closures in async functions
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
      if(APPS_SCRIPT_URL) {
          fetchDataFromServer();
      }
  }, []);

  const fetchDataFromServer = async () => {
      if(!APPS_SCRIPT_URL) return;
      setIsSyncing(true);
      setSyncError('');
      
      try {
          const res = await fetch(`${APPS_SCRIPT_URL}?action=read&t=${Date.now()}`, {
             method: 'GET',
             redirect: 'follow',
             headers: { 'Content-Type': 'text/plain;charset=utf-8' }
          });
          
          if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
          const text = await res.text();
          
          if (text.trim().startsWith('<')) throw new Error("Invalid Server Response (HTML)");

          let json;
          try { json = JSON.parse(text); } catch (e) { throw new Error("JSON Parse Failed"); }

          if(json.status === 'success') {
              if(json.data.Students?.length > 0) setStudents(json.data.Students);
              if(json.data.Questions?.length > 0) setQuestions(json.data.Questions);
              if(json.data.Packets?.length > 0) setPackets(json.data.Packets);
              if(json.data.Exams?.length > 0) setExams(json.data.Exams);
              if(json.data.Results?.length > 0) setExamResults(json.data.Results); 
              
              if(json.data.Settings && Object.keys(json.data.Settings).length > 0) {
                  setSchoolSettings(prev => ({ ...prev, ...json.data.Settings }));
              }
              
              setIsConnected(true);
              console.log("Sync Read Success:", json.data);
          }
      } catch (err: any) {
          console.error("Failed to connect to server:", err);
          setSyncError(err.message || "Connection Failed");
          setIsConnected(false);
      } finally {
          setIsSyncing(false);
      }
  };

  // Function to save data
  const saveDataToServer = async () => {
      if(!APPS_SCRIPT_URL) return;
      setIsSyncing(true);
      setSyncError('');

      const payload = {
          action: 'write',
          data: {
              Students: stateRef.current.students,
              Questions: stateRef.current.questions,
              Packets: stateRef.current.packets,
              Exams: stateRef.current.exams,
              Results: stateRef.current.examResults, 
              Settings: stateRef.current.schoolSettings 
          }
      };

      try {
          await fetch(APPS_SCRIPT_URL, {
              method: 'POST',
              mode: 'no-cors', 
              headers: { 'Content-Type': 'text/plain' },
              body: JSON.stringify(payload)
          });
          setIsConnected(true);
          console.log("Data upload initiated (Background Mode)");
      } catch (err: any) {
          console.error("Upload failed:", err);
          setSyncError("Upload Failed");
          setIsConnected(false);
      } finally {
          setIsSyncing(false);
      }
  };

  const handleStudentSaveResult = (result: ExamResult) => {
      setExamResults(prev => {
          const next = [...prev, result];
          stateRef.current.examResults = next;
          return next;
      });
      setTimeout(() => saveDataToServer(), 2000); 
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (loginRole === Role.ADMIN) {
      if (selectedAdminUser === 'admin') {
        if (adminPass === schoolSettings.adminPassword) {
           setSession({ role: Role.ADMIN, name: 'Administrator', id: 'admin' });
           setActiveTab('dashboard');
        } else {
           setLoginError('Password Admin Salah');
        }
      } else if (selectedAdminUser === 'guru_numerasi') {
         if (adminPass === (schoolSettings.teacherNumerasiPassword || 'guru123')) { 
           setSession({ role: Role.TEACHER_NUMERASI, name: 'Guru Numerasi', id: 'guru_num' });
           setActiveTab('questions'); 
        } else {
           setLoginError('Password Guru Numerasi Salah');
        }
      } else if (selectedAdminUser === 'guru_literasi') {
         if (adminPass === (schoolSettings.teacherLiterasiPassword || 'guru123')) {
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

  // --- Login View ---
  if (!session) {
    const studentsInClass = students.filter(s => s.class === selectedClass);

    return (
      <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-center p-4 bg-slate-950 overflow-hidden font-sans text-white">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center opacity-30 pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black pointer-events-none"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-600/10 via-slate-900/50 to-black pointer-events-none"></div>

        <div className="absolute top-4 right-4 flex flex-col items-end gap-2 z-50">
            {isSyncing ? (
                <div className="bg-blue-900/50 text-blue-300 px-3 py-1 rounded-full text-xs font-bold border border-blue-500/30 flex items-center gap-2 shadow-lg">
                    <RefreshCw size={12} className="animate-spin"/> Syncing...
                </div>
            ) : isConnected ? (
                <div className="bg-green-900/50 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30 flex items-center gap-2 shadow-lg">
                    <Cloud size={12}/> Online
                </div>
            ) : (
                <div className="bg-red-900/50 text-red-300 px-3 py-1 rounded-full text-xs font-bold border border-red-500/30 flex items-center gap-2 shadow-lg">
                   <CloudOff size={12}/> Offline
                </div>
            )}
        </div>

        <div className="relative z-10 w-full max-w-md">
          <div className="text-center mb-8 relative">
             <div className="mb-6 flex justify-center">
                <div className="relative w-20 h-20 flex items-center justify-center bg-black/60 border-2 border-yellow-500/50 rounded-xl transform rotate-3 shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                     <div className="absolute inset-0 border border-white/20 rounded-xl"></div>
                     <img src="https://image2url.com/r2/default/images/1769001049680-d981c280-6340-4989-8563-7b08134c189a.png" alt="Logo" className="h-12 w-12 object-contain drop-shadow-md transform -rotate-3" />
                </div>
             </div>
             <div className="inline-block bg-yellow-500 text-black px-6 py-2 transform -skew-x-12 border-2 border-white/20 shadow-[0_0_20px_rgba(234,179,8,0.5)]">
                <h1 className="text-2xl font-black italic tracking-tighter transform skew-x-12 uppercase">{schoolSettings?.cbtTitle || 'CBT BATTLE'}</h1>
             </div>
             <p className="mt-3 text-slate-400 text-sm font-mono tracking-[0.3em] uppercase">{schoolSettings.schoolName}</p>
          </div>

          <div 
            className="bg-black/60 backdrop-blur-xl border border-white/10 p-1 relative"
            style={{ clipPath: 'polygon(5% 0, 100% 0, 100% 95%, 95% 100%, 0 100%, 0 5%)' }}
          >
            <div className="bg-slate-900/80 p-8 border-l-4 border-yellow-500 h-full">
              <div className="flex bg-black/50 p-1 mb-6 border border-white/10">
                 <button onClick={() => { setLoginRole(Role.STUDENT); setLoginError(''); }} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all ${loginRole === Role.STUDENT ? 'bg-yellow-500 text-black' : 'text-slate-500 hover:text-white'}`}>Siswa</button>
                 <button onClick={() => { setLoginRole(Role.ADMIN); setLoginError(''); }} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all ${loginRole === Role.ADMIN ? 'bg-yellow-500 text-black' : 'text-slate-500 hover:text-white'}`}>Admin / Guru</button>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                {loginRole === Role.ADMIN ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] text-yellow-500 uppercase font-bold tracking-widest">Login Sebagai</label>
                      <div className="relative group">
                        <select className="w-full bg-black/50 border border-slate-700 text-white text-sm py-3 pl-4 pr-10 focus:outline-none focus:border-yellow-500 font-mono appearance-none" value={selectedAdminUser} onChange={(e) => setSelectedAdminUser(e.target.value)}>
                            <option value="admin">Admin Utama</option>
                            <option value="guru_literasi">Guru Literasi</option>
                            <option value="guru_numerasi">Guru Numerasi</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16}/>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-yellow-500 uppercase font-bold tracking-widest">Password</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-yellow-500"><Lock size={16} /></div>
                        <input type="password" className="w-full bg-black/50 border border-slate-700 text-white text-sm py-3 pl-10 pr-4 focus:outline-none focus:border-yellow-500 transition-colors font-mono" placeholder="Masukkan Password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                     <div className="space-y-1">
                        <label className="text-[10px] text-yellow-500 uppercase font-bold tracking-widest">Pilih Kelas</label>
                        <div className="relative">
                          <select className="w-full bg-black/50 border border-slate-700 text-white text-sm py-3 pl-4 pr-10 focus:outline-none focus:border-yellow-500 appearance-none font-mono cursor-pointer" value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setSelectedStudentId(''); }}>
                            <option value="" className="bg-slate-900 text-slate-500">-- PILIH KELAS --</option>
                            {CLASS_LIST.map((cls) => (<option key={cls} value={cls} className="bg-slate-900">{cls}</option>))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16}/>
                        </div>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] text-yellow-500 uppercase font-bold tracking-widest">Nama Siswa</label>
                        <div className="relative">
                          <select className="w-full bg-black/50 border border-slate-700 text-white text-sm py-3 pl-4 pr-10 focus:outline-none focus:border-yellow-500 appearance-none font-mono cursor-pointer disabled:opacity-50" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} disabled={!selectedClass}>
                            <option value="" className="bg-slate-900 text-slate-500">-- PILIH NAMA --</option>
                            {studentsInClass.map((s) => (<option key={s.id} value={s.id} className="bg-slate-900">{s.name} ({s.nis})</option>))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16}/>
                        </div>
                     </div>
                  </>
                )}
                {loginError && (<div className="bg-red-500/10 border-l-2 border-red-500 p-2"><p className="text-red-500 text-xs font-mono flex items-center gap-2"><AlertTriangle size={12} /> {loginError}</p></div>)}
                <button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-widest py-4 mt-4 transition-all group relative overflow-hidden">
                  <span className="relative z-10 flex items-center justify-center gap-2">{loginRole === Role.ADMIN ? 'MASUK SISTEM' : 'MULAI UJIAN'} <ChevronRight size={18} className="animate-pulse"/></span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Main App View (Authenticated) ---
  return (
    <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-center bg-slate-950 text-white font-sans overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center opacity-20 pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/90 via-slate-900/80 to-black/95 pointer-events-none"></div>

      <div className="flex w-full h-full relative z-10 overflow-hidden">
        {session.role !== Role.STUDENT && (
          <div className="flex-none z-20 h-full border-r border-white/10">
             <Sidebar user={session} activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout} />
          </div>
        )}

        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            {/* Sync Indicator for Admin */}
            {session.role !== Role.STUDENT && (
                <div className="absolute top-4 right-8 z-50 flex items-center gap-2">
                    {isSyncing ? (
                        <div className="bg-blue-600 px-3 py-1 rounded text-xs font-bold text-white shadow-lg animate-pulse flex items-center gap-2">
                            <RefreshCw size={12} className="animate-spin"/> Syncing...
                        </div>
                    ) : (
                        <button onClick={saveDataToServer} className="bg-slate-800 hover:bg-green-600 px-3 py-1 rounded text-xs font-bold text-slate-300 hover:text-white border border-slate-600 shadow-lg flex items-center gap-2 transition-all">
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
                    onSyncData={() => setTimeout(saveDataToServer, 500)} 
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