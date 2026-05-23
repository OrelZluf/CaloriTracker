const fs = require('fs');
const path = require('path');
const { getAI, MODEL_NAME } = require('../config/gemini');

const ANALYSIS_PROMPT = `אתה דיאטן מומחה ומנתח תזונה. נתח את הארוחה וזהה את כל המרכיבים שלה.

עבור כל מרכיב, העריך את המשקל בגרמים ואת הערכים התזונתיים.

החזר את התשובה בפורמט JSON בלבד, ללא טקסט נוסף, בדיוק במבנה הבא:
{
  "title": "שם הארוחה בעברית",
  "ingredients": [
    {
      "name": "שם המרכיב בעברית",
      "category": "protein|carb|fat|vegetable|fruit|dairy|other",
      "estimated_grams": 100,
      "calories": 200,
      "protein_grams": 25,
      "carbs_grams": 0,
      "fat_grams": 10,
      "fiber_grams": 0,
      "sugar_grams": 0
    }
  ]
}

חשוב:
- category חייב להיות אחד מהערכים: protein, carb, fat, vegetable, fruit, dairy, other
- כל הערכים המספריים חייבים להיות מספרים (לא מחרוזות)
- שמות המרכיבים חייבים להיות בעברית
- החזר JSON בלבד, ללא markdown או טקסט נוסף`;

/**
 * Parse JSON from Gemini response, stripping markdown code blocks if present.
 */
function parseGeminiResponse(responseText) {
  let cleaned = responseText.trim();

  // Strip markdown code block markers
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    throw new Error(`Failed to parse Gemini response as JSON: ${error.message}\nRaw response: ${responseText}`);
  }
}

/**
 * Analyze a meal image using Gemini vision model.
 * @param {string} imagePath - Path to the meal image file
 * @returns {Promise<Object>} Parsed meal analysis with title and ingredients
 */
async function analyzeMealImage(imagePath) {
  const ai = getAI();

  const absolutePath = path.resolve(imagePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Image file not found: ${absolutePath}`);
  }

  const imageBuffer = fs.readFileSync(absolutePath);
  const base64Image = imageBuffer.toString('base64');

  // Detect mime type from extension
  const ext = path.extname(absolutePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp'
  };
  const mimeType = mimeTypes[ext] || 'image/jpeg';

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [
      { inlineData: { mimeType, data: base64Image } },
      { text: `נתח את הארוחה בתמונה.\n\n${ANALYSIS_PROMPT}` }
    ]
  });

  return parseGeminiResponse(response.text);
}

/**
 * Analyze a meal from text description using Gemini.
 * @param {string} description - Text description of the meal in Hebrew
 * @returns {Promise<Object>} Parsed meal analysis with title and ingredients
 */
async function analyzeMealText(description) {
  const ai = getAI();

  const prompt = `הארוחה שלי: ${description}\n\n${ANALYSIS_PROMPT}`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt
  });

  return parseGeminiResponse(response.text);
}

module.exports = { analyzeMealImage, analyzeMealText };
