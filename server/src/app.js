const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./config/database');

const app = express();

// ---------------------
// Middleware
// ---------------------

// CORS configuration
const allowedOrigins = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
];
// Allow Render deployment URL if set
if (process.env.RENDER_EXTERNAL_URL) {
  allowedOrigins.push(process.env.RENDER_EXTERNAL_URL);
}

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images as static files
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(path.resolve(uploadDir)));

// ---------------------
// Routes
// ---------------------

const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const mealsRoutes = require('./routes/meals.routes');
const activityRoutes = require('./routes/activity.routes');

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/meals', mealsRoutes);
app.use('/api/activities', activityRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'CaloriTrack API is running',
    timestamp: new Date().toISOString()
  });
});

// ---------------------
// Error Handling
// ---------------------

// Handle multer errors
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'הקובץ גדול מדי. הגודל המקסימלי הוא 10MB.'
    });
  }

  if (err.message && err.message.includes('סוג קובץ לא נתמך')) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  next(err);
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'שגיאת שרת פנימית. אנא נסה שוב מאוחר יותר.'
  });
});

// Serve Angular frontend in production
const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist', 'client', 'browser');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  // SPA fallback - serve index.html for non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  // Handle 404 (dev mode – no built frontend)
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: 'הנתיב המבוקש לא נמצא.'
    });
  });
}

// ---------------------
// Start Server
// ---------------------

const PORT = process.env.PORT || 3000;

// Initialize database then start listening
try {
  initializeDatabase();
  app.listen(PORT, () => {
    console.log(`CaloriTrack server running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
  });
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}

module.exports = app;
