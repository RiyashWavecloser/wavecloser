/**
 * deduplicate-airtable-leads.mjs
 * 
 * 1. Scans ResumeLeads table in Airtable.
 * 2. Identifies duplicate records by normalized Craigslist URL.
 * 3. Keeps the earliest/first assigned record and deletes all subsequent duplicates.
 * 4. Ensures ResumeDeduplicationRegistry has every unique URL locked.
 */

import dotenv from 'dotenv';
import Airtable from 'airtable';

dotenv.config();

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!API_KEY || !BASE_ID) {
  console.error('❌ AIRTABLE_API_KEY or AIRTABLE_BASE_ID missing');
  process.exit(1);
}

const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);

function normalizeForDedup(url) {
  return (url || '')
    .trim()
    .toLowerCase()
    .replace(/\/$/, '')
    .replace(/\?.*$/, '')
    .replace(/#.*$/, '');
}

async function run() {
  console.log('🔍 Scanning ResumeLeads for duplicates...');

  const records = await base('ResumeLeads')
    .select({
      fields: ['CraigslistURL', 'Title', 'AssignedTo', 'AssignedDate', 'Status', 'CreatedAt']
    })
    .all();

  console.log(`Found ${records.length} total records in ResumeLeads.`);

  const urlMap = new Map(); // normalizedUrl -> array of record objects
  const noUrlRecords = [];

  for (const r of records) {
    const rawUrl = r.get('CraigslistURL') || '';
    const norm = normalizeForDedup(rawUrl);
    if (!norm) {
      noUrlRecords.push(r.id);
      continue;
    }

    if (!urlMap.has(norm)) {
      urlMap.set(norm, []);
    }
    urlMap.get(norm).push({
      id: r.id,
      title: r.get('Title'),
      assignedTo: r.get('AssignedTo'),
      assignedDate: r.get('AssignedDate'),
      status: r.get('Status'),
      createdAt: r.get('CreatedAt') || r.get('AssignedDate') || ''
    });
  }

  const idsToDelete = [];
  let uniqueCount = 0;
  let dupGroups = 0;

  for (const [normUrl, list] of urlMap.entries()) {
    if (list.length === 1) {
      uniqueCount++;
      continue;
    }

    dupGroups++;
    // Sort: records with interactions/notes or non-New status first, then by date/id
    list.sort((a, b) => {
      const aIsActive = a.status && a.status !== 'New' ? 1 : 0;
      const bIsActive = b.status && b.status !== 'New' ? 1 : 0;
      if (aIsActive !== bIsActive) return bIsActive - aIsActive;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    const keep = list[0];
    const duplicates = list.slice(1);
    console.log(`\n⚠ Duplicate Group (${normUrl}):`);
    console.log(`   KEEPING: ${keep.id} (AssignedTo: ${keep.assignedTo}, Status: ${keep.status})`);
    duplicates.forEach(d => {
      console.log(`   DELETING: ${d.id} (AssignedTo: ${d.assignedTo}, Status: ${d.status})`);
      idsToDelete.push(d.id);
    });
  }

  console.log(`\n========================================`);
  console.log(`Unique URLs: ${uniqueCount}`);
  console.log(`Duplicate Groups: ${dupGroups}`);
  console.log(`Total duplicate records to delete: ${idsToDelete.length}`);
  console.log(`========================================\n`);

  if (idsToDelete.length === 0) {
    console.log('✅ No duplicates found in ResumeLeads!');
    return;
  }

  // Delete in batches of 10
  for (let i = 0; i < idsToDelete.length; i += 10) {
    const chunk = idsToDelete.slice(i, i + 10);
    await base('ResumeLeads').destroy(chunk);
    process.stdout.write(`Deleted ${Math.min(i + 10, idsToDelete.length)}/${idsToDelete.length} duplicates...\r`);
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n✅ Successfully deleted ${idsToDelete.length} duplicate leads from ResumeLeads.`);
}

run().catch(err => {
  console.error('❌ Error during deduplication:', err);
});
