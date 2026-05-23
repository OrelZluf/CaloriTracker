const express = require('express');
const router = express.Router();
const { verifyGoogleToken, generateJWT, findOrCreateUser } = require('../services/auth.service');
const { requireAuth } = require('../middleware/auth.middleware');
const { getDb } = require('../config/database');

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
    const user = findOrCreateUser(googleProfile);

    // Generate JWT
    const token = generateJWT(user);

    res.json({
      success: true,
      message: 'התחברת בהצלחה!',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url,
          daily_calorie_goal: user.daily_calorie_goal,
          created_at: user.created_at
        }
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
    const user = req.user;
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        daily_calorie_goal: user.daily_calorie_goal,
        created_at: user.created_at
      }
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
router.put('/profile', requireAuth, (req, res) => {
  try {
    const { daily_calorie_goal, height_cm, weight_kg, gender, age } = req.body;
    const db = getDb();

    const updates = [];
    const values = [];

    if (daily_calorie_goal !== undefined) {
      const goal = parseInt(daily_calorie_goal, 10);
      if (isNaN(goal) || goal < 500 || goal > 10000) {
        return res.status(400).json({ success: false, message: 'יעד הקלוריות חייב להיות בין 500 ל-10,000.' });
      }
      updates.push('daily_calorie_goal = ?');
      values.push(goal);
    }

    if (height_cm !== undefined) {
      const h = parseFloat(height_cm);
      if (isNaN(h) || h < 50 || h > 300) {
        return res.status(400).json({ success: false, message: 'גובה חייב להיות בין 50 ל-300 ס"מ.' });
      }
      updates.push('height_cm = ?');
      values.push(h);
    }

    if (weight_kg !== undefined) {
      const w = parseFloat(weight_kg);
      if (isNaN(w) || w < 20 || w > 500) {
        return res.status(400).json({ success: false, message: 'משקל חייב להיות בין 20 ל-500 ק"ג.' });
      }
      updates.push('weight_kg = ?');
      values.push(w);
    }

    if (gender !== undefined) {
      if (!['male', 'female'].includes(gender)) {
        return res.status(400).json({ success: false, message: 'מין חייב להיות male או female.' });
      }
      updates.push('gender = ?');
      values.push(gender);
    }

    if (age !== undefined) {
      const a = parseInt(age, 10);
      if (isNaN(a) || a < 10 || a > 120) {
        return res.status(400).json({ success: false, message: 'גיל חייב להיות בין 10 ל-120.' });
      }
      updates.push('age = ?');
      values.push(a);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'לא נשלחו נתונים לעדכון.' });
    }

    values.push(req.user.id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    res.json({
      success: true,
      message: 'הפרופיל עודכן בהצלחה!',
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        avatar_url: updatedUser.avatar_url,
        height_cm: updatedUser.height_cm,
        weight_kg: updatedUser.weight_kg,
        gender: updatedUser.gender,
        age: updatedUser.age,
        daily_calorie_goal: updatedUser.daily_calorie_goal,
        created_at: updatedUser.created_at
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'שגיאה בעדכון הפרופיל.' });
  }
});

/**
 * POST /api/auth/demo
 * Login with a demo account (no Google required).
 */
router.post('/demo', (req, res) => {
  try {
    const demoProfile = {
      googleId: 'demo_user_001',
      email: 'demo@caloritrack.app',
      name: 'משתמש דמו',
      avatarUrl: null
    };

    const user = findOrCreateUser(demoProfile);
    const token = generateJWT(user);

    res.json({
      success: true,
      message: 'התחברת בהצלחה כמשתמש דמו!',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url,
          daily_calorie_goal: user.daily_calorie_goal,
          created_at: user.created_at
        }
      }
    });
  } catch (error) {
    console.error('Demo auth error:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בהתחברות דמו.'
    });
  }
});

module.exports = router;
