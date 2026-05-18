import React, { useState, useMemo } from 'react';
import { USER_TYPES, BENCHMARKS, ONBOARDING_STAGES } from '../data/constants.js';
import { computeStatus } from '../lib/status.js';
import { PageHeader, Card, CardHeader, StatusPill, Note } from '../components/ui.jsx';

export default function Users({ users, setUsers }) {
  const [search,      setSearch]      = useState('');
  const [typeFilter,  setTypeFilter]  = useState('ALL');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [selected,    setSelected]    = useState(null);
  const [addOpen,     setAddOpen]     = useState(false);
  const [draft, setDraft] = useState({ name:'', type:'REFERRAL', market:'', notes:'' });

  const filtered = useMemo(() => users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch  = !search || u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q) || u.market.toLowerCase().includes(q);
    const matchType    = typeFilter  === 'ALL' || u.type  === typeFilter;
    const matchStage   = stageFilter === 'ALL' || (stageFilter === 'onboarding' ? u.stage < 4 : u.stage >= 4);
    return matchSearch && matchType && matchStage;
  }), [users, search, typeFilter, stageFilter]);

  function addUser() {
    if (!draft.name.trim()) return;
    const id = `WC-${1000 + users.length + 1}`;
    setUsers(prev => [{
      id, name:draft.name, type:draft.type, stage:1,
      leadsThisWeek:0, dealsThisMonth:0,
      joined: new Date().toISOString().split('T')[0],
      market: draft.market || '—', notes: draft.notes,
    }, ...prev]);
    setDraft({ name:'', type:'REFERRAL', market:'', notes:'' });
    setAddOpen(false);
  }

  function updateNote(id, notes) {
    setUsers(prev => prev.map(u => u.id === id ? {...u, notes} : u));
  }

  const sel = selected ? users.find(u => u.id === selected) : null;

  return (
    <div style={S.wrap}>
      <PageHeader title="Users" subtitle="All Wave Closers members — search, filter, manage" />

      <div style={S.toolbar}>
        <input placeholder="🔍 Search name, ID, market…" value={search} onChange={e => setSearch(e.target.value)} style={S.searchInput} />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={S.select}>
          <option value="ALL">All types</option>
          {Object.values(USER_TYPES).map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} style={S.select}>
          <option value="ALL">All stages</option>
          <option value="onboarding">Still onboarding (stage 1–3)</option>
          <option value="active">Active (stage 4+)</option>
        </select>
        <button onClick={() => setAddOpen(true)} style={S.addBtn}>+ Add user</button>
      </div>

      {addOpen && (
        <Card style={{ borderLeft:'3px solid var(--color-primary)' }}>
          <CardHeader title="Add new user" />
          <div style={S.addGrid}>
            <div><label style={S.label}>Full name *</label><input value={draft.name} onChange={e => setDraft({...draft,name:e.target.value})} style={S.input} placeholder="e.g. Jordan Lee" /></div>
            <div><label style={S.label}>User type *</label>
              <select value={draft.type} onChange={e => setDraft({...draft,type:e.target.value})} style={S.input}>
                {Object.values(USER_TYPES).map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div><label style={S.label}>Market</label><input value={draft.market} onChange={e => setDraft({...draft,market:e.target.value})} style={S.input} placeholder="e.g. Dallas, TX" /></div>
            <div><label style={S.label}>Notes</label><input value={draft.notes} onChange={e => setDraft({...draft,notes:e.target.value})} style={S.input} placeholder="Optional" /></div>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <button onClick={addUser} style={S.primaryBtn}>Add user →</button>
            <button onClick={() => setAddOpen(false)} style={S.outBtn}>Cancel</button>
          </div>
          <Note>Adding sets Stage 1. Routing applied automatically per user type (Referral/Rep → Mildred CX; Reseller/ISO → Janina Recruiter).</Note>
        </Card>
      )}

      <div style={{ display:'grid', gridTemplateColumns: sel ? '1fr 380px' : '1fr', gap:16, alignItems:'start' }}>
        <Card style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--color-line)', display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontSize:13, fontWeight:600 }}>{filtered.length} user{filtered.length !== 1 ? 's' : ''}</span>
            {search && <button onClick={() => setSearch('')} style={{ background:'none', border:'none', color:'#888', fontSize:12, cursor:'pointer' }}>Clear ×</button>}
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={S.table}>
              <thead><tr>{['User','Type','Stage','Leads / wk','Deals / mo','Market','Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(u => {
                  const t  = USER_TYPES[u.type];
                  const bm = BENCHMARKS[u.type];
                  const st = computeStatus(u);
                  return (
                    <tr key={u.id} onClick={() => setSelected(u.id === selected ? null : u.id)}
                      style={{ ...S.tr, background: selected===u.id ? 'var(--color-primary-soft)' : 'transparent' }}>
                      <td style={S.td}><div style={{ fontWeight:600 }}>{u.name}</div><div style={{ fontSize:11, color:'#999' }}>{u.id}</div></td>
                      <td style={S.td}><span style={{ fontSize:11, padding:'3px 8px', borderRadius:4, fontWeight:600, background:`${t.color}15`, color:t.color }}>{t.short}</span></td>
                      <td style={S.td}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div style={S.stagebar}><div style={{ ...S.stagefill, width:`${(u.stage/6)*100}%` }} /></div>
                          <span style={{ fontSize:12, color:'#666' }}>{u.stage}/6</span>
                        </div>
                      </td>
                      <td style={S.td}>{u.leadsThisWeek} <span style={{ color:'#AAA', fontSize:12 }}>/ {bm.weeklyLeads}</span></td>
                      <td style={S.td}>{u.dealsThisMonth} <span style={{ color:'#AAA', fontSize:12 }}>/ {bm.monthlyQuota}</span></td>
                      <td style={S.td}>{u.market}</td>
                      <td style={S.td}><StatusPill tier={st.tier} label={st.label} /></td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign:'center', padding:32, color:'#888', fontSize:13 }}>No users match this filter.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        {sel && (() => {
          const t  = USER_TYPES[sel.type];
          const bm = BENCHMARKS[sel.type];
          const st = computeStatus(sel);
          const lp = Math.min(100, (sel.leadsThisWeek / bm.weeklyLeads) * 100);
          const dp = Math.min(100, (sel.dealsThisMonth / bm.monthlyQuota) * 100);
          return (
            <Card style={{ position:'sticky', top:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
                <div>
                  <div style={{ fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:'0.1em' }}>{sel.id}</div>
                  <div style={{ fontSize:20, fontWeight:700, marginTop:2 }}>{sel.name}</div>
                  <span style={{ fontSize:11, padding:'3px 8px', borderRadius:4, fontWeight:600, background:`${t.color}15`, color:t.color, marginTop:6, display:'inline-block' }}>{t.label}</span>
                </div>
                <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', fontSize:22, color:'#888', cursor:'pointer' }}>×</button>
              </div>
              <StatusPill tier={st.tier} label={st.label} />
              <div style={{ marginTop:16 }}>
                {[['Leads this week', sel.leadsThisWeek, bm.weeklyLeads, lp], ['Deals this month', sel.dealsThisMonth, bm.monthlyQuota, dp]].map(([label, a, b, pct]) => {
                  const c = pct >= 70 ? 'var(--color-green)' : pct >= 40 ? 'var(--color-amber)' : 'var(--color-red)';
                  return (
                    <div key={label} style={{ marginBottom:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                        <span style={{ color:'#888' }}>{label}</span><strong>{a} / {b}</strong>
                      </div>
                      <div style={{ height:6, background:'var(--color-line)', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:c, borderRadius:3, transition:'width .4s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop:16 }}>
                <div style={{ fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Onboarding steps</div>
                {ONBOARDING_STAGES.map((stage, i) => (
                  <div key={stage.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                    <div style={{ width:20, height:20, borderRadius:'50%', background: i < sel.stage ? 'var(--color-primary)' : 'var(--color-line)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color: i < sel.stage ? 'white' : '#888', flexShrink:0 }}>
                      {i < sel.stage ? '✓' : i+1}
                    </div>
                    <div style={{ fontSize:12, color: i < sel.stage ? 'var(--color-ink)' : '#AAA', flex:1 }}>{stage.label}</div>
                    <div style={{ fontSize:10, color:'#CCC' }}>{stage.owner}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[['Market', sel.market], ['Joined', sel.joined], ['Routing', t.route === 'CX' ? '→ Mildred (CX)' : '→ Janina → Mildred (CX)'], ['Earning model', t.earningModel]].map(([l,v]) => (
                  <div key={l}><div style={{ fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>{l}</div><div style={{ fontSize:12, fontWeight:500, marginTop:3 }}>{v}</div></div>
                ))}
              </div>
              <div style={{ marginTop:16 }}>
                <div style={{ fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Notes</div>
                <textarea value={sel.notes || ''} onChange={e => updateNote(sel.id, e.target.value)} rows={3}
                  style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--color-line)', borderRadius:6, fontSize:12, resize:'vertical', outline:'none', fontFamily:'inherit' }}
                  placeholder="Add notes…" />
              </div>
            </Card>
          );
        })()}
      </div>
    </div>
  );
}

const S = {
  wrap:      { display:'flex', flexDirection:'column', gap:16 },
  toolbar:   { display:'flex', gap:10, alignItems:'center' },
  searchInput:{ flex:1, padding:'9px 12px', border:'1px solid var(--color-line)', borderRadius:6, fontSize:13, outline:'none', background:'white' },
  select:    { padding:'9px 12px', border:'1px solid var(--color-line)', borderRadius:6, fontSize:13, outline:'none', background:'white', cursor:'pointer' },
  addBtn:    { background:'var(--color-primary)', color:'white', border:'none', padding:'9px 18px', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' },
  addGrid:   { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  label:     { display:'block', fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:500, marginBottom:4 },
  input:     { width:'100%', padding:'9px 12px', border:'1px solid #DDD3C2', borderRadius:6, fontSize:13, outline:'none' },
  primaryBtn:{ background:'var(--color-primary)', color:'white', border:'none', padding:'9px 18px', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer' },
  outBtn:    { background:'white', color:'#555', border:'1px solid #DDD3C2', padding:'9px 18px', borderRadius:6, fontSize:13, cursor:'pointer' },
  table:     { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th:        { textAlign:'left', padding:'10px 10px', borderBottom:'1px solid var(--color-line)', fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 },
  td:        { padding:'12px 10px', borderBottom:'1px solid var(--color-line-soft)', color:'#333', verticalAlign:'middle' },
  tr:        { cursor:'pointer', transition:'background .1s' },
  stagebar:  { width:56, height:5, background:'var(--color-line)', borderRadius:3, overflow:'hidden' },
  stagefill: { height:'100%', background:'var(--color-primary)', borderRadius:3 },
};
