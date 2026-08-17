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
  getLeads,

  getBase,
  getUnassignedLeads,
  assignLeadsToAgent,
  assignLeadToAgent,
  getMondayOfCurrentWeek,
  listAgents,
  isRealAgentName,
  // Resume Lead Distribution (Workflow C)
  getRecruitingAgents,
  getGlobalResumeDeduplicationSet,
  bulkAssignResumeLeads,
  saveResumeLead,
  registerResumeAsAssigned,
  cleanOldDedupEntries,
  // Notifications (Req 4)
  createNotification,
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
import {
  BENCHMARKS,
  WEEKLY_LEADS_PER_AGENT,
  NUM_AGENTS,
  AGENTS,
  DAILY_RESUME_LEADS_PER_WCR,
  RESUME_SEARCH_KEYWORDS,
  RESUME_SEARCH_KEYWORDS_LIST,
  ALL_USA_CRAIGSLIST_CITIES,
  ALL_USA_BUSINESS_MARKETS,
  HIGH_VOLUME_CITIES,
  normalizeResumeURL,
  isDemoLead,
} from './constants.js';
import { generateLeads } from './leadWorker.js';
import { fetchViaApify, fetchCraigslistResumesWithFallback } from './apifyClient.js';


dotenv.config();

const TEST_MODE    = process.argv.includes('--test-mode');
const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY;
const APIFY_KEY    = process.env.APIFY_API_KEY;
const RESEND_READY = !!process.env.RESEND_API_KEY;

// ─── Startup ──────────────────────────────────────────────────────────────────

function verifyProductionConfig() {
  const required = {
    APIFY_API_KEY:      process.env.APIFY_API_KEY,
    AIRTABLE_API_KEY:   process.env.AIRTABLE_API_KEY,
    AIRTABLE_BASE_ID:   process.env.AIRTABLE_BASE_ID,
  };

  const missing = Object.entries(required)
    .filter(([key, val]) => !val)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error('[Worker] ⚠ MISSING ENVIRONMENT VARIABLES:', missing.join(', '));
    console.error('[Worker] Auto-distribution will use demo data or fail until these are set in Railway');
  } else {
    console.log('[Worker] ✓ All environment variables configured — will use real Apify data');
  }
}

verifyProductionConfig();

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
  await log('Contract dispatch', `${user.name} → CX Team`, 'sent');
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

// ─── Weekly Lead Model Helpers ────────────────────────────────────────────────

/**
 * Returns today's rotating batch of 20 Craigslist cities from the full USA list.
 * Cycles through all ~300 cities over time so different cities are searched each day.
 * This prevents shortfalls by ensuring the pool is always fresh and geographically diverse.
 */
function getCitiesForToday() {
  // Always include top 5 high-volume cities
  // Then rotate through the rest
  const top5    = HIGH_VOLUME_CITIES.slice(0, 5);
  const rest    = HIGH_VOLUME_CITIES.slice(5);
  const allMore = ALL_USA_CRAIGSLIST_CITIES.filter(
    c => !HIGH_VOLUME_CITIES.find(h => h.slug === c.slug)
  );

  const dayOfYear  = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const batchSize  = 15;
  const startIndex = (dayOfYear * batchSize) % (rest.length + allMore.length);
  const rotation   = [...rest, ...allMore];
  const todayExtra = [];

  for (let i = 0; i < batchSize; i++) {
    todayExtra.push(rotation[(startIndex + i) % rotation.length]);
  }

  const todayCities = [...top5, ...todayExtra];
  console.log(`[Worker] Today's ${todayCities.length} cities: ${todayCities.map(c => c.label).join(', ')}`);
  return todayCities;
}

