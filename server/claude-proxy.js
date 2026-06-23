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
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto';
import { spawn } from 'child_process';
import {
  isConfigured as airtableReady,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  upsertUsers,
  listLog,
  appendLog,
  getStaff,
  updateStaffPassword,
  isStaffEmpty,
  getLeads,
  updateLeadStatus,
  getLeadStats,
  getLeadsByAgent,
  getQualificationQueue,
  assignLeadToPartner,
  createQualificationEntry,
  updateQualifierStatus,
  qualifyLead,
  getQualificationCompleted,
  getLeadById,
  checkAndRefillAgentLeads,
} from './airtableClient.js';
import { generateLeads } from './leadWorker.js';
import {
  isConfigured as emailReady,
  sendEmail,
  buildResetCodeEmail,
  buildQualifierLeadEmail,
  buildPartnerLeadEmail,
} from './emailService.js';
import { requireAuth, signToken, verifyPassword, hashPassword, requireRole } from './auth.js';

dotenv.config();

const PORT = process.env.PORT || 3001;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
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

if (!ANTHROPIC_KEY) console.warn('[proxy] ⚠  ANTHROPIC_API_KEY not set — Claude calls will fail.');
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

function checkLoginLimit(_ip) {
  return true;
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

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Wave Closers Backend Running'
  });
});


// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status:       'ok',
    time:         new Date().toISOString(),
    claude:       !!ANTHROPIC_KEY,
    airtable:     airtableReady(),
    email:        emailReady(),
    googlePlaces: !!process.env.GOOGLE_PLACES_API_KEY,
    yelp:         !!process.env.YELP_API_KEY,
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
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: req.body.max_tokens || 1000,
        system: req.body.system,
        messages: req.body.messages,
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
app.post('/api/users', requireRole('admin', 'sponsor', 'cx'), async (req, res) => {
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
app.patch('/api/users/:id', requireRole('admin', 'sponsor', 'cx', 'recruiter'), async (req, res) => {
  const { id } = req.params;
  const patch = req.body;
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

// ─── Leads (Module 6) ─────────────────────────────────────────────────────

app.get('/api/leads', async (req, res) => {
  if (!airtableReady()) {
    return res.json({ demo: true, leads: [] });
  }
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.type)   filters.type   = req.query.type;
    if (req.query.market) filters.market = req.query.market;
    if (req.query.agent)  filters.agent  = req.query.agent;
    const leads = await getLeads(filters);
    res.json({ demo: false, leads });
  } catch (err) {
    console.error('[proxy] GET /api/leads:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leads/generate', async (req, res) => {
  const { location, businessTypes, radius } = req.body || {};
  if (!location || !businessTypes?.length) {
    return res.status(400).json({ error: 'location and businessTypes[] are required' });
  }
  try {
    console.log(`[proxy] POST /api/leads/generate → ${location} (${businessTypes.join(', ')})`);
    const result = await generateLeads({ location, businessTypes, radius: radius || 5 });
    res.json(result);
  } catch (err) {
    console.error('[proxy] POST /api/leads/generate:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leads/assign', async (req, res) => {
  const { leadIds, agent } = req.body || {};
  if (!leadIds?.length || !agent) {
    return res.status(400).json({ error: 'leadIds[] and agent are required' });
  }
  if (!airtableReady()) {
    return res.json({ demo: true, assigned: leadIds.length });
  }
  try {
    let assigned = 0;
    for (const placeId of leadIds) {
      await updateLeadStatus(placeId, { status: 'Assigned', assignedAgent: agent });
      assigned++;
    }
    res.json({ demo: false, assigned });
  } catch (err) {
    console.error('[proxy] POST /api/leads/assign:', err.message);
    res.status(500).json({ error: err.message });
  }
});

async function handleLeadPatch(req, res) {
  const { id } = req.params;
  const patch = req.body;
  const status = patch.status;
  const agentNotes = patch.agentNotes || '';
  const agentName = req.user?.name || patch.agentName || '';

  if (!airtableReady()) {
    return res.json({ demo: true });
  }

  // Strip fields that don't exist in the Leads Airtable table.
  // Only these fields exist: Status, AssignedAgent, CalledAt, Outcome,
  // Address, Type, Phone, Website, Rating, ReviewCount, Score, ScoreReason,
  // BusinessName, PlaceID, Market, CreatedAt
  const LEADS_SAFE_FIELDS = new Set([
    'status', 'assignedAgent', 'calledAt', 'outcome',
    'address', 'type', 'phone', 'website', 'rating', 'reviewCount',
    'score', 'scoreReason', 'businessName', 'placeId', 'market', 'createdAt',
  ]);
  const leadSafePatch = {};
  for (const [key, val] of Object.entries(patch)) {
    if (LEADS_SAFE_FIELDS.has(key)) leadSafePatch[key] = val;
  }

  try {
    let qualifierNotified = false;
    let finalLead = null;

    if (status === 'Interested' || patch.outcome === 'Interested') {
      // 1. Update Leads table status to Interested (valid single-select option)
      const lead = await updateLeadStatus(id, {
        ...leadSafePatch,
        status: 'Interested',
        outcome: 'Interested'
      });
      finalLead = lead;

      // 2. Fetch full lead record from Leads table
      const fullLead = await getLeadById(id);

      if (fullLead) {
        finalLead = fullLead;
        // 3. Create entry in LeadQualificationQueue
        await createQualificationEntry({
          leadPlaceId:  fullLead.placeId,
          businessName: fullLead.businessName,
          businessType: fullLead.type,
          address:      fullLead.address,
          phone:        fullLead.phone,
          website:      fullLead.website,
          score:        fullLead.score,
          scoreReason:  fullLead.scoreReason,
          agentName:    agentName || fullLead.assignedAgent || '',
          agentNotes:   agentNotes || fullLead.agentNotes || '',
        });

        // 4. Send email to QUALIFIER_EMAIL
        const emailData = buildQualifierLeadEmail(fullLead);
        await sendEmail(emailData).catch(err => console.error('[proxy] Qualifier email error:', err.message));

        // 5. Log to AutomationLog
        await appendLog({
          task: 'Qualifier notified — interested lead',
          target: `${fullLead.businessName} (${fullLead.type}) — called by ${agentName || fullLead.assignedAgent}`,
          status: 'sent',
        }).catch(() => {});
      }

      qualifierNotified = true;
      console.log(`[proxy] ✅ ${fullLead ? fullLead.businessName : id} → Interested → Qualifier notified`);
    } else {
      finalLead = await updateLeadStatus(id, leadSafePatch);
    }

    // Auto-refill agent leads check (weekly batch model)
    const effectiveAgent = agentName || finalLead?.assignedAgent || '';
    if (effectiveAgent) {
      checkAndRefillAgentLeads(effectiveAgent).catch(err => {
        console.error(`[refill] Auto-refill check failed for ${effectiveAgent}:`, err.message);
      });
    }

    res.json({ demo: false, lead: finalLead, qualifierNotified });
  } catch (err) {
    console.error(`[proxy] PATCH /api/leads/${id} error:`, err.message);
    res.status(500).json({ error: err.message });
  }
}

app.patch('/api/leads/:id', handleLeadPatch);
app.patch('/api/leads/:id/status', handleLeadPatch);

app.get('/api/leads/stats', async (_req, res) => {
  if (!airtableReady()) {
    return res.json({ demo: true, stats: { daily: [], total: 0 } });
  }
  try {
    const stats = await getLeadStats();
    res.json({ demo: false, stats });
  } catch (err) {
    console.error('[proxy] GET /api/leads/stats:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Agent Portal: My Leads ──────────────────────────────────────────────────

app.get('/api/leads/my-leads', requireAuth, async (req, res) => {
  const agentName = req.user.name;
  if (!airtableReady()) {
    return res.json({ demo: true, leads: [] });
  }
  try {
    const leads = await getLeadsByAgent(agentName);
    res.json({ demo: false, leads });
  } catch (err) {
    console.error(`[proxy] GET /api/leads/my-leads (${agentName}):`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Qualifier's Queue ──────────────────────────────────────────────────────

async function handleGetQualifierQueue(req, res) {
  if (!airtableReady()) {
    return res.json({ demo: true, leads: [] });
  }
  try {
    const { status } = req.query;
    const leads = await getQualificationQueue(status);
    res.json({ demo: false, leads });
  } catch (err) {
    console.error('[proxy] GET qualifier queue error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

app.get('/api/qualifier/queue', requireAuth, handleGetQualifierQueue);
app.get('/api/leads/qualifier-queue', requireAuth, handleGetQualifierQueue);

async function handleUpdateQualifierStatus(req, res) {
  const { id } = req.params;
  const { qualifierStatus, qualifierNotes } = req.body || {};
  if (!airtableReady()) {
    return res.json({ demo: true });
  }
  try {
    const lead = await updateQualifierStatus(id, qualifierStatus, qualifierNotes);
    res.json({ demo: false, lead });
  } catch (err) {
    console.error(`[proxy] update qualifier status ${id} error:`, err.message);
    res.status(500).json({ error: err.message });
  }
}

app.patch('/api/qualifier/queue/:id', requireAuth, handleUpdateQualifierStatus);
app.patch('/api/leads/:id/qualifier-status', requireAuth, handleUpdateQualifierStatus);

app.get('/api/qualifier/completed', requireAuth, async (req, res) => {
  if (!airtableReady()) {
    return res.json({ demo: true, entries: [] });
  }
  try {
    const entries = await getQualificationCompleted();
    res.json({ demo: false, entries });
  } catch (err) {
    console.error('[proxy] GET /api/qualifier/completed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

async function handleQualifyLead(req, res) {
  const { id } = req.params;
  const { userType, notes } = req.body || {};
  if (!userType) {
    return res.status(400).json({ error: 'userType is required (REFERRAL, REP, RESELLER, or ISO)' });
  }
  if (!airtableReady()) {
    return res.json({ demo: true });
  }
  try {
    const result = await qualifyLead(id, userType, notes);
    res.json({ demo: false, ...result });
  } catch (err) {
    console.error(`[proxy] qualify lead ${id} error:`, err.message);
    res.status(500).json({ error: err.message });
  }
}

app.post('/api/qualifier/queue/:id/qualify', requireAuth, handleQualifyLead);
app.post('/api/leads/:id/qualify', requireAuth, handleQualifyLead);

// ─── Partner Assignment ──────────────────────────────────────────────────────

app.post('/api/leads/:id/assign-partner', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { partnerWCId } = req.body || {};
  if (!partnerWCId) {
    return res.status(400).json({ error: 'partnerWCId is required' });
  }
  if (!airtableReady()) {
    return res.json({ demo: true });
  }
  try {
    const { lead, partner } = await assignLeadToPartner(id, partnerWCId);
    // Send partner notification email
    if (partner) {
      const emailData = buildPartnerLeadEmail(lead, partner);
      await sendEmail(emailData).catch(err => console.error('[proxy] Partner email error:', err.message));
    }
    console.log(`[proxy] ✅ ${lead.businessName} → Assigned to partner ${partnerWCId}`);
    await appendLog({
      task: 'Lead assigned to partner',
      target: `${lead.businessName} → ${partner?.name || partnerWCId}`,
      status: 'ok',
    }).catch(() => {});
    res.json({ demo: false, lead, partner });
  } catch (err) {
    console.error(`[proxy] POST /api/leads/${id}/assign-partner:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n[Wave Closers Proxy] ✓ Running on http://localhost:${PORT}`);
  console.log(`  Claude:   ${ANTHROPIC_KEY ? '✓ ready' : '✗ no key'}`);
  console.log(`  Airtable: ${airtableReady() ? '✓ connected' : '✗ not configured'}`);
  console.log(`  Email:    ${emailReady() ? '✓ Resend ready' : '✗ demo mode (console)'}`);
  console.log();

  // Spawns the automation worker process alongside the Express server in cloud deployments
  if (process.env.START_WORKER === 'true') {
    console.log('[proxy] ⚙️ Spawning automation worker in background...');
    const worker = spawn('node', ['server/automationWorker.js'], { stdio: 'inherit' });
    worker.on('close', (code) => {
      console.log(`[proxy] ⚙️ Automation worker exited with code ${code}`);
    });
  }
});

// ─── Helpers (used by emailService import check) ──────────────────────────────
function isConfigured() { return !!ANTHROPIC_KEY; }
export { isConfigured };
