/**
 * server/emailService.js
 *
 * Resend integration + all 5 email templates.
 *
 * If RESEND_API_KEY is not set, all sends fall back to console.log — nothing crashes.
 * If EMAIL_FROM is not set, defaults to ops@waveclosers.com (placeholder).
 *
 * PENDING from William (items 3–6):
 *   CONTRACT_TEMPLATE_URL → env: CONTRACT_TEMPLATE_URL
 *   LEARNING_PLATFORM_URL → env: LEARNING_PLATFORM_URL
 *   THURSDAY_TRAINING_TIME → env: THURSDAY_TRAINING_TIME
 *   THURSDAY_TRAINING_LINK → env: THURSDAY_TRAINING_LINK
 */

import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM          = process.env.EMAIL_FROM            || 'riyashpatel3@gmail.com';
const RIYASH_EMAIL  = process.env.RIYASH_EMAIL          || 'riyashpatel3@gmail.com';
const WILLIAM_EMAIL = process.env.WILLIAM_EMAIL         || 'william@waveclosers.com';
const QUALIFIER_EMAIL = process.env.QUALIFIER_EMAIL     || 'qualifier@waveclosers.com';
const RECRUITER_EMAIL = process.env.RECRUITER_EMAIL     || 'recruiter@waveclosers.com';

// ─── Pending placeholder values ───────────────────────────────────────────────
const CONTRACT_URL    = process.env.CONTRACT_TEMPLATE_URL  || 'https://waveclosers.com/contract (PENDING)';
const LEARNING_URL    = process.env.LEARNING_PLATFORM_URL  || 'https://learn.waveclosers.com (PENDING)';
const TRAINING_TIME   = process.env.THURSDAY_TRAINING_TIME || 'Thursdays at 2:00 PM ET (PENDING)';
const TRAINING_LINK   = process.env.THURSDAY_TRAINING_LINK || 'https://zoom.us/j/waveclosers (PENDING)';

const TYPE_LABELS = {
  REFERRAL: 'Referral Partner',
  REP:      'Independent Rep',
  RESELLER: 'Authorized Reseller',
  ISO:      'DONE FOR YOU — ISO Investor',
};

const EARNING_MODELS = {
  REFERRAL: '$2,000 per closed restaurant',
  REP:      '$1,500–$3,000 bonus + 40% residuals',
  RESELLER: '$1,500–$3,000 bonus + 40% recurring revenue + qualified leads',
  ISO:      'Done-for-you investment model — we handle everything',
};

// ─── Core send function ───────────────────────────────────────────────────────

/**
 * Send an email via Resend, or console.log it if no API key is set.
 * @param {{ to: string|string[], subject: string, text: string }} opts
 */
export async function sendEmail({ to, subject, text }) {
  const recipients = Array.isArray(to) ? to : [to];
  if (!resend) {
    console.log('\n[emailService] 📧 DEMO MODE — email not sent:');
    console.log(`  To:      ${recipients.join(', ')}`);
    console.log(`  From:    ${FROM}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body:\n${text.split('\n').map(l => '    ' + l).join('\n')}\n`);
    return { id: `demo-${Date.now()}` };
  }

  // Resend sandbox validation: free accounts can only send to the registered owner (riyash@waveclosers.com)
  let finalRecipients = recipients;
  if (FROM === 'onboarding@resend.dev') {
    finalRecipients = ['riyash@waveclosers.com'];
    console.log(`[emailService] 🧪 Sandbox Redirect: Routing recipients [${recipients.join(', ')}] to verified owner [riyash@waveclosers.com]`);
  }

  const { data, error } = await resend.emails.send({
    from: FROM,
    to:   finalRecipients,
    subject,
    text,
  });
  if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
  return data;
}

// ─── Template 1 — Welcome email (personalised by type) ───────────────────────

