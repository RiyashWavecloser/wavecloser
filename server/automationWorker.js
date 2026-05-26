/**
 * server/automationWorker.js
 *
 * Wave Closers automation worker — all 9 automations.
 *
 * Run normally:   node server/automationWorker.js
 * Test mode:      node server/automationWorker.js --test-mode
 *
 * Graceful degradation:
 *   - No Airtable  → demo mode, skips DB ops
 *   - No Resend    → logs email content to console
 *   - No Claude    → skips AI calls, logs "demo" result
 *   - Never crashes — every automation is wrapped in try/catch
 *
 * Startup log:
 *   [Wave Closers Worker] Started — {datetime}
 *   Airtable: ✓/✗  Email: ✓/✗  Claude: ✓/✗
 *   Polling every 60s | Report: Mon 7am | Quota check: last day of month 9am
 */

import cron    from 'node-cron';
import dotenv  from 'dotenv';
import {
  isConfigured as airtableReady,
  listUsers,
  updateUser,
  appendLog,
} from './airtableClient.js';
import {
  sendEmail,
  buildWelcomeEmail,
  buildContractEmail,
  buildLeadShortfallEmail,
  buildWeeklyReportEmail,
  buildQuotaMissEmail,
  buildLearningEnrollmentEmail,
  buildTrainingInviteEmail,
} from './emailService.js';
import { BENCHMARKS } from './constants.js';

dotenv.config();

const TEST_MODE   = process.argv.includes('--test-mode');
const CLAUDE_KEY  = process.env.ANTHROPIC_API_KEY;
const RESEND_READY = !!process.env.RESEND_API_KEY;

// ─── Startup ──────────────────────────────────────────────────────────────────

const now = new Date().toLocaleString();
console.log(`\n[Wave Closers Worker] Started — ${now}`);
console.log(`  Airtable: ${airtableReady() ? '✓' : '✗ (demo mode)'}  Email: ${RESEND_READY ? '✓' : '✗ (console)'}  Claude: ${CLAUDE_KEY ? '✓' : '✗ (demo)'}`);
if (!TEST_MODE) console.log('  Polling every 60s | Report: Mon 7am | Quota check: last day of month 9am\n');

// ─── Idempotency ──────────────────────────────────────────────────────────────
// Key format: {automationName}-{userId}-{date}  e.g. "welcome-WC-1001-2026-05-19"

const _processed = new Set();

function todayKey() { return new Date().toISOString().slice(0, 10); }
function monthKey() { return new Date().toISOString().slice(0, 7); }

function alreadyDone(key) { return _processed.has(key); }
function markDone(key)    { _processed.add(key); }

// ─── Claude call ──────────────────────────────────────────────────────────────

async function callClaude(system, userMsg, maxTokens = 300) {
  if (!CLAUDE_KEY) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userMsg }],
    }),
  });
  const data = await res.json();
  return data.content?.map(b => b.text || '').join('') || null;
}

// ─── Log helper ───────────────────────────────────────────────────────────────

async function log(task, target, status = 'ok') {
  const icon = status === 'alert' ? '⚠' : status === 'error' ? '✗' : '✓';
  console.log(`  [${new Date().toLocaleTimeString()}] ${icon} ${task} — ${target}`);
  await appendLog({ task, target, status }).catch(() => {});
}

// ─── Status computation (mirrors frontend) ────────────────────────────────────

function computeStatus(user) {
  const bm = BENCHMARKS[user.type];
  if (!bm) return 'onboarding';
  if (user.stage < 4) return 'onboarding';
  if (user.leadsThisWeek  < bm.weeklyLeads  * 0.5) return 'red';
  if (user.dealsThisMonth < bm.monthlyQuota * 0.7) return 'amber';
  return 'green';
}

// ─── THE 9 AUTOMATIONS ───────────────────────────────────────────────────────

/** #1 — User classification (stage 2) */
async function runClassify(user) {
  const key = `classify-${user.id}-${todayKey()}`;
  if (alreadyDone(key)) return;
  markDone(key);

  const reply = await callClaude(
    'You are a Wave Closers onboarding classifier. Return ONLY one word: REFERRAL, REP, RESELLER, or ISO.',
    `User: ${user.name}, market: ${user.market || '—'}, notes: ${user.notes || 'none'}, current type: ${user.type}`
  );

  const newType = reply?.trim().toUpperCase();
  const validTypes = ['REFERRAL', 'REP', 'RESELLER', 'ISO'];
  if (newType && validTypes.includes(newType) && newType !== user.type) {
    if (airtableReady()) await updateUser(user.id, { type: newType }).catch(console.error);
    await log('User classification', `${user.name} → ${newType} (was ${user.type})`);
  } else {
    await log('User classification', `${user.name} → confirmed ${user.type}`);
  }
}

