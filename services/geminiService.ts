import { GoogleGenAI } from "https://esm.sh/@google/genai@^1.41.0";
import { Question } from "../types";

const MODEL_NAME = 'gemini-3-flash-preview';

// Global variable to store key fetched from DB (Supabase)
let dbApiKey: string | null = null;

export const setGlobalApiKey = (key: string) => {
  dbApiKey = key;
};

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
  // 1. Coba gunakan Key dari Database (Global Setting yang diset Admin)
  let apiKey = dbApiKey || '';

  // 2. Coba ambil dari Local Storage (Fallback input manual per device)
  try {
      if (!apiKey && typeof window !== 'undefined') {
          apiKey = localStorage.getItem('USER_API_KEY') || '';
      }
  } catch (e) {}

  // 3. Jika tidak ada, coba Environment Variables
  if (!apiKey) {
      apiKey = getEnv('VITE_API_KEY', 'REACT_APP_API_KEY') || getEnv('API_KEY');
  }
  
  // 4. Validasi
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
      summary: `(Mode Demo AI) Ini adalah ringkasan otomatis simulasi untuk materi "${title}". Masukkan API Key di menu Pengaturan (ikon gerigi) untuk hasil nyata.`,
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
       summary: "Gagal menghasilkan ringkasan AI. Pastikan API Key valid dan koneksi stabil.",
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
  count: number,
  files?: { mimeType: string; data: string }[]
): Promise<Question[] | null> => {
  const ai = getAiClient();

  // MOCK MODE (Jika API Key tidak ada)
  if (!ai) {
    await mockDelay();
    const mockQuestions: Question[] = Array.from({ length: count }).map((_, i) => ({
      id: `mock-q-${Date.now()}-${i}`,
      type: type,
      question: `(Soal Demo AI ${i+1}) Jelaskan konsep dasar dari materi ${title}? [Mode Simulasi - Input API Key untuk Soal Nyata]`,
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
            "question": "Pertanyaan yang jelas dan spesifik?",
            "options": ["Jawaban Benar", "Pengecoh Masuk Akal 1", "Pengecoh Masuk Akal 2", "Pengecoh Masuk Akal 3"],
            "correctAnswer": "Jawaban Benar"
          }
        ]
        ATURAN OPSI JAWABAN:
        1. "options" HARUS berisi 4 string.
        2. Opsi jawaban harus HOMOGEN (sejenis) dan panjang kalimatnya seimbang.
        3. Pengecoh (distractor) HARUS relevan dengan topik "${title}", jangan gunakan jawaban yang konyol atau jelas salah bagi orang awam.
        4. Jangan gunakan "Semua Benar" atau "Semua Salah" kecuali sangat diperlukan.
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
        LEVEL: SULIT / HOTS (Higher Order Thinking Skills).
        - Soal harus berbasis ANALISIS kasus, EVALUASI data, atau MENYIMPULKAN.
        - Hindari pertanyaan "Apa itu..." atau "Sebutkan...".
        - Berikan konteks/skenario sebelum pertanyaan jika memungkinkan.
        `;
    } else if (difficulty === 'BASIC') {
        difficultyPrompt = `
        LEVEL: MUDAH / BASIC.
        - Fokus pada ingatan (recall) definisi, istilah, atau fakta dasar dari materi.
        - Bahasa langsung dan mudah dipahami.
        `;
    } else {
        // MIX
        difficultyPrompt = `
        LEVEL: CAMPURAN (Mixed).
        - Buat variasi antara soal definisi dasar dan soal analisis.
        `;
    }

    const promptText = `
      Bertindaklah sebagai Guru Ahli Pembuat Soal Ujian.
      
      TOPIK UTAMA: "${title}"
      
      BAHAN SUMBER (CONTEXT):
      "${contentContext}"

      INSTRUKSI:
      Buatkan ${count} soal ${type === 'MULTIPLE_CHOICE' ? 'Pilihan Ganda' : 'Esai/Uraian'} berdasarkan BAHAN SUMBER di atas (dan dokumen/gambar jika dilampirkan).
      
      PENTING:
      1. Jika Bahan Sumber sangat singkat, gunakan pengetahuan umum Anda yang VALID tentang topik "${title}" untuk memperkaya soal, NAMUN tetap relevan.
      2. Jangan membuat soal yang jawabannya tidak bisa ditemukan atau disimpulkan dari logika topik tersebut.
      3. Bahasa Indonesia formal dan akademis.

      ${difficultyPrompt}

      ${formatInstruction}
    `;

    const parts: any[] = [];
    if (files && files.length > 0) {
      files.forEach(f => {
        parts.push({
            inlineData: {
                mimeType: f.mimeType,
                data: f.data
            }
        });
      });
    }
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        temperature: 0.5, // Lower temperature to be more deterministic/relevant
      }
    });

    const text = response.text;
    if (!text) return null;
    
    const parsedQuestions = JSON.parse(text);

    // Post-process: Simple mapping without image generation logic
    const processedQuestions = parsedQuestions.map((q: any) => {
        return {
            id: q.id || `gen-${Date.now()}-${Math.random()}`,
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
    return `(Tutor AI Demo) Halo! Sepertinya Admin/Guru belum mengonfigurasi API Key di sistem. Harap hubungi guru Anda agar saya bisa aktif.`;
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
    return "Maaf, saya sedang mengalami gangguan koneksi ke otak AI saya (Mungkin API Key tidak valid atau kuota habis). Coba cek pengaturan key Anda.";
  }
};