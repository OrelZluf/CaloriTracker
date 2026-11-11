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

const LABEL_ANALYSIS_PROMPT = `אתה מומחה לתזונה וקריאת תוויות מזון ישראליות (סימון תזונתי ל-100 גרם או למנה).
חלץ מתמונת התווית התזונתית את שם המוצר והערכים התזונתיים המדויקים והחזר JSON בלבד במבנה הבא:
{
  "title": "שם המוצר בעברית",
  "ingredients": [
    {
      "name": "שם המוצר בעברית",
      "category": "protein|carb|fat|vegetable|fruit|dairy|other",
      "estimated_grams": 100,
      "calories": 120,
      "protein_grams": 10,
      "carbs_grams": 8,
      "fat_grams": 5,
      "fiber_grams": 0,
      "sugar_grams": 3
    }
  ]
}
החזר JSON תקין בלבד ללא טקסט נוסף.`;

/**
 * Analyze a nutrition facts label image using Gemini vision.
 */
async function analyzeNutritionLabelImage(imagePath) {
  const ai = getAI();
  const absolutePath = path.resolve(imagePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Image file not found: ${absolutePath}`);
  }

  const imageBuffer = fs.readFileSync(absolutePath);
  const base64Image = imageBuffer.toString('base64');
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
      { text: LABEL_ANALYSIS_PROMPT }
    ]
  });

  return parseGeminiResponse(response.text);
}

/**
 * Built-in catalog of common Israeli products for instant barcode lookup & fallback.
 */
const ISRAELI_BARCODE_CATALOG = {
  '7290004127329': {
    title: 'קוטג׳ תנובה 5% (גביע 250 גרם)',
    barcode: '7290004127329',
    brand: 'תנובה',
    ingredients: [{
      name: 'גבינת קוטג׳ 5% תנובה',
      category: 'dairy',
      estimated_grams: 250,
      calories: 238,
      protein_grams: 28,
      carbs_grams: 4,
      fat_grams: 13,
      fiber_grams: 0,
      sugar_grams: 4
    }]
  },
  '7290107940016': {
    title: 'יוגורט דנונה PRO חלבון 20 גרם',
    barcode: '7290107940016',
    brand: 'שטראוס דנונה',
    ingredients: [{
      name: 'יוגורט דנונה PRO וניל',
      category: 'dairy',
      estimated_grams: 200,
      calories: 142,
      protein_grams: 20,
      carbs_grams: 12,
      fat_grams: 1.5,
      fiber_grams: 0,
      sugar_grams: 10
    }]
  },
  '7290004131074': {
    title: 'משקה חלבון GO תנובה (25g חלבון)',
    barcode: '7290004131074',
    brand: 'תנובה GO',
    ingredients: [{
      name: 'משקה חלבון GO',
      category: 'dairy',
      estimated_grams: 340,
      calories: 190,
      protein_grams: 25,
      carbs_grams: 16,
      fat_grams: 2.5,
      fiber_grams: 0,
      sugar_grams: 14
    }]
  },
  '7290000068787': {
    title: 'חטיף במבה אסם (שקית 80 גרם)',
    barcode: '7290000068787',
    brand: 'אסם',
    ingredients: [{
      name: 'במבה אסם',
      category: 'fat',
      estimated_grams: 80,
      calories: 427,
      protein_grams: 14,
      carbs_grams: 45,
      fat_grams: 28,
      fiber_grams: 3,
      sugar_grams: 3
    }]
  },
  '7290000802220': {
    title: 'לחם עינן מלא אנג׳ל (2 פרוסות)',
    barcode: '7290000802220',
    brand: 'מאפיית אנג׳ל',
    ingredients: [{
      name: 'לחם חיטה מלאה (2 פרוסות)',
      category: 'carb',
      estimated_grams: 60,
      calories: 138,
      protein_grams: 6.5,
      carbs_grams: 23,
      fat_grams: 1.5,
      fiber_grams: 5,
      sugar_grams: 1
    }]
  }
};

/**
 * Lookup product by barcode from local Israeli catalog or OpenFoodFacts API.
 */
async function lookupBarcodeProduct(rawBarcode) {
  const code = String(rawBarcode || '').trim();
  if (!/^\d{6,14}$/.test(code)) {
    throw new Error('INVALID_BARCODE');
  }

  if (ISRAELI_BARCODE_CATALOG[code]) {
    return ISRAELI_BARCODE_CATALOG[code];
  }

  // Query OpenFoodFacts API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'CaloriTrack/1.0 (https://github.com/OrelZluf/CaloriTracker)' }
    });
    clearTimeout(timeout);

    if (response.ok) {
      const json = await response.json();
      if (json && json.status === 1 && json.product) {
        const p = json.product;
        const n = p.nutriments || {};
        const name = p.product_name_he || p.product_name || p.generic_name || `מוצר (${code})`;
        const brand = p.brands || '';
        const title = brand ? `${name} - ${brand}` : name;

        const calories100 = Math.round(Number(n['energy-kcal_100g'] || n['energy-kcal'] || 0));
        const protein100 = Math.round(Number(n.proteins_100g || n.proteins || 0) * 10) / 10;
        const carbs100 = Math.round(Number(n.carbohydrates_100g || n.carbohydrates || 0) * 10) / 10;
        const fat100 = Math.round(Number(n.fat_100g || n.fat || 0) * 10) / 10;
        const fiber100 = Math.round(Number(n.fiber_100g || n.fiber || 0) * 10) / 10;
        const sugar100 = Math.round(Number(n.sugars_100g || n.sugars || 0) * 10) / 10;

        let category = 'other';
        if (protein100 >= 15 && protein100 >= carbs100) category = 'protein';
        else if (carbs100 >= 25) category = 'carb';
        else if (fat100 >= 20) category = 'fat';

        return {
          title,
          barcode: code,
          brand,
          ingredients: [
            {
              name,
              category,
              estimated_grams: 100,
              calories: calories100,
              protein_grams: protein100,
              carbs_grams: carbs100,
              fat_grams: fat100,
              fiber_grams: fiber100,
              sugar_grams: sugar100
            }
          ]
        };
      }
    }
  } catch (err) {
    // Fall through to NOT_FOUND
  }

  return null;
}

module.exports = {
  analyzeMealImage,
  analyzeMealText,
  analyzeActivityText,
  generateDailyInsight,
  analyzeNutritionLabelImage,
  lookupBarcodeProduct,
  ISRAELI_BARCODE_CATALOG
};
