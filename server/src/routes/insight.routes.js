const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const DailyInsight = require('../models/DailyInsight');
const Meal = require('../models/Meal');
const Activity = require('../models/Activity');
const User = require('../models/User');
const { generateDailyInsight } = require('../services/ai.service');

// Format date as YYYY-MM-DD
function formatDate(date) {
  const d = new Date(date);
  const month = '' + (d.getMonth() + 1);
  const day = '' + d.getDate();
  const year = d.getFullYear();

  return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Find a cached insight for the given day or generate (and cache) a new one.
 * Day boundaries are UTC, consistent with the dashboard daily summary.
 * Returns null when the user logged nothing on that day.
 */
async function getOrCreateInsight(user, dateStr) {
  const userId = user.id;

  // 1. Check if insight already exists
  let insight = await DailyInsight.findOne({ user_id: userId, date: dateStr });
  if (insight) return insight;

  // 2. Fetch the day's meals and activities
  const startDate = new Date(`${dateStr}T00:00:00.000Z`);
  const endDate = new Date(`${dateStr}T23:59:59.999Z`);

  const [meals, activities] = await Promise.all([
    Meal.find({
      user_id: userId,
      created_at: { $gte: startDate, $lte: endDate }
    }),
    Activity.find({
      user_id: userId,
      created_at: { $gte: startDate, $lte: endDate }
    })
  ]);

  // If no data at all, return null so we don't generate empty insights
  if (meals.length === 0 && activities.length === 0) return null;

  // 3. Generate insight from AI
  const aiInsight = await generateDailyInsight(meals, activities, user);

  // 4. Save to DB
  insight = new DailyInsight({
    user_id: userId,
    date: dateStr,
    preserve_text: aiInsight.preserve_text || aiInsight.preserve || 'לא התקבל טקסט לשימור',
    improve_text: aiInsight.improve_text || aiInsight.improve || 'לא התקבל טקסט לשיפור'
  });

  await insight.save();
  return insight;
}

// Get or generate the insight of a specific past day: GET /api/insights/day?date=YYYY-MM-DD
router.get('/day', requireAuth, async (req, res) => {
  try {
    const dateStr = String(req.query.date || '');
    if (!DATE_RE.test(dateStr) || isNaN(new Date(`${dateStr}T00:00:00.000Z`).getTime())) {
      return res.status(400).json({ status: 'error', message: 'תאריך לא תקין (נדרש YYYY-MM-DD)' });
    }

    // Allow up to 1 day ahead of server UTC date to tolerate client timezones,
    // but never summarize days that are clearly in the future.
    const maxAllowed = new Date();
    maxAllowed.setUTCDate(maxAllowed.getUTCDate() + 1);
    if (dateStr > maxAllowed.toISOString().split('T')[0]) {
      return res.status(400).json({ status: 'error', message: 'לא ניתן לסכם יום עתידי' });
    }

    const insight = await getOrCreateInsight(req.user, dateStr);
    res.json({ status: 'success', data: { insight } });
  } catch (error) {
    console.error('Error generating day insight:', error);
    res.status(500).json({ status: 'error', message: 'שגיאה ביצירת סיכום יומי' });
  }
});

// Get or generate yesterday's insight (kept for backwards compatibility)
router.get('/yesterday', requireAuth, async (req, res) => {
  try {
    // Calculate yesterday's date string
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = formatDate(yesterday);

    const insight = await getOrCreateInsight(req.user, dateStr);
    res.json({ status: 'success', data: { insight } });
  } catch (error) {
    console.error('Error generating daily insight:', error);
    res.status(500).json({ status: 'error', message: 'שגיאה ביצירת סיכום יומי' });
  }
});

module.exports = router;
