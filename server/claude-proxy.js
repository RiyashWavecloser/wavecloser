/**
 * server/claude-proxy.js
 *
 * Express server on port 3001.
 *
 * Endpoints:
 *   POST /api/claude   — Anthropic API proxy (key stays server-side)
 *   GET  /api/users    — List users from Airtable (or demo mode)
 *   GET  /api/log      — Last 20 automation log entries
 *   POST /api/import   — Upsert array of users into Airtable
 *   GET  /health       — Service health check
 *
 * Security: ANTHROPIC_API_KEY, AIRTABLE_API_KEY, RESEND_API_KEY
 *           NEVER reach the browser.
 */

import express from 'express';
import cors    from 'cors';
import dotenv  from 'dotenv';
import fs      from 'fs';
import crypto  from 'crypto';
import {
  isConfigured as airtableReady,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  upsertUsers,
  listLog,
  getStaff,
  updateStaffPassword,
  isStaffEmpty,
} from './airtableClient.js';
import { isConfigured as emailReady, sendEmail, buildResetCodeEmail } from './emailService.js';
import { requireAuth, signToken, verifyPassword, hashPassword, requireRole } from './auth.js';

dotenv.config();

const PORT           = process.env.PORT           || 3001;
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4173')
  .split(',').map(s => s.trim());

const JWT_SECRET_FILE = '.jwt-secret';
function loadOrCreateJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (fs.existsSync(JWT_SECRET_FILE)) {
    return fs.readFileSync(JWT_SECRET_FILE, 'utf8').trim();
  }
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(JWT_SECRET_FILE, secret, { mode: 0o600 });
  console.log('[proxy] 🔑 Generated new JWT_SECRET and saved to .jwt-secret');
  return secret;
}
process.env.JWT_SECRET = loadOrCreateJwtSecret();

// ─── Startup checks ───────────────────────────────────────────────────────────

if (!ANTHROPIC_KEY)  console.warn('[proxy] ⚠  ANTHROPIC_API_KEY not set — Claude calls will fail.');
if (!airtableReady()) {
  console.error('╔══════════════════════════════════════════════════════════════╗');
  console.error('║  ⚠  AIRTABLE NOT CONFIGURED — ALL DATA IS DEMO/SEED ONLY  ║');
  console.error('║  Set AIRTABLE_API_KEY and AIRTABLE_BASE_ID in .env         ║');
  console.error('╚══════════════════════════════════════════════════════════════╝');
} else {
  console.log('[proxy] ✓ Airtable configured — live data mode active');
}

// ─── Express setup ────────────────────────────────────────────────────────────

const app = express();

// Enable trust proxy for correct IP detection behind Railway/Vercel
app.set('trust proxy', 1);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '2mb' }));

// ─── Authentication ───────────────────────────────────────────────────────────

const loginAttempts = new Map();
function checkLoginLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || record.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60_000 });
    return true;
  }
  record.count += 1;
  return record.count <= 5;
}

