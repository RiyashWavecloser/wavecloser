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
  getAllAgentLeads,
  getQualificationQueue,
  assignLeadToPartner,
  createQualificationEntry,
  updateQualifierStatus,
  qualifyLead,
  getQualificationCompleted,
  getLeadById,
  checkAndRefillAgentLeads,
  getRecruitingPipeline,
  addRecruit,
  updateRecruitStatus,
  updateRecruit,
  deleteRecruit,
  getRecruitById,
} from './airtableClient.js';
import { generateLeads } from './leadWorker.js';
import {
  isConfigured as emailReady,
  sendEmail,
  buildResetCodeEmail,
  buildQualifierLeadEmail,
  buildPartnerLeadEmail,
} from './emailService.js';
import { requireAuth, signToken, verifyPassword, hashPassword, requireRole, authenticateAgent, authenticateSupervisor } from './auth.js';
import { AGENTS } from './constants.js';

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
  const { location, businessTypes, radius, maxLeads } = req.body || {};
  if (!location || !businessTypes?.length) {
    return res.status(400).json({ error: 'location and businessTypes[] are required' });
  }
  const cappedMax = Math.min(500, Math.max(1, parseInt(maxLeads) || 50));
  try {
    console.log(`[proxy] POST /api/leads/generate → ${location} (${businessTypes.join(', ')}) (requested maxLeads: ${cappedMax})`);
    const result = await generateLeads({
      location,
      businessTypes,
      radius: radius || 5,
      maxLeads: cappedMax
    });
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
  // BusinessName, PlaceID, Market, CreatedAt, GeneratedBy
  const LEADS_SAFE_FIELDS = new Set([
    'status', 'assignedAgent', 'calledAt', 'outcome',
    'address', 'type', 'phone', 'website', 'rating', 'reviewCount',
    'score', 'scoreReason', 'businessName', 'placeId', 'market', 'createdAt', 'generatedBy',
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

// ─── Agent Self-Service Lead Generation ──────────────────────────────────────

/**
 * POST /api/leads/generate-self
 * Agent generates their own leads — auto-assigned to themselves.
 * Requires: role = 'agent'
 */
app.post('/api/leads/generate-self', authenticateAgent, async (req, res) => {
  const { location, businessTypes, radius, maxLeads } = req.body || {};
  if (!location || !businessTypes?.length) {
    return res.status(400).json({ error: 'location and businessTypes[] are required' });
  }
  // Server-side cap — never trust the client blindly
  const cappedMax = Math.min(500, Math.max(1, parseInt(maxLeads) || 50));
  const agentEmail = req.user.email;
  const agentName  = AGENTS.find(a => a.email === agentEmail)?.name || req.user.name || agentEmail;

  try {
    console.log(`[proxy] POST /api/leads/generate-self → ${agentName} requesting ${cappedMax} leads in ${location}`);
    const result = await generateLeads({
      location,
      businessTypes,
      radius:           radius || 5,
      requestedByAgent: agentName,
      maxLeads:         cappedMax,
    });
    await appendLog({
      task:   'Agent self-generated leads',
      target: `${agentName} → ${result.leads.length} new leads in ${location} (requested ${cappedMax}, ${result.stats?.duplicatesFiltered || 0} dupes filtered)`,
      status: 'sent',
    }).catch(() => {});
    res.json({ ...result, agentName });
  } catch (err) {
    console.error('[proxy] POST /api/leads/generate-self:', err.message);
    res.status(500).json({ error: err.message, demo: true });
  }
});

// ─── Supervisor: All Agents' Leads ───────────────────────────────────────────

/**
 * GET /api/leads/all-agents
 * Supervisor sees all agents' leads with optional ?agent= filter.
 * Requires: role = 'agent_supervisor'
 */
app.get('/api/leads/all-agents', authenticateSupervisor, async (req, res) => {
  if (!airtableReady()) {
    return res.json({ demo: true, leads: [] });
  }
  try {
    const agentFilter = req.query.agent || null;
    let leads;
    if (agentFilter) {
      leads = await getLeadsByAgent(agentFilter);
    } else {
      leads = await getAllAgentLeads();
    }
    res.json({ demo: false, leads });
  } catch (err) {
    console.error('[proxy] GET /api/leads/all-agents:', err.message);
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

// ─── Recruiting Pipeline (Workflow B) ─────────────────────────────────────────

// All recruiting endpoints require admin, pm, or recruiter role
const requireRecruiterAccess = (req, res, next) =>
  requireAuth(req, res, () => requireRole('admin', 'pm', 'recruiter')(req, res, next));

// GET /api/recruiting — list all recruits (recruiter sees own; admin/pm see all)
app.get('/api/recruiting', requireRecruiterAccess, async (req, res) => {
  try {
    const { role, name } = req.user;
    const recruiterName = role === 'recruiter' ? name : null; // admin/pm see all
    const recruits = await getRecruitingPipeline(recruiterName);
    res.json(recruits);
  } catch (err) {
    console.error('[proxy] GET /api/recruiting:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recruiting — add a new recruit
app.post('/api/recruiting', requireRecruiterAccess, async (req, res) => {
  try {
    const data = { ...req.body, addedBy: req.user.name };
    const recruit = await addRecruit(data);
    if (!recruit) return res.status(500).json({ error: 'Failed to add recruit to Airtable' });
    if (recruit.duplicate) {
      // Email already in pipeline — return 409 so UI shows a clear warning
      return res.status(409).json({
        error: `This email is already in the recruiting pipeline (status: ${recruit.status}).`,
        recruit,
      });
    }
    res.json(recruit);
  } catch (err) {
    console.error('[proxy] POST /api/recruiting:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/recruiting/:id — update recruit status/notes
app.patch('/api/recruiting/:id', requireRecruiterAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const recruit = await updateRecruitStatus(id, status, notes);
    if (!recruit) return res.status(500).json({ error: 'Failed to update recruit' });
    res.json(recruit);
  } catch (err) {
    console.error('[proxy] PATCH /api/recruiting/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/recruiting/:id — edit recruit fields (name, email, phone, source, type, notes)
app.put('/api/recruiting/:id', requireRecruiterAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, source, type, notes } = req.body;
    const recruit = await updateRecruit(id, { name, email, phone, source, type, notes });
    if (!recruit) return res.status(500).json({ error: 'Failed to update recruit' });
    res.json({ updated: true, recruit });
  } catch (err) {
    console.error('[proxy] PUT /api/recruiting/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/recruiting/:id — remove a recruit from the pipeline
app.delete('/api/recruiting/:id', requireRecruiterAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteRecruit(id);
    if (!result) return res.status(500).json({ error: 'Failed to delete recruit' });
    res.json({ deleted: true, id });
  } catch (err) {
    console.error('[proxy] DELETE /api/recruiting/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/recruiting/craigslist-search
// IMPORTANT: Must be BEFORE /api/recruiting/:id or Express will treat 'craigslist-search' as an ID
app.get('/api/recruiting/craigslist-search', requireRecruiterAccess, async (req, res) => {
  try {
    const city     = (req.query.city     || 'newyork').trim().toLowerCase().replace(/\s+/g, '');
    const keywords = (req.query.keywords || 'sales commission cold calling').trim();
    const limit    = Math.min(Number(req.query.limit) || 50, 100);
    const results  = await searchCraigslistResumes(city, keywords, limit);
    res.json({ results, city, keywords, demo: false });
  } catch (err) {
    console.error('[proxy] GET /api/recruiting/craigslist-search:', err.message);
    res.status(500).json({ error: err.message, results: [] });
  }
});

// GET /api/recruiting/:id — get a single recruit by ID
app.get('/api/recruiting/:id', requireRecruiterAccess, async (req, res) => {
  try {
    const recruit = await getRecruitById(req.params.id);
    if (!recruit) return res.status(404).json({ error: 'Recruit not found' });
    res.json(recruit);
  } catch (err) {
    console.error('[proxy] GET /api/recruiting/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Craigslist Resume Search ─────────────────────────────────────────────────

/**
 * Map our city slugs to the Craigslist subdomain used in the URL.
 */
const CITY_SUBDOMAINS = {
  newyork:      'newyork',
  newjersey:    'newjersey',
  newhaven:     'newhaven',
  brooklyn:     'brooklyn',
  queens:       'queens',
  bronx:        'bronx',
  statenisland: 'statenisland',
  newark:       'newark',
  jerseycity:   'jerseycity',
  bridgeport:   'bridgeport',
  hartford:     'hartford',
  stamford:     'stamford',
};

/**
 * Search Craigslist resumes via Apify (preferred) or direct RSS (fallback).
 * Apify gives more reliable results and bypasses Craigslist's bot-blocking.
 */
async function searchCraigslistResumes(city, keywords, limit = 50) {
  const citySlug = CITY_SUBDOMAINS[city] || city;
  const searchUrl = `https://${citySlug}.craigslist.org/search/res?query=${encodeURIComponent(keywords)}`;

  // -- Apify integration (when API key is configured) -------------------------
  if (process.env.APIFY_API_KEY) {
    try {
      console.log(`[Craigslist] Using Apify — city: ${citySlug}, keywords: ${keywords}`);

      const apifyRes = await fetch(
        'https://api.apify.com/v2/acts/solidcode~craigslist-scraper/run-sync-get-dataset-items?timeout=60&memory=512',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.APIFY_API_KEY}`,
          },
          body: JSON.stringify({
            startUrls: [{ url: searchUrl }],
            maxItems: limit,
          }),
        }
      );

      if (apifyRes.ok) {
        const data = await apifyRes.json();
        const raw = Array.isArray(data) ? data : [];
        const items = raw
          .filter(r => r && r.title)
          .slice(0, limit)
          .map(r => {
            const desc = r.description || r.postingBody || '';
            const phoneFromDesc = desc.match(/\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/)?.[0] || '';
            const phone = r.phone || (r.phoneNumbers && r.phoneNumbers[0]) || phoneFromDesc;
            return {
              title:       r.title                              || '',
              description: desc.slice(0, 500),
              phone:       phone                                || '',
              date:        r.postedAt || r.updatedAt || r.time || r.date || '',
              link:        r.url  || r.link                    || '',
            };
          });

        console.log(`[Craigslist] Apify returned ${items.length} results`);
        if (items.length > 0) return items;
        console.warn('[Craigslist] Apify returned 0 results, falling back to RSS');
      } else {
        const errText = await apifyRes.text().catch(() => apifyRes.statusText);
        console.warn(`[Craigslist] Apify HTTP ${apifyRes.status}: ${errText.slice(0, 300)}`);
        console.warn('[Craigslist] Falling back to RSS');
      }
    } catch (apifyErr) {
      console.warn('[Craigslist] Apify error, falling back to RSS:', apifyErr.message);
    }
  }


  // ── Direct RSS scraping (free, no API key required) ────────────────────────
  try {
    const rssUrl = `${searchUrl}&format=rss`;
    console.log(`[Craigslist] RSS fetch: ${rssUrl}`);

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 8000);

    const fetchRes = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, text/xml, */*',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const xml    = await fetchRes.text();
    const items  = [];
    const itemRx = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRx.exec(xml)) !== null && items.length < limit) {
      const block = match[1];
      const title = (
        block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
        block.match(/<title>(.*?)<\/title>/)?.[1] ||
        ''
      ).trim();
      const desc  = (
        block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] ||
        block.match(/<description>(.*?)<\/description>/)?.[1] ||
        ''
      ).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 500);
      const link  = (
        block.match(/<link>(.*?)<\/link>/)?.[1] ||
        block.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] ||
        ''
      ).trim();
      const date  = (block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '').trim();
      const phone = desc.match(/\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/)?.[0] || '';

      if (title) {
        items.push({ title, description: desc, link, date, phone });
      }
    }

    console.log(`[Craigslist] RSS parsed ${items.length} results`);
    return items;
  } catch (err) {
    console.error('[Craigslist] RSS search failed:', err.message);
    return [];
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────


app.listen(PORT, () => {
  console.log(`\n[Wave Closers Proxy] ✓ Running on http://localhost:${PORT}`);
  console.log(`  Claude:   ${ANTHROPIC_KEY ? '✓ ready' : '✗ no key'}`);
  console.log(`  Airtable: ${airtableReady() ? '✓ connected' : '✗ not configured'}`);
  console.log(`  Email:    ${emailReady() ? '✓ Resend ready' : '✗ demo mode (console)'}`);
  console.log();

  // Debug: list all registered API routes
  console.log('[proxy] Registered routes:');
  app._router.stack.forEach(r => {
    if (r.route) {
      const methods = Object.keys(r.route.methods).join(',').toUpperCase();
      console.log(`  ${methods.padEnd(6)} ${r.route.path}`);
    }
  });
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
