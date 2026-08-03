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
  // Resume Lead Distribution (Workflow C)
  getRecruitingAgents,
  getGlobalResumeDeduplicationSet,
  getResumeLeadsByAgent,
  getResumeLeadsByAgent as getResumeLeadsByRecruiter,
  updateResumeLeadStatus,
  getResumeLeadStats,
  bulkAssignResumeLeads,
  saveResumeLead,
  registerResumeAsAssigned,
  verifyAirtableTables,
  // Notifications (Req 4)
  fetchNotifications,
  markNotificationsRead,
  markNotificationRead,
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
import { AGENTS, CITY_SUBDOMAINS, DAILY_RESUME_LEADS_PER_WCR, RESUME_SEARCH_KEYWORDS } from './constants.js';

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
    // Allow non-browser requests (curl, mobile, backend-to-backend)
    if (!origin) return cb(null, true);
    // Allow localhost during dev
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return cb(null, true);
    // Allow configured ALLOWED_ORIGINS or wildcard
    if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) return cb(null, true);
    // Allow Railway, Vercel, Netlify, custom domains
    if (origin.includes('waveclosers') || origin.includes('railway.app') || origin.includes('vercel.app')) return cb(null, true);
    // Fallback: allow all origins to guarantee global access for remote agents (e.g. Philippines)
    return cb(null, true);
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
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
    'callbackAt', // Req 2 — callback scheduling
    'agentNotes',
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

// All recruiting endpoints require admin, pm, recruiter, wave_closer_recruiter, or any agent role
const requireRecruiterAccess = (req, res, next) =>
  requireAuth(req, res, () => requireRole(
    'admin', 'pm', 'recruiter', 'wave_closer_recruiter', 'agent',
    'cold_caller', 'independent_rep', 'authorized_reseller',
    'iso_investor', 'referral_partner', 'agent_supervisor'
  )(req, res, next));

// Resume lead endpoints — recruiting agents + admins
const requireResumeAccess = (req, res, next) =>
  requireAuth(req, res, () => requireRole(
    'admin', 'pm', 'sponsor', 'recruiter', 'wave_closer_recruiter', 'agent', 'cold_caller'
  )(req, res, next));

// Performance/stats + manual trigger — all admins and recruiter managers
const requireResumeAdmin = (req, res, next) =>
  requireAuth(req, res, () => requireRole(
    'admin', 'pm', 'sponsor', 'recruiter', 'wave_closer_recruiter'
  )(req, res, next));

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

// GET /api/resume-leads/craigslist-search
// Query params: ?city=Newark NJ&keywords=sales commission&limit=50

app.get('/api/resume-leads/craigslist-search', async (req, res) => {
  const city     = req.query.city     || 'newyork';
  const keywords = req.query.keywords || 'sales commission cold calling';
  const limit    = parseInt(req.query.limit) || 50;

  try {
    const results = await searchCraigslistResumes(city, keywords, limit);
    const globalDedupeSet = await getGlobalResumeDeduplicationSet();
    const annotated = results.map(r => {
      const url = (r.link || '').trim().toLowerCase();
      return {
        ...r,
        alreadyAssigned: url ? globalDedupeSet.has(url) : false,
      };
    });
    res.json({ results: annotated, total: annotated.length, city, keywords });
  } catch (err) {
    console.error('[Craigslist] search error:', err.message);
    res.status(500).json({ error: err.message, results: [] });
  }
});

async function searchCraigslistResumes(cityInput, keywords, limit = 50) {
  const citySlug = toCraigslistSlug(cityInput);

  const APIFY_KEY = process.env.APIFY_API_KEY;
  let apifyErrorMsg = null;

  if (APIFY_KEY) {
    try {
      const results = await fetchViaApify(citySlug, keywords, limit, APIFY_KEY);
      return results;
    } catch (e) {
      apifyErrorMsg = e.message;
      console.warn('[Craigslist] Apify failed, falling back to RSS:', e.message);
    }
  } else {
    apifyErrorMsg = 'No APIFY_API_KEY configured';
  }

  // RSS fallback — if Apify throws error or no API key
  try {
    return await fetchViaRSS(citySlug, keywords, limit);
  } catch (rssErr) {
    console.warn('[Craigslist] RSS fallback failed:', rssErr.message);
    return [];
  }
}

