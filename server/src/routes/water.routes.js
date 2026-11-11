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
  const glassMl = user && user.water_glass_ml >= 50 && user.water_glass_ml <= 2000
    ? Math.round(user.water_glass_ml)
    : 250;
  const bottleMl = user && user.water_bottle_ml >= 100 && user.water_bottle_ml <= 5000
    ? Math.round(user.water_bottle_ml)
    : 500;
  return {
    date: dateStr,
    total_ml: totalMl,
    goal_ml: goalMl,
    glass_ml: glassMl,
    bottle_ml: bottleMl,
    glasses_count: Math.floor(totalMl / glassMl),
    goal_glasses: Math.max(1, Math.round(goalMl / glassMl)),
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

/**
 * PUT /api/water/settings
 * Customize user's glass_ml and bottle_ml sizes.
 * Body: { glass_ml: number, bottle_ml: number, date?: 'YYYY-MM-DD' }
 */
router.put('/settings', requireAuth, async (req, res) => {
  try {
    const glassMl = Math.round(Number(req.body?.glass_ml));
    const bottleMl = Math.round(Number(req.body?.bottle_ml));

    if (isNaN(glassMl) || glassMl < 50 || glassMl > 2000) {
      return res.status(400).json({
        success: false,
        message: 'גודל כוס חייב להיות בין 50 ל-2000 מ"ל.'
      });
    }
    if (isNaN(bottleMl) || bottleMl < 100 || bottleMl > 5000) {
      return res.status(400).json({
        success: false,
        message: 'גודל בקבוק חייב להיות בין 100 ל-5000 מ"ל.'
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const dateStr = req.body?.date && /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.date))
      ? String(req.body.date)
      : todayStr;

    const [user, entry] = await Promise.all([
      User.findByIdAndUpdate(
        req.user._id,
        { water_glass_ml: glassMl, water_bottle_ml: bottleMl },
        { new: true }
      ),
      WaterLog.findOne({ user_id: req.user._id, date: dateStr })
    ]);

    const effectiveUser = user || {
      ...req.user,
      water_glass_ml: glassMl,
      water_bottle_ml: bottleMl
    };
    const summary = buildWaterSummary(dateStr, entry ? entry.amount_ml : 0, effectiveUser);

    res.json({
      success: true,
      message: 'גדלי כוס ובקבוק עודכנו בהצלחה!',
      data: summary
    });
  } catch (error) {
    console.error('Update water settings error:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בעדכון הגדרות השתייה.'
    });
  }
});

module.exports = router;
module.exports.computeWaterGoalMl = computeWaterGoalMl;
module.exports.buildWaterSummary = buildWaterSummary;
