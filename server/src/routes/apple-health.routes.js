const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const Activity = require('../models/Activity');
const User = require('../models/User');

/**
 * Map Apple HealthKit HKWorkoutActivityType / English / Hebrew workout names
 * to CaloriTrack's canonical activity_type and default MET value.
 */
const APPLE_WORKOUT_TYPE_MAP = {
  running: { type: 'running', label: 'ריצה (Apple Watch)', met: 9.8 },
  hkworkoutactivitytyperunning: { type: 'running', label: 'ריצה (Apple Watch)', met: 9.8 },
  walking: { type: 'walking', label: 'הליכה (Apple Watch)', met: 3.8 },
  hkworkoutactivitytypewalking: { type: 'walking', label: 'הליכה (Apple Watch)', met: 3.8 },
  cycling: { type: 'cycling', label: 'רכיבה על אופניים (Apple Watch)', met: 7.5 },
  hkworkoutactivitytypecycling: { type: 'cycling', label: 'רכיבה על אופניים (Apple Watch)', met: 7.5 },
  swimming: { type: 'swimming', label: 'שחייה (Apple Watch)', met: 6.0 },
  hkworkoutactivitytypeswimming: { type: 'swimming', label: 'שחייה (Apple Watch)', met: 6.0 },
  yoga: { type: 'yoga', label: 'יוגה (Apple Watch)', met: 2.5 },
  hkworkoutactivitytypeyoga: { type: 'yoga', label: 'יוגה (Apple Watch)', met: 2.5 },
  pilates: { type: 'pilates', label: 'פילאטיס (Apple Watch)', met: 3.0 },
  hkworkoutactivitytypepilates: { type: 'pilates', label: 'פילאטיס (Apple Watch)', met: 3.0 },
  jumprope: { type: 'jump_rope', label: 'קפיצה בחבל (Apple Watch)', met: 11.0 },
  jump_rope: { type: 'jump_rope', label: 'קפיצה בחבל (Apple Watch)', met: 11.0 },
  hkworkoutactivitytypejumprope: { type: 'jump_rope', label: 'קפיצה בחבל (Apple Watch)', met: 11.0 },
  hiit: { type: 'hiit', label: 'אימון HIIT (Apple Watch)', met: 8.0 },
  highintensityintervaltraining: { type: 'hiit', label: 'אימון HIIT (Apple Watch)', met: 8.0 },
  hkworkoutactivitytypehighintensityintervaltraining: { type: 'hiit', label: 'אימון HIIT (Apple Watch)', met: 8.0 },
  traditionalstrengthtraining: { type: 'strength', label: 'אימון כוח (Apple Watch)', met: 6.0 },
  functionalstrengthtraining: { type: 'strength', label: 'אימון כוח (Apple Watch)', met: 6.0 },
  hkworkoutactivitytypetraditionalstrengthtraining: { type: 'strength', label: 'אימון כוח (Apple Watch)', met: 6.0 },
  hkworkoutactivitytypefunctionalstrengthtraining: { type: 'strength', label: 'אימון כוח (Apple Watch)', met: 6.0 },
  strength: { type: 'strength', label: 'אימון כוח (Apple Watch)', met: 6.0 },
  weights: { type: 'weights', label: 'אימון משקולות (Apple Watch)', met: 6.0 },
  crossfit: { type: 'crossfit', label: 'קרוספיט (Apple Watch)', met: 8.0 },
  crosstraining: { type: 'crossfit', label: 'קרוספיט (Apple Watch)', met: 8.0 },
  hkworkoutactivitytypecrosstraining: { type: 'crossfit', label: 'קרוספיט (Apple Watch)', met: 8.0 },
  spinning: { type: 'spinning', label: 'ספינינג (Apple Watch)', met: 8.5 },
  dance: { type: 'dance', label: 'ריקוד (Apple Watch)', met: 6.5 },
  hkworkoutactivitytypedance: { type: 'dance', label: 'ריקוד (Apple Watch)', met: 6.5 },
  hiking: { type: 'hiking', label: 'טיול רגלי (Apple Watch)', met: 6.0 },
  hkworkoutactivitytypehiking: { type: 'hiking', label: 'טיול רגלי (Apple Watch)', met: 6.0 },
  elliptical: { type: 'elliptical', label: 'אליפטיקל (Apple Watch)', met: 5.0 },
  hkworkoutactivitytypeelliptical: { type: 'elliptical', label: 'אליפטיקל (Apple Watch)', met: 5.0 },
  rowing: { type: 'rowing', label: 'חתירה (Apple Watch)', met: 7.0 },
  hkworkoutactivitytyperowing: { type: 'rowing', label: 'חתירה (Apple Watch)', met: 7.0 },
  boxing: { type: 'boxing', label: 'אגרוף (Apple Watch)', met: 7.8 },
  hkworkoutactivitytypeboxing: { type: 'boxing', label: 'אגרוף (Apple Watch)', met: 7.8 },
  martialarts: { type: 'martial_arts', label: 'אומנויות לחימה (Apple Watch)', met: 10.0 },
  hkworkoutactivitytypemartialarts: { type: 'martial_arts', label: 'אומנויות לחימה (Apple Watch)', met: 10.0 },
  cooldown: { type: 'stretching', label: 'מתיחות (Apple Watch)', met: 2.3 },
  flexibility: { type: 'stretching', label: 'מתיחות (Apple Watch)', met: 2.3 },
  hkworkoutactivitytypeflexibility: { type: 'stretching', label: 'מתיחות (Apple Watch)', met: 2.3 },
  soccer: { type: 'soccer', label: 'כדורגל (Apple Watch)', met: 7.0 },
  hkworkoutactivitytypesoccer: { type: 'soccer', label: 'כדורגל (Apple Watch)', met: 7.0 },
  basketball: { type: 'basketball', label: 'כדורסל (Apple Watch)', met: 6.5 },
  hkworkoutactivitytypebasketball: { type: 'basketball', label: 'כדורסל (Apple Watch)', met: 6.5 },
  tennis: { type: 'tennis', label: 'טניס (Apple Watch)', met: 7.3 },
  hkworkoutactivitytypetennis: { type: 'tennis', label: 'טניס (Apple Watch)', met: 7.3 },
  volleyball: { type: 'volleyball', label: 'כדורעף (Apple Watch)', met: 4.0 },
  hkworkoutactivitytypevolleyball: { type: 'volleyball', label: 'כדורעף (Apple Watch)', met: 4.0 }
};

