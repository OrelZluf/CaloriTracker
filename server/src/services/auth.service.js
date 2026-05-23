const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { getDb } = require('../config/database');

/**
 * Verify a Google ID token and return the user payload.
 * @param {string} idToken - Google ID token from the client
 * @returns {Promise<Object>} Google user profile info
 */
async function verifyGoogleToken(idToken) {
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID
  });

  const payload = ticket.getPayload();

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name,
    avatarUrl: payload.picture
  };
}

/**
 * Generate a JWT token for a user.
 * @param {Object} user - User object from the database
 * @returns {string} Signed JWT token
 */
function generateJWT(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email
    },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

/**
 * Find an existing user by Google ID, or create a new one.
 * @param {Object} googleProfile - Profile info from Google
 * @returns {Object} The user record from the database
 */
function findOrCreateUser(googleProfile) {
  const db = getDb();

  // Try to find existing user by google_id
  let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleProfile.googleId);

  if (user) {
    // Update name and avatar in case they changed
    db.prepare(`
      UPDATE users SET name = ?, avatar_url = ? WHERE id = ?
    `).run(googleProfile.name, googleProfile.avatarUrl, user.id);

    // Re-fetch to get updated values
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    return user;
  }

  // Create a new user
  const result = db.prepare(`
    INSERT INTO users (google_id, email, name, avatar_url)
    VALUES (?, ?, ?, ?)
  `).run(
    googleProfile.googleId,
    googleProfile.email,
    googleProfile.name,
    googleProfile.avatarUrl
  );

  user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  return user;
}

module.exports = { verifyGoogleToken, generateJWT, findOrCreateUser };
