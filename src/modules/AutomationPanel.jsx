import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader, Card, CardHeader } from '../components/ui.jsx';
import { AUTOMATION_TASKS, AUTOMATION_LOG } from '../data/seed.js';
import { askClaude } from '../lib/claudeClient.js';
import { fetchLogFromAPI } from '../lib/dataLayer.js';

/**
 * AutomationPanel — v2 additions:
 *   - Live activity log fetched from backend (falls back to seed)
 *   - Auto-refresh every 60 seconds
 *   - Last run timestamp shown per task
 */
export default function AutomationPanel({ users: _users }) {
  const [log,     setLog]     = useState(AUTOMATION_LOG);
  const [running, setRunning] = useState(null);
  const [preview, setPreview] = useState(null);
  const [genLoad, setGenLoad] = useState(false);

  const active  = AUTOMATION_TASKS.filter(t => t.status === 'active').length;
  const pending = AUTOMATION_TASKS.filter(t => t.status === 'pending').length;

  // Fetch live log from backend — falls back to seed data gracefully
  const refreshLog = useCallback(async () => {
    const live = await fetchLogFromAPI();
    if (live && live.length) {
      setLog(live.map(e => ({
        time:   e.timestamp ? new Date(e.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '—',
        task:   e.task,
        target: e.target,
        status: e.status,
      })));
    }
  }, []);

  useEffect(() => {
    refreshLog();
    const timer = setInterval(refreshLog, 60_000);
    return () => clearInterval(timer);
  }, [refreshLog]);

  async function runTask(task) {
    setRunning(task.name);
    await new Promise(r => setTimeout(r, 900));
    const newEntry = {
      time:   new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }),
      task:   task.name,
      target: 'Manual trigger by Riyash',
      status: 'ok',
    };
    setLog(prev => [newEntry, ...prev]);
    setRunning(null);
  }

  function exportLogCSV() {
    const rows = [
      ['Time', 'Task', 'Target', 'Status'],
      ...log.map(e => [e.time, e.task, e.target, e.status]),
    ];
    const csv = rows.map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wave-closers-automation-log-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function generateEmail(type) {
    setGenLoad(true); setPreview(null);
    const labels  = { REFERRAL:'Referral Partner', REP:'Independent Rep', RESELLER:'Authorized Reseller', ISO:'ISO Investor (Done For You)' };
    const earning = { REFERRAL:'$2,000 per closed restaurant', REP:'$1,500–$3,000 bonus + 40% residuals', RESELLER:'$1,500–$3,000 bonus + 40% recurring revenue', ISO:'Full done-for-you investment operation' };
    const reply = await askClaude(
      `You write welcome emails for Wave Closers, a payment processing platform for restaurants. Be warm, professional, concise. Max 100 words. Plain text only. End with: "Your dashboard: waveclosers.com/user/dashboard"`,
      [{ role:'user', content:`Write a welcome email for a new ${labels[type]}. Their earning model: ${earning[type]}.` }]
    );
    setPreview({ type: labels[type], email: reply });
    setGenLoad(false);
  }

  const runsToday = log.filter(l => !String(l.time).includes('Yesterday') && !String(l.time).includes('May') && !String(l.time).includes('Apr')).length;
  const alerts    = log.filter(l => l.status === 'alert').length;

  return (
    <div style={S.wrap}>
      <PageHeader title="AI Automation" subtitle="Claude running 9 background tasks — scope §8" />

      {/* ── Summary stats ── */}
      <div style={S.statRow}>
        {[
          { label:'Active automations',   value:active,    color:'var(--color-green)'   },
          { label:'Pending (open items)', value:pending,   color:'var(--color-amber)'   },
          { label:'Runs today',           value:runsToday, color:'var(--color-primary)' },
          { label:'Alerts fired',         value:alerts,    color:'var(--color-red)'     },
        ].map(s => (
          <div key={s.label} style={{ ...S.statCard, borderTop:`3px solid ${s.color}` }}>
            <div style={{ fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:500 }}>{s.label}</div>
            <div style={{ fontSize:28, fontWeight:700, color:s.color, margin:'4px 0' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="wc-two-col" style={S.twoCol}>
        {/* ── Task list ── */}
        <Card>
          <CardHeader title="Automation tasks" sub={`${active} of ${AUTOMATION_TASKS.length} live`} />
          {AUTOMATION_TASKS.map((task, idx) => (
            <div key={task.name} style={S.taskRow}>
              <div style={S.taskNum}>{idx + 1}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:13 }}>{task.name}</div>
                <div style={{ fontSize:11, color:'#888', marginTop:2 }}>Trigger: {task.trigger}</div>
                {task.lastRun && <div style={{ fontSize:11, color:'#AAA', marginTop:1 }}>Last run: {task.lastRun}</div>}
                {task.note && <div style={{ fontSize:11, color:'var(--color-amber)', marginTop:3, fontStyle:'italic' }}>⚠ {task.note}</div>}
              </div>
              <div style={{ textAlign:'right', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                <span style={{ ...S.pill, background:task.status==='active'?'var(--color-green-bg)':'var(--color-amber-bg)', color:task.status==='active'?'var(--color-green-text)':'var(--color-amber-text)' }}>
                  {task.status === 'active' ? '● Active' : '○ Pending'}
                </span>
                <span style={{ fontSize:11, color:'#999' }}>{task.runs} runs</span>
                {task.status === 'active' && (
                  <button onClick={() => runTask(task)} disabled={running===task.name} style={S.runBtn}>
                    {running===task.name ? '⟳' : '▶ Run'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </Card>

        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* ── Live activity log ── */}
          <Card>
            <CardHeader
              title="Live activity log"
              sub={<span>Latest 20 events <button onClick={refreshLog} style={S.refreshBtn} title="Refresh">↺</button><button onClick={exportLogCSV} style={S.refreshBtn} title="Export CSV">↓</button></span>}
            />
            {log.slice(0, 20).map((entry, i) => (
              <div key={i} style={S.logRow}>
                <code style={{ fontSize:11, color:'#999', fontFamily:'monospace', minWidth:55 }}>{entry.time}</code>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{entry.task}</div>
                  <div style={{ fontSize:11, color:'#888' }}>{entry.target}</div>
                </div>
                <span style={{ fontSize:11, fontWeight:600, color: entry.status==='alert'?'var(--color-red)':entry.status==='sent'?'var(--color-green)':'var(--color-info)' }}>
                  {entry.status==='alert' ? '● ALERT' : entry.status==='sent' ? '✓ SENT' : '✓ OK'}
                </span>
              </div>
            ))}
          </Card>

          {/* ── Email preview generator ── */}
          <Card>
            <CardHeader title="Preview welcome email" sub="Claude drafts per user type" />
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
              {['REFERRAL','REP','RESELLER','ISO'].map(t => (
                <button key={t} onClick={() => generateEmail(t)} disabled={genLoad} style={S.typeBtn}>{t}</button>
              ))}
            </div>
            {genLoad && <div style={{ fontSize:13, color:'#888' }}>⟳ Claude is drafting…</div>}
            {preview && (
              <div style={{ background:'#F5F3EE', borderRadius:8, padding:14 }}>
                <div style={{ fontSize:11, color:'#888', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                  Welcome — {preview.type}
                </div>
                <pre style={{ fontSize:12, lineHeight:1.6, whiteSpace:'pre-wrap', margin:0, color:'#333' }}>{preview.email}</pre>
                <button
                  onClick={() => navigator.clipboard?.writeText(preview.email)}
                  style={{ ...S.runBtn, marginTop:10 }}
                >
                  Copy
                </button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Open items blocking automations ── */}
      <Card>
        <CardHeader title="2 automations blocked — open items from William" />
        {[
          { num:5, item:'Online learning platform link / login flow', task:'Online learning enrollment' },
          { num:6, item:'Thursday sales training meeting time → Matt', task:'Thursday training auto-invite' },
        ].map(o => (
          <div key={o.num} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:'1px solid var(--color-line-soft)' }}>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--color-amber)', background:'var(--color-amber-bg)', padding:'2px 8px', borderRadius:4, whiteSpace:'nowrap' }}>§12 · #{o.num}</span>
            <div>
              <div style={{ fontWeight:600, fontSize:13 }}>{o.item}</div>
              <div style={{ fontSize:12, color:'#888' }}>Blocking: {o.task}</div>
            </div>
            <span style={{ ...S.pill, background:'var(--color-amber-bg)', color:'var(--color-amber-text)', marginLeft:'auto', whiteSpace:'nowrap' }}>Pending William</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

const S = {
  wrap:       { display:'flex', flexDirection:'column', gap:16 },
  twoCol:     { display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 },
  statRow:    { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 },
  statCard:   { background:'white', padding:16, borderRadius:8, border:'1px solid var(--color-line)' },
  taskRow:    { display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'12px 0', borderBottom:'1px solid var(--color-line-soft)', gap:8 },
  taskNum:    { width:22, height:22, background:'var(--color-primary)', color:'white', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0, marginTop:2 },
  pill:       { display:'inline-flex', alignItems:'center', padding:'3px 9px', borderRadius:4, fontSize:11, fontWeight:600 },
  runBtn:     { background:'var(--color-primary-soft)', border:'1px solid var(--color-primary)', color:'var(--color-primary)', borderRadius:4, padding:'3px 10px', fontSize:11, fontWeight:600, cursor:'pointer' },
  logRow:     { display:'flex', gap:10, padding:'9px 0', borderBottom:'1px solid var(--color-line-soft)', alignItems:'center' },
  typeBtn:    { background:'white', border:'1px solid #DDD3C2', padding:'6px 12px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', color:'var(--color-primary)' },
  refreshBtn: { background:'transparent', border:'none', cursor:'pointer', fontSize:14, color:'#888', padding:'0 4px' },
};
