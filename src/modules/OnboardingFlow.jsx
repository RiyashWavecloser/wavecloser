import React, { useState } from 'react';
import { USER_TYPES, ONBOARDING_STAGES } from '../data/constants.js';
import { PageHeader, Card, CardHeader, Note } from '../components/ui.jsx';

export default function OnboardingFlow({ users, setUsers }) {
  const [draft, setDraft] = useState({ name: '', type: 'REFERRAL', market: '' });
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
    };
    setUsers([newUser, ...users]);

    let stage = 1;
    setRouting({ user: newUser, stage });
    const interval = setInterval(() => {
      stage += 1;
      if (stage > 6) {
        clearInterval(interval);
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, stage: 6 } : u)));
        setTimeout(() => setRouting(null), 1200);
        return;
      }
      setRouting({ user: newUser, stage });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, stage } : u)));
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

      <div style={styles.twoCol}>
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
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 16 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  simRow: { display: 'grid', gridTemplateColumns: '2fr 2fr 2fr auto', gap: 12, marginTop: 4 },
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
};
