const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const WeightLog = require('../models/WeightLog');
const Meal = require('../models/Meal');
const Activity = require('../models/Activity');
const User = require('../models/User');

function computeFormulaBmr(user) {
  if (!user?.weight_kg || !user?.height_cm || !user?.age) return null;
  let bmr = 10 * user.weight_kg + 6.25 * user.height_cm - 5 * user.age;
  bmr += user.gender === 'female' ? -161 : 5;
  return Math.round(bmr * 1.2);
}

/**
 * Calculate Dynamic TDEE & Coach recommendation from weight logs + meal/activity history.
 */
async function buildWeightCoachSummary(user, logs) {
  const currentGoal = user?.daily_calorie_goal || 2000;
  const formulaTdee = computeFormulaBmr(user);
  const latestWeight = logs.length > 0 ? logs[logs.length - 1].weight_kg : (user?.weight_kg || null);
  const startWeight = logs.length > 0 ? logs[0].weight_kg : latestWeight;
  const weightChangeKg = (latestWeight !== null && startWeight !== null)
    ? +(latestWeight - startWeight).toFixed(1)
    : 0;

  let bmi = null;
  if (user?.height_cm && latestWeight) {
    const hm = user.height_cm / 100;
    bmi = +(latestWeight / (hm * hm)).toFixed(1);
  }

  if (logs.length >= 2) {
    const firstDate = logs[0].date;
    const lastDate = logs[logs.length - 1].date;
    const spanMs = new Date(`${lastDate}T00:00:00Z`).getTime() - new Date(`${firstDate}T00:00:00Z`).getTime();
    const spanDays = Math.max(1, Math.round(spanMs / (1000 * 60 * 60 * 24)));

    const rangeStart = new Date(`${firstDate}T00:00:00.000Z`);
    const rangeEnd = new Date(`${lastDate}T23:59:59.999Z`);

    const [meals, activities] = await Promise.all([
      Meal.find({ user_id: user._id, created_at: { $gte: rangeStart, $lte: rangeEnd } }),
      Activity.find({ user_id: user._id, created_at: { $gte: rangeStart, $lte: rangeEnd } })
    ]);

    const dailyNetMap = new Map();
    for (const m of meals) {
      const d = m.created_at.toISOString().split('T')[0];
      dailyNetMap.set(d, (dailyNetMap.get(d) || 0) + (m.total_calories || 0));
    }
    for (const a of activities) {
      const d = a.created_at.toISOString().split('T')[0];
      if (dailyNetMap.has(d)) {
        dailyNetMap.set(d, dailyNetMap.get(d) - (a.calories_burned || 0));
      }
    }

    const trackedMealDays = dailyNetMap.size;
    const avgDailyNetCalories = trackedMealDays > 0
      ? Math.round(Array.from(dailyNetMap.values()).reduce((s, v) => s + v, 0) / trackedMealDays)
      : currentGoal;

    // 1 kg of body weight change ~ 7700 kcal; clamp daily energy delta to avoid noisy outliers on short spans
    const effectiveSpan = Math.max(spanDays, 7);
    const dailyWeightEnergyDelta = (weightChangeKg * 7700) / effectiveSpan;
    const rawEstimatedTdee = Math.round(avgDailyNetCalories - dailyWeightEnergyDelta);
    const estimatedTdee = Math.min(4500, Math.max(1200, rawEstimatedTdee));

    let recommendedGoal = Math.round(estimatedTdee / 50) * 50;
    let targetMode = 'maintain';

    if (bmi !== null && bmi >= 25) {
      targetMode = 'lose';
      recommendedGoal = Math.max(1200, Math.round((estimatedTdee - 400) / 50) * 50);
    } else if (bmi !== null && bmi < 18.5) {
      targetMode = 'gain';
      recommendedGoal = Math.min(4500, Math.round((estimatedTdee + 300) / 50) * 50);
    }

    const changeText = weightChangeKg === 0
      ? 'המשקל שלך נשאר יציב'
      : weightChangeKg < 0
        ? `ירדת ${Math.abs(weightChangeKg)} ק"ג`
        : `עלית ${weightChangeKg} ק"ג`;

    const modeExplanation = targetMode === 'lose'
      ? 'לירידה מבוקרת ובריאה במשקל (גירעון של כ-400 קל׳)'
      : targetMode === 'gain'
        ? 'לעלייה בריאה במשקל (עודף של כ-300 קל׳)'
        : 'לשמירה על המשקל הנוכחי שלך';

    return {
      is_calibrated: true,
      start_weight: startWeight,
      current_weight: latestWeight,
      weight_change_kg: weightChangeKg,
      span_days: spanDays,
      avg_daily_calories: avgDailyNetCalories,
      estimated_tdee: estimatedTdee,
      recommended_goal: recommendedGoal,
      current_goal: currentGoal,
      target_mode: targetMode,
      message: `במהלך ${spanDays} ימים אחרונים ${changeText}. קצב חילוף החומרים המוערך שלך (TDEE) הוא כ-${estimatedTdee} קל׳ ליום. מומלץ יעד של ${recommendedGoal} קל׳ ליום ${modeExplanation}.`
    };
  }

  const fallbackTdee = formulaTdee || currentGoal;
  let fallbackGoal = fallbackTdee;
  if (bmi !== null && bmi >= 25) {
    fallbackGoal = Math.max(1200, Math.round((fallbackTdee - 400) / 50) * 50);
  } else if (bmi !== null && bmi < 18.5) {
    fallbackGoal = Math.min(4500, Math.round((fallbackTdee + 300) / 50) * 50);
  }

  return {
    is_calibrated: false,
    start_weight: startWeight,
    current_weight: latestWeight,
    weight_change_kg: 0,
    span_days: logs.length,
    avg_daily_calories: null,
    estimated_tdee: fallbackTdee,
    recommended_goal: fallbackGoal,
    current_goal: currentGoal,
    target_mode: bmi && bmi >= 25 ? 'lose' : (bmi && bmi < 18.5 ? 'gain' : 'maintain'),
    message: 'הזן לפחות 2 שקילות בימים שונים כדי שהמאמן החכם יחשב את ה-TDEE האמיתי שלך לפי מגמת המשקל והארוחות שלך.'
  };
}

