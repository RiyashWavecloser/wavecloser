/**
 * One-off script: delete all ResumeLeads records with the specific demo description.
 * Run: node scripts/purge-demo-resumes.js
 */
import dotenv from 'dotenv';
import Airtable from 'airtable';

dotenv.config();

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const DEMO_DESC_FRAGMENT = 'Energetic sales professional based in Orlando';

async function run() {
  console.log('[Purge] Scanning ResumeLeads for demo records...');

  let allRecords = [];
  await base('ResumeLeads').select({
    filterByFormula: `FIND("${DEMO_DESC_FRAGMENT}", {Description})`,
  }).eachPage((recs, next) => {
    allRecords.push(...recs);
    next();
  });

  console.log(`[Purge] Found ${allRecords.length} demo record(s) to delete.`);

  if (allRecords.length === 0) {
    console.log('[Purge] Nothing to delete — table is already clean.');
    return;
  }

  const ids = allRecords.map(r => r.id);

  // Delete in batches of 10 (Airtable limit)
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    await base('ResumeLeads').destroy(batch);
    console.log(`[Purge] Deleted batch ${Math.floor(i / 10) + 1}: ${batch.length} record(s)`);
  }

  console.log(`[Purge] ✓ Done — deleted ${ids.length} demo record(s) from ResumeLeads.`);
}

run().catch(err => {
  console.error('[Purge] Error:', err.message);
  process.exit(1);
});
