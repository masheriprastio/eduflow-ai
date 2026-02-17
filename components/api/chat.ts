import { GoogleGenerativeAI } from '@google/generative-ai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Hanya izinkan metode POST
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { message } = request.body;

  // Ambil API Key dari Environment Variable (Server-side only)
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return response.status(500).json({ error: 'API Key tidak dikonfigurasi di Vercel' });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(message);
    const resultResponse = await result.response;
    const text = resultResponse.text();

    return response.status(200).json({ text });
  } catch (error: any) {
    console.error(error);
    return response.status(500).json({ error: 'Gagal memproses permintaan AI' });
  }
}