function toCraigslistSlug(cityInput) {
  if (!cityInput) return 'newyork';
  let str = cityInput.toLowerCase().trim()
    .replace(/,/g, ' ')
    .replace(/–/g, '-')
    .replace(/\s+/g, ' ');

  const SPECIAL_MAP = {
    'new york': 'newyork', 'new york city': 'newyork', 'nyc': 'newyork', 'manhattan': 'newyork',
    'san francisco': 'sfbay', 'sf': 'sfbay', 'bay area': 'sfbay', 'san jose': 'sfbay', 'oakland': 'sfbay',
    'los angeles': 'losangeles', 'la': 'losangeles',
    'washington': 'washingtondc', 'washington dc': 'washingtondc', 'dc': 'washingtondc',
    'dallas fort worth': 'dallas', 'dfw': 'dallas',
    'staten island': 'statenisland',
    'jersey city': 'jerseycity',
    'new jersey': 'newjersey',
    'connecticut': 'newhaven',
  };

  if (SPECIAL_MAP[str]) return SPECIAL_MAP[str];

  // Strip 2-letter state postal code at the end (e.g. 'orlando fl' -> 'orlando', 'austin tx' -> 'austin')
  const stateRegex = /\s+(ak|al|ar|az|ca|co|ct|dc|de|fl|ga|hi|ia|id|il|in|ks|ky|la|ma|md|me|mi|mn|mo|ms|mt|nc|nd|ne|nh|nj|nm|nv|ny|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|va|vt|wa|wi|wv|wy)$/i;
  str = str.replace(stateRegex, '').trim();

  if (SPECIAL_MAP[str]) return SPECIAL_MAP[str];

  return str.replace(/\s+/g, '');
}

async function fetchViaApify(citySlug, keywords, limit, apiKey) {
  const searchUrl = `https://${citySlug}.craigslist.org/search/res?query=${encodeURIComponent(keywords)}&sort=date`;
  console.log(`[Craigslist Apify] Scraping ${searchUrl} (limit ${limit})`);

  const response = await fetch(
    `https://api.apify.com/v2/acts/solidcode~craigslist-scraper/run-sync-get-dataset-items?timeout=120&memory=512`,
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        startUrls: [{ url: searchUrl }],
        maxItems:  limit,
      }),
      signal: AbortSignal.timeout(130000), // 130s — Apify sync timeout is 120s
    }
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    let parsed = errText;
    try {
      const j = JSON.parse(errText);
      if (j?.error?.message) parsed = j.error.message;
    } catch {}
    throw new Error(`Apify HTTP ${response.status}: ${parsed.slice(0, 200)}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) throw new Error(`Apify returned non-array: ${JSON.stringify(data).slice(0, 200)}`);

  const items = data.filter(r => r && r.title).slice(0, limit).map(r => {
    const desc           = r.description || r.postingBody || '';
    const phoneFromDesc  = desc.match(/\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}/)?.[0] || '';
    const emailFromDesc  = desc.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || '';

    // Standardize URL: use numeric postId format when available (immune to 404/case issues)
    let validUrl = '';
    const region = r.region || citySlug;
    if (r.postId) {
      validUrl = `https://${region}.craigslist.org/res/${r.postId}.html`;
    } else {
      validUrl = (r.url || r.link || '').trim();
    }

    return {
      title:       r.title       || 'Untitled',
      description: desc.slice(0, 500),
      phone:       r.phone       || phoneFromDesc || '',
      email:       r.email       || r.replyEmail  || emailFromDesc || '',
      link:        validUrl,
      date:        r.postedAt    || r.date        || '',
      market:      citySlug,
    };
  });

  console.log(`[Craigslist Apify] ${items.length} resumes returned for ${citySlug}`);
  return items;
}

