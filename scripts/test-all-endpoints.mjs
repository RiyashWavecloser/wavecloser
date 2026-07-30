const BASE = 'http://localhost:3001';

async function run() {
  // 1. Admin Login
  console.log('--- 1. Admin Login ---');
  const lr = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'testadmin@waveclosers.com', password: 'TestAdmin1!' })
  });
  const ld = await lr.json();
  const token = ld.token;
  console.log('Login status:', lr.status, ld.user ? 'OK - role: ' + ld.user.role : JSON.stringify(ld).slice(0, 100));

  const H = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };

  // 2. Health check
  console.log('\n--- 2. Health ---');
  const hr = await fetch(BASE + '/health');
  const hd = await hr.json();
  console.log('Health:', hr.status, JSON.stringify(hd).slice(0, 120));

  // 3. Users list
  console.log('\n--- 3. Users ---');
  const ur = await fetch(BASE + '/api/users', { headers: H });
  const ud = await ur.json();
  console.log('Users:', ur.status, Array.isArray(ud) ? ud.length + ' users' : JSON.stringify(ud).slice(0, 80));

  // 4. Leads list
  console.log('\n--- 4. Leads ---');
  const ldr = await fetch(BASE + '/api/leads', { headers: H });
  const ldd = await ldr.json();
  console.log('Leads:', ldr.status, Array.isArray(ldd) ? ldd.length + ' leads' : JSON.stringify(ldd).slice(0, 80));

  // 5. Recruiting pipeline
  console.log('\n--- 5. Recruiting pipeline ---');
  const rr = await fetch(BASE + '/api/recruiting', { headers: H });
  const rd = await rr.json();
  console.log('Recruiting:', rr.status, Array.isArray(rd) ? rd.length + ' recruits' : JSON.stringify(rd).slice(0, 80));

  // 6. Dedup stats
  console.log('\n--- 6. Dedup stats ---');
  const dr = await fetch(BASE + '/api/resume-leads/dedup-stats', { headers: H });
  const dd = await dr.json();
  console.log('Dedup stats:', dr.status, JSON.stringify(dd).slice(0, 100));

  // 7. Craigslist search (admin)
  console.log('\n--- 7. Craigslist search (city=newyork, keywords=sales, limit=3) ---');
  const cr = await fetch(BASE + '/api/resume-leads/craigslist-search?city=newyork&keywords=sales&limit=3', { headers: H });
  const cd = await cr.json();
  console.log('CL search:', cr.status, cd.results ? cd.results.length + ' results, first alreadyAssigned=' + cd.results[0]?.alreadyAssigned : JSON.stringify(cd).slice(0, 120));

  // 8. Janina login (wave_closer_recruiter)
  console.log('\n--- 8. Janina login ---');
  const jr = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'janina@waveclosers.com', password: 'WaveClosers2024!' })
  });
  const jd = await jr.json();
  const jToken = jd.token;
  console.log('Janina login:', jr.status, jd.user ? 'OK - role: ' + jd.user.role : JSON.stringify(jd).slice(0, 100));

  const JH = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jToken };

  // 9. Janina my-leads
  console.log('\n--- 9. Janina my-leads ---');
  const mr = await fetch(BASE + '/api/resume-leads/my-leads', { headers: JH });
  const md = await mr.json();
  console.log('My leads:', mr.status, md.leads ? md.leads.length + ' leads' : JSON.stringify(md).slice(0, 100));

  // 10. Agent self-search (Janina, small count=2 to not burn quota)
  console.log('\n--- 10. Agent self-search (Janina, Miami, sales, count=2) ---');
  const asr = await fetch(BASE + '/api/resume-leads/agent-self-search', {
    method: 'POST', headers: JH,
    body: JSON.stringify({ city: 'Miami', keywords: 'sales', count: 2 })
  });
  const asd = await asr.json();
  console.log('Self-search:', asr.status, JSON.stringify(asd).slice(0, 200));

  // 11. Bulk-assign direct (admin)
  console.log('\n--- 11. Bulk-assign direct (admin -> Janina) ---');
  const uniqLink = 'https://newyork.craigslist.org/res/test' + Date.now() + '.html';
  const bar = await fetch(BASE + '/api/resume-leads/bulk-assign', {
    method: 'POST', headers: H,
    body: JSON.stringify({
      resumes: [{ title: 'Test Bulk Direct', link: uniqLink }],
      agentName: 'Janina', market: 'New York'
    })
  });
  const bad = await bar.json();
  console.log('Bulk-assign direct:', bar.status, JSON.stringify(bad).slice(0, 150));

  // 12. Recruiting agents list
  console.log('\n--- 12. Recruiting agents ---');
  const rar = await fetch(BASE + '/api/resume-leads/recruiting-agents', { headers: H });
  const rad = await rar.json();
  console.log('Recruiting agents:', rar.status, JSON.stringify(rad).slice(0, 150));

  // 13. Qualification queue
  console.log('\n--- 13. Qualification queue ---');
  const qr = await fetch(BASE + '/api/qualification-queue', { headers: H });
  const qd = await qr.json();
  console.log('Qual queue:', qr.status, Array.isArray(qd) ? qd.length + ' entries' : JSON.stringify(qd).slice(0, 80));

  console.log('\n=== ALL TESTS COMPLETE ===');
}

run().catch(e => console.error('FATAL:', e.message, e.stack));
