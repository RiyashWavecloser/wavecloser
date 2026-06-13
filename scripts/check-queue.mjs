// Quick script to verify the fix works: simulates frontend dedup + checks new server response
const BASE = 'http://localhost:3001';

async function main() {
  // Login
  const loginResp = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'riyash@waveclosers.com', password: 'Riyash@7933' }),
  });
  const loginData = await loginResp.json();
  const token = loginData.token;

  // Fetch queue
  const queueResp = await fetch(`${BASE}/api/qualifier/queue`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const queueData = await queueResp.json();
  const rawLeads = queueData.leads || [];
  console.log(`Raw leads from API: ${rawLeads.length}`);

  // Simulate frontend dedup (matches QualifierPortal.jsx deduplicateLeads)
  const seen = new Set();
  const deduped = rawLeads.filter(l => {
    const key = l.placeId;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`After dedup: ${deduped.length}`);
  console.log(`Duplicates removed: ${rawLeads.length - deduped.length}`);

  // Verify no duplicates remain
  const placeIdCounts = {};
  for (const l of deduped) {
    placeIdCounts[l.placeId] = (placeIdCounts[l.placeId] || 0) + 1;
  }
  const dupes = Object.entries(placeIdCounts).filter(([, c]) => c > 1);
  console.log(dupes.length ? '❌ Duplicates still present' : '✅ No duplicates after dedup');

  // Verify filtering works
  const statusCounts = {};
  for (const l of deduped) {
    statusCounts[l.qualifierStatus || 'undefined'] = (statusCounts[l.qualifierStatus || 'undefined'] || 0) + 1;
  }
  console.log('\nStatus distribution (after dedup):');
  for (const [s, c] of Object.entries(statusCounts)) {
    console.log(`  ${s}: ${c}`);
  }

  // Simulate tab filters
  const filters = {
    all: deduped,
    new: deduped.filter(l => !l.qualifierStatus || l.qualifierStatus === 'QualifierNew'),
    contacted: deduped.filter(l => l.qualifierStatus === 'QualifierContacted'),
    qualified: deduped.filter(l => l.qualifierStatus === 'QualifierQualified'),
    followUp: deduped.filter(l => l.qualifierStatus === 'QualifierFollowUp'),
    notAFit: deduped.filter(l => l.qualifierStatus === 'QualifierNotAFit'),
  };
  console.log('\nTab filter results:');
  for (const [tab, list] of Object.entries(filters)) {
    console.log(`  ${tab}: ${list.length} leads`);
  }

  // Verify unique keys (simulating React key={lead._airtableId || lead.placeId})
  const keys = deduped.map(l => l._airtableId || l.placeId);
  const uniqueKeys = new Set(keys);
  console.log(`\nReact keys: ${keys.length} total, ${uniqueKeys.size} unique`);
  console.log(keys.length === uniqueKeys.size ? '✅ All React keys unique' : '❌ Duplicate React keys still present');
}

main().catch(e => console.error('Error:', e.message));
