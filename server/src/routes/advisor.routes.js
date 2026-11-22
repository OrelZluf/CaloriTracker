const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const Meal = require('../models/Meal');
const Activity = require('../models/Activity');
const { chatNutritionAdvisor } = require('../services/ai.service');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/advisor/chat
 * Interactive meal & macro advisor chat for the rest of the day.
 * Body: { message: string, date?: 'YYYY-MM-DD', history?: { role: 'user'|'assistant', text: string }[] }
 */
router.post('/chat', requireAuth, async (req, res) => {
  try {
    const rawMessage = String(req.body?.message || '').trim();
    if (!rawMessage) {
      return res.status(400).json({
        success: false,
        message: 'נא להזין שאלה או התלבטות לצ׳אט.'
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const dateStr = DATE_RE.test(String(req.body?.date || '')) ? String(req.body.date) : todayStr;
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8) : [];

    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    const [meals, activities] = await Promise.all([
      Meal.find({
        user_id: req.user._id,
        created_at: { $gte: startOfDay, $lte: endOfDay }
      }),
      Activity.find({
        user_id: req.user._id,
        created_at: { $gte: startOfDay, $lte: endOfDay }
      })
    ]);

    const consumedCalories = Math.round(meals.reduce((s, m) => s + (m.total_calories || 0), 0));
    const consumedProtein = Math.round(meals.reduce((s, m) => s + (m.total_protein || 0), 0));
    const consumedCarbs = Math.round(meals.reduce((s, m) => s + (m.total_carbs || 0), 0));
    const consumedFat = Math.round(meals.reduce((s, m) => s + (m.total_fat || 0), 0));
    const burnedCalories = Math.round(activities.reduce((s, a) => s + (a.calories_burned || 0), 0));

    const calorieGoal = req.user.daily_calorie_goal || 2000;
    const goalProtein = req.user.macro_protein_g || Math.round((calorieGoal * 0.3) / 4);
    const goalCarbs = req.user.macro_carbs_g || Math.round((calorieGoal * 0.4) / 4);
    const goalFat = req.user.macro_fat_g || Math.round((calorieGoal * 0.3) / 9);

    const netCalories = Math.max(0, consumedCalories - burnedCalories);
    const remainingCalories = Math.max(0, calorieGoal - netCalories);
    const remainingProtein = Math.max(0, goalProtein - consumedProtein);
    const remainingCarbs = Math.max(0, goalCarbs - consumedCarbs);
    const remainingFat = Math.max(0, goalFat - consumedFat);

    const context = {
      date: dateStr,
      calorie_goal: calorieGoal,
      consumed_calories: consumedCalories,
      burned_calories: burnedCalories,
      net_calories: netCalories,
      remaining_calories: remainingCalories,
      goal_protein: goalProtein,
      consumed_protein: consumedProtein,
      remaining_protein: remainingProtein,
      goal_carbs: goalCarbs,
      consumed_carbs: consumedCarbs,
      remaining_carbs: remainingCarbs,
      goal_fat: goalFat,
      consumed_fat: consumedFat,
      remaining_fat: remainingFat,
      meals_eaten: meals.map(m => ({
        title: m.title,
        meal_type: m.meal_type,
        total_calories: m.total_calories,
        total_protein: m.total_protein,
        total_carbs: m.total_carbs,
        total_fat: m.total_fat
      }))
    };

    const advice = await chatNutritionAdvisor(rawMessage, history, context);

    res.json({
      success: true,
      data: {
        reply: advice.reply,
        suggestions: advice.suggestions || [],
        budget: {
          date: dateStr,
          calorie_goal: calorieGoal,
          consumed_calories: consumedCalories,
          burned_calories: burnedCalories,
          remaining_calories: remainingCalories,
          remaining_protein: remainingProtein,
          remaining_carbs: remainingCarbs,
          remaining_fat: remainingFat
        }
      }
    });
  } catch (error) {
    console.error('Nutrition advisor chat error:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בקבלת המלצת תזונה. אנא נסה שוב.'
    });
  }
});

module.exports = router;