app.post('/api/auth/login', async (req, res) => {
  const ip = req.ip || 'unknown';
  if (!checkLoginLimit(ip)) {
    return res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' });
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const cleanEmail = email.toLowerCase().trim();

  if (!airtableReady()) {
    return res.status(503).json({ error: 'Airtable not configured. Run npm run seed:staff first.' });
  }

  try {
    const isEmpty = await isStaffEmpty();
    if (isEmpty) {
      return res.status(503).json({ error: 'Staff table is empty. Run npm run seed:staff first.' });
    }

    const operator = await getStaff(cleanEmail);
    if (!operator || !verifyPassword(password, operator.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken({
      email: operator.email,
      name: operator.name,
      role: operator.role,
    });

    console.log(`[auth] Operator logged in: ${operator.name} (${operator.role})`);

    res.json({
      token,
      user: {
        email: operator.email,
        name: operator.name,
        role: operator.role,
      },
      mustChangePassword: operator.mustChangePassword,
    });
  } catch (err) {
    console.error('[auth] Login error:', err.message);
    res.status(503).json({ error: 'Database service unavailable. Run npm run seed:staff first.' });
  }
});

// Password strength validator
function validatePasswordStrength(password) {
  if (typeof password !== 'string') return 'Password is required';
  if (password.length < 10) return 'Password must be at least 10 characters';
  if (!/[A-Za-z]/.test(password)) return 'Password must contain a letter';
  if (!/[0-9]/.test(password)) return 'Password must contain a number';
  const banned = ['password', 'changeme', '1234567890', 'qwerty123', 'letmein123'];
  if (banned.some(b => password.toLowerCase().includes(b))) {
    return 'Password is too common — pick something less obvious';
  }
  return null;
}

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) return res.status(400).json({ error: strengthError });
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'New password must be different from the current one' });
  }
  if (!airtableReady()) {
    return res.status(503).json({ error: 'Airtable not configured' });
  }
  const email = req.user.email;
  try {
    const operator = await getStaff(email);
    if (!operator || !verifyPassword(currentPassword, operator.passwordHash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const newHash = hashPassword(newPassword);
    await updateStaffPassword(email, newHash);
    console.log(`[auth] 🔑 ${operator.name} (${operator.role}) changed their password`);
    res.json({ ok: true, mustChangePassword: false });
  } catch (err) {
    console.error('[auth] Change password error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const resetCodes = new Map();

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  const cleanEmail = email.toLowerCase().trim();

  if (!airtableReady()) {
    return res.status(503).json({ error: 'Airtable not configured' });
  }

  try {
    const operator = await getStaff(cleanEmail);
    if (!operator) {
      // Return 200 even if operator doesn't exist for security (prevent email enumeration)
      // but only generate/send code if they exist
      return res.json({ ok: true, message: 'If this email exists in our system, a reset code has been sent.' });
    }

    // Generate 6 digit numeric code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

    resetCodes.set(cleanEmail, { code, expiresAt });

    const emailTemplate = buildResetCodeEmail(cleanEmail, code);
    await sendEmail({
      to: emailTemplate.to,
      subject: emailTemplate.subject,
      text: emailTemplate.text
    });

    console.log(`[auth] 🔑 Password reset code sent to ${cleanEmail}: ${code}`);
    res.json({ ok: true, message: 'If this email exists in our system, a reset code has been sent.' });
  } catch (err) {
    console.error('[auth] Forgot password error:', err.message);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body || {};
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'email, code, and newPassword are required' });
  }
  const cleanEmail = email.toLowerCase().trim();
  const cleanCode = code.trim();

  const record = resetCodes.get(cleanEmail);
  if (!record) {
    return res.status(400).json({ error: 'Invalid or expired reset code' });
  }

  if (record.code !== cleanCode || record.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'Invalid or expired reset code' });
  }

  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) return res.status(400).json({ error: strengthError });

  if (!airtableReady()) {
    return res.status(503).json({ error: 'Airtable not configured' });
  }

  try {
    const operator = await getStaff(cleanEmail);
    if (!operator) {
      return res.status(400).json({ error: 'Operator account not found' });
    }

    const newHash = hashPassword(newPassword);
    await updateStaffPassword(cleanEmail, newHash);
    resetCodes.delete(cleanEmail);

    console.log(`[auth] 🔑 Password reset successful for ${operator.name} (${operator.role}) via code`);
    res.json({ ok: true, message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('[auth] Reset password error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Secure all subsequent /api/ routes
app.use('/api', requireAuth);


// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    time:      new Date().toISOString(),
    claude:    !!ANTHROPIC_KEY,
    airtable:  airtableReady(),
    email:     emailReady(),
  });
});

// ─── Claude proxy ─────────────────────────────────────────────────────────────

app.post('/api/claude', async (req, res) => {
  if (!ANTHROPIC_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured.' });
  }
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: req.body.max_tokens || 1000,
        system:     req.body.system,
        messages:   req.body.messages,
      }),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error('[proxy] /api/claude error:', err.message);
    res.status(500).json({ error: 'Proxy error', detail: String(err.message) });
  }
});

