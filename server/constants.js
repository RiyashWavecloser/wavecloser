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
export const WEEKLY_LEADS_PER_AGENT = Number(process.env.WEEKLY_LEADS_PER_AGENT || 500);
export const LEAD_GENERATION_MARKETS = process.env.LEAD_GENERATION_MARKETS || 'Miami FL,Houston TX,Atlanta GA,Chicago IL,Dallas TX';
export const NUM_AGENTS            = Number(process.env.NUM_AGENTS || 9);

/**
 * Real cold-calling agent accounts (confirmed June 2026).
 * Janina is an agent — NOT recruiter (corrected from earlier placeholder).
 * Aureliab is the Recruiter / Franchise Sales person (separate staff account).
 */
export const AGENTS = [
  { id: 'agent-janina',   name: 'Janina',             email: 'janina@waveclosers.com'   },
  { id: 'agent-johnm',    name: 'John Mell Morillo',  email: 'johnm@waveclosers.com'    },
  { id: 'agent-giana',    name: 'Gian Ericka Arcega', email: 'giana@waveclosers.com'    },
  { id: 'agent-juliusb',  name: 'Julius Bacarra',     email: 'juliusb@waveclosers.com'  },
  { id: 'agent-karenm',   name: 'Karen Monito',       email: 'karenm@waveclosers.com'   },
  { id: 'agent-jemelyna', name: 'Jemelyn Andaya',     email: 'jemelyna@waveclosers.com' },
  { id: 'agent-manilynp', name: 'Manilyn Parabas',    email: 'manilynp@waveclosers.com' },
  { id: 'agent-melaniea', name: 'Melanie Aranton',    email: 'melaniea@waveclosers.com' },
  { id: 'agent-aprils',   name: 'April Joy Saguid',   email: 'aprils@waveclosers.com'   },
];

// Supervisor — sees all agents' leads
export const AGENT_SUPERVISOR_EMAIL = process.env.AGENT_SUPERVISOR_EMAIL || 'agentsservices@waveclosers.com';

export const BUSINESS_TYPES = [
  'restaurant', 'beauty_salon', 'nail_salon', 'deli', 'massage', 'small_retail',
];

export const LEAD_STATUSES = [
  'New', 'Assigned', 'Called', 'Interested', 'NotInterested', 'Callback', 'NoAnswer',
];


