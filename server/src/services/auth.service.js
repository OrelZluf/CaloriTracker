const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const DEFAULT_GOOGLE_CLIENT_ID = '697650365176-c0iutn5qdjia4qvokbaja4pidfa7v20v.apps.googleusercontent.com';
const DEFAULT_JWT_SECRET = 'caloritrack-default-jwt-secret-change-in-production';

/**
 * Verify a Google ID token and return the user payload.
 * @param {string} idToken - Google ID token from the client
 * @returns {Promise<Object>} Google user profile info
 */
async function verifyGoogleToken(idToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
  const client = new OAuth2Client(clientId);

  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId
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
      id: user._id || user.id,
      email: user.email
    },
    process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
    { expiresIn: '30d' }
  );
}

/**
 * Find an existing user by Google ID, or create a new one.
 * @param {Object} googleProfile - Profile info from Google
 * @returns {Promise<Object>} The user record from the database
 */
async function findOrCreateUser(googleProfile) {
  let user = await User.findOne({ google_id: googleProfile.googleId });

  if (user) {
    user.name = googleProfile.name;
    user.avatar_url = googleProfile.avatarUrl;
    await user.save();
    return user;
  }

  user = await User.create({
    google_id: googleProfile.googleId,
    email: googleProfile.email,
    name: googleProfile.name,
    avatar_url: googleProfile.avatarUrl
  });

  return user;
}

module.exports = { verifyGoogleToken, generateJWT, findOrCreateUser };
