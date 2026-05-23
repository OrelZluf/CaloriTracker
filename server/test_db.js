const { initializeDatabase, getDb } = require('./src/config/database');

try {
  initializeDatabase();
  const db = getDb();
  const result = db.prepare('UPDATE users SET height_cm = ?, weight_kg = ?, age = ? WHERE id = 1').run(180, 80, 30);
  console.log('Update result:', result);
} catch (e) {
  console.error('Update error:', e);
}