// Friday 5pm Weekly Lead Performance Report
async function generateWeeklyLeadReport() {
  console.log('[worker] ⏰ Starting weekly lead performance report compilation...');
  try {
    const leads = await getLeads().catch(err => {
      console.error('[worker] Failed fetching leads for report:', err.message);
      return [];
    });

    const monday = getMondayOfCurrentWeek();
    const weekLeads = leads.filter(l => {
      const date = l.calledAt ? new Date(l.calledAt) : new Date(l.createdAt || Date.now());
      return date >= monday;
    });

    const agentMap = {};
    for (const agent of AGENTS) {
      agentMap[agent.name] = {
        name: agent.name,
        assigned: 0,
        called: 0,
        interested: 0,
        notInterested: 0,
        callback: 0,
        noAnswer: 0
      };
    }

    for (const l of weekLeads) {
      if (l.assignedAgent && agentMap[l.assignedAgent]) {
        const a = agentMap[l.assignedAgent];
        a.assigned++;
        if (l.outcome && ['Interested', 'NotInterested', 'Callback', 'NoAnswer'].includes(l.outcome)) {
          a.called++;
          if (l.outcome === 'Interested')    a.interested++;
          if (l.outcome === 'NotInterested') a.notInterested++;
          if (l.outcome === 'Callback')      a.callback++;
          if (l.outcome === 'NoAnswer')      a.noAnswer++;
        }
      }
    }

    const startStr = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    let reportText = `Wave Closers — Weekly Agent Performance Report\n`;
    reportText += `Week of ${startStr} - ${endStr}\n`;
    reportText += `==============================================\n\n`;

    for (const a of Object.values(agentMap)) {
      const convRate = a.called > 0 ? ((a.interested / a.called) * 100).toFixed(1) : '0.0';
      const remaining = a.assigned - a.called;

      reportText += `Agent: ${a.name}\n`;
      reportText += `─────────────────────────────\n`;
      reportText += `Total assigned:    ${a.assigned}\n`;
      reportText += `Called:            ${a.called}\n`;
      reportText += `Interested:         ${a.interested}\n`;
      reportText += `Not interested:    ${a.notInterested}\n`;
      reportText += `Callback:           ${a.callback}\n`;
      reportText += `No answer:          ${a.noAnswer}\n`;
      reportText += `Conversion rate:  ${convRate}%\n`;
      reportText += `─────────────────────────────\n`;
      reportText += `Remaining to call: ${remaining}\n\n`;
    }

    const riyashEmail = process.env.RIYASH_EMAIL;
    const williamEmail = process.env.WILLIAM_EMAIL;

    if (riyashEmail || williamEmail) {
      const recipients = [riyashEmail, williamEmail].filter(Boolean);
      console.log(`[worker] Sending weekly performance report to: ${recipients.join(', ')}`);
      await sendEmail({
        to: recipients,
        subject: `Wave Closers — Weekly Agent Performance Report (${startStr} - ${endStr})`,
        text: reportText
      });
    } else {
      console.warn('[worker] No recipient emails configured in env (RIYASH_EMAIL / WILLIAM_EMAIL). Logging report:\n', reportText);
    }

    await appendLog({
      task: 'Weekly report sent',
      target: `Report for ${Object.keys(agentMap).length} agents`,
      status: 'sent'
    }).catch(() => {});

  } catch (err) {
    console.error('[worker] Error compiling weekly report:', err.message);
  }
}

// ─── Daily Lead Distribution (Req 3) ─────────────────────────────────────────

/**
 * Distribute fresh leads to all cold-calling agents using round-robin.
 * Called by the morning cron (8AM EST) and midday cron (12PM EST).
 * @param {'morning'|'midday'} session
 */
