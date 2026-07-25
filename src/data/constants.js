/**
 * Wave Closers — system constants
 * Updated: July 2026 — dual workflow, 5 user types, 7-step CX onboarding
 *
 * [BRANCH] src/data/constants.js goes to BOTH main AND worker-deploy branches
 */

// ─── Workflow A: Merchant/POS Leads ───────────────────────────────────────────
// Cold Callers, Independent Reps, and Authorized Resellers log in, view their
// assigned leads, call businesses, mark outcomes, move through POS sales pipeline.

// ─── Workflow B: Recruiting / Salesperson Onboarding ─────────────────────────
// Recruiter (Aureliab) finds people OUTSIDE the system (LinkedIn, referrals, etc.)
// and manually adds them. System tracks onboarding status and moves them through
// the 7-step CX flow. Recruiter does NOT use the system to FIND people.

export const USER_TYPES = {
  COLD_CALLER: {
    id:           'COLD_CALLER',
    label:        'Cold Caller',
    short:        'Cold Caller',
    portal:       'agent',       // uses Agent Portal (Workflow A)
    leadPriority: 3,             // lowest priority in lead distribution
    color:        '#5B8DEF',
    earningModel: 'Commission per closed deal',
  },
  REP: {
    id:           'REP',
    label:        'Independent Rep',
    short:        'Indep Rep',
    portal:       'agent',       // same portal as cold caller
    leadPriority: 2,             // medium priority
    color:        '#D97A5E',
    earningModel: '$1,500–$3,000 bonus + 40% residuals',
  },
  RESELLER: {
    id:           'RESELLER',
    label:        'Authorized Reseller',
    short:        'Reseller',
    portal:       'agent',       // same portal as cold caller — NOT recruiter pipeline
    leadPriority: 1,             // HIGHEST priority — gets leads first
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
 * Used in both automationWorker.js AND leadWorker.js
 * [BRANCH] BOTH main and worker-deploy
 */
export const LEAD_DISTRIBUTION_ORDER = ['RESELLER', 'REP', 'COLD_CALLER'];

/**
 * Full role list for auth system
 */
export const ROLES = [
  'admin',               // William — full access
  'pm',                  // Riyash — full access
  'cx',                  // Mildred — qualifier + CX portal
  'recruiter',           // Aureliab — recruiter portal + recruiting pipeline
  'cold_caller',         // Cold Callers — agent portal, lead priority 3
  'independent_rep',     // Independent Reps — agent portal, lead priority 2
  'authorized_reseller', // Authorized Resellers — agent portal, lead priority 1
  'iso_investor',        // ISO Investors — agent portal
  'referral_partner',    // Referral Partners — agent portal
  'agent_supervisor',    // agentsservices — sees all agents' leads
  'marketer',            // Sergey
  'trainer',             // Matt
];

/**
 * Placeholder benchmarks — to be confirmed with William (scope §12).
 */
export const BENCHMARKS = {
  COLD_CALLER: { weeklyLeads: 10, monthlyQuota: 4,  closeRate: 0.30 },
  REP:         { weeklyLeads: 10, monthlyQuota: 4,  closeRate: 0.35 },
  RESELLER:    { weeklyLeads: 12, monthlyQuota: 5,  closeRate: 0.40 },
  ISO:         { weeklyLeads: 8,  monthlyQuota: 3,  closeRate: 0.50 },
  REFERRAL:    { weeklyLeads: 5,  monthlyQuota: 2,  closeRate: 0.40 },
};

/**
 * 7-step CX onboarding flow — Mildred owns all 7 steps
 * Steps 3–7 have pending notes from William (scope §12)
 * [BRANCH] BOTH main and worker-deploy
 */
export const ONBOARDING_STAGES = [
  { id: 1, label: 'Onboards user to Wave Closers platform',  owner: 'Mildred (CX)' },
  { id: 2, label: 'Sends the contract',                      owner: 'Mildred (CX)' },
  { id: 3, label: 'Sets up online learning access',          owner: 'Mildred (CX)', note: 'Learning platform link pending William §12 #5' },
  { id: 4, label: 'Invites to Thursday sales training',      owner: 'Mildred (CX)', note: 'Meeting time pending William §12 #6' },
  { id: 5, label: 'Offers Brain Goats',                      owner: 'Mildred (CX)', note: 'Details/link pending William §12 #13' },
  { id: 6, label: 'Offers MeetGold',                         owner: 'Mildred (CX)', note: '⚠ MeetGold not yet transferred — pending William §12 #12' },
  { id: 7, label: 'Offers Lead Gen Service',                 owner: 'Mildred (CX)', note: 'Details/link pending William §12 #14' },
];

/**
 * Real team assignments from William's voice note (May 13 2026).
 */
export const TEAM = [
  { role: 'Admin / Executive Sponsor',              owner: 'William',  color: '#D44A4A' },
  { role: 'Project Manager (PM + Ops + AI)',         owner: 'Riyash',   color: '#5B8DEF' },
  { role: 'Appointment Setter / Qualifier (CX)',     owner: 'Mildred',  color: '#7B6FDB' },
  { role: 'Recruiter / Franchise Sales',             owner: 'Aureliab', color: '#D97A5E', note: '⚠ Email placeholder — confirm with William (Open Item #11)' },
  { role: 'Marketer',                                owner: 'Sergey',   color: '#2D9B5E' },
  { role: 'Sales Trainer',                           owner: 'Matt',     color: '#D49A2B' },
  { role: 'Sales Manager (Step 6)',                  owner: 'TBC',      color: '#999999' },
  { role: 'Claude (AI Automation Layer)',             owner: 'AI',       color: '#C2547F' },
];

export const STATUS_COLORS = {
  green:      { bg: 'var(--color-green-bg)',  text: 'var(--color-green-text)',  dot: 'var(--color-green)' },
  amber:      { bg: 'var(--color-amber-bg)',  text: 'var(--color-amber-text)',  dot: 'var(--color-amber)' },
  red:        { bg: 'var(--color-red-bg)',    text: 'var(--color-red-text)',    dot: 'var(--color-red)'   },
  onboarding: { bg: 'var(--color-info-bg)',   text: 'var(--color-info-text)',   dot: 'var(--color-info)'  },
};

/**
 * Open items (scope §12) — update when William confirms each.
 * [BRANCH] main only
 */
export const OPEN_ITEMS = [
  { num: 1,  item: 'API availability from waveclosers.com',            blocks: 'API sync mode'                                          },
  { num: 2,  item: 'Weekly lead targets per user type',                 blocks: 'Lead-shortfall alerts'                                  },
  { num: 3,  item: 'Monthly quota benchmarks per user type',            blocks: 'Quota-miss escalations'                                 },
  { num: 4,  item: 'Contract template for CX automation',              blocks: 'Contract dispatch email'                                 },
  { num: 5,  item: 'Online learning platform link / login flow',        blocks: 'Step 3 of CX onboarding'                               },
  { num: 6,  item: 'Thursday sales training meeting time',             blocks: 'Step 4 of CX onboarding'                               },
  { num: 7,  item: 'Sales Manager role assignment',                     blocks: 'Step 6 ownership'                                       },
  { num: 8,  item: 'Google Places API key',                             blocks: 'Primary lead source (using Yelp only until confirmed)'  },
  { num: 9,  item: 'Yelp API key',                                      blocks: 'Backup lead source'                                     },
  { num: 10, item: 'Target markets / cities for first lead batch',      blocks: 'Weekly lead generation'                                 },
  { num: 11, item: 'Aureliab exact email address',                      blocks: 'Recruiter account creation'                             },
  { num: 12, item: 'MeetGold platform transfer',                        blocks: 'Step 6 of CX onboarding'                               },
  { num: 13, item: 'Brain Goats details and link',                      blocks: 'Step 5 of CX onboarding'                               },
  { num: 14, item: 'Lead Gen Service details and link',                 blocks: 'Step 7 of CX onboarding'                               },
];

/**
 * Module 6 — AI Lead Generation Engine constants.
 */
export const BUSINESS_TYPES = [
  { id: 'restaurant',    label: 'Restaurants',     yelpCategory: 'restaurants',     icon: '🍽️' },
  { id: 'beauty_salon',  label: 'Beauty Salons',   yelpCategory: 'beautysvc',       icon: '💇' },
  { id: 'nail_salon',    label: 'Nail Salons',     yelpCategory: 'nailsalons',      icon: '💅' },
  { id: 'deli',          label: 'Delis',           yelpCategory: 'delis',           icon: '🥪' },
  { id: 'massage',       label: 'Massage Places',  yelpCategory: 'massage',         icon: '💆' },
  { id: 'small_retail',  label: 'Small Retail',    yelpCategory: 'shoppingcenters', icon: '🏪' },
];

/**
 * Real cold-calling agent accounts (confirmed June 2026).
 * Janina is an agent — NOT recruiter (corrected from earlier placeholder).
 * Aureliab is the Recruiter / Franchise Sales person (separate staff account).
 * [BRANCH] BOTH main and worker-deploy
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

// Supervisor account — sees all 9 agents' leads via dropdown
export const AGENT_SUPERVISOR_EMAIL = 'agentsservices@waveclosers.com';
// ⚠ PLACEHOLDER — confirm real email with William (Open Item #11)
export const RECRUITER_EMAIL        = (typeof process !== 'undefined' ? process.env.RECRUITER_EMAIL : null) || 'aureliab@waveclosers.com';
export const RECRUITER_NAME         = 'Aureliab';

export const DAILY_LEADS_PER_AGENT = 100;
export const NUM_AGENTS = 9;

export const LEAD_STATUSES = {
  NEW:                 { id: 'New',               label: 'New',               color: 'var(--color-info)'               },
  ASSIGNED:            { id: 'Assigned',          label: 'Assigned',          color: 'var(--color-primary)'            },
  CALLED:              { id: 'Called',            label: 'Called',            color: 'var(--color-amber)'              },
  INTERESTED:          { id: 'Interested',        label: 'Interested',        color: 'var(--color-green)'              },
  NOT_INTERESTED:      { id: 'NotInterested',     label: 'Not Interested',    color: 'var(--color-red)'                },
  CALLBACK:            { id: 'Callback',          label: 'Callback',          color: 'var(--color-amber)'              },
  NO_ANSWER:           { id: 'NoAnswer',          label: 'No Answer',         color: 'var(--color-faint, #999)'        },
  SENT_TO_QUALIFIER:   { id: 'SentToQualifier',  label: 'Sent to Qualifier', color: '#1F4E79'                         },
  ASSIGNED_TO_PARTNER: { id: 'AssignedToPartner',label: 'Assigned to Partner',color: '#C2547F'                       },
  ROUTED_TO_RECRUITER: { id: 'RoutedToRecruiter',label: 'Routed to Recruiter',color: '#D97A5E'                       },
  ROUTED_TO_CX:        { id: 'RoutedToCX',       label: 'Routed to CX',      color: '#7B6FDB'                         },
};

/**
 * Qualifier's statuses for the portal — separate from agent statuses.
 */
export const QUALIFIER_STATUSES = {
  NEW:       { id: 'QualifierNew',       label: 'New',       color: '#D49A2B', icon: '🟡' },
  CONTACTED: { id: 'QualifierContacted', label: 'Contacted', color: '#5B8DEF', icon: '📞' },
  QUALIFIED: { id: 'QualifierQualified', label: 'Qualified', color: '#2D9B5E', icon: '✅' },
  NOT_A_FIT: { id: 'QualifierNotAFit',  label: 'Not a fit', color: '#D44A4A', icon: '❌' },
  FOLLOW_UP: { id: 'QualifierFollowUp', label: 'Follow up', color: '#7B6FDB', icon: '📅' },
};

/**
 * Recruiting pipeline statuses (Workflow B)
 */
export const RECRUIT_STATUSES = [
  'New',
  'Contacted',
  'Interested',
  'Onboarding',
  'Active',
  'Declined',
];

/**
 * Recruiting pipeline stages — ordered step-by-step (excluding Declined which is an exit).
 * Used by the step-by-step status flow UI in RecruiterPortal.
 */
export const RECRUIT_STAGES = [
  { step: 1, status: 'New',        label: 'New',        color: '#888888' },
  { step: 2, status: 'Contacted',  label: 'Contacted',  color: '#5B8DEF' },
  { step: 3, status: 'Interested', label: 'Interested', color: '#D49A2B' },
  { step: 4, status: 'Onboarding', label: 'Onboarding', color: '#7B6FDB' },
  { step: 5, status: 'Active',     label: 'Active',     color: '#2D9B5E' },
];

/**
 * Recruit source options (for Aureliab's pipeline)
 */
export const RECRUIT_SOURCES = [
  'LinkedIn',
  'Craigslist',
  'Referral',
  'Job Board',
  'Social Media',
  'Direct Outreach',
  'Other',
];


/**
 * Recruit type options — NO Authorized Reseller (different channel)
 */
export const RECRUIT_TYPES = [
  'Independent Rep',
  'ISO Investor',
  'Referral Partner',
];

export const AUTOMATION_TASKS = [
  { name: 'User classification',           trigger: 'After Qualifier qualifies lead (stage 2)',  status: 'active',  runs: 0, lastRun: 'Never' },
  { name: 'Welcome email (personalised)',  trigger: 'Stage 3 → user email',                    status: 'active',  runs: 0, lastRun: 'Never' },
  { name: 'Contract dispatch trigger',     trigger: 'Stage 4 → CX Team',                       status: 'active',  runs: 0, lastRun: 'Never' },
  { name: 'Online learning enrollment',    trigger: 'After contract signed (stage 5)',         status: 'pending', runs: 0, lastRun: 'Never', note: 'Waiting on William: learning platform link (Open item #5)' },
  { name: 'Thursday training auto-invite', trigger: 'After learning setup (stage 6) → Matt',   status: 'pending', runs: 0, lastRun: 'Never', note: 'Waiting on William: Thursday meeting time (Open item #6)' },
  { name: 'Weekly performance report',     trigger: 'Every Monday 7am → PM & Admin',           status: 'active',  runs: 0, lastRun: 'Never' },
  { name: 'Lead-shortfall alert',          trigger: 'Real-time check → Sergey (Marketer)',     status: 'active',  runs: 0, lastRun: 'Never' },
  { name: 'Quota-miss escalation',         trigger: 'End of month → PM',                       status: 'active',  runs: 0, lastRun: 'Never' },
  { name: 'Franchise market research',     trigger: 'On demand',                               status: 'active',  runs: 0, lastRun: 'Never' },
];

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


