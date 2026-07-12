/**
 * src/lib/dataLayer.js
 *
 * All frontend data operations go through here.
 * Backend must be running (node server/claude-proxy.js) for live Airtable sync.
 * Falls back gracefully — returns null on network errors so UI keeps React state.
 *
 * Public interface:
 *   fetchUsersFromAPI()         → users[] | null
 *   createUserAPI(user)         → { user } | { demo }
 *   updateUserAPI(id, patch)    → { user } | { demo }
 *   deleteUserAPI(id)           → { deleted } | { demo }
 *   importUsersToAPI(users[])   → { imported, failed, demo }
 *   fetchLogFromAPI()           → log[] | null
 *   checkServerHealth()         → { status, claude, airtable, email }
 */

const PROXY = (import.meta.env.VITE_CLAUDE_PROXY_URL || 'http://localhost:3001/api/claude')
  .replace('/api/claude', '');

let _token = localStorage.getItem('wc_session_token') || null;

export function setSession(token, user, mustChangePassword = false) {
  _token = token;
  if (token) {
    localStorage.setItem('wc_session_token', token);
    localStorage.setItem('wc_session_user', JSON.stringify(user));
    localStorage.setItem('wc_session_must_change', mustChangePassword ? '1' : '0');
  } else {
    localStorage.removeItem('wc_session_token');
    localStorage.removeItem('wc_session_user');
    localStorage.removeItem('wc_session_must_change');
  }
}

export function getSession() {
  const token = localStorage.getItem('wc_session_token');
  const userStr = localStorage.getItem('wc_session_user');
  const mustChange = localStorage.getItem('wc_session_must_change') === '1';
  try {
    return {
      token,
      user: userStr ? JSON.parse(userStr) : null,
      mustChangePassword: mustChange,
    };
  } catch {
    return { token: null, user: null, mustChangePassword: false };
  }
}

export function clearMustChangePassword() {
  localStorage.setItem('wc_session_must_change', '0');
}


function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (_token) {
    headers['Authorization'] = `Bearer ${_token}`;
  }
  return headers;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function get(path) {
  const headers = {};
  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  
  const res = await fetch(`${PROXY}${path}`, { headers });
  if (res.status === 401 || res.status === 403) {
    setSession(null);
    window.location.reload();
  }
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${PROXY}${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (res.status === 401 || res.status === 403) {
    setSession(null);
    window.location.reload();
  }
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json();
}

async function patch(path, body) {
  const res = await fetch(`${PROXY}${path}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (res.status === 401 || res.status === 403) {
    setSession(null);
    window.location.reload();
  }
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`);
  return res.json();
}

async function del(path) {
  const headers = {};
  if (_token) headers['Authorization'] = `Bearer ${_token}`;

  const res = await fetch(`${PROXY}${path}`, { 
    method: 'DELETE',
    headers
  });
  if (res.status === 401 || res.status === 403) {
    setSession(null);
    window.location.reload();
  }
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}`);
  return res.json();
}

// ─── Users ────────────────────────────────────────────────────────────────────

/**
 * Load all users from Airtable on app startup.
 * Returns users[] if backend + Airtable are live, otherwise null (use seed data).
 */
export async function fetchUsersFromAPI() {
  try {
    const data = await get('/api/users');
    if (data.demo || !data.users?.length) return null;
    return data.users;
  } catch {
    return null; // backend offline — silent fallback to seed data
  }
}

/**
 * Create a new user in Airtable.
 * Returns { demo: true } if backend is offline — caller keeps React state only.
 */
export async function createUserAPI(user) {
  try {
    return await post('/api/users', user);
  } catch {
    return { demo: true };
  }
}

/**
 * Update specific fields of a user in Airtable.
 * patch = { stage: 3 } or { notes: '...' } or any subset of user fields.
 */
export async function updateUserAPI(id, patchData) {
  try {
    return await patch(`/api/users/${id}`, patchData);
  } catch {
    return { demo: true };
  }
}

/**
 * Delete a user from Airtable by Wave Closers ID (e.g. 'WC-1001').
 */
export async function deleteUserAPI(id) {
  try {
    return await del(`/api/users/${id}`);
  } catch {
    return { demo: true };
  }
}

/**
 * Push an array of users (from CSV) to Airtable via upsert.
 */
export async function importUsersToAPI(users) {
  try {
    return await post('/api/import', { users });
  } catch (err) {
    return { imported: 0, failed: users.length, demo: true, error: err.message };
  }
}

// ─── Automation log ───────────────────────────────────────────────────────────

export async function fetchLogFromAPI() {
  try {
    const data = await get('/api/log');
    if (data.demo) return null;
    return data.log || null;
  } catch {
    return null;
  }
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function checkServerHealth() {
  try {
    return await get('/health');
  } catch {
    return { status: 'offline', claude: false, airtable: false, email: false, googlePlaces: false, yelp: false };
  }
}

// ─── Leads (Module 6) ─────────────────────────────────────────────────────────

const LEADS_STORAGE_KEY = 'wc_leads_data';

/**
 * Load leads from localStorage (demo mode persistence).
 * Call outcomes survive page refresh.
 */
export function loadLeadsFromStorage() {
  try {
    const raw = localStorage.getItem(LEADS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Save leads to localStorage for demo mode persistence.
 */
export function saveLeadsToStorage(leads) {
  try {
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
  } catch {
    // Storage quota exceeded — silently ignore
  }
}

/**
 * Fetch leads from API. Falls back to localStorage if backend offline.
 */
export async function fetchLeadsFromAPI(filters = {}) {
  try {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.type)   params.set('type', filters.type);
    if (filters.market) params.set('market', filters.market);
    if (filters.agent)  params.set('agent', filters.agent);
    const qs = params.toString();
    const data = await get(`/api/leads${qs ? '?' + qs : ''}`);
    if (data.demo || !data.leads?.length) return null;
    return data.leads;
  } catch {
    return null;
  }
}

/**
 * Trigger lead generation. Returns { leads, stats, demo }.
 */
export async function generateLeadsAPI(location, businessTypes, radius, maxLeads = 50) {
  try {
    return await post('/api/leads/generate', { location, businessTypes, radius, maxLeads });
  } catch {
    return { leads: [], stats: {}, demo: true, error: 'Backend offline' };
  }
}

/**
 * Assign a batch of leads to an agent.
 */
export async function assignLeadsAPI(leadIds, agent) {
  try {
    return await post('/api/leads/assign', { leadIds, agent });
  } catch {
    return { demo: true, assigned: leadIds.length };
  }
}

/**
 * Update a lead's status/outcome.
 */
export async function updateLeadAPI(placeId, patchData) {
  try {
    return await patch(`/api/leads/${encodeURIComponent(placeId)}`, patchData);
  } catch {
    return { demo: true };
  }
}

/**
 * Fetch lead stats for analytics.
 */
export async function fetchLeadStatsAPI() {
  try {
    const data = await get('/api/leads/stats');
    if (data.demo) return null;
    return data.stats;
  } catch {
    return null;
  }
}

// ─── Agent Portal ─────────────────────────────────────────────────────────────

/**
 * Fetch leads assigned to the current logged-in agent (uses auth token).
 * Agent Portal polls this every 15 seconds.
 */
export async function fetchMyLeadsAPI() {
  try {
    const data = await get('/api/leads/my-leads');
    if (data.demo) return null;
    return data.leads;
  } catch {
    return null;
  }
}

/**
 * Agent self-service lead generation.
 * Leads are auto-assigned to the requesting agent and globally deduplicated.
 * Returns { leads, stats, demo }.
 */
export async function generateMyOwnLeads(location, businessTypes, radius, maxLeads = 50) {
  try {
    return await post('/api/leads/generate-self', { location, businessTypes, radius, maxLeads });
  } catch (e) {
    return { demo: true, error: e.message, leads: [] };
  }
}

/**
 * Supervisor view — fetch all agents' leads (optionally filtered by agent name).
 * Only accessible to agent_supervisor role.
 */
export async function fetchAllAgentLeadsAPI(agentName = null) {
  try {
    const qs = agentName ? `?agent=${encodeURIComponent(agentName)}` : '';
    const data = await get(`/api/leads/all-agents${qs}`);
    if (data.demo) return null;
    return data.leads;
  } catch {
    return null;
  }
}

// ─── Partner Assignment ───────────────────────────────────────────────────────

/**
 * Assign a lead to a Wave Closers partner.
 * Increments partner's leadsThisWeek in Users table.
 */
export async function assignLeadToPartnerAPI(placeId, partnerWCId) {
  try {
    return await post(`/api/leads/${encodeURIComponent(placeId)}/assign-partner`, { partnerWCId });
  } catch {
    return { demo: true };
  }
}

// ─── Lead Qualification Queue ──────────────────────────────────────────────────

/**
 * Fetch Qualifier's queue of interested leads.
 */
export async function fetchQualifierQueueAPI() {
  try {
    const data = await get('/api/qualifier/queue');
    if (data.demo) return null;
    return data.leads;
  } catch {
    return null;
  }
}

/**
 * Fetch Qualifier's completed leads.
 */
export async function fetchQualifierCompletedAPI() {
  try {
    const data = await get('/api/qualifier/completed');
    if (data.demo) return null;
    return data.entries;
  } catch {
    return null;
  }
}

/**
 * Update Qualifier's status for a lead.
 */
export async function updateQualifierStatusAPI(placeId, qualifierStatus, qualifierNotes) {
  try {
    return await patch(`/api/qualifier/queue/${encodeURIComponent(placeId)}`, { qualifierStatus, qualifierNotes });
  } catch {
    return { demo: true };
  }
}

/**
 * Qualify a lead — sets user type + routes to CX or Recruiter.
 */
export async function qualifyLeadAPI(placeId, userType, notes) {
  try {
    return await post(`/api/qualifier/queue/${encodeURIComponent(placeId)}/qualify`, { userType, notes });
  } catch {
    return { demo: true };
  }
}

// ─── Recruiting Pipeline (Workflow B) ──────────────────────────────────────────

/**
 * Fetch all recruits for the current recruiter.
 */
export async function getRecruitingPipelineAPI() {
  try {
    return await get('/api/recruiting');
  } catch {
    return null;
  }
}

/**
 * Add a new recruit to the pipeline.
 * Returns { duplicate: true, error, recruit } if the email is already in the pipeline (409).
 */
export async function addRecruitAPI(data) {
  try {
    const res = await fetch(`${PROXY}/api/recruiting`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (res.status === 401 || res.status === 403) {
      setSession(null);
      window.location.reload();
    }
    if (res.status === 409) {
      // Email already in pipeline — return duplicate signal instead of throwing
      const body = await res.json();
      return { duplicate: true, error: body.error, recruit: body.recruit };
    }
    if (!res.ok) throw new Error(`POST /api/recruiting → ${res.status}`);
    return res.json();
  } catch {
    return { demo: true };
  }
}

/**
 * Update a recruit's status and/or notes.
 */
export async function updateRecruitStatusAPI(id, status, notes) {
  try {
    return await patch(`/api/recruiting/${encodeURIComponent(id)}`, { status, notes });
  } catch {
    return { demo: true };
  }
}

/**
 * Edit a recruit's core fields (name, email, phone, source, type, notes).
 */
export async function updateRecruitAPI(id, data) {
  try {
    const res = await fetch(`${PROXY}/api/recruiting/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (res.status === 401 || res.status === 403) { setSession(null); window.location.reload(); }
    if (!res.ok) throw new Error(`PUT /api/recruiting/:id => ${res.status}`);
    return await res.json();
  } catch {
    return { demo: true };
  }
}

/**
 * Delete a recruit from the pipeline.
 */
export async function deleteRecruitAPI(id) {
  try {
    const res = await fetch(`${PROXY}/api/recruiting/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (res.status === 401 || res.status === 403) { setSession(null); window.location.reload(); }
    if (!res.ok) throw new Error(`DELETE /api/recruiting/:id => ${res.status}`);
    return await res.json();
  } catch {
    return { demo: true };
  }
}


// ─── Craigslist Resume Search ──────────────────────────────────────────────────

const DEMO_CRAIGSLIST_RESULTS = [
  {
    title: 'Experienced Sales Rep Available — NYC',
    description: '5 years B2B sales experience. Commission driven. Available immediately. Strong closer. Looking for outside sales opportunity in the payment processing or tech space.',
    phone: '(212) 555-0192',
    date: '2 days ago',
    link: 'https://newyork.craigslist.org/mnh/res/example1.html',
  },
  {
    title: 'Commission Sales Professional — Immediate Start',
    description: 'Outside sales background with payment processing experience. Self-motivated and results-oriented. Have worked B2B for 3+ years. Commission-only OK.',
    phone: '(718) 555-0847',
    date: 'today',
    link: 'https://newyork.craigslist.org/que/res/example2.html',
  },
  {
    title: 'Sales & Marketing Available Immediately',
    description: 'Cold calling experience. Built sales pipelines from scratch. Looking for commission opportunity. Can start right away. References available.',
    phone: '',
    date: '1 day ago',
    link: 'https://newyork.craigslist.org/brx/res/example3.html',
  },
  {
    title: 'Inside / Outside Sales — 7 Years Experience',
    description: 'Proven track record closing deals in B2B environments. Comfortable with high-volume cold calling. Payment processing background a plus.',
    phone: '(201) 555-0314',
    date: '3 days ago',
    link: 'https://newjersey.craigslist.org/res/example4.html',
  },
  {
    title: 'Cold Caller / Sales Rep Seeking Opportunity',
    description: 'Fast learner, energetic, great phone presence. Looking for commission-based role with growth potential. Available full-time immediately.',
    phone: '(646) 555-0773',
    date: '5 hours ago',
    link: 'https://newyork.craigslist.org/mnh/res/example5.html',
  },
];

/**
 * Search Craigslist resumes/job-wanted posts via the backend proxy.
 * Falls back to demo seed data ONLY when the backend is completely unreachable.
 * If the backend is reachable but returns 0 results, shows 0 results (no demo banner).
 */
export async function searchCraigslistResumesAPI(city, keywords) {
  try {
    const url = `${PROXY}/api/recruiting/craigslist-search?city=${encodeURIComponent(city)}&keywords=${encodeURIComponent(keywords)}`;
    console.log('[Craigslist] Calling:', url);
    const res = await fetch(url, { headers: getHeaders() });
    if (res.status === 401 || res.status === 403) {
      setSession(null);
      window.location.reload();
    }
    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText);
      console.error(`[Craigslist] Backend error ${res.status}:`, body.slice(0, 300));
      throw new Error(`Backend ${res.status}: ${body.slice(0, 100)}`);
    }
    const data = await res.json();
    console.log('[Craigslist] Backend response:', data?.results?.length, 'results, demo:', data?.demo);
    return data;
  } catch (err) {
    console.error('[Craigslist] API call failed, showing demo data:', err.message);
    return { demo: true, results: DEMO_CRAIGSLIST_RESULTS };
  }
}

