import { GoogleGenAI } from '@google/genai';

let geminiClient: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.trim() === '') {
    return null;
  }
  if (!geminiClient) {
    try {
      geminiClient = new GoogleGenAI({ apiKey: key });
    } catch (err) {
      console.warn('[Gemini] Failed to initialize GoogleGenAI client:', err);
      return null;
    }
  }
  return geminiClient;
}
