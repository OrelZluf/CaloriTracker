const Meal = require('../models/Meal');
const Activity = require('../models/Activity');
const User = require('../models/User');

/**
 * Get daily summary for a user on a specific date.
 * @param {string} userId
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Daily summary with totals and meal list
 */
async function getDailySummary(userId, date) {
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const meals = await Meal.find({
    user_id: userId,
    created_at: { $gte: startOfDay, $lte: endOfDay }
  }).sort({ created_at: 1 });

  const user = await User.findById(userId);
  const goal = user ? user.daily_calorie_goal : 2000;

  const totals = meals.reduce((acc, meal) => {
    acc.total_calories += meal.total_calories || 0;
    acc.total_protein += meal.total_protein || 0;
    acc.total_carbs += meal.total_carbs || 0;
    acc.total_fat += meal.total_fat || 0;
    return acc;
  }, { total_calories: 0, total_protein: 0, total_carbs: 0, total_fat: 0 });

  const activities = await Activity.find({
    user_id: userId,
    created_at: { $gte: startOfDay, $lte: endOfDay }
  }).sort({ created_at: 1 });

  const total_calories_burned = activities.reduce((acc, act) => acc + (act.calories_burned || 0), 0);

  return {
    date,
    daily_calorie_goal: goal,
    total_calories: totals.total_calories,
    total_calories_burned: total_calories_burned,
    total_protein: totals.total_protein,
    total_carbs: totals.total_carbs,
    total_fat: totals.total_fat,
    meal_count: meals.length,
    remaining_calories: goal - totals.total_calories + total_calories_burned,
    meals: meals.map(m => m.toJSON()),
    activities: activities.map(a => a.toJSON())
  };
}

/**
 * Get weekly summary: daily totals for the 7-day period ending at the given date.
 * @param {string} userId
 * @param {string} date - End date in YYYY-MM-DD format
 * @returns {Promise<Object>} Weekly summary with daily breakdowns
 */
async function getWeeklySummary(userId, date) {
  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const startOfDay = new Date(date);
  startOfDay.setDate(startOfDay.getDate() - 6);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const meals = await Meal.find({
    user_id: userId,
    created_at: { $gte: startOfDay, $lte: endOfDay }
  }).sort({ created_at: 1 });

  // Group by date
  const dailyMap = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfDay);
    d.setDate(d.getDate() + i);
    dailyMap[d.toISOString().split('T')[0]] = {
      date: d.toISOString().split('T')[0],
      total_calories: 0,
      total_protein: 0,
      total_carbs: 0,
      total_fat: 0,
      meal_count: 0
    };
  }

  meals.forEach(meal => {
    const dateStr = meal.created_at.toISOString().split('T')[0];
    if (dailyMap[dateStr]) {
      dailyMap[dateStr].total_calories += meal.total_calories || 0;
      dailyMap[dateStr].total_protein += meal.total_protein || 0;
      dailyMap[dateStr].total_carbs += meal.total_carbs || 0;
      dailyMap[dateStr].total_fat += meal.total_fat || 0;
      dailyMap[dateStr].meal_count += 1;
    }
  });

  const activities = await Activity.find({
    user_id: userId,
    created_at: { $gte: startOfDay, $lte: endOfDay }
  }).sort({ created_at: 1 });

  const activitySummaryMap = {};

  activities.forEach(act => {
    const dateStr = act.created_at.toISOString().split('T')[0];
    if (dailyMap[dateStr]) {
      dailyMap[dateStr].total_calories_burned = (dailyMap[dateStr].total_calories_burned || 0) + (act.calories_burned || 0);
    }

    const type = act.activity_type || 'other';
    if (!activitySummaryMap[type]) {
      activitySummaryMap[type] = {
        activity_type: type,
        total_duration: 0,
        total_calories: 0,
        count: 0
      };
    }
    activitySummaryMap[type].total_duration += act.duration_minutes || 0;
    activitySummaryMap[type].total_calories += act.calories_burned || 0;
    activitySummaryMap[type].count += 1;
  });

  const activities_summary = Object.values(activitySummaryMap).sort((a, b) => b.total_calories - a.total_calories);

  const dailyTotals = Object.values(dailyMap);
  const totalDays = dailyTotals.filter(d => d.meal_count > 0).length || 1;

  const weekTotals = dailyTotals.reduce((acc, day) => {
    acc.total_calories += day.total_calories;
    acc.total_protein += day.total_protein;
    acc.total_carbs += day.total_carbs;
    acc.total_fat += day.total_fat;
    acc.meal_count += day.meal_count;
    return acc;
  }, { total_calories: 0, total_protein: 0, total_carbs: 0, total_fat: 0, meal_count: 0 });

  return {
    start_date: startOfDay.toISOString().split('T')[0],
    end_date: endOfDay.toISOString().split('T')[0],
    days: dailyTotals,
    averages: {
      avg_calories: Math.round((weekTotals.total_calories / totalDays) * 10) / 10,
      avg_protein: Math.round((weekTotals.total_protein / totalDays) * 10) / 10,
      avg_carbs: Math.round((weekTotals.total_carbs / totalDays) * 10) / 10,
      avg_fat: Math.round((weekTotals.total_fat / totalDays) * 10) / 10
    },
    total_meals: weekTotals.meal_count,
    activities_summary
  };
}

