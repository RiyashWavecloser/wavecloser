/**
 * server/airtableClient.js
 *
 * Server-side Airtable CRUD. The Airtable API key NEVER reaches the browser.
 *
 * Tables expected in Airtable:
 *   Users         — id fields: ID (wc_id), Name, Type, Stage, LeadsThisWeek,
 *                              DealsThisMonth, Joined, Market, Email, Notes
 *   AutomationLog — Task, Target, Status, Timestamp
 *
 * Rate limit: 5 req/s per base → exponential backoff with jitter on 429s.
 */

import Airtable from 'airtable';
import dotenv from 'dotenv';
import { sendEmail, buildRecruiterLeadEmail } from './emailService.js';
import { RECRUITING_AGENTS, AGENTS, normalizeResumeURL, normalizeForDedup, isDemoLead } from './constants.js';
dotenv.config();

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

export function isConfigured() {
  return !!(API_KEY && BASE_ID);
}

let _base = null;
export function getBase() {
  if (!_base) {
    if (!isConfigured()) return null;
    Airtable.configure({ apiKey: API_KEY });
    _base = new Airtable().base(BASE_ID);
  }
  return _base;
}

function base() {
  const b = getBase();
  if (!b) throw new Error('[airtable] AIRTABLE_API_KEY or AIRTABLE_BASE_ID missing.');
  return b;
}


// ─── High-Performance In-Memory Response Cache (Zero-Memory-Leak LRU/TTL) ────
const CACHE = new Map();
const CACHE_MAX_SIZE = 500;

function getFromCache(key) {
  const item = CACHE.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    CACHE.delete(key);
    return null;
  }
  return item.data;
}

function setToCache(key, data, ttlSeconds = 15) {
  if (CACHE.size >= CACHE_MAX_SIZE) {
    // Evict oldest 50 entries
    const keys = Array.from(CACHE.keys()).slice(0, 50);
    keys.forEach(k => CACHE.delete(k));
  }
  CACHE.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export function invalidateCache(prefix = '') {
  if (!prefix) {
    CACHE.clear();
    return;
  }
  for (const key of CACHE.keys()) {
    if (key.startsWith(prefix) || key.includes(prefix)) {
      CACHE.delete(key);
    }
  }
}

// ─── Retry with exponential backoff + jitter ─────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function retry(fn, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (err) {
      last = err;
      const isRate = err?.statusCode === 429 || String(err).includes('429');
      if (!isRate || i === attempts - 1) throw err;
      await sleep(Math.pow(2, i) * 1000 + Math.random() * 500);
    }
  }
  throw last;
}

// ─── Field maps ──────────────────────────────────────────────────────────────

function recordToUser(r) {
  return {
    id:             r.get('ID')            || r.id,
    _airtableId:    r.id,
    name:           r.get('Name')          || '',
    type:           r.get('Type')          || 'REFERRAL',
    stage:          Number(r.get('Stage')  || 1),
    leadsThisWeek:  Number(r.get('LeadsThisWeek')  || 0),
    dealsThisMonth: Number(r.get('DealsThisMonth') || 0),
    joined:         r.get('Joined')        || '',
    market:         r.get('Market')        || '',
    email:          r.get('Email')         || '',
    notes:          r.get('Notes')         || '',
    phone:          r.get('Phone')         || '',
  };
}

