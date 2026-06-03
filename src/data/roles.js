export const ROLES = {
  ADMIN: 'admin',
  SPONSOR: 'sponsor',
  APPOINTMENT_SETTER: 'appointment_setter',
  RECRUITER: 'recruiter',
  MARKETER: 'marketer',
  TRAINER: 'trainer',
};

export const ROLE_LABELS = {
  admin: 'Project Manager',
  sponsor: 'Executive Sponsor',
  appointment_setter: 'Appointment Setter',
  recruiter: 'Recruiter',
  marketer: 'Marketer',
  trainer: 'Sales Trainer',
};

export const ROLE_VIEWS = {
  admin:              ['dashboard', 'users', 'onboarding', 'automation', 'franchise', 'data', 'settings'],
  sponsor:            ['dashboard', 'users', 'onboarding', 'automation', 'franchise', 'settings'],
  appointment_setter: ['dashboard', 'users', 'onboarding'],
  recruiter:          ['dashboard', 'users', 'onboarding'],
  marketer:           ['dashboard', 'users'],
  trainer:            ['dashboard', 'users'],
};

export const ROLE_USER_FILTER = {
  admin:              () => true,
  sponsor:            () => true,
  appointment_setter: (u) => u.stage <= 3,
  recruiter:          (u) => (u.type === 'RESELLER' || u.type === 'ISO') && u.stage <= 4,
  marketer:           (u) => u.stage >= 4,
  trainer:            (u) => u.stage >= 4,
};

export const DEFAULT_STAFF = [
  { email: 'riyash@waveclosers.com',  name: 'Riyash',  role: ROLES.ADMIN },
  { email: 'william@waveclosers.com', name: 'William', role: ROLES.SPONSOR },
  { email: 'mildred@waveclosers.com', name: 'Mildred', role: ROLES.APPOINTMENT_SETTER },
  { email: 'janina@waveclosers.com',  name: 'Janina',  role: ROLES.RECRUITER },
  { email: 'sergey@waveclosers.com',  name: 'Sergey',  role: ROLES.MARKETER },
  { email: 'matt@waveclosers.com',    name: 'Matt',    role: ROLES.TRAINER },
];

export function canAccess(role, view) {
  const allowed = ROLE_VIEWS[role] || ROLE_VIEWS[ROLES.ADMIN];
  return allowed.includes(view);
}

export function defaultView(role) {
  const allowed = ROLE_VIEWS[role] || ROLE_VIEWS[ROLES.ADMIN];
  return allowed[0] || 'dashboard';
}
