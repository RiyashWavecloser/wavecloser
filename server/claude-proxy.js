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
import {
  isConfigured as airtableReady,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  upsertUsers,
  listLog,
  getStaff,
} from './airtableClient.js';
import { isConfigured as emailReady } from './emailService.js';
import { requireAuth, signToken, verifyPassword } from './auth.js';

dotenv.config();

const PORT           = process.env.PORT           || 3001;
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4173')
  .split(',').map(s => s.trim());

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

// Default fallback staff operators if Airtable has no credentials or table is missing
const FALLBACK_OPERATORS = {
  'riyash@waveclosers.com': {
    name: 'Riyash',
    role: 'Project Manager',
    passwordHash: 'pbkdf2:7acc61b95f0db4c4ebe26640dd02594e:4019fefc87a0c5b9aec5be24af35d50ce5793d4841c51e2f7c6e5572cf27ae45b4e0f1e8c022482624213958f306d9fa92c3e64328b4d3c3e882563ba456ba86' // hash of 'password'
  },
  'william@waveclosers.com': {
    name: 'William',
    role: 'Executive Sponsor',
    passwordHash: 'pbkdf2:32c66d21798369527ec50c7ca56adbe8:f86abf2be87cc5cb4cc913fa3be2efda16ff945b6369c0d7ad24bb59e51cb2a014902cae389d4fb97a14f52f36bc49e0c5d64811cf66ff8f8ca68c8577bb6ee3' // hash of 'password'
  },
  'mildred@waveclosers.com': {
    name: 'Mildred',
    role: 'Appointment Setter',
    passwordHash: 'pbkdf2:32c66d21798369527ec50c7ca56adbe8:f86abf2be87cc5cb4cc913fa3be2efda16ff945b6369c0d7ad24bb59e51cb2a014902cae389d4fb97a14f52f36bc49e0c5d64811cf66ff8f8ca68c8577bb6ee3' // hash of 'password'
  }
};

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const cleanEmail = email.toLowerCase().trim();
  let operator = null;

  if (airtableReady()) {
    try {
      operator = await getStaff(cleanEmail);
    } catch (err) {
      console.warn(`[auth] Airtable Staff lookup failed (may not exist yet): ${err.message}. Using fallback.`);
    }
  }

  if (!operator) {
    operator = FALLBACK_OPERATORS[cleanEmail];
  }

  if (!operator || !verifyPassword(password, operator.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken({
    email: operator.email || cleanEmail,
    name: operator.name,
    role: operator.role,
  });

  console.log(`[auth] Operator logged in: ${operator.name} (${operator.role})`);

  res.json({
    token,
    user: {
      email: operator.email || cleanEmail,
      name: operator.name,
      role: operator.role,
    }
  });
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
app.post('/api/users', async (req, res) => {
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
app.patch('/api/users/:id', async (req, res) => {
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
app.delete('/api/users/:id', async (req, res) => {
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

app.get('/api/log', async (_req, res) => {
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

app.post('/api/import', async (req, res) => {
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
