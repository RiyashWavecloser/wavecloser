/**
 * server/auth.js
 *
 * Lightweight, zero-dependency authentication utility using native Node crypto.
 * Implements PBKDF2 password hashing and HMAC-SHA256 token signatures.
 */

import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// A secure persistent secret from env, fallback to auto-generated at startup
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('[auth] JWT_SECRET not configured. Sessions will expire if the server restarts.');
}

/**
 * Hash a password using PBKDF2
 * Returns string format: pbkdf2:salt:hash
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}

/**
 * Verify a password against a stored hash
 */
export function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'pbkdf2') return false;
  const salt = parts[1];
  const hash = parts[2];
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return verifyHash === hash;
}

/**
 * Sign a session token (valid for 24h by default)
 */
export function signToken(payload, expiresInMs = 24 * 60 * 60 * 1000) {
  const exp = Date.now() + expiresInMs;
  const body = JSON.stringify({ ...payload, exp });
  const base64Body = Buffer.from(body).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(base64Body).digest('base64url');
  return `${base64Body}.${signature}`;
}

/**
 * Verify a token and return its payload
 */
export function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [base64Body, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(base64Body).digest('base64url');
  if (signature !== expectedSig) return null;
  
  try {
    const bodyStr = Buffer.from(base64Body, 'base64url').toString('utf8');
    const payload = JSON.parse(bodyStr);
    if (payload.exp < Date.now()) return null; // expired
    return payload;
  } catch {
    return null;
  }
}

/**
 * Express middleware to authenticate API requests
 */
export function requireAuth(req, res, next) {
  // Support Authorization header: "Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(403).json({ error: 'Invalid or expired session token' });
  }

  req.user = payload;
  next();
}
