const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth.middleware');
const { analyzeActivityText } = require('../services/ai.service');

// All activity routes require authentication
router.use(requireAuth);

/**
 * @route   POST /api/activities/analyze-text
 * @desc    Analyze free-text activity description
 * @access  Private
 */
router.post('/analyze-text', async (req, res) => {
  try {
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({ success: false, message: 'תיאור פעילות חסר' });
    }

    const analysis = await analyzeActivityText(description);

    res.json({
      success: true,
      data: { analysis }
    });
  } catch (error) {
    console.error('Text activity analysis error:', error);
    res.status(500).json({ success: false, message: 'שגיאה בניתוח הפעילות' });
  }
});

/**
 * @route   POST /api/activities
 * @desc    Save a new activity
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    const { title, activity_type, duration_minutes, met_value, input_method, raw_input } = req.body;
    const user_id = req.user._id;

    // Fetch user to get weight to calculate calories burned
    // Formula: Calories = MET * weight(kg) * (duration / 60)
    let weight = req.user.weight_kg;
    if (!weight) {
      // Default fallback if user has no weight set
      weight = 70;
    }

    const calories_burned = Math.round(met_value * weight * (duration_minutes / 60));

    const activity = new Activity({
      user_id,
      title,
      activity_type,
      duration_minutes,
      calories_burned,
      met_value,
      input_method,
      raw_input
    });

    await activity.save();

    res.status(201).json({
      success: true,
      data: activity
    });
  } catch (error) {
    console.error('Save activity error:', error);
    res.status(500).json({ success: false, message: 'שגיאה בשמירת הפעילות' });
  }
});

/**
 * @route   GET /api/activities
 * @desc    Get user's activities (with optional date filter)
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    const query = { user_id: req.user._id };

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      query.created_at = {
        $gte: startDate,
        $lte: endDate
      };
    }

    const activities = await Activity.find(query).sort({ created_at: -1 });

    res.json({
      success: true,
      data: { activities }
    });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ success: false, message: 'שגיאה בשליפת פעילויות' });
  }
});

/**
 * @route   DELETE /api/activities/:id
 * @desc    Delete an activity
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const activity = await Activity.findOneAndDelete({
      _id: req.params.id,
      user_id: req.user._id
    });

    if (!activity) {
      return res.status(404).json({ success: false, message: 'פעילות לא נמצאה' });
    }

    res.json({ success: true, message: 'הפעילות נמחקה בהצלחה' });
  } catch (error) {
    console.error('Delete activity error:', error);
    res.status(500).json({ success: false, message: 'שגיאה במחיקת פעילות' });
  }
});

/**
 * @route   PUT /api/activities/:id
 * @desc    Edit an activity (change duration, type, etc)
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    const { activity_type, duration_minutes, met_value, title } = req.body;
    
    const activity = await Activity.findOne({
      _id: req.params.id,
      user_id: req.user._id
    });

    if (!activity) {
      return res.status(404).json({ success: false, message: 'פעילות לא נמצאה' });
    }

    // Recalculate calories if duration, type, or met changed
    if (duration_minutes !== undefined && met_value !== undefined) {
      let weight = req.user.weight_kg || 70;
      const calories_burned = Math.round(met_value * weight * (duration_minutes / 60));
      activity.calories_burned = calories_burned;
      activity.duration_minutes = duration_minutes;
      activity.met_value = met_value;
    }

    if (activity_type) activity.activity_type = activity_type;
    if (title) activity.title = title;

    await activity.save();

    res.json({ success: true, data: activity });
  } catch (error) {
    console.error('Update activity error:', error);
    res.status(500).json({ success: false, message: 'שגיאה בעדכון הפעילות' });
  }
});

module.exports = router;
