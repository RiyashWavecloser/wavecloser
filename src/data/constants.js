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
  { id: 2, label: 'Qualified',               owner: 'Lead Qualifier' },
  { id: 3, label: 'Routed',                  owner: 'Qualifier → Recruiter or CX' },
  { id: 4, label: 'Onboarded to platform',   owner: 'CX Team' },
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
  { role: 'Recruiter / Franchise Sales',                owner: 'Aureliab', color: '#D97A5E' }, // ⚠️ Open item #11 — email TBC from William
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
  { id:1,  item:'API availability from waveclosers.com',         blocks:'API sync mode',            status:'pending' },
  { id:2,  item:'Weekly lead targets per user type',            blocks:'Lead-shortfall alerts',    status:'pending' },
  { id:3,  item:'Monthly quota benchmarks per user type',       blocks:'Quota-miss escalations',   status:'pending' },
  { id:4,  item:'Contract template for CX automation',         blocks:'Contract dispatch email',   status:'pending' },
  { id:5,  item:'Online learning platform link / login flow',  blocks:'Online learning enrollment',status:'pending' },
  { id:6,  item:'Thursday sales training meeting time',        blocks:'Thursday training invite',  status:'pending' },
  { id:7,  item:'Sales Manager role (TBC)',                    blocks:'Step 6 ownership',          status:'pending' },
  { id:8,  item:'Google Places API key',                        blocks:'Live lead generation',     status:'pending' },
  { id:9,  item:'Yelp Fusion API key',                          blocks:'Backup lead source',       status:'configured' },
  { id:10, item:'Cold-calling agent roster (10 names)',         blocks:'Agent assignment',          status:'resolved' },
  { id:11, item:'Qualifier CX workflow confirmation',            blocks:'Auto-routing rules',        status:'confirmed' },
  // ⚠️ OPEN ITEM #11 — Confirm Aureliab's exact email address — currently using placeholder (aureliab@waveclosers.com)
  // Update RECRUITER_EMAIL in .env once confirmed — no code changes needed.
  { id:12, item:"Aureliab's exact email address (Recruiter/Franchise Sales)", blocks:'Recruiter email routing', status:'pending' },
];

/**
 * Module 6 — AI Lead Generation Engine constants.
 */
export const BUSINESS_TYPES = [
  { id: 'restaurant',    label: 'Restaurants',       yelpCategory: 'restaurants',   icon: '🍽️' },
  { id: 'beauty_salon',  label: 'Beauty Salons',     yelpCategory: 'beautysvc',     icon: '💇' },
  { id: 'nail_salon',    label: 'Nail Salons',       yelpCategory: 'nailsalons',    icon: '💅' },
  { id: 'deli',          label: 'Delis',             yelpCategory: 'delis',         icon: '🥪' },
  { id: 'massage',       label: 'Massage Places',    yelpCategory: 'massage',       icon: '💆' },
  { id: 'small_retail',  label: 'Small Retail',      yelpCategory: 'shoppingcenters', icon: '🏪' },
];

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

// Supervisor account — sees all 9 agents' leads via dropdown
export const AGENT_SUPERVISOR_EMAIL = 'agentsservices@waveclosers.com';

export const DAILY_LEADS_PER_AGENT = 100;
export const NUM_AGENTS = 9;

export const LEAD_STATUSES = {
  NEW:                { id: 'New',                label: 'New',                 color: 'var(--color-info)' },
  ASSIGNED:           { id: 'Assigned',           label: 'Assigned',            color: 'var(--color-primary)' },
  CALLED:             { id: 'Called',             label: 'Called',              color: 'var(--color-amber)' },
  INTERESTED:         { id: 'Interested',         label: 'Interested',          color: 'var(--color-green)' },
  NOT_INTERESTED:     { id: 'NotInterested',      label: 'Not Interested',      color: 'var(--color-red)' },
  CALLBACK:           { id: 'Callback',           label: 'Callback',            color: 'var(--color-amber)' },
  NO_ANSWER:          { id: 'NoAnswer',           label: 'No Answer',           color: 'var(--color-faint, #999)' },
  SENT_TO_QUALIFIER:    { id: 'SentToQualifier',      label: 'Sent to Qualifier',     color: '#1F4E79' },
  ASSIGNED_TO_PARTNER:{ id: 'AssignedToPartner',  label: 'Assigned to Partner', color: '#C2547F' },
  ROUTED_TO_RECRUITER:   { id: 'RoutedToRecruiter',     label: 'Routed to Recruiter',    color: '#D97A5E' },
  ROUTED_TO_CX:       { id: 'RoutedToCX',         label: 'Routed to CX',        color: '#7B6FDB' },
};

/**
 * Qualifier's statuses for the portal — separate from agent statuses.
 */
export const QUALIFIER_STATUSES = {
  NEW:        { id: 'QualifierNew',       label: 'New',         color: '#D49A2B', icon: '🟡' },
  CONTACTED:  { id: 'QualifierContacted', label: 'Contacted',   color: '#5B8DEF', icon: '📞' },
  QUALIFIED:  { id: 'QualifierQualified', label: 'Qualified',   color: '#2D9B5E', icon: '✅' },
  NOT_A_FIT:  { id: 'QualifierNotAFit',  label: 'Not a fit',   color: '#D44A4A', icon: '❌' },
  FOLLOW_UP:  { id: 'QualifierFollowUp', label: 'Follow up',   color: '#7B6FDB', icon: '📅' },
};
