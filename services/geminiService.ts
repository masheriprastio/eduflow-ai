
import { GoogleGenAI } from "https://esm.sh/@google/genai@^1.41.0";
import { Question } from "../types";
import { supabase } from "./supabase";

const MODEL_NAME = 'gemini-3-flash-preview';
const CONFIG_MODULE_ID = '00000000-0000-0000-0000-000000000000';
const CONFIG_MODULE_TITLE = 'SYSTEM_CONFIG_DO_NOT_DELETE';

// Global variable to store key fetched from DB (Supabase)
let dbApiKey: string | null = null;

export const setGlobalApiKey = (key: string) => {
  dbApiKey = key;
};

// Helper aman untuk membaca Environment Variables
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
const getAiClient = async (): Promise<GoogleGenAI | null> => {
  let apiKey = dbApiKey || '';

  if (!apiKey) {
      try {
          // A. Try standard system_settings
          let { data } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'gemini_api_key')
            .single();
          
          if (data && data.value) {
              apiKey = data.value;
          } else {
             // B. Fallback: Try 'modules' table
             let modResult = await supabase
                .from('modules')
                .select('description')
                .eq('id', CONFIG_MODULE_ID)
                .single();
             
             if (!modResult.data) {
                 modResult = await supabase
                    .from('modules')
                    .select('description')
                    .eq('title', CONFIG_MODULE_TITLE)
                    .limit(1)
                    .single();
             }

             if (modResult.data && modResult.data.description) {
                 apiKey = modResult.data.description;
             }
          }

          if (apiKey) setGlobalApiKey(apiKey);

      } catch (err) {}
  }

  try {
      if (!apiKey && typeof window !== 'undefined') {
          apiKey = localStorage.getItem('USER_API_KEY') || '';
      }
  } catch (e) {}

  if (!apiKey) {
      apiKey = getEnv('VITE_API_KEY', 'REACT_APP_API_KEY') || getEnv('API_KEY');
  }
  
  if (!apiKey || apiKey === 'dummy-key') {
      return null;
  }
  
  return new GoogleGenAI({ apiKey });
};

// --- MOCK GENERATORS (FALLBACKS) ---

const mockDelay = () => new Promise(resolve => setTimeout(resolve, 1000));

/**
 * Generates a summary and tags for a learning module.
 */
export const generateModuleMetadata = async (title: string, contentSnippet: string) => {
  const ai = await getAiClient();

  if (!ai) {
    await mockDelay();
    return {
      summary: `(Mode Demo AI) Ini adalah ringkasan otomatis simulasi untuk materi "${title}".`,
      tags: ["Demo", "Belajar", "Simulasi"]
    };
  }

  try {
    const prompt = `
      Saya mengunggah materi: "${title}".
      Konteks: "${contentSnippet}".
      
      Buatkan:
      1. Ringkasan menarik (maks 2 kalimat).
      2. 3-5 tags relevan.

      Output JSON:
      { "summary": "string", "tags": ["string"] }
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    let text = response.text || "{}";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(text) as { summary: string; tags: string[] };
  } catch (error) {
    console.error("Metadata error:", error);
    return { summary: "Ringkasan manual (AI sibuk).", tags: ["Manual"] };
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
): Promise<Question[]> => {
  const ai = await getAiClient();

  // MOCK MODE
  if (!ai) {
    await mockDelay();
    return Array.from({ length: count }).map((_, i) => ({
      id: `mock-${i}`,
      type,
      question: `(Demo) Pertanyaan simulasi ke-${i+1} tentang ${title}?`,
      options: type === 'MULTIPLE_CHOICE' ? ["Opsi A", "Opsi B", "Opsi C", "Opsi D"] : undefined,
      correctAnswer: type === 'MULTIPLE_CHOICE' ? "Opsi A" : "Kunci jawaban simulasi"
    }));
  }

  try {
    let formatInstruction = type === 'MULTIPLE_CHOICE' 
      ? `Format JSON: [{"id": "uuid", "type": "MULTIPLE_CHOICE", "question": "...", "options": ["A","B","C","D"], "correctAnswer": "A"}]`
      : `Format JSON: [{"id": "uuid", "type": "ESSAY", "question": "...", "correctAnswer": "..."}]`;

    const promptText = `
      Topik: "${title}"
      Konteks: "${contentContext}"
      
      Buat ${count} soal ${type === 'MULTIPLE_CHOICE' ? 'Pilihan Ganda' : 'Esai'} level ${difficulty}.
      Bahasa Indonesia.
      ${formatInstruction}
    `;

    let responseText = "";

    // 1. Try Primary Method (With Files if available)
    try {
        const parts: any[] = [];
        if (files && files.length > 0) {
            files.forEach(f => {
                parts.push({ inlineData: { mimeType: f.mimeType, data: f.data } });
            });
        }
        parts.push({ text: promptText });

        const result = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: { parts },
            config: { responseMimeType: "application/json" }
        });
        responseText = result.text || "";

    } catch (e: any) {
        // 2. Immediate Fallback to Text-Only (Jika error quota/limit/file size)
        console.warn("Primary generation failed. Switching to Text-Only mode.");
        
        // Hapus file dari request, hanya kirim text prompt
        const result = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: promptText, 
            config: { responseMimeType: "application/json" }
        });
        responseText = result.text || "";
    }

    if (!responseText) throw new Error("Empty response");

    // Sanitize & Parse
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(responseText);

    return parsed.map((q: any) => ({
        id: q.id || `gen-${Math.random().toString(36).substr(2, 9)}`,
        type: q.type,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer
    }));

  } catch (error: any) {
    console.error("Quiz gen error:", error);
    let msg = "Gagal membuat soal.";
    if (error.message.includes('429')) msg = "Limit API tercapai. Mohon tunggu sebentar sebelum mencoba lagi.";
    throw new Error(msg);
  }
};

/**
 * Allows a student to ask a question about a specific module.
 */
export const askAboutModule = async (moduleTitle: string, moduleContext: string, question: string) => {
  const ai = await getAiClient();
  if (!ai) return "Fitur tanya jawab belum aktif (API Key missing).";

  try {
    const prompt = `Tutor AI. Topik: ${moduleTitle}. Konteks: ${moduleContext}. Pertanyaan: ${question}. Jawab singkat jelas.`;
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    return "Maaf, AI sedang sibuk. Coba lagi nanti.";
  }
};