export function buildWelcomeEmail(user) {
  const label   = TYPE_LABELS[user.type] || user.type;
  const earning = EARNING_MODELS[user.type] || '';
  const subject = `Welcome to Wave Closers — you're all set, ${user.name.split(' ')[0]}!`;
  const text = `Hi ${user.name},

Welcome to Wave Closers! You've been set up as a ${label}.

Your earning model: ${earning}

Your support team:
- Leads sent to your landing page by Sergey (Marketer)
- Thursday sales training run by Matt (${TRAINING_TIME})
- Onboarding questions: contact CX Team (Customer Experience)

Your dashboard: https://waveclosers.com/user/dashboard

Let's build something great.

Riyash
Wave Closers Operations`;
  return { to: user.email, subject, text };
}

// ─── Template 2 — Contract dispatch (to Qualifier / CX) ──────────────────────

export function buildContractEmail(user) {
  const label   = TYPE_LABELS[user.type] || user.type;
  const subject = `[Action required] New closed user — ${user.name} (${label})`;
  const text = `Hi,

${user.name} has been closed and is ready for CX onboarding.

User: ${user.name}
Type: ${label}
Market: ${user.market || '—'}
Email: ${user.email || 'not on file'}

Your 4 steps (scope §5 Step 4):
1. Onboard to Wave Closers platform
2. Send the contract: ${CONTRACT_URL}
3. Set up online learning access
4. Invite to Thursday sales training (Matt's session — ${TRAINING_TIME})

Please complete within 3 business days.

Riyash (PM)
Wave Closers Operations`;
  return { to: RIYASH_EMAIL, subject, text }; // CX receives via Riyash's routing
}

// ─── Template 3 — Lead shortfall alert (Sergey via Riyash) ───────────────────

export function buildLeadShortfallEmail(user, actual, target) {
  const label   = TYPE_LABELS[user.type] || user.type;
  const subject = `[Alert] Lead shortfall — ${user.name} (${actual}/${target} leads this week)`;
  const text = `Hi Sergey,

${user.name} (${label}, ${user.market || '—'}) has only received ${actual} lead(s) this week against a target of ${target}.

Please check their landing page and ensure leads are flowing.

Wave Closers Automation`;
  return { to: RIYASH_EMAIL, subject, text }; // Riyash routes to Sergey
}

// ─── Template 4 — Weekly performance report ──────────────────────────────────

export function buildWeeklyReportEmail(users, stats, dateStr) {
  const atRiskList = users
    .filter(u => ['amber', 'red'].includes(u._status))
    .map(u => `  - ${u.name} (${u.type}, ${u.market || '—'}): ${u.leadsThisWeek} leads this week`)
    .join('\n');

  const subject = `Wave Closers — Weekly Performance Report (${dateStr})`;
  const text = `WAVE CLOSERS WEEKLY SUMMARY
${'─'.repeat(30)}
Total users:    ${stats.total}
On track:       ${stats.onTrack}
At risk:        ${stats.atRisk}
Below target:   ${stats.belowTarget}
Onboarding:     ${stats.onboarding}

Total leads this week:   ${stats.totalLeads}
Total deals this month:  ${stats.totalDeals}

${atRiskList ? `Users needing attention:\n${atRiskList}` : 'All users on track this week. ✓'}

Dashboard: https://ops.waveclosers.com

Generated by Claude — Wave Closers Operations Console
${new Date().toISOString()}`;
  return { to: [RIYASH_EMAIL, WILLIAM_EMAIL], subject, text };
}

// ─── Template 5 — Quota miss escalation ──────────────────────────────────────

export function buildQuotaMissEmail(user, actual, quota) {
  const label  = TYPE_LABELS[user.type] || user.type;
  const target = (user._benchmark?.weeklyLeads) || '?';
  const subject = `[Escalation] Quota miss — ${user.name} (${actual}/${quota} deals this month)`;
  const text = `Hi Riyash,

${user.name} (${label}, ${user.market || '—'}) closed ${actual} deal(s) this month against a quota of ${quota}.

Recommended actions:
- Review lead volume (${user.leadsThisWeek}/week vs target ${target})
- Check if Thursday training is attended (Matt's session — ${TRAINING_TIME})
- Consider a 1:1 check-in

Escalate to William if unresolved in 48 hours.

Wave Closers Automation`;
  return { to: RIYASH_EMAIL, subject, text };
}

