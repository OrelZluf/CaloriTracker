const { GoogleGenAI } = require('@google/genai');

const MODEL_NAME = 'gemini-3.5-flash';

let ai;

function getAI() {
  if (!ai) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

module.exports = { getAI, MODEL_NAME };
