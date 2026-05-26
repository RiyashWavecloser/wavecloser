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
      email: r.get('Email') || '',
      passwordHash: r.get('PasswordHash') || '',
      name: r.get('Name') || '',
      role: r.get('Role') || '',
    };
  });
}
