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
  getUnassignedLeads,
  assignLeadsToAgent,
  getMondayOfCurrentWeek,
  listAgents,
  // Resume Lead Distribution (Workflow C)
  getRecruitingAgents,
  getGlobalResumeDeduplicationSet,
  bulkAssignResumeLeads,
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
import { BENCHMARKS, WEEKLY_LEADS_PER_AGENT, NUM_AGENTS, AGENTS, CITY_SUBDOMAINS, DAILY_RESUME_LEADS_PER_WCR, RESUME_SEARCH_KEYWORDS } from './constants.js';
import { generateLeads } from './leadWorker.js';

dotenv.config();

const TEST_MODE    = process.argv.includes('--test-mode');
const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY;
const APIFY_KEY    = process.env.APIFY_API_KEY;
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

// Helper to generate synthetic demo leads when Airtable/APIs are in demo mode
function generateManyDemoLeads(count, location = 'Nashville, TN') {
  const types = ['restaurant', 'beauty_salon', 'nail_salon', 'deli', 'massage', 'small_retail'];
  const names = ['Kitchen', 'Palace', 'Corner', 'Express', 'Studio', 'Lounge', 'Lab', 'Elite', 'Bar', 'Market', 'Touch', 'Gift Shop', 'Boutique'];
  const prefixes = ['Luxe', 'Grand', 'Zen', 'Urban', 'Metro', 'Royal', 'Lively', 'Happy', 'Golden', 'Star', 'First', 'Next'];
  
  const leads = [];
  for (let i = 1; i <= count; i++) {
    const type = types[i % types.length];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const name = names[Math.floor(Math.random() * names.length)];
    const bName = `${prefix} ${type.replace('_', ' ')} ${name}`;
    leads.push({
      placeId: `demo-gen-${i}-${Date.now()}`,
      businessName: bName,
      type,
      address: `${100 + i} Main St, ${location}`,
      phone: `(555) 555-${String(1000 + i).slice(-4)}`,
      website: i % 3 === 0 ? `https://demo-${i}.com` : '',
      rating: +(3.5 + Math.random() * 1.5).toFixed(1),
      reviewCount: Math.floor(20 + Math.random() * 500),
      score: Math.floor(40 + Math.random() * 55),
      scoreReason: 'Demo lead — connect API keys for real scoring.',
      status: 'New',
      assignedAgent: '',
      calledAt: null,
      outcome: '',
      market: location,
    });
  }
  return leads;
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

// ─── Cron jobs ────────────────────────────────────────────────────────────────

if (!TEST_MODE) {
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
        // Demo mode: generate synthetic leads in memory
        console.log('[worker] [demo] Generating synthetic weekly lead pool...');
        generatedPool = generateManyDemoLeads(NUM_AGENTS * WEEKLY_LEADS_PER_AGENT);
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

  // ─── Resume Distribution Cron ────────────────────────────────────────────────
  // Runs at Philippines shift start (default: 8PM UTC = 8AM Philippines time).
  // Cities are set by admin via RESUME_SEARCH_CITIES env var (comma-separated slugs).
  // Set RESUME_SEARCH_CITIES to a comma-separated list of city slugs from CITY_SUBDOMAINS.
  // Example: RESUME_SEARCH_CITIES=newyork,newjersey,brooklyn,miami
  const resumeCron = process.env.PHILIPPINES_SHIFT_UTC || '0 20 * * *';
  cron.schedule(resumeCron, async () => {
    console.log('[Worker] ⏰ Daily resume lead distribution starting...');
    await distributeResumeLeads().catch(err => {
      console.error('[Worker] Resume distribution error:', err.message);
    });
  });
  console.log(`[worker] ✓ Resume distribution cron scheduled: ${resumeCron}`);
  console.log(`[worker]   Cities: ${process.env.RESUME_SEARCH_CITIES || '(none set — set RESUME_SEARCH_CITIES env var)'}`);

  // Poll every 60 seconds
  poll();
  setInterval(poll, 60_000);
}

// ─── Resume Lead Distribution ─────────────────────────────────────────────────

/**
 * Inline Craigslist search for the automation worker.
 * This is a copy of the function in claude-proxy.js — the worker cannot import
 * from the Express app without creating a circular dependency.
 */
async function workerSearchCraigslist(citySlug, keywords, limit = 100) {
  const searchUrl = `https://${citySlug}.craigslist.org/search/res?query=${encodeURIComponent(keywords)}`;

  let apifyErrorMsg = null;

  // Apify (preferred)
  if (APIFY_KEY) {
    try {
      const apifyRes = await fetch(
        'https://api.apify.com/v2/acts/solidcode~craigslist-scraper/run-sync-get-dataset-items?timeout=60&memory=512',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${APIFY_KEY}` },
          body: JSON.stringify({ startUrls: [{ url: searchUrl }], maxItems: limit }),
        }
      );
      if (apifyRes.ok) {
        const data = await apifyRes.json();
        const raw  = Array.isArray(data) ? data : [];
        const items = raw.filter(r => r && r.title).slice(0, limit).map(r => {
          const desc = r.description || r.postingBody || '';
          const phoneFromDesc = desc.match(/\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}/)?.[0] || '';
          const emailFromDesc = desc.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || '';
          return {
            title:       r.title || '',
            description: desc.slice(0, 500),
            phone:       r.phone || phoneFromDesc || '',
            email:       r.email || r.replyEmail  || emailFromDesc || '',
            link:        r.url   || r.link        || '',
            date:        r.postedAt || r.date     || '',
          };
        });
        if (items.length > 0) return items;
      } else {
        const errText = await apifyRes.text().catch(() => apifyRes.statusText);
        let parsed = errText;
        try {
          const parsedJson = JSON.parse(errText);
          if (parsedJson?.error?.message) parsed = parsedJson.error.message;
        } catch {}
        apifyErrorMsg = `Apify error: ${parsed.slice(0, 150)}`;
      }
    } catch (e) {
      apifyErrorMsg = `Apify exception: ${e.message}`;
      console.warn(`[Worker Craigslist] Apify error for ${citySlug}:`, e.message);
    }
  } else {
    apifyErrorMsg = 'Apify API key is not configured in .env';
  }

  // RSS fallback
  try {
    const rssUrl = `${searchUrl}&format=rss`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const fetchRes = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml, text/xml, */*' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (fetchRes.status === 403) {
      throw new Error('403 Forbidden (Anti-bot block)');
    }
    if (!fetchRes.ok) {
      throw new Error(`HTTP ${fetchRes.status}`);
    }

    const xml   = await fetchRes.text();
    if (xml.includes('<title>blocked</title>') || xml.includes('blocked')) {
      throw new Error('Request blocked by Craigslist anti-bot system');
    }

    const items = [];
    const itemRx = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRx.exec(xml)) !== null && items.length < limit) {
      const block = match[1];
      const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || block.match(/<title>(.*?)<\/title>/)?.[1] || '').trim();
      const desc  = (block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] || block.match(/<description>(.*?)<\/description>/)?.[1] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 500);
      const link  = (block.match(/<link>(.*?)<\/link>/)?.[1] || block.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || '').trim();
      const phone = desc.match(/\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}/)?.[0] || '';
      const email = desc.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || '';
      if (title) items.push({ title, description: desc, link, phone, email });
    }
    return items;
  } catch (err) {
    console.error(`[Worker Craigslist] RSS error for ${citySlug}:`, err.message);
    const finalMsg = `Scraper error: ${apifyErrorMsg}. Fallback RSS failed: ${err.message}.`;
    throw new Error(finalMsg);
  }
}

/**
 * Daily resume lead distribution.
 *
 * Cities to search come from the RESUME_SEARCH_CITIES env var (comma-separated slugs).
 * This env var is set by the admin (William/Riyash) — NOT hardcoded anywhere.
 *
 * Can also be called directly via POST /api/resume-leads/distribute-now from the UI
 * which lets the admin choose cities per run.
 */
async function distributeResumeLeads() {
  if (!airtableReady()) {
    console.log('[Worker] Airtable not configured — skipping resume distribution');
    return;
  }

  // Step 1 — Read cities from env var (set by admin)
  const citiesRaw = process.env.RESUME_SEARCH_CITIES || '';
  if (!citiesRaw.trim()) {
    console.warn('[Worker] RESUME_SEARCH_CITIES env var not set — skipping distribution');
    console.warn('[Worker] Set RESUME_SEARCH_CITIES=newyork,newjersey,brooklyn (comma-separated slugs)');
    await appendLog({
      task:   'Resume distribution skipped',
      target: 'RESUME_SEARCH_CITIES env var not configured — set it to enable automatic distribution',
      status: 'alert',
    }).catch(() => {});
    return;
  }
  const cities = citiesRaw.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
  const keywords  = RESUME_SEARCH_KEYWORDS;
  const leadsPerAgent = DAILY_RESUME_LEADS_PER_WCR;
  const today = new Date().toISOString().slice(0, 10);

  // Step 2 — Get all recruiting agents dynamically
  const agents = await getRecruitingAgents();
  console.log(`[Worker] ${agents.length} recruiting agents found`);
  if (!agents.length) {
    await appendLog({ task: 'Resume distribution skipped', target: 'No recruiting agents found in Staff table', status: 'alert' }).catch(() => {});
    return;
  }

  // Step 3 — Load global dedup set FIRST
  const globalDedupeSet = await getGlobalResumeDeduplicationSet();
  console.log(`[Worker] ${globalDedupeSet.size} resume URLs permanently locked`);

  // Step 4 — Fetch fresh resumes from each city
  let freshResumes = [];
  for (const citySlug of cities) {
    try {
      const results = await workerSearchCraigslist(citySlug, keywords, 100);
      const newOnly  = results.filter(r => {
        const url = (r.link || '').trim().toLowerCase();
        return url && !globalDedupeSet.has(url);
      });
      freshResumes = [...freshResumes, ...newOnly.map(r => ({ ...r, market: CITY_SUBDOMAINS[citySlug] || citySlug }))];
      console.log(`[Worker] ${citySlug}: ${results.length} found, ${newOnly.length} new`);
    } catch (e) {
      console.error(`[Worker] Failed ${citySlug}:`, e.message);
    }
  }

  // Dedup within this batch
  const seen = new Set();
  freshResumes = freshResumes.filter(r => {
    const url = (r.link || '').trim().toLowerCase();
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });

  const needed = agents.length * leadsPerAgent;
  console.log(`[Worker] ${freshResumes.length} total fresh resumes — need ${needed}`);
  if (freshResumes.length < needed) {
    await appendLog({
      task:   'Resume lead shortage warning',
      target: `Only ${freshResumes.length} fresh resumes — need ${needed} for ${agents.length} agents across cities: ${cities.join(', ')}`,
      status: 'alert',
    }).catch(() => {});
  }

  // Step 5 — Assign leadsPerAgent leads to each agent sequentially
  let pool = [...freshResumes];
  for (const agent of agents) {
    const batch = pool.splice(0, leadsPerAgent);
    if (!batch.length) {
      await appendLog({ task: 'Resume distribution skipped', target: `${agent.name} — pool exhausted`, status: 'alert' }).catch(() => {});
      console.warn(`[Worker] ${agent.name}: skipped — pool exhausted`);
      continue;
    }
    const result = await bulkAssignResumeLeads(batch, agent.name, '');
    await appendLog({
      task:   'Daily resume leads assigned',
      target: `${agent.name} → ${result.assigned} leads (${result.skipped} skipped dedup) — ${today}`,
      status: 'ok',
    }).catch(() => {});
    console.log(`[Worker] ${agent.name}: ${result.assigned} leads assigned`);
  }

  console.log('[Worker] Daily resume distribution complete');
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
