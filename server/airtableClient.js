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
dotenv.config();

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

export function isConfigured() {
  return !!(API_KEY && BASE_ID);
}

let _base = null;
function base() {
  if (!_base) {
    if (!isConfigured()) throw new Error('[airtable] AIRTABLE_API_KEY or AIRTABLE_BASE_ID missing.');
    Airtable.configure({ apiKey: API_KEY });
    _base = new Airtable().base(BASE_ID);
  }
  return _base;
}

// ─── Retry with exponential backoff + jitter ─────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function retry(fn, attempts = 4) {
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

export async function updateLeadStatus(placeId, patch) {
  return retry(async () => {
    const recs = await base()('Leads')
      .select({ filterByFormula: `{PlaceID} = "${placeId}"`, maxRecords: 1 })
      .all();
    if (!recs.length) throw new Error(`Lead ${placeId} not found`);
    const r = await base()('Leads').update(recs[0].id, leadToFields(patch));
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

export async function assignLeadsToAgent(leadsToAssign, agentName) {
  if (!isConfigured() || !leadsToAssign || !leadsToAssign.length) return;
  const chunks = [];
  const chunkSize = 10;
  for (let i = 0; i < leadsToAssign.length; i += chunkSize) {
    chunks.push(leadsToAssign.slice(i, i + chunkSize));
  }
  for (const chunk of chunks) {
    const records = chunk.map(l => ({
      id: l._airtableId,
      fields: {
        Status: 'Assigned',
        AssignedAgent: agentName
      }
    }));
    await retry(() => base()('Leads').update(records));
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


