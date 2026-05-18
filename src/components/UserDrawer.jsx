import React from 'react';
import { USER_TYPES, BENCHMARKS, ONBOARDING_STAGES } from '../data/constants.js';
import { computeStatus } from '../lib/status.js';
import { StatusPill } from './ui.jsx';

export default function UserDrawer({ user, onClose }) {
  const t = USER_TYPES[user.type];
  const bm = BENCHMARKS[user.type];
  const status = computeStatus(user);
  const leadProgress = Math.min(100, (user.leadsThisWeek / bm.weeklyLeads) * 100);
  const dealProgress = Math.min(100, (user.dealsThisMonth / bm.monthlyQuota) * 100);

  return (
    <>
      <div style={styles.backdrop} onClick={onClose} />
      <div style={styles.drawer}>
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>{user.id}</div>
            <h2 style={styles.name}>{user.name}</h2>
            <span
              style={{
                ...styles.typePill,
                background: `${t.color}15`,
                color: t.color,
                marginTop: 8,
                display: 'inline-block',
              }}
            >
              {t.label}
            </span>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close">×</button>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <StatusPill tier={status.tier} label={status.label} />
          </div>

          <Section label="Onboarding progress">
            <ProgressRow
              filled={(user.stage / 6) * 100}
              right={`Step ${user.stage}/6`}
              accent="var(--color-primary)"
            />
            <div style={styles.sub}>
              {ONBOARDING_STAGES[user.stage - 1].label} — {ONBOARDING_STAGES[user.stage - 1].owner}
            </div>
          </Section>

          <Section label="Leads this week">
            <ProgressRow
              filled={leadProgress}
              right={`${user.leadsThisWeek} / ${bm.weeklyLeads}`}
              accent={leadProgress >= 70 ? 'var(--color-green)' : 'var(--color-amber)'}
            />
          </Section>

          <Section label="Deals this month">
            <ProgressRow
              filled={dealProgress}
              right={`${user.dealsThisMonth} / ${bm.monthlyQuota}`}
              accent={dealProgress >= 70 ? 'var(--color-green)' : 'var(--color-amber)'}
            />
          </Section>

          <div style={styles.grid}>
            <KV label="Market" value={user.market} />
            <KV label="Joined" value={user.joined} />
            <KV
              label="Routing"
              value={t.route === 'CX' ? '→ CX direct' : '→ Recruiter → CX'}
            />
            <KV label="Target close rate" value={`${Math.round(bm.closeRate * 100)}%`} />
          </div>

          <div style={styles.benchmarkNote}>
            <strong>Benchmark note:</strong> placeholder values. Will be replaced once William
            confirms targets and quotas per user type.
          </div>
        </div>
      </div>
    </>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={styles.kvLabel}>{label}</div>
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  );
}

function ProgressRow({ filled, right, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={styles.bar}>
        <div style={{ ...styles.barFill, width: `${filled}%`, background: accent }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{right}</span>
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
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 },
  drawer: {
    position: 'fixed',
    top: 0,
    right: 0,
    width: 440,
    height: '100vh',
    background: 'white',
    zIndex: 51,
    overflowY: 'auto',
    boxShadow: 'var(--shadow-drawer)',
  },
  header: {
    padding: 24,
    borderBottom: '1px solid var(--color-line)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: '0.1em',
    color: '#888',
    textTransform: 'uppercase',
  },
  name: { margin: '4px 0 0 0', fontSize: 22 },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: 24,
    color: '#888',
    padding: 0,
    lineHeight: 1,
  },
  typePill: { fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600 },
  bar: {
    flex: 1,
    height: 6,
    background: 'var(--color-line)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3, transition: 'width 0.5s' },
  sub: { fontSize: 12, color: '#888', marginTop: 6 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 },
  kvLabel: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 500,
  },
  kvValue: { fontSize: 14, fontWeight: 500, color: 'var(--color-ink)', marginTop: 4 },
  benchmarkNote: {
    marginTop: 24,
    padding: 16,
    background: '#F5F3EE',
    borderRadius: 8,
    fontSize: 13,
    color: '#555',
    lineHeight: 1.6,
  },
};
