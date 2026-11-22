const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const jwt = require('jsonwebtoken');

const User = require('../src/models/User');
const Meal = require('../src/models/Meal');
const Activity = require('../src/models/Activity');
const WeightLog = require('../src/models/WeightLog');
const WaterLog = require('../src/models/WaterLog');
const mealsRoutes = require('../src/routes/meals.routes');
const weightRoutes = require('../src/routes/weight.routes');
const waterRoutes = require('../src/routes/water.routes');
const DailyInsight = require('../src/models/DailyInsight');
const insightRoutes = require('../src/routes/insight.routes');
const advisorRoutes = require('../src/routes/advisor.routes');
const appleHealthRoutes = require('../src/routes/apple-health.routes');

const TEST_USER_ID = '65f000000000000000000001';
const mockUserDoc = {
  _id: TEST_USER_ID,
  id: TEST_USER_ID,
  name: 'Test User',
  email: 'test@example.com',
  daily_calorie_goal: 2000,
  height_cm: 180,
  weight_kg: 82,
  age: 30,
  gender: 'male',
  toJSON() {
    return { ...this };
  },
  toObject() {
    return { ...this };
  }
};

const token = jwt.sign(
  { id: TEST_USER_ID },
  process.env.JWT_SECRET || 'caloritrack-default-jwt-secret-change-in-production'
);

function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/meals', mealsRoutes);
  app.use('/api/weight', weightRoutes);
  app.use('/api/water', waterRoutes);
  app.use('/api/insights', insightRoutes);
  app.use('/api/advisor', advisorRoutes);
  app.use('/api/apple-health', appleHealthRoutes);
  return http.createServer(app);
}

async function requestJson(server, method, path, body = null) {
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json();
  return { status: res.status, json };
}