export async function distributeDailyLeads(session = 'morning') {
  if (!airtableReady()) {
    console.log('[Worker] Airtable not configured — skipping daily lead distribution');
    return;
  }

  const today      = new Date().toISOString().split('T')[0];
  const perAgent   = session === 'morning'
    ? parseInt(process.env.MORNING_LEADS_PER_AGENT) || 60
    : parseInt(process.env.MIDDAY_LEADS_PER_AGENT)  || 40;

  // Get all cold-calling agents (from Airtable Staff table or AGENTS fallback)
  // Filters out generic placeholder accounts like "Agent 1", "Agent 2"
  const agentsList = await listAgents().catch(() => AGENTS);
  const coldCallers = agentsList.filter(a =>
    a.name && isRealAgentName(a.name) &&
    (!a.role || a.role.includes('cold') || a.role.includes('rep') || a.role.includes('reseller') || a.role.includes('agent'))
  );
  const effectiveCallers = coldCallers.length ? coldCallers : AGENTS.filter(a => isRealAgentName(a.name));

  console.log(`[Worker] ${session}: distributing ${perAgent} leads to ${effectiveCallers.length} real agents`);

  // Get unassigned leads from Leads table
  const needed     = effectiveCallers.length * perAgent;
  let unassigned   = await getUnassignedLeads(needed * 2);

  // Auto-generation fallback: if unassigned leads in DB are insufficient, generate fresh ones across USA markets!
  if (unassigned.length < needed) {
    console.log(`[Worker] ${session}: Only ${unassigned.length} unassigned leads in DB (need ${needed}). Triggering USA-wide auto-lead generation...`);
    const envMarkets = process.env.LEAD_GENERATION_MARKETS ? process.env.LEAD_GENERATION_MARKETS.split(',').map(m => m.trim()).filter(Boolean) : null;
    const targetMarkets = envMarkets || ALL_USA_BUSINESS_MARKETS;
    const businessTypes = ['restaurant', 'beauty_salon', 'nail_salon', 'deli', 'massage', 'small_retail', 'auto_repair', 'contractor', 'dentist', 'real_estate_agency'];

    // Rotate/shuffle markets so different runs target different nationwide US cities
    const shuffledMarkets = [...targetMarkets].sort(() => Math.random() - 0.5);

    for (const market of shuffledMarkets) {
      if (unassigned.length >= needed * 1.5) break;
      try {
        console.log(`[Worker] Auto-generating fresh leads for USA market: ${market}...`);
        await generateLeads({ location: market, businessTypes, radius: 10, maxLeads: 100 });
        unassigned = await getUnassignedLeads(needed * 2);
      } catch (err) {
        console.error(`[Worker] Auto-generation failed for ${market}:`, err.message);
      }
    }
  }

  if (!unassigned.length) {
    await appendLog({
      task:   `${session} distribution — no leads available`,
      target: 'All markets — Lead Generation APIs returned 0 leads',
      status: 'alert',
    }).catch(() => {});
    console.warn(`[Worker] ${session}: no unassigned leads available even after generation`);
    return;
  }


  console.log(`[Worker] ${session}: ${unassigned.length} unassigned leads available for distribution`);

  // Round-robin distribution
  const buckets = {};
  effectiveCallers.forEach(a => { buckets[a.name] = []; });
  let pool = [...unassigned];
  let idx  = 0;

  while (pool.length > 0) {
    const agent = effectiveCallers[idx % effectiveCallers.length];
    if (buckets[agent.name].length < perAgent) {
      buckets[agent.name].push(pool.shift());
    }
    idx++;
    if (effectiveCallers.every(a => buckets[a.name].length >= perAgent)) break;
  }

  // Save assignments + create in-app notifications
  for (const agent of effectiveCallers) {
    const batch = buckets[agent.name];
    if (!batch.length) continue;

    // Assign each lead in Airtable
    for (const lead of batch) {
      if (lead._airtableId) {
        await assignLeadToAgent(lead._airtableId, agent.name).catch(err =>
          console.error(`[Worker] assignLeadToAgent error for ${agent.name}:`, err.message)
        );
      }
    }

    // Create in-app notification
    const sessionLabel = session === 'morning' ? 'morning' : 'midday';
    await createNotification({
      recipientEmail: agent.email,
      type:           'new_leads_assigned',
      title:          `${batch.length} new leads assigned to you`,
      message:        `Your ${sessionLabel} leads are ready. You have ${batch.length} new businesses to call.`,
    }).catch(err => console.warn(`[Worker] createNotification error for ${agent.name}:`, err.message));

    // Optional email notification (off by default)
    if (process.env.NOTIFY_AGENTS_BY_EMAIL === 'true' && agent.email) {
      const frontendUrl = process.env.FRONTEND_URL || 'https://waveclosers-frontend-production.up.railway.app';
      await sendEmail({
        to:      agent.email,
        subject: `You have ${batch.length} new leads ready — Wave Closers`,
        text:    `Hi ${agent.name},\n\nYour ${sessionLabel} leads are ready. You have ${batch.length} new businesses to call today.\n\nLog in now: ${frontendUrl}\n\nWave Closers Operations`,
      }).catch(err => console.warn(`[Worker] Email notify error for ${agent.name}:`, err.message));
    }

    await appendLog({
      task:   `${session} leads assigned`,
      target: `${agent.name} → ${batch.length} leads`,
      status: 'ok',
    }).catch(() => {});

    console.log(`[Worker] ${session}: ${agent.name} → ${batch.length} leads assigned`);
  }

  console.log(`[Worker] ${session} distribution complete — ${today}`);
}

