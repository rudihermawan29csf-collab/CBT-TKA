import { Student, Exam, Question, QuestionType, QuestionCategory, QuestionPacket } from './types';

export const CLASS_LIST = [
  "VII A", "VII B", "VII C",
  "VIII A", "VIII B", "VIII C",
  "IX A", "IX B", "IX C"
];

export const MOCK_STUDENTS: Student[] = [
  { id: '1', no: 1, name: "Ahmad Santoso", class: "IX A", nis: "12345", nisn: "0012345678" },
  { id: '2', no: 2, name: "Siti Aminah", class: "IX A", nis: "12346", nisn: "0012345679" },
  { id: '3', no: 3, name: "Budi Pratama", class: "VII B", nis: "12347", nisn: "0012345680" },
  { id: '4', no: 4, name: "Dewi Lestari", class: "VII A", nis: "12348", nisn: "0012345681" },
];

export const MOCK_PACKETS: QuestionPacket[] = [
  {
    id: 'pkt-1',
    name: 'Latihan Literasi Dasar',
    category: QuestionCategory.LITERASI,
    totalQuestions: 3,
    questionTypes: {
        1: QuestionType.SINGLE,
        2: QuestionType.COMPLEX,
        3: QuestionType.MATCHING
    }
  }
];

export const MOCK_QUESTIONS: Question[] = [
  {
    id: 'q1',
    packetId: 'pkt-1',
    number: 1,
    stimulus: "Indonesia adalah negara kepulauan terbesar di dunia yang terdiri dari lebih dari 17.000 pulau. Ibukota negara ini terletak di pulau Jawa.",
    text: "Berdasarkan teks di atas, apa ibukota Indonesia saat ini?",
    type: QuestionType.SINGLE,
    options: ["Jakarta", "Bandung", "Surabaya", "Medan"],
    correctAnswerIndex: 0
  },
  {
    id: 'q2',
    packetId: 'pkt-1',
    number: 2,
    stimulus: "Bilangan prima adalah bilangan asli yang lebih besar dari 1, yang faktor pembaginya adalah 1 dan bilangan itu sendiri.",
    text: "Manakah yang termasuk bilangan prima? (Pilih lebih dari satu)",
    type: QuestionType.COMPLEX,
    options: ["2", "4", "5", "9"],
    correctAnswerIndices: [0, 2]
  },
  {
    id: 'q3',
    packetId: 'pkt-1',
    number: 3,
    text: "Pasangkan negara dengan ibukotanya",
    type: QuestionType.MATCHING,
    matchingPairs: [
      { left: "Jepang", right: "Tokyo" },
      { left: "Inggris", right: "London" },
      { left: "Perancis", right: "Paris" }
    ]
  }
];

export const MOCK_EXAMS: Exam[] = [
  {
    id: 'e1',
    title: "Ujian Tengah Semester Campuran",
    packetId: 'pkt-1',
    scheduledStart: new Date().toISOString(),
    scheduledEnd: new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 60,
    classTarget: ["IX A", "VII A", "VII B"],
    questions: MOCK_QUESTIONS,
    isActive: true
  }
];