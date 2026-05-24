const mongoose = require('mongoose');

function initializeDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI;
  
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined in environment variables.');
    return; // Don't crash the serverless function, just log it.
  }

  // Prevent multiple connections in serverless environments
  if (mongoose.connection.readyState >= 1) {
    console.log('Already connected to MongoDB');
    return;
  }

  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('Connected to MongoDB Atlas');
    })
    .catch((err) => {
      console.error('Failed to connect to MongoDB Atlas', err);
    });
}

function getDb() {
  // getDb is largely obsolete with Mongoose as models are imported directly,
  // but we can return the mongoose connection if needed.
  return mongoose.connection;
}

module.exports = {
  initializeDatabase,
  getDb
};
