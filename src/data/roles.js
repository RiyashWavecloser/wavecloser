export const ROLES = {
  ADMIN: 'admin',
  SPONSOR: 'sponsor',
  CX: 'cx',
  RECRUITER: 'recruiter',
  MARKETER: 'marketer',
  TRAINER: 'trainer',
  AGENT: 'agent',
};

export const ROLE_LABELS = {
  admin: 'Project Manager',
  sponsor: 'Executive Sponsor',
  cx: 'Customer Experience (CX)',
  recruiter: 'Recruiter',
  marketer: 'Marketer',
  trainer: 'Sales Trainer',
  agent: 'Cold Calling Agent',
};

export const ROLE_VIEWS = {
  admin:              ['dashboard', 'users', 'onboarding', 'automation', 'franchise', 'leads', 'data', 'settings'],
  sponsor:            ['dashboard', 'users', 'onboarding', 'automation', 'franchise', 'leads', 'settings'],
  cx:                 ['qualifier-portal', 'users', 'onboarding', 'qualifier-completed'],
  recruiter:          ['dashboard', 'users', 'onboarding', 'leads'],
  marketer:           ['dashboard', 'users', 'leads'],
  trainer:            ['dashboard', 'users', 'leads'],
  agent:              ['agent-portal'],
};

export const ROLE_USER_FILTER = {
  admin:              () => true,
  sponsor:            () => true,
  cx:                 (u) => u.stage <= 3,
  recruiter:          (u) => (u.type === 'RESELLER' || u.type === 'ISO') && u.stage <= 4,
  marketer:           (u) => u.stage >= 4,
  trainer:            (u) => u.stage >= 4,
  agent:              () => false,
};

export const DEFAULT_STAFF = [
  { email: 'riyash@waveclosers.com',  name: 'Riyash',  role: ROLES.ADMIN },
  { email: 'william@waveclosers.com', name: 'William', role: ROLES.SPONSOR },
  { email: 'qualifier@waveclosers.com', name: 'Lead Qualifier', role: ROLES.CX },
  { email: 'recruiter@waveclosers.com',  name: 'Recruiter',  role: ROLES.RECRUITER },
  { email: 'sergey@waveclosers.com',  name: 'Sergey',  role: ROLES.MARKETER },
  { email: 'matt@waveclosers.com',    name: 'Matt',    role: ROLES.TRAINER },
  // 10 cold-calling agents — William will confirm real names (Open item #10)
  { email: 'agent1@waveclosers.com',  name: 'Agent 1',  role: ROLES.AGENT },
  { email: 'agent2@waveclosers.com',  name: 'Agent 2',  role: ROLES.AGENT },
  { email: 'agent3@waveclosers.com',  name: 'Agent 3',  role: ROLES.AGENT },
  { email: 'agent4@waveclosers.com',  name: 'Agent 4',  role: ROLES.AGENT },
  { email: 'agent5@waveclosers.com',  name: 'Agent 5',  role: ROLES.AGENT },
  { email: 'agent6@waveclosers.com',  name: 'Agent 6',  role: ROLES.AGENT },
  { email: 'agent7@waveclosers.com',  name: 'Agent 7',  role: ROLES.AGENT },
  { email: 'agent8@waveclosers.com',  name: 'Agent 8',  role: ROLES.AGENT },
  { email: 'agent9@waveclosers.com',  name: 'Agent 9',  role: ROLES.AGENT },
  { email: 'agent10@waveclosers.com', name: 'Agent 10', role: ROLES.AGENT },
];

export function canAccess(role, view) {
  const allowed = ROLE_VIEWS[role] || ROLE_VIEWS[ROLES.ADMIN];
  return allowed.includes(view);
}

export function defaultView(role) {
  const allowed = ROLE_VIEWS[role] || ROLE_VIEWS[ROLES.ADMIN];
  return allowed[0] || 'dashboard';
}
