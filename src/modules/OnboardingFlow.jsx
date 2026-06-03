import React, { useState } from 'react';
import { USER_TYPES, ONBOARDING_STAGES } from '../data/constants.js';
import { PageHeader, Card, CardHeader, Note } from '../components/ui.jsx';

export default function OnboardingFlow({ users, setUsers, onCreateUser, onUpdateUser }) {
  const [draft, setDraft] = useState({ name: '', type: 'REFERRAL', market: '', email: '' });
  const [routing, setRouting] = useState(null);

  function simulate() {
    if (!draft.name) return;
    const id = `WC-${1000 + users.length + 1}`;
    const newUser = {
      id,
      name: draft.name,
      type: draft.type,
      stage: 1,
      leadsThisWeek: 0,
      dealsThisMonth: 0,
      joined: new Date().toISOString().split('T')[0],
      market: draft.market || '—',
      email: draft.email || '',
    };
    
    if (onCreateUser) {
      onCreateUser(newUser);
    } else {
      setUsers([newUser, ...users]);
    }

    let stage = 1;
    setRouting({ user: newUser, stage });
    const interval = setInterval(() => {
      stage += 1;
      if (stage > 6) {
        clearInterval(interval);
        if (onUpdateUser) {
          onUpdateUser(id, { stage: 6 });
        } else {
          setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, stage: 6 } : u)));
        }
        setTimeout(() => setRouting(null), 1200);
        return;
      }
      setRouting({ user: newUser, stage });
      if (onUpdateUser) {
        onUpdateUser(id, { stage });
      } else {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, stage } : u)));
      }
    }, 900);
  }

  return (
    <div style={styles.wrap}>
      <PageHeader
        title="Onboarding Flow"
        subtitle="6-step lead routing per Wave Closers scope v2.2"
      />

      <Card>
        <CardHeader title="Simulate a new lead" sub="Watch the routing happen in real time" />
        <div style={styles.simRow}>
          <input
            placeholder="Lead name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            style={styles.input}
          />
          <select
            value={draft.type}
            onChange={(e) => setDraft({ ...draft, type: e.target.value })}
            style={styles.input}
          >
            {Object.values(USER_TYPES).map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <input
            placeholder="Market (city, state)"
            value={draft.market}
            onChange={(e) => setDraft({ ...draft, market: e.target.value })}
            style={styles.input}
          />
          <input
            placeholder="Email (optional)"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            style={styles.input}
          />
          <button onClick={simulate} style={styles.primaryBtn}>Run flow →</button>
        </div>
      </Card>

      <Card>
        <CardHeader title="The 6-step flow" sub="End to end" />
        <div style={styles.flow}>
          {ONBOARDING_STAGES.map((stage, idx) => {
            const isActive = routing && routing.stage >= stage.id;
            const isCurrent = routing && routing.stage === stage.id;
            return (
              <React.Fragment key={stage.id}>
                <div
                  style={{
                    ...styles.node,
                    ...(isActive ? styles.nodeActive : {}),
                    ...(isCurrent ? styles.nodeCurrent : {}),
                  }}
                >
                  <div style={styles.num}>{stage.id}</div>
                  <div style={styles.nodeLabel}>{stage.label}</div>
                  <div style={styles.nodeOwner}>{stage.owner}</div>
                </div>
                {idx < ONBOARDING_STAGES.length - 1 && (
                  <div
                    style={{
                      ...styles.arrow,
                      ...(routing && routing.stage > stage.id ? styles.arrowActive : {}),
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
        {routing && (
          <div style={styles.routingBanner}>
            <strong>{routing.user.name}</strong> → currently at step {routing.stage}:{' '}
            <em>{ONBOARDING_STAGES[routing.stage - 1].label}</em>
          </div>
        )}
      </Card>

      <div className="wc-two-col" style={styles.twoCol}>
        <Card>
          <CardHeader title="Routing by user type" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.values(USER_TYPES).map((t) => (
              <div key={t.id} style={styles.routeRow}>
                <span
                  style={{
                    ...styles.typePill,
                    background: `${t.color}15`,
                    color: t.color,
                  }}
                >
                  {t.short}
                </span>
                <span style={styles.arrowText}>→</span>
                <span style={styles.routeStep}>Appointment Setter</span>
                <span style={styles.arrowText}>→</span>
                <span style={styles.routeStep}>
                  {t.route === 'CX' ? 'Customer Experience' : 'Recruiter / Franchise Sales'}
                </span>
                {t.route === 'RECRUITER' && (
                  <>
                    <span style={styles.arrowText}>→</span>
                    <span style={styles.routeStep}>CX</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="What CX does for every closed user" />
          <ul style={styles.cleanList}>
            <li><span style={styles.numDot}>1</span> Onboards user to the Wave Closers platform</li>
            <li><span style={styles.numDot}>2</span> Sends the contract</li>
            <li><span style={styles.numDot}>3</span> Sets up online learning access</li>
            <li><span style={styles.numDot}>4</span> Invites to Thursday sales training</li>
          </ul>
          <Note>Online learning link and Thursday meeting time pending William&apos;s confirmation.</Note>
        </Card>
      </div>

      {/* ── Live onboarding queue ── */}
      <Card>
        <CardHeader
          title="Live onboarding queue"
          sub={`${users.filter(u => u.stage < 4).length} users currently in stages 1-3`}
        />
        {users.filter(u => u.stage < 4).length === 0 ? (
          <Note>All users have passed onboarding — none in stages 1-3.</Note>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>{['User','Type','Stage','Owner','Joined','Status'].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {users.filter(u => u.stage < 4).map(u => {
                const t = USER_TYPES[u.type] || USER_TYPES.REFERRAL;
                const stage = ONBOARDING_STAGES[u.stage - 1];
                const joinedDate = u.joined ? new Date(u.joined) : null;
                const daysSince = joinedDate ? Math.floor((Date.now() - joinedDate.getTime()) / 86400000) : 0;
                const stalled = daysSince >= 3;
                return (
                  <tr key={u.id} style={stalled ? { background:'var(--color-amber-bg)' } : {}}>
                    <td style={styles.td}><strong>{u.name}</strong><div style={{ fontSize:11, color:'#888' }}>{u.id}</div></td>
                    <td style={styles.td}><span style={{ fontSize:11, padding:'2px 8px', borderRadius:4, background:`${t.color}15`, color:t.color, fontWeight:600 }}>{t.short}</span></td>
                    <td style={styles.td}>
                      <div style={{ fontSize:13, fontWeight:600 }}>Step {u.stage} / 6</div>
                      <div style={{ fontSize:11, color:'#888' }}>{stage?.label}</div>
                    </td>
                    <td style={styles.td}><span style={{ fontSize:12 }}>{stage?.owner}</span></td>
                    <td style={styles.td}><span style={{ fontSize:12 }}>{u.joined || '—'}</span><div style={{ fontSize:11, color: stalled ? 'var(--color-amber)' : '#888' }}>{daysSince}d since joined</div></td>
                    <td style={styles.td}>{stalled ? <span style={{ fontSize:11, fontWeight:600, color:'var(--color-amber-text)', background:'var(--color-amber-bg)', padding:'2px 8px', borderRadius:4 }}>⚠ Stalled</span> : <span style={{ fontSize:11, color:'var(--color-green)', fontWeight:600 }}>Active</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 16 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  simRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 12, marginTop: 4 },
  input: {
    padding: '10px 12px',
    border: '1px solid #DDD3C2',
    borderRadius: 6,
    fontSize: 13,
    outline: 'none',
    background: 'white',
  },
  primaryBtn: {
    background: 'var(--color-primary)',
    color: 'white',
    border: 'none',
    padding: '10px 18px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
  },
  flow: { display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0', overflowX: 'auto' },
  node: {
    minWidth: 130,
    padding: '12px 10px',
    border: '2px solid var(--color-line)',
    borderRadius: 8,
    background: 'white',
    textAlign: 'center',
    flexShrink: 0,
    transition: 'all 0.3s',
  },
  nodeActive: { borderColor: 'var(--color-primary)', background: 'var(--color-primary-soft)' },
  nodeCurrent: {
    borderColor: 'var(--color-accent)',
    background: '#FAEFE8',
    transform: 'scale(1.05)',
    boxShadow: 'var(--shadow-card-current)',
  },
  num: {
    width: 24,
    height: 24,
    background: 'var(--color-primary)',
    color: 'white',
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6,
  },
  nodeLabel: { fontSize: 12, fontWeight: 600, color: 'var(--color-ink)' },
  nodeOwner: { fontSize: 10, color: '#888', marginTop: 2 },
  arrow: { width: 24, height: 2, background: '#DDD3C2', flexShrink: 0, transition: 'background 0.3s' },
  arrowActive: { background: 'var(--color-primary)' },
  routingBanner: {
    marginTop: 12,
    padding: '12px 16px',
    background: 'var(--color-primary-soft)',
    borderRadius: 6,
    fontSize: 13,
    color: 'var(--color-primary)',
  },
  routeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 0',
    borderBottom: '1px solid var(--color-line-soft)',
    flexWrap: 'wrap',
  },
  typePill: { fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600 },
  arrowText: { color: '#999', fontSize: 12 },
  routeStep: { fontSize: 13, fontWeight: 500 },
  cleanList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  numDot: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    background: 'var(--color-primary)',
    color: 'white',
    borderRadius: '50%',
    fontSize: 11,
    fontWeight: 700,
    marginRight: 10,
  },
  table: { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th:    { textAlign:'left', padding:'9px 10px', borderBottom:'1px solid var(--color-line)', fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 },
  td:    { padding:'11px 10px', borderBottom:'1px solid var(--color-line-soft)', color:'#333', verticalAlign:'top' },
};
