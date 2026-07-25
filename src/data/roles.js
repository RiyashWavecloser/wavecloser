/**
 * src/data/roles.js
 * [BRANCH] main only
 *
 * Updated July 2026:
 * - New roles: cold_caller, independent_rep, authorized_reseller, iso_investor, referral_partner, agent_supervisor, pm
 * - recruiter-portal visible to admin, pm, and recruiter
 * - Removed stale placeholder agent entries from DEFAULT_STAFF
 */

export const ROLES = {
  ADMIN:                  'admin',
  PM:                     'pm',
  SPONSOR:                'sponsor',
  CX:                     'cx',
  RECRUITER:              'recruiter',
  MARKETER:               'marketer',
  TRAINER:                'trainer',
  COLD_CALLER:            'cold_caller',
  INDEPENDENT_REP:        'independent_rep',
  AUTHORIZED_RESELLER:    'authorized_reseller',
  ISO_INVESTOR:           'iso_investor',
  REFERRAL_PARTNER:       'referral_partner',
  AGENT_SUPERVISOR:       'agent_supervisor',
  AGENT:                  'agent',
  WAVE_CLOSER_RECRUITER:  'wave_closer_recruiter',
};

export const ROLE_LABELS = {
  admin:                  'Project Manager',
  pm:                     'Project Manager (PM)',
  sponsor:                'Executive Sponsor',
  cx:                     'Customer Experience (CX)',
  recruiter:              'Recruiter / Franchise Sales',
  marketer:               'Marketer',
  trainer:                'Sales Trainer',
  cold_caller:            'Cold Caller',
  independent_rep:        'Independent Rep',
  authorized_reseller:    'Authorized Reseller',
  iso_investor:           'ISO Investor',
  referral_partner:       'Referral Partner',
  agent_supervisor:       'Agent Supervisor',
  agent:                  'Agent',
  wave_closer_recruiter:  'Wave Closer Recruiter',
};

// All agent-type roles — share the Agent Portal (Workflow A)
export const AGENT_ROLES = [
  'cold_caller',
  'independent_rep',
  'authorized_reseller',
  'iso_investor',
  'referral_partner',
  'agent_supervisor',
  'agent',
  'wave_closer_recruiter',
];

const FULL_ACCESS = [
  'dashboard', 'users', 'onboarding', 'automation',
  'franchise', 'leads', 'data', 'settings', 'recruiter-portal',
];

export const ROLE_VIEWS = {
  admin:                FULL_ACCESS,
  pm:                   FULL_ACCESS,
  sponsor:              ['dashboard', 'users', 'onboarding', 'automation', 'franchise', 'leads', 'settings', 'recruiter-portal'],
  cx:                   ['qualifier-portal', 'users', 'onboarding', 'qualifier-completed'],
  recruiter:            ['dashboard', 'users', 'onboarding', 'recruiter-portal'],
  marketer:             ['dashboard', 'users', 'leads'],
  trainer:              ['dashboard', 'users', 'leads'],
  // All agent-type roles — single-view portal
  cold_caller:            ['agent-portal'],
  independent_rep:        ['agent-portal'],
  authorized_reseller:    ['agent-portal'],
  iso_investor:           ['agent-portal'],
  referral_partner:       ['agent-portal'],
  agent_supervisor:       ['agent-portal'],
  agent:                  ['agent-portal'],
  // Wave Closer Recruiter — gets agent portal (with resume leads tab) + recruiting pipeline
  wave_closer_recruiter:  ['agent-portal'],
};

export const ROLE_USER_FILTER = {
  admin:                () => true,
  pm:                   () => true,
  sponsor:              () => true,
  cx:                   (u) => u.stage <= 3,
  recruiter:            (u) => ['REP', 'ISO', 'REFERRAL'].includes(u.type) && u.stage <= 4,
  marketer:             (u) => u.stage >= 4,
  trainer:              (u) => u.stage >= 4,
  cold_caller:          () => false,
  independent_rep:      () => false,
  authorized_reseller:  () => false,
  iso_investor:         () => false,
  referral_partner:     () => false,
  agent_supervisor:     () => false,
  agent:                () => false,
};

// Real staff accounts — used for reference only (actual seeding done by seed-staff.mjs)
export const DEFAULT_STAFF = [
  { email: 'riyash@waveclosers.com',   name: 'Riyash',   role: ROLES.PM },
  { email: 'william@waveclosers.com',  name: 'William',  role: ROLES.ADMIN },
  { email: 'mildred@waveclosers.com',  name: 'Mildred',  role: ROLES.CX },
  { email: 'aureliab@waveclosers.com', name: 'Aureliab', role: ROLES.RECRUITER }, // ⚠ placeholder email
  { email: 'sergey@waveclosers.com',   name: 'Sergey',   role: ROLES.MARKETER },
  { email: 'matt@waveclosers.com',     name: 'Matt',     role: ROLES.TRAINER },
];

export function canAccess(role, view) {
  const allowed = ROLE_VIEWS[role] || ROLE_VIEWS[ROLES.PM];
  return allowed.includes(view);
}

export function defaultView(role) {
  const allowed = ROLE_VIEWS[role] || ROLE_VIEWS[ROLES.PM];
  return allowed[0] || 'dashboard';
}

export function isAgentRole(role) {
  return AGENT_ROLES.includes(role);
}
