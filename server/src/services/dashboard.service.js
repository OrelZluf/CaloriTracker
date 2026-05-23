const { getDb } = require('../config/database');

/**
 * Get daily summary for a user on a specific date.
 * @param {number} userId
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Object} Daily summary with totals and meal list
 */
function getDailySummary(userId, date) {
  const db = getDb();

  // Get aggregated totals for the day
  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(total_calories), 0) AS total_calories,
      COALESCE(SUM(total_protein), 0) AS total_protein,
      COALESCE(SUM(total_carbs), 0) AS total_carbs,
      COALESCE(SUM(total_fat), 0) AS total_fat,
      COUNT(*) AS meal_count
    FROM meals
    WHERE user_id = ? AND DATE(created_at) = ?
  `).get(userId, date);

  // Get the user's daily calorie goal
  const user = db.prepare('SELECT daily_calorie_goal FROM users WHERE id = ?').get(userId);

  // Get individual meals for the day
  const meals = db.prepare(`
    SELECT id, title, meal_type, total_calories, total_protein, total_carbs, total_fat,
           input_method, image_path, created_at
    FROM meals
    WHERE user_id = ? AND DATE(created_at) = ?
    ORDER BY created_at ASC
  `).all(userId, date);

  return {
    date,
    daily_calorie_goal: user ? user.daily_calorie_goal : 2000,
    total_calories: totals.total_calories,
    total_protein: totals.total_protein,
    total_carbs: totals.total_carbs,
    total_fat: totals.total_fat,
    meal_count: totals.meal_count,
    remaining_calories: (user ? user.daily_calorie_goal : 2000) - totals.total_calories,
    meals
  };
}

/**
 * Get weekly summary: daily totals for the 7-day period ending at the given date.
 * @param {number} userId
 * @param {string} date - End date in YYYY-MM-DD format
 * @returns {Object} Weekly summary with daily breakdowns
 */
function getWeeklySummary(userId, date) {
  const db = getDb();

  const dailyTotals = db.prepare(`
    SELECT
      DATE(created_at) AS date,
      COALESCE(SUM(total_calories), 0) AS total_calories,
      COALESCE(SUM(total_protein), 0) AS total_protein,
      COALESCE(SUM(total_carbs), 0) AS total_carbs,
      COALESCE(SUM(total_fat), 0) AS total_fat,
      COUNT(*) AS meal_count
    FROM meals
    WHERE user_id = ?
      AND DATE(created_at) BETWEEN DATE(?, '-6 days') AND DATE(?)
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at) ASC
  `).all(userId, date, date);

  // Calculate week averages
  const totalDays = dailyTotals.length || 1;
  const weekTotals = dailyTotals.reduce(
    (acc, day) => {
      acc.total_calories += day.total_calories;
      acc.total_protein += day.total_protein;
      acc.total_carbs += day.total_carbs;
      acc.total_fat += day.total_fat;
      acc.meal_count += day.meal_count;
      return acc;
    },
    { total_calories: 0, total_protein: 0, total_carbs: 0, total_fat: 0, meal_count: 0 }
  );

  return {
    start_date: new Date(new Date(date).getTime() - 6 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    end_date: date,
    daily_totals: dailyTotals,
    averages: {
      avg_calories: Math.round((weekTotals.total_calories / totalDays) * 10) / 10,
      avg_protein: Math.round((weekTotals.total_protein / totalDays) * 10) / 10,
      avg_carbs: Math.round((weekTotals.total_carbs / totalDays) * 10) / 10,
      avg_fat: Math.round((weekTotals.total_fat / totalDays) * 10) / 10
    },
    total_meals: weekTotals.meal_count
  };
}

/**
 * Get monthly summary: daily totals for a given month.
 * @param {number} userId
 * @param {number} month - Month (1-12)
 * @param {number} year - Year (e.g. 2026)
 * @returns {Object} Monthly summary with daily breakdowns
 */
function getMonthlySummary(userId, month, year) {
  const db = getDb();

  const monthStr = String(month).padStart(2, '0');
  const startDate = `${year}-${monthStr}-01`;

  // Calculate last day of month
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  const dailyTotals = db.prepare(`
    SELECT
      DATE(created_at) AS date,
      COALESCE(SUM(total_calories), 0) AS total_calories,
      COALESCE(SUM(total_protein), 0) AS total_protein,
      COALESCE(SUM(total_carbs), 0) AS total_carbs,
      COALESCE(SUM(total_fat), 0) AS total_fat,
      COUNT(*) AS meal_count
    FROM meals
    WHERE user_id = ?
      AND DATE(created_at) BETWEEN ? AND ?
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at) ASC
  `).all(userId, startDate, endDate);

  // Calculate monthly totals
  const totalDays = dailyTotals.length || 1;
  const monthTotals = dailyTotals.reduce(
    (acc, day) => {
      acc.total_calories += day.total_calories;
      acc.total_protein += day.total_protein;
      acc.total_carbs += day.total_carbs;
      acc.total_fat += day.total_fat;
      acc.meal_count += day.meal_count;
      return acc;
    },
    { total_calories: 0, total_protein: 0, total_carbs: 0, total_fat: 0, meal_count: 0 }
  );

  return {
    month,
    year,
    start_date: startDate,
    end_date: endDate,
    daily_totals: dailyTotals,
    averages: {
      avg_calories: Math.round((monthTotals.total_calories / totalDays) * 10) / 10,
      avg_protein: Math.round((monthTotals.total_protein / totalDays) * 10) / 10,
      avg_carbs: Math.round((monthTotals.total_carbs / totalDays) * 10) / 10,
      avg_fat: Math.round((monthTotals.total_fat / totalDays) * 10) / 10
    },
    total_meals: monthTotals.meal_count,
    days_with_data: dailyTotals.length
  };
}

module.exports = { getDailySummary, getWeeklySummary, getMonthlySummary };
