const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

function initializeDatabase() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }

  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('Connected to MongoDB Atlas');
    })
    .catch((err) => {
      console.error('Failed to connect to MongoDB Atlas', err);
      process.exit(1);
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