if (!TEST_MODE) {
  const SALES_LEADS_PAUSED = process.env.PAUSE_SALES_LEAD_DISTRIBUTION === 'true';
  if (SALES_LEADS_PAUSED) {
    console.log('[Worker] ⏸ Sales lead auto-distribution is PAUSED (PAUSE_SALES_LEAD_DISTRIBUTION=true)');
    console.log('[Worker] Recruiting lead distribution is still running normally');
  }

  // Morning distribution — 8:00 AM EST (= 1:00 PM UTC)
  const morningCron = process.env.MORNING_DISTRIBUTION_TIME || '0 13 * * *';
  cron.schedule(morningCron, async () => {
    if (process.env.PAUSE_SALES_LEAD_DISTRIBUTION === 'true') {
      console.log('[Worker] ⏸ Morning sales lead distribution skipped — paused by admin');
      return;
    }
    console.log('[Worker] ⏰ Morning lead distribution...');
    await distributeDailyLeads('morning').catch(err => {
      console.error('[Worker] Morning distribution error:', err.message);
    });
  });
  console.log(`[worker] ✓ Morning lead distribution cron scheduled: ${morningCron}`);

  // Midday top-up — 12:00 PM EST (= 5:00 PM UTC)
  const middayCron = process.env.MIDDAY_DISTRIBUTION_TIME || '0 17 * * *';
  cron.schedule(middayCron, async () => {
    if (process.env.PAUSE_SALES_LEAD_DISTRIBUTION === 'true') {
      console.log('[Worker] ⏸ Midday sales lead distribution skipped — paused by admin');
      return;
    }
    console.log('[Worker] ⏰ Midday lead top-up...');
    await distributeDailyLeads('midday').catch(err => {
      console.error('[Worker] Midday distribution error:', err.message);
    });
  });
  console.log(`[worker] ✓ Midday lead distribution cron scheduled: ${middayCron}`);

  // Onboarding Weekly Report — Monday 7am
  cron.schedule('0 7 * * 1', async () => {
    console.log('[worker] ⏰ Cron: onboarding weekly report');
    const users = airtableReady() ? await listUsers().catch(() => []) : [];
    await runWeeklyReport(users).catch(console.error);
  });

  // Weekly Batch Lead Generation — Monday 8am
  cron.schedule('0 8 * * 1', async () => {
    console.log('[worker] ⏰ Cron: Monday 8:00 AM weekly lead generation & assignment');
    try {
      const targetMarkets = (process.env.LEAD_GENERATION_MARKETS || 'Miami FL,Houston TX,Atlanta GA,Chicago IL,Dallas TX')
        .split(',').map(m => m.trim()).filter(Boolean);
      const allBusinessTypes = ['restaurant', 'beauty_salon', 'nail_salon', 'deli', 'massage', 'small_retail'];
      const radius = 5;

      let generatedPool = [];
      if (airtableReady()) {
        for (const market of targetMarkets) {
          try {
            console.log(`[worker] Generating leads for market: ${market}`);
            const result = await generateLeads({ location: market, businessTypes: allBusinessTypes, radius });
            if (result && result.leads) {
              generatedPool.push(...result.leads);
            }
          } catch (err) {
            console.error(`[worker] Failed generating leads for ${market}:`, err.message);
          }
        }
        
        // Fetch fresh unassigned leads from Airtable to get their Airtable record IDs (_airtableId)
        generatedPool = await getUnassignedLeads(NUM_AGENTS * WEEKLY_LEADS_PER_AGENT);
      } else {
        console.log('[worker] Airtable not configured — skipping weekly lead assignment');
        generatedPool = [];
      }


      // Get all agents dynamically and sort by priority (Resellers first, then Reps, then Cold Callers)
      let activeAgents = [];
      if (airtableReady()) {
        activeAgents = await listAgents().catch(() => []);
      }
      if (!activeAgents || !activeAgents.length) {
        activeAgents = [...AGENTS];
      }

      const rolePriority = {
        authorized_reseller: 1,
        independent_rep: 2,
        cold_caller: 3,
        agent: 4,
      };

      activeAgents.sort((a, b) => {
        const pA = rolePriority[a.role] || 99;
        const pB = rolePriority[b.role] || 99;
        return pA - pB;
      });

      console.log(`[worker] Total unassigned leads available: ${generatedPool.length}. Assigning to agents in priority order...`);
      
      // Assign WEEKLY_LEADS_PER_AGENT leads to each agent
      for (let i = 0; i < activeAgents.length; i++) {
        const agent = activeAgents[i];
        const agentLeads = generatedPool.slice(i * WEEKLY_LEADS_PER_AGENT, (i + 1) * WEEKLY_LEADS_PER_AGENT);
        
        if (agentLeads.length > 0) {
          if (airtableReady()) {
            await assignLeadsToAgent(agentLeads, agent.name);
          }
          console.log(`[worker] Assigned ${agentLeads.length} leads to ${agent.name} (${agent.role})`);
        }
      }

      await appendLog({
        task: 'Weekly leads assigned',
        target: `${WEEKLY_LEADS_PER_AGENT} leads each → ${AGENTS.length} agents`,
        status: 'sent'
      }).catch(() => {});
      
      console.log('[worker] Weekly leads assignment complete.');
    } catch (err) {
      console.error('[worker] Weekly lead generation failed:', err.message);
    }
  });

  // Weekly Lead Performance Report — Friday 5pm
  cron.schedule('0 17 * * 5', async () => {
    await generateWeeklyLeadReport().catch(console.error);
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

  // ─── Resume Distribution Crons ──────────────────────────────────────────────
  const resumeCron = process.env.PHILIPPINES_SHIFT_UTC || '0 20 * * *';
  cron.schedule(resumeCron, async () => {
    console.log('[Worker] ⏰ Shift start resume lead distribution starting...');
    await distributeResumeLeads().catch(err => {
      console.error('[Worker] Resume distribution error:', err.message);
    });
  });

  // Weekly Sunday midnight — clean old dedup entries
  cron.schedule('0 0 * * 0', async () => {
    console.log('[Worker] Weekly dedup cleanup running...');
    await cleanOldDedupEntries(90).catch(err => {
      console.error('[Worker] Dedup cleanup error:', err.message);
    });
  });

  // Morning resume distribution — 8:00 AM EST (= 1:00 PM UTC)
  cron.schedule(morningCron, async () => {
    console.log('[Worker] ⏰ Morning resume lead distribution starting...');
    await distributeResumeLeads().catch(err => {
      console.error('[Worker] Morning resume distribution error:', err.message);
    });
  });

  // Midday resume distribution — 12:00 PM EST (= 5:00 PM UTC)
  cron.schedule(middayCron, async () => {
    console.log('[Worker] ⏰ Midday resume lead distribution starting...');
    await distributeResumeLeads().catch(err => {
      console.error('[Worker] Midday resume distribution error:', err.message);
    });
  });

  console.log(`[worker] ✓ Resume distribution crons scheduled (Morning, Midday, & Shift ${resumeCron})`);
  console.log(`[worker]   Cities: ${process.env.RESUME_SEARCH_CITIES || 'newyork,newjersey,miami,houston,dallas,chicago,atlanta'}`);

  // 🚀 Startup distribution catch-up: ensures leads are assigned immediately on server startup/deploy
  setTimeout(async () => {
    console.log('[Worker] 🚀 Running startup lead distribution catch-up check...');
    try {
      await distributeDailyLeads('morning');
      await distributeResumeLeads();
      console.log('[Worker] ✓ Startup distribution catch-up complete.');
    } catch (err) {
      console.error('[Worker] Startup distribution catch-up error:', err.message);
    }
  }, 4000);

  // Poll every 60 seconds
  poll();
  setInterval(poll, 60_000);
}

// ─── Resume Lead Distribution ─────────────────────────────────────────────────

function getKeywordsForToday() {
  const allKeywords = RESUME_SEARCH_KEYWORDS;
  const batchSize   = 15;
  const dayOfYear   = Math.floor(
    (new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  );
  const startIndex = (dayOfYear * batchSize) % allKeywords.length;
  const batch      = [];

  for (let i = 0; i < batchSize; i++) {
    batch.push(allKeywords[(startIndex + i) % allKeywords.length]);
  }

  console.log(`[Worker] Today's keywords: ${batch.join(', ')}`);
  return batch;
}

async function createAgentNotification(agentEmail, agentName, leadCount, session) {
  const base = getBase();
  if (!base) return;

  try {
    await base('Notifications').create({
      RecipientEmail: agentEmail,
      Type:           'new_leads_assigned',
      Title:          `${leadCount} new resume leads assigned to you`,
      Message:        `Your ${session === 'morning' ? 'morning' : session === 'midday' ? 'midday' : 'daily'} recruiting leads are ready. You have ${leadCount} new candidate${leadCount !== 1 ? 's' : ''} to contact today. Open your Recruiting Pipeline tab to get started.`,
      IsRead:         false,
      CreatedAt:      new Date().toISOString(),
    });
    console.log(`[Notification] ✓ Created notification for ${agentName} — ${leadCount} leads`);
  } catch (err) {
    console.error(`[Notification] Failed to create for ${agentName}:`, err.message);
  }
}

export async function distributeResumeLeads() {
  const today = new Date().toISOString().split('T')[0];

  // Get all recruiting agents from Staff table (filtering out placeholder Agent 1, Agent 2, etc.)
  const rawAgents = await getRecruitingAgents();
  const agents = (rawAgents || []).filter(a => a.name && isRealAgentName(a.name));
  if (!agents || agents.length === 0) {
    console.error('[Worker] No recruiting agents found');
    return;
  }

  if (!process.env.APIFY_API_KEY) {
    console.log('[Worker] APIFY_API_KEY not set — using Craigslist Search API (CL-SAPI) fallback');
  }

  const needed     = agents.length * DAILY_RESUME_LEADS_PER_WCR;
  const fetchTarget = needed * 10; // fetch 10x buffer to survive dedup filtering

  console.log(`[Worker] Need ${needed} leads for ${agents.length} agents. Will fetch up to ${fetchTarget} raw results.`);

  // Load dedup registry
  let globalDedupeSet = await getGlobalResumeDeduplicationSet();
  console.log(`[Worker] Dedup registry: ${globalDedupeSet.size} URLs locked`);

  // Auto-clean old dedup locks if registry exceeds 500 entries
  if (globalDedupeSet.size > 500) {
    console.log(`[Worker] Dedup registry has ${globalDedupeSet.size} locked URLs — running auto-cleanup (keeping 3 days)...`);
    try {
      const cleaned = await cleanOldDedupEntries(3);
      if (cleaned > 0) {
        globalDedupeSet = await getGlobalResumeDeduplicationSet();
        console.log(`[Worker] Refreshed dedup registry: ${globalDedupeSet.size} URLs locked after cleanup`);
      }
    } catch (e) {
      console.warn('[Worker] Pre-scrape dedup cleanup warning:', e.message);
    }
  }

  // Search keywords to rotate through (15 daily)
  const todayKeywords = getKeywordsForToday();

  // Get today's cities from rotation
  const todayCities = getCitiesForToday();
  console.log(`[Worker] Today's cities: ${todayCities.map(c => c.label).join(', ')}`);

  let allFreshResumes = [];
  const seenUrls = new Set();

  // Loop cities AND keywords until we have enough
  async function performSearchPass() {
    outerLoop:
    for (const city of todayCities) {
      for (const keyword of todayKeywords) {
        if (allFreshResumes.length >= fetchTarget) break outerLoop;

        try {
          console.log(`[Worker] Fetching: "${keyword}" in ${city.label}...`);
          const results = await fetchCraigslistResumesWithFallback(city.slug, keyword, 100);

          let addedCount = 0;
          for (const r of results) {
            const url = normalizeResumeURL(r.link);

            // Skip if no valid URL
            if (!url || !url.startsWith('https://') || !url.includes('craigslist.org')) continue;

            // Skip if demo data
            if (isDemoLead(r)) {
              console.warn(`[Worker] Blocked demo lead: ${url}`);
              continue;
            }

            // Skip if already in dedup registry
            if (globalDedupeSet.has(url)) continue;

            // Skip if already seen in this run
            if (seenUrls.has(url)) continue;

            seenUrls.add(url);
            allFreshResumes.push({ ...r, link: url, market: city.label });
            addedCount++;
          }

          console.log(`[Worker] "${keyword}" in ${city.label}: ${results.length} raw → ${addedCount} fresh added (total: ${allFreshResumes.length})`);

          // Delay between requests
          await new Promise(r => setTimeout(r, 1000));

        } catch (err) {
          console.error(`[Worker] Failed "${keyword}" in ${city.label}:`, err.message);
        }
      }
    }
  }

  await performSearchPass();

  console.log(`[Worker] Total fresh real leads available: ${allFreshResumes.length}`);

  // If pool returned 0 fresh leads due to dedup lock, execute emergency dedup cleanup (1 day) and retry once
  if (allFreshResumes.length === 0 && globalDedupeSet.size > 0) {
    console.warn(`[Worker] 0 fresh leads found with ${globalDedupeSet.size} locked URLs — running emergency dedup cleanup (keeping 1 day)...`);
    try {
      const cleaned = await cleanOldDedupEntries(1);
      console.log(`[Worker] Emergency dedup cleanup removed ${cleaned} entries`);
      globalDedupeSet = await getGlobalResumeDeduplicationSet();
      await performSearchPass();
      console.log(`[Worker] Retry pass total fresh real leads available: ${allFreshResumes.length}`);
    } catch (e) {
      console.error('[Worker] Emergency dedup cleanup error:', e.message);
    }
  }

  // Check if we have enough
  if (allFreshResumes.length === 0) {
    console.warn('[Worker] No candidate resumes available in this cycle. Skipping assignment.');
    await appendLog({
      task:   'Resume lead distribution skipped',
      target: 'No new unassigned candidate resumes returned from Craigslist search pass. Will retry next cycle.',
      status: 'warning',
    });
    return;
  }

  if (allFreshResumes.length < needed) {
    console.warn(`[Worker] LOW POOL — only ${allFreshResumes.length} leads for ${needed} needed`);
    await appendLog({
      task:   'Resume distribution — low pool warning',
      target: `Only ${allFreshResumes.length} fresh leads available. ${needed} needed for ${agents.length} agents. Distributing what we have.`,
      status: 'alert',
    });
    // Continue with what we have — do NOT abort
  }

  // ROUND-ROBIN distribution
  const buckets = {};
  agents.forEach(a => { buckets[a.name] = []; });

  let pool = [...allFreshResumes];
  let i    = 0;

  while (pool.length > 0) {
    const agent = agents[i % agents.length];
    if (buckets[agent.name].length < DAILY_RESUME_LEADS_PER_WCR) {
      buckets[agent.name].push(pool.shift());
    }
    i++;
    if (agents.every(a => buckets[a.name].length >= DAILY_RESUME_LEADS_PER_WCR)) break;
  }

  // Save to Airtable + register in dedup
  for (const agent of agents) {
    const batch = buckets[agent.name];

    if (batch.length === 0) {
      await appendLog({
        task:   'Resume distribution — agent skipped',
        target: `${agent.name} received 0 leads — pool exhausted before reaching this agent`,
        status: 'alert',
      });
      console.warn(`[Worker] ${agent.name}: 0 leads — pool exhausted`);
      continue;
    }

    for (const resume of batch) {
      const url = normalizeResumeURL(resume.link);

      // Final demo check before saving
      if (isDemoLead(resume)) {
        console.error(`[Worker] BLOCKED demo lead at save time: ${url}`);
        continue;
      }

      await saveResumeLead({
        title:         resume.title,
        description:   resume.description,
        phone:         resume.phone || '',
        craigslistUrl: url,
        market:        resume.market,
        assignedTo:    agent.name,
        assignedDate:  today,
        status:        'New',
        source:        'apify',
      });

      await registerResumeAsAssigned(url, agent.name, today);
      globalDedupeSet.add(url);
    }

    // Only AFTER successful save — create notification
    if (batch.length > 0) {
      await createAgentNotification(
        agent.email,
        agent.name,
        batch.length,
        'daily'
      );
    }

    await appendLog({
      task:   'Real resume leads distributed',
      target: `${agent.name} → ${batch.length} real leads assigned`,
      status: 'ok',
    });

    console.log(`[Worker] ✓ ${agent.name}: ${batch.length} real leads assigned`);
  }

  console.log('[Worker] Distribution complete');
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