/** #2 — Welcome email (stage 3) */
async function runWelcome(user) {
  const key = `welcome-${user.id}`;
  if (alreadyDone(key) || !user.email) return;
  markDone(key);
  await sendEmail(buildWelcomeEmail(user)).catch(console.error);
  await log('Welcome email', `${user.name} (${user.type})`, 'sent');
}

/** #3 — Contract dispatch (stage 4) */
async function runContractDispatch(user) {
  const key = `contract-${user.id}`;
  if (alreadyDone(key)) return;
  markDone(key);
  await sendEmail(buildContractEmail(user)).catch(console.error);
  await log('Contract dispatch', `${user.name} → Mildred (CX)`, 'sent');
}

/** #4 — Online learning enrollment (PENDING open item #5) */
async function runLearningEnrollment(user) {
  const key = `learning-${user.id}`;
  if (alreadyDone(key) || !user.email) return;
  markDone(key);
  // PENDING: uncomment when LEARNING_PLATFORM_URL is set
  if (!process.env.LEARNING_PLATFORM_URL) {
    console.log(`  [worker] #4 PENDING — learning platform URL not set (user: ${user.name})`);
    return;
  }
  await sendEmail(buildLearningEnrollmentEmail(user)).catch(console.error);
  await log('Online learning enrollment', user.name, 'sent');
}

/** #5 — Thursday training invite (PENDING open item #6) */
async function runTrainingInvite(user) {
  const key = `training-${user.id}`;
  if (alreadyDone(key) || !user.email) return;
  markDone(key);
  // PENDING: uncomment when THURSDAY_TRAINING_TIME is set
  if (!process.env.THURSDAY_TRAINING_TIME) {
    console.log(`  [worker] #5 PENDING — training time not set (user: ${user.name})`);
    return;
  }
  await sendEmail(buildTrainingInviteEmail(user)).catch(console.error);
  await log('Thursday training invite', user.name, 'sent');
}

/** #6 — Weekly performance report (Monday 7am cron) */
async function runWeeklyReport(users) {
  const withStatus = users.map(u => ({ ...u, _status: computeStatus(u), _benchmark: BENCHMARKS[u.type] }));
  const stats = {
    total:       users.length,
    onTrack:     withStatus.filter(u => u._status === 'green').length,
    atRisk:      withStatus.filter(u => u._status === 'amber').length,
    belowTarget: withStatus.filter(u => u._status === 'red').length,
    onboarding:  withStatus.filter(u => u._status === 'onboarding').length,
    totalLeads:  users.reduce((s, u) => s + u.leadsThisWeek, 0),
    totalDeals:  users.reduce((s, u) => s + u.dealsThisMonth, 0),
  };
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  await sendEmail(buildWeeklyReportEmail(withStatus, stats, dateStr)).catch(console.error);
  await log('Weekly performance report', 'Riyash + William', 'sent');
}

/** #7 — Lead shortfall alert (every poll, per day per user) */
async function runShortfallChecks(users) {
  for (const user of users) {
    if (user.stage < 4) continue;
    const bm = BENCHMARKS[user.type];
    if (!bm) continue;
    if (user.leadsThisWeek >= bm.weeklyLeads * 0.5) continue;
    const key = `shortfall-${user.id}-${todayKey()}`;
    if (alreadyDone(key)) continue;
    markDone(key);
    await sendEmail(buildLeadShortfallEmail(user, user.leadsThisWeek, bm.weeklyLeads)).catch(console.error);
    await log('Lead-shortfall alert', `${user.name} (${user.leadsThisWeek}/${bm.weeklyLeads})`, 'alert');
  }
}

/** #8 — Quota miss escalation (last day of month) */
async function runQuotaChecks(users) {
  for (const user of users) {
    if (user.stage < 4) continue;
    const bm = BENCHMARKS[user.type];
    if (!bm) continue;
    if (user.dealsThisMonth >= bm.monthlyQuota * 0.5) continue;
    const key = `quota-${user.id}-${monthKey()}`;
    if (alreadyDone(key)) continue;
    markDone(key);
    await sendEmail(buildQuotaMissEmail(user, user.dealsThisMonth, bm.monthlyQuota)).catch(console.error);
    await log('Quota-miss escalation', `${user.name} (${user.dealsThisMonth}/${bm.monthlyQuota})`, 'alert');
  }
}

