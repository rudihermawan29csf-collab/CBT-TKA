import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { UserSession, Role, Student, Question, Exam, QuestionPacket, SchoolSettings } from './types';
import { MOCK_STUDENTS, MOCK_QUESTIONS, MOCK_EXAMS, CLASS_LIST, MOCK_PACKETS } from './constants';
import { Sidebar } from './components/Sidebar';
import { AdminDashboard } from './views/AdminDashboard';
import { StudentDashboard } from './views/StudentDashboard';
import { User, Lock, Crosshair, Target, AlertTriangle, ChevronRight, ChevronDown, Cloud, CloudOff, RefreshCw } from 'lucide-react';

const DEFAULT_SETTINGS: SchoolSettings = {
  schoolName: 'SMPN 3 Pacet',
  academicYear: '2024/2025',
  semester: 'Ganjil',
  adminPassword: 'admin123'
};

// --- CONFIGURATION ---
// Masukkan URL Google Apps Script Web App Anda di sini agar aplikasi online
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwcfARF7u86QmGBjdZYtm643iElF-uYm9oVMKetdo_17GBWWY-YW7aqySp2JhdhhIqJdQ/exec"; 

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
  const [schoolSettings, setSchoolSettings] = usePersistentState<SchoolSettings>('cbt_settings', DEFAULT_SETTINGS);

  // Server Connection State
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Login Form State
  const [loginRole, setLoginRole] = useState<Role>(Role.STUDENT);
  const [selectedAdminUser, setSelectedAdminUser] = useState('admin'); 
  const [adminPass, setAdminPass] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- SYNC ENGINE ---
  // Coba ambil data dari server saat aplikasi dimuat
  useEffect(() => {
      if(APPS_SCRIPT_URL) {
          fetchDataFromServer();
      }
  }, []);

  const fetchDataFromServer = async () => {
      if(!APPS_SCRIPT_URL) return;
      setIsSyncing(true);
      try {
          const res = await fetch(`${APPS_SCRIPT_URL}?action=read`);
          const json = await res.json();
          if(json.status === 'success') {
              // Update state from server data if not empty
              if(json.data.Students?.length) setStudents(json.data.Students);
              if(json.data.Questions?.length) setQuestions(json.data.Questions);
              if(json.data.Packets?.length) setPackets(json.data.Packets);
              if(json.data.Exams?.length) setExams(json.data.Exams);
              
              // Handle Settings mapping
              if(json.data.Settings?.length) {
                  const s = json.data.Settings;
                  // Simple mapping assuming order or key value pair logic in sheet
                  // For now, we keep local settings or map manually if structure matches
              }
              setIsConnected(true);
          }
      } catch (err) {
          console.error("Failed to connect to server:", err);
          setIsConnected(false);
      } finally {
          setIsSyncing(false);
      }
  };

  // Sync manual trigger
  const handleSync = () => {
      fetchDataFromServer();
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
           setLoginError('Password Salah');
        }
      } else if (selectedAdminUser === 'guru_numerasi') {
         if (adminPass === 'guru 123') { 
           setSession({ role: Role.TEACHER_NUMERASI, name: 'Guru Numerasi', id: 'guru_num' });
           setActiveTab('questions'); 
        } else {
           setLoginError('Password Salah');
        }
      } else if (selectedAdminUser === 'guru_literasi') {
         if (adminPass === 'guru123') {
           setSession({ role: Role.TEACHER_LITERASI, name: 'Guru Literasi', id: 'guru_lit' });
           setActiveTab('questions');
        } else {
           setLoginError('Password Salah');
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

  // --- Login View (Theme: Dark/Gaming/Free Fire) ---
  if (!session) {
    const studentsInClass = students.filter(s => s.class === selectedClass);

    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-slate-950 relative overflow-hidden font-sans text-white">
        {/* Animated Background Layers */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center opacity-30 pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black pointer-events-none"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-600/10 via-slate-900/50 to-black pointer-events-none"></div>

        {/* Server Status Indicator */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
            {isSyncing ? (
                <div className="bg-blue-900/50 text-blue-300 px-3 py-1 rounded-full text-xs font-bold border border-blue-500/30 flex items-center gap-2">
                    <RefreshCw size={12} className="animate-spin"/> Syncing...
                </div>
            ) : isConnected ? (
                <div className="bg-green-900/50 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30 flex items-center gap-2">
                    <Cloud size={12}/> Terkoneksi dengan Server
                </div>
            ) : (
                <div className="bg-red-900/50 text-red-400 px-3 py-1 rounded-full text-xs font-bold border border-red-500/30 flex items-center gap-2 cursor-pointer" onClick={handleSync} title="Klik untuk refresh">
                    <CloudOff size={12}/> Offline (Local Mode)
                </div>
            )}
        </div>

        {/* Floating Particles/Decorations */}
        <div className="absolute top-10 left-10 text-yellow-500/20 animate-pulse"><Crosshair size={100} /></div>
        <div className="absolute bottom-20 right-10 text-yellow-500/20 animate-pulse delay-700"><Target size={120} /></div>

        {/* Login Container */}
        <div className="relative z-10 w-full max-w-md">
          {/* Header Graphic with Logo */}
          <div className="text-center mb-8 relative">
             <div className="mb-6 flex justify-center">
                <div className="relative w-20 h-20 flex items-center justify-center bg-black/60 border-2 border-yellow-500/50 rounded-xl transform rotate-3 shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                     <div className="absolute inset-0 border border-white/20 rounded-xl"></div>
                     <img src="https://image2url.com/r2/default/images/1769001049680-d981c280-6340-4989-8563-7b08134c189a.png" alt="Logo Sekolah" className="h-12 w-12 object-contain drop-shadow-md transform -rotate-3" />
                </div>
             </div>
             <div className="inline-block bg-yellow-500 text-black px-6 py-2 transform -skew-x-12 border-2 border-white/20 shadow-[0_0_20px_rgba(234,179,8,0.5)]">
                <h1 className="text-2xl font-black italic tracking-tighter transform skew-x-12 uppercase">CBT BATTLE</h1>
             </div>
             <p className="mt-3 text-slate-400 text-sm font-mono tracking-[0.3em] uppercase">{schoolSettings.schoolName}</p>
          </div>

          <div 
            className="bg-black/60 backdrop-blur-xl border border-white/10 p-1 relative"
            style={{ clipPath: 'polygon(5% 0, 100% 0, 100% 95%, 95% 100%, 0 100%, 0 5%)' }}
          >
            {/* Inner Border Container */}
            <div className="bg-slate-900/80 p-8 border-l-4 border-yellow-500 h-full">
              
              {/* Role Switcher */}
              <div className="flex bg-black/50 p-1 mb-6 border border-white/10">
                 <button
                   onClick={() => { setLoginRole(Role.STUDENT); setLoginError(''); }}
                   className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all clip-path-polygon ${
                     loginRole === Role.STUDENT 
                     ? 'bg-yellow-500 text-black clip-path-polygon' 
                     : 'text-slate-500 hover:text-white'
                   }`}
                   style={{ clipPath: loginRole === Role.STUDENT ? 'polygon(10% 0, 100% 0, 100% 100%, 0 100%)' : '' }}
                 >
                   Siswa
                 </button>
                 <button
                   onClick={() => { setLoginRole(Role.ADMIN); setLoginError(''); }}
                   className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all clip-path-polygon ${
                     loginRole === Role.ADMIN 
                     ? 'bg-yellow-500 text-black clip-path-polygon' 
                     : 'text-slate-500 hover:text-white'
                   }`}
                   style={{ clipPath: loginRole === Role.ADMIN ? 'polygon(0 0, 100% 0, 90% 100%, 0 100%)' : '' }}
                 >
                   Admin / Guru
                 </button>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                {loginRole === Role.ADMIN ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] text-yellow-500 uppercase font-bold tracking-widest">Login Sebagai</label>
                      <div className="relative group">
                        <select
                          className="w-full bg-black/50 border border-slate-700 text-white text-sm py-3 pl-4 pr-10 focus:outline-none focus:border-yellow-500 font-mono appearance-none"
                          value={selectedAdminUser}
                          onChange={(e) => setSelectedAdminUser(e.target.value)}
                        >
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
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-yellow-500">
                          <Lock size={16} />
                        </div>
                        <input
                          type="password"
                          className="w-full bg-black/50 border border-slate-700 text-white text-sm py-3 pl-10 pr-4 focus:outline-none focus:border-yellow-500 transition-colors placeholder-slate-600 font-mono"
                          placeholder="Masukkan Password"
                          value={adminPass}
                          onChange={(e) => setAdminPass(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                     <div className="space-y-1">
                        <label className="text-[10px] text-yellow-500 uppercase font-bold tracking-widest">Pilih Kelas</label>
                        <div className="relative">
                          <select
                            className="w-full bg-black/50 border border-slate-700 text-white text-sm py-3 pl-4 pr-10 focus:outline-none focus:border-yellow-500 appearance-none font-mono cursor-pointer"
                            value={selectedClass}
                            onChange={(e) => { setSelectedClass(e.target.value); setSelectedStudentId(''); }}
                          >
                            <option value="" className="bg-slate-900 text-slate-500">-- PILIH KELAS --</option>
                            {CLASS_LIST.map((cls) => (
                              <option key={cls} value={cls} className="bg-slate-900">{cls}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16}/>
                        </div>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] text-yellow-500 uppercase font-bold tracking-widest">Nama Siswa</label>
                        <div className="relative">
                          <select
                            className="w-full bg-black/50 border border-slate-700 text-white text-sm py-3 pl-4 pr-10 focus:outline-none focus:border-yellow-500 appearance-none font-mono cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            value={selectedStudentId}
                            onChange={(e) => setSelectedStudentId(e.target.value)}
                            disabled={!selectedClass}
                          >
                            <option value="" className="bg-slate-900 text-slate-500">-- PILIH NAMA --</option>
                            {studentsInClass.map((s) => (
                              <option key={s.id} value={s.id} className="bg-slate-900">{s.name} ({s.nis})</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16}/>
                        </div>
                     </div>
                  </>
                )}

                {loginError && (
                  <div className="bg-red-500/10 border-l-2 border-red-500 p-2">
                    <p className="text-red-500 text-xs font-mono flex items-center gap-2">
                      <AlertTriangle size={12} /> {loginError}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-widest py-4 mt-4 transition-all transform hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                     {loginRole === Role.ADMIN ? 'MASUK SISTEM' : 'MULAI UJIAN'} <ChevronRight size={18} className="animate-pulse"/>
                  </span>
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                </button>
              </form>
            </div>
          </div>
          
          <div className="text-center mt-6">
             <p className="text-[10px] text-slate-600 font-mono">SERVER SECURE • VERSI 2.0</p>
          </div>
        </div>
      </div>
    );
  }

  // --- Main Application View ---
  const isStudent = session.role === Role.STUDENT;

  // Use a common dark theme wrapper for both Admin and Student
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-white font-sans overflow-hidden">
      {/* Background for both roles */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center opacity-20 pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/90 via-slate-900/80 to-black/95 pointer-events-none"></div>

      {/* Main Window Container */}
      <div className="flex w-full h-full relative z-10">
        
        {/* Sidebar - Only show for ADMIN/TEACHER */}
        {session.role !== Role.STUDENT && (
          <div className="flex-none z-20 h-full">
             <Sidebar 
               user={session} 
               activeTab={activeTab} 
               onTabChange={setActiveTab} 
               onLogout={handleLogout} 
             />
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
            
            <div className="flex-1 overflow-auto bg-transparent custom-scrollbar">
                {session.role !== Role.STUDENT && (
                  <AdminDashboard
                    userRole={session.role} // Pass role to AdminDashboard
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
                  />
                )}
                {session.role === Role.STUDENT && session.details && (
                  <StudentDashboard
                    student={session.details}
                    exams={exams}
                    activeTab={activeTab}
                    onLogout={handleLogout}
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