async function fetchViaRSS(citySlug, keywords, limit) {
  const url = `https://${citySlug}.craigslist.org/search/res?query=${encodeURIComponent(keywords)}&format=rss&sort=date`;
  console.log('[Craigslist RSS] Fallback fetch:', url);

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 10000);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept':     'application/rss+xml, application/xml, text/xml, */*',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (res.status === 403) throw new Error('Craigslist returned 403 (anti-bot block on RSS)');
  if (!res.ok)           throw new Error(`Craigslist RSS returned ${res.status}`);

  const xml = await res.text();
  if (xml.includes('<title>blocked</title>') || xml.includes('blocked')) {
    throw new Error('Craigslist RSS: request blocked');
  }

  if (!xml.includes('<item>')) {
    console.warn('[Craigslist RSS] No items in response for:', citySlug);
    return [];
  }

  const items    = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const block = match[1];
    const title = (
      block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
      block.match(/<title>(.*?)<\/title>/)?.[1] || ''
    ).trim();
    const link = (
      block.match(/<link>(.*?)<\/link>/)?.[1] ||
      block.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || ''
    ).trim();
    const desc = (
      block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ||
      block.match(/<description>([\s\S]*?)<\/description>/)?.[1] || ''
    ).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 500);
    const date  = (block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '').trim();
    const phone = desc.match(/\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}/)?.[0] || '';
    const email = desc.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || '';

    if (title && link) {
      items.push({ title, description: desc, phone, email, link, date, market: citySlug });
    }
  }

  console.log(`[Craigslist RSS] ${items.length} resumes found for ${citySlug}`);
  return items;
}

// ─── Resume Lead Distribution API (Workflow C) ───────────────────────────────

/**
 * GET /api/resume-leads/my-leads
 * Returns today's resume leads for the logged-in recruiting agent.
 */