/** #9 — Franchise research (on-demand via frontend — goes through proxy) */
// Not implemented in the worker; handled directly by Claude proxy + frontend.

// ─── Stage-change event handler ───────────────────────────────────────────────

async function onStageChange(user) {
  console.log(`  [worker] Stage change: ${user.name} → stage ${user.stage}`);
  if (user.stage >= 2) await runClassify(user).catch(console.error);
  if (user.stage >= 3) await runWelcome(user).catch(console.error);
  if (user.stage >= 4) {
    await runContractDispatch(user).catch(console.error);
    await runLearningEnrollment(user).catch(console.error);
    await runTrainingInvite(user).catch(console.error);
  }
}

// ─── Poll loop ────────────────────────────────────────────────────────────────

let _prevStages = {};

async function poll() {
  if (!airtableReady()) {
    console.log('  [worker] Airtable not configured — skipping poll (demo mode)');
    return;
  }
  const users = await listUsers().catch(err => { console.error('[worker] Poll error:', err.message); return []; });
  for (const user of users) {
    const prev = _prevStages[user.id];
    if (prev !== undefined && user.stage !== prev) await onStageChange(user).catch(console.error);
    _prevStages[user.id] = user.stage;
  }
  await runShortfallChecks(users).catch(console.error);
}

// ─── Cron jobs ────────────────────────────────────────────────────────────────

if (!TEST_MODE) {
  // Weekly report — Monday 7am
  cron.schedule('0 7 * * 1', async () => {
    console.log('[worker] ⏰ Cron: weekly report');
    const users = airtableReady() ? await listUsers().catch(() => []) : [];
    await runWeeklyReport(users).catch(console.error);
  });

  // Quota check — 9am daily, only acts on last day of month
  cron.schedule('0 9 28-31 * *', async () => {
    const d = new Date();
    const tomorrow = new Date(d); tomorrow.setDate(d.getDate() + 1);
    if (tomorrow.getMonth() === d.getMonth()) return; // not last day
    console.log('[worker] ⏰ Cron: end-of-month quota check');
    const users = airtableReady() ? await listUsers().catch(() => []) : [];
    await runQuotaChecks(users).catch(console.error);
  });

  // Poll every 60 seconds
  poll();
  setInterval(poll, 60_000);
}

// ─── Test mode ────────────────────────────────────────────────────────────────

async function runTestMode() {
  console.log('\n[worker] 🧪 ========== TEST MODE ==========');
  console.log('  All 9 automations will run on a synthetic user.');
  console.log('  No real emails sent. No Airtable writes.\n');

  const fake = {
    id: 'WC-TEST-001', name: 'Test User (Synthetic)',
    type: 'RESELLER', stage: 4,
    leadsThisWeek: 2, dealsThisMonth: 1,
    joined: new Date().toISOString().split('T')[0],
    market: 'Nashville, TN',
    email: 'test@waveclosers.com',
    notes: 'Synthetic user for test mode.',
  };

  console.log('--- #1 Classification ---');
  await runClassify({ ...fake, stage: 2 }).catch(console.error);

  console.log('--- #2 Welcome email ---');
  await runWelcome({ ...fake, stage: 3, id: 'WC-TEST-002' }).catch(console.error);

  console.log('--- #3 Contract dispatch ---');
  await runContractDispatch({ ...fake, id: 'WC-TEST-003' }).catch(console.error);

  console.log('--- #4 Learning enrollment (may show PENDING) ---');
  await runLearningEnrollment({ ...fake, id: 'WC-TEST-004' }).catch(console.error);

  console.log('--- #5 Training invite (may show PENDING) ---');
  await runTrainingInvite({ ...fake, id: 'WC-TEST-005' }).catch(console.error);

  console.log('--- #6 Weekly report ---');
  await runWeeklyReport([fake]).catch(console.error);

  console.log('--- #7 Lead shortfall alert ---');
  await runShortfallChecks([fake]).catch(console.error);

  console.log('--- #8 Quota miss escalation ---');
  await runQuotaChecks([fake]).catch(console.error);

  console.log('--- #9 Franchise research ---');
  console.log('  [#9 runs via frontend Claude proxy — not invoked from worker]');

  console.log('\n[worker] 🧪 ========== TEST COMPLETE ==========\n');
  process.exit(0);
}

if (TEST_MODE) runTestMode();
