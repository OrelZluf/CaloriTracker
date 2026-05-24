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

const ACTIVITY_PROMPT = `אתה מומחה לכושר גופני ופעילות ספורטיבית. המשתמש יתאר לך פעילות גופנית שהוא ביצע.
נתח את הטקסט שלו והחזר JSON בלבד במבנה הבא:
{
  "title": "תיאור קצר של הפעילות",
  "activities": [
    {
      "activity_type": "שם הפעילות (לדוגמה: ריצה, הליכה, שחייה, אימון כוח)",
      "duration_minutes": 30,
      "met_value": 7.5
    }
  ]
}

- met_value (Metabolic Equivalent of Task) חייב להיות מספר המייצג את הוצאת האנרגיה (למשל הליכה קלה = 3.0, ריצה = 9.8, אימון משקולות = 6.0).
- החזר רק JSON תקין.`;

/**
 * Analyze an exercise/activity description using Gemini.
 */
async function analyzeActivityText(description) {
  const ai = getAI();

  const prompt = `הפעילות שלי: ${description}\n\n${ACTIVITY_PROMPT}`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt
  });

  return parseGeminiResponse(response.text);
}

const INSIGHT_PROMPT = `אתה דיאטן ומומחה כושר אישי. המטרה שלך היא לתת משוב יומי קצר, בונה ומעודד למשתמש, בהתבסס על מה שהוא אכל ואיזה פעילות גופנית הוא עשה אתמול.
התייחס ליעד הקלוריות שלו ולמאזן היומי שלו. 

החזר JSON בלבד במבנה הבא:
{
  "preserve_text": "פסקה קצרה (עד 2 משפטים) שמתארת מה היה טוב אתמול וכדאי לשמר (למשל: צריכת חלבון טובה, אימון מצוין, עמידה ביעד הקלורי).",
  "improve_text": "פסקה קצרה (עד 2 משפטים) שמתארת מה טעון שיפור (למשל: אכלת קצת יותר מדי פחמימות ריקות בערב, כדאי להוסיף קצת פעילות גופנית)."
}

דגשים:
- הייה חיובי ובונה.
- דבר ישירות למשתמש (בגוף שני: "אכלת", "עשית").
- אל תשתמש ב-Markdown בתוך הטקסט, רק טקסט פשוט.
- החזר רק JSON תקין!`;

/**
 * Generate a daily insight based on yesterday's meals and activities.
 */
async function generateDailyInsight(meals, activities, userProfile) {
  const ai = getAI();

  const dataContext = `
נתוני המשתמש:
יעד קלוריות יומי: ${userProfile.daily_calorie_goal}

ארוחות שאכל אתמול:
${meals.map(m => `- ${m.title} (${m.meal_type}): ${m.total_calories} קלוריות`).join('\n') || 'לא הוזנו ארוחות'}

פעילויות שביצע אתמול:
${activities.map(a => `- ${a.title} (${a.duration_minutes} דקות): שרף ${a.calories_burned} קלוריות`).join('\n') || 'לא בוצעה פעילות גופנית'}
`;

  const prompt = `${dataContext}\n\n${INSIGHT_PROMPT}`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt
  });

  return parseGeminiResponse(response.text);
}

module.exports = { analyzeMealImage, analyzeMealText, analyzeActivityText, generateDailyInsight };
