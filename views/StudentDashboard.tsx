import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Student, Exam, Question, QuestionType, QuestionCategory, ExamResult } from '../types';
import { Clock, CheckCircle, AlertCircle, FileText, ChevronRight, ChevronLeft, Save, HelpCircle, Layout, Check, Crosshair, Map, Shield, Trophy, BarChart2, Target, XCircle, Grid, X, Menu, LogOut, Home, Flag, ImageIcon, User, AlertTriangle, Zap, Heart, Shield as ShieldIcon, AlertOctagon, Lock, Square, Calendar, Archive, ChevronUp, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface StudentDashboardProps {
  student: Student;
  exams: Exam[];
  activeTab: string;
  onLogout?: () => void;
  examResults: ExamResult[]; 
  onSaveResult: (result: ExamResult) => void; 
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ student, exams, activeTab, onLogout, examResults, onSaveResult }) => {
  const [introStep, setIntroStep] = useState(0); 

  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  // NEW: State for randomized questions
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
  
  const [menuTab, setMenuTab] = useState<'LOBBY' | 'CAREER'>('LOBBY');
  const [selectedHistory, setSelectedHistory] = useState<ExamResult | null>(null);

  // Exam State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [doubts, setDoubts] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [score, setScore] = useState(0);
  
  // Anti-Cheat State
  const [violationCount, setViolationCount] = useState(0);
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [isDisqualified, setIsDisqualified] = useState(false);
  
  // UI State
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const navScrollRef = useRef<HTMLDivElement>(null);
  const questionContainerRef = useRef<HTMLDivElement>(null); // Ref for scrolling question content

  // Filter exams: Show ALL exams for the student's class
  // FIX: Case insensitive and whitespace insensitive matching for class names
  const studentExams = exams.filter((e) => {
      // Normalize student class string (remove spaces, uppercase) e.g., "VII A" -> "VIIA"
      const studentClassNorm = student.class.replace(/\s+/g, '').toUpperCase();
      
      const isTargetClass = e.classTarget.some(target => {
          const targetNorm = target.replace(/\s+/g, '').toUpperCase();
          return targetNorm === studentClassNorm;
      });

      const isActiveStatus = e.isActive;
      // We return true if active AND class matches.
      return isActiveStatus && isTargetClass;
  });

  // FILTERED HISTORY FROM PROPS (Actual Results)
  const myHistory = useMemo(() => {
      return examResults.filter(r => r.studentId === student.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [examResults, student.id]);

  // --- SPLIT EXAMS INTO ACTIVE & PAST ---
  // UPDATED LOGIC (FIX): 
  // 1. activeMissions = All exams that are NOT DONE yet. (Even if time expired, show them in lobby so user sees 'Time Ended' instead of empty screen).
  // 2. pastMissions = Exams that are DONE (Submitted).
  const { activeMissions, pastMissions } = useMemo(() => {
      const active: Exam[] = [];
      const past: Exam[] = [];

      studentExams.forEach(exam => {
          const isDone = myHistory.some(h => h.examId === exam.id);

          if (isDone) {
              past.push(exam);
          } else {
              active.push(exam);
          }
      });

      return { activeMissions: active, pastMissions: past };
  }, [studentExams, myHistory]);

  useEffect(() => {
    if (activeExam && navScrollRef.current) {
        const activeBtn = navScrollRef.current.children[currentQuestionIndex] as HTMLElement;
        if (activeBtn) {
            const scrollLeft = activeBtn.offsetLeft - navScrollRef.current.offsetLeft - (navScrollRef.current.clientWidth / 2) + (activeBtn.clientWidth / 2);
            navScrollRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        }
    }
    // Auto scroll to top when question changes
    if (activeExam && questionContainerRef.current) {
        questionContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
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
                if (newCount >= 3) {
                    handleSubmitExam(true); 
                    return newCount; 
                } else {
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

  const formatDateRange = (start: string, end: string) => {
      const s = new Date(start);
      const e = new Date(end);
      return `Mulai: ${s.toLocaleString('id-ID', {day: 'numeric', month: 'short', hour:'2-digit', minute:'2-digit'})} — Selesai: ${e.toLocaleString('id-ID', {day: 'numeric', month: 'short', hour:'2-digit', minute:'2-digit'})}`;
  };

  // Fisher-Yates Shuffle Helper
  function shuffleArray<T>(array: T[]): T[] {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
  }

  const handleStartExam = (exam: Exam) => {
    // Check if already taken
    const existing = myHistory.find(h => h.examId === exam.id);
    if (existing) {
        alert("Anda sudah mengerjakan ujian ini!");
        return;
    }

    // --- RANDOMIZATION LOGIC ---
    // 1. Shuffle Questions Order
    let examQuestions = shuffleArray(exam.questions);

    // 2. Shuffle Options inside each question (Deep Copy to modify)
    // We must map the new correct index after shuffling so grading works
    examQuestions = examQuestions.map(q => {
        if (q.type === QuestionType.SINGLE && q.options) {
             // Create array of objects to track original index
             // q.correctAnswerIndex is the index in the original options array
             const optionsWithIndex = q.options.map((opt, i) => ({ opt, originalIndex: i }));
             const shuffledOptions = shuffleArray(optionsWithIndex);
             
             // Find where the original correct answer went
             // The original correct index was 'q.correctAnswerIndex'
             // We look for the option that had 'originalIndex' === 'q.correctAnswerIndex'
             const newCorrectIndex = shuffledOptions.findIndex(o => o.originalIndex === q.correctAnswerIndex);
             
             return {
                 ...q,
                 options: shuffledOptions.map(o => o.opt),
                 correctAnswerIndex: newCorrectIndex
             };
        }
        // Ideally we should also shuffle Matching pairs order, but keeping it simple for now
        return q;
    });

    setShuffledQuestions(examQuestions);
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

  const handleSaveAndNext = (qId: string) => {
    if (activeExam) {
        if (currentQuestionIndex < shuffledQuestions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            alert("Ini adalah soal terakhir. Silahkan di cek jawaban terlebih dahulu sebelum menekan tombol Finish.");
        }
    }
  };

  const handleFinishClick = () => {
      setShowFinishConfirm(true);
  };

  // SCROLL HELPER
  const handleScroll = (direction: 'up' | 'down') => {
    if (questionContainerRef.current) {
        const scrollAmount = 250;
        questionContainerRef.current.scrollBy({
            top: direction === 'up' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        });
    }
  };

  const handleSubmitExam = (forceDisqualify = false) => {
    if (!activeExam) return;
    let correctCount = 0;
    let literasiTotal = 0;
    let literasiCorrect = 0;
    let numerasiTotal = 0;
    let numerasiCorrect = 0;

    // Use shuffledQuestions for scoring because it contains the updated correct indices for this session
    shuffledQuestions.forEach((q) => {
      let isCorrect = false;
      const userAnswer = answers[q.id];
      const isLiterasi = q.category === QuestionCategory.LITERASI;
      if (isLiterasi) literasiTotal++; else numerasiTotal++;

      if (q.type === QuestionType.SINGLE) {
        if (userAnswer === q.correctAnswerIndex) isCorrect = true;
      } 
      else if (q.type === QuestionType.COMPLEX) {
        const userSet = new Set(userAnswer as number[]);
        const correctSet = new Set(q.correctAnswerIndices);
        // Strict match
        if (userSet.size === correctSet.size && [...userSet].every(x => correctSet.has(x))) {
            isCorrect = true;
        }
      } 
      else if (q.type === QuestionType.MATCHING) {
          const userPairs = userAnswer as Record<string, string>;
          if (userPairs && q.matchingPairs) {
             const allCorrect = q.matchingPairs.every(pair => userPairs[pair.left] === pair.right);
             if (allCorrect) isCorrect = true;
          }
      }

      if (isCorrect) {
          correctCount++;
          if (isLiterasi) literasiCorrect++; else numerasiCorrect++;
      }
    });

    const calculatedScore = shuffledQuestions.length > 0 ? (correctCount / shuffledQuestions.length) * 100 : 0;
    const litScore = literasiTotal > 0 ? (literasiCorrect / literasiTotal) * 100 : 0;
    const numScore = numerasiTotal > 0 ? (numerasiCorrect / numerasiTotal) * 100 : 0;

    setScore(calculatedScore);
    setShowFinishConfirm(false);
    
    if (forceDisqualify) {
        setIsDisqualified(true);
        setViolationCount(3);
        setShowViolationWarning(false); 
    }
    
    // SAVE REAL RESULT
    // Note: We save the answers based on the shuffled index. 
    // In a production app, you might want to map this back to the original option text for analysis.
    const resultData: ExamResult = {
        id: `res-${Date.now()}`,
        examId: activeExam.id,
        examTitle: activeExam.title,
        studentId: student.id,
        studentName: student.name,
        studentClass: student.class,
        score: calculatedScore,
        literasiScore: litScore,
        numerasiScore: numScore,
        answers: answers, 
        timestamp: new Date().toISOString(),
        violationCount: forceDisqualify ? 3 : violationCount, // Pass violation data
        isDisqualified: forceDisqualify || isDisqualified // Pass disqualification data
    };
    
    onSaveResult(resultData);
    setIsSubmitted(true);
  };

  const renderSingleChoice = (q: Question) => (
    <div className="space-y-3">
      {q.options?.map((option, idx) => {
        const isSelected = answers[q.id] === idx;
        return (
          <button
            key={idx}
            onClick={() => handleSingleChoice(q.id, idx)}
            className={`w-full text-left p-4 md:p-5 relative overflow-hidden transition-all duration-200 flex items-center group clip-path-polygon shadow-sm
            ${isSelected 
                ? 'bg-yellow-50 border-l-4 border-yellow-500 shadow-md transform scale-[1.01]' 
                : 'bg-white border-l-4 border-slate-200 hover:bg-slate-50 hover:border-yellow-300'
            }`}
            style={{ clipPath: 'polygon(0 0, 100% 0, 99% 100%, 0% 100%)' }}
          >
            <div className={`w-10 h-10 flex items-center justify-center mr-5 font-black font-mono text-lg transition-colors border-2 transform -skew-x-12 shrink-0 rounded-sm shadow-sm ${
                isSelected ? 'bg-yellow-500 border-yellow-600 text-white' : 'bg-slate-100 border-slate-300 text-slate-500 group-hover:border-yellow-400 group-hover:text-yellow-600'
            }`}>
              <span className="transform skew-x-12">{String.fromCharCode(65 + idx)}</span>
            </div>
            <span className={`text-lg font-bold leading-relaxed ${isSelected ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-800'}`}>
                {/* Math Render for Options */}
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{p: 'span'}}>{option}</ReactMarkdown>
            </span>
            {isSelected && <div className="absolute right-0 top-0 bottom-0 w-1 bg-yellow-500"></div>}
          </button>
        )
      })}
    </div>
  );

  const renderComplexChoice = (q: Question) => {
    const neededAnswers = q.correctAnswerIndices?.length || 0;
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2 bg-blue-50 p-2 rounded border-l-4 border-blue-500 w-fit">
                <span className="text-sm font-black text-blue-600 uppercase tracking-wider">
                    Pilihan Ganda Kompleks
                </span>
                <span className="text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded ml-2">
                    Pilih {neededAnswers} Jawaban Benar
                </span>
            </div>
            {q.options?.map((option, idx) => {
                const isSelected = (answers[q.id] as number[])?.includes(idx);
                return (
                    <button
                    key={idx}
                    onClick={() => handleComplexChoice(q.id, idx)}
                    className={`w-full text-left p-4 md:p-5 relative transition-all duration-200 flex items-center group shadow-sm rounded-lg
                    ${isSelected 
                        ? 'bg-blue-50 border-2 border-blue-500 shadow-md' 
                        : 'bg-white border-2 border-slate-200 hover:border-blue-300'
                    }`}
                    >
                    <div className={`w-8 h-8 mr-5 flex items-center justify-center transition-all shrink-0 rounded-md border-2 ${
                        isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-slate-50 group-hover:border-blue-400'
                    }`}>
                        {isSelected ? <Check size={20} strokeWidth={4} /> : null}
                    </div>
                    <span className={`text-lg font-bold leading-relaxed ${isSelected ? 'text-blue-900' : 'text-slate-600 group-hover:text-slate-800'}`}>
                        {/* Math Render for Options */}
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{p: 'span'}}>{option}</ReactMarkdown>
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
             <div className="flex items-center gap-2 mb-2 bg-orange-50 p-2 rounded border-l-4 border-orange-500 w-fit">
                 <span className="text-sm font-black text-orange-600 uppercase tracking-wider">Benar / Salah</span>
             </div>
             <div className="overflow-x-auto rounded-xl border-2 border-slate-200 pb-2 custom-scrollbar bg-white shadow-sm">
                 <table className="w-full text-left text-sm text-slate-700 min-w-[600px]">
                    <thead className="bg-slate-50 text-xs uppercase font-black text-slate-400">
                        <tr>
                            <th className="px-4 py-3 border-b-2 border-slate-200 w-12 text-center sticky left-0 bg-slate-50 shadow-[1px_0_0_rgba(0,0,0,0.05)] z-10">No</th>
                            <th className="px-4 py-3 border-b-2 border-slate-200">Pernyataan</th>
                            <th className="px-4 py-3 border-b-2 border-slate-200 w-24 text-center bg-emerald-50 text-emerald-600">{col1Label}</th>
                            <th className="px-4 py-3 border-b-2 border-slate-200 w-24 text-center bg-red-50 text-red-600">{col2Label}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {q.matchingPairs?.map((pair, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 text-center font-black text-slate-400 sticky left-0 bg-white shadow-[1px_0_0_rgba(0,0,0,0.05)] z-10">{idx + 1}</td>
                                <td className="px-4 py-3 font-bold text-slate-800 min-w-[200px] text-lg">
                                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{p: 'span'}}>{pair.left}</ReactMarkdown>
                                </td>
                                <td className="px-4 py-3 text-center bg-emerald-50/50">
                                    <label className="flex items-center justify-center w-full h-full cursor-pointer min-h-[40px]">
                                        <input 
                                            type="radio" 
                                            name={`q-${q.id}-row-${idx}`}
                                            className="w-6 h-6 accent-emerald-500 cursor-pointer"
                                            checked={userPairs[pair.left] === col1Label}
                                            onChange={() => handleMatching(q.id, pair.left, col1Label)}
                                        />
                                    </label>
                                </td>
                                <td className="px-4 py-3 text-center bg-red-50/50">
                                    <label className="flex items-center justify-center w-full h-full cursor-pointer min-h-[40px]">
                                        <input 
                                            type="radio" 
                                            name={`q-${q.id}-row-${idx}`}
                                            className="w-6 h-6 accent-red-500 cursor-pointer"
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
      {shuffledQuestions.map((q, idx) => {
          if (!q) return null; // Safe guard for undefined questions
          const hasAns = answers[q.id] !== undefined;
          const isMarkedDoubt = doubts.has(q.id);
          let btnClass = 'bg-white text-slate-500 border-2 border-slate-200 hover:border-slate-300'; 
          if (idx === currentQuestionIndex) btnClass = 'bg-yellow-500 text-white border-yellow-600 font-black scale-110 z-10 shadow-md';
          else if (isMarkedDoubt) btnClass = 'bg-orange-500 text-white border-orange-600 font-bold';
          else if (hasAns) btnClass = 'bg-emerald-500 text-white border-emerald-600 font-bold';
          return (
            <button 
              key={q.id} 
              onClick={() => { setCurrentQuestionIndex(idx); setIsMobileNavOpen(false); }} 
              className={`aspect-square flex items-center justify-center text-xs transition-all clip-path-polygon rounded-sm ${btnClass}`} 
              style={{ clipPath: 'polygon(15% 0, 100% 0, 100% 85%, 85% 100%, 0 100%, 0 15%)' }}
            >
              {idx + 1}
            </button>
          )
      })}
    </div>
  );

  const renderExamCard = (exam: Exam, isPast: boolean = false) => {
      const now = new Date();
      const start = new Date(exam.scheduledStart);
      const end = new Date(exam.scheduledEnd);
      const isTimeValid = now >= start && now <= end;
      const isEnded = now > end;
      const isDone = myHistory.some(h => h.examId === exam.id); 

      // If finished, show score (if available) or completion status
      const score = isDone ? myHistory.find(h => h.examId === exam.id)?.score : 0;

      return (
          <div key={exam.id} className={`group relative bg-white border-2 transition-all duration-300 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl ${isTimeValid && !isDone ? 'border-slate-200 hover:border-yellow-400 hover:-translate-y-1' : ''} ${isDone ? 'border-emerald-100 bg-emerald-50/30' : ''} ${isEnded && !isDone ? 'opacity-70 grayscale border-slate-100' : ''}`}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-yellow-100/50 to-transparent pointer-events-none rounded-tr-2xl"></div>
              <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                      {isDone ? (
                          <span className="bg-emerald-100 text-emerald-600 border border-emerald-200 px-2 py-1 text-[10px] font-black uppercase tracking-widest rounded flex items-center gap-1"><Check size={10} strokeWidth={4}/> Completed</span>
                      ) : (
                          <span className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest rounded border ${isEnded ? 'bg-red-100 text-red-500 border-red-200' : 'bg-blue-100 text-blue-600 border-blue-200'}`}>
                              {isEnded ? 'Expired' : 'Ranked'}
                          </span>
                      )}
                      <Clock size={16} className="text-slate-400"/>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter mb-1 leading-tight group-hover:text-[#00A2FF] transition-colors">{exam.title}</h3>
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide mb-4">{formatDateRange(exam.scheduledStart, exam.scheduledEnd)}</p>
                  
                  <div className="flex items-center gap-4 text-xs text-slate-500 font-bold mb-6 border-t border-slate-100 pt-4">
                      <span className="flex items-center gap-1"><Target size={14} className="text-slate-400"/> {exam.questions.length} Qs</span>
                      <span className="flex items-center gap-1"><Clock size={14} className="text-slate-400"/> {exam.durationMinutes}m</span>
                  </div>
                  {isDone ? (
                      <div className="w-full py-3 bg-emerald-500 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-[0_4px_0_0_#059669] flex flex-col items-center justify-center gap-1">
                          <span className="flex items-center gap-1"><Check size={14} strokeWidth={4}/> Mission Accomplished</span>
                          <span className="text-[10px] opacity-90 font-mono bg-emerald-600 px-2 rounded">Score: {Math.round(score || 0)}</span>
                      </div>
                  ) : isTimeValid ? (
                      <button onClick={() => handleStartExam(exam)} className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all active:scale-95 shadow-[0_4px_0_0_#CA8A04] active:shadow-none border-b-yellow-600 flex items-center justify-center gap-2">Start Mission <ChevronRight size={14}/></button>
                  ) : (
                      <button disabled className="w-full py-3 bg-slate-100 text-slate-400 font-black uppercase tracking-widest text-xs rounded-xl flex items-center justify-center gap-2 cursor-not-allowed border-2 border-slate-200">
                          {isEnded ? (
                              <span className="flex items-center gap-2 text-red-400"><XCircle size={14}/> Mission Ended</span>
                          ) : 'Coming Soon'}
                      </button>
                  )}
              </div>
          </div>
      );
  };

  // --- RENDER LOGIC ---
  
  if (introStep === 0) { /* Welcome Screen Code - LIGHT MODE */
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-[#F0F2F5] relative overflow-hidden font-sans text-slate-800">
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
              
              {/* Light Background Shapes */}
              <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-yellow-200/40 rounded-full blur-[100px] animate-pulse"></div>
              <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-200/40 rounded-full blur-[100px] animate-pulse animation-delay-500"></div>

              <div className="relative z-10 text-center p-6 flex flex-col items-center max-w-2xl">
                   <div className="mb-8 inline-block animate-float">
                        <div className="w-32 h-32 md:w-40 md:h-40 bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex items-center justify-center border-4 border-white transform rotate-6">
                            <img src="https://image2url.com/r2/default/images/1769001049680-d981c280-6340-4989-8563-7b08134c189a.png" alt="Logo" className="h-20 md:h-24 object-contain transform -rotate-6" />
                        </div>
                   </div>
                   <div className="space-y-2 mb-10">
                      <h1 className="text-4xl md:text-6xl font-black italic text-slate-800 tracking-tighter uppercase animate-fade-in-up">Selamat Datang</h1>
                      <h2 className="text-3xl md:text-5xl font-black text-[#00A2FF] tracking-widest uppercase animate-fade-in-up animate-delay-200 drop-shadow-sm">{student.name}</h2>
                      <div className="h-2 w-24 bg-yellow-400 mx-auto mt-6 rounded-full animate-fade-in-up animate-delay-200"></div>
                   </div>
                   <p className="text-slate-500 text-lg md:text-xl font-bold uppercase tracking-[0.2em] mb-12 animate-fade-in-up animate-delay-400">CBT Battle Arena • SMPN 3 Pacet</p>
                   <button onClick={() => setIntroStep(2)} className="group relative px-12 py-5 bg-gradient-to-r from-yellow-500 to-yellow-400 text-white font-black text-xl uppercase tracking-widest hover:from-yellow-400 hover:to-yellow-300 transform hover:scale-105 transition-all shadow-[0_10px_20px_rgba(234,179,8,0.3)] animate-fade-in-up animate-delay-400 rounded-2xl border-b-4 border-yellow-600 active:border-b-0 active:translate-y-1">
                       <span className="inline-block flex items-center gap-3">Mulai Misi <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" strokeWidth={3}/></span>
                   </button>
              </div>
          </div>
      );
  }

  if (introStep === 2) { /* Rules Screen Code - LIGHT MODE */
      return (
          <div className="fixed inset-0 z-50 w-full h-full bg-[#F0F2F5] text-slate-800 overflow-y-auto">
              
              {/* Flex Container for Centering */}
              <div className="min-h-full w-full flex flex-col items-center justify-center p-4 py-8 md:p-8">
                  <div className="max-w-3xl w-full bg-white border border-slate-200 p-6 md:p-10 relative shadow-2xl rounded-3xl">
                      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-yellow-400 to-transparent"></div>
                      
                      <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-8 text-center uppercase tracking-widest flex items-center justify-center gap-3">
                        <AlertCircle className="text-yellow-500 flex-shrink-0" size={32} /> Aturan Main
                      </h2>
                      
                      <div className="space-y-4 mb-8 text-slate-600 font-medium text-sm md:text-base">
                          <div className="flex gap-4 items-start bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <span className="bg-yellow-500 text-white font-black w-8 h-8 flex items-center justify-center rounded-lg shrink-0 text-sm shadow-sm shadow-yellow-200">1</span>
                            <p className="mt-1">Waktu ujian berjalan mundur. Jika waktu habis, jawaban tersimpan otomatis.</p>
                          </div>
                          <div className="flex gap-4 items-start bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <span className="bg-yellow-500 text-white font-black w-8 h-8 flex items-center justify-center rounded-lg shrink-0 text-sm shadow-sm shadow-yellow-200">2</span>
                            <p className="mt-1">Pilih jawaban dengan hati-hati. Gunakan tombol "Ragu-ragu" untuk menandai soal.</p>
                          </div>
                          <div className="flex gap-4 items-start bg-red-50 p-4 rounded-xl border border-red-100">
                            <span className="bg-red-500 text-white font-black w-8 h-8 flex items-center justify-center rounded-lg shrink-0 text-sm shadow-sm shadow-red-200">3</span>
                            <p className="text-red-600 font-bold mt-1">Dilarang pindah aplikasi/tab. Anda memiliki 3 nyawa sebelum didiskualifikasi.</p>
                          </div>
                          <div className="flex gap-4 items-start bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <span className="bg-yellow-500 text-white font-black w-8 h-8 flex items-center justify-center rounded-lg shrink-0 text-sm shadow-sm shadow-yellow-200">4</span>
                            <p className="mt-1">Klik tombol "Finish" hanya jika yakin selesai.</p>
                          </div>
                      </div>

                      <button 
                        onClick={() => setIntroStep(3)} 
                        className="w-full py-5 bg-[#00B06F] hover:bg-[#009e63] text-white font-black text-lg uppercase tracking-[0.1em] shadow-[0_6px_0_0_#059669] transition-transform active:scale-95 active:shadow-none border-b-emerald-700 rounded-2xl flex items-center justify-center gap-2"
                      >
                        Masuk ke Lobby <ChevronRight size={24} strokeWidth={3}/>
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  // 1. RESULT SCREEN - LIGHT MODE
  if (isSubmitted && activeExam) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#F0F2F5]/80 backdrop-blur-md">
          <div className={`relative p-1 rounded-[2rem] shadow-2xl animate-bounce-in max-w-lg w-full mx-4 ${isDisqualified ? 'bg-red-100 border-4 border-red-500' : 'bg-white border-4 border-yellow-400'}`}>
             <div className="bg-white rounded-[1.8rem] p-8 text-center overflow-hidden relative">
                <div className={`absolute top-0 left-0 w-full h-2 ${isDisqualified ? 'bg-red-500' : 'bg-yellow-400'}`}></div>
                <div className="mb-6 flex justify-center mt-4">
                    {isDisqualified ? (
                        <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center animate-pulse">
                            <AlertOctagon size={60} className="text-red-500" />
                        </div>
                    ) : (
                        <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center animate-bounce">
                            <Trophy size={60} className="text-yellow-500" />
                        </div>
                    )}
                </div>
                <h2 className={`text-4xl font-black italic tracking-tighter mb-2 uppercase ${isDisqualified ? 'text-red-500' : 'text-slate-800'}`}>
                    {isDisqualified ? 'ELIMINATED!' : 'BOOYAH!'}
                </h2>
                <p className="text-slate-400 font-bold uppercase tracking-widest mb-8 text-sm">
                    {isDisqualified ? 'Kecurangan Terdeteksi' : 'Mission Completed'}
                </p>
                
                {isDisqualified && (
                    <div className="bg-red-50 border border-red-200 p-4 rounded-xl mb-6 text-sm text-red-600 font-medium">
                        Anda telah didiskualifikasi karena terdeteksi keluar dari ujian sebanyak 3 kali. Skor Anda dikunci berdasarkan jawaban terakhir.
                    </div>
                )}

                <div className="bg-slate-50 p-6 rounded-2xl mb-8 border border-slate-100 relative shadow-inner">
                  <div className={`absolute -top-3 left-1/2 transform -translate-x-1/2 bg-white px-4 text-xs font-black uppercase tracking-widest border rounded-full py-1 shadow-sm ${isDisqualified ? 'text-red-500 border-red-100' : 'text-yellow-500 border-yellow-100'}`}>
                      Final Score
                  </div>
                  <p className="text-7xl font-black text-slate-800 tracking-tighter">{Math.round(score)}</p>
                </div>
                <button 
                    onClick={() => { setActiveExam(null); setIsSubmitted(false); setMenuTab('CAREER'); }} 
                    className={`w-full py-4 rounded-xl font-black text-lg uppercase tracking-widest transition transform hover:scale-105 shadow-lg ${isDisqualified ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-yellow-500 hover:bg-yellow-400 text-white shadow-yellow-200'}`}
                >
                  Return to Lobby
                </button>
             </div>
          </div>
        </div>
      );
  }

  // 2. ACTIVE EXAM INTERFACE - LIGHT MODE
  if (activeExam) {
    const currentQuestion = shuffledQuestions[currentQuestionIndex];
    
    // --- SAFEGUARD for undefined question ---
    if (!currentQuestion) {
        return (
            <div className="h-[100dvh] flex flex-col items-center justify-center bg-slate-50 text-slate-800 p-4 text-center">
                <AlertCircle size={48} className="text-red-500 mb-4" />
                <h2 className="text-xl font-bold mb-2">Terjadi Kesalahan Data Soal</h2>
                <p className="text-slate-500 mb-6">Soal tidak ditemukan atau data korup. Silakan hubungi pengawas.</p>
                <button 
                    onClick={() => setActiveExam(null)} 
                    className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-xl font-bold transition-colors shadow-lg"
                >
                    Kembali ke Lobby
                </button>
            </div>
        );
    }

    const isDoubt = doubts.has(currentQuestion.id);

    return (
      <div className="h-[100dvh] flex flex-col bg-[#F2F4F8] text-slate-800 font-sans overflow-hidden relative supports-[height:100dvh]:h-[100dvh]">
        
        {/* --- VIOLATION WARNING MODAL (STRICT RED) --- */}
        {showViolationWarning && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-red-900/40 backdrop-blur-md animate-pulse p-4">
                <div className="bg-white border-4 border-red-600 w-full max-w-lg relative shadow-[0_20px_60px_rgba(220,38,38,0.5)] transform scale-105 rounded-3xl overflow-hidden">
                    <div className="bg-red-600 text-white p-4 font-black text-center uppercase tracking-widest text-lg">Security Breach</div>
                    <div className="p-8 text-center">
                         <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle size={40} className="text-red-600 animate-bounce"/>
                         </div>
                         <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter mb-2">Peringatan Keras!</h2>
                         <p className="text-red-600 font-bold text-lg mb-6 uppercase tracking-wide inline-block">
                             Dilarang Keluar dari Aplikasi
                         </p>
                         <div className="flex justify-center gap-4 mb-8">
                             {[1, 2, 3].map(i => (
                                 <div key={i} className={`w-12 h-12 flex items-center justify-center border-4 font-black text-xl rounded-full transition-all duration-300 ${i <= violationCount ? 'bg-red-600 border-red-600 text-white scale-110 shadow-lg' : 'bg-slate-100 border-slate-200 text-slate-300'}`}>
                                     <span>{i <= violationCount ? '!' : i}</span>
                                 </div>
                             ))}
                         </div>
                         <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-6">
                             <p className="text-red-600 text-sm font-bold">
                                 Pelanggaran ke-{violationCount} dari 3. <br/>
                                 Jika mencapai 3 kali, ujian akan dihentikan otomatis (DISKUALIFIKASI).
                             </p>
                         </div>
                         <button 
                            onClick={() => setShowViolationWarning(false)}
                            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-lg shadow-lg rounded-xl transition-transform active:scale-95"
                         >
                             Saya Mengerti & Kembali
                         </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- CONFIRMATION MODAL --- */}
        {showFinishConfirm && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
                <div className="bg-white border-b-4 border-red-500 w-full max-w-md relative shadow-2xl rounded-2xl overflow-hidden">
                    <div className="bg-red-500 text-white font-black uppercase py-3 px-6 flex items-center gap-2 tracking-widest text-sm">
                        <AlertTriangle size={18}/> Warning
                    </div>
                    <div className="p-8 text-center">
                        <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-wide mb-2">Mengakhiri Ujian?</h3>
                        <p className="text-slate-500 mb-8 font-medium">Pastikan Anda telah memeriksa semua jawaban. Aksi ini tidak dapat dibatalkan.</p>
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => setShowFinishConfirm(false)}
                                className="py-3 border-2 border-slate-200 text-slate-500 font-bold uppercase hover:bg-slate-50 rounded-xl"
                            >
                                Periksa Lagi
                            </button>
                            <button 
                                onClick={() => handleSubmitExam(false)}
                                className="py-3 bg-red-600 text-white font-black uppercase hover:bg-red-700 shadow-lg rounded-xl"
                            >
                                Ya, Akhiri
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* HUD Header - Light Mode */}
        <div className="relative z-20 bg-white border-b border-slate-200 px-4 md:px-8 py-3 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileNavOpen(!isMobileNavOpen)} className="lg:hidden p-2 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
               {isMobileNavOpen ? <X size={20} /> : <Grid size={20} />}
            </button>
            <div className="bg-yellow-500 text-white font-black italic px-3 py-1 -skew-x-12 text-sm md:text-base hidden sm:block shadow-sm shadow-yellow-200 rounded-sm">
                <span className="skew-x-12 block">FF-EXAM</span>
            </div>
            <div className="block">
                <h1 className="font-bold text-sm md:text-lg text-slate-800 tracking-wide uppercase truncate max-w-[150px] md:max-w-xs">{activeExam.title}</h1>
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4">
             {/* Violation Indicator */}
             <div className="hidden md:flex items-center gap-1 bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-lg shadow-inner">
                 <ShieldIcon size={16} className={violationCount > 0 ? "text-red-500 animate-pulse" : "text-green-500"} />
                 <span className="text-xs font-bold text-slate-400">STATUS:</span>
                 <span className={`text-xs font-black ${violationCount > 0 ? "text-red-500" : "text-green-600"}`}>
                     {violationCount === 0 ? "SECURE" : `WARNING ${violationCount}/3`}
                 </span>
             </div>

            <div className={`flex items-center space-x-2 px-3 md:px-4 py-1.5 border-2 transform -skew-x-12 rounded-sm shadow-sm ${timeLeft < 300 ? 'bg-red-50 border-red-500 text-red-600' : 'bg-white border-yellow-400 text-slate-800'}`}>
              <Clock size={16} className="skew-x-12" />
              <span className="font-mono font-bold text-lg md:text-xl skew-x-12 tracking-widest">{formatTime(timeLeft)}</span>
            </div>
            <button onClick={handleFinishClick} className="bg-gradient-to-r from-red-600 to-red-500 text-white px-3 md:px-6 py-2 hover:from-red-500 font-black uppercase tracking-wider transform -skew-x-12 flex items-center gap-2 border-b-4 border-red-800 rounded-sm active:border-b-0 active:translate-y-1 text-xs md:text-base shadow-lg shadow-red-200">
              <span className="skew-x-12 flex items-center gap-2">Finish <Shield size={16}/></span>
            </button>
          </div>
        </div>
        
        {/* --- Horizontal Navigation Strip (Mobile Only) --- */}
        <div className="lg:hidden w-full bg-white border-b border-slate-200 z-10 flex items-center shadow-sm">
            <div ref={navScrollRef} className="flex-1 flex overflow-x-auto gap-2 p-2 custom-scrollbar scroll-smooth snap-x">
              {shuffledQuestions.map((q, idx) => {
                 if (!q) return null; // Safe guard for undefined questions
                 const hasAns = answers[q.id] !== undefined;
                 const isMarkedDoubt = doubts.has(q.id);
                 const isActive = idx === currentQuestionIndex;
                 let bgClass = "bg-white border-slate-200 text-slate-400";
                 if (isActive) bgClass = "bg-yellow-500 text-white border-yellow-600 shadow-md scale-105 font-black";
                 else if (isMarkedDoubt) bgClass = "bg-orange-500 border-orange-600 text-white font-bold";
                 else if (hasAns) bgClass = "bg-emerald-500 border-emerald-600 text-white font-bold";
                 return (
                   <button key={q.id} onClick={() => setCurrentQuestionIndex(idx)} className={`flex-none w-10 h-10 rounded-lg border-2 flex items-center justify-center text-sm transition-all snap-center ${bgClass}`}>
                     {idx + 1}
                     {isMarkedDoubt && !isActive && <div className="absolute top-0 right-0 w-2 h-2 bg-orange-500 rounded-full animate-pulse border border-white" />}
                   </button>
                 );
              })}
            </div>
            <div className="px-2 bg-slate-50 shadow-[-5px_0_10px_rgba(0,0,0,0.05)] z-20 h-full flex items-center border-l border-slate-200">
                <span className="text-[10px] text-slate-400 font-mono uppercase text-center block leading-tight">
                  <span className="text-slate-800 block font-black text-lg">{currentQuestionIndex + 1}</span> of {shuffledQuestions.length}
                </span>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden relative z-10">
          {/* LEFT SIDE: Question + Bottom Buttons */}
          <div className="flex-1 flex flex-col min-w-0 relative group/scroll bg-[#F2F4F8]">
              
              {/* --- SCROLL HELPER BUTTONS (Laptop Mode) --- */}
              <div className="absolute right-4 bottom-24 z-40 hidden md:flex flex-col gap-3 opacity-30 hover:opacity-100 group-hover/scroll:opacity-100 transition-opacity duration-300">
                  <button onClick={() => handleScroll('up')} className="p-3 bg-white border border-slate-200 text-slate-400 rounded-full hover:bg-yellow-500 hover:text-white hover:border-yellow-500 shadow-lg transition-all transform hover:scale-110">
                      <ChevronUp size={20} strokeWidth={3} />
                  </button>
                  <button onClick={() => handleScroll('down')} className="p-3 bg-white border border-slate-200 text-slate-400 rounded-full hover:bg-yellow-500 hover:text-white hover:border-yellow-500 shadow-lg transition-all transform hover:scale-110">
                      <ChevronDown size={20} strokeWidth={3} />
                  </button>
              </div>

              <div ref={questionContainerRef} className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">
                <div className="max-w-5xl mx-auto">
                  <div className="bg-white p-6 md:p-10 rounded-3xl border border-slate-200 shadow-xl min-h-[400px] flex flex-col relative">
                    <div className="flex justify-between items-start mb-8 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3">
                          <span className="bg-yellow-500 text-white px-4 py-1.5 text-sm font-black uppercase transform -skew-x-12 rounded-sm shadow-sm shadow-yellow-200"><span className="skew-x-12">Question {currentQuestionIndex + 1}</span></span>
                          {isDoubt && (<span className="bg-orange-500 text-white px-2 py-1 text-xs font-bold uppercase rounded flex items-center gap-1 shadow-sm shadow-orange-200"><Flag size={12} fill="currentColor" /> Ragu-ragu</span>)}
                      </div>
                      <Crosshair size={24} className="text-slate-200" />
                    </div>
                    {currentQuestion.stimulus && (
                       <div className="mb-8 p-6 bg-blue-50 border border-blue-100 rounded-2xl relative">
                          <div className="absolute top-0 left-0 bg-blue-600 text-white text-[10px] font-black px-3 py-1 uppercase tracking-widest rounded-tl-xl rounded-br-xl">STIMULUS DATA</div>
                          <div className="text-slate-700 leading-relaxed text-lg mt-4 font-medium whitespace-pre-wrap prose max-w-none">
                              {/* Math Render for Stimulus */}
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{currentQuestion.stimulus}</ReactMarkdown>
                          </div>
                       </div>
                    )}
                    {currentQuestion.image && (
                       <div className="w-full mb-8 flex flex-col items-center bg-slate-50 p-4 rounded-xl border border-slate-200 relative group">
                          <div className="absolute top-4 left-4 flex items-center gap-2">
                             <div className="bg-white p-1.5 rounded-md text-slate-400 border border-slate-200 shadow-sm"><ImageIcon size={16} /></div>
                             <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Visual Data</p>
                          </div>
                          <img src={currentQuestion.image} alt="Lampiran Soal" className="max-w-full h-auto max-h-[400px] object-contain rounded-lg shadow-sm border border-slate-200 mt-8 md:mt-0 bg-white" />
                       </div>
                    )}
                    <div className="text-xl md:text-2xl text-slate-800 leading-relaxed mb-8 font-bold whitespace-pre-wrap prose max-w-none font-display">
                        {/* Math Render for Question */}
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{currentQuestion.text}</ReactMarkdown>
                    </div>
                    <div className="mb-6 flex-1">
                      {currentQuestion.type === QuestionType.SINGLE && renderSingleChoice(currentQuestion)}
                      {currentQuestion.type === QuestionType.COMPLEX && renderComplexChoice(currentQuestion)}
                      {currentQuestion.type === QuestionType.MATCHING && renderMatching(currentQuestion)}
                    </div>
                  </div>
                </div>
              </div>

              {/* FIXED ACTION BUTTONS (Sticky Bottom) - UPDATED FOR MOBILE VISIBILITY */}
              <div className="p-3 md:p-4 bg-white/90 backdrop-blur border-t border-slate-200 z-30 pb-6 md:pb-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                  <div className="max-w-5xl mx-auto flex gap-3 md:gap-8 overflow-x-auto pb-2 md:pb-0">
                    <button onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))} disabled={currentQuestionIndex === 0} className="flex-1 min-w-[100px] group flex items-center justify-center space-x-2 px-4 py-3 bg-white border-2 border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 font-bold uppercase rounded-xl text-sm md:text-base disabled:opacity-50 transition-all shadow-sm">
                      <ChevronLeft size={20} strokeWidth={3} /> <span>Prev</span>
                    </button>
                    <button onClick={() => toggleDoubt(currentQuestion.id)} className={`flex-1 min-w-[100px] flex items-center justify-center space-x-2 px-4 py-3 border-b-4 font-bold uppercase transition-all rounded-xl text-sm md:text-base active:border-b-0 active:translate-y-1 ${isDoubt ? 'bg-orange-500 text-white border-orange-600 shadow-orange-200' : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'}`}>
                      <Flag size={20} fill={isDoubt ? "currentColor" : "none"} /> <span>{isDoubt ? 'Ragu' : 'Mark'}</span>
                    </button>
                    <button onClick={() => handleSaveAndNext(currentQuestion.id)} className="flex-1 min-w-[100px] group flex items-center justify-center space-x-2 px-4 py-3 bg-[#00A2FF] border-b-4 border-[#0085CC] text-white hover:bg-[#0093E5] font-black uppercase rounded-xl text-sm md:text-base shadow-lg shadow-blue-200 active:border-b-0 active:translate-y-1 transition-all">
                      <span>Next</span> <ChevronRight size={20} strokeWidth={3} />
                    </button>
                  </div>
              </div>
          </div>
          
          <div className="w-72 bg-white border-l border-slate-200 p-4 overflow-y-auto hidden lg:block">
            <div className="mb-6 pb-4 border-b border-slate-100">
                <h3 className="font-black text-slate-800 mb-2 flex items-center gap-2 uppercase tracking-widest text-sm"><Map size={16} className="text-yellow-500"/> Tactical Map</h3>
                {violationCount > 0 && (
                   <div className="bg-red-50 border border-red-200 p-2 rounded-lg mt-2 animate-pulse">
                       <p className="text-xs text-red-500 font-bold uppercase text-center flex items-center justify-center gap-1"><AlertTriangle size={12}/> Security Alert</p>
                       <div className="flex justify-center gap-2 mt-2">
                          {[1,2,3].map(i => (
                              <div key={i} className={`w-3 h-3 rounded-full border ${i <= violationCount ? 'bg-red-500 border-red-600' : 'bg-slate-200 border-slate-300'}`}></div>
                          ))}
                       </div>
                   </div>
                )}
            </div>
            {renderQuestionNavGrid()}
          </div>
          
          {isMobileNavOpen && (
            <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-xl p-6 lg:hidden flex flex-col animate-fade-in text-slate-800">
              <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
                 <h3 className="font-black text-slate-800 text-lg uppercase tracking-widest flex items-center gap-2"><Map size={20} className="text-yellow-500"/> Tactical Map</h3>
                 <button onClick={() => setIsMobileNavOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-red-50 hover:text-red-500 transition border border-slate-200"><X size={24}/></button>
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

  // 3. DASHBOARD (LOBBY & CAREER) - LIGHT MODE
  return (
    <div className="h-full flex flex-col md:flex-row bg-[#F0F2F5] text-slate-800 font-sans relative overflow-hidden">
        
        {/* Mobile/Tablet Bottom Navigation / Sidebar */}
        <div className="md:w-20 md:flex-col flex-row flex md:border-r border-t md:border-t-0 border-slate-200 bg-white z-30 fixed bottom-0 w-full md:sticky md:top-0 md:h-screen justify-around md:justify-start items-center md:pt-6 pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.05)] md:shadow-[5px_0_20px_rgba(0,0,0,0.05)]">
             <div className="hidden md:flex mb-8 w-14 h-14 bg-white rounded-xl items-center justify-center transform -skew-x-12 mx-auto border-2 border-slate-100 shadow-sm">
                 <img src="https://image2url.com/r2/default/images/1769001049680-d981c280-6340-4989-8563-7b08134c189a.png" alt="Logo" className="h-10 w-10 object-contain skew-x-12" />
             </div>
             <button onClick={() => { setMenuTab('LOBBY'); setSelectedHistory(null); }} className={`p-3 rounded-2xl flex flex-col items-center gap-1 transition-all group ${menuTab === 'LOBBY' ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-blue-500 hover:bg-slate-50'}`}>
                <Home size={26} strokeWidth={menuTab === 'LOBBY' ? 3 : 2} /><span className="text-[10px] uppercase font-black md:hidden">Lobby</span>
             </button>
             <button onClick={() => setMenuTab('CAREER')} className={`p-3 rounded-2xl flex flex-col items-center gap-1 transition-all mt-0 md:mt-6 ${menuTab === 'CAREER' ? 'text-yellow-500 bg-yellow-50' : 'text-slate-400 hover:text-yellow-500 hover:bg-slate-50'}`}>
                <Trophy size={26} strokeWidth={menuTab === 'CAREER' ? 3 : 2} /><span className="text-[10px] uppercase font-black md:hidden">Career</span>
             </button>
             <button onClick={onLogout} className="p-3 rounded-2xl flex flex-col items-center gap-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all mb-0 md:mb-6 mt-0 md:mt-auto">
                <LogOut size={26} strokeWidth={2} /><span className="text-[10px] uppercase font-black md:hidden">Exit</span>
             </button>
        </div>

        <div className="flex-1 flex flex-col h-full overflow-hidden pb-20 md:pb-0 relative">
            <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
                 <div className="flex items-center gap-2">
                     <img src="https://image2url.com/r2/default/images/1769001049680-d981c280-6340-4989-8563-7b08134c189a.png" alt="Logo" className="h-8 object-contain" />
                     <span className="font-black italic text-slate-800 uppercase ml-2 tracking-tight">{menuTab}</span>
                 </div>
                 <div className="text-xs text-slate-500 font-bold bg-slate-100 px-2 py-1 rounded-lg">{student.name.split(' ')[0]}</div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                {menuTab === 'LOBBY' && (
                    <div className="max-w-6xl mx-auto">
                        <div className="hidden md:flex justify-between items-end mb-8 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                             <div>
                                <h2 className="text-4xl font-black text-slate-800 italic uppercase tracking-tighter">Mission Lobby</h2>
                                <p className="text-slate-500 font-medium">Select your active mission to begin</p>
                             </div>
                             <div className="text-right">
                                 <p className="text-[#00A2FF] font-black font-mono text-sm tracking-widest">OPERATOR: {student.name}</p>
                                 <p className="text-slate-400 text-xs font-bold bg-slate-100 inline-block px-2 py-1 rounded mt-1">CLASS: {student.class}</p>
                             </div>
                        </div>
                        
                        {/* --- ACTIVE MISSIONS SECTION --- */}
                        {activeMissions.length === 0 && pastMissions.length === 0 ? (
                            <div className="border-2 border-dashed border-slate-300 bg-slate-50 p-16 text-center rounded-3xl mt-10">
                                <Target size={64} className="mx-auto text-slate-300 mb-6"/>
                                <p className="text-slate-400 text-xl font-bold uppercase tracking-wide">No Active Missions Available</p>
                            </div>
                        ) : (
                            <div className="pb-20">
                                {activeMissions.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                                        {activeMissions.map(exam => renderExamCard(exam, false))}
                                    </div>
                                )}

                                {activeMissions.length > 0 && pastMissions.length > 0 && (
                                    <div className="relative flex items-center py-8">
                                        <div className="flex-grow border-t-2 border-slate-200"></div>
                                        <span className="flex-shrink-0 mx-6 text-slate-400 text-xs uppercase font-black tracking-[0.2em] flex items-center gap-2 bg-slate-100 px-4 py-1 rounded-full">
                                            <Archive size={14}/> Misi Selesai
                                        </span>
                                        <div className="flex-grow border-t-2 border-slate-200"></div>
                                    </div>
                                )}

                                {pastMissions.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 opacity-80 hover:opacity-100 transition-opacity duration-300">
                                        {pastMissions.map(exam => renderExamCard(exam, true))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                {menuTab === 'CAREER' && (
                     <div className="max-w-7xl mx-auto h-full pb-20">
                        <div className="hidden md:block mb-8 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <h2 className="text-3xl font-black text-slate-800 italic uppercase tracking-tighter">Service Record</h2>
                            <p className="text-slate-500 font-medium">Battle history and performance stats</p>
                        </div>
                        <div className="flex flex-col lg:flex-row gap-6 h-full">
                            <div className={`${selectedHistory ? 'hidden lg:block lg:w-1/3' : 'w-full'} transition-all`}>
                                <div className="space-y-3">
                                    {myHistory.map((item, idx) => {
                                        const relatedExam = exams.find(e => e.id === item.examId);
                                        const examType = relatedExam?.questions[0]?.category || 'UMUM';
                                        
                                        return (
                                            <div key={idx} onClick={() => setSelectedHistory(item)} className={`p-5 border-2 rounded-2xl cursor-pointer transition-all relative overflow-hidden group shadow-sm ${selectedHistory === item ? 'bg-yellow-50 border-yellow-400 ring-2 ring-yellow-200' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'}`}>
                                                <div className="flex justify-between items-center relative z-10">
                                                    <div className="flex-1">
                                                        <h4 className={`font-black text-lg uppercase tracking-tight mb-1 ${selectedHistory === item ? 'text-yellow-600' : 'text-slate-800'}`}>{item.examTitle}</h4>
                                                        <div className="flex items-center gap-3 text-xs text-slate-500 font-bold">
                                                            <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-black uppercase text-slate-600">{examType}</span>
                                                            <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(item.timestamp).toLocaleString('id-ID', {day: 'numeric', month: 'short', hour:'2-digit', minute:'2-digit'})}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right pl-4">
                                                        <div className={`text-2xl font-black ${item.score >= 75 ? 'text-green-500' : 'text-red-500'}`}>{Math.round(item.score)}</div>
                                                        <div className="text-[10px] uppercase text-slate-400 font-black">Score</div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {myHistory.length === 0 && <div className="text-center p-12 text-slate-400 font-bold italic border-2 border-dashed border-slate-300 rounded-3xl bg-slate-50">No battle history found.</div>}
                                </div>
                            </div>
                            {selectedHistory && (
                                <div className="flex-1 bg-white border border-slate-200 rounded-3xl overflow-hidden flex flex-col animate-fade-in shadow-xl relative h-fit">
                                     <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                         <h3 className="font-black text-slate-700 uppercase text-sm tracking-widest flex items-center gap-2"><BarChart2 size={18} className="text-yellow-500"/> Performance Report</h3>
                                         <button onClick={() => setSelectedHistory(null)} className="lg:hidden p-2 bg-slate-200 rounded-full text-slate-600"><X size={16}/></button>
                                     </div>
                                     <div className="p-6 overflow-y-auto custom-scrollbar">
                                         <div className="text-center mb-8 bg-slate-50 p-6 rounded-3xl border-2 border-slate-100">
                                             <div className="inline-block relative">
                                                 <Trophy size={80} className="text-yellow-100 absolute -top-4 left-1/2 -translate-x-1/2 scale-150"/>
                                                 <h1 className="text-7xl font-black text-slate-800 relative z-10">{Math.round(selectedHistory.score)}</h1>
                                             </div>
                                             <p className="text-xs text-slate-400 font-black uppercase tracking-widest mt-2 bg-white px-3 py-1 rounded-full inline-block border border-slate-200">Total Score</p>
                                         </div>
                                         
                                         {/* --- DETAILED QUESTION LIST --- */}
                                         <div className="mb-8">
                                            <p className="text-xs text-slate-400 font-black uppercase mb-4 border-b border-slate-100 pb-2">Detail Jawaban</p>
                                            <div className="space-y-2">
                                                {(() => {
                                                   const relatedExam = exams.find(e => e.id === selectedHistory.examId);
                                                   if (!relatedExam) return <p className="text-xs text-red-500 font-bold">Data ujian tidak ditemukan.</p>;
                                                   
                                                   return relatedExam.questions.map((q, idx) => {
                                                       const ans = selectedHistory.answers[q.id];
                                                       let isCorrect = false;
                                                       if (q.type === QuestionType.SINGLE) {
                                                           if (ans === q.correctAnswerIndex) isCorrect = true;
                                                       } else if (q.type === QuestionType.COMPLEX) {
                                                           const userSet = new Set(ans as number[]);
                                                           const correctSet = new Set(q.correctAnswerIndices);
                                                           if (userSet.size === correctSet.size && [...userSet].every(x => correctSet.has(x))) isCorrect = true;
                                                       } else if (q.type === QuestionType.MATCHING) {
                                                            isCorrect = true; 
                                                            const userPairs = ans as Record<string, string>;
                                                            if (userPairs && q.matchingPairs) {
                                                                const allCorrect = q.matchingPairs.every(pair => userPairs[pair.left] === pair.right);
                                                                if (!allCorrect) isCorrect = false;
                                                            } else {
                                                                isCorrect = false;
                                                            }
                                                       }
                                                       
                                                       return (
                                                           <div key={q.id} className="flex items-start gap-3 p-4 rounded-xl bg-white border-2 border-slate-100 hover:border-slate-300 transition-colors">
                                                               <div className={`flex-none w-6 h-6 flex items-center justify-center rounded-md font-black text-xs shadow-sm ${isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                                                   {idx + 1}
                                                               </div>
                                                               <div className="flex-1 min-w-0 prose prose-sm text-slate-700 font-medium">
                                                                   {/* Math Render in History */}
                                                                   <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{p: 'p'}}>{q.text}</ReactMarkdown>
                                                               </div>
                                                               <div className="flex-none">
                                                                   {isCorrect ? (
                                                                       <span className="text-[10px] font-black uppercase text-green-600 bg-green-100 px-2 py-1 rounded border border-green-200">Benar</span>
                                                                   ) : (
                                                                       <span className="text-[10px] font-black uppercase text-red-600 bg-red-100 px-2 py-1 rounded border border-red-200">Salah</span>
                                                                   )}
                                                               </div>
                                                           </div>
                                                       );
                                                   });
                                                })()}
                                            </div>
                                         </div>

                                         <div className="text-center text-xs text-slate-400 font-medium border-t border-slate-100 pt-4 bg-slate-50 p-4 rounded-xl">
                                             Detail jawaban disimpan di server untuk analisis lebih lanjut oleh guru.
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