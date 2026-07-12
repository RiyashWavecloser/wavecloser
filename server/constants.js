/**
 * server/constants.js
 *
 * Server-side mirror of src/data/constants.js.
 * Used by automationWorker.js and emailService.js.
 * [BRANCH] BOTH branches (main + worker-deploy)
 */

export const USER_TYPES = {
  COLD_CALLER: {
    id:           'COLD_CALLER',
    label:        'Cold Caller',
    short:        'Cold Caller',
    portal:       'agent',
    leadPriority: 3,
    color:        '#5B8DEF',
    earningModel: 'Commission per closed deal',
  },
  REP: {
    id:           'REP',
    label:        'Independent Rep',
    short:        'Indep Rep',
    portal:       'agent',
    leadPriority: 2,
    color:        '#D97A5E',
    earningModel: '$1,500–$3,000 bonus + 40% residuals',
  },
  RESELLER: {
    id:           'RESELLER',
    label:        'Authorized Reseller',
    short:        'Reseller',
    portal:       'agent',
    leadPriority: 1,
    color:        '#2D9B5E',
    earningModel: '$1,500–$3,000 bonus + 40% recurring + priority leads',
  },
  ISO: {
    id:           'ISO',
    label:        'ISO Investor (Done For You)',
    short:        'ISO Investor',
    portal:       'separate',
    leadPriority: 0,
    color:        '#C2547F',
    earningModel: 'Full done-for-you investment operation',
  },
  REFERRAL: {
    id:           'REFERRAL',
    label:        'Referral Partner',
    short:        'Referral',
    portal:       'separate',
    leadPriority: 0,
    color:        '#7B6FDB',
    earningModel: '$2,000 per closed restaurant',
  },
};

/**
 * Lead distribution priority — Resellers first, then Reps, then Cold Callers
 */
export const LEAD_DISTRIBUTION_ORDER = ['RESELLER', 'REP', 'COLD_CALLER'];

export const BENCHMARKS = {
  COLD_CALLER: { weeklyLeads: 10, monthlyQuota: 4,  closeRate: 0.30 },
  REP:         { weeklyLeads: 10, monthlyQuota: 4,  closeRate: 0.35 },
  RESELLER:    { weeklyLeads: 12, monthlyQuota: 5,  closeRate: 0.40 },
  ISO:         { weeklyLeads: 8,  monthlyQuota: 3,  closeRate: 0.50 },
  REFERRAL:    { weeklyLeads: 5,  monthlyQuota: 2,  closeRate: 0.40 },
};

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
  { id: 'agent-janina',   name: 'Janina',             email: 'janina@waveclosers.com',   role: 'cold_caller' },
  { id: 'agent-johnm',    name: 'John Mell Morillo',  email: 'johnm@waveclosers.com',    role: 'cold_caller' },
  { id: 'agent-giana',    name: 'Gian Ericka Arcega', email: 'giana@waveclosers.com',    role: 'cold_caller' },
  { id: 'agent-juliusb',  name: 'Julius Bacarra',     email: 'juliusb@waveclosers.com',  role: 'cold_caller' },
  { id: 'agent-karenm',   name: 'Karen Monito',       email: 'karenm@waveclosers.com',   role: 'cold_caller' },
  { id: 'agent-jemelyna', name: 'Jemelyn Andaya',     email: 'jemelyna@waveclosers.com', role: 'cold_caller' },
  { id: 'agent-manilynp', name: 'Manilyn Parabas',    email: 'manilynp@waveclosers.com', role: 'cold_caller' },
  { id: 'agent-melaniea', name: 'Melanie Aranton',    email: 'melaniea@waveclosers.com', role: 'cold_caller' },
  { id: 'agent-aprils',   name: 'April Joy Saguid',   email: 'aprils@waveclosers.com',   role: 'cold_caller' },
];

export const AGENT_SUPERVISOR_EMAIL = process.env.AGENT_SUPERVISOR_EMAIL || 'agentsservices@waveclosers.com';

export const BUSINESS_TYPES = [
  'restaurant', 'beauty_salon', 'nail_salon', 'deli', 'massage', 'small_retail',
];

export const LEAD_STATUSES = [
  'New', 'Assigned', 'Called', 'Interested', 'NotInterested', 'Callback', 'NoAnswer',
];
