const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const { upload, compressImage } = require('../middleware/upload.middleware');
const { analyzeMealImage, analyzeMealText } = require('../services/ai.service');
const Meal = require('../models/Meal');

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
router.post('/', requireAuth, async (req, res) => {
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

    const meal = await Meal.create({
      user_id: req.user._id,
      title: title.trim(),
      image_path: image_path || null,
      meal_type: meal_type || 'snack',
      total_calories: totals.calories,
      total_protein: totals.protein,
      total_carbs: totals.carbs,
      total_fat: totals.fat,
      input_method: input_method || 'text',
      raw_input: raw_input || null,
      ingredients: ingredients.map(ing => ({
        name: ing.name,
        category: ing.category || 'other',
        estimated_grams: ing.estimated_grams || 0,
        calories: ing.calories || 0,
        protein_grams: ing.protein_grams || 0,
        carbs_grams: ing.carbs_grams || 0,
        fat_grams: ing.fat_grams || 0,
        fiber_grams: ing.fiber_grams || 0,
        sugar_grams: ing.sugar_grams || 0
      }))
    });

    res.status(201).json({
      success: true,
      message: 'הארוחה נשמרה בהצלחה!',
      data: meal.toJSON()
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
router.get('/', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const { date } = req.query;

    const query = { user_id: req.user._id };

    if (date) {
      // Date filter for YYYY-MM-DD
      const startOfDay = new Date(date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setUTCHours(23, 59, 59, 999);

      query.created_at = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }

    const total = await Meal.countDocuments(query);
    const meals = await Meal.find(query)
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit);

    res.json({
      success: true,
      data: {
        meals: meals.map(m => m.toJSON()),
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
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const meal = await Meal.findOne({ _id: req.params.id, user_id: req.user._id });

    if (!meal) {
      return res.status(404).json({
        success: false,
        message: 'הארוחה לא נמצאה.'
      });
    }

    res.json({
      success: true,
      data: meal.toJSON()
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
 * Delete a meal.
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await Meal.findOneAndDelete({ _id: req.params.id, user_id: req.user._id });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'הארוחה לא נמצאה.'
      });
    }

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
