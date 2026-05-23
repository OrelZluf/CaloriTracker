const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const { getDailySummary, getWeeklySummary, getMonthlySummary } = require('../services/dashboard.service');

/**
 * GET /api/dashboard/daily?date=YYYY-MM-DD
 * Get daily calorie and macro summary.
 */
router.get('/daily', requireAuth, (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'פורמט תאריך לא תקין. השתמש בפורמט YYYY-MM-DD.'
      });
    }

    const summary = getDailySummary(req.user.id, date);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Daily summary error:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת סיכום יומי.'
    });
  }
});

/**
 * GET /api/dashboard/weekly?date=YYYY-MM-DD
 * Get weekly calorie and macro summary (7 days ending at date).
 */
router.get('/weekly', requireAuth, (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'פורמט תאריך לא תקין. השתמש בפורמט YYYY-MM-DD.'
      });
    }

    const summary = getWeeklySummary(req.user.id, date);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Weekly summary error:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת סיכום שבועי.'
    });
  }
});

/**
 * GET /api/dashboard/monthly?month=1-12&year=YYYY
 * Get monthly calorie and macro summary.
 */
router.get('/monthly', requireAuth, (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month, 10) || (now.getMonth() + 1);
    const year = parseInt(req.query.year, 10) || now.getFullYear();

    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        message: 'חודש לא תקין. הערך חייב להיות בין 1 ל-12.'
      });
    }

    if (year < 2000 || year > 2100) {
      return res.status(400).json({
        success: false,
        message: 'שנה לא תקינה.'
      });
    }

    const summary = getMonthlySummary(req.user.id, month, year);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Monthly summary error:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת סיכום חודשי.'
    });
  }
});

module.exports = router;