app.get('/api/resume-leads/my-leads', requireResumeAccess, async (req, res) => {
  try {
    const { name } = req.user;
    const { date } = req.query;
    const dateFilter = date || null; // null returns all assigned leads for agent
    const leads = await getResumeLeadsByAgent(name, dateFilter);
    res.json({ leads, agent: name, date: dateFilter });
  } catch (err) {
    console.error('[proxy] GET /api/resume-leads/my-leads:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/resume-leads/:id/status
 * Update status and/or outreach notes for a resume lead.
 */
app.patch('/api/resume-leads/:id/status', requireResumeAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body || {};
    const updated = await updateResumeLeadStatus(id, status, notes);
    if (!updated) return res.status(500).json({ error: 'Failed to update resume lead' });
    res.json(updated);
  } catch (err) {
    console.error('[proxy] PATCH /api/resume-leads/:id/status:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/resume-leads/stats
 * Performance stats: per-agent + per-market + dedup count.
 * Supports ?date=, ?market=, ?agent= query filters.
 */
app.get('/api/resume-leads/stats', requireResumeAdmin, async (req, res) => {
  try {
    const { date, market, agent } = req.query;
    const stats = await getResumeLeadStats({
      dateFilter:   date   || '',
      marketFilter: market || '',
      agentFilter:  agent  || '',
    });
    res.json(stats);
  } catch (err) {
    console.error('[proxy] GET /api/resume-leads/stats:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/resume-leads/distribute-now
 * Manually trigger resume distribution for the given cities + keywords.
 * Body: { cities: string[], keywords?: string, leadsPerAgent?: number }
 * Cities are specified by the admin — NOT hardcoded.
 */
app.post('/api/resume-leads/distribute-now', requireResumeAdmin, async (req, res) => {
  try {
    const {
      cities     = [],
      keywords   = RESUME_SEARCH_KEYWORDS,
      leadsPerAgent = DAILY_RESUME_LEADS_PER_WCR,
    } = req.body || {};

    if (!cities.length) {
      return res.status(400).json({ error: 'cities array is required — select at least one city' });
    }

    // Run distribution asynchronously and respond immediately
    res.json({ started: true, cities, keywords, leadsPerAgent });

    // Import distributeResumeLeads from automationWorker is not possible (circular),
    // so we call the distribution logic inline here.
    setImmediate(async () => {
      try {
        const agents = await getRecruitingAgents();
        if (!agents.length) {
          await appendLog({ task: 'Manual distribution skipped', target: 'No recruiting agents found', status: 'alert' });
          return;
        }

        const globalDedupeSet = await getGlobalResumeDeduplicationSet();
        let freshResumes = [];

        for (const citySlug of cities) {
          try {
            const results = await searchCraigslistResumes(citySlug, keywords, 100);
            const newOnly = results.filter(r => {
              const url = (r.link || '').trim().toLowerCase();
              return url && !globalDedupeSet.has(url);
            });
            freshResumes = [...freshResumes, ...newOnly.map(r => ({ ...r, market: CITY_SUBDOMAINS[citySlug] || citySlug }))];
            console.log(`[Manual Dist] ${citySlug}: ${results.length} found, ${newOnly.length} new`);
          } catch (e) {
            console.error(`[Manual Dist] Failed ${citySlug}:`, e.message);
          }
        }

        // De-dup within this batch
        const seen = new Set();
        freshResumes = freshResumes.filter(r => {
          const url = (r.link || '').trim().toLowerCase();
          if (seen.has(url)) return false;
          seen.add(url);
          return true;
        });

        console.log(`[Manual Dist] ${freshResumes.length} fresh resumes, distributing to ${agents.length} agents (Round-Robin)`);
        const buckets = {};
        for (const a of agents) {
          buckets[a.name] = [];
        }

        let pool = [...freshResumes];
        let agentIndex = 0;

        while (pool.length > 0) {
          const agent = agents[agentIndex];
          if (buckets[agent.name].length < leadsPerAgent) {
            buckets[agent.name].push(pool.shift());
          }
          agentIndex = (agentIndex + 1) % agents.length;
          const allFull = agents.every(a => buckets[a.name].length >= leadsPerAgent);
          if (allFull) break;
        }

        for (const agent of agents) {
          const batch = buckets[agent.name];
          if (!batch.length) {
            await appendLog({ task: 'Resume distribution skipped', target: `${agent.name} — pool exhausted`, status: 'alert' });
            continue;
          }
          const result = await bulkAssignResumeLeads(batch, agent.name, '');
          await appendLog({ task: 'Manual resume leads assigned', target: `${agent.name} → ${result.assigned} leads (${result.skipped} skipped)`, status: 'ok' });
          console.log(`[Manual Dist] ${agent.name}: ${result.assigned} assigned, ${result.skipped} skipped`);
        }

        console.log('[Manual Dist] Complete');
      } catch (err) {
        console.error('[Manual Dist] Error:', err.message);
        await appendLog({ task: 'Manual distribution error', target: err.message, status: 'error' }).catch(() => {});
      }
    });
  } catch (err) {
    console.error('[proxy] POST /api/resume-leads/distribute-now:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/resume-leads/dedup-stats
 * Returns the count of permanently locked resume URLs.
 */
app.get('/api/resume-leads/dedup-stats', requireResumeAdmin, async (req, res) => {
  try {
    const set = await getGlobalResumeDeduplicationSet();
    res.json({ totalLocked: set.size });
  } catch (err) {
    console.error('[proxy] GET /api/resume-leads/dedup-stats:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/resume-leads/available-cities
 * Returns the list of all available Craigslist cities for the city picker.
 */
app.get('/api/resume-leads/available-cities', requireResumeAdmin, async (req, res) => {
  const cities = Object.entries(CITY_SUBDOMAINS).map(([slug, label]) => ({ slug, label }));
  res.json({ cities });
});

/**
 * GET /api/resume-leads/recruiting-agents
 * Returns the list of active recruiting agents (for admin bulk assign dropdown).
 */
app.get('/api/resume-leads/recruiting-agents', requireResumeAdmin, async (req, res) => {
  try {
    const agents = await getRecruitingAgents();
    res.json({ agents });
  } catch (err) {
    console.error('[proxy] GET /api/resume-leads/recruiting-agents:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/resume-leads/bulk-assign', requireResumeAdmin, async (req, res) => {
  const {
    resumes,
    agentName,
    market,
    city          = 'newyork',
    keywords      = 'sales commission cold calling',
    agentNames    = [],
    countPerAgent = 20,
  } = req.body || {};

  // Payload Case 1 — Direct selection payload: { resumes: [...], agentName, market }
  if (Array.isArray(resumes) && resumes.length > 0) {
    const targetAgent = agentName || (agentNames.length > 0 ? agentNames[0] : '');
    if (!targetAgent) {
      return res.status(400).json({ error: 'No target agent specified' });
    }
    try {
      const result = await bulkAssignResumeLeads(resumes, targetAgent, market || city);
      return res.json({
        success: true,
        assigned: result.assigned,
        skipped:  result.skipped,
        totalAssigned: result.assigned,
        summary:  [{ agent: targetAgent, assigned: result.assigned }],
      });
    } catch (err) {
      console.error('[proxy] POST /api/resume-leads/bulk-assign (direct):', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // Payload Case 2 — Auto search & round-robin payload: { cities[], keywords, agentNames[], countPerAgent }
  // Now accepts 'cities' array (multi-city) OR legacy 'city' string
  const citiesInput = Array.isArray(req.body.cities) && req.body.cities.length > 0
    ? req.body.cities
    : [city];  // fall back to legacy single city

  const targetAgents = Array.isArray(agentNames) && agentNames.length > 0
    ? agentNames
    : (agentName ? [agentName] : []);

  if (targetAgents.length === 0) {
    return res.status(400).json({ error: 'No agents selected' });
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    // Step 1 — Fetch fresh resumes from ALL selected cities
    console.log(`[BulkAssign] Fetching resumes for ${citiesInput.length} cities: ${citiesInput.join(', ')}`);
    let allResults = [];
    const perCityBreakdown = {};

    for (const cityEntry of citiesInput) {
      const cityResults = await searchCraigslistResumes(cityEntry, keywords, targetAgents.length * countPerAgent * 2);
      perCityBreakdown[cityEntry] = cityResults.length;
      allResults = [...allResults, ...cityResults.map(r => ({ ...r, market: cityEntry }))];
      console.log(`[BulkAssign] ${cityEntry}: ${cityResults.length} results`);
    }

    // Deduplicate across cities
    const crossCitySeen = new Set();
    allResults = allResults.filter(r => {
      const key = (r.link || r.phone || r.title || '').toLowerCase();
      if (!key || crossCitySeen.has(key)) return false;
      crossCitySeen.add(key);
      return true;
    });

    console.log(`[BulkAssign] Total unique across ${citiesInput.length} cities: ${allResults.length}`);

    if (allResults.length === 0) {
      return res.status(200).json({
        success: false,
        message: `No resumes found for the selected cities with keywords "${keywords}". Try different cities or keywords.`,
        assigned: 0,
      });
    }

    // Step 2 — Load global dedup set
    const globalDedupeSet = await getGlobalResumeDeduplicationSet();

    // Step 3 — Filter out already-assigned resumes
    const freshResumes = allResults.filter(r => {
      const url = (r.link || '').trim().toLowerCase();
      return url && !globalDedupeSet.has(url);
    });

    const perCityFreshBreakdown = {};
    freshResumes.forEach(r => {
      const m = r.market || 'Unknown';
      perCityFreshBreakdown[m] = (perCityFreshBreakdown[m] || 0) + 1;
    });

    console.log(`[BulkAssign] ${allResults.length} found → ${freshResumes.length} are fresh`);

    if (freshResumes.length === 0) {
      return res.status(200).json({
        success: false,
        message: `All resumes found across the selected cities have already been assigned. Try different cities or keywords.`,
        assigned: 0,
      });
    }

    // Step 4 — Assign to each selected agent using Round-Robin distribution
    const buckets = {};
    for (const name of targetAgents) {
      buckets[name] = [];
    }

    let pool = [...freshResumes];
    let agentIndex = 0;

    while (pool.length > 0) {
      const name = targetAgents[agentIndex];

      // Only add if this agent hasn't reached countPerAgent limit yet
      if (buckets[name].length < countPerAgent) {
        buckets[name].push(pool.shift()); // take one resume from pool
      }

      // Rotate to next agent
      agentIndex = (agentIndex + 1) % targetAgents.length;

      // Stop if all selected agents have reached their countPerAgent limit
      const allFull = agentNames.every(name => buckets[name].length >= countPerAgent);
      if (allFull) break;
    }

    // Now save each agent's bucket to Airtable
    let summary = [];
    for (const agentName of agentNames) {
      const batch = buckets[agentName];
      if (batch.length === 0) {
        summary.push({ agent: agentName, assigned: 0, note: 'Pool exhausted' });
        continue;
      }

      for (const resume of batch) {
        const rawUrl = (resume.link || resume.craigslistUrl || resume.url || '').trim();
        const urlForDedup = rawUrl.toLowerCase();
        await saveResumeLead({
          title:         resume.title,
          description:   resume.description,
          phone:         resume.phone || '',
          email:         resume.email || '',
          craigslistUrl: rawUrl, // Preserve exact case-sensitive URL
          market:        city,
          assignedTo:    agentName,
          assignedDate:  today,
          status:        'New',
        });
        await registerResumeAsAssigned(rawUrl, agentName, today);
        globalDedupeSet.add(urlForDedup);
      }

      summary.push({ agent: agentName, assigned: batch.length });

      await appendLog({
        task:   'Bulk resume leads assigned',
        target: `${agentName} → ${batch.length} resumes from ${city}`,
        status: 'ok',
      });
    }

    const totalAssigned = summary.reduce((s, r) => s + r.assigned, 0);
    console.log(`[BulkAssign] Complete — ${totalAssigned} resumes assigned across ${agentNames.length} agents (Round-Robin)`);

    // Per-city breakdown for the result display
    const perCityResult = Object.entries(perCityFreshBreakdown).map(([city, fresh]) => ({
      city,
      found: perCityBreakdown[city] || 0,
      fresh,
    }));

    res.json({
      success:      true,
      totalAssigned,
      freshFound:   freshResumes.length,
      totalFound:   allResults.length,
      citiesSearched: citiesInput,
      perCity:      perCityResult,
      summary,
    });

  } catch (err) {
    console.error('[BulkAssign] Error:', err.message);
    res.status(500).json({ error: err.message, success: false });
  }
});

// ─── POST /api/resume-leads/agent-self-search ────────────────────────────────
// Allows wave_closer_recruiter agents to search Craigslist themselves.
// Body: { city: string, keywords: string, count: number }
// Returns fresh (non-duplicate) leads AND assigns them directly to the calling agent.

app.post('/api/resume-leads/agent-self-search', requireResumeAccess, async (req, res) => {
  const {
    city     = '',
    keywords = 'sales',
    count    = 20,
  } = req.body || {};

  const agentName = req.user?.name || req.user?.email || '';
  const market    = city.trim() || 'Unknown City';

  if (!city.trim()) {
    return res.status(400).json({ error: 'City is required. Enter a city name like "Houston, TX" or "Miami".' });
  }

  try {
    const fetchLimit = Math.min(Math.max(parseInt(count) || 20, 1), 100);
    const today = new Date().toISOString().split('T')[0];

    // 1 — Search Craigslist
    console.log(`[AgentSelfSearch] ${agentName} searching "${city}" for "${keywords}" (limit ${fetchLimit * 3})...`);
    const allResults = await searchCraigslistResumes(city, keywords, fetchLimit * 3);

    if (allResults.length === 0) {
      return res.json({
        success: false,
        message: `No Craigslist resumes found for "${city}" with keyword "${keywords}". Try a different city or keyword.`,
        assigned: 0,
        leads: [],
      });
    }

    // 2 — Filter already-assigned resumes
    const globalDedupeSet = await getGlobalResumeDeduplicationSet();
    const freshResumes = allResults.filter(r => {
      const url = (r.link || '').trim().toLowerCase();
      return url && !globalDedupeSet.has(url);
    }).slice(0, fetchLimit);

    console.log(`[AgentSelfSearch] ${allResults.length} found → ${freshResumes.length} fresh → will assign ${Math.min(freshResumes.length, fetchLimit)}`);

    if (freshResumes.length === 0) {
      return res.json({
        success: false,
        message: `All ${allResults.length} resumes found for "${city}" have already been assigned. Try a different city or keyword.`,
        assigned: 0,
        leads: [],
      });
    }

    // 3 — Save & register each fresh lead to the calling agent
    const savedLeads = [];
    for (const resume of freshResumes) {
      const rawUrl      = (resume.link || resume.craigslistUrl || resume.url || '').trim();
      const urlForDedup = rawUrl.toLowerCase();

      await saveResumeLead({
        title:         resume.title,
        description:   resume.description || '',
        phone:         resume.phone  || '',
        email:         resume.email  || '',
        craigslistUrl: rawUrl,
        market,
        assignedTo:    agentName,
        assignedDate:  today,
        status:        'New',
      });
      await registerResumeAsAssigned(rawUrl, agentName, today);
      globalDedupeSet.add(urlForDedup);

      savedLeads.push({
        title:  resume.title,
        phone:  resume.phone,
        email:  resume.email,
        link:   rawUrl,
        market,
        status: 'New',
        assignedDate: today,
      });
    }

    await appendLog({
      task:   'Agent self-search leads',
      target: `${agentName} → ${savedLeads.length} resumes from "${city}" (keyword: ${keywords})`,
      status: 'ok',
    });

    return res.json({
      success:       true,
      assigned:      savedLeads.length,
      totalFound:    allResults.length,
      freshFound:    freshResumes.length,
      message:       `${savedLeads.length} fresh lead${savedLeads.length !== 1 ? 's' : ''} found and assigned to you from "${city}".`,
      leads:         savedLeads,
    });

  } catch (err) {
    console.error('[AgentSelfSearch] Error:', err.message);
    res.status(500).json({ error: err.message, success: false });
  }
});

// ─── Agent Portal: self-search ────────────────────────────────────────────────

// ─── Notifications API (Req 4) ────────────────────────────────────────────────

/**
 * GET /api/notifications/my
 * Returns the calling agent's notifications (last 50), newest first.
 */
app.get('/api/notifications/my', requireAuth, async (req, res) => {
  const email = req.user.email;
  if (!airtableReady()) return res.json({ notifications: [], unreadCount: 0, demo: true });
  try {
    const result = await fetchNotifications(email);
    res.json({ ...result, demo: false });
  } catch (err) {
    console.error('[proxy] GET /api/notifications/my:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/notifications/read-all
 * Marks all unread notifications as read for the calling agent.
 */
app.patch('/api/notifications/read-all', requireAuth, async (req, res) => {
  const email = req.user.email;
  if (!airtableReady()) return res.json({ ok: true, demo: true });
  try {
    await markNotificationsRead(email);
    res.json({ ok: true, demo: false });
  } catch (err) {
    console.error('[proxy] PATCH /api/notifications/read-all:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read by Airtable record ID.
 */
app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!airtableReady()) return res.json({ ok: true, demo: true });
  try {
    await markNotificationRead(id);
    res.json({ ok: true, demo: false });
  } catch (err) {
    console.error('[proxy] PATCH /api/notifications/:id/read:', err.message);
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

  if (airtableReady()) {
    verifyAirtableTables().catch(err => {
      console.warn('[proxy] Table verification check failed:', err.message);
    });
  }

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
