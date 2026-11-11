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
