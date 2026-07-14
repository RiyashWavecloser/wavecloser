/**
 * server/auth.js
 *
 * Lightweight, zero-dependency authentication utility using native Node crypto.
 * Implements PBKDF2 password hashing and HMAC-SHA256 token signatures.
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const JWT_SECRET_FILE = '.jwt-secret';
function loadOrCreateJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (fs.existsSync(JWT_SECRET_FILE)) {
    return fs.readFileSync(JWT_SECRET_FILE, 'utf8').trim();
  }
  const secret = crypto.randomBytes(48).toString('hex');
  try {
    fs.writeFileSync(JWT_SECRET_FILE, secret, { mode: 0o600 });
    console.log('[auth] 🔑 Generated new JWT_SECRET and saved to .jwt-secret');
  } catch (err) {
    console.warn('[auth] Could not write .jwt-secret file:', err.message);
  }
  return secret;
}
process.env.JWT_SECRET = loadOrCreateJwtSecret();
const JWT_SECRET = process.env.JWT_SECRET;

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
  const [, salt, hash] = parts;
  const candidate = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
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
  
  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  
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

/**
 * Require specific roles middleware
 */
export function requireRole(...allowed) {
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        error: `This action requires one of: ${allowed.join(', ')}. Your role: ${req.user.role}`,
      });
    }
    next();
  };
}

/**
 * Role permissions map
 */
export const ROLE_PERMISSIONS = {
  admin:                ['all'],
  pm:                   ['all'],
  sponsor:              ['all'],
  cx:                   ['qualifier-portal', 'users', 'onboarding'],
  recruiter:            ['recruiter-portal', 'recruiting-pipeline', 'users', 'onboarding'],
  cold_caller:          ['agent-portal', 'own-leads-only'],
  independent_rep:      ['agent-portal', 'own-leads-only'],
  authorized_reseller:  ['agent-portal', 'own-leads-only'],
  iso_investor:         ['agent-portal', 'own-leads-only'],
  referral_partner:     ['agent-portal', 'own-leads-only'],
  agent_supervisor:     ['agent-portal', 'all-agents-leads'],
  marketer:             ['dashboard', 'users', 'leads'],
  trainer:              ['dashboard', 'users', 'leads'],
};

/**
 * Route to the correct portal based on role
 */
export function getPortalForRole(role) {
  const agentRoles = ['cold_caller', 'independent_rep', 'authorized_reseller', 'iso_investor', 'referral_partner'];
  if (agentRoles.includes(role))   return 'agent-portal';
  if (role === 'agent_supervisor') return 'agent-portal';
  if (role === 'cx')               return 'qualifier-portal';
  if (role === 'recruiter')        return 'recruiter-portal';
  return 'dashboard'; // admin, pm, sponsor, marketer, trainer
}

/**
 * Middleware: require any agent-type role (cold_caller, independent_rep, authorized_reseller, etc.).
 */
const AGENT_ROLES = ['cold_caller', 'independent_rep', 'authorized_reseller', 'iso_investor', 'referral_partner', 'agent_supervisor', 'agent'];

export function authenticateAgent(req, res, next) {
  requireAuth(req, res, () => requireRole(...AGENT_ROLES)(req, res, next));
}

/**
 * Middleware: require role = 'agent_supervisor'.
 */
export function authenticateSupervisor(req, res, next) {
  requireAuth(req, res, () => requireRole('agent_supervisor')(req, res, next));
}
