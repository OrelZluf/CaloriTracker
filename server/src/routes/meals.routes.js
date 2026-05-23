const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const { upload, compressImage } = require('../middleware/upload.middleware');
const { analyzeMealImage, analyzeMealText } = require('../services/ai.service');
const { getDb } = require('../config/database');

/**
 * POST /api/meals/analyze-image
 * Upload and analyze a meal image with Gemini AI.
 */
router.post('/analyze-image', requireAuth, upload.single('image'), compressImage, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'נדרשת תמונה לניתוח.'
      });
    }

    const analysis = await analyzeMealImage(req.file.path);

    res.json({
      success: true,
      message: 'הארוחה נותחה בהצלחה!',
      data: {
        analysis,
        image_path: req.file.filename
      }
    });
  } catch (error) {
    console.error('Analyze image error:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בניתוח התמונה. אנא נסה שוב.'
    });
  }
});

/**
 * POST /api/meals/analyze-text
 * Analyze a meal from text description with Gemini AI.
 */
router.post('/analyze-text', requireAuth, async (req, res) => {
  try {
    const { description } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: 'נדרש תיאור הארוחה לניתוח.'
      });
    }

    const analysis = await analyzeMealText(description.trim());

    res.json({
      success: true,
      message: 'הארוחה נותחה בהצלחה!',
      data: {
        analysis
      }
    });
  } catch (error) {
    console.error('Analyze text error:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בניתוח תיאור הארוחה. אנא נסה שוב.'
    });
  }
});

/**
 * POST /api/meals
 * Save a meal with its ingredients to the database.
 */
router.post('/', requireAuth, (req, res) => {
  try {
    const { title, meal_type, image_path, input_method, raw_input, ingredients } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'נדרש שם לארוחה.'
      });
    }

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'נדרש לפחות מרכיב אחד לארוחה.'
      });
    }

    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    if (meal_type && !validMealTypes.includes(meal_type)) {
      return res.status(400).json({
        success: false,
        message: 'סוג ארוחה לא תקין. הערכים המותרים: breakfast, lunch, dinner, snack.'
      });
    }

    // Calculate totals from ingredients
    const totals = ingredients.reduce(
      (acc, ing) => {
        acc.calories += ing.calories || 0;
        acc.protein += ing.protein_grams || 0;
        acc.carbs += ing.carbs_grams || 0;
        acc.fat += ing.fat_grams || 0;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    const db = getDb();

    // Use a transaction for atomic insert
    const saveMeal = db.transaction(() => {
      const mealResult = db.prepare(`
        INSERT INTO meals (user_id, title, image_path, meal_type, total_calories, total_protein,
                          total_carbs, total_fat, input_method, raw_input)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.user.id,
        title.trim(),
        image_path || null,
        meal_type || null,
        totals.calories,
        totals.protein,
        totals.carbs,
        totals.fat,
        input_method || null,
        raw_input || null
      );

      const mealId = mealResult.lastInsertRowid;

      const insertIngredient = db.prepare(`
        INSERT INTO ingredients (meal_id, name, category, estimated_grams, calories,
                                protein_grams, carbs_grams, fat_grams, fiber_grams, sugar_grams)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const ing of ingredients) {
        insertIngredient.run(
          mealId,
          ing.name,
          ing.category || 'other',
          ing.estimated_grams || 0,
          ing.calories || 0,
          ing.protein_grams || 0,
          ing.carbs_grams || 0,
          ing.fat_grams || 0,
          ing.fiber_grams || 0,
          ing.sugar_grams || 0
        );
      }

      return mealId;
    });

    const mealId = saveMeal();

    // Fetch the saved meal with ingredients
    const meal = db.prepare('SELECT * FROM meals WHERE id = ?').get(mealId);
    const savedIngredients = db.prepare('SELECT * FROM ingredients WHERE meal_id = ?').all(mealId);

    res.status(201).json({
      success: true,
      message: 'הארוחה נשמרה בהצלחה!',
      data: {
        ...meal,
        ingredients: savedIngredients
      }
    });
  } catch (error) {
    console.error('Save meal error:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בשמירת הארוחה.'
    });
  }
});

/**
 * GET /api/meals
 * List meals with pagination and optional date filter.
 * Query params: page, limit, date (YYYY-MM-DD)
 */
router.get('/', requireAuth, (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const { date } = req.query;

    const db = getDb();

    let countQuery = 'SELECT COUNT(*) AS total FROM meals WHERE user_id = ?';
    let mealsQuery = `
      SELECT id, title, meal_type, total_calories, total_protein, total_carbs, total_fat,
             input_method, image_path, created_at
      FROM meals WHERE user_id = ?
    `;
    const params = [req.user.id];

    if (date) {
      countQuery += ' AND DATE(created_at) = ?';
      mealsQuery += ' AND DATE(created_at) = ?';
      params.push(date);
    }

    mealsQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

    const { total } = db.prepare(countQuery).get(...params);
    const meals = db.prepare(mealsQuery).all(...params, limit, offset);

    res.json({
      success: true,
      data: {
        meals,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('List meals error:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת רשימת הארוחות.'
    });
  }
});

/**
 * GET /api/meals/:id
 * Get a single meal with its ingredients.
 */
router.get('/:id', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const mealId = parseInt(req.params.id, 10);

    if (isNaN(mealId)) {
      return res.status(400).json({
        success: false,
        message: 'מזהה ארוחה לא תקין.'
      });
    }

    const meal = db.prepare('SELECT * FROM meals WHERE id = ? AND user_id = ?')
      .get(mealId, req.user.id);

    if (!meal) {
      return res.status(404).json({
        success: false,
        message: 'הארוחה לא נמצאה.'
      });
    }

    const ingredients = db.prepare('SELECT * FROM ingredients WHERE meal_id = ?').all(mealId);

    res.json({
      success: true,
      data: {
        ...meal,
        ingredients
      }
    });
  } catch (error) {
    console.error('Get meal error:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת פרטי הארוחה.'
    });
  }
});

/**
 * DELETE /api/meals/:id
 * Delete a meal and its ingredients (cascade).
 */
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const mealId = parseInt(req.params.id, 10);

    if (isNaN(mealId)) {
      return res.status(400).json({
        success: false,
        message: 'מזהה ארוחה לא תקין.'
      });
    }

    const meal = db.prepare('SELECT * FROM meals WHERE id = ? AND user_id = ?')
      .get(mealId, req.user.id);

    if (!meal) {
      return res.status(404).json({
        success: false,
        message: 'הארוחה לא נמצאה.'
      });
    }

    // Delete ingredients first, then meal (or rely on CASCADE)
    db.prepare('DELETE FROM ingredients WHERE meal_id = ?').run(mealId);
    db.prepare('DELETE FROM meals WHERE id = ?').run(mealId);

    res.json({
      success: true,
      message: 'הארוחה נמחקה בהצלחה!'
    });
  } catch (error) {
    console.error('Delete meal error:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה במחיקת הארוחה.'
    });
  }
});

module.exports = router;