/**
 * GET /api/weight?days=90
 * Get weight history logs and smart TDEE coach analysis.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const days = Math.min(365, Math.max(7, parseInt(req.query.days, 10) || 90));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffDateStr = cutoff.toISOString().split('T')[0];

    const logs = await WeightLog.find({
      user_id: req.user._id,
      date: { $gte: cutoffDateStr }
    }).sort({ date: 1 });

    const coach = await buildWeightCoachSummary(req.user, logs);

    res.json({
      success: true,
      data: {
        logs: logs.map(l => l.toJSON()),
        coach
      }
    });
  } catch (error) {
    console.error('Get weight logs error:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת נתוני משקל.'
    });
  }
});

/**
 * POST /api/weight
 * Log or update weight for a specific date (defaults to today).
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { weight_kg, date, note } = req.body;

    const w = parseFloat(weight_kg);
    if (isNaN(w) || w < 20 || w > 500) {
      return res.status(400).json({
        success: false,
        message: 'משקל חייב להיות מספר תקין בין 20 ל-500 ק"ג.'
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const targetDateStr = date ? String(date).split('T')[0] : todayStr;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDateStr)) {
      return res.status(400).json({
        success: false,
        message: 'פורמט תאריך לא תקין. השתמש בפורמט YYYY-MM-DD.'
      });
    }

    if (targetDateStr > todayStr) {
      return res.status(400).json({
        success: false,
        message: 'לא ניתן להזין שקילה בתאריך עתידי.'
      });
    }

    const roundedWeight = Math.round(w * 10) / 10;

    const log = await WeightLog.findOneAndUpdate(
      { user_id: req.user._id, date: targetDateStr },
      {
        user_id: req.user._id,
        weight_kg: roundedWeight,
        date: targetDateStr,
        note: note ? String(note).trim() : null
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Check if this is the latest weight log; if so, sync User.weight_kg
    const latestLog = await WeightLog.findOne({ user_id: req.user._id }).sort({ date: -1 });
    if (!latestLog || latestLog.date <= targetDateStr) {
      await User.findByIdAndUpdate(req.user._id, { weight_kg: roundedWeight });
      req.user.weight_kg = roundedWeight;
    }

    const logs = await WeightLog.find({ user_id: req.user._id }).sort({ date: 1 });
    const coach = await buildWeightCoachSummary(req.user, logs);

    res.status(201).json({
      success: true,
      message: 'המשקל נשמר בהצלחה!',
      data: {
        log: log.toJSON(),
        coach
      }
    });
  } catch (error) {
    console.error('Save weight log error:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בשמירת המשקל.'
    });
  }
});

/**
 * DELETE /api/weight/:id
 * Delete a weight log entry.
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const deleted = await WeightLog.findOneAndDelete({
      _id: req.params.id,
      user_id: req.user._id
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'רשומת המשקל לא נמצאה.'
      });
    }

    const logs = await WeightLog.find({ user_id: req.user._id }).sort({ date: 1 });
    if (logs.length > 0) {
      const newestWeight = logs[logs.length - 1].weight_kg;
      await User.findByIdAndUpdate(req.user._id, { weight_kg: newestWeight });
      req.user.weight_kg = newestWeight;
    }
    const coach = await buildWeightCoachSummary(req.user, logs);

    res.json({
      success: true,
      message: 'רשומת המשקל נמחקה בהצלחה!',
      data: { coach }
    });
  } catch (error) {
    console.error('Delete weight log error:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה במחיקת רשומת המשקל.'
    });
  }
});

module.exports = router;
