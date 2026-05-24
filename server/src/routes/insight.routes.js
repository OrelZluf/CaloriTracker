const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
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

// Get or generate yesterday's insight
router.get('/yesterday', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Calculate yesterday's date string
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = formatDate(yesterday);

    // 1. Check if insight already exists
    let insight = await DailyInsight.findOne({ user_id: userId, date: dateStr });
    
    if (insight) {
      return res.json({ status: 'success', data: { insight } });
    }

    // 2. Fetch yesterday's meals and activities
    // Construct date boundaries for DB query
    const startDate = new Date(yesterday);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(yesterday);
    endDate.setHours(23, 59, 59, 999);

    const [meals, activities, user] = await Promise.all([
      Meal.find({ 
        user_id: userId,
        created_at: { $gte: startDate, $lte: endDate }
      }),
      Activity.find({
        user_id: userId,
        created_at: { $gte: startDate, $lte: endDate }
      }),
      User.findById(userId)
    ]);

    // If no data at all, return null so we don't generate empty insights
    if (meals.length === 0 && activities.length === 0) {
      return res.json({ status: 'success', data: { insight: null } });
    }

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

    res.json({ status: 'success', data: { insight } });

  } catch (error) {
    console.error('Error generating daily insight:', error);
    res.status(500).json({ status: 'error', message: 'שגיאה ביצירת סיכום יומי' });
  }
});

module.exports = router;