// ─── Learning enrollment (stub — pending open item #5) ───────────────────────

export function buildLearningEnrollmentEmail(user) {
  const subject = `Your Wave Closers learning access is ready, ${user.name.split(' ')[0]}!`;
  const text = `Hi ${user.name},

Your online learning access is now set up.

Access your training portal here: ${LEARNING_URL}

Complete your onboarding modules before your first Thursday session.

CX Team
Wave Closers Customer Experience`;
  return { to: user.email, subject, text };
}

// ─── Training invite (stub — pending open item #6) ───────────────────────────

export function buildTrainingInviteEmail(user) {
  const subject = `You're invited: Wave Closers Sales Training — ${TRAINING_TIME}`;
  const text = `Hi ${user.name},

You're now invited to our weekly sales training.

When: ${TRAINING_TIME}
Join here: ${TRAINING_LINK}

Hosted by Matt (Sales Trainer). Attendance strongly recommended.

CX Team
Wave Closers Customer Experience`;
  return { to: user.email, subject, text };
}

export function buildResetCodeEmail(email, code) {
  const subject = `Wave Closers — Password Reset Code: ${code}`;
  const text = `Hi,

You requested a password reset for your Wave Closers Operations Console account.

Your 6-digit verification code is: ${code}

This code is valid for 15 minutes. If you did not request this reset, you can safely ignore this email.

Wave Closers Security`;
  return { to: email, subject, text };
}

// ─── Template 6 — Qualifier auto-notification (Interested lead) ──────────────

export function buildQualifierLeadEmail(lead) {
  const subject = `New Interested Lead — ${lead.businessName}, ${lead.market || ''}`;
  const text = `Hi,

A new interested lead has come in from the cold-calling team.

Business:    ${lead.businessName}
Type:        ${lead.type || ''}
Address:     ${lead.address || ''}
Phone:       ${lead.phone || ''}
Score:       ${lead.score}/100
Why:         ${lead.scoreReason || ''}
Called by:   ${lead.assignedAgent || ''}
Agent notes: ${lead.agentNotes || 'N/A'}

Please qualify this lead and identify their user type.

Log in to take action: https://ops.waveclosers.com

Riyash
Wave Closers Operations`;
  return { to: QUALIFIER_EMAIL, subject, text };
}

// ─── Template 7 — Partner lead assignment ─────────────────────────────────────

export function buildPartnerLeadEmail(lead, partner) {
  const subject = `New lead assigned to you — ${lead.businessName}, ${lead.market || ''}`;
  const text = `Hi ${(partner.name || '').split(' ')[0]},

A new lead has been assigned to you.

Business: ${lead.businessName}
Address:  ${lead.address || ''}
Phone:    ${lead.phone || ''}
Type:     ${lead.type || ''}
Score:    ${lead.score}/100

Log in to follow up: https://ops.waveclosers.com

Riyash
Wave Closers Operations`;
  return { to: partner.email || RIYASH_EMAIL, subject, text };
}

// ─── Template 8 — Recruiter routing (Reseller / ISO qualified lead) ───────────

export function buildRecruiterLeadEmail(lead) {
  const subject = `New lead for you to close — ${lead.businessName}, ${lead.market || ''}`;
  const text = `Hi,

A new qualified lead has been routed to you.

Business:          ${lead.businessName}
Type:              ${lead.qualifiedUserType || ''}
Address:           ${lead.address || ''}
Phone:             ${lead.phone || ''}
Score:             ${lead.score}/100
Qualifier's notes: "${lead.qualifierNotes || 'N/A'}"

Please reach out and close this deal.

Log in: https://ops.waveclosers.com

Riyash
Wave Closers Operations`;
  return { to: RECRUITER_EMAIL, subject, text };
}

export { RIYASH_EMAIL, WILLIAM_EMAIL, QUALIFIER_EMAIL, RECRUITER_EMAIL, FROM };

export function isConfigured() { return !!process.env.RESEND_API_KEY; }

