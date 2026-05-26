import React, { useState, useRef } from 'react';
import { PageHeader, Card, CardHeader, Note } from '../components/ui.jsx';
import { parseCSV, CSV_TEMPLATE } from '../lib/csvParser.js';
import { importUsersToAPI } from '../lib/dataLayer.js';

/**
 * DataIntegration — v2 additions:
 *   - "Export all" button downloads current users as CSV
 *   - If Airtable is configured, also pushes imported users to backend
 *   - Template button includes email column
 *   - Last updated timestamp
 */
export default function DataIntegration({ dataMode, setDataMode, users, setUsers }) {
  const [csvText,    setCsvText]    = useState('');
  const [result,     setResult]     = useState(null);
  const [apiUrl,     setApiUrl]     = useState('https://waveclosers.com/api/v1/users');
  const [apiKey,     setApiKey]     = useState('');
  const [apiStatus,  setApiStatus]  = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const fileRef = useRef();

  // ── CSV upload & merge ────────────────────────────────────────────────────

  async function handleUpload() {
    const { users: parsed, errors } = parseCSV(csvText);
    if (parsed.length === 0 && errors.length > 0) { setResult({ ok:false, errors }); return; }

    // Merge into React state (update existing by ID, append new)
    setUsers(prev => {
      const map = Object.fromEntries(prev.map(u => [u.id, u]));
      parsed.forEach(u => { map[u.id] = u; });
      return Object.values(map);
    });

    setResult({ ok:true, count:parsed.length, errors });
    setLastUpdate(new Date().toLocaleTimeString());
    setCsvText('');

    // Also push to Airtable via backend if available (best-effort)
    if (parsed.length > 0) {
      importUsersToAPI(parsed).then(res => {
        if (res && !res.demo && res.imported > 0) {
          console.log(`[DataIntegration] Pushed ${res.imported} users to Airtable.`);
        }
      }).catch(console.warn);
    }
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCsvText(ev.target.result);
    reader.readAsText(file);
  }

  // ── Export all users as CSV ───────────────────────────────────────────────

  function exportCSV() {
    const header = 'id,name,type,stage,leadsThisWeek,dealsThisMonth,joined,market,email,notes';
    const rows = users.map(u => [
      u.id, u.name, u.type, u.stage, u.leadsThisWeek, u.dealsThisMonth,
      u.joined, `"${(u.market||'').replace(/"/g,'""')}"`, u.email||'', `"${(u.notes||'').replace(/"/g,'""')}"`
    ].join(','));
    const csv  = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `wave-closers-users-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  async function testApi() {
    setApiStatus('testing');
    await new Promise(r => setTimeout(r, 1200));
    setApiStatus('pending');
  }

  return (
    <div style={S.wrap}>
      <PageHeader title="Data Integration" subtitle="Dual mode — CSV upload now, API sync when waveclosers.com is ready" />

      {/* ── Mode toggle ── */}
      <div style={S.toggleRow}>
        {['csv','api'].map(m => (
          <button key={m} onClick={() => setDataMode(m)}
            style={{ ...S.toggleBtn, background:dataMode===m?'var(--color-primary)':'white', color:dataMode===m?'white':'#555', borderColor:dataMode===m?'var(--color-primary)':'#DDD3C2' }}>
            {m === 'csv' ? '📄 CSV Upload (active today)' : '🔗 API Sync (ready when available)'}
          </button>
        ))}
      </div>

      <div style={S.twoCol}>
        {/* ── CSV mode ── */}
        <Card style={{ borderTop:`3px solid ${dataMode==='csv'?'var(--color-amber)':'#DDD'}` }}>
          <CardHeader title="Mode 1 — CSV Upload" sub={dataMode==='csv' ? '● Active' : 'Standby'} />
          <p style={S.body}>
            Export from <strong>waveclosers.com/user/dashboard</strong>, paste or upload here.
            Merges by ID — existing records update, new ones are added. Then also pushes to Airtable if configured.
          </p>
          <div style={S.fileRow}>
            <button onClick={() => fileRef.current.click()} style={S.outlineBtn}>📂 Choose file</button>
            <span style={{ fontSize:12, color:'#888' }}>or paste CSV below</span>
            <button onClick={() => setCsvText(CSV_TEMPLATE)} style={{ ...S.outlineBtn, marginLeft:'auto' }}>📋 Load template</button>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display:'none' }} onChange={handleFile} />
          <textarea
            placeholder={`Paste CSV — columns:\nid, name, type, stage, leadsThisWeek, dealsThisMonth, joined, market, email, notes`}
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            style={S.textarea}
          />
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={handleUpload} style={S.primaryBtn} disabled={!csvText.trim()}>↑ Upload & merge</button>
            <button onClick={exportCSV}    style={S.outlineBtn}>↓ Export all</button>
          </div>
          {result?.ok  && <Note>✓ Imported {result.count} user{result.count!==1?'s':''}. Dashboard updated.{result.errors.length>0?` (${result.errors.length} rows skipped)`:''}</Note>}
          {result && !result.ok && <Note tone="warn">⚠ {result.errors.join(' ')}</Note>}
        </Card>

        {/* ── API mode ── */}
        <Card style={{ borderTop:`3px solid ${dataMode==='api'?'var(--color-green)':'#DDD'}` }}>
          <CardHeader title="Mode 2 — API Sync" sub={dataMode==='api' ? '● Active' : 'Standby'} />
          <p style={S.body}>
            When waveclosers.com exposes an API, flip the toggle and enter credentials.
            Data syncs in real time — no manual exports needed.
          </p>
          <div style={S.fieldGroup}><label style={S.label}>API Endpoint URL</label><input value={apiUrl} onChange={e => setApiUrl(e.target.value)} style={S.input} /></div>
          <div style={S.fieldGroup}><label style={S.label}>API Key</label><input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password" style={S.input} placeholder="Paste API key (from William)" /></div>
          <button onClick={testApi} style={{ ...S.primaryBtn, opacity:apiStatus==='testing'?0.6:1 }} disabled={apiStatus==='testing'}>
            {apiStatus==='testing' ? '⟳ Testing…' : '⚡ Test connection'}
          </button>
          {apiStatus==='pending' && <Note tone="warn">API not yet live. Slot is wired and ready — activate once William confirms credentials.</Note>}
          <Note>📌 Open item §12 #1: William to confirm API availability.</Note>
        </Card>
      </div>

      {/* ── Status panel ── */}
      <Card>
        <CardHeader title="Current data source" />
        <div style={S.grid3}>
          <KV label="Active mode"    value={dataMode==='csv' ? 'CSV upload (manual)' : 'API sync (live)'} />
          <KV label="Records loaded" value={`${users.length} users`} />
          <KV label="Last import"    value={lastUpdate || 'Not yet imported this session'} />
        </div>
      </Card>
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div>
      <div style={{ fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:500 }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:500, color:'var(--color-ink)', marginTop:4 }}>{value}</div>
    </div>
  );
}

const S = {
  wrap:       { display:'flex', flexDirection:'column', gap:16 },
  twoCol:     { display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 },
  grid3:      { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 },
  toggleRow:  { display:'flex', gap:8 },
  toggleBtn:  { padding:'10px 20px', borderRadius:8, border:'1px solid', fontSize:13, fontWeight:600, cursor:'pointer', transition:'all .15s' },
  body:       { fontSize:13, color:'#555', lineHeight:1.6, marginBottom:12 },
  fileRow:    { display:'flex', alignItems:'center', gap:10, marginBottom:10 },
  outlineBtn: { background:'white', border:'1px solid #DDD3C2', padding:'7px 14px', borderRadius:6, fontSize:12, cursor:'pointer', color:'#444' },
  textarea:   { padding:'10px 12px', border:'1px solid #DDD3C2', borderRadius:6, fontSize:12, fontFamily:'monospace', minHeight:110, width:'100%', marginBottom:12, resize:'vertical', outline:'none' },
  primaryBtn: { background:'var(--color-primary)', color:'white', border:'none', padding:'10px 18px', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer' },
  fieldGroup: { marginBottom:10 },
  label:      { display:'block', fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:500, marginBottom:4 },
  input:      { width:'100%', padding:'9px 12px', border:'1px solid #DDD3C2', borderRadius:6, fontSize:13, outline:'none' },
};