test('Feature 3 Backend: Toggle Favorite & 1-Tap Clone Meal with Portion Multiplier', async () => {
  User.findById = async () => ({ ...mockUserDoc });

  const storedMeal = {
    _id: '65f000000000000000000101',
    user_id: TEST_USER_ID,
    title: 'שקשוקה ביתית',
    meal_type: 'breakfast',
    total_calories: 400,
    total_protein: 20,
    total_carbs: 16,
    total_fat: 28,
    input_method: 'text',
    is_favorite: false,
    ingredients: [
      {
        name: 'שקשוקה',
        category: 'protein',
        estimated_grams: 250,
        calories: 400,
        protein_grams: 20,
        carbs_grams: 16,
        fat_grams: 28,
        fiber_grams: 2,
        sugar_grams: 4
      }
    ],
    async save() {
      return this;
    },
    toJSON() {
      return { id: this._id, ...this };
    }
  };

  Meal.findOne = async () => storedMeal;
  let createdClonePayload = null;
  Meal.create = async (payload) => {
    createdClonePayload = payload;
    return {
      ...payload,
      _id: '65f000000000000000000102',
      toJSON() {
        return { id: '65f000000000000000000102', ...payload };
      }
    };
  };

  const server = createTestServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  try {
    // 1. Toggle favorite on
    const favRes = await requestJson(server, 'PUT', '/api/meals/65f000000000000000000101/favorite');
    assert.equal(favRes.status, 200);
    assert.equal(favRes.json.success, true);
    assert.equal(favRes.json.data.is_favorite, true);

    // 2. Clone meal with 1.5x multiplier
    const cloneRes = await requestJson(server, 'POST', '/api/meals/65f000000000000000000101/clone', {
      multiplier: 1.5,
      meal_type: 'dinner'
    });
    assert.equal(cloneRes.status, 201);
    assert.equal(cloneRes.json.success, true);
    assert.equal(cloneRes.json.data.total_calories, 600);
    assert.equal(cloneRes.json.data.total_protein, 30);
    assert.equal(cloneRes.json.data.meal_type, 'dinner');
    // Regression: re-logging a favorite must not duplicate it in the favorites list
    assert.equal(cloneRes.json.data.is_favorite, false);
    assert.equal(createdClonePayload.ingredients[0].estimated_grams, 375);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('Feature 4 Backend: Log Weight & Calculate Dynamic TDEE Coach Recommendation', async () => {
  User.findById = async () => ({ ...mockUserDoc });
  User.findByIdAndUpdate = async (_id, updates) => ({ ...mockUserDoc, ...updates });

  const weightStore = [
    {
      _id: 'w1',
      user_id: TEST_USER_ID,
      weight_kg: 83.0,
      date: '2026-06-01',
      note: 'התחלה',
      toJSON() {
        return { id: this._id, weight_kg: this.weight_kg, date: this.date, note: this.note };
      }
    }
  ];

  WeightLog.findOneAndUpdate = async (_filter, update) => {
    const newDoc = {
      _id: 'w2',
      ...update,
      toJSON() {
        return { id: this._id, weight_kg: this.weight_kg, date: this.date, note: this.note };
      }
    };
    weightStore.push(newDoc);
    return newDoc;
  };

  WeightLog.findOne = () => ({
    sort: async () => weightStore[weightStore.length - 1]
  });

  WeightLog.find = () => ({
    sort: async () => weightStore
  });

  Meal.find = async () => [
    { total_calories: 2100, created_at: new Date('2026-06-02T12:00:00Z') },
    { total_calories: 2000, created_at: new Date('2026-06-05T12:00:00Z') },
    { total_calories: 2050, created_at: new Date('2026-06-08T12:00:00Z') }
  ];
  Activity.find = async () => [
    { calories_burned: 150, created_at: new Date('2026-06-05T15:00:00Z') }
  ];

  const server = createTestServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  try {
    const postRes = await requestJson(server, 'POST', '/api/weight', {
      weight_kg: 82.0,
      date: '2026-06-08',
      note: 'שקילה שבועית'
    });

    assert.equal(postRes.status, 201);
    assert.equal(postRes.json.success, true);
    assert.equal(postRes.json.data.log.weight_kg, 82.0);
    assert.equal(postRes.json.data.coach.is_calibrated, true);
    assert.equal(postRes.json.data.coach.weight_change_kg, -1);
    assert.ok(postRes.json.data.coach.estimated_tdee > 2000);
    assert.ok(postRes.json.data.coach.recommended_goal >= 1200);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('Hydration Tracker & Israeli Barcode Scanner Backend Endpoints', async () => {
  User.findById = async () => ({ ...mockUserDoc });

  let waterDoc = null;
  WaterLog.findOne = async () => waterDoc;
  WaterLog.create = async (payload) => {
    waterDoc = {
      ...payload,
      async save() {
        return this;
      }
    };
    return waterDoc;
  };

  const server = createTestServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  try {
    // 1. Add 250ml water
    const waterRes1 = await requestJson(server, 'POST', '/api/water', {
      amount_ml: 250,
      date: '2026-06-10'
    });
    assert.equal(waterRes1.status, 200);
    assert.equal(waterRes1.json.data.total_ml, 250);
    assert.equal(waterRes1.json.data.glasses_count, 1);

    // 2. Add 500ml water
    const waterRes2 = await requestJson(server, 'POST', '/api/water', {
      amount_ml: 500,
      date: '2026-06-10'
    });
    assert.equal(waterRes2.status, 200);
    assert.equal(waterRes2.json.data.total_ml, 750);
    assert.equal(waterRes2.json.data.glasses_count, 3);

    // 3. Lookup Israeli barcode (Tnuva Cottage 5%)
    const barcodeRes = await requestJson(server, 'GET', '/api/meals/barcode/7290004127329');
    assert.equal(barcodeRes.status, 200);
    assert.equal(barcodeRes.json.success, true);
    assert.ok(barcodeRes.json.data.analysis.title.includes('קוטג׳ תנובה'));
    assert.equal(barcodeRes.json.data.analysis.ingredients[0].calories, 238);
    assert.equal(barcodeRes.json.data.analysis.ingredients[0].protein_grams, 28);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('Custom Water Glass & Bottle Sizes: PUT /api/water/settings', async () => {
  let userDoc = { ...mockUserDoc };
  User.findById = async () => ({ ...userDoc });
  User.findByIdAndUpdate = async (_id, update) => {
    userDoc = { ...userDoc, ...update };
    return { ...userDoc };
  };
  WaterLog.findOne = async () => ({ amount_ml: 990 });

  const server = createTestServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  try {
    const okRes = await requestJson(server, 'PUT', '/api/water/settings', {
      glass_ml: 330,
      bottle_ml: 1500,
      date: '2026-06-10'
    });
    assert.equal(okRes.status, 200);
    assert.equal(okRes.json.data.glass_ml, 330);
    assert.equal(okRes.json.data.bottle_ml, 1500);
    assert.equal(okRes.json.data.glasses_count, 3);
    assert.equal(userDoc.water_glass_ml, 330);

    const getRes = await requestJson(server, 'GET', '/api/water?date=2026-06-10');
    assert.equal(getRes.json.data.glass_ml, 330);
    assert.equal(getRes.json.data.bottle_ml, 1500);

    const badRes = await requestJson(server, 'PUT', '/api/water/settings', {
      glass_ml: 10,
      bottle_ml: 500
    });
    assert.equal(badRes.status, 400);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('Per-day insights: GET /api/insights/day', async () => {
  User.findById = async () => ({ ...mockUserDoc });
  const cached = {
    user_id: TEST_USER_ID,
    date: '2026-06-09',
    preserve_text: 'שמרת על חלבון גבוה',
    improve_text: 'שתה יותר מים'
  };
  let mealQuery = null;
  DailyInsight.findOne = async (q) => (q.date === '2026-06-09' ? cached : null);
  Meal.find = async (q) => { mealQuery = q; return []; };
  Activity.find = async () => [];

  const server = createTestServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  try {
    const cachedRes = await requestJson(server, 'GET', '/api/insights/day?date=2026-06-09');
    assert.equal(cachedRes.status, 200);
    assert.equal(cachedRes.json.data.insight.preserve_text, 'שמרת על חלבון גבוה');

    const emptyRes = await requestJson(server, 'GET', '/api/insights/day?date=2026-06-08');
    assert.equal(emptyRes.status, 200);
    assert.equal(emptyRes.json.data.insight, null);
    assert.equal(new Date(mealQuery.created_at.$gte).toISOString(), '2026-06-08T00:00:00.000Z');
    assert.equal(new Date(mealQuery.created_at.$lte).toISOString(), '2026-06-08T23:59:59.999Z');

    const badRes = await requestJson(server, 'GET', '/api/insights/day?date=yesterday');
    assert.equal(badRes.status, 400);

    const futureRes = await requestJson(server, 'GET', '/api/insights/day?date=2999-01-01');
    assert.equal(futureRes.status, 400);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('Feature 6 Backend: Interactive Nutrition Advisor Chat (POST /api/advisor/chat)', async () => {
  User.findById = async () => ({
    ...mockUserDoc,
    daily_calorie_goal: 2000,
    macro_protein_g: 150,
    macro_carbs_g: 200,
    macro_fat_g: 65
  });
  Meal.find = async () => ([
    {
      title: 'חביתה וסלט',
      meal_type: 'breakfast',
      total_calories: 400,
      total_protein: 25,
      total_carbs: 20,
      total_fat: 22
    }
  ]);
  Activity.find = async () => ([
    {
      title: 'הליכה מהירה',
      calories_burned: 150
    }
  ]);

  const server = createTestServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  try {
    const res = await requestJson(server, 'POST', '/api/advisor/chat', {
      message: 'מה כדאי לי לאכול לארוחת ערב כדי להשלים חלבון ולא לעבור את היעד?',
      date: '2026-06-10',
      history: []
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.ok(typeof res.json.data.reply === 'string' && res.json.data.reply.length > 0);
    assert.ok(Array.isArray(res.json.data.suggestions) && res.json.data.suggestions.length >= 1);
    // Net calories = 400 - 150 = 250 -> remaining = 2000 - 250 = 1750
    assert.equal(res.json.data.budget.remaining_calories, 1750);
    assert.equal(res.json.data.budget.remaining_protein, 125);
    // Every suggestion must stay within remaining_calories
    for (const sug of res.json.data.suggestions) {
      assert.ok(sug.calories <= res.json.data.budget.remaining_calories);
    }

    const emptyRes = await requestJson(server, 'POST', '/api/advisor/chat', { message: '   ' });
    assert.equal(emptyRes.status, 400);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('Feature 7 Backend: Apple Watch Sync, Token Generation & Webhook (/api/apple-health/*)', async () => {
  let userDoc = { ...mockUserDoc, apple_watch_token: null };
  const savedWorkouts = [];

  User.findById = async () => ({ ...userDoc });
  User.findByIdAndUpdate = async (_id, update) => {
    userDoc = { ...userDoc, ...update };
    return { ...userDoc };
  };
  User.findOne = async (q) => (q.apple_watch_token && q.apple_watch_token === userDoc.apple_watch_token ? { ...userDoc } : null);
  Activity.findOne = async (q) => savedWorkouts.find(w => w.external_id === q.external_id) || null;
  Activity.find = async () => savedWorkouts;
  Activity.prototype.save = async function () {
    const doc = {
      _id: '65f0000000000000000009' + String(savedWorkouts.length + 1).padStart(2, '0'),
      user_id: this.user_id,
      title: this.title,
      activity_type: this.activity_type,
      duration_minutes: this.duration_minutes,
      calories_burned: this.calories_burned,
      met_value: this.met_value,
      input_method: this.input_method,
      external_id: this.external_id,
      created_at: this.created_at || new Date()
    };
    savedWorkouts.push(doc);
    Object.assign(this, doc);
    return this;
  };

  const server = createTestServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  try {
    // 1. One-click Apple Watch setup
    const oneClickRes = await requestJson(server, 'POST', '/api/apple-health/one-click-setup');
    assert.equal(oneClickRes.status, 200);
    assert.equal(oneClickRes.json.data.connected, true);
    assert.ok(oneClickRes.json.data.sync_token.startsWith('aw_'));
    assert.ok(oneClickRes.json.data.ios_shortcuts_deeplink.startsWith('shortcuts://'));

    // Generate personal Apple Watch sync token
    const tokenRes = await requestJson(server, 'POST', '/api/apple-health/token');
    assert.equal(tokenRes.status, 200);
    assert.ok(tokenRes.json.data.sync_token.startsWith('aw_'));
    const awToken = tokenRes.json.data.sync_token;

    // 2. Sync workouts directly via authenticated /api/apple-health/sync
    const syncRes = await requestJson(server, 'POST', '/api/apple-health/sync', {
      workouts: [
        {
          external_id: 'aw-workout-1',
          workoutActivityType: 'HKWorkoutActivityTypeRunning',
          duration_minutes: 35,
          activeEnergyBurned: 380,
          date: '2026-06-10'
        },
        {
          external_id: 'aw-workout-2',
          workoutActivityType: 'HKWorkoutActivityTypeYoga',
          duration_minutes: 45,
          activeEnergyBurned: 165,
          date: '2026-06-10'
        }
      ]
    });
    assert.equal(syncRes.status, 201);
    assert.equal(syncRes.json.data.imported_count, 2);
    assert.equal(syncRes.json.data.total_calories_burned, 545);
    assert.equal(savedWorkouts[0].input_method, 'apple_watch');
    assert.equal(savedWorkouts[0].activity_type, 'running');
    assert.equal(savedWorkouts[1].activity_type, 'yoga');

    // 3. Re-syncing same external_id is deduplicated
    const dupRes = await requestJson(server, 'POST', '/api/apple-health/sync', {
      workouts: [
        {
          external_id: 'aw-workout-1',
          workoutActivityType: 'HKWorkoutActivityTypeRunning',
          duration_minutes: 35,
          activeEnergyBurned: 380,
          date: '2026-06-10'
        }
      ]
    });
    assert.equal(dupRes.status, 201);
    assert.equal(dupRes.json.data.imported_count, 0);
    assert.equal(dupRes.json.data.skipped_duplicates, 1);

    // 4. Webhook sync (simulating iOS Shortcut with token)
    const webhookRes = await requestJson(server, 'POST', `/api/apple-health/webhook?token=${awToken}`, {
      workouts: [
        {
          external_id: 'aw-workout-3',
          workoutActivityType: 'HKWorkoutActivityTypeHighIntensityIntervalTraining',
          duration_minutes: 25,
          activeEnergyBurned: 290,
          date: '2026-06-10'
        }
      ]
    });
    assert.equal(webhookRes.status, 201);
    assert.equal(webhookRes.json.data.imported_count, 1);
    assert.equal(webhookRes.json.data.total_calories_burned, 290);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
