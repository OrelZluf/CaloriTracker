const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'caloritrack.db');

let db;

function initializeDatabase() {
  db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      avatar_url TEXT,
      height_cm REAL,
      weight_kg REAL,
      gender TEXT CHECK(gender IN ('male','female')) DEFAULT 'male',
      age INTEGER,
      daily_calorie_goal INTEGER DEFAULT 2000,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      image_path TEXT,
      meal_type TEXT CHECK(meal_type IN ('breakfast','lunch','dinner','snack')),
      total_calories REAL DEFAULT 0,
      total_protein REAL DEFAULT 0,
      total_carbs REAL DEFAULT 0,
      total_fat REAL DEFAULT 0,
      input_method TEXT CHECK(input_method IN ('image','text')),
      raw_input TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT CHECK(category IN ('protein','carb','fat','vegetable','fruit','dairy','other')),
      estimated_grams REAL,
      calories REAL,
      protein_grams REAL,
      carbs_grams REAL,
      fat_grams REAL,
      fiber_grams REAL,
      sugar_grams REAL,
      FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_meals_user_id ON meals(user_id);
    CREATE INDEX IF NOT EXISTS idx_meals_created_at ON meals(created_at);
    CREATE INDEX IF NOT EXISTS idx_ingredients_meal_id ON ingredients(meal_id);
  `);

  console.log('Database initialized successfully');
  return db;
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

module.exports = { initializeDatabase, getDb };
