/**
 * Wave Closers — system constants
 * Mirrors the approved Project Scope v2.2 with real team assignments.
 */

export const USER_TYPES = {
  REFERRAL: {
    id: 'REFERRAL',
    label: 'Referral Partner',
    short: 'Referral',
    route: 'CX',
    color: '#5B8DEF',
    earningModel: '$2,000 per closed restaurant',
    link: 'waveclosers.com/register',
  },
  REP: {
    id: 'REP',
    label: 'Independent Rep',
    short: 'Indep Rep',
    route: 'CX',
    color: '#7B6FDB',
    earningModel: '$1,500–$3,000 bonus + 40% residuals',
    link: 'fairlyeven.com/Home/Jobs',
  },
  RESELLER: {
    id: 'RESELLER',
    label: 'Authorized Reseller',
    short: 'Reseller',
    route: 'RECRUITER',
    color: '#D97A5E',
    earningModel: '$1,500–$3,000 bonus + 40% recurring + qualified leads',
    link: 'fairlyeven.com/SellerProgram',
  },
  ISO: {
    id: 'ISO',
    label: 'DONE FOR YOU — ISO Investor',
    short: 'ISO Investor',
    route: 'RECRUITER',
    color: '#C2547F',
    earningModel: 'Investment-track partner; done-for-you operation',
    link: '',
  },
};

/**
 * Placeholder benchmarks — to be confirmed with William (scope §12).
 */
export const BENCHMARKS = {
  REFERRAL: { weeklyLeads: 5,  monthlyQuota: 2, closeRate: 0.40 },
  REP:      { weeklyLeads: 10, monthlyQuota: 4, closeRate: 0.35 },
  RESELLER: { weeklyLeads: 12, monthlyQuota: 5, closeRate: 0.40 },
  ISO:      { weeklyLeads: 8,  monthlyQuota: 3, closeRate: 0.50 },
};

/**
 * The 6-step onboarding flow (scope §5) with real team assignments.
 */
export const ONBOARDING_STAGES = [
  { id: 1, label: 'Lead generated',          owner: 'William'   },
  { id: 2, label: 'Qualified',               owner: 'Mildred (Appointment Setter)' },
  { id: 3, label: 'Routed',                  owner: 'Mildred → Janina or CX' },
  { id: 4, label: 'Onboarded to platform',   owner: 'Mildred (CX)' },
  { id: 5, label: 'Leads delivered',         owner: 'Sergey (Marketer)' },
  { id: 6, label: 'Sales support active',    owner: 'Sales Manager (TBC)' },
];

/**
 * Real team assignments from William's voice note (May 13 2026).
 */
export const TEAM = [
  { role: 'Lead Generation / Executive Sponsor',       owner: 'William',  color: '#D44A4A' },
  { role: 'Project Manager (PM + Ops + AI)',            owner: 'Riyash',   color: '#5B8DEF' },
  { role: 'Appointment Setter / Qualifier',             owner: 'Mildred',  color: '#7B6FDB' },
  { role: 'Recruiter / Franchise Sales',                owner: 'Janina',   color: '#D97A5E' },
  { role: 'Customer Experience Team',                   owner: 'Mildred',  color: '#7B6FDB' },
  { role: 'Marketer',                                   owner: 'Sergey',   color: '#2D9B5E' },
  { role: 'Sales Trainer',                              owner: 'Matt',     color: '#D49A2B' },
  { role: 'Sales Manager (Step 6)',                     owner: 'TBC',      color: '#999999' },
  { role: 'Claude (AI Automation Layer)',               owner: 'AI',       color: '#C2547F' },
];

export const STATUS_COLORS = {
  green:      { bg: 'var(--color-green-bg)',  text: 'var(--color-green-text)',  dot: 'var(--color-green)' },
  amber:      { bg: 'var(--color-amber-bg)',  text: 'var(--color-amber-text)',  dot: 'var(--color-amber)' },
  red:        { bg: 'var(--color-red-bg)',    text: 'var(--color-red-text)',    dot: 'var(--color-red)'   },
  onboarding: { bg: 'var(--color-info-bg)',   text: 'var(--color-info-text)',   dot: 'var(--color-info)'  },
};

/**
 * Open items (scope §12) — update when William confirms each.
 */
export const OPEN_ITEMS = [
  { id:1, item:'API availability from waveclosers.com',         blocks:'API sync mode',            status:'pending' },
  { id:2, item:'Weekly lead targets per user type',            blocks:'Lead-shortfall alerts',    status:'pending' },
  { id:3, item:'Monthly quota benchmarks per user type',       blocks:'Quota-miss escalations',   status:'pending' },
  { id:4, item:'Contract template for CX automation',         blocks:'Contract dispatch email',   status:'pending' },
  { id:5, item:'Online learning platform link / login flow',  blocks:'Online learning enrollment',status:'pending' },
  { id:6, item:'Thursday sales training meeting time',        blocks:'Thursday training invite',  status:'pending' },
  { id:7, item:'Sales Manager role (Janina or new hire?)',    blocks:'Step 6 ownership',          status:'pending' },
];