function normalizeAppleWorkoutType(rawType) {
  const key = String(rawType || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  if (APPLE_WORKOUT_TYPE_MAP[key]) {
    return APPLE_WORKOUT_TYPE_MAP[key];
  }
  const cleanName = String(rawType || 'אימון Apple Watch').replace(/^HKWorkoutActivityType/i, '').trim() || 'אימון Apple Watch';
  return {
    type: 'other',
    label: `${cleanName} (Apple Watch)`,
    met: 5.0
  };
}

/**
 * Helper to persist an array of normalized Apple Watch workout items for a user.
 * Deduplicates by external_id so repeated syncs are idempotent.
 */
async function importAppleWatchWorkouts(userDoc, rawWorkouts = [], defaultDateStr = null) {
  const userId = userDoc._id || userDoc.id;
  const userWeight = userDoc.weight_kg || 70;
  const todayStr = new Date().toISOString().split('T')[0];

  const imported = [];
  let skippedDuplicates = 0;

  for (const w of rawWorkouts) {
    if (!w || typeof w !== 'object') continue;
    const rawType = w.activity_type || w.workoutActivityType || w.type || w.name || 'running';
    const mapped = normalizeAppleWorkoutType(rawType);

    const durationMinutes = Math.max(
      1,
      Math.round(Number(w.duration_minutes ?? w.duration ?? (w.duration_seconds ? w.duration_seconds / 60 : 30)) || 30)
    );

    const explicitCalories = Number(w.calories_burned ?? w.activeEnergyBurned ?? w.totalEnergyBurned ?? w.calories ?? 0);
    const caloriesBurned = explicitCalories > 0
      ? Math.round(explicitCalories)
      : Math.round(mapped.met * userWeight * (durationMinutes / 60));

    const rawDate = String(w.date || w.startDate || w.created_at || defaultDateStr || todayStr);
    const datePart = rawDate.split('T')[0].split(' ')[0];
    const validDateStr = /^\d{4}-\d{2}-\d{2}$/.test(datePart) && datePart <= todayStr ? datePart : todayStr;

    const externalId = w.external_id || w.id || `${validDateStr}_${mapped.type}_${durationMinutes}_${caloriesBurned}`;

    // Check duplicate by external_id if Activity.findOne is available
    if (typeof Activity.findOne === 'function') {
      const existing = await Activity.findOne({ user_id: userId, external_id: externalId });
      if (existing) {
        skippedDuplicates++;
        continue;
      }
    }

    const title = w.title ? String(w.title) : mapped.label;
    const createdAt = validDateStr === todayStr
      ? new Date()
      : new Date(`${validDateStr}T12:00:00.000Z`);

    const activity = new Activity({
      user_id: userId,
      title,
      activity_type: mapped.type,
      duration_minutes: durationMinutes,
      calories_burned: caloriesBurned,
      met_value: Number(w.met_value || mapped.met),
      input_method: 'apple_watch',
      raw_input: 'Apple Watch / Apple Health',
      external_id: externalId,
      created_at: createdAt
    });

    await activity.save();
    imported.push(activity);
  }

  return { imported, skippedDuplicates };
}

/**
 * GET /api/apple-health/status
 * Returns whether the user has generated an Apple Watch sync token and recent synced workouts.
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const token = req.user.apple_watch_token || null;
    let syncedActivities = [];
    if (typeof Activity.find === 'function') {
      const found = await Activity.find({
        user_id: req.user._id,
        input_method: 'apple_watch'
      });
      if (Array.isArray(found)) {
        syncedActivities = found.slice(0, 10);
      } else if (found && typeof found.sort === 'function') {
        syncedActivities = await found.sort({ created_at: -1 }).limit(10);
      }
    }

    res.json({
      success: true,
      data: {
        connected: Boolean(token),
        sync_token: token,
        webhook_path: '/api/apple-health/webhook',
        synced_count: syncedActivities.length,
        recent_activities: syncedActivities
      }
    });
  } catch (error) {
    console.error('Apple Health status error:', error);
    res.status(500).json({ success: false, message: 'שגיאה בטעינת סטטוס Apple Watch.' });
  }
});

/**
 * POST /api/apple-health/token
 * Generates or rotates the user's personal Apple Watch sync token for iOS Shortcuts / Health Auto Export.
 */
router.post('/token', requireAuth, async (req, res) => {
  try {
    const newToken = 'aw_' + crypto.randomBytes(16).toString('hex');
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { apple_watch_token: newToken },
      { new: true }
    );

    res.json({
      success: true,
      message: 'קוד סנכרון ל-Apple Watch נוצר בהצלחה!',
      data: {
        sync_token: updated?.apple_watch_token || newToken,
        webhook_path: '/api/apple-health/webhook'
      }
    });
  } catch (error) {
    console.error('Generate Apple Watch token error:', error);
    res.status(500).json({ success: false, message: 'שגיאה ביצירת קוד סנכרון ל-Apple Watch.' });
  }
});