// ─── Users ────────────────────────────────────────────────────────────────────

app.get('/api/users', async (_req, res) => {
  if (!airtableReady()) {
    console.warn('[proxy] GET /api/users → DEMO mode (Airtable not configured)');
    return res.json({ demo: true, users: [] });
  }
  try {
    const users = await listUsers();
    console.log(`[proxy] GET /api/users → ${users.length} records from Airtable ✓`);
    res.json({ demo: false, users });
  } catch (err) {
    console.error('[proxy] GET /api/users FAILED:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Create a single user
app.post('/api/users', requireRole('admin', 'sponsor', 'appointment_setter'), async (req, res) => {
  const user = req.body;
  if (!user?.name) return res.status(400).json({ error: 'name is required' });
  if (!airtableReady()) {
    console.warn('[proxy] POST /api/users → DEMO mode (not saved to Airtable)');
    return res.json({ demo: true, user });
  }
  try {
    const created = await createUser(user);
    console.log('[proxy] Created user:', created.id, created.name);
    res.json({ demo: false, user: created });
  } catch (err) {
    console.error('[proxy] POST /api/users:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update a single user (stage, notes, leads, etc.)
app.patch('/api/users/:id', requireRole('admin', 'sponsor', 'appointment_setter', 'recruiter'), async (req, res) => {
  const { id } = req.params;
  const patch   = req.body;
  if (!airtableReady()) {
    console.warn(`[proxy] PATCH /api/users/${id} → DEMO mode (not saved to Airtable)`);
    return res.json({ demo: true });
  }
  try {
    const updated = await updateUser(id, patch);
    console.log('[proxy] Updated user:', id, Object.keys(patch).join(', '));
    res.json({ demo: false, user: updated });
  } catch (err) {
    console.error('[proxy] PATCH /api/users/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete a user
app.delete('/api/users/:id', requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  if (!airtableReady()) {
    console.warn(`[proxy] DELETE /api/users/${id} → DEMO mode (not deleted from Airtable)`);
    return res.json({ demo: true, deleted: id });
  }
  try {
    await deleteUser(id);
    console.log('[proxy] Deleted user:', id);
    res.json({ demo: false, deleted: id });
  } catch (err) {
    console.error('[proxy] DELETE /api/users/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Automation log ───────────────────────────────────────────────────────────

app.get('/api/log', requireRole('admin', 'sponsor'), async (_req, res) => {
  if (!airtableReady()) {
    return res.json({ demo: true, log: [] });
  }
  try {
    const log = await listLog(20);
    res.json({ demo: false, log });
  } catch (err) {
    console.error('[proxy] GET /api/log:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Import (CSV push to Airtable) ───────────────────────────────────────────

app.post('/api/import', requireRole('admin'), async (req, res) => {
  const users = req.body?.users;
  if (!Array.isArray(users) || !users.length) {
    return res.status(400).json({ error: 'Request body must be { users: [] }' });
  }
  if (!airtableReady()) {
    return res.json({ demo: true, imported: users.length, failed: 0 });
  }
  try {
    const result = await upsertUsers(users);
    res.json({ demo: false, ...result });
  } catch (err) {
    console.error('[proxy] POST /api/import:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n[Wave Closers Proxy] ✓ Running on http://localhost:${PORT}`);
  console.log(`  Claude:   ${ANTHROPIC_KEY    ? '✓ ready'          : '✗ no key'}`);
  console.log(`  Airtable: ${airtableReady()  ? '✓ connected'      : '✗ not configured'}`);
  console.log(`  Email:    ${emailReady()      ? '✓ Resend ready'   : '✗ demo mode (console)'}`);
  console.log();
});

// ─── Helpers (used by emailService import check) ──────────────────────────────
function isConfigured() { return !!ANTHROPIC_KEY; }
export { isConfigured };
