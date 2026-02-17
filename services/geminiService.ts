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
// Returns NULL if no key is found (triggering Mock Mode)
const getAiClient = (): GoogleGenAI | null => {
  const apiKey = getEnv('VITE_API_KEY', 'REACT_APP_API_KEY') || getEnv('API_KEY');
  
  if (!apiKey || apiKey === 'dummy-key') {
      console.warn("Gemini API Key missing! Using Mock Mode.");
      return null;
  }
  
  return new GoogleGenAI({ apiKey });
};

// --- MOCK GENERATORS (FALLBACKS) ---

const mockDelay = () => new Promise(resolve => setTimeout(resolve, 1500));

/**
 * Generates a summary and tags for a learning module.
 */
export const generateModuleMetadata = async (title: string, contentSnippet: string) => {
  const ai = getAiClient();

  // MOCK MODE (Jika API Key tidak ada)
  if (!ai) {
    await mockDelay();
    return {
      summary: `(Mode Demo AI) Ini adalah ringkasan otomatis simulasi untuk materi "${title}". Dalam mode produksi dengan API Key aktif, bagian ini akan menjelaskan konten secara detail.`,
      tags: ["Demo", "Belajar", "Simulasi", "Materi"]
    };
  }

  try {
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
    // Fallback on error
    return {
       summary: "Gagal menghasilkan ringkasan AI. Pastikan koneksi internet stabil.",
       tags: ["Manual", "Error"]
    };
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
  const ai = getAiClient();

  // MOCK MODE (Jika API Key tidak ada)
  if (!ai) {
    await mockDelay();
    const mockQuestions: Question[] = Array.from({ length: count }).map((_, i) => ({
      id: `mock-q-${Date.now()}-${i}`,
      type: type,
      question: `(Soal Demo AI ${i+1}) Jelaskan konsep dasar dari materi ${title}? [Simulasi ${difficulty}]`,
      options: type === 'MULTIPLE_CHOICE' ? [
        "Jawaban Benar (Pilihan A)",
        "Pengecoh 1 (Pilihan B)",
        "Pengecoh 2 (Pilihan C)",
        "Pengecoh 3 (Pilihan D)"
      ] : undefined,
      correctAnswer: type === 'MULTIPLE_CHOICE' ? "Jawaban Benar (Pilihan A)" : "Ini adalah kunci jawaban simulasi untuk soal esai."
    }));
    return mockQuestions;
  }

  try {
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
  const ai = getAiClient();

  // MOCK MODE (Jika API Key tidak ada)
  if (!ai) {
    await mockDelay();
    return `(Tutor AI Demo) Halo! Karena API Key belum dikonfigurasi, saya hanya bisa memberikan respon simulasi.\n\nAnda bertanya tentang: "${question}" pada materi "${moduleTitle}".\n\nJawaban simulasi: Materi ini sangat penting untuk dipelajari lebih lanjut. Silakan baca dokumen lengkapnya untuk detail lebih akurat.`;
  }

  try {
    const prompt = `
      Anda adalah tutor AI yang ramah dan pintar.
      Konteks modul: "${moduleTitle}" - "${moduleContext}".
      Pertanyaan Siswa: "${question}"
      
      Jawablah dengan bahasa Indonesia yang mudah dimengerti siswa. Maksimal 3 paragraf pendek.
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