/**
 * POST /api/apple-health/sync
 * Authenticated endpoint for syncing one or more Apple Watch workouts from the web app
 * (quick sync, Apple Health XML/JSON file import, or workout entry).
 */
router.post('/sync', requireAuth, async (req, res) => {
  try {
    const workouts = Array.isArray(req.body?.workouts)
      ? req.body.workouts
      : (req.body?.workout ? [req.body.workout] : []);

    if (workouts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'לא נשלחו אימונים לסנכרון מ-Apple Watch.'
      });
    }

    const { imported, skippedDuplicates } = await importAppleWatchWorkouts(
      req.user,
      workouts,
      req.body?.date || null
    );

    const totalCaloriesBurned = imported.reduce((sum, a) => sum + (a.calories_burned || 0), 0);

    res.status(201).json({
      success: true,
      message: imported.length > 0
        ? `סונכרנו בהצלחה ${imported.length} אימונים מ-Apple Watch (${totalCaloriesBurned} קל׳ נשרפו)!`
        : 'כל האימונים בקובץ כבר סונכרנו בעבר.',
      data: {
        imported_count: imported.length,
        skipped_duplicates: skippedDuplicates,
        total_calories_burned: totalCaloriesBurned,
        activities: imported
      }
    });
  } catch (error) {
    console.error('Apple Watch sync error:', error);
    res.status(500).json({ success: false, message: 'שגיאה בסנכרון נתוני Apple Watch.' });
  }
});

/**
 * POST /api/apple-health/webhook
 * Token-authenticated webhook endpoint for iOS Shortcuts / Health Auto Export apps.
 * Accepts token via query (?token=aw_xxx) or header (X-Apple-Watch-Token: aw_xxx).
 */
router.post('/webhook', async (req, res) => {
  try {
    const token = String(req.query.token || req.headers['x-apple-watch-token'] || req.body?.token || '').trim();
    if (!token) {
      return res.status(401).json({ success: false, message: 'חסר טוקן סנכרון של Apple Watch.' });
    }

    const user = await User.findOne({ apple_watch_token: token });
    if (!user) {
      return res.status(401).json({ success: false, message: 'טוקן סנכרון של Apple Watch לא תקין.' });
    }

    // Support both direct { workouts: [...] } and Health Auto Export { data: { workouts: [...] } }
    const workouts = Array.isArray(req.body?.workouts)
      ? req.body.workouts
      : Array.isArray(req.body?.data?.workouts)
        ? req.body.data.workouts
        : req.body?.activity_type || req.body?.workoutActivityType
          ? [req.body]
          : [];

    if (workouts.length === 0) {
      return res.status(400).json({ success: false, message: 'לא נמצאו אימונים בבקשת הסנכרון.' });
    }

    const { imported, skippedDuplicates } = await importAppleWatchWorkouts(user, workouts, req.body?.date || null);
    const totalCaloriesBurned = imported.reduce((sum, a) => sum + (a.calories_burned || 0), 0);

    res.status(201).json({
      success: true,
      data: {
        imported_count: imported.length,
        skipped_duplicates: skippedDuplicates,
        total_calories_burned: totalCaloriesBurned,
        activities: imported
      }
    });
  } catch (error) {
    console.error('Apple Watch webhook error:', error);
    res.status(500).json({ success: false, message: 'שגיאה בעיבוד Webhook מ-Apple Watch.' });
  }
});

module.exports = router;
