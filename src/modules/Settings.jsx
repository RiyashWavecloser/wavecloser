import React, { useState } from 'react';
import { PageHeader, Card, CardHeader } from '../components/ui.jsx';
import { OPEN_ITEMS, TEAM, BENCHMARKS } from '../data/constants.js';
import { checkServerHealth } from '../lib/dataLayer.js';


/**
 * Module 7 — Settings
 *
 * Covers:
 *   - Data mode toggle (mirrors DataIntegration)
 *   - Server health check (calls /health)
 *   - Open items table (all 7 from scope §12)
 *   - Current benchmarks (placeholders until William confirms)
 *   - Team roster
 *   - Environment variables reference
 */

export default function Settings({ dataMode, setDataMode }) {
  const [health,        setHealth]        = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  async function runHealthCheck() {
    setHealthLoading(true);
    try {
      const h = await checkServerHealth();
      setHealth(h);
    } finally {
      setHealthLoading(false);
    }
  }

  return (
    <div style={s.wrap}>
      <PageHeader
        title="Settings"
        subtitle="System configuration, open items, team roster, and environment reference"
      />

      {/* ── Data mode toggle ─────────────────────────────────────────── */}
      <Card>
        <CardHeader title="Data mode" sub="Mirrors the setting in Data Integration" />
        <div style={{ display:'flex', gap:12 }}>
          {['csv','api'].map(mode => (
            <button
              key={mode}
              onClick={() => setDataMode(mode)}
              style={{ ...s.modeBtn, ...(dataMode === mode ? s.modeBtnActive : {}) }}
            >
              {mode === 'csv' ? '📂 CSV upload (active)' : '🔗 API sync (pending credentials)'}
            </button>
          ))}
        </div>
        <p style={s.note}>
          CSV mode uses data you upload manually. API mode will sync live from waveclosers.com once William provides credentials (Open item #1).
        </p>
      </Card>

      {/* ── Server health ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader title="Server health check" sub="Calls /health on the Express proxy" />
        <button onClick={runHealthCheck} disabled={healthLoading} style={s.primaryBtn}>
          {healthLoading ? 'Checking…' : '▶ Check server health'}
        </button>
        {health && (
          <div style={s.healthGrid}>
            <HealthRow label="Claude AI"      ok={health.claude}       yes="✓ Ready" no="✗ No API key — Claude features disabled" />
            <HealthRow label="Airtable DB"    ok={health.airtable}     yes="✓ Connected" no="✗ Not configured — using seed data" />
            <HealthRow label="Email (Resend)" ok={health.email}        yes="✓ Ready" no="✗ No key — emails log to console" />
            <HealthRow label="Google Places"  ok={health.googlePlaces} yes="✓ Key set" no="✗ No key — lead gen uses demo data" />
            <HealthRow label="Yelp Fusion"    ok={health.yelp}         yes="✓ Key set" no="✗ No key — Yelp backup disabled" />
            <div style={s.healthTs}>
              {health.status === 'offline' ? 'Server is offline. Run: node server/claude-proxy.js' : `Checked at ${new Date().toLocaleTimeString()}`}
            </div>
          </div>
        )}
      </Card>

      {/* ── Open items ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Open items (scope §12)"
          sub="10 items pending from William — fill in, then activate"
        />
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>#</th>
              <th style={s.th}>Open item</th>
              <th style={s.th}>Blocks</th>
              <th style={s.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {OPEN_ITEMS.map(oi => (
              <tr key={oi.id} style={s.tr}>
                <td style={s.td}><span style={s.numBadge}>{oi.id}</span></td>
                <td style={s.td}>{oi.item}</td>
                <td style={s.td}><span style={s.blocksTag}>{oi.blocks}</span></td>
                <td style={s.td}><span style={s.pendingPill}>Pending</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={s.infoBox}>
          Once William confirms each item, the swap takes &lt; 5 minutes: update <code>.env</code> or <code>src/data/constants.js</code>.
          See README §10 for exact instructions.
        </div>
      </Card>

      {/* ── Benchmarks ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader title="Current benchmarks" sub="Placeholders — update when William confirms open items #2 and #3" />
        <table style={s.table}>
          <thead>
            <tr>
              {['User type','Weekly leads target','Monthly quota','Target close rate'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(BENCHMARKS).map(([type, bm]) => (
              <tr key={type} style={s.tr}>
                <td style={s.td}><strong>{type}</strong></td>
                <td style={s.td}>{bm.weeklyLeads} leads / week</td>
                <td style={s.td}>{bm.monthlyQuota} deals / month</td>
                <td style={s.td}>{Math.round(bm.closeRate * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={s.warnBox}>
          ⚠ These benchmarks are placeholders. Update <code>BENCHMARKS</code> in <code>src/data/constants.js</code> when William confirms.
        </div>
      </Card>

      {/* ── Team roster ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader title="Team roster" sub="As confirmed by William (voice note, May 13 2026)" />
        <div style={s.teamGrid}>
          {TEAM.map(member => (
            <div key={member.role} style={s.teamCard}>
              <div style={{ ...s.teamDot, background: member.color }} />
              <div>
                <div style={s.teamRole}>{member.role}</div>
                <div style={{
                  ...s.teamOwner,
                  color: member.owner === 'TBC' ? 'var(--color-amber-text)' : 'var(--color-ink)',
                }}>
                  {member.owner === 'TBC' ? '⚠ Unassigned' : member.owner}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Environment variables reference ──────────────────────────── */}
      <Card>
        <CardHeader title="Environment variables reference" sub="Copy .env.example → .env and fill in real values" />
        <div style={s.envGrid}>
          {ENV_VARS.map(ev => (
            <div key={ev.key} style={s.envRow}>
              <code style={s.envKey}>{ev.key}</code>
              <div style={s.envDesc}>{ev.desc}</div>
              <div style={s.envWhere}>{ev.where}</div>
            </div>
          ))}
        </div>
        <div style={s.infoBox}>
          Frontend uses only <code>VITE_CLAUDE_PROXY_URL</code>.
          All secrets (API keys) stay in <code>server/</code> — never in the browser bundle.
        </div>
      </Card>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HealthRow({ label, ok, yes, no }) {
  return (
    <div style={s.healthRow}>
      <span style={s.healthLabel}>{label}</span>
      <span style={{ color: ok ? 'var(--color-green)' : 'var(--color-red)', fontWeight:600, fontSize:13 }}>
        {ok ? yes : no}
      </span>
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const ENV_VARS = [
  { key:'VITE_CLAUDE_PROXY_URL', desc:'URL of the Express proxy (frontend only var)',         where:'Set to http://localhost:3001/api/claude locally' },
  { key:'ANTHROPIC_API_KEY',     desc:'Claude API key — powers all AI features',             where:'console.anthropic.com' },
  { key:'AIRTABLE_API_KEY',      desc:'Airtable personal access token',                      where:'airtable.com/create/tokens' },
  { key:'AIRTABLE_BASE_ID',      desc:'Airtable base ID (starts with app…)',                  where:'Open base → Help → API docs' },
  { key:'RESEND_API_KEY',        desc:'Resend email API key — sends all automated emails',   where:'resend.com (free tier: 3k emails/month)' },
  { key:'EMAIL_FROM',            desc:'Sender email address',                                where:'Must be a verified domain in Resend' },
  { key:'RIYASH_EMAIL',          desc:'Riyash receives all reports and alerts',              where:'Your email' },
  { key:'WILLIAM_EMAIL',         desc:"William receives weekly reports",                     where:"William's email" },
  { key:'PORT',                  desc:'Express proxy port (default: 3001)',                  where:'Set in server env / Railway' },
  { key:'CONTRACT_TEMPLATE_URL', desc:'Link to contract template (Pending #4)',              where:'Confirm with William' },
  { key:'LEARNING_PLATFORM_URL', desc:'Online learning platform URL (Pending #5)',           where:'Confirm with William' },
  { key:'THURSDAY_TRAINING_TIME',desc:'Meeting time string, e.g. "Thursdays 2pm ET" (#6)',  where:'Confirm with William' },
  { key:'THURSDAY_TRAINING_LINK',desc:'Zoom/calendar link for training (#6)',               where:'Confirm with William' },
  { key:'GOOGLE_PLACES_API_KEY', desc:'Google Places API key — powers live lead generation',  where:'console.cloud.google.com → Places API' },
  { key:'YELP_API_KEY',          desc:'Yelp Fusion API key — backup lead source',            where:'fusion.yelp.com → Create App' },
  { key:'DAILY_LEADS_PER_AGENT', desc:'Target leads per agent per day (default: 100)',        where:'Adjust as needed' },
  { key:'NUM_AGENTS',            desc:'Number of cold-calling agents (default: 10)',          where:'Update when team changes' },
  { key:'QUALIFIER_EMAIL',       desc:"Qualifier's notification email address",              where:'Set in .env' },
  { key:'RECRUITER_EMAIL',       desc:"Recruiter's routing email address",                    where:'Set in .env' },
  { key:'AGENT_PASSWORD',        desc:'Default password for cold-calling agent accounts',     where:'Set in .env' },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  wrap:        { display:'flex', flexDirection:'column', gap:16 },
  note:        { fontSize:12, color:'#666', marginTop:10, lineHeight:1.6 },
  primaryBtn:  { background:'var(--color-primary)', color:'white', border:'none', padding:'10px 18px', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer' },
  modeBtn:     { padding:'10px 16px', border:'1px solid var(--color-line)', borderRadius:8, background:'white', fontSize:13, color:'#555', cursor:'pointer' },
  modeBtnActive:{ padding:'10px 16px', border:'1px solid var(--color-primary)', borderRadius:8, background:'var(--color-primary)', color:'white', fontSize:13, fontWeight:600, cursor:'pointer' },
  healthGrid:  { marginTop:14, display:'flex', flexDirection:'column', gap:8 },
  healthRow:   { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--color-line-soft)' },
  healthLabel: { fontSize:13, color:'#444', fontWeight:500 },
  healthTs:    { fontSize:11, color:'#888', marginTop:4 },
  table:       { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th:          { textAlign:'left', padding:'9px 10px', borderBottom:'1px solid var(--color-line)', fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 },
  td:          { padding:'11px 10px', borderBottom:'1px solid var(--color-line-soft)', color:'#333' },
  tr:          {},
  numBadge:    { display:'inline-flex', alignItems:'center', justifyContent:'center', width:22, height:22, background:'var(--color-primary)', color:'white', borderRadius:4, fontSize:11, fontWeight:700 },
  blocksTag:   { fontSize:11, padding:'2px 8px', background:'var(--color-info-bg)', color:'var(--color-info-text)', borderRadius:4 },
  pendingPill: { fontSize:11, padding:'2px 8px', background:'var(--color-amber-bg)', color:'var(--color-amber-text)', borderRadius:4, fontWeight:600 },
  infoBox:     { marginTop:12, padding:'10px 14px', background:'var(--color-info-bg)', borderRadius:6, fontSize:12, color:'var(--color-info-text)', lineHeight:1.6 },
  warnBox:     { marginTop:12, padding:'10px 14px', background:'var(--color-amber-bg)', borderRadius:6, fontSize:12, color:'var(--color-amber-text)', lineHeight:1.6 },
  teamGrid:    { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:10 },
  teamCard:    { display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px', border:'1px solid var(--color-line-soft)', borderRadius:8 },
  teamDot:     { width:10, height:10, borderRadius:'50%', marginTop:4, flexShrink:0 },
  teamRole:    { fontSize:12, color:'#666' },
  teamOwner:   { fontSize:14, fontWeight:600, marginTop:2 },
  envGrid:     { display:'flex', flexDirection:'column', gap:0 },
  envRow:      { display:'grid', gridTemplateColumns:'220px 1fr auto', gap:12, padding:'10px 0', borderBottom:'1px solid var(--color-line-soft)', alignItems:'start' },
  envKey:      { fontSize:11, fontFamily:'monospace', background:'var(--color-line-soft)', padding:'2px 6px', borderRadius:4, color:'var(--color-primary)', fontWeight:600 },
  envDesc:     { fontSize:12, color:'#444', lineHeight:1.5 },
  envWhere:    { fontSize:11, color:'#888', textAlign:'right', whiteSpace:'nowrap' },
};
