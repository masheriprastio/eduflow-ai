import { GoogleGenAI } from "@google/genai";
import { Question } from "../types";

const MODEL_NAME = 'gemini-3-flash-preview';

// Helper to get AI client safely inside functions
const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
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