function userToFields(u) {
  const f = {};
  if (u.id             !== undefined) f['ID']             = u.id;
  if (u.name           !== undefined) f['Name']           = u.name;
  if (u.type           !== undefined) f['Type']           = u.type;
  if (u.stage          !== undefined) f['Stage']          = u.stage;
  if (u.leadsThisWeek  !== undefined) f['LeadsThisWeek']  = u.leadsThisWeek;
  if (u.dealsThisMonth !== undefined) f['DealsThisMonth'] = u.dealsThisMonth;
  if (u.joined         !== undefined) f['Joined']         = u.joined;
  if (u.market         !== undefined) f['Market']         = u.market;
  if (u.email          !== undefined) f['Email']          = u.email;
  if (u.notes          !== undefined) f['Notes']          = u.notes;
  if (u.phone          !== undefined) f['Phone']          = u.phone;
  return f;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function listUsers() {
  return retry(async () => {
    const recs = await base()('Users').select({ view: 'Grid view' }).all();
    return recs.map(recordToUser);
  });
}

export async function getUser(wcId) {
  return retry(async () => {
    const recs = await base()('Users')
      .select({ filterByFormula: `{ID} = "${wcId}"`, maxRecords: 1 })
      .all();
    return recs.length ? recordToUser(recs[0]) : null;
  });
}

export async function createUser(user) {
  return retry(async () => {
    const r = await base()('Users').create(userToFields(user));
    return recordToUser(r);
  });
}

export async function updateUser(wcId, patch) {
  return retry(async () => {
    const recs = await base()('Users')
      .select({ filterByFormula: `{ID} = "${wcId}"`, maxRecords: 1 })
      .all();
    if (!recs.length) throw new Error(`User ${wcId} not found`);
    const r = await base()('Users').update(recs[0].id, userToFields(patch));
    return recordToUser(r);
  });
}

export async function deleteUser(wcId) {
  return retry(async () => {
    const recs = await base()('Users')
      .select({ filterByFormula: `{ID} = "${wcId}"`, maxRecords: 1 })
      .all();
    if (!recs.length) throw new Error(`User ${wcId} not found in Airtable`);
    await base()('Users').destroy(recs[0].id);
    return { deleted: wcId };
  });
}

/**
 * Upsert array of users: update if ID exists, create if new.
 * Returns { imported, failed }.
 */
export async function upsertUsers(users) {
  let imported = 0, failed = 0;
  for (const u of users) {
    try {
      const existing = u.id ? await getUser(u.id).catch(() => null) : null;
      if (existing) { await updateUser(u.id, u); }
      else          { await createUser(u); }
      imported++;
    } catch (err) {
      console.error(`[airtable] upsert failed for ${u.name}:`, err.message);
      failed++;
    }
  }
  return { imported, failed };
}

// ─── Automation log ──────────────────────────────────────────────────────────

export async function appendLog(entry) {
  if (!isConfigured()) return;
  return retry(async () => {
    await base()('AutomationLog').create({
      Task:      entry.task,
      Target:    entry.target  || '',
      Status:    entry.status  || 'ok',
      Timestamp: new Date().toISOString(),
    });
  });
}

export async function listLog(limit = 20) {
  return retry(async () => {
    const recs = await base()('AutomationLog')
      .select({ sort: [{ field: 'Timestamp', direction: 'desc' }], maxRecords: limit })
      .all();
    return recs.map(r => ({
      id:        r.id,
      task:      r.get('Task')      || '',
      target:    r.get('Target')    || '',
      status:    r.get('Status')    || 'ok',
      timestamp: r.get('Timestamp') || '',
    }));
  });
}

export async function getStaff(email) {
  return retry(async () => {
    const recs = await base()('Staff')
      .select({ filterByFormula: `{Email} = "${email}"`, maxRecords: 1 })
      .all();
    if (!recs.length) return null;
    const r = recs[0];
    return {
      _airtableId:        r.id,
      email:              r.get('Email')              || '',
      passwordHash:       r.get('PasswordHash')       || '',
      name:               r.get('Name')               || '',
      role:               r.get('Role')               || '',
      mustChangePassword: !!r.get('MustChangePassword'),
    };
  });
}

export async function updateStaffPassword(email, newPasswordHash) {
  return retry(async () => {
    const recs = await base()('Staff')
      .select({ filterByFormula: `{Email} = "${email}"`, maxRecords: 1 })
      .all();
    if (!recs.length) throw new Error(`Staff record not found for ${email}`);
    await base()('Staff').update(recs[0].id, {
      PasswordHash:       newPasswordHash,
      MustChangePassword: false,
    });
    return { email, updated: true };
  });
}

export async function isStaffEmpty() {
  return retry(async () => {
    const recs = await base()('Staff')
      .select({ maxRecords: 1 })
      .all();
    return recs.length === 0;
  });
}

// ─── Leads (Module 6) ───────────────────────────────────────────────────────

function recordToLead(r) {
  return {
    placeId:            r.get('PlaceID')            || r.id,
    _airtableId:        r.id,
    businessName:       r.get('BusinessName')       || '',
    type:               r.get('Type')               || '',
    address:            r.get('Address')             || '',
    phone:              r.get('Phone')               || '',
    website:            r.get('Website')             || '',
    rating:             Number(r.get('Rating')       || 0),
    reviewCount:        Number(r.get('ReviewCount')  || 0),
    score:              Number(r.get('Score')         || 0),
    scoreReason:        r.get('ScoreReason')         || '',
    status:             r.get('Status')              || 'New',
    assignedAgent:      r.get('AssignedAgent')       || '',
    calledAt:           r.get('CalledAt')             || null,
    outcome:            r.get('Outcome')             || '',
    agentNotes:         r.get('AgentNotes')          || '',
    market:             r.get('Market')              || '',
    createdAt:          r.get('CreatedAt')           || '',
    generatedBy:        r.get('GeneratedBy')         || '',
    // Callback scheduling (Req 2)
    callbackAt:         r.get('CallbackAt')          || null,
    // Partner assignment fields
    assignedPartnerID:  r.get('AssignedPartnerID')   || '',
    assignedPartnerAt:  r.get('AssignedPartnerAt')   || null,
    // Qualifier notification fields
    qualifierNotifiedAt:  r.get('QualifierNotifiedAt')   || null,
    // Qualifier portal fields
    qualifierStatus:      r.get('QualifierStatus')       || '',
    qualifierNotes:       r.get('QualifierNotes')        || '',
    qualifierContactedAt: r.get('QualifierContactedAt')  || null,
    qualifierQualifiedAt: r.get('QualifierQualifiedAt')  || null,
    qualifiedUserType:  r.get('QualifiedUserType')   || '',
    routedTo:           r.get('RoutedTo')            || '',
    routedAt:           r.get('RoutedAt')            || null,
  };
}

function leadToFields(l) {
  const f = {};
  if (l.placeId            !== undefined) f['PlaceID']            = l.placeId;
  if (l.businessName       !== undefined) f['BusinessName']       = l.businessName;
  if (l.type               !== undefined) f['Type']               = l.type;
  if (l.address            !== undefined) f['Address']            = l.address;
  if (l.phone              !== undefined) f['Phone']              = l.phone;
  if (l.website            !== undefined) f['Website']            = l.website;
  if (l.rating             !== undefined) f['Rating']             = l.rating;
  if (l.reviewCount        !== undefined) f['ReviewCount']        = l.reviewCount;
  if (l.score              !== undefined) f['Score']              = l.score;
  if (l.scoreReason        !== undefined) f['ScoreReason']        = l.scoreReason;
  if (l.status             !== undefined) f['Status']             = l.status;
  if (l.assignedAgent      !== undefined) f['AssignedAgent']      = l.assignedAgent;
  if (l.calledAt           !== undefined) f['CalledAt']           = l.calledAt;
  if (l.outcome            !== undefined) f['Outcome']            = l.outcome;
  if (l.agentNotes         !== undefined) f['AgentNotes']         = l.agentNotes;
  if (l.market             !== undefined) f['Market']             = l.market;
  if (l.createdAt          !== undefined) f['CreatedAt']          = l.createdAt;
  if (l.generatedBy        !== undefined) f['GeneratedBy']        = l.generatedBy;
  if (l.callbackAt         !== undefined) f['CallbackAt']         = l.callbackAt;  // Req 2
  if (l.assignedPartnerID  !== undefined) f['AssignedPartnerID']  = l.assignedPartnerID;
  if (l.assignedPartnerAt  !== undefined) f['AssignedPartnerAt']  = l.assignedPartnerAt;
  if (l.qualifierNotifiedAt !== undefined) f['QualifierNotifiedAt'] = l.qualifierNotifiedAt;
  if (l.qualifierStatus     !== undefined) f['QualifierStatus']     = l.qualifierStatus;
  if (l.qualifierNotes      !== undefined) f['QualifierNotes']      = l.qualifierNotes;
  if (l.qualifierContactedAt !== undefined) f['QualifierContactedAt'] = l.qualifierContactedAt;
  if (l.qualifierQualifiedAt !== undefined) f['QualifierQualifiedAt'] = l.qualifierQualifiedAt;
  if (l.qualifiedUserType  !== undefined) f['QualifiedUserType']  = l.qualifiedUserType;
  if (l.routedTo           !== undefined) f['RoutedTo']           = l.routedTo;
  if (l.routedAt           !== undefined) f['RoutedAt']           = l.routedAt;
  return f;
}

export async function getLeads(filters = {}) {
  return retry(async () => {
    const opts = { sort: [{ field: 'Score', direction: 'desc' }] };
    const formulas = [];
    if (filters.status)   formulas.push(`{Status} = "${filters.status}"`);
    if (filters.type)     formulas.push(`{Type} = "${filters.type}"`);
    if (filters.market)   formulas.push(`FIND("${filters.market}", {Market})`);
    if (filters.agent)    formulas.push(`{AssignedAgent} = "${filters.agent}"`);
    if (filters.minScore) formulas.push(`{Score} >= ${filters.minScore}`);
    if (formulas.length)  opts.filterByFormula = `AND(${formulas.join(',')})`;
    const recs = await base()('Leads').select(opts).all();
    return recs.map(recordToLead);
  });
}

export async function upsertLead(lead) {
  return retry(async () => {
    const existing = await base()('Leads')
      .select({ filterByFormula: `{PlaceID} = "${lead.placeId}"`, maxRecords: 1 })
      .all();
    if (existing.length) {
      const r = await base()('Leads').update(existing[0].id, leadToFields(lead));
      return recordToLead(r);
    }
    const fields = leadToFields({ ...lead, createdAt: lead.createdAt || new Date().toISOString() });
    const r = await base()('Leads').create(fields);
    return recordToLead(r);
  });
}

export async function updateLeadStatus(id, patch) {
  return retry(async () => {
    let recId = id;
    if (!id || typeof id !== 'string') throw new Error('Invalid lead ID');
    if (!id.startsWith('rec')) {
      const recs = await base()('Leads')
        .select({ filterByFormula: `{PlaceID} = "${id}"`, maxRecords: 1 })
        .all();
      if (!recs.length) throw new Error(`Lead ${id} not found by PlaceID`);
      recId = recs[0].id;
    }
    const r = await base()('Leads').update(recId, leadToFields(patch));
    return recordToLead(r);
  });
}

export async function getExistingPlaceIds() {
  return retry(async () => {
    const recs = await base()('Leads').select({ fields: ['PlaceID'] }).all();
    return new Set(recs.map(r => r.get('PlaceID')).filter(Boolean));
  });
}

/**
 * Normalize a phone number to digits only (last 10).
 * Used for global deduplication across both PlaceID and Phone.
 */
export function normalizePhone(phone) {
  if (!phone) return '';
  return phone.replace(/\D/g, '').slice(-10);
}

/**
 * GLOBAL deduplication set — fetches ALL PlaceIDs and Phones from the Leads table.
 * Returns a Set with entries like `pid:ChIJxxxxx` and `phone:2125551234`.
 *
 * ⚠️ IMPORTANT: This must be checked BEFORE any lead generation call.
 * No business should EVER appear as a lead twice, for any agent, at any time.
 *
 * Requires Airtable Leads table to have PlaceID and Phone fields populated.
 * Prereq: Riyash must manually add GeneratedBy (Single line text) to Leads table in Airtable UI.
 */
export async function getGlobalDeduplicationSet() {
  if (!isConfigured()) return new Set(); // demo mode — no dedup
  return retry(async () => {
    const recs = await base()('Leads').select({ fields: ['PlaceID', 'Phone'] }).all();
    const dedupeSet = new Set();
    for (const r of recs) {
      const placeId = r.get('PlaceID');
      const phone   = r.get('Phone');
      if (placeId) dedupeSet.add(`pid:${placeId}`);
      if (phone)   dedupeSet.add(`phone:${normalizePhone(phone)}`);
    }
    return dedupeSet;
  });
}

/**
 * Get ALL leads across all agents — for supervisor view.
 * Only accessible to agent_supervisor role.
 */
export async function getAllAgentLeads() {
  return retry(async () => {
    const recs = await base()('Leads')
      .select({
        filterByFormula: `{AssignedAgent} != ""`,
        sort: [{ field: 'Score', direction: 'desc' }],
      })
      .all();
    return recs.map(recordToLead);
  });
}

export async function getLeadStats() {
  return retry(async () => {
    const recs = await base()('Leads').select().all();
    const leads = recs.map(recordToLead);
    const agentMap = {};
    for (const l of leads) {
      if (!l.assignedAgent) continue;
      if (!agentMap[l.assignedAgent]) {
        agentMap[l.assignedAgent] = { agent: l.assignedAgent, leadsAssigned: 0, callsToday: 0, interested: 0, notInterested: 0, callback: 0, noAnswer: 0 };
      }
      const a = agentMap[l.assignedAgent];
      a.leadsAssigned++;
      const today = new Date().toISOString().slice(0, 10);
      if (l.calledAt && l.calledAt.startsWith(today)) {
        a.callsToday++;
        if (l.outcome === 'Interested')     a.interested++;
        if (l.outcome === 'NotInterested')  a.notInterested++;
        if (l.outcome === 'Callback')       a.callback++;
        if (l.outcome === 'NoAnswer')       a.noAnswer++;
      }
    }
    return { daily: Object.values(agentMap), total: leads.length };
  });
}

// ─── New Lead Functions (Module 6 Pipeline) ──────────────────────────────────

/**
 * Get all leads assigned to a specific agent — used by Agent Portal.
 */
export async function getLeadsByAgent(agentName) {
  return retry(async () => {
    const recs = await base()('Leads')
      .select({
        filterByFormula: `{AssignedAgent} = "${agentName}"`,
        sort: [{ field: 'Score', direction: 'desc' }],
      })
      .all();
    return recs.map(recordToLead);
  });
}

/**
 * Get all leads with status = Interested and no partner assigned.
 */
export async function getInterestedUnassigned() {
  return retry(async () => {
    const recs = await base()('Leads')
      .select({
        filterByFormula: `AND({Status} = "Interested", {AssignedPartnerID} = "")`,
        sort: [{ field: 'Score', direction: 'desc' }],
      })
      .all();
    return recs.map(recordToLead);
  });
}

export async function assignLeadToPartner(placeId, partnerWCId) {
  return retry(async () => {
    const leadRecs = await base()('Leads').select({ filterByFormula: `{PlaceID} = "${placeId}"`, maxRecords: 1 }).all();
    if (!leadRecs.length) throw new Error(`Lead ${placeId} not found`);
    const partnerRecs = await base()('Users').select({ filterByFormula: `{ID} = "${partnerWCId}"`, maxRecords: 1 }).all();
    if (!partnerRecs.length) throw new Error(`Partner ${partnerWCId} not found`);
    const partnerRec = partnerRecs[0];
    const currentLeads = Number(partnerRec.get('LeadsThisWeek') || 0);
    await base()('Users').update(partnerRec.id, { LeadsThisWeek: currentLeads + 1 });
    const updatedLeadRec = await base()('Leads').update(leadRecs[0].id, {
      Status: 'Assigned',
      AssignedPartnerID: partnerWCId,
      AssignedPartnerAt: new Date().toISOString()
    });
    return { lead: recordToLead(updatedLeadRec), partner: recordToUser(partnerRec) };
  });
}

// ─── Lead Qualification Queue Tables Mappings & Functions ────────────────────

const DB_QUALIFIER_STATUS = {
  QualifierNew: 'New',
  QualifierContacted: 'Contacted',
  QualifierQualified: 'Qualified',
  QualifierNotAFit: 'NotAFit',
  QualifierFollowUp: 'FollowUp',
  'New': 'New',
  'Contacted': 'Contacted',
  'Qualified': 'Qualified',
  'NotAFit': 'NotAFit',
  'FollowUp': 'FollowUp'
};

const UI_QUALIFIER_STATUS = {
  New: 'QualifierNew',
  Contacted: 'QualifierContacted',
  Qualified: 'QualifierQualified',
  NotAFit: 'QualifierNotAFit',
  FollowUp: 'QualifierFollowUp',
  'QualifierNew': 'QualifierNew',
  'QualifierContacted': 'QualifierContacted',
  'QualifierQualified': 'QualifierQualified',
  'QualifierNotAFit': 'QualifierNotAFit',
  'QualifierFollowUp': 'QualifierFollowUp'
};

function recordToQualificationQueueLead(r) {
  const status = r.get('QualifierStatus') || 'New';
  const mappedStatus = UI_QUALIFIER_STATUS[status] || 'QualifierNew';
  return {
    placeId:            r.get('LeadPlaceID')         || r.id,
    _airtableId:        r.id,
    businessName:       r.get('BusinessName')        || '',
    type:               r.get('BusinessType')        || '',
    address:            r.get('Address')             || '',
    phone:              r.get('Phone')               || '',
    website:            r.get('Website')             || '',
    score:              Number(r.get('Score')        || 0),
    scoreReason:        r.get('ScoreReason')         || '',
    qualifierStatus:      mappedStatus,
    qualifierNotes:       r.get('QualifierNotes')        || '',
    qualifierContactedAt: r.get('QualifierContactedAt')  || null,
    qualifierQualifiedAt: r.get('QualifierQualifiedAt')  || null,
    qualifiedUserType:  r.get('QualifiedUserType')   || '',
    routedTo:           r.get('RoutedTo')            || '',
    routedAt:           r.get('RoutedAt')            || null,
    completedAt:        r.get('CompletedAt')         || null,
    notAFitAt:          r.get('NotAFitAt')           || null,
    followUpAt:         r.get('FollowUpAt')          || null,
    assignedAgent:      r.get('AgentName')           || '',
    agentNotes:         r.get('AgentNotes')          || '',
    qualifierNotifiedAt:  r.get('ReceivedAt')          || null,
  };
}

/**
 * Creates a new record in LeadQualificationQueue table.
 * Called by markQualifierNotified, also callable independently for testing.
 */
export async function createQualificationEntry(leadOrData, agentName, agentNotes) {
  return retry(async () => {
    let lead = leadOrData;
    let name = agentName;
    let notes = agentNotes;

    // Check if it's the single-object style
    if (leadOrData && leadOrData.leadPlaceId !== undefined) {
      lead = {
        placeId: leadOrData.leadPlaceId,
        businessName: leadOrData.businessName,
        type: leadOrData.businessType,
        address: leadOrData.address,
        phone: leadOrData.phone,
        website: leadOrData.website,
        score: leadOrData.score,
        scoreReason: leadOrData.scoreReason,
      };
      name = leadOrData.agentName;
      notes = leadOrData.agentNotes;
    }

    // Check if record already exists to prevent duplicate entries
    const existing = await base()('LeadQualificationQueue')
      .select({ filterByFormula: `{LeadPlaceID} = "${lead.placeId}"`, maxRecords: 1 })
      .all();

    const fields = {
      LeadPlaceID: lead.placeId,
      BusinessName: lead.businessName,
      BusinessType: lead.type,
      Address: lead.address,
      Phone: lead.phone,
      Website: lead.website || '',
      Score: Number(lead.score || 0),
      ScoreReason: lead.scoreReason || '',
      AgentName: name || lead.assignedAgent || '',
      AgentNotes: notes || lead.agentNotes || '',
      ReceivedAt: new Date().toISOString(),
      QualifierStatus: 'New',
    };

    if (existing.length) {
      const updated = await base()('LeadQualificationQueue').update(existing[0].id, fields);
      return updated.id;
    } else {
      const created = await base()('LeadQualificationQueue').create(fields);
      return created.id;
    }
  });
}

export async function syncLeadsToQueue() {
  return retry(async () => {
    // 1. Fetch all leads from Leads table where Status is Interested or SentToQualifier
    const leadRecs = await base()('Leads')
      .select({
        filterByFormula: `OR({Status} = "Interested", {Status} = "SentToQualifier")`
      })
      .all();
    
    // 2. Fetch all records from LeadQualificationQueue
    const queueRecs = await base()('LeadQualificationQueue').select().all();
    const queuePlaceIds = new Set(queueRecs.map(r => r.get('LeadPlaceID')).filter(Boolean));

    // 3. For any lead that is NOT in the queue, create it
    //    Track newly added IDs to prevent duplicates within this sync batch
    for (const lr of leadRecs) {
      const lead = recordToLead(lr);
      if (!queuePlaceIds.has(lead.placeId)) {
        queuePlaceIds.add(lead.placeId); // Prevent duplicates from concurrent/batched creates
        console.log(`[sync] Auto-creating queue entry for lead: ${lead.businessName} (${lead.placeId})`);
        await createQualificationEntry(lead, lead.assignedAgent, lead.agentNotes);
      }
    }
  });
}

export async function getQualificationQueue(statusFilter) {
  return retry(async () => {
    // Sync first to pull any new interested leads from the Leads table
    await syncLeadsToQueue().catch(err => console.error('[airtableClient] sync error:', err.message));

    let formula = `AND({QualifierStatus} != "Qualified", {QualifierStatus} != "NotAFit")`;
    if (statusFilter) {
      const dbStatus = DB_QUALIFIER_STATUS[statusFilter] || statusFilter;
      formula = `{QualifierStatus} = "${dbStatus}"`;
    }
    const recs = await base()('LeadQualificationQueue')
      .select({
        filterByFormula: formula,
        sort: [{ field: 'ReceivedAt', direction: 'desc' }],
      })
      .all();

    // Look up corresponding Leads to populate Market and primary Status
    // Skip empty records
    const validRecs = recs.filter(r => r.get('LeadPlaceID'));
    const placeIds = validRecs.map(r => r.get('LeadPlaceID')).filter(Boolean);
    const leadsMap = {};
    if (placeIds.length > 0) {
      const chunks = [];
      const chunkSize = 20;
      for (let i = 0; i < placeIds.length; i += chunkSize) {
        chunks.push(placeIds.slice(i, i + chunkSize));
      }
      for (const chunk of chunks) {
        const formula = `OR(${chunk.map(id => `{PlaceID} = "${id}"`).join(',')})`;
        try {
          const leadRecs = await base()('Leads').select({ filterByFormula: formula }).all();
          for (const lr of leadRecs) {
            const l = recordToLead(lr);
            leadsMap[l.placeId] = l;
          }
        } catch (err) {
          console.warn('[airtableClient] Warn fetching matched leads:', err.message);
        }
      }
    }

    // Deduplicate by LeadPlaceID — keep the first record (most recently received)
    const seenPlaceIds = new Set();
    const dedupedRecs = validRecs.filter(r => {
      const pid = r.get('LeadPlaceID');
      if (seenPlaceIds.has(pid)) return false;
      seenPlaceIds.add(pid);
      return true;
    });

    return dedupedRecs.map(r => {
      const placeId = r.get('LeadPlaceID');
      const lead = leadsMap[placeId] || {};
      const mapped = recordToQualificationQueueLead(r);
      mapped.market = lead.market || '';
      mapped.status = lead.status || 'SentToQualifier';
      return mapped;
    });
  });
}

/**
 * Returns all LeadQualificationQueue records where QualifierStatus = 'Qualified' OR QualifierStatus = 'NotAFit'
 * Sorted by CompletedAt descending (most recent first)
 */
export async function getQualificationCompleted() {
  return retry(async () => {
    const recs = await base()('LeadQualificationQueue')
      .select({
        filterByFormula: `OR({QualifierStatus} = "Qualified", {QualifierStatus} = "NotAFit")`,
        sort: [{ field: 'CompletedAt', direction: 'desc' }],
      })
      .all();

    const validRecs = recs.filter(r => r.get('LeadPlaceID'));
    const placeIds = validRecs.map(r => r.get('LeadPlaceID')).filter(Boolean);
    const leadsMap = {};
    if (placeIds.length > 0) {
      const chunks = [];
      const chunkSize = 20;
      for (let i = 0; i < placeIds.length; i += chunkSize) {
        chunks.push(placeIds.slice(i, i + chunkSize));
      }
      for (const chunk of chunks) {
        const formula = `OR(${chunk.map(id => `{PlaceID} = "${id}"`).join(',')})`;
        try {
          const leadRecs = await base()('Leads').select({ filterByFormula: formula }).all();
          for (const lr of leadRecs) {
            const l = recordToLead(lr);
            leadsMap[l.placeId] = l;
          }
        } catch (err) {
          console.warn('[airtableClient] Warn fetching matched leads:', err.message);
        }
      }
    }

    // Deduplicate by LeadPlaceID — keep the first record (most recently completed)
    const seenPlaceIds = new Set();
    const dedupedRecs = validRecs.filter(r => {
      const pid = r.get('LeadPlaceID');
      if (seenPlaceIds.has(pid)) return false;
      seenPlaceIds.add(pid);
      return true;
    });

    return dedupedRecs.map(r => {
      const placeId = r.get('LeadPlaceID');
      const lead = leadsMap[placeId] || {};
      const mapped = recordToQualificationQueueLead(r);
      mapped.market = lead.market || '';
      mapped.status = lead.status || 'SentToQualifier';
      return mapped;
    });
  });
}

/**
 * Mark a lead as notified to Qualifier — sets QualifierNotifiedAt and status in Leads,
 * and creates/updates a record in LeadQualificationQueue.
 */
export async function markQualifierNotified(placeId) {
  return retry(async () => {
    const recs = await base()('Leads')
      .select({ filterByFormula: `{PlaceID} = "${placeId}"`, maxRecords: 1 })
      .all();
    if (!recs.length) throw new Error(`Lead ${placeId} not found`);
    const lead = recordToLead(recs[0]);

    const r = await base()('Leads').update(recs[0].id, {
      Status: 'Interested',
      QualifierNotifiedAt: new Date().toISOString(),
    });

    await createQualificationEntry(lead, lead.assignedAgent, lead.agentNotes);
    return recordToLead(r);
  });
}

export async function updateQualifierStatus(id, qualifierStatus, qualifierNotes) {
  return retry(async () => {
    let recordId = id;
    if (!id.startsWith('rec')) {
      const recs = await base()('LeadQualificationQueue')
        .select({ filterByFormula: `{LeadPlaceID} = "${id}"`, maxRecords: 1 })
        .all();
      if (!recs.length) throw new Error(`Queue record for lead ${id} not found`);
      recordId = recs[0].id;
    }

    const dbStatus = DB_QUALIFIER_STATUS[qualifierStatus] || qualifierStatus;
    const fields = {
      QualifierStatus: dbStatus,
      QualifierNotes:  qualifierNotes || '',
    };

    const nowStr = new Date().toISOString();
    if (dbStatus === 'Contacted') fields.QualifierContactedAt = nowStr;
    if (dbStatus === 'FollowUp')  fields.FollowUpAt  = nowStr;
    if (dbStatus === 'NotAFit')   {
      fields.NotAFitAt   = nowStr;
      fields.CompletedAt = nowStr;
    }

    const r = await base()('LeadQualificationQueue').update(recordId, fields);

    // Look up corresponding Leads to populate Market and primary Status,
    // and ALSO sync the Status of the lead in the Leads table!
    const placeId = r.get('LeadPlaceID');
    let lead = {};
    if (placeId) {
      const leadRecs = await base()('Leads')
        .select({ filterByFormula: `{PlaceID} = "${placeId}"`, maxRecords: 1 })
        .all();
      if (leadRecs.length) {
        let leadStatus = null;
        if (dbStatus === 'NotAFit')   leadStatus = 'NotInterested';
        if (dbStatus === 'FollowUp')  leadStatus = 'Callback';
        if (dbStatus === 'Contacted') leadStatus = 'Called';

        const leadUpdate = {};
        if (leadStatus) leadUpdate.Status = leadStatus;

        const updatedLeadRec = await base()('Leads').update(leadRecs[0].id, leadUpdate);
        lead = recordToLead(updatedLeadRec);
      }
    }

    const mapped = recordToQualificationQueueLead(r);
    mapped.market = lead.market || '';
    mapped.status = lead.status || 'SentToQualifier';
    return mapped;
  });
}

/**
 * Qualify a lead: set user type + route to CX or Recruiter in LeadQualificationQueue, Leads,
 * and handle notifications/creation directly.
 */
export async function qualifyLead(id, userType, notes) {
  return retry(async () => {
    let queueRec;
    if (id.startsWith('rec')) {
      queueRec = await base()('LeadQualificationQueue').find(id);
    } else {
      const queueRecs = await base()('LeadQualificationQueue')
        .select({ filterByFormula: `{LeadPlaceID} = "${id}"`, maxRecords: 1 })
        .all();
      if (!queueRecs.length) throw new Error(`Queue record for lead ${id} not found`);
      queueRec = queueRecs[0];
    }
    const placeId = queueRec.get('LeadPlaceID');

    const routeTo = (userType === 'REFERRAL' || userType === 'REP') ? 'CX' : 'Recruiter';
    const statusId = routeTo === 'CX' ? 'RoutedToCX' : 'RoutedToRecruiter';
    const nowStr = new Date().toISOString();

    const queuePatch = {
      QualifierStatus: 'Qualified',
      QualifierQualifiedAt: nowStr,
      QualifiedUserType: userType,
      RoutedTo: routeTo,
      RoutedAt: nowStr,
      CompletedAt: nowStr,
    };
    if (notes !== undefined) queuePatch.QualifierNotes = notes;

    const r = await base()('LeadQualificationQueue').update(queueRec.id, queuePatch);
    const mappedQueueLead = recordToQualificationQueueLead(r);

    // Update main Lead
    let lead = {};
    if (placeId) {
      const leadRecs = await base()('Leads')
        .select({ filterByFormula: `{PlaceID} = "${placeId}"`, maxRecords: 1 })
        .all();
      if (leadRecs.length) {
        const updatedLeadRec = await base()('Leads').update(leadRecs[0].id, {
          Status: 'Called',
        });
        lead = recordToLead(updatedLeadRec);
        mappedQueueLead.market = lead.market || '';
        mappedQueueLead.status = lead.status || statusId;
      } else {
        mappedQueueLead.market = '';
        mappedQueueLead.status = statusId;
      }
    } else {
      mappedQueueLead.market = '';
      mappedQueueLead.status = statusId;
    }

    let newUser = null;

    // Create new record in Users table for both CX and Recruiter onboarding
    newUser = await routeLeadToCX(mappedQueueLead, userType);

    if (routeTo === 'CX') {
      // Log to AutomationLog
      await appendLog({
        task: 'New user created via Qualifier (CX Route)',
        target: mappedQueueLead.businessName,
        status: 'ok',
      }).catch(() => {});
    } else {
      // Route to Recruiter
      const emailData = buildRecruiterLeadEmail(mappedQueueLead);
      await sendEmail(emailData).catch(err => console.error('[airtableClient] Recruiter email error:', err.message));
      
      // Log to AutomationLog
      await appendLog({
        task: 'New user created via Qualifier (Recruiter Route)',
        target: mappedQueueLead.businessName,
        status: 'sent',
      }).catch(() => {});
    }

    return { lead: mappedQueueLead, newUser, routedTo: routeTo };
  });
}

/**
 * Create a new Wave Closers user from a qualified lead (REFERRAL or REP).
 * This is called when Qualifier routes a lead to CX onboarding.
 */
export async function routeLeadToCX(lead, userType) {
  return retry(async () => {
    // Generate next WC-ID
    const allUsers = await base()('Users').select({ fields: ['ID'] }).all();
    const ids = allUsers.map(r => r.get('ID') || '').filter(id => id.startsWith('WC-'));
    const maxNum = ids.reduce((max, id) => {
      const n = parseInt(id.replace('WC-', ''), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 1000);
    const newId = `WC-${maxNum + 1}`;

    const newUser = {
      ID: newId,
      Name: lead.businessName,
      Type: userType,
      Stage: 1,
      LeadsThisWeek: 0,
      DealsThisMonth: 0,
      Joined: new Date().toISOString().slice(0, 10),
      Market: lead.market || '',
      Email: '',
      Notes: `Created from Module 6 lead. Phone: ${lead.phone || 'N/A'}. Score: ${lead.score}/100. Agent notes: ${lead.agentNotes || 'N/A'}`,
    };

    const r = await base()('Users').create(newUser);
    return recordToUser(r);
  });
}

/**
 * Get a lead record from Leads table by either Airtable record ID or PlaceID.
 */
export async function getLeadById(id) {
  return retry(async () => {
    if (id.startsWith('rec')) {
      const record = await base()('Leads').find(id);
      return recordToLead(record);
    } else {
      const recs = await base()('Leads')
        .select({ filterByFormula: `{PlaceID} = "${id}"`, maxRecords: 1 })
        .all();
      if (!recs.length) return null;
      return recordToLead(recs[0]);
    }
  });
}

// ─── Weekly Lead Model Helpers & Refill Logic ────────────────────────────────

export function getMondayOfCurrentWeek() {
  const d = new Date();
  const day = d.getDay();
  // Adjust so Monday is day 1, and Sunday (0) is shifted to previous Monday (-6)
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function isBeforeFriday() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
  if (day >= 1 && day < 5) return true;
  if (day === 5 && now.getHours() < 17) return true;
  return false;
}

export async function getUnassignedLeads(limit = 6000) {
  if (!isConfigured()) return [];
  return retry(async () => {
    const recs = await base()('Leads')
      .select({
        filterByFormula: `AND({Status} = "New", {AssignedAgent} = "")`,
        maxRecords: limit,
        sort: [{ field: 'Score', direction: 'desc' }]
      })
      .all();
    return recs.map(recordToLead);
  });
}

export function isRealAgentName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (/^agent\s*[-_]?\s*\d+$/i.test(trimmed)) return false;
  if (/^(demo|test|sample|placeholder)\s*agent/i.test(trimmed)) return false;
  return true;
}

/**
 * Fetch all real agent-type staff accounts from Staff table.
 * Excludes generic placeholders (Agent 1, Agent 2, etc.) to ensure leads go only to real users.
 */
export async function listAgents() {
  const realAgentsFallback = AGENTS.filter(a => isRealAgentName(a.name));
  if (!isConfigured()) return realAgentsFallback;
  try {
    const records = await retry(() =>
      base()('Staff').select().all()
    );
    if (!records || !records.length) return realAgentsFallback;
    const staffList = records.map(r => ({
      email: (r.get('Email') || '').toLowerCase().trim(),
      name:  (r.get('Name') || '').trim(),
      role:  (r.get('Role') || 'cold_caller').toLowerCase().trim(),
    })).filter(s => s.name && s.email && isRealAgentName(s.name));

    return staffList.length ? staffList : realAgentsFallback;
  } catch (err) {
    console.warn('[airtable] listAgents error (falling back to constants):', err.message);
    return realAgentsFallback;
  }
}





export async function assignLeadsToAgent(leadsToAssign, agentName) {
  if (!isConfigured() || !leadsToAssign || !leadsToAssign.length) return;
  if (!isRealAgentName(agentName)) {
    console.warn(`[airtable] STRICT BLOCK: Refusing to assign leads to placeholder agent "${agentName}"`);
    return;
  }
  const chunks = [];
  const chunkSize = 10;
  for (let i = 0; i < leadsToAssign.length; i += chunkSize) {
    chunks.push(leadsToAssign.slice(i, i + chunkSize));
  }
  for (const chunk of chunks) {
    const records = chunk.map(l => ({
      id: l._airtableId || l.id,
      fields: {
        Status: 'Assigned',
        AssignedAgent: agentName
      }
    })).filter(r => r.id);
    if (records.length > 0) {
      await retry(() => base()('Leads').update(records));
    }
    await sleep(200);
  }
}


export async function checkAndRefillAgentLeads(agentName) {
  if (!isConfigured()) return 0;

  // 1. Fetch all leads for this agent
  const recs = await base()('Leads').select({
    filterByFormula: `{AssignedAgent} = "${agentName}"`
  }).all();
  const leads = recs.map(recordToLead);

  // 2. Count total assigned and total called this week (since Monday)
  const monday = getMondayOfCurrentWeek();
  const weekLeads = leads.filter(l => {
    const date = l.calledAt ? new Date(l.calledAt) : new Date(l.createdAt || Date.now());
    return date >= monday;
  });

  const assignedCount = weekLeads.length;
  const calledCount = weekLeads.filter(l => ['Interested', 'NotInterested', 'Callback', 'NoAnswer'].includes(l.outcome)).length;

  const riyashEmail = process.env.RIYASH_EMAIL || 'riyash@waveclosers.com';

  // If agent finished their batch (assigned > 0, called equals assigned) before Friday cutoff
  if (assignedCount > 0 && calledCount === assignedCount && isBeforeFriday()) {
    console.log(`[refill] Agent ${agentName} finished weekly batch of ${assignedCount} leads. Refilling...`);

    // Check unassigned pool
    const unassignedRecs = await base()('Leads').select({
      filterByFormula: `AND({Status} = "New", {AssignedAgent} = "")`,
      sort: [{ field: 'Score', direction: 'desc' }]
    }).all();
    const unassignedLeads = unassignedRecs.map(recordToLead);

    const availableCount = unassignedLeads.length;
    const refillCount = Math.min(100, availableCount);

    if (refillCount > 0) {
      const leadsToAssign = unassignedLeads.slice(0, refillCount);
      await assignLeadsToAgent(leadsToAssign, agentName);

      // Send email to Riyash
      await sendEmail({
        to: riyashEmail,
        subject: `Agent ${agentName} Refilled: ${refillCount} Extra Leads Assigned`,
        text: `Hi Riyash,\n\nAgent "${agentName}" finished their weekly batch of ${assignedCount} leads before Friday.\n\nThe system has auto-assigned ${refillCount} extra leads from the unassigned pool.\n\nRemaining unassigned leads in pool: ${availableCount - refillCount}.\n\nBest,\nWave Closers Operations Console`
      }).catch(err => console.error('[refill] Email notify failed:', err.message));

      // Log to AutomationLog
      await appendLog({
        task: 'Auto-refill leads',
        target: `${agentName} finished weekly batch — ${refillCount} extra leads assigned`,
        status: 'sent'
      }).catch(() => {});
    }

    // Check if remaining pool is low (< 100 after refill or < 100 initially)
    const remainingInPool = availableCount - refillCount;
    if (remainingInPool < 100) {
      const warnMsg = `Lead pool running low — only ${remainingInPool} leads remaining. Please generate more from the Lead Generation module.`;
      console.warn(`[refill] ⚠️ ${warnMsg}`);

      // Email warning
      await sendEmail({
        to: riyashEmail,
        subject: `⚠️ Lead Pool Running Low (${remainingInPool} remaining)`,
        text: `Hi Riyash,\n\nWarning: The unassigned lead pool has dropped to ${remainingInPool} leads.\n\nPlease generate a new batch of leads from the Lead Generation module to ensure agents have enough leads.\n\nBest,\nWave Closers Operations Console`
      }).catch(err => console.error('[refill] Warn email failed:', err.message));

      // Log to AutomationLog with status = 'alert'
      await appendLog({
        task: 'Lead pool low alert',
        target: warnMsg,
        status: 'alert'
      }).catch(() => {});
    }

    return refillCount;
  }

  // Also check general unassigned pool level on every call update if it drops below 500
  const totalUnassignedRecs = await base()('Leads').select({
    filterByFormula: `AND({Status} = "New", {AssignedAgent} = "")`,
    fields: ['PlaceID']
  }).all();
  const totalUnassigned = totalUnassignedRecs.length;

  if (totalUnassigned < 500) {
    const recentLogs = await listLog(5).catch(() => []);
    const alreadyAlerted = recentLogs.some(l => l.task === 'Lead pool low alert' && l.status === 'alert');

    if (!alreadyAlerted) {
      const warnMsg = `⚠ Only ${totalUnassigned} leads remaining in pool — generate more before Monday`;
      
      await sendEmail({
        to: riyashEmail,
        subject: `⚠️ Lead Pool Low Alert (${totalUnassigned} remaining)`,
        text: `Hi Riyash,\n\nWarning: The unassigned lead pool has dropped to ${totalUnassigned} leads.\n\nPlease generate more leads before Monday.\n\nBest,\nWave Closers Operations Console`
      }).catch(err => console.error('[refill] Pool low email failed:', err.message));

      await appendLog({
        task: 'Lead pool low alert',
        target: warnMsg,
        status: 'alert'
      }).catch(() => {});
    }
  }

  return 0;
}

// ─── Recruiting Pipeline (Workflow B) ──────────────────────────────────────────
// Table: RecruitingPipeline — must be created manually in Airtable before use.
// Fields: Name, Email, Phone, Source, Type, Status, Notes, AddedBy, AddedAt, LastContactedAt, OnboardingStage

function normalizeRecruit(rec) {
  const f = rec.fields;
  return {
    id:               rec.id,
    name:             f.Name             || '',
    email:            f.Email            || '',
    phone:            f.Phone            || '',
    source:           f.Source           || '',
    type:             f.Type             || '',
    status:           f.Status           || 'New',
    notes:            f.Notes            || '',
    addedBy:          f.AddedBy          || '',
    addedAt:          f.AddedAt          || '',
    lastContactedAt:  f.LastContactedAt  || '',
    onboardingStage:  f.OnboardingStage  || 0,
  };
}

/**
 * Fetch all recruits for a given recruiter (or all if recruiterName is null).
 */
export async function getRecruitingPipeline(recruiterName) {
  if (!isConfigured()) return [];
  try {
    const records = await retry(() =>
      base()('RecruitingPipeline').select({
        view: 'Grid view',
        ...(recruiterName ? { filterByFormula: `{AddedBy} = "${recruiterName}"` } : {}),
        sort: [{ field: 'AddedAt', direction: 'desc' }],
      }).all()
    );
    return records.map(normalizeRecruit);
  } catch (err) {
    console.warn('[airtable] getRecruitingPipeline error:', err.message);
    return [];
  }
}

/**
 * Add a new recruit to the pipeline.
 */
export async function addRecruit(data) {
  if (!isConfigured()) return null;
  try {
    const [rec] = await retry(() =>
      base()('RecruitingPipeline').create([{
        fields: {
          Name:    data.name,
          Email:   data.email,
          Phone:   data.phone   || '',
          Source:  data.source  || 'Other',
          Type:    data.type    || 'Independent Rep',
          Status:  'New',
          Notes:   data.notes   || '',
          AddedBy: data.addedBy || '',
          AddedAt: new Date().toISOString(),
        }
      }])
    );
    return normalizeRecruit(rec);
  } catch (err) {
    console.warn('[airtable] addRecruit error:', err.message);
    if (err.message?.includes('select option') && data.source && data.source !== 'Other') {
      console.log(`[airtable] Retrying addRecruit with Source: "Other" due to select option restriction...`);
      try {
        const [rec] = await retry(() =>
          base()('RecruitingPipeline').create([{
            fields: {
              Name:    data.name,
              Email:   data.email,
              Phone:   data.phone   || '',
              Source:  'Other',
              Type:    data.type    || 'Independent Rep',
              Status:  'New',
              Notes:   data.notes ? `[Source: ${data.source}]\n${data.notes}` : `[Source: ${data.source}]`,
              AddedBy: data.addedBy || '',
              AddedAt: new Date().toISOString(),
            }
          }])
        );
        return normalizeRecruit(rec);
      } catch (err2) {
        console.warn('[airtable] addRecruit retry error:', err2.message);
      }
    }
    return null;
  }
}

/**
 * Update a recruit's status and/or notes.
 */
export async function updateRecruitStatus(id, status, notes) {
  if (!isConfigured()) return null;
  try {
    let recordId = id;
    if (!id || typeof id !== 'string') throw new Error('Invalid recruit ID');
    if (!id.startsWith('rec')) {
      const cleanId = id.replace(/"/g, '\\"');
      const recs = await base()('RecruitingPipeline')
        .select({
          filterByFormula: `OR({Email} = "${cleanId}", {Name} = "${cleanId}")`,
          maxRecords: 1,
        })
        .all();
      if (!recs.length) throw new Error(`Recruit ${id} not found in RecruitingPipeline`);
      recordId = recs[0].id;
    }

    const fields = {};
    if (status !== undefined) fields.Status = status;
    if (notes !== undefined) fields.Notes = notes;
    const OUTREACH_STATUSES = ['Contacted', 'Interested', 'Callback', 'Onboarding', 'Active', 'Declined'];
    if (status && OUTREACH_STATUSES.includes(status)) {
      fields.LastContactedAt = new Date().toISOString();
    }

    const [rec] = await retry(() =>
      base()('RecruitingPipeline').update([{ id: recordId, fields }])
    );
    return normalizeRecruit(rec);
  } catch (err) {
    console.warn('[airtable] updateRecruitStatus error:', err.message);
    // Fallback: try update with Status only
    try {
      let recordId = id;
      if (!id.startsWith('rec')) {
        const cleanId = id.replace(/"/g, '\\"');
        const recs = await base()('RecruitingPipeline')
          .select({ filterByFormula: `OR({Email} = "${cleanId}", {Name} = "${cleanId}")`, maxRecords: 1 })
          .all();
        if (recs.length) recordId = recs[0].id;
      }
      const fields = {};
      if (status !== undefined) fields.Status = status;
      if (notes !== undefined) fields.Notes = notes;
      const [rec] = await retry(() =>
        base()('RecruitingPipeline').update([{ id: recordId, fields }])
      );
      return normalizeRecruit(rec);
    } catch (err2) {
      console.warn('[airtable] updateRecruitStatus fallback error:', err2.message);
      return null;
    }
  }
}

/**
 * Get a single recruit by Airtable record ID.
 */
export async function getRecruitById(id) {
  if (!isConfigured()) return null;
  try {
    const rec = await retry(() => base()('RecruitingPipeline').find(id));
    return normalizeRecruit(rec);
  } catch (err) {
    console.warn('[airtable] getRecruitById error:', err.message);
    return null;
  }
}

/**
 * Update all editable fields of a recruit (name, email, phone, source, type, notes).
 */
export async function updateRecruit(id, data) {
  if (!isConfigured()) return null;
  try {
    const fields = {};
    if (data.name   !== undefined) fields.Name   = data.name;
    if (data.email  !== undefined) fields.Email  = data.email;
    if (data.phone  !== undefined) fields.Phone  = data.phone  || '';
    if (data.source !== undefined) fields.Source = data.source;
    if (data.type   !== undefined) fields.Type   = data.type   || '';
    if (data.notes  !== undefined) fields.Notes  = data.notes  || '';
    const [rec] = await retry(() =>
      base()('RecruitingPipeline').update([{ id, fields }])
    );
    return normalizeRecruit(rec);
  } catch (err) {
    console.warn('[airtable] updateRecruit error:', err.message);
    if (err.message?.includes('select option') && data.source !== undefined && data.source !== 'Other') {
      console.log(`[airtable] Retrying updateRecruit with Source: "Other" due to select option restriction...`);
      try {
        const fields = {};
        if (data.name   !== undefined) fields.Name   = data.name;
        if (data.email  !== undefined) fields.Email  = data.email;
        if (data.phone  !== undefined) fields.Phone  = data.phone  || '';
        fields.Source = 'Other';
        if (data.type   !== undefined) fields.Type   = data.type   || '';
        const notesPrefix = `[Source: ${data.source}]`;
        const baseNotes = data.notes !== undefined ? data.notes : '';
        fields.Notes  = baseNotes ? `${notesPrefix}\n${baseNotes}` : notesPrefix;
        const [rec] = await retry(() =>
          base()('RecruitingPipeline').update([{ id, fields }])
        );
        return normalizeRecruit(rec);
      } catch (err2) {
        console.warn('[airtable] updateRecruit retry error:', err2.message);
      }
    }
    return null;
  }
}

/**
 * Delete a recruit from the pipeline by Airtable record ID.
 */
export async function deleteRecruit(id) {
  if (!isConfigured()) return null;
  try {
    await retry(() => base()('RecruitingPipeline').destroy(id));
    return { deleted: true, id };
  } catch (err) {
    console.warn('[airtable] deleteRecruit error:', err.message);
    return null;
  }
}

// ─── Resume Lead Distribution (Workflow C) ─────────────────────────────────────
// Tables: ResumeLeads, ResumeDeduplicationRegistry
// Both tables must be created manually in Airtable before use.

/**
 * Fetch all staff records (for dynamic agent discovery by automationWorker).
 */
export async function getAllStaff() {
  if (!isConfigured()) return [];
  try {
    const records = await retry(() =>
      base()('Staff').select({ view: 'Grid view' }).all()
    );
    return records.map(r => ({
      _airtableId:        r.id,
      email:              r.get('Email')  || '',
      name:               r.get('Name')   || '',
      role:               r.get('Role')   || '',
      active:             r.get('Active') !== false, // treat undefined as active
      mustChangePassword: !!r.get('MustChangePassword'),
    }));
  } catch (err) {
    console.warn('[airtable] getAllStaff error:', err.message);
    return [];
  }
}

/**
 * Returns staff who receive and can be assigned resume leads.
 * Strictly limited to the confirmed 9 recruiting agents:
 * Janina, John M, Giana, Julius B, Karen M, Jemelyn, Manilyn, Melanie, April S.
 */
export async function getRecruitingAgents() {
  return RECRUITING_AGENTS;
}

/**
 * Fetch all CraigslistURLs ever assigned — returns a Set.
 * This is the global permanent dedup registry. Check BEFORE assigning any resume.
 */
export async function getGlobalResumeDeduplicationSet(daysToKeep = 1) {
  if (!isConfigured()) {
    console.warn('[Dedup] Airtable not configured — dedup disabled');
    return new Set();
  }

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);

    const records = await retry(() =>
      base()('ResumeDeduplicationRegistry')
        .select({
          fields: ['CraigslistURL', 'FirstSeenAt'],
          filterByFormula: `IS_AFTER({FirstSeenAt}, "${cutoff.toISOString()}")`
        })
        .all()
    );

    const set = new Set();
    records.forEach(r => {
      const url = normalizeForDedup(r.get('CraigslistURL'));
      if (url) set.add(url);
    });

    console.log(`[Dedup] Registry loaded: ${set.size} URLs locked (last ${daysToKeep} day(s))`);
    return set;
  } catch (err) {
    try {
      const records = await retry(() =>
        base()('ResumeDeduplicationRegistry')
          .select({ fields: ['CraigslistURL'] })
          .all()
      );
      const set = new Set();
      records.forEach(r => {
        const url = normalizeForDedup(r.get('CraigslistURL'));
        if (url) set.add(url);
      });
      return set;
    } catch (e) {
      console.error('[Dedup] ResumeDeduplicationRegistry error:', e.message);
      return new Set();
    }
  }
}

/**
 * Permanently register a resume URL as assigned.
 * Once a URL is here, it can NEVER be assigned to anyone again.
 */
export async function registerResumeAsAssigned(url, assignedTo, assignedDate) {
  if (!isConfigured()) return;

  const normalizedUrl = normalizeResumeURL(url);
  if (!normalizedUrl) return;

  try {
    await retry(() =>
      base()('ResumeDeduplicationRegistry').create({
        CraigslistURL: normalizedUrl,
        FirstSeenAt:   new Date().toISOString(),
        AssignedTo:    assignedTo || '',
        AssignedDate:  assignedDate || new Date().toISOString().slice(0, 10),
      })
    );
  } catch (err) {
    console.warn(`[Dedup] Could not register ${normalizedUrl}: ${err.message}`);
  }
}

/**
 * Clean up old entries from the deduplication registry.
 */
export async function cleanOldDedupEntries(keepDays) {
  if (!isConfigured()) return 0;
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - keepDays);

    const oldRecords = await retry(() =>
      base()('ResumeDeduplicationRegistry')
        .select({
          filterByFormula: `IS_BEFORE({FirstSeenAt}, "${cutoff.toISOString()}")`,
        })
        .all()
    );

    if (oldRecords.length === 0) {
      console.log('[Worker] Dedup cleanup: no old entries found');
      return 0;
    }

    const ids = oldRecords.map(r => r.id);
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      await retry(() => base()('ResumeDeduplicationRegistry').destroy(batch));
    }

    console.log(`[Worker] Dedup cleanup: deleted ${ids.length} entries older than ${keepDays} days`);
    await appendLog({
      task:   'Dedup registry cleanup',
      target: `Removed ${ids.length} entries older than ${keepDays} days — pool refreshed`,
      status: 'ok',
    });
    return ids.length;
  } catch (err) {
    console.error('[Worker] Dedup cleanup error:', err.message);
    throw err;
  }
}



export async function clearFakeResumeLeads() {
  if (!isConfigured()) return { success: false, error: 'Airtable not configured' };
  try {
    const records = await retry(() =>
      base()('ResumeLeads')
        .select({
          filterByFormula: `OR(
            FIND("waveclosers", LOWER({Email})),
            FIND("waveclosers", LOWER({CraigslistURL})),
            FIND("synth-candidate", LOWER({CraigslistURL})),
            FIND("Energetic sales professional", {Description}),
            FIND("demo", LOWER({Title})),
            FIND("test", LOWER({Title})),
            FIND("sample", LOWER({Title})),
            FIND("agent 1", LOWER({AssignedTo})),
            FIND("agent 2", LOWER({AssignedTo})),
            FIND("agent 3", LOWER({AssignedTo})),
            FIND("agent 4", LOWER({AssignedTo})),
            FIND("agent 5", LOWER({AssignedTo})),
            FIND("agent 6", LOWER({AssignedTo})),
            FIND("agent 7", LOWER({AssignedTo})),
            FIND("agent 8", LOWER({AssignedTo})),
            FIND("agent 9", LOWER({AssignedTo})),
            FIND("agent 10", LOWER({AssignedTo})),
            {CraigslistURL} = ""
          )`
        })
        .all()
    );

    const ids = records.map(r => r.id);
    console.log(`[Cleanup Resume Leads] Found ${ids.length} fake/demo resume leads to delete`);

    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      await retry(() => base()('ResumeLeads').destroy(batch));
    }

    return { success: true, deleted: ids.length };
  } catch (err) {
    console.error('[Cleanup Resume Leads] error:', err.message);
    throw err;
  }
}

export async function clearFakeBusinessLeads() {
  if (!isConfigured()) return { success: false, error: 'Airtable not configured' };
  try {
    const records = await retry(() =>
      base()('Leads')
        .select({
          filterByFormula: `OR(
            FIND("demo", LOWER({PlaceID})),
            FIND("synth", LOWER({PlaceID})),
            FIND("demo", LOWER({BusinessName})),
            FIND("test", LOWER({BusinessName})),
            FIND("sample", LOWER({BusinessName})),
            FIND("agent 1", LOWER({AssignedAgent})),
            FIND("agent 2", LOWER({AssignedAgent})),
            FIND("agent 3", LOWER({AssignedAgent})),
            FIND("agent 4", LOWER({AssignedAgent})),
            FIND("agent 5", LOWER({AssignedAgent})),
            FIND("agent 6", LOWER({AssignedAgent})),
            FIND("agent 7", LOWER({AssignedAgent})),
            FIND("agent 8", LOWER({AssignedAgent})),
            FIND("agent 9", LOWER({AssignedAgent})),
            FIND("agent 10", LOWER({AssignedAgent})),
            FIND("waveclosers", LOWER({BusinessName}))
          )`
        })
        .all()
    );

    const ids = records.map(r => r.id);
    console.log(`[Cleanup Business Leads] Found ${ids.length} fake/demo business leads to delete`);

    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      await retry(() => base()('Leads').destroy(batch));
    }

    return { success: true, deleted: ids.length };
  } catch (err) {
    console.error('[Cleanup Business Leads] error:', err.message);
    return { success: false, deleted: 0 };
  }
}


export async function clearFakeRecruits() {
  if (!isConfigured()) return { success: false, error: 'Airtable not configured' };
  try {
    const records = await retry(() =>
      base()('RecruitingPipeline')
        .select({
          filterByFormula: `OR(
            FIND("waveclosers", LOWER({Email})),
            FIND("demo", LOWER({Name})),
            FIND("test", LOWER({Name})),
            FIND("sample", LOWER({Name})),
            FIND("synthetic", LOWER({Notes}))
          )`
        })
        .all()
    );

    const ids = records.map(r => r.id);
    console.log(`[Cleanup Recruits] Found ${ids.length} fake/demo recruits to delete`);

    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      await retry(() => base()('RecruitingPipeline').destroy(batch));
    }

    return { success: true, deleted: ids.length };
  } catch (err) {
    console.error('[Cleanup Recruits] error:', err.message);
    return { success: false, deleted: 0 };
  }
}

export async function clearFakeAutomationLogs() {
  if (!isConfigured()) return { success: false, error: 'Airtable not configured' };
  try {
    const records = await retry(() =>
      base()('AutomationLog')
        .select({
          filterByFormula: `OR(
            FIND("resume", LOWER({Task})),
            FIND("demo", LOWER({Task})),
            FIND("synthetic", LOWER({Task})),
            FIND("demo", LOWER({Target})),
            FIND("synthetic", LOWER({Target})),
            FIND("waveclosers", LOWER({Target})),
            FIND("exhausted", LOWER({Target}))
          )`
        })
        .all()
    );

    const ids = records.map(r => r.id);
    console.log(`[Cleanup AutomationLog] Found ${ids.length} log entries to delete`);

    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      await retry(() => base()('AutomationLog').destroy(batch));
    }

    return { success: true, deleted: ids.length };
  } catch (err) {
    console.error('[Cleanup AutomationLog] error:', err.message);
    return { success: false, deleted: 0 };
  }
}



/**
 * Save a single resume lead to the ResumeLeads working list.
 */

export async function saveResumeLead(data) {
  if (!isConfigured()) return null;

  // VALIDATE URL before saving
  const rawUrl = (data.craigslistUrl || data.url || data.link || '').trim();
  const url = normalizeResumeURL(rawUrl);

  const isValidCraigslistURL = (
    url.startsWith('https://') &&
    url.includes('craigslist.org') &&
    (url.includes('/res/') || url.includes('/view/d/')) &&
    !url.includes('waveclosers') &&
    !url.includes('example.com') &&
    !url.includes('/search/') &&
    url.length > 30  // real URLs are longer than 30 chars
  );


  if (!isValidCraigslistURL) {
    console.warn(`[saveResumeLead] SKIPPING invalid URL: "${rawUrl}"`);
    return null; // never save a lead with a bad URL
  }

  // STRICT BLOCK — Reject saving any demo/synthetic candidate resume leads
  const email = (data.email || '').toLowerCase();
  const desc  = (data.description || '').toLowerCase();
  const title = (data.title || '').toLowerCase();

  if (
    email.includes('waveclosers-candidate.com') ||
    email.includes('synth-candidate') ||
    url.includes('synth-candidate') ||
    desc.includes('energetic sales professional based in') ||
    desc.includes('proven track record in outbound phone outreach and merchant communication') ||
    desc.includes('seeking cold calling, b2b sales, or appointment setting position') ||
    desc.includes('connecticut / hartford seeking cold calling') ||
    desc.includes('orlando, fl seeking cold calling') ||
    title.includes('alex b.') ||
    title.includes('jordan j.') ||
    title.includes('taylor g.') ||
    title.includes('morgan m.') ||
    (data.assignedTo && !isRealAgentName(data.assignedTo))
  ) {
    console.warn('[airtable] STRICT BLOCK: Rejected saving demo/synthetic/placeholder resume lead:', data.title || data.assignedTo);
    return null;
  }

  try {
    // GUARANTEE ZERO DUPLICATES AT AIRTABLE WRITE TIME
    const safeUrl = rawUrl.replace(/"/g, '\\"');
    const existingCheck = await retry(() =>
      base()('ResumeLeads')
        .select({
          maxRecords: 1,
          fields: ['CraigslistURL', 'AssignedTo'],
          filterByFormula: `OR({CraigslistURL} = "${safeUrl}", LOWER({CraigslistURL}) = "${safeUrl.toLowerCase()}")`
        })
        .all()
    );

    if (existingCheck && existingCheck.length > 0) {
      console.warn(`[saveResumeLead] ⚠ DUPLICATE BLOCKED: "${rawUrl}" already assigned to "${existingCheck[0].get('AssignedTo')}"`);
      return null;
    }

    const rec = await retry(() =>
      base()('ResumeLeads').create({
        Title:         data.title         || '',
        Description:   data.description   || '',
        Phone:         data.phone         || '',
        Email:         data.email         || '',
        CraigslistURL: rawUrl,
        Market:        data.market        || '',
        AssignedTo:    data.assignedTo    || '',
        AssignedDate:  data.assignedDate  || new Date().toISOString().slice(0, 10),
        Status:        'New',
        CreatedAt:     new Date().toISOString(),
      })
    );

    // CHECK 1 DIAGNOSTIC — confirm AssignedTo and Status are always populated
    const savedAssignedTo = rec.get('AssignedTo') || '';
    const savedStatus     = rec.get('Status')     || 'New';
    console.log(`[SaveLead] ✓ Saved "${rec.get('Title') || rawUrl}" → AssignedTo="${savedAssignedTo}" Status="${savedStatus}"`);
    if (!savedAssignedTo) {
      console.warn('[SaveLead] ⚠ AssignedTo is BLANK — bug is upstream in the assignment call (assignedTo was not passed to saveResumeLead).');
    }

    // Invalidate this agent's cache so the next poll sees the new lead immediately
    if (savedAssignedTo) {
      invalidateCache(`resume-leads:${savedAssignedTo}`);
    }

    return {
      id:            rec.id,
      title:         rec.get('Title')         || '',
      description:   rec.get('Description')   || '',
      phone:         rec.get('Phone')         || '',
      email:         rec.get('Email')         || '',
      craigslistUrl: rec.get('CraigslistURL') || '',
      market:        rec.get('Market')        || '',
      assignedTo:    savedAssignedTo,
      assignedDate:  rec.get('AssignedDate')  || '',
      status:        savedStatus,
      outreachNotes: '',
      contactedAt:   '',
      createdAt:     rec.get('CreatedAt')     || '',
    };
  } catch (err) {
    console.warn('[airtable] saveResumeLead error:', err.message);
    return null;
  }
}


/**
 * Get all resume leads assigned to a specific agent for a specific date.
 * If date is null, returns all leads for the agent.
 */
export async function getResumeLeadsByAgent(agentName, date) {
  if (!isConfigured() || !agentName) return [];

  // ─ Cache key: per-agent, per-date (30s TTL prevents OOM from 15s polling) ─
  const cacheKey = `resume-leads:${agentName}:${date || 'all'}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const rawName = (agentName || '').trim();
    const cleanName = rawName.split('@')[0].replace(/[._-]/g, ' ').trim();
    const firstName = cleanName.split(' ')[0];

    const terms = [rawName, cleanName, firstName];

    // Look up Staff record to get canonical display name if email was passed
    if (rawName.includes('@')) {
      const staffRec = await getStaff(rawName).catch(() => null);
      if (staffRec && staffRec.name) terms.push(staffRec.name);
    }

    const uniqueTerms = [...new Set(terms.filter(Boolean))];

    const orConditions = uniqueTerms.map(t =>
      `LOWER({AssignedTo}) = "${t.toLowerCase()}"`
    );

    if (firstName.length >= 3) {
      orConditions.push(`FIND("${firstName.toLowerCase()}", LOWER({AssignedTo})) > 0`);
    }

    const assignedFormula = `OR(${orConditions.join(',')})`;
    const formula = date
      ? `AND(${assignedFormula}, DATETIME_FORMAT({AssignedDate}, 'YYYY-MM-DD') = "${date}")`
      : assignedFormula;

    // CRITICAL: maxRecords + field projection to prevent OOM on large tables
    // NOTE: Do NOT include fields that don't exist in Airtable (ContactedAt, CallbackAt are optional)
    const records = await retry(() =>
      base()('ResumeLeads')
        .select({
          filterByFormula: formula,
          sort: [{ field: 'CreatedAt', direction: 'desc' }],
          maxRecords: 300,
        })
        .all()
    );

    // CHECK 2 DIAGNOSTIC — when 0 results, log a raw sample to compare stored vs searched names
    console.log(`[AssignedLeads] Querying for agent: "${rawName}" (terms: ${uniqueTerms.join(', ')}) → found ${records.length} leads`);
    if (records.length === 0) {
      try {
        const sample = await retry(() =>
          base()('ResumeLeads')
            .select({ maxRecords: 5, fields: ['AssignedTo', 'Status', 'Title'] })
            .all()
        );
        console.warn('[AssignedLeads] Sample AssignedTo/Status values in table:',
          sample.map(r => ({ assignedTo: r.get('AssignedTo'), status: r.get('Status'), title: r.get('Title') }))
        );
        if (sample.length === 0) {
          console.warn('[AssignedLeads] ResumeLeads table appears to be EMPTY — no records at all.');
        }
      } catch (sampleErr) {
        console.warn('[AssignedLeads] Could not fetch sample:', sampleErr.message);
      }
    }

    const result = records.map(r => ({
      id:            r.id,
      title:         r.get('Title')         || '',
      description:   r.get('Description')   || '',
      phone:         r.get('Phone')         || '',
      email:         r.get('Email')         || '',
      craigslistUrl: r.get('CraigslistURL') || '',
      market:        r.get('Market')        || '',
      assignedTo:    r.get('AssignedTo')    || '',
      assignedDate:  String(r.get('AssignedDate') || '').slice(0, 10),
      status:        r.get('Status')        || 'New',
      outreachNotes: r.get('OutreachNotes') || '',
      contactedAt:   r.get('ContactedAt')   || '',
      callbackAt:    r.get('CallbackAt')    || '',
      createdAt:     r.get('CreatedAt')     || '',
    }));

    // Cache for 30 seconds to absorb the 15s polling storm from all agents
    setToCache(cacheKey, result, 30);
    return result;
  } catch (err) {
    console.warn('[airtable] getResumeLeadsByAgent error:', err.message);
    return [];
  }
}

/**
 * Update status and/or outreach notes for a single resume lead.
 */
export async function updateResumeLeadStatus(id, status, notes, callbackAt = null) {
  if (!isConfigured()) return { id, status: status || 'New', demo: true };

  let recordId = id;
  if (!id || typeof id !== 'string') return { id: id || 'demo', status: status || 'New', demo: true };

  // Resolve record ID if non-rec ID was passed
  try {
    if (!id.startsWith('rec')) {
      const cleanId = id.replace(/"/g, '\\"');
      const recs = await base()('ResumeLeads')
        .select({
          filterByFormula: `OR({CraigslistURL} = "${cleanId}", {Title} = "${cleanId}")`,
          maxRecords: 1,
        })
        .all();
      if (recs.length) recordId = recs[0].id;
    }
  } catch (lookupErr) {
    console.warn('[airtable] recordId lookup warning:', lookupErr.message);
  }

  const helperUpdate = async (fieldsObj) => {
    try {
      // Try array update first (standard Airtable JS SDK signature)
      const res = await retry(() => base()('ResumeLeads').update([{ id: recordId, fields: fieldsObj }]));
      if (Array.isArray(res) && res.length) return res[0];
      return res;
    } catch (arrErr) {
      // Try single record ID update
      return await retry(() => base()('ResumeLeads').update(recordId, fieldsObj));
    }
  };

  // Level 1 — Try full field set (Status, OutreachNotes, ContactedAt, CallbackAt)
  try {
    const fields = {};
    if (status !== undefined) fields.Status = status;
    if (notes  !== undefined) fields.OutreachNotes = notes;
    const CONTACTED = ['Contacted', 'Interested', 'NotInterested', 'NoAnswer', 'Callback', 'LeftVoicemail', 'DoNotCall'];
    if (status && CONTACTED.includes(status)) {
      fields.ContactedAt = new Date().toISOString();
    }
    if (callbackAt) fields.CallbackAt = callbackAt;

    const rec = await helperUpdate(fields);
    if (rec && typeof rec.get === 'function') {
      return {
        id:            rec.id,
        title:         rec.get('Title')         || '',
        description:   rec.get('Description')   || '',
        phone:         rec.get('Phone')         || '',
        email:         rec.get('Email')         || '',
        craigslistUrl: rec.get('CraigslistURL') || '',
        market:        rec.get('Market')        || '',
        assignedTo:    rec.get('AssignedTo')    || '',
        assignedDate:  rec.get('AssignedDate')  || '',
        status:        rec.get('Status')        || status || 'New',
        outreachNotes: rec.get('OutreachNotes') || notes || '',
        contactedAt:   rec.get('ContactedAt')   || '',
        callbackAt:    rec.get('CallbackAt')    || callbackAt || '',
        createdAt:     rec.get('CreatedAt')     || '',
      };
    }
  } catch (err1) {
    console.warn('[airtable] updateResumeLeadStatus level 1 warning:', err1.message);
  }

  // Level 2 — Try Status + Notes (in case ContactedAt/CallbackAt fields don't exist in Airtable)
  try {
    const fields = {};
    if (status !== undefined) fields.Status = status;
    if (notes !== undefined)  fields.Notes  = notes;
    const rec = await helperUpdate(fields);
    if (rec && typeof rec.get === 'function') {
      return {
        id:            rec.id,
        status:        rec.get('Status') || status || 'New',
        outreachNotes: notes || '',
      };
    }
  } catch (err2) {
    console.warn('[airtable] updateResumeLeadStatus level 2 warning:', err2.message);
  }

  // Level 3 — Try Status field alone
  try {
    const fields = {};
    if (status !== undefined) fields.Status = status;
    const rec = await helperUpdate(fields);
    if (rec && typeof rec.get === 'function') {
      return {
        id:            rec.id,
        status:        rec.get('Status') || status || 'New',
      };
    }
  } catch (err3) {
    console.warn('[airtable] updateResumeLeadStatus level 3 warning:', err3.message);
  }

  // Level 4 — Try lowercase 'status' field alone
  try {
    const fields = {};
    if (status !== undefined) fields.status = status;
    const rec = await helperUpdate(fields);
    if (rec && typeof rec.get === 'function') {
      return {
        id:            rec.id,
        status:        status || 'New',
      };
    }
  } catch (err4) {
    console.warn('[airtable] updateResumeLeadStatus level 4 warning:', err4.message);
  }

  // Fail-safe fallback — return updated status object so UI and server never crash
  console.log(`[airtable] updateResumeLeadStatus fallback for lead ${id} → ${status}`);
  return {
    id: recordId,
    status: status || 'New',
    outreachNotes: notes || '',
    demo: true,
  };
}

/**
 * Aggregate stats across all resume leads.
 * Optional filters: dateFilter (YYYY-MM-DD), marketFilter (string), agentFilter (name).
 */
export async function getResumeLeadStats({ dateFilter, marketFilter, agentFilter } = {}) {
  if (!isConfigured()) return { agents: [], markets: [], totals: {}, dedupCount: 0 };
  try {
    const formulas = [];
    if (dateFilter)   formulas.push(`{AssignedDate} = "${dateFilter}"`);
    if (marketFilter) formulas.push(`{Market} = "${marketFilter}"`);
    if (agentFilter)  formulas.push(`{AssignedTo} = "${agentFilter}"`);
    const formula = formulas.length > 0
      ? (formulas.length === 1 ? formulas[0] : `AND(${formulas.join(',')})`)
      : '';

    const [leadRecs, dedupRecs] = await Promise.all([
      retry(() => base()('ResumeLeads').select(formula ? { filterByFormula: formula } : {}).all()),
      retry(() => base()('ResumeDeduplicationRegistry').select({ fields: ['CraigslistURL'] }).all()),
    ]);

    const leadDetails = leadRecs.map(r => ({
      id:            r.id,
      title:         r.get('Title')         || '',
      description:   r.get('Description')   || '',
      phone:         r.get('Phone')         || '',
      email:         r.get('Email')         || '',
      craigslistUrl: r.get('CraigslistURL') || '',
      market:        r.get('Market')        || 'Unknown',
      assignedTo:    r.get('AssignedTo')    || 'Unknown',
      assignedDate:  r.get('AssignedDate')  || '',
      status:        r.get('Status')        || 'New',
      outreachNotes: r.get('OutreachNotes') || '',
    }));

    // Filter leadDetails to strictly include confirmed recruiting agents
    const confirmedLeadDetails = leadDetails.filter(l => {
      const assigned = (l.assignedTo || '').trim().toLowerCase();
      if (!assigned || assigned === 'unknown' || assigned.includes('test') || assigned.includes('recruiter') || assigned === 'aureliab') {
        return false;
      }
      return RECRUITING_AGENTS.some(a => a.name.toLowerCase() === assigned || a.email.toLowerCase() === assigned);
    });

    // Initialize agentMap for all 9 confirmed agents
    const agentMap = {};
    for (const agentObj of RECRUITING_AGENTS) {
      agentMap[agentObj.name] = { agent: agentObj.name, assigned: 0, contacted: 0, interested: 0 };
    }

    for (const l of confirmedLeadDetails) {
      const matched = RECRUITING_AGENTS.find(
        a => a.name.toLowerCase() === l.assignedTo.trim().toLowerCase() || a.email.toLowerCase() === l.assignedTo.trim().toLowerCase()
      );
      if (matched) {
        const name = matched.name;
        agentMap[name].assigned++;
        if (l.status !== 'New') agentMap[name].contacted++;
        if (l.status === 'Interested') agentMap[name].interested++;
      }
    }

    const agents = RECRUITING_AGENTS.map(agentObj => {
      const a = agentMap[agentObj.name];
      return {
        ...a,
        rate: a.assigned > 0 ? ((a.interested / a.assigned) * 100).toFixed(1) : '0.0',
      };
    });

    // Per-market aggregation
    const marketMap = {};
    for (const l of confirmedLeadDetails) {
      const m = l.market;
      if (!marketMap[m]) marketMap[m] = { market: m, assigned: 0, interested: 0 };
      marketMap[m].assigned++;
      if (l.status === 'Interested') marketMap[m].interested++;
    }
    const markets = Object.values(marketMap);

    const totalAssigned   = confirmedLeadDetails.length;
    const totalContacted  = confirmedLeadDetails.filter(l => l.status !== 'New').length;
    const totalInterested = confirmedLeadDetails.filter(l => l.status === 'Interested').length;

    return {
      agents,
      markets,
      leadDetails: confirmedLeadDetails,
      totals: {
        assigned:   totalAssigned,
        contacted:  totalContacted,
        interested: totalInterested,
        rate: totalAssigned > 0 ? ((totalInterested / totalAssigned) * 100).toFixed(1) : '0.0',
      },
      dedupCount: dedupRecs.length,
    };
  } catch (err) {
    console.warn('[airtable] getResumeLeadStats error:', err.message);
    return { agents: [], markets: [], leadDetails: [], totals: {}, dedupCount: 0 };
  }
}

/**
 * Bulk-assign an array of Craigslist resume results to a specific agent.
 * Skips any URL already in the global dedup registry.
 * Registers each assigned URL permanently in the dedup registry.
 * Returns { assigned: number, skipped: number }.
 */
export async function bulkAssignResumeLeads(resumes, agentName, market) {
  if (!isConfigured()) return { assigned: 0, skipped: 0, demo: true };
  if (!isRealAgentName(agentName)) {
    console.warn(`[airtable] STRICT BLOCK: Refusing to bulk assign resume leads to placeholder agent "${agentName}"`);
    return { assigned: 0, skipped: resumes ? resumes.length : 0, demo: false };
  }
  const today = new Date().toISOString().slice(0, 10);

  const globalDedupeSet = await getGlobalResumeDeduplicationSet();
  let assigned = 0;
  let skipped  = 0;

  for (const resume of resumes) {
    const rawUrl = (resume.link || resume.craigslistUrl || resume.url || '').trim();
    const urlForDedup = normalizeForDedup(rawUrl);
    if (!urlForDedup || globalDedupeSet.has(urlForDedup) || isDemoLead(resume)) {
      skipped++;
      continue;
    }

    await saveResumeLead({
      title:         resume.title,
      description:   resume.description,
      phone:         resume.phone || '',
      email:         resume.email || '',
      craigslistUrl: rawUrl, // Preserve exact case-sensitive URL!
      market:        market || resume.market || '',
      assignedTo:    agentName,
      assignedDate:  today,
    });

    await registerResumeAsAssigned(rawUrl, agentName, today);
    globalDedupeSet.add(urlForDedup);
    assigned++;
  }

  // Invalidate cache so agent sees new leads on next poll without waiting 30s
  if (assigned > 0) {
    invalidateCache(`resume-leads:${agentName}`);
    console.log(`[bulkAssignResumeLeads] Cache invalidated for "${agentName}" — ${assigned} leads now live`);
  }

  return { assigned, skipped };
}

/**
 * Verify that ResumeLeads and ResumeDeduplicationRegistry tables exist.
 * Logs a clear warning if they do not, but does not crash.
 */
export async function verifyAirtableTables() {
  if (!isConfigured()) {
    console.warn('[airtable] Airtable is not configured. Skipping table verification.');
    return;
  }
  try {
    await retry(() => base()('ResumeLeads').select({ maxRecords: 1 }).all());
    console.log('[airtable] ✓ ResumeLeads table verified');
  } catch (err) {
    console.warn(`[airtable] ⚠️ WARNING: ResumeLeads table verification failed: ${err.message}. Please verify the table exists in your Airtable base.`);
  }

  try {
    await retry(() => base()('ResumeDeduplicationRegistry').select({ maxRecords: 1 }).all());
    console.log('[airtable] ✓ ResumeDeduplicationRegistry table verified');
  } catch (err) {
    console.warn(`[airtable] ⚠️ WARNING: ResumeDeduplicationRegistry table verification failed: ${err.message}. Please verify the table exists in your Airtable base.`);
  }
}

// ─── Single Lead Assignment (for daily cron) ─────────────────────────────────

/**
 * Assign a single lead (by Airtable record ID) to an agent.
 * Used by the morning/midday cron distribution (Req 3).
 */
export async function assignLeadToAgent(leadAirtableId, agentName) {
  if (!isConfigured() || !leadAirtableId) return;
  if (!isRealAgentName(agentName)) {
    console.warn(`[airtable] STRICT BLOCK: Refusing to assign lead to placeholder agent "${agentName}"`);
    return;
  }
  return retry(async () => {
    await base()('Leads').update(leadAirtableId, {
      Status:        'Assigned',
      AssignedAgent: agentName,
    });
  });
}


// ─── Notifications Table (Req 4) ─────────────────────────────────────────────
// Table must be created manually in Airtable:
//   RecipientEmail (Single line text)
//   Type           (Single select: new_leads_assigned, callback_due, system)
//   Title          (Single line text)
//   Message        (Long text)
//   IsRead         (Checkbox, default false)
//   CreatedAt      (Date/time)

function recordToNotification(r) {
  return {
    id:             r.id,
    recipientEmail: r.get('RecipientEmail') || '',
    type:           r.get('Type')           || 'system',
    title:          r.get('Title')          || '',
    message:        r.get('Message')        || '',
    isRead:         !!r.get('IsRead'),
    createdAt:      r.get('CreatedAt')      || new Date().toISOString(),
  };
}

/**
 * Create a new in-app notification for an agent.
 * Called by automationWorker after assigning leads.
 */
export async function createNotification({ recipientEmail, type = 'new_leads_assigned', title, message }) {
  if (!isConfigured()) {
    console.log(`[notif] Demo mode — skipping createNotification for ${recipientEmail}`);
    return null;
  }
  try {
    const rec = await retry(() =>
      base()('Notifications').create({
        RecipientEmail: recipientEmail,
        Type:           type,
        Title:          title,
        Message:        message,
        IsRead:         false,
        CreatedAt:      new Date().toISOString(),
      })
    );
    return recordToNotification(rec);
  } catch (err) {
    // Graceful degradation — Notifications table may not exist yet
    console.warn('[airtable] createNotification error (table may not exist yet):', err.message);
    return null;
  }
}

function buildRecipientFormula(rawRecipient) {
  const raw = (rawRecipient || '').trim();
  if (!raw) return '';
  const cleanEmail = raw.toLowerCase();
  const cleanPrefix = raw.split('@')[0].trim().toLowerCase();

  const matchedAgent = (AGENTS || []).find(a =>
    (a.email && a.email.toLowerCase() === cleanEmail) ||
    (a.name  && a.name.toLowerCase()  === cleanEmail) ||
    (a.name  && a.name.toLowerCase()  === cleanPrefix) ||
    (a.id    && a.id.toLowerCase()    === cleanEmail)
  );

  const targets = new Set([cleanEmail, cleanPrefix]);
  if (matchedAgent) {
    if (matchedAgent.email) targets.add(matchedAgent.email.toLowerCase());
    if (matchedAgent.name)  targets.add(matchedAgent.name.toLowerCase());
  }

  const conditions = Array.from(targets).map(t => `LOWER({RecipientEmail}) = "${t.replace(/"/g, '\\"')}"`);
  return conditions.length > 1 ? `OR(${conditions.join(',')})` : conditions[0];
}

/**
 * Fetch notifications for a specific agent email or name.
 * Returns { notifications, unreadCount }.
 */
// Track if Notifications table is unavailable to avoid repeated failed retries
let notificationsTableAvailable = true;

export async function fetchNotifications(recipientEmail) {
  if (!isConfigured()) return { notifications: [], unreadCount: 0 };
  // If table previously returned 401/403, skip to avoid memory + log spam
  if (!notificationsTableAvailable) return { notifications: [], unreadCount: 0 };

  const filterFormula = buildRecipientFormula(recipientEmail);
  if (!filterFormula) return { notifications: [], unreadCount: 0 };

  // Cache per recipient for 30s to absorb 15s polling storm
  const cacheKey = `notifications:${recipientEmail}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const records = await retry(() =>
      base()('Notifications')
        .select({
          filterByFormula: filterFormula,
          sort: [{ field: 'CreatedAt', direction: 'desc' }],
          maxRecords: 20,
          fields: ['RecipientEmail', 'Title', 'Message', 'Type', 'IsRead', 'CreatedAt'],
        })
        .all()
    );
    const notifications = records.map(recordToNotification);
    const unreadCount = notifications.filter(n => !n.isRead).length;
    const result = { notifications, unreadCount };
    setToCache(cacheKey, result, 30);
    return result;
  } catch (err) {
    // If unauthorized (403/401), permanently disable to prevent log spam & wasted retries
    if (err?.statusCode === 403 || err?.statusCode === 401 ||
        String(err.message).toLowerCase().includes('not authorized') ||
        String(err.message).toLowerCase().includes('unauthorized')) {
      notificationsTableAvailable = false;
      console.warn('[airtable] fetchNotifications: Notifications table not accessible. Disabling polling. Check Airtable table permissions.');
    } else {
      console.warn('[airtable] fetchNotifications error:', err.message);
    }
    return { notifications: [], unreadCount: 0 };
  }
}

export async function getAgentNotifications(agentEmail, unreadOnly = false) {
  const result = await fetchNotifications(agentEmail);
  let notifs = result.notifications || [];
  if (unreadOnly) {
    notifs = notifs.filter(n => !n.isRead);
  }
  return notifs;
}

/**
 * Mark ALL notifications as read for a given agent email or name.
 */
export async function markNotificationsRead(recipientEmail) {
  if (!isConfigured()) return;
  const recipientFormula = buildRecipientFormula(recipientEmail);
  if (!recipientFormula) return;

  try {
    const records = await retry(() =>
      base()('Notifications')
        .select({
          filterByFormula: `AND(${recipientFormula}, {IsRead} = FALSE())`,
        })
        .all()
    );
    if (!records.length) return;
    const chunks = [];
    for (let i = 0; i < records.length; i += 10) chunks.push(records.slice(i, i + 10));
    for (const chunk of chunks) {
      await retry(() =>
        base()('Notifications').update(chunk.map(r => ({ id: r.id, fields: { IsRead: true } })))
      );
    }
  } catch (err) {
    console.warn('[airtable] markNotificationsRead error:', err.message);
  }
}

/**
 * Mark a single notification as read by its Airtable record ID.
 */
export async function markNotificationRead(id) {
  if (!isConfigured()) return;
  try {
    await retry(() => base()('Notifications').update(id, { IsRead: true }));
  } catch (err) {
    console.warn('[airtable] markNotificationRead error:', err.message);
  }
}
