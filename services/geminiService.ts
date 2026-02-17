import { GoogleGenAI } from "https://esm.sh/@google/genai@^1.41.0";
import { Question } from "../types";

const MODEL_NAME = 'gemini-3-flash-preview';

// Helper aman untuk membaca Environment Variables (Duplikasi agar tidak ada dependensi silang)
const getEnv = (key: string, fallbackKey?: string): string => {
  let value = '';
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
         // @ts-ignore
        value = import.meta.env[key] || (fallbackKey ? import.meta.env[fallbackKey] : '');
    }
  } catch (e) {}
  if (!value) {
    try {
        if (typeof process !== 'undefined' && process.env) {
            value = process.env[key] || (fallbackKey ? process.env[fallbackKey] : '') || '';
        }
    } catch (e) {}
  }
  return value;
};

// Helper to get AI client safely inside functions
const getAiClient = () => {
  // Gunakan getEnv agar tidak crash di browser yang tidak memiliki 'process'
  const apiKey = getEnv('VITE_API_KEY', 'REACT_APP_API_KEY') || getEnv('API_KEY');
  
  if (!apiKey) {
      console.warn("Gemini API Key missing!");
      // Kembalikan dummy agar tidak crash saat init, error akan muncul saat generateContent dipanggil
      return new GoogleGenAI({ apiKey: 'dummy-key' });
  }
  
  return new GoogleGenAI({ apiKey });
};

/**
 * Generates a summary and tags for a learning module.
 */
export const generateModuleMetadata = async (title: string, contentSnippet: string) => {
  try {
    const ai = getAiClient();
    const prompt = `
      Saya adalah seorang Admin di sistem pembelajaran. Saya baru saja mengunggah materi dengan judul: "${title}".
      Konteks atau isi singkatnya adalah: "${contentSnippet}".

      Tolong buatkan:
      1. Ringkasan menarik (maksimal 2 kalimat) untuk siswa.
      2. 3-5 tags yang relevan.

      Berikan output dalam format JSON:
      {
        "summary": "string",
        "tags": ["string", "string"]
      }
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as { summary: string; tags: string[] };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return null;
  }
};

/**
 * Generates Quiz Questions based on context, type, difficulty and count.
 */
export const generateQuizQuestions = async (
  title: string, 
  contentContext: string, 
  type: 'MULTIPLE_CHOICE' | 'ESSAY', 
  difficulty: 'HOTS' | 'BASIC' | 'MIX',
  count: number
): Promise<Question[] | null> => {
  try {
    const ai = getAiClient();
    let formatInstruction = "";
    
    if (type === 'MULTIPLE_CHOICE') {
      formatInstruction = `
        Format JSON (Array of Objects):
        [
          {
            "id": "generate_unique_id_here",
            "type": "MULTIPLE_CHOICE",
            "question": "Pertanyaan?",
            "options": ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"],
            "correctAnswer": "Pilihan A"
          }
        ]
        Pastikan "options" berisi 4 string. "correctAnswer" harus sama persis dengan salah satu options.
      `;
    } else {
      formatInstruction = `
        Format JSON (Array of Objects):
        [
          {
            "id": "generate_unique_id_here",
            "type": "ESSAY",
            "question": "Pertanyaan?",
            "correctAnswer": "Rubrik penilaian/poin kunci jawaban."
          }
        ]
      `;
    }

    // Determine Difficulty Instruction
    let difficultyPrompt = "";
    if (difficulty === 'HOTS') {
        difficultyPrompt = `
        KRITERIA: HIGHER ORDER THINKING SKILLS (HOTS).
        1. JANGAN buat soal hafalan/definisi sederhana (C1/C2).
        2. Buatlah soal berbasis STUDI KASUS, ANALISIS, EVALUASI, atau PEMECAHAN MASALAH (C4-C6).
        3. Berikan skenario singkat atau data konteks nyata sebelum pertanyaan.
        `;
    } else if (difficulty === 'BASIC') {
        difficultyPrompt = `
        KRITERIA: BASIC / LOTS (Lower Order Thinking Skills).
        1. Fokus pada PENGINGATAN (Recall) dan PEMAHAMAN KONSEP DASAR (C1-C2).
        2. Pertanyaan boleh bersifat definisi, identifikasi fakta, atau ciri-ciri.
        3. Gunakan bahasa yang lugas dan langsung ke pokok pertanyaan.
        `;
    } else {
        // MIX
        difficultyPrompt = `
        KRITERIA: CAMPURAN (MIXED).
        1. Variasikan tingkat kesulitan soal.
        2. Buat sebagian soal berupa Pemahaman Dasar/Hafalan (C1-C2).
        3. Buat sebagian soal berupa Analisis/Penerapan (C3-C5).
        4. Pastikan ada keseimbangan antara teori dan logika.
        `;
    }

    const prompt = `
      Bertindaklah sebagai Guru Pembuat Soal Profesional.
      Materi: "${title}" - "${contentContext}".

      TUGAS: Buatkan ${count} soal ${type === 'MULTIPLE_CHOICE' ? 'Pilihan Ganda' : 'Esai/Uraian'}.

      ${difficultyPrompt}

      UMUM:
      1. Pilihan jawaban pengecoh (distractor) harus logis.
      2. Bahasa Indonesia baku akademis.

      ${formatInstruction}
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) return null;
    
    const parsedQuestions = JSON.parse(text);

    // Post-process: Simple mapping without image generation logic
    const processedQuestions = parsedQuestions.map((q: any) => {
        return {
            id: q.id,
            type: q.type,
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer
        } as Question;
    });

    return processedQuestions;

  } catch (error) {
    console.error("Error generating quiz:", error);
    return null;
  }
};

/**
 * Allows a student to ask a question about a specific module.
 */
export const askAboutModule = async (moduleTitle: string, moduleContext: string, question: string) => {
  try {
    const ai = getAiClient();
    const prompt = `
      Anda adalah tutor AI.
      Konteks modul: "${moduleTitle}" - "${moduleContext}".
      Pertanyaan Siswa: "${question}"
      Jawab maksimal 3 paragraf pendek.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Error asking Gemini:", error);
    return "Maaf, saya sedang mengalami gangguan koneksi ke otak AI saya. Coba lagi nanti ya!";
  }
};