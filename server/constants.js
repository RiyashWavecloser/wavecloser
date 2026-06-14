/**
 * server/constants.js
 *
 * Server-side mirror of src/data/constants.js.
 * Used by automationWorker.js and emailService.js.
 *
 * When William confirms open items, update BENCHMARKS here AND in
 * src/data/constants.js — both files should stay in sync.
 */

// ─── Placeholder benchmarks (confirmed by William once open items are resolved) ──
export const BENCHMARKS = {
  REFERRAL: { weeklyLeads: 5,  monthlyQuota: 2, closeRate: 0.40 },
  REP:      { weeklyLeads: 10, monthlyQuota: 4, closeRate: 0.35 },
  RESELLER: { weeklyLeads: 12, monthlyQuota: 5, closeRate: 0.40 },
  ISO:      { weeklyLeads: 8,  monthlyQuota: 3, closeRate: 0.50 },
};

export const USER_TYPE_LABELS = {
  REFERRAL: 'Referral Partner',
  REP:      'Independent Rep',
  RESELLER: 'Authorized Reseller',
  ISO:      'DONE FOR YOU — ISO Investor',
};

export const EARNING_MODELS = {
  REFERRAL: '$2,000 per closed restaurant',
  REP:      '$1,500–$3,000 bonus + 40% residuals',
  RESELLER: '$1,500–$3,000 bonus + 40% recurring revenue + qualified leads',
  ISO:      'Done-for-you investment model — we handle everything',
};

// ─── Module 6 — Lead generation constants ─────────────────────────────────────

export const DAILY_LEADS_PER_AGENT = Number(process.env.DAILY_LEADS_PER_AGENT || 100);
export const NUM_AGENTS            = Number(process.env.NUM_AGENTS || 10);

export const BUSINESS_TYPES = [
  'restaurant', 'beauty_salon', 'nail_salon', 'deli', 'massage', 'small_retail',
];

export const LEAD_STATUSES = [
  'New', 'Assigned', 'Called', 'Interested', 'NotInterested', 'Callback', 'NoAnswer',
];

