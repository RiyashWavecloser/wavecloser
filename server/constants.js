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

// ─── Resume Lead Distribution (Workflow C) ────────────────────────────────────

/**
 * Number of Craigslist resume leads assigned to each recruiting agent per day.
 * Override with DAILY_RESUME_LEADS_PER_WCR env var.
 */
export const DAILY_RESUME_LEADS_PER_WCR = Number(process.env.DAILY_RESUME_LEADS_PER_WCR || 20);

/**
 * Default Craigslist resume search keywords.
 * Override with RESUME_SEARCH_KEYWORDS env var.
 */
export const RESUME_SEARCH_KEYWORDS = process.env.RESUME_SEARCH_KEYWORDS || 'sales';

/**
 * Multi-keyword list for automatic Craigslist resume volume generation.
 * Pulls across 10 targeted sales & recruiting categories in a single run.
 */
export const RESUME_SEARCH_KEYWORDS_LIST = [
  'sales',
  'commission sales',
  'cold calling',
  'telemarketing',
  'customer service',
  'inside sales',
  'outside sales',
  'account executive',
  'business development',
  'appointment setter',
];

/**
 * Staff roles that receive daily resume leads.
 * Any active staff account with one of these roles gets 20 leads/day.
 */
export const RECRUITING_ROLES = ['wave_closer_recruiter', 'recruiter'];

/**
 * All supported Craigslist city slugs — used to populate city pickers in the UI.
 * Cities to SEARCH are chosen by the admin/task-assigner, not hardcoded.
 * For the automated daily cron, set RESUME_SEARCH_CITIES env var (comma-separated slugs).
 */
export const CITY_SUBDOMAINS = {
  newyork:        'New York (Metro)',
  newjersey:      'New Jersey',
  hartford:       'Connecticut / Hartford',
  philadelphia:   'Philadelphia, PA',
  boston:         'Boston, MA',
  miami:          'Miami / South FL',
  orlando:        'Orlando, FL',
  chicago:        'Chicago, IL',
  losangeles:     'Los Angeles, CA',
  houston:        'Houston, TX',
  dallas:         'Dallas, TX',
  atlanta:        'Atlanta, GA',
  phoenix:        'Phoenix, AZ',
  washingtondc:   'Washington, D.C.',
  seattle:        'Seattle, WA',
  brooklyn:       'Brooklyn, NY',
  queens:         'Queens, NY',
  bronx:          'Bronx, NY',
  statenisland:   'Staten Island, NY',
  newark:         'Newark, NJ',
  jerseycity:     'Jersey City, NJ',
  bridgeport:     'Bridgeport, CT',
  stamford:       'Stamford, CT',
  newhaven:       'Connecticut / New Haven',
};

export const RECRUITING_AGENTS = [
  { name: 'Janina',    email: 'janina@waveclosers.com'   },
  { name: 'John M',    email: 'johnm@waveclosers.com'    },
  { name: 'Giana',     email: 'giana@waveclosers.com'    },
  { name: 'Julius B',  email: 'juliusb@waveclosers.com'  },
  { name: 'Karen M',   email: 'karenm@waveclosers.com'   },
  { name: 'Jemelyn',   email: 'jemelyna@waveclosers.com' },
  { name: 'Manilyn',   email: 'manilynp@waveclosers.com' },
  { name: 'Melanie',   email: 'melaniea@waveclosers.com' },
  { name: 'April S',   email: 'aprils@waveclosers.com'   },
];

export const CRAIGSLIST_CITIES = [
  { label: 'New York',             value: 'newyork' },
  { label: 'New Jersey',           value: 'newjersey' },
  { label: 'Connecticut',          value: 'newhaven' },
  { label: 'Brooklyn',             value: 'brooklyn' },
  { label: 'Queens',               value: 'queens' },
  { label: 'Bronx',                value: 'bronx' },
  { label: 'Staten Island',        value: 'statenisland' },
  { label: 'Newark NJ',            value: 'newark' },
  { label: 'Jersey City NJ',       value: 'jerseycity' },
  { label: 'Bridgeport CT',        value: 'bridgeport' },
  { label: 'Hartford CT',          value: 'hartford' },
  { label: 'Stamford CT',          value: 'stamford' },
  { label: 'Houston, TX',          value: 'houston' },
  { label: 'Dallas–Fort Worth, TX', value: 'dallas' },
  { label: 'Atlanta, GA',          value: 'atlanta' },
  { label: 'Miami, FL',            value: 'miami' },
  { label: 'Boston, MA',           value: 'boston' },
  { label: 'Chicago, IL',          value: 'chicago' },
  { label: 'New York City, NY',    value: 'newyork' },
  { label: 'Los Angeles, CA',      value: 'losangeles' },
  { label: 'Washington, D.C.',     value: 'washingtondc' },
  { label: 'Seattle, WA',          value: 'seattle' },
];


