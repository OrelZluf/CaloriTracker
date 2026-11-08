const mongoose = require('mongoose');

let cachedConnectionPromise = null;

async function initializeDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined in environment variables.');
    return null;
  }

  // 1 = connected
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Reuse in-flight connection promise across concurrent serverless requests
  if (!cachedConnectionPromise) {
    cachedConnectionPromise = mongoose
      .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 8000,
      })
      .then((conn) => {
        console.log('Connected to MongoDB Atlas');
        return conn;
      })
      .catch((err) => {
        cachedConnectionPromise = null;
        console.error('Failed to connect to MongoDB Atlas:', err);
        throw err;
      });
  }

  return cachedConnectionPromise;
}

/**
 * Express middleware that ensures the backend is connected to MongoDB
 * before handling any database-backed API request.
 */
async function ensureDatabaseConnection(req, res, next) {
  if (!process.env.MONGODB_URI) {
    return res.status(500).json({
      success: false,
      message: 'משתנה הסביבה MONGODB_URI אינו מוגדר בשרת.'
    });
  }

  try {
    await initializeDatabase();
    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'לא ניתן להתחבר למסד הנתונים (בדוק את MONGODB_URI והרשאות ה-IP ב-MongoDB Atlas).'
    });
  }
}

function getDb() {
  return mongoose.connection;
}

module.exports = {
  initializeDatabase,
  ensureDatabaseConnection,
  getDb
};

