const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'localwatch_production_jwt_secret_2026_super_secure_key';

// Required Authentication Middleware
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Verify user still exists in database
    const userRes = await db.query(
      'SELECT id, name, email, role, avatar, reputation_score FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'User account no longer exists. Please register or log in again.' });
    }

    req.user = userRes.rows[0];
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

// Optional Authentication Middleware (for public endpoints that can be enhanced with user context)
async function optionalToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userRes = await db.query(
      'SELECT id, name, email, role, avatar, reputation_score FROM users WHERE id = $1',
      [decoded.id]
    );
    req.user = userRes.rows[0] || null;
  } catch (err) {
    req.user = null;
  }

  next();
}

module.exports = {
  authenticateToken,
  optionalToken,
  JWT_SECRET,
};

