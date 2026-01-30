import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Student, Exam, Question, QuestionType, QuestionCategory } from '../types';
import { Clock, CheckCircle, AlertCircle, FileText, ChevronRight, ChevronLeft, Save, HelpCircle, Layout, Check, Crosshair, Map, Shield, Trophy, BarChart2, Target, XCircle, Grid, X, Menu, LogOut, Home, Flag, ImageIcon, User, AlertTriangle, Zap, Heart, Shield as ShieldIcon, AlertOctagon, Lock } from 'lucide-react';

interface StudentDashboardProps {
  student: Student;
  exams: Exam[];
  activeTab: string;
  onLogout?: () => void;
}

// Helper to simulate history data since we don't have a backend
const getMockHistory = (student: Student, exams: Exam[]) => {
  return exams.slice(0, 1).map(exam => {
     let correctCount = 0;
     let literasiCorrect = 0;
     let numerasiCorrect = 0;
     let literasiTotal = 0;
     let numerasiTotal = 0;
     const answers: Record<string, boolean> = {};

     exam.questions.forEach((q, idx) => {
        const isLiterasi = q.category === QuestionCategory.LITERASI || (!q.category && idx % 2 === 0);
        if (isLiterasi) literasiTotal++; else numerasiTotal++;

        const isCorrect = (parseInt(student.nis) + idx) % 3 !== 0; 
        answers[q.id] = isCorrect;

        if (isCorrect) {
          correctCount++;
          if (isLiterasi) literasiCorrect++; else numerasiCorrect++;
        }
     });

     return {
       exam,
       score: (correctCount / exam.questions.length) * 100,
       literasiScore: literasiTotal ? (literasiCorrect / literasiTotal) * 100 : 0,
       numerasiScore: numerasiTotal ? (numerasiCorrect / numerasiTotal) * 100 : 0,
       answers
     };
  });
};

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ student, exams, activeTab, onLogout }) => {
  // --- INTRO FLOW STATE ---
  // 0: Welcome, 2: Rules, 3: Lobby (Dashboard) - Step 1 (Character Select) removed
  const [introStep, setIntroStep] = useState(0); 

  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [menuTab, setMenuTab] = useState<'LOBBY' | 'CAREER'>('LOBBY');
  const [selectedHistory, setSelectedHistory] = useState<any | null>(null);

  // Exam State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [doubts, setDoubts] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false); // New state for confirmation modal
  const [score, setScore] = useState(0);
  
  // Anti-Cheat State
  const [violationCount, setViolationCount] = useState(0);
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [isDisqualified, setIsDisqualified] = useState(false);
  
  // UI State
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const navScrollRef = useRef<HTMLDivElement>(null);

  // Filter exams: Show ALL exams for the student's class, even if time is not valid yet
  const studentExams = exams.filter((e) => {
      const isTargetClass = e.classTarget.includes(student.class);
      const isActiveStatus = e.isActive;
      return isActiveStatus && isTargetClass;
  });

  const historyData = useMemo(() => getMockHistory(student, exams), [student, exams]);

  useEffect(() => {
    if (activeExam && navScrollRef.current) {
        const activeBtn = navScrollRef.current.children[currentQuestionIndex] as HTMLElement;
        if (activeBtn) {
            const scrollLeft = activeBtn.offsetLeft - navScrollRef.current.offsetLeft - (navScrollRef.current.clientWidth / 2) + (activeBtn.clientWidth / 2);
            navScrollRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        }
    }
  }, [currentQuestionIndex, activeExam]);

  useEffect(() => {
    if (activeExam && timeLeft > 0 && !isSubmitted) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleSubmitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [activeExam, timeLeft, isSubmitted]);

  // --- ANTI-CHEAT DETECTION (STRICT) ---
  useEffect(() => {
    if (!activeExam || isSubmitted) return;

    const handleVisibilityChange = () => {
        if (document.hidden) {
            setViolationCount(prev => {
                const newCount = prev + 1;
                
                // Jika sudah 3 kali, langsung Auto Finish & Disqualify
                if (newCount >= 3) {
                    handleSubmitExam(true); 
                    return newCount; 
                } else {
                    // Peringatan ke-1 dan ke-2
                    setShowViolationWarning(true);
                    return newCount;
                }
            });
        }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeExam, isSubmitted]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleStartExam = (exam: Exam) => {
    setActiveExam(exam);
    setTimeLeft(exam.durationMinutes * 60);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setDoubts(new Set());
    setIsSubmitted(false);
    setShowFinishConfirm(false);
    setScore(0);
    setViolationCount(0); // Reset violation
    setIsDisqualified(false);
    setShowViolationWarning(false);
    setIsMobileNavOpen(false);
  };

  const handleSingleChoice = (qId: string, idx: number) => {
    setAnswers(prev => ({ ...prev, [qId]: idx }));
  };

  const handleComplexChoice = (qId: string, idx: number) => {
    const current = (answers[qId] as number[]) || [];
    if (current.includes(idx)) {
      setAnswers(prev => ({ ...prev, [qId]: current.filter(i => i !== idx) }));
    } else {
      setAnswers(prev => ({ ...prev, [qId]: [...current, idx] }));
    }
  };

  const handleMatching = (qId: string, leftItem: string, rightItem: string) => {
      const current = (answers[qId] as Record<string, string>) || {};
      setAnswers(prev => ({ ...prev, [qId]: { ...current, [leftItem]: rightItem } }));
  };

  const toggleDoubt = (qId: string) => {
    const newDoubts = new Set(doubts);
    if (newDoubts.has(qId)) {
      newDoubts.delete(qId);
    } else {
      newDoubts.add(qId);
    }
    setDoubts(newDoubts);
  };

  // --- UPDATED NEXT LOGIC ---
  const handleSaveAndNext = (qId: string) => {
    if (activeExam) {
        if (currentQuestionIndex < activeExam.questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            // Jika soal terakhir, beri peringatan
            alert("Ini adalah soal terakhir. Silahkan di cek jawaban terlebih dahulu sebelum menekan tombol Finish.");
        }
    }
  };

  // --- NEW FINISH BUTTON CLICK ---
  const handleFinishClick = () => {
      setShowFinishConfirm(true);
  };

  const handleSubmitExam = (forceDisqualify = false) => {
    if (!activeExam) return;
    let correctCount = 0;
    activeExam.questions.forEach((q) => {
      const userAnswer = answers[q.id];
      if (q.type === QuestionType.SINGLE) {
        if (userAnswer === q.correctAnswerIndex) correctCount++;
      } 
      else if (q.type === QuestionType.COMPLEX) {
        const userSet = new Set(userAnswer as number[]);
        const correctSet = new Set(q.correctAnswerIndices);
        if (userSet.size === correctSet.size && [...userSet].every(x => correctSet.has(x))) {
            correctCount++;
        }
      } 
      else if (q.type === QuestionType.MATCHING) {
          const userPairs = userAnswer as Record<string, string>;
          if (userPairs && q.matchingPairs) {
             const allCorrect = q.matchingPairs.every(pair => userPairs[pair.left] === pair.right);
             if (allCorrect) correctCount++;
          }
      }
    });
    const calculatedScore = (correctCount / activeExam.questions.length) * 100;
    setScore(calculatedScore);
    setShowFinishConfirm(false);
    
    if (forceDisqualify) {
        setIsDisqualified(true);
        // Force violation count to display max for feedback
        setViolationCount(3);
        setShowViolationWarning(false); 
    }
    
    setIsSubmitted(true);
  };

  // ... (Question Renderers: renderSingleChoice, renderComplexChoice, renderMatching, renderQuestionNavGrid - unchanged)
  // ... (Intro flow renders - unchanged)

  const renderSingleChoice = (q: Question) => (
    <div className="space-y-4">
      {q.options?.map((option, idx) => {
        const isSelected = answers[q.id] === idx;
        return (
          <button
            key={idx}
            onClick={() => handleSingleChoice(q.id, idx)}
            className={`w-full text-left p-4 md:p-5 relative overflow-hidden transition-all duration-200 flex items-center group clip-path-polygon
            ${isSelected 
                ? 'bg-yellow-500/20 border-l-4 border-yellow-400' 
                : 'bg-slate-800/50 border-l-4 border-slate-600 hover:bg-slate-700/50 hover:border-yellow-600'
            }`}
            style={{ clipPath: 'polygon(0 0, 100% 0, 98% 100%, 0% 100%)' }}
          >
            <div className={`w-10 h-10 flex items-center justify-center mr-5 font-bold font-mono text-lg transition-colors border-2 transform -skew-x-12 ${
                isSelected ? 'bg-yellow-500 border-yellow-400 text-black' : 'bg-transparent border-slate-500 text-slate-400 group-hover:border-yellow-500 group-hover:text-yellow-500'
            }`}>
              <span className="transform skew-x-12">{String.fromCharCode(65 + idx)}</span>
            </div>
            <span className={`text-lg font-medium tracking-wide ${isSelected ? 'text-yellow-400' : 'text-slate-300 group-hover:text-white'}`}>
                {option}
            </span>
            {isSelected && <div className="absolute right-0 top-0 bottom-0 w-2 bg-gradient-to-l from-yellow-500/50 to-transparent"></div>}
          </button>
        )
      })}
    </div>
  );

  const renderComplexChoice = (q: Question) => {
    const neededAnswers = q.correctAnswerIndices?.length || 0;
    const currentSelected = (answers[q.id] as number[])?.length || 0;
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2 bg-slate-800/80 p-2 rounded border-l-4 border-blue-500 w-fit">
                <span className="text-sm font-bold text-blue-400 uppercase tracking-wider">
                    Pilihan Ganda Kompleks
                </span>
                <span className="text-xs font-black bg-blue-600 text-white px-2 py-0.5 rounded ml-2">
                    Pilih {neededAnswers} Jawaban Benar
                </span>
            </div>
            {q.options?.map((option, idx) => {
                const isSelected = (answers[q.id] as number[])?.includes(idx);
                return (
                    <button
                    key={idx}
                    onClick={() => handleComplexChoice(q.id, idx)}
                    className={`w-full text-left p-4 md:p-5 relative transition-all duration-200 flex items-center group
                    ${isSelected 
                        ? 'bg-blue-900/30 border border-blue-500' 
                        : 'bg-slate-800/50 border border-slate-700 hover:border-blue-400'
                    }`}
                    >
                    <div className={`w-6 h-6 border-2 mr-5 flex items-center justify-center transition-all ${
                        isSelected ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-500 bg-transparent group-hover:border-blue-400'
                    }`}>
                        {isSelected && <Check size={16} strokeWidth={4} />}
                    </div>
                    <span className={`text-lg font-medium ${isSelected ? 'text-blue-200' : 'text-slate-300 group-hover:text-white'}`}>
                        {option}
                    </span>
                    </button>
                );
            })}
        </div>
    );
  };

  const renderMatching = (q: Question) => {
      const col1Label = q.options?.[0] || 'Benar';
      const col2Label = q.options?.[1] || 'Salah';
      const userPairs = (answers[q.id] as Record<string, string>) || {};
      return (
        <div className="space-y-4">
             <div className="flex items-center gap-2 mb-2 bg-slate-800/80 p-2 rounded border-l-4 border-orange-500 w-fit">
                 <span className="text-sm font-bold text-orange-400 uppercase tracking-wider">Benar / Salah</span>
             </div>
             <div className="overflow-hidden rounded-lg border border-slate-700">
                 <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-800 text-xs uppercase font-bold text-slate-400">
                        <tr>
                            <th className="px-4 py-3 border-b border-slate-700 w-12 text-center">No</th>
                            <th className="px-4 py-3 border-b border-slate-700">Pernyataan</th>
                            <th className="px-4 py-3 border-b border-slate-700 w-24 text-center bg-emerald-900/20 text-emerald-400">{col1Label}</th>
                            <th className="px-4 py-3 border-b border-slate-700 w-24 text-center bg-red-900/20 text-red-400">{col2Label}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700 bg-slate-900/30">
                        {q.matchingPairs?.map((pair, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                                <td className="px-4 py-3 text-center font-mono text-slate-500">{idx + 1}</td>
                                <td className="px-4 py-3 font-medium text-slate-200">{pair.left}</td>
                                <td className="px-4 py-3 text-center bg-emerald-900/10">
                                    <label className="flex items-center justify-center w-full h-full cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name={`q-${q.id}-row-${idx}`}
                                            className="w-5 h-5 accent-emerald-500 cursor-pointer"
                                            checked={userPairs[pair.left] === col1Label}
                                            onChange={() => handleMatching(q.id, pair.left, col1Label)}
                                        />
                                    </label>
                                </td>
                                <td className="px-4 py-3 text-center bg-red-900/10">
                                    <label className="flex items-center justify-center w-full h-full cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name={`q-${q.id}-row-${idx}`}
                                            className="w-5 h-5 accent-red-500 cursor-pointer"
                                            checked={userPairs[pair.left] === col2Label}
                                            onChange={() => handleMatching(q.id, pair.left, col2Label)}
                                        />
                                    </label>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
             </div>
        </div>
      );
  };

  const renderQuestionNavGrid = () => (
     <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
      {activeExam?.questions.map((q, idx) => {
          const hasAns = answers[q.id] !== undefined;
          const isMarkedDoubt = doubts.has(q.id);
          let btnClass = 'bg-slate-800/50 text-slate-500 border border-slate-700'; 
          if (idx === currentQuestionIndex) btnClass = 'bg-yellow-500 text-black border-yellow-400 font-black scale-110 z-10';
          else if (isMarkedDoubt) btnClass = 'bg-orange-600 text-white border-orange-500 font-bold';
          else if (hasAns) btnClass = 'bg-emerald-600 text-white border-emerald-500 font-bold';
          return (
            <button 
              key={q.id} 
              onClick={() => { setCurrentQuestionIndex(idx); setIsMobileNavOpen(false); }} 
              className={`aspect-square flex items-center justify-center text-xs transition-all clip-path-polygon ${btnClass}`} 
              style={{ clipPath: 'polygon(15% 0, 100% 0, 100% 85%, 85% 100%, 0 100%, 0 15%)' }}
            >
              {idx + 1}
            </button>
          )
      })}
    </div>
  );

  // --- RENDER LOGIC ---
  
  if (introStep === 0) { /* Welcome Screen Code */
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 bg-[url('https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center relative overflow-hidden font-sans text-white">
              <style>{`
                @keyframes fadeInUp {
                  from { opacity: 0; transform: translateY(20px); }
                  to { opacity: 1; transform: translateY(0); }
                }
                @keyframes float {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-10px); }
                }
                .animate-fade-in-up { animation: fadeInUp 0.8s ease-out forwards; }
                .animate-float { animation: float 3s ease-in-out infinite; }
                .animate-delay-200 { animation-delay: 0.2s; }
                .animate-delay-400 { animation-delay: 0.4s; }
              `}</style>
              <div className="absolute inset-0 bg-black/80"></div>
              <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-yellow-500/10 rounded-full blur-[100px] animate-pulse"></div>
              <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] animate-pulse animation-delay-500"></div>

              <div className="relative z-10 text-center p-6 flex flex-col items-center">
                   <div className="mb-6 inline-block animate-float">
                        <img src="https://image2url.com/r2/default/images/1769001049680-d981c280-6340-4989-8563-7b08134c189a.png" alt="Logo" className="h-32 md:h-40 mx-auto drop-shadow-[0_0_25px_rgba(234,179,8,0.8)]" />
                   </div>
                   <div className="space-y-2 mb-10">
                      <h1 className="text-5xl md:text-7xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 tracking-tighter drop-shadow-lg uppercase animate-fade-in-up">Selamat Datang</h1>
                      <h2 className="text-3xl md:text-5xl font-black text-white tracking-widest uppercase animate-fade-in-up animate-delay-200">{student.name}</h2>
                      <div className="h-1 w-24 bg-yellow-500 mx-auto mt-4 rounded-full animate-fade-in-up animate-delay-200"></div>
                   </div>
                   <p className="text-slate-400 text-lg md:text-xl font-mono uppercase tracking-[0.3em] mb-12 animate-fade-in-up animate-delay-400">CBT Battle Arena • SMPN 3 Pacet</p>
                   {/* CHANGED: setIntroStep(1) to setIntroStep(2) to skip character selection */}
                   <button onClick={() => setIntroStep(2)} className="group relative px-12 py-5 bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-black text-xl uppercase tracking-widest hover:from-yellow-500 hover:to-yellow-400 transform hover:scale-105 transition-all skew-x-[-12deg] shadow-[0_0_30px_rgba(234,179,8,0.4)] animate-fade-in-up animate-delay-400">
                       <span className="skew-x-[12deg] inline-block flex items-center gap-3">Mulai Misi <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform"/></span>
                   </button>
              </div>
          </div>
      );
  }

  // INTRO STEP 1 (CHARACTER SELECTION) REMOVED

  if (introStep === 2) { /* Rules Screen Code */
      return (
          <div className="h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden text-white">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
              <div className="max-w-3xl w-full bg-slate-900/90 border border-white/10 p-8 md:p-12 relative shadow-2xl backdrop-blur-sm">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent"></div>
                  <h2 className="text-3xl font-black text-white mb-8 text-center uppercase tracking-widest flex items-center justify-center gap-3"><AlertCircle className="text-yellow-500" /> Aturan Pertempuran</h2>
                  <div className="space-y-4 mb-8 text-slate-300 font-medium">
                      <div className="flex gap-4 items-start"><span className="bg-slate-800 text-yellow-500 font-bold w-8 h-8 flex items-center justify-center rounded-sm shrink-0">1</span><p>Waktu ujian berjalan mundur. Jika waktu habis, jawaban tersimpan otomatis.</p></div>
                      <div className="flex gap-4 items-start"><span className="bg-slate-800 text-yellow-500 font-bold w-8 h-8 flex items-center justify-center rounded-sm shrink-0">2</span><p>Pilih jawaban dengan hati-hati. Gunakan tombol "Ragu-ragu" (Flag) untuk menandai soal yang ingin diperiksa ulang.</p></div>
                      <div className="flex gap-4 items-start"><span className="bg-slate-800 text-yellow-500 font-bold w-8 h-8 flex items-center justify-center rounded-sm shrink-0">3</span><p>Dilarang melakukan kecurangan (Pindah Tab/Minimize). Anda memiliki 3 nyawa. Jika habis, Anda akan tereliminasi (Diskualifikasi).</p></div>
                      <div className="flex gap-4 items-start"><span className="bg-slate-800 text-yellow-500 font-bold w-8 h-8 flex items-center justify-center rounded-sm shrink-0">4</span><p>Klik tombol "Finish" hanya jika Anda yakin telah menyelesaikan semua soal.</p></div>
                  </div>
                  <button onClick={() => setIntroStep(3)} className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black text-xl uppercase tracking-[0.2em] shadow-lg transition-transform active:scale-95">Masuk ke Lobby</button>
              </div>
          </div>
      );
  }

  // 1. RESULT SCREEN (Victory/Booyah/Eliminated)
  if (isSubmitted && activeExam) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/80"></div>
          <div className={`relative border-2 p-1 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-bounce-in max-w-lg w-full mx-4 ${isDisqualified ? 'bg-red-900/40 border-red-500' : 'bg-black/80 border-yellow-500'}`}>
             <div className="bg-slate-900/90 rounded-[20px] p-8 text-center border border-white/10 overflow-hidden relative">
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent to-transparent ${isDisqualified ? 'via-red-500' : 'via-yellow-500'}`}></div>
                <div className="mb-6 flex justify-center">
                    {isDisqualified ? (
                        <AlertOctagon size={80} className="text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]" />
                    ) : (
                        <Trophy size={80} className="text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]" />
                    )}
                </div>
                <h2 className={`text-4xl font-black italic tracking-tighter mb-2 drop-shadow-md uppercase ${isDisqualified ? 'text-red-500' : 'text-yellow-500'}`}>
                    {isDisqualified ? 'ELIMINATED!' : 'BOOYAH!'}
                </h2>
                <p className="text-slate-400 font-mono uppercase tracking-widest mb-8 text-sm">
                    {isDisqualified ? 'Kecurangan Terdeteksi' : 'Mission Completed'}
                </p>
                
                {isDisqualified && (
                    <div className="bg-red-900/30 border border-red-500 p-4 rounded mb-6 text-sm text-red-200">
                        Anda telah didiskualifikasi karena terdeteksi keluar dari ujian sebanyak 3 kali. Skor Anda dikunci berdasarkan jawaban terakhir.
                    </div>
                )}

                <div className="bg-slate-800/50 p-6 rounded-xl mb-8 border border-slate-700 relative">
                  <div className={`absolute -top-3 left-1/2 transform -translate-x-1/2 bg-slate-900 px-4 text-xs font-bold uppercase tracking-widest border ${isDisqualified ? 'text-red-500 border-red-900' : 'text-yellow-500 border-slate-700'}`}>
                      Final Score
                  </div>
                  <p className="text-7xl font-black text-white tracking-tighter">{Math.round(score)}</p>
                </div>
                <button 
                    onClick={() => { setActiveExam(null); setIsSubmitted(false); setMenuTab('CAREER'); }} 
                    className={`w-full py-4 rounded-lg font-black text-lg uppercase tracking-widest transition transform hover:scale-105 shadow-lg clip-path-button ${isDisqualified ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-yellow-500 hover:bg-yellow-400 text-black'}`}
                >
                  Return to Lobby
                </button>
             </div>
          </div>
        </div>
      );
  }

  // 2. ACTIVE EXAM INTERFACE
  if (activeExam) {
    const currentQuestion = activeExam.questions[currentQuestionIndex];
    const isDoubt = doubts.has(currentQuestion.id);

    return (
      <div className="h-screen flex flex-col bg-slate-950 text-white font-sans overflow-hidden relative">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/90 to-black/90 pointer-events-none"></div>

        {/* --- VIOLATION WARNING MODAL (STRICT RED) --- */}
        {showViolationWarning && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-red-900/60 backdrop-blur-md animate-pulse">
                <div className="bg-black border-4 border-red-600 w-full max-w-lg p-1 relative shadow-[0_0_50px_rgba(220,38,38,0.8)] transform scale-105">
                    <div className="bg-slate-900 p-8 text-center border border-white/10">
                         <AlertTriangle size={64} className="text-red-500 mx-auto mb-4 animate-bounce"/>
                         <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">Peringatan Keras!</h2>
                         <p className="text-red-500 font-bold text-lg mb-6 uppercase tracking-wide border-b border-red-500 pb-2 inline-block">
                             Dilarang Keluar dari Aplikasi
                         </p>
                         <div className="flex justify-center gap-4 mb-8">
                             {[1, 2, 3].map(i => (
                                 <div key={i} className={`w-12 h-12 flex items-center justify-center border-2 font-black text-xl transform rotate-45 transition-all duration-300 ${i <= violationCount ? 'bg-red-600 border-red-500 text-white scale-110 shadow-lg shadow-red-500/50' : 'bg-slate-800 border-slate-700 text-slate-600'}`}>
                                     <span className="transform -rotate-45">{i <= violationCount ? '!' : i}</span>
                                 </div>
                             ))}
                         </div>
                         <div className="bg-red-950/50 p-4 rounded border border-red-900 mb-6">
                             <p className="text-red-300 text-sm font-bold">
                                 Pelanggaran ke-{violationCount} dari 3. <br/>
                                 Jika mencapai 3 kali, ujian akan dihentikan otomatis (DISKUALIFIKASI).
                             </p>
                         </div>
                         <button 
                            onClick={() => setShowViolationWarning(false)}
                            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-xl shadow-lg transition-transform active:scale-95"
                         >
                             Saya Mengerti & Kembali
                         </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- CONFIRMATION MODAL --- */}
        {showFinishConfirm && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in p-4">
                <div className="bg-slate-900 border-2 border-red-500 w-full max-w-md relative shadow-[0_0_30px_rgba(239,68,68,0.4)]">
                    <div className="bg-red-600 text-white font-black uppercase py-2 px-4 flex items-center gap-2 tracking-widest">
                        <AlertTriangle size={20}/> Warning
                    </div>
                    <div className="p-8 text-center">
                        <h3 className="text-2xl font-black text-white uppercase italic tracking-wide mb-2">Mengakhiri Ujian?</h3>
                        <p className="text-slate-400 mb-8">Pastikan Anda telah memeriksa semua jawaban. Aksi ini tidak dapat dibatalkan.</p>
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => setShowFinishConfirm(false)}
                                className="py-3 border border-slate-600 text-slate-300 font-bold uppercase hover:bg-slate-800"
                            >
                                Periksa Lagi
                            </button>
                            <button 
                                onClick={() => handleSubmitExam(false)}
                                className="py-3 bg-red-600 text-white font-black uppercase hover:bg-red-500 shadow-lg"
                            >
                                Ya, Akhiri
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* HUD Header */}
        <div className="relative z-20 bg-black/60 backdrop-blur-md border-b border-yellow-600/30 px-4 md:px-8 py-3 flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileNavOpen(!isMobileNavOpen)} className="lg:hidden p-2 text-yellow-500 border border-yellow-500 rounded-lg bg-slate-900/50 hover:bg-slate-800 transition">
               {isMobileNavOpen ? <X size={20} /> : <Grid size={20} />}
            </button>
            <div className="bg-yellow-500 text-black font-black italic px-3 py-1 -skew-x-12 text-sm md:text-base hidden sm:block">
                <span className="skew-x-12 block">FF-EXAM</span>
            </div>
            <div className="block">
                <h1 className="font-bold text-sm md:text-lg text-slate-200 tracking-wide uppercase truncate max-w-[150px] md:max-w-xs">{activeExam.title}</h1>
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4">
             {/* Violation Indicator */}
             <div className="hidden md:flex items-center gap-1 bg-black/40 px-3 py-1.5 border border-red-500/30 rounded">
                 <ShieldIcon size={16} className={violationCount > 0 ? "text-red-500 animate-pulse" : "text-green-500"} />
                 <span className="text-xs font-bold text-slate-400">STATUS:</span>
                 <span className={`text-xs font-black ${violationCount > 0 ? "text-red-500" : "text-green-500"}`}>
                     {violationCount === 0 ? "SECURE" : `WARNING ${violationCount}/3`}
                 </span>
             </div>

            <div className={`flex items-center space-x-2 px-2 md:px-4 py-1.5 border-2 transform -skew-x-12 ${timeLeft < 300 ? 'bg-red-900/50 border-red-500 text-red-500' : 'bg-slate-900/50 border-yellow-500 text-yellow-500'}`}>
              <Clock size={16} className="skew-x-12" />
              <span className="font-mono font-bold text-lg md:text-xl skew-x-12 tracking-widest">{formatTime(timeLeft)}</span>
            </div>
            <button onClick={handleFinishClick} className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-3 md:px-6 py-2 hover:from-orange-500 font-black uppercase tracking-wider transform -skew-x-12 flex items-center gap-2 border border-white/20 text-xs md:text-base">
              <span className="skew-x-12 flex items-center gap-2">Finish <Shield size={16}/></span>
            </button>
          </div>
        </div>

        {/* ... (Rest of the Navigation and Questions UI remains mostly identical) ... */}
        {/* Skipping repetitive UI code for brevity while maintaining the core logic changes above */}
        
        {/* --- NEW: Horizontal Navigation Strip (Mobile Only) --- */}
        <div className="lg:hidden w-full bg-slate-900 border-b border-white/10 z-10 flex items-center">
            <div ref={navScrollRef} className="flex-1 flex overflow-x-auto gap-2 p-2 custom-scrollbar scroll-smooth snap-x">
              {activeExam.questions.map((q, idx) => {
                 const hasAns = answers[q.id] !== undefined;
                 const isMarkedDoubt = doubts.has(q.id);
                 const isActive = idx === currentQuestionIndex;
                 let bgClass = "bg-slate-800 border-slate-700 text-slate-400";
                 if (isActive) bgClass = "bg-white text-black border-white shadow-[0_0_10px_rgba(255,255,255,0.5)] scale-110";
                 else if (isMarkedDoubt) bgClass = "bg-orange-600 border-orange-500 text-white";
                 else if (hasAns) bgClass = "bg-emerald-600 border-emerald-500 text-white";
                 return (
                   <button key={q.id} onClick={() => setCurrentQuestionIndex(idx)} className={`flex-none w-10 h-10 rounded-lg border-2 flex items-center justify-center font-bold text-sm transition-all snap-center ${bgClass}`}>
                     {idx + 1}
                     {isMarkedDoubt && !isActive && <div className="absolute top-0 right-0 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />}
                   </button>
                 );
              })}
            </div>
            <div className="px-2 bg-slate-900 shadow-[-10px_0_10px_rgba(0,0,0,0.5)] z-20 h-full flex items-center border-l border-white/10">
                <span className="text-[10px] text-slate-500 font-mono uppercase text-center block leading-tight">
                  <span className="text-white block font-bold">{currentQuestionIndex + 1}</span> of {activeExam.questions.length}
                </span>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden relative z-10">
          <div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">
            <div className="max-w-5xl mx-auto">
              <div className="bg-slate-900/80 backdrop-blur-md p-6 md:p-10 rounded-none border-t-2 border-yellow-500 shadow-2xl min-h-[500px] flex flex-col relative">
                <div className="flex justify-between items-start mb-8 border-b border-slate-700 pb-4">
                  <div className="flex items-center gap-3">
                      <span className="bg-yellow-500 text-black px-3 py-1 text-sm font-black uppercase transform -skew-x-12"><span className="skew-x-12">Question {currentQuestionIndex + 1}</span></span>
                      {isDoubt && (<span className="bg-orange-600 text-white px-2 py-1 text-xs font-bold uppercase rounded flex items-center gap-1"><Flag size={12} fill="currentColor" /> Ragu-ragu</span>)}
                  </div>
                  <Crosshair size={24} className="text-yellow-500/50" />
                </div>
                {currentQuestion.stimulus && (
                   <div className="mb-8 p-6 bg-emerald-900/20 border border-emerald-500/30 rounded-sm relative">
                      <div className="absolute top-0 left-0 bg-emerald-600 text-black text-[10px] font-black px-2 py-0.5 uppercase tracking-widest">INTEL</div>
                      <p className="text-emerald-100/90 leading-relaxed text-lg mt-2 font-medium whitespace-pre-wrap">{currentQuestion.stimulus}</p>
                   </div>
                )}
                {currentQuestion.image && (
                   <div className="w-full mb-8 flex flex-col items-center bg-slate-900/50 p-4 rounded-xl border border-slate-700 relative group">
                      <div className="absolute top-4 left-4 flex items-center gap-2">
                         <div className="bg-slate-800 p-1.5 rounded-md text-slate-400"><ImageIcon size={16} /></div>
                         <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Visual Data</p>
                      </div>
                      <img src={currentQuestion.image} alt="Lampiran Soal" className="max-w-full h-auto max-h-[400px] object-contain rounded-lg shadow-lg border border-slate-600 mt-8 md:mt-0" />
                   </div>
                )}
                <p className="text-2xl md:text-3xl text-white leading-relaxed mb-10 font-bold drop-shadow-sm whitespace-pre-wrap">{currentQuestion.text}</p>
                <div className="mb-6 flex-1">
                  {currentQuestion.type === QuestionType.SINGLE && renderSingleChoice(currentQuestion)}
                  {currentQuestion.type === QuestionType.COMPLEX && renderComplexChoice(currentQuestion)}
                  {currentQuestion.type === QuestionType.MATCHING && renderMatching(currentQuestion)}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 md:gap-8 mt-6">
                <button onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))} disabled={currentQuestionIndex === 0} className="group flex items-center justify-center space-x-2 px-6 py-4 bg-slate-800 border-b-4 border-slate-950 text-slate-300 hover:bg-slate-700 font-bold uppercase">
                  <ChevronLeft size={20} /> <span>Prev</span>
                </button>
                <button onClick={() => toggleDoubt(currentQuestion.id)} className={`flex items-center justify-center space-x-2 px-6 py-4 border-b-4 font-bold uppercase transition-all ${isDoubt ? 'bg-orange-600 text-white border-orange-800' : 'bg-slate-800 text-yellow-500 border-slate-950'}`}>
                  <Flag size={20} fill={isDoubt ? "currentColor" : "none"} /> <span>{isDoubt ? 'Ragu' : 'Mark'}</span>
                </button>
                <button onClick={() => handleSaveAndNext(currentQuestion.id)} className="group flex items-center justify-center space-x-2 px-6 py-4 bg-yellow-600 border-b-4 border-yellow-800 text-black hover:bg-yellow-500 font-black uppercase">
                  <span>Next</span> <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="w-72 bg-black/80 backdrop-blur border-l border-white/10 p-4 overflow-y-auto hidden lg:block">
            <div className="mb-6 pb-4 border-b border-white/10">
                <h3 className="font-bold text-yellow-500 mb-2 flex items-center gap-2 uppercase tracking-widest text-sm"><Map size={16}/> Tactical Map</h3>
                {violationCount > 0 && (
                   <div className="bg-red-900/20 border border-red-500/50 p-2 rounded mt-2 animate-pulse">
                       <p className="text-xs text-red-400 font-bold uppercase text-center flex items-center justify-center gap-1"><AlertTriangle size={12}/> Security Alert</p>
                       <div className="flex justify-center gap-2 mt-2">
                          {[1,2,3].map(i => (
                              <div key={i} className={`w-3 h-3 rounded-sm transform rotate-45 border ${i <= violationCount ? 'bg-red-500 border-red-400' : 'bg-slate-800 border-slate-600'}`}></div>
                          ))}
                       </div>
                   </div>
                )}
            </div>
            {renderQuestionNavGrid()}
          </div>
          
          {isMobileNavOpen && (
            <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-xl p-6 lg:hidden flex flex-col animate-fade-in">
              <div className="flex justify-between items-center mb-8 border-b border-white/20 pb-4">
                 <h3 className="font-bold text-yellow-500 text-lg uppercase tracking-widest flex items-center gap-2"><Map size={20}/> Tactical Map</h3>
                 <button onClick={() => setIsMobileNavOpen(false)} className="p-2 bg-slate-800 rounded-full text-white hover:bg-red-600 transition"><X size={24}/></button>
              </div>
              <div className="overflow-y-auto flex-1">
                 {renderQuestionNavGrid()}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. DASHBOARD (LOBBY & CAREER) - Main Layout
  return (
    <div className="h-full flex flex-col md:flex-row bg-slate-950 text-white font-sans relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center opacity-20 pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/90 via-slate-900/80 to-black/95 pointer-events-none"></div>
        
        {/* UPDATED: Changed md:h-screen to md:h-full to ensure it fits the parent container */}
        <div className="md:w-20 md:flex-col flex-row flex md:border-r border-t md:border-t-0 border-white/10 bg-black/60 backdrop-blur-md z-30 fixed bottom-0 w-full md:sticky md:top-0 md:h-full justify-around md:justify-start items-center md:pt-6 pb-safe">
             <div className="hidden md:flex mb-8 w-14 h-14 bg-black/50 rounded-lg items-center justify-center transform -skew-x-12 mx-auto border border-white/10">
                 <img src="https://image2url.com/r2/default/images/1769001049680-d981c280-6340-4989-8563-7b08134c189a.png" alt="Logo" className="h-10 w-10 object-contain skew-x-12" />
             </div>
             <button onClick={() => { setMenuTab('LOBBY'); setSelectedHistory(null); }} className={`p-3 rounded-xl flex flex-col items-center gap-1 transition-all ${menuTab === 'LOBBY' ? 'text-yellow-500 bg-white/10' : 'text-slate-500 hover:text-white'}`}>
                <Home size={24} /><span className="text-[10px] uppercase font-bold md:hidden">Lobby</span>
             </button>
             <button onClick={() => setMenuTab('CAREER')} className={`p-3 rounded-xl flex flex-col items-center gap-1 transition-all mt-0 md:mt-4 ${menuTab === 'CAREER' ? 'text-yellow-500 bg-white/10' : 'text-slate-500 hover:text-white'}`}>
                <Trophy size={24} /><span className="text-[10px] uppercase font-bold md:hidden">Career</span>
             </button>
             <div className="flex-1 hidden md:block"></div>
             <button onClick={onLogout} className="p-3 rounded-xl flex flex-col items-center gap-1 text-red-500 hover:bg-red-500/10 transition-all mb-0 md:mb-6">
                <LogOut size={24} /><span className="text-[10px] uppercase font-bold md:hidden">Exit</span>
             </button>
        </div>

        <div className="flex-1 flex flex-col h-full overflow-hidden pb-16 md:pb-0 relative">
            <div className="md:hidden flex items-center justify-between p-4 border-b border-white/10 bg-black/40 backdrop-blur-sm sticky top-0 z-20">
                 <div className="flex items-center gap-2">
                     <img src="https://image2url.com/r2/default/images/1769001049680-d981c280-6340-4989-8563-7b08134c189a.png" alt="Logo" className="h-8 object-contain" />
                     <span className="font-black italic text-white uppercase ml-2">{menuTab}</span>
                 </div>
                 <div className="text-xs text-yellow-500 font-mono">{student.name.split(' ')[0]}</div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                {menuTab === 'LOBBY' && (
                    <div className="max-w-6xl mx-auto">
                        <div className="hidden md:flex justify-between items-end mb-8">
                             <div>
                                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Mission Lobby</h2>
                                <p className="text-slate-400">Select your active mission</p>
                             </div>
                             <div className="text-right">
                                 <p className="text-yellow-500 font-mono text-sm">OPERATOR: {student.name}</p>
                                 <p className="text-slate-500 text-xs">CLASS: {student.class}</p>
                             </div>
                        </div>
                        {studentExams.length === 0 ? (
                            <div className="border border-slate-700 bg-slate-900/50 p-10 text-center rounded-xl mt-10">
                                <Target size={48} className="mx-auto text-slate-600 mb-4"/>
                                <p className="text-slate-500 text-lg uppercase tracking-wide">No Active Missions</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 pb-20">
                                {studentExams.map(exam => {
                                    const now = new Date();
                                    const start = new Date(exam.scheduledStart);
                                    const end = new Date(exam.scheduledEnd);
                                    const isTimeValid = now >= start && now <= end;
                                    const isEnded = now > end;
                                    return (
                                        <div key={exam.id} className={`group relative bg-slate-900 border border-slate-700 transition-all duration-300 rounded-xl overflow-hidden shadow-lg ${isTimeValid ? 'hover:border-yellow-500' : 'opacity-75 grayscale'}`}>
                                            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-yellow-500/10 to-transparent pointer-events-none"></div>
                                            <div className="p-5">
                                                <div className="flex justify-between items-start mb-3">
                                                    <span className="bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded">Ranked</span>
                                                    <Clock size={14} className="text-slate-500"/>
                                                </div>
                                                <h3 className="text-lg font-black text-white uppercase italic tracking-wide mb-1 leading-tight group-hover:text-yellow-400 transition-colors">{exam.title}</h3>
                                                <p className="text-xs text-slate-500 mb-4">{start.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</p>
                                                <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mb-4 border-t border-white/5 pt-3">
                                                    <span className="flex items-center gap-1"><Target size={12}/> {exam.questions.length} Qs</span>
                                                    <span className="flex items-center gap-1"><Clock size={12}/> {exam.durationMinutes}m</span>
                                                </div>
                                                {isTimeValid ? (
                                                    <button onClick={() => handleStartExam(exam)} className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 text-black font-black uppercase tracking-widest text-xs rounded transition-all active:scale-95 shadow-md flex items-center justify-center gap-2">Start Mission <ChevronRight size={14}/></button>
                                                ) : (
                                                    <button disabled className="w-full py-3 bg-slate-800 text-slate-500 font-black uppercase tracking-widest text-xs rounded flex items-center justify-center gap-2 cursor-not-allowed">{isEnded ? 'Mission Ended' : 'Coming Soon'}</button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
                {menuTab === 'CAREER' && (
                     <div className="max-w-7xl mx-auto h-full pb-20">
                        <div className="hidden md:block mb-8">
                            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Service Record</h2>
                            <p className="text-slate-400">Battle history and performance stats</p>
                        </div>
                        <div className="flex flex-col lg:flex-row gap-6 h-full">
                            <div className={`${selectedHistory ? 'hidden lg:block lg:w-1/3' : 'w-full'} transition-all`}>
                                <div className="space-y-3">
                                    {historyData.map((item: any, idx: number) => (
                                        <div key={idx} onClick={() => setSelectedHistory(item)} className={`p-4 border rounded-xl cursor-pointer transition-all relative overflow-hidden ${selectedHistory === item ? 'bg-yellow-500/10 border-yellow-500' : 'bg-slate-900 border-slate-700 hover:bg-slate-800'}`}>
                                            <div className="flex justify-between items-center relative z-10">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs border ${item.score >= 75 ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-slate-700 text-white border-slate-600'}`}>{Math.round(item.score)}</div>
                                                    <div>
                                                        <h4 className={`font-bold text-sm uppercase ${selectedHistory === item ? 'text-yellow-400' : 'text-slate-200'}`}>{item.exam.title}</h4>
                                                        <div className="flex gap-2 mt-1">
                                                            <span className="text-[10px] px-1 bg-purple-900/50 text-purple-300 rounded border border-purple-500/30">L: {Math.round(item.literasiScore)}</span>
                                                            <span className="text-[10px] px-1 bg-orange-900/50 text-orange-300 rounded border border-orange-500/30">N: {Math.round(item.numerasiScore)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <ChevronRight size={18} className="text-slate-500"/>
                                            </div>
                                        </div>
                                    ))}
                                    {historyData.length === 0 && <div className="text-center p-8 text-slate-500 italic border border-dashed border-slate-700 rounded-xl">No battle history found.</div>}
                                </div>
                            </div>
                            {selectedHistory && (
                                <div className="flex-1 bg-slate-900/90 border border-slate-700 rounded-xl overflow-hidden flex flex-col animate-fade-in shadow-2xl relative">
                                     <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
                                         <h3 className="font-bold text-white uppercase text-sm tracking-widest flex items-center gap-2"><BarChart2 size={16} className="text-yellow-500"/> Performance Report</h3>
                                         <button onClick={() => setSelectedHistory(null)} className="lg:hidden p-1 bg-slate-800 rounded-full text-white"><X size={16}/></button>
                                     </div>
                                     <div className="p-6 overflow-y-auto custom-scrollbar">
                                         <div className="text-center mb-8">
                                             <div className="inline-block relative">
                                                 <Trophy size={64} className="text-yellow-500/20 absolute -top-2 left-1/2 -translate-x-1/2 scale-150"/>
                                                 <h1 className="text-6xl font-black text-white relative z-10 drop-shadow-lg">{Math.round(selectedHistory.score)}</h1>
                                             </div>
                                             <p className="text-xs text-slate-400 uppercase tracking-widest mt-2">Total Score</p>
                                         </div>
                                         <div className="grid grid-cols-2 gap-4 mb-8">
                                             <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 text-center">
                                                 <p className="text-xs text-purple-400 uppercase font-bold mb-1">Literasi</p>
                                                 <p className="text-2xl font-black text-white">{Math.round(selectedHistory.literasiScore)}%</p>
                                             </div>
                                             <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 text-center">
                                                 <p className="text-xs text-orange-400 uppercase font-bold mb-1">Numerasi</p>
                                                 <p className="text-2xl font-black text-white">{Math.round(selectedHistory.numerasiScore)}%</p>
                                             </div>
                                         </div>
                                         <h4 className="text-xs text-slate-500 font-bold uppercase mb-4 border-b border-slate-800 pb-2">Question Analysis</h4>
                                         <div className="space-y-2">
                                             {selectedHistory.exam.questions.map((q: Question, qIdx: number) => {
                                                 const isCorrect = selectedHistory.answers[q.id];
                                                 return (
                                                     <div key={q.id} className="flex items-start gap-3 p-3 rounded bg-black/20 border border-slate-800/50">
                                                         <div className={`mt-0.5 w-5 h-5 flex-none rounded flex items-center justify-center text-[10px] font-bold ${isCorrect ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'}`}>{isCorrect ? <Check size={12}/> : <X size={12}/>}</div>
                                                         <div className="flex-1 min-w-0">
                                                             <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{q.text}</p>
                                                             <div className="flex gap-2 mt-1"><span className="text-[9px] text-slate-500 uppercase font-mono">#{qIdx + 1}</span><span className={`text-[9px] uppercase px-1 rounded ${q.category === QuestionCategory.NUMERASI ? 'text-orange-400 bg-orange-900/20' : 'text-purple-400 bg-purple-900/20'}`}>{q.category || 'General'}</span></div>
                                                         </div>
                                                     </div>
                                                 )
                                             })}
                                         </div>
                                     </div>
                                </div>
                            )}
                        </div>
                     </div>
                )}
            </div>
        </div>
    </div>
  );
};