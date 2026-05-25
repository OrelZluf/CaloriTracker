const express = require('express');
const router = express.Router();
const { verifyGoogleToken, generateJWT, findOrCreateUser } = require('../services/auth.service');
const { requireAuth } = require('../middleware/auth.middleware');
const User = require('../models/User');

function calculateMacros(userObj) {
  const h = userObj.height_cm;
  const w = userObj.weight_kg;
  const goal = userObj.daily_calorie_goal || 2000;

  if (!h || !w) {
    // Fallback to standard 30/40/30
    return {
      macro_protein_g: Math.round((goal * 0.3) / 4),
      macro_carbs_g: Math.round((goal * 0.4) / 4),
      macro_fat_g: Math.round((goal * 0.3) / 9)
    };
  }

  const heightM = h / 100;
  const bmi = w / (heightM * heightM);

  let proteinPct, carbsPct, fatPct;

  if (bmi < 18.5) {
    // Underweight: Higher carbs for gaining
    proteinPct = 0.25; carbsPct = 0.50; fatPct = 0.25;
  } else if (bmi < 25) {
    // Normal
    proteinPct = 0.30; carbsPct = 0.45; fatPct = 0.25;
  } else if (bmi < 30) {
    // Overweight
    proteinPct = 0.35; carbsPct = 0.35; fatPct = 0.30;
  } else {
    // Obese
    proteinPct = 0.40; carbsPct = 0.30; fatPct = 0.30;
  }

  return {
    macro_protein_g: Math.round((goal * proteinPct) / 4),
    macro_carbs_g: Math.round((goal * carbsPct) / 4),
    macro_fat_g: Math.round((goal * fatPct) / 9)
  };
}

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

    // Merge existing user data with updates to calculate macros
    const mergedUser = { ...req.user.toObject(), ...updates };
    const macros = calculateMacros(mergedUser);
    updates.macro_protein_g = macros.macro_protein_g;
    updates.macro_carbs_g = macros.macro_carbs_g;
    updates.macro_fat_g = macros.macro_fat_g;

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
