import React, { useState, useEffect } from 'react';
import { USER_TYPES, BENCHMARKS, ONBOARDING_STAGES } from '../data/constants.js';
import { computeStatus } from '../lib/status.js';
import { StatusPill } from './ui.jsx';

/**
 * UserDrawer — slide-in user detail panel.
 *
 * v2 additions:
 *   - Editable notes field (auto-saves to parent via onUpdateUser)
 *   - Stage advancement buttons (← Step back / Step forward →)
 *   - Full 7-step onboarding checklist with step owners and routing note
 */
export default function UserDrawer({ user, onClose, onUpdateUser }) {
  const [notes, setNotes] = useState(user.notes || '');
  const [market, setMarket] = useState(user.market || '');
  const [email, setEmail] = useState(user.email || '');

  // Keep state in sync if user changes
  useEffect(() => {
    setMarket(user.market || '');
    setEmail(user.email || '');
    setNotes(user.notes || '');
  }, [user]);

  const t  = USER_TYPES[user.type] || USER_TYPES.REFERRAL;
  const bm = BENCHMARKS[user.type] || BENCHMARKS.REFERRAL;
  const status = computeStatus(user);
  const leadProgress = Math.min(100, (user.leadsThisWeek  / bm.weeklyLeads)  * 100);
  const dealProgress = Math.min(100, (user.dealsThisMonth / bm.monthlyQuota) * 100);

  function handleNotesBlur() {
    if (notes !== user.notes && onUpdateUser) {
      onUpdateUser(user.id, { notes });
    }
  }

  function handleMarketBlur() {
    if (market !== user.market && onUpdateUser) {
      onUpdateUser(user.id, { market });
    }
  }

  function handleEmailBlur() {
    if (email !== user.email && onUpdateUser) {
      onUpdateUser(user.id, { email });
    }
  }

  function stepForward() {
    if (user.stage >= 7 || !onUpdateUser) return;
    onUpdateUser(user.id, { stage: user.stage + 1 });
  }

  function stepBack() {
    if (user.stage <= 1 || !onUpdateUser) return;
    onUpdateUser(user.id, { stage: user.stage - 1 });
  }

  const routingNote = (user.type === 'REFERRAL' || user.type === 'REP')
    ? '→ CX Team direct (onboards immediately)'
    : '→ Recruiter closes deal → CX Team onboards';

  return (
    <>
      <div style={styles.backdrop} onClick={onClose} />
      <div style={styles.drawer}>
        {/* ── Header ── */}
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>{user.id}</div>
            <h2 style={styles.name}>{user.name}</h2>
            <span style={{ ...styles.typePill, background:`${t.color}15`, color:t.color }}>
              {t.label}
            </span>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close">×</button>
        </div>

        <div style={{ padding:24 }}>
          {/* ── Status + email ── */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <StatusPill tier={status.tier} label={status.label} />
            {user.email && <a href={`mailto:${user.email}`} style={styles.emailLink}>{user.email}</a>}
          </div>

          {/* ── Onboarding stage ── */}
          <Section label="Onboarding stage">
            <ProgressRow
              filled={(user.stage / 7) * 100}
              right={`Step ${user.stage} / 7`}
              accent="var(--color-primary)"
            />
            <div style={styles.sub}>
              {ONBOARDING_STAGES[user.stage - 1]?.label} — {ONBOARDING_STAGES[user.stage - 1]?.owner}
            </div>
            <div style={styles.stageButtons}>
              <button onClick={stepBack}    disabled={user.stage <= 1} style={styles.stageBtn}>← Step back</button>
              <button onClick={stepForward} disabled={user.stage >= 7} style={{ ...styles.stageBtn, ...styles.stageBtnPrimary }}>Step forward →</button>
            </div>
          </Section>

          {/* ── Performance ── */}
          <Section label="Leads this week">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <ProgressRow
                  filled={leadProgress}
                  right=""
                  accent={leadProgress >= 70 ? 'var(--color-green)' : leadProgress >= 50 ? 'var(--color-amber)' : 'var(--color-red)'}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="number"
                  min="0"
                  value={user.leadsThisWeek}
                  onChange={e => onUpdateUser && onUpdateUser(user.id, { leadsThisWeek: Math.max(0, parseInt(e.target.value) || 0) })}
                  style={styles.numberInput}
                />
                <span style={{ fontSize: 13, color: '#888' }}>/ {bm.weeklyLeads}</span>
              </div>
            </div>
          </Section>

          <Section label="Deals this month">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <ProgressRow
                  filled={dealProgress}
                  right=""
                  accent={dealProgress >= 70 ? 'var(--color-green)' : dealProgress >= 50 ? 'var(--color-amber)' : 'var(--color-red)'}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="number"
                  min="0"
                  value={user.dealsThisMonth}
                  onChange={e => onUpdateUser && onUpdateUser(user.id, { dealsThisMonth: Math.max(0, parseInt(e.target.value) || 0) })}
                  style={styles.numberInput}
                />
                <span style={{ fontSize: 13, color: '#888' }}>/ {bm.monthlyQuota}</span>
              </div>
            </div>
          </Section>

          {/* ── Profile KV ── */}
          <div style={styles.grid}>
            <div>
              <div style={styles.kvLabel}>Market</div>
              <input
                value={market}
                onChange={e => setMarket(e.target.value)}
                onBlur={handleMarketBlur}
                style={styles.inlineInput}
              />
            </div>
            <div>
              <div style={styles.kvLabel}>Email</div>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={handleEmailBlur}
                style={styles.inlineInput}
                placeholder="e.g. name@domain.com"
              />
            </div>
            <KV label="Joined"      value={user.joined || '—'} />
            <KV label="Earning model" value={t.earningModel} />
            <KV label="Close rate target" value={`${Math.round(bm.closeRate * 100)}%`} />
          </div>

          {/* ── Routing ── */}
          <div style={styles.routingBox}>
            <div style={styles.routingLabel}>Routing path</div>
            <div style={styles.routingValue}>{routingNote}</div>
          </div>

          {/* ── Onboarding checklist ── */}
          <Section label="7-step onboarding checklist (click step to set)">
            {ONBOARDING_STAGES.map(step => {
              const isPastOrCurrent = user.stage >= step.id;
              return (
                <div key={step.id} style={{ ...styles.checkRow, cursor: 'pointer' }} onClick={() => onUpdateUser && onUpdateUser(user.id, { stage: step.id })}>
                  <div style={{
                    ...styles.checkCircle,
                    background: isPastOrCurrent ? 'var(--color-green)' : 'var(--color-line)',
                    color: isPastOrCurrent ? 'white' : '#888',
                  }}>
                    {isPastOrCurrent ? '✓' : step.id}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight: user.stage === step.id ? 700 : isPastOrCurrent ? 500 : 400, color: user.stage === step.id ? 'var(--color-primary)' : 'var(--color-ink)' }}>
                      {step.label} {user.stage === step.id && ' (Current)'}
                    </div>
                    <div style={styles.checkOwner}>{step.owner}</div>
                    {step.note && (
                      <div style={{ fontSize: 10, color: '#D49A2B', marginTop: 3, fontStyle: 'italic' }}>⚠ {step.note}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </Section>

          {/* ── Notes ── */}
          <Section label="Notes (auto-saves on blur)">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Add notes about this user…"
              style={styles.notesInput}
              rows={3}
            />
          </Section>

          {/* ── Benchmark note ── */}
          <div style={styles.benchmarkNote}>
            <strong>Benchmark note:</strong> Leads and quota targets are placeholder values per scope §12.
            Will update once William confirms targets per user type.
          </div>
        </div>
      </div>
    </>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={styles.kvLabel}>{label}</div>
      <div style={{ marginTop:6 }}>{children}</div>
    </div>
  );
}

function ProgressRow({ filled, right, accent }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={styles.bar}>
        <div style={{ ...styles.barFill, width:`${filled}%`, background:accent }} />
      </div>
      <span style={{ fontSize:13, fontWeight:600 }}>{right}</span>
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div>
      <div style={styles.kvLabel}>{label}</div>
      <div style={styles.kvValue}>{value}</div>
    </div>
  );
}

const styles = {
  backdrop:    { position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:50 },
  drawer:      { position:'fixed', top:0, right:0, width:460, height:'100vh', background:'white', zIndex:51, overflowY:'auto', boxShadow:'var(--shadow-drawer)' },
  header:      { padding:24, borderBottom:'1px solid var(--color-line)', display:'flex', justifyContent:'space-between', alignItems:'flex-start' },
  eyebrow:     { fontSize:11, letterSpacing:'0.1em', color:'#888', textTransform:'uppercase' },
  name:        { margin:'4px 0 6px 0', fontSize:22 },
  closeBtn:    { background:'transparent', border:'none', fontSize:24, color:'#888', padding:0, lineHeight:1, cursor:'pointer' },
  typePill:    { fontSize:11, padding:'3px 8px', borderRadius:4, fontWeight:600, display:'inline-block' },
  emailLink:   { fontSize:12, color:'var(--color-primary)', textDecoration:'none' },
  sub:         { fontSize:12, color:'#888', marginTop:6 },
  stageButtons:{ display:'flex', gap:8, marginTop:10 },
  stageBtn:    { padding:'6px 12px', border:'1px solid var(--color-line)', borderRadius:6, background:'white', color:'#555', fontSize:12, cursor:'pointer' },
  stageBtnPrimary:{ background:'var(--color-primary)', color:'white', border:'1px solid var(--color-primary)', fontWeight:600 },
  grid:        { display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:4, marginBottom:20 },
  routingBox:  { background:'var(--color-info-bg)', borderRadius:8, padding:'10px 12px', marginBottom:20 },
  routingLabel:{ fontSize:11, color:'var(--color-info-text)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 },
  routingValue:{ fontSize:13, color:'var(--color-ink)', marginTop:4, fontWeight:500 },
  checkRow:    { display:'flex', alignItems:'flex-start', gap:10, paddingBottom:10 },
  checkCircle: { width:22, height:22, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0, marginTop:1 },
  checkOwner:  { fontSize:11, color:'#888', marginTop:2 },
  notesInput:  { display:'block', width:'100%', padding:'10px 12px', border:'1px solid var(--color-line)', borderRadius:6, fontSize:13, fontFamily:'inherit', resize:'vertical', outline:'none' },
  bar:         { flex:1, height:6, background:'var(--color-line)', borderRadius:3, overflow:'hidden' },
  barFill:     { height:'100%', borderRadius:3, transition:'width 0.5s' },
  kvLabel:     { fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:500 },
  kvValue:     { fontSize:14, fontWeight:500, color:'var(--color-ink)', marginTop:4 },
  benchmarkNote:{ marginTop:8, padding:14, background:'#F5F3EE', borderRadius:8, fontSize:12, color:'#555', lineHeight:1.6 },
  inlineInput: {
    width: '100%',
    padding: '4px 6px',
    border: '1px solid var(--color-line)',
    borderRadius: 6,
    fontSize: 13,
    outline: 'none',
    background: 'white',
    marginTop: 4,
  },
  numberInput: {
    width: 60,
    padding: '4px 6px',
    border: '1px solid var(--color-line)',
    borderRadius: 6,
    fontSize: 13,
    textAlign: 'center',
    outline: 'none',
  }
};
