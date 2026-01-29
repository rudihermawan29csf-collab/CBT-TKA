export enum Role {
  ADMIN = 'ADMIN',
  STUDENT = 'STUDENT',
  TEACHER_LITERASI = 'TEACHER_LITERASI',
  TEACHER_NUMERASI = 'TEACHER_NUMERASI'
}

export enum QuestionType {
  SINGLE = 'Pilihan Ganda',
  COMPLEX = 'Pilihan Ganda Kompleks',
  MATCHING = 'Benar / Salah (Tabel)'
}

export enum QuestionCategory {
  LITERASI = 'Literasi',
  NUMERASI = 'Numerasi'
}

export interface Student {
  id: string;
  no: number;
  name: string;
  class: string;
  nis: string;
  nisn: string;
}

export interface Teacher {
  id: string;
  name: string;
  nip: string;
  subject: string;
  teachingClasses: string[];
}

export interface QuestionPacket {
  id: string;
  name: string; 
  category: QuestionCategory;
  totalQuestions: number; // New: Total planned questions
  questionTypes: Record<number, QuestionType>; // New: Mapping of Question Number -> Type
}

export interface Question {
  id: string;
  packetId?: string; 
  number?: number; // New: Explicit question number order
  stimulus?: string; 
  text: string;      
  image?: string; 
  type: QuestionType;
  // For Single and Complex
  options?: string[]; 
  correctAnswerIndex?: number; 
  correctAnswerIndices?: number[]; 
  // For Matching / Table Logic
  matchingPairs?: { left: string; right: string }[]; 
  category?: string;
}

export interface Exam {
  id: string;
  title: string;
  packetId: string; 
  scheduledStart: string; 
  scheduledEnd: string; 
  durationMinutes: number;
  classTarget: string[];
  questions: Question[]; 
  isActive: boolean;
}

export interface UserSession {
  role: Role;
  name: string;
  id: string;
  details?: Student;
}

export interface AIQuestionRequest {
  topic: string;
  subject: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}