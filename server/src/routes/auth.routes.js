const express = require('express');
const router = express.Router();
const { verifyGoogleToken, generateJWT, findOrCreateUser } = require('../services/auth.service');
const { requireAuth } = require('../middleware/auth.middleware');
const User = require('../models/User');

/**
 * POST /api/auth/google
 * Authenticate with Google ID token.
 * Returns JWT token and user profile.
 */
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'נדרש טוקן הזדהות של Google.'
      });
    }

    // Verify the Google ID token
    const googleProfile = await verifyGoogleToken(idToken);

    // Find or create user in database
    const user = await findOrCreateUser(googleProfile);

    // Generate JWT
    const token = generateJWT(user);

    res.json({
      success: true,
      message: 'התחברת בהצלחה!',
      data: {
        token,
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({
      success: false,
      message: 'ההזדהות עם Google נכשלה. אנא נסה שוב.'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user profile.
 */
router.get('/me', requireAuth, (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user.toJSON()
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת פרופיל המשתמש.'
    });
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile: daily_calorie_goal, height_cm, weight_kg, gender, age.
 */
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { daily_calorie_goal, height_cm, weight_kg, gender, age } = req.body;
    
    const updates = {};

    if (daily_calorie_goal !== undefined) {
      const goal = parseInt(daily_calorie_goal, 10);
      if (isNaN(goal) || goal < 500 || goal > 10000) {
        return res.status(400).json({ success: false, message: 'יעד הקלוריות חייב להיות בין 500 ל-10,000.' });
      }
      updates.daily_calorie_goal = goal;
    }

    if (height_cm !== undefined) {
      if (height_cm === null || height_cm === '') {
        updates.height_cm = null;
      } else {
        const h = parseFloat(height_cm);
        if (isNaN(h) || h < 50 || h > 300) {
          return res.status(400).json({ success: false, message: 'גובה חייב להיות בין 50 ל-300 ס"מ.' });
        }
        updates.height_cm = h;
      }
    }

    if (weight_kg !== undefined) {
      if (weight_kg === null || weight_kg === '') {
        updates.weight_kg = null;
      } else {
        const w = parseFloat(weight_kg);
        if (isNaN(w) || w < 20 || w > 500) {
          return res.status(400).json({ success: false, message: 'משקל חייב להיות בין 20 ל-500 ק"ג.' });
        }
        updates.weight_kg = w;
      }
    }

    if (gender !== undefined) {
      if (!['male', 'female'].includes(gender)) {
        return res.status(400).json({ success: false, message: 'מין חייב להיות male או female.' });
      }
      updates.gender = gender;
    }

    if (age !== undefined) {
      if (age === null || age === '') {
        updates.age = null;
      } else {
        const a = parseInt(age, 10);
        if (isNaN(a) || a < 10 || a > 120) {
          return res.status(400).json({ success: false, message: 'גיל חייב להיות בין 10 ל-120.' });
        }
        updates.age = a;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'לא נשלחו נתונים לעדכון.' });
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, { new: true });

    res.json({
      success: true,
      message: 'הפרופיל עודכן בהצלחה!',
      data: updatedUser.toJSON()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'שגיאה בעדכון הפרופיל.' });
  }
});

module.exports = router;
