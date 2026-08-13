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
  await base('ResumeLeads').select().eachPage((recs, next) => {
    allRecords.push(...recs);
    next();
  });

  const demoRecords = allRecords.filter(r => {
    const desc  = (r.get('Description') || '').toLowerCase();
    const url   = (r.get('CraigslistURL') || '').toLowerCase();
    const title = (r.get('Title') || '').toLowerCase();
    const agent = (r.get('AssignedTo') || '').toLowerCase();

    return (
      desc.includes('energetic sales professional') ||
      desc.includes('proven track record in outbound phone outreach') ||
      desc.includes('merchant communication') ||
      desc.includes('seeking cold calling') ||
      desc.includes('connecticut / hartford') ||
      desc.includes('orlando, fl') ||
      desc.includes('waveclosers-candidate.com') ||
      url.includes('waveclosers-candidate.com') ||
      url.includes('waveclosers.com') ||
      url.includes('example.com') ||
      url.includes('synth-candidate') ||
      url === '' ||
      (!url.startsWith('https://') && url !== '') ||
      url.includes('/search/') ||
      (!url.includes('/view/d/') && url.includes('craigslist.org')) ||
      agent.includes('agent 1') || agent.includes('agent 2') || agent.includes('agent 3') ||
      agent.includes('agent 4') || agent.includes('agent 5') || agent.includes('agent 6')
    );
  });



  console.log(`[Purge] Found ${demoRecords.length} demo/invalid record(s) out of ${allRecords.length} total.`);

  if (demoRecords.length === 0) {
    console.log('[Purge] Nothing to delete — table is already clean.');
    return;
  }

  const ids = demoRecords.map(r => r.id);


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