/**
 * Get monthly summary: daily totals for a given month.
 * @param {string} userId
 * @param {number} month - Month (1-12)
 * @param {number} year - Year (e.g. 2026)
 * @returns {Promise<Object>} Monthly summary with daily breakdowns
 */
async function getMonthlySummary(userId, month, year) {
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const meals = await Meal.find({
    user_id: userId,
    created_at: { $gte: startDate, $lte: endDate }
  }).sort({ created_at: 1 });

  const dailyMap = {};
  const lastDay = endDate.getUTCDate();
  for (let i = 1; i <= lastDay; i++) {
    const dStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    dailyMap[dStr] = {
      date: dStr,
      total_calories: 0,
      total_protein: 0,
      total_carbs: 0,
      total_fat: 0,
      meal_count: 0
    };
  }

  meals.forEach(meal => {
    const dateStr = meal.created_at.toISOString().split('T')[0];
    if (dailyMap[dateStr]) {
      dailyMap[dateStr].total_calories += meal.total_calories || 0;
      dailyMap[dateStr].total_protein += meal.total_protein || 0;
      dailyMap[dateStr].total_carbs += meal.total_carbs || 0;
      dailyMap[dateStr].total_fat += meal.total_fat || 0;
      dailyMap[dateStr].meal_count += 1;
    }
  });

  const activities = await Activity.find({
    user_id: userId,
    created_at: { $gte: startDate, $lte: endDate }
  }).sort({ created_at: 1 });

  const activitySummaryMap = {};

  activities.forEach(act => {
    const dateStr = act.created_at.toISOString().split('T')[0];
    if (dailyMap[dateStr]) {
      dailyMap[dateStr].total_calories_burned = (dailyMap[dateStr].total_calories_burned || 0) + (act.calories_burned || 0);
    }

    const type = act.activity_type || 'other';
    if (!activitySummaryMap[type]) {
      activitySummaryMap[type] = {
        activity_type: type,
        total_duration: 0,
        total_calories: 0,
        count: 0
      };
    }
    activitySummaryMap[type].total_duration += act.duration_minutes || 0;
    activitySummaryMap[type].total_calories += act.calories_burned || 0;
    activitySummaryMap[type].count += 1;
  });

  const activities_summary = Object.values(activitySummaryMap).sort((a, b) => b.total_calories - a.total_calories);

  const dailyTotals = Object.values(dailyMap);
  const daysWithData = dailyTotals.filter(d => d.meal_count > 0).length;
  const totalDays = daysWithData || 1;

  const monthTotals = dailyTotals.reduce((acc, day) => {
    acc.total_calories += day.total_calories;
    acc.total_protein += day.total_protein;
    acc.total_carbs += day.total_carbs;
    acc.total_fat += day.total_fat;
    acc.meal_count += day.meal_count;
    return acc;
  }, { total_calories: 0, total_protein: 0, total_carbs: 0, total_fat: 0, meal_count: 0 });

  return {
    month,
    year,
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    days: dailyTotals,
    averages: {
      avg_calories: Math.round((monthTotals.total_calories / totalDays) * 10) / 10,
      avg_protein: Math.round((monthTotals.total_protein / totalDays) * 10) / 10,
      avg_carbs: Math.round((monthTotals.total_carbs / totalDays) * 10) / 10,
      avg_fat: Math.round((monthTotals.total_fat / totalDays) * 10) / 10
    },
    total_meals: monthTotals.meal_count,
    days_with_data: daysWithData,
    activities_summary
  };
}

module.exports = { getDailySummary, getWeeklySummary, getMonthlySummary };
