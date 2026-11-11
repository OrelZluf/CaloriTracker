const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const WaterLog = require('../models/WaterLog');
const User = require('../models/User');

/**
 * Compute recommended daily water goal in ml based on user weight_kg (35 ml per kg, clamped 1800-4000 ml).
 */
function computeWaterGoalMl(user) {
  if (user && user.weight_kg && user.weight_kg > 25) {
    const raw = Math.round((user.weight_kg * 35) / 50) * 50;
    return Math.min(4000, Math.max(1800, raw));
  }
  return 2500;
}

/**
 * Format summary payload for a given date & amount_ml.
 */
function buildWaterSummary(dateStr, amountMl, user) {
  const goalMl = computeWaterGoalMl(user);
  const totalMl = Math.max(0, Math.round(amountMl || 0));
  return {
    date: dateStr,
    total_ml: totalMl,
    goal_ml: goalMl,
    glasses_count: Math.floor(totalMl / 250),
    goal_glasses: Math.round(goalMl / 250),
    percentage: goalMl > 0 ? Math.min(100, Math.round((totalMl / goalMl) * 100)) : 0
  };
}

/**
 * GET /api/water
 * Query param: date (YYYY-MM-DD, defaults to today)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const dateStr = req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date))
      ? String(req.query.date)
      : todayStr;

    const [entry, user] = await Promise.all([
      WaterLog.findOne({ user_id: req.user._id, date: dateStr }),
      User.findById(req.user._id)
    ]);

    const summary = buildWaterSummary(dateStr, entry ? entry.amount_ml : 0, user || req.user);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Get water log error:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת מעקב השתייה.'
    });
  }
});

/**
 * POST /api/water
 * Add or adjust water intake for a date.
 * Body: { amount_ml: number (delta, e.g. 250, 500, -250), date?: 'YYYY-MM-DD' }
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const rawDelta = Number(req.body?.amount_ml);
    if (isNaN(rawDelta) || rawDelta === 0 || Math.abs(rawDelta) > 5000) {
      return res.status(400).json({
        success: false,
        message: 'כמות מים לא תקינה.'
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const dateStr = req.body?.date && /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.date))
      ? String(req.body.date)
      : todayStr;

    let entry = await WaterLog.findOne({ user_id: req.user._id, date: dateStr });
    const currentMl = entry ? entry.amount_ml : 0;
    const nextMl = Math.min(15000, Math.max(0, currentMl + Math.round(rawDelta)));

    if (!entry) {
      entry = await WaterLog.create({
        user_id: req.user._id,
        date: dateStr,
        amount_ml: nextMl
      });
    } else {
      entry.amount_ml = nextMl;
      await entry.save();
    }

    const user = await User.findById(req.user._id);
    const summary = buildWaterSummary(dateStr, entry.amount_ml, user || req.user);

    res.json({
      success: true,
      message: rawDelta > 0 ? `נוספו ${rawDelta} מ"ל מים!` : 'כמות המים עודכנה.',
      data: summary
    });
  } catch (error) {
    console.error('Update water log error:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בעדכון מעקב השתייה.'
    });
  }
});

module.exports = router;
module.exports.computeWaterGoalMl = computeWaterGoalMl;
module.exports.buildWaterSummary = buildWaterSummary;
