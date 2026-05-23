const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * JWT authentication middleware.
 * Extracts the Bearer token from the Authorization header,
 * verifies it, and attaches the user object to req.user.
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'נדרשת הזדהות. אנא התחבר מחדש.'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'טוקן לא תקין.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'המשתמש לא נמצא. אנא התחבר מחדש.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'פג תוקף ההזדהות. אנא התחבר מחדש.'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'טוקן לא תקין.'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'שגיאת שרת פנימית.'
    });
  }
}

module.exports = { requireAuth };
