import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType } from "../types";

// Note: In a real app, this key should be secure.
// For this demo, we assume process.env.API_KEY is available or the user will handle it.
const apiKey = process.env.API_KEY || ''; 

const ai = new GoogleGenAI({ apiKey });

export const generateQuestionWithAI = async (
  topic: string,
  subject: string,
  level: string
): Promise<Omit<Question, 'id'> | null> => {
  if (!apiKey) {
    console.error("API Key missing");
    return null;
  }

  try {
    const prompt = `Buatkan satu soal pilihan ganda untuk mata pelajaran ${subject} dengan topik "${topic}" untuk siswa kelas ${level}. 
    Berikan 4 pilihan jawaban dan tunjukkan kunci jawabannya. Output harus dalam format JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "Pertanyaan soal" },
            options: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Array berisi 4 pilihan jawaban" 
            },
            correctAnswerIndex: { 
              type: Type.INTEGER, 
              description: "Index jawaban benar (0-3)" 
            }
          }
        }
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      return { ...parsed, type: QuestionType.SINGLE } as Omit<Question, 'id'>;
    }
    return null;

  } catch (error) {
    console.error("Error generating question with AI:", error);
    return null;
  }
};