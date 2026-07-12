import React from 'react';

export function PageHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <h1 style={styles.title}>{title}</h1>
      <p style={styles.subtitle}>{subtitle}</p>
    </div>
  );
}

export function Card({ children, style }) {
  return <div style={{ ...styles.card, ...style }}>{children}</div>;
}

export function CardHeader({ title, sub, right }) {
  return (
    <div style={styles.cardHeader}>
      <h3 style={styles.cardTitle}>{title}</h3>
      {right || (sub && <span style={styles.cardSub}>{sub}</span>)}
    </div>
  );
}

export function StatCard({ label, value, sub, tone }) {
  const accent =
    tone === 'green' ? 'var(--color-green)' :
    tone === 'amber' ? 'var(--color-amber)' :
    tone === 'red'   ? 'var(--color-red)'   :
    'var(--color-primary)';
  return (
    <div style={{ ...styles.statCard, borderTop: `3px solid ${accent}` }}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statSub}>{sub}</div>
    </div>
  );
}

export function StatusPill({ tier, label }) {
  const map = {
    green: { bg: 'var(--color-green-bg)', text: 'var(--color-green-text)', dot: 'var(--color-green)' },
    amber: { bg: 'var(--color-amber-bg)', text: 'var(--color-amber-text)', dot: 'var(--color-amber)' },
    red:   { bg: 'var(--color-red-bg)',   text: 'var(--color-red-text)',   dot: 'var(--color-red)'   },
    onboarding: { bg: 'var(--color-info-bg)', text: 'var(--color-info-text)', dot: 'var(--color-info)' },
  };
  const c = map[tier] || map.onboarding;
  return (
    <span style={{ ...styles.statusPill, background: c.bg, color: c.text }}>
      <span style={{ ...styles.statusDot, background: c.dot }} />
      {label}
    </span>
  );
}

export function Note({ children, tone = 'neutral' }) {
  const color = tone === 'warn' ? 'var(--color-amber)' : '#666';
  return <div style={{ ...styles.note, color }}>{children}</div>;
}

const styles = {
  title: { fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' },
  subtitle: { fontSize: 14, color: '#777', margin: '4px 0 0 0' },

  card: {
    background: 'white',
    padding: 20,
    borderRadius: 8,
    border: '1px solid var(--color-line)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--color-ink)' },
  cardSub: { fontSize: 12, color: '#888' },

  statCard: {
    background: 'white',
    padding: 16,
    borderRadius: 8,
    border: '1px solid var(--color-line)',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 500,
  },
  statValue: { fontSize: 32, fontWeight: 700, margin: '4px 0', letterSpacing: '-0.02em' },
  statSub: { fontSize: 11, color: '#999' },

  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 10px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
  },
  statusDot: { width: 6, height: 6, borderRadius: '50%' },

  note: {
    marginTop: 12,
    padding: '10px 14px',
    background: '#F5F3EE',
    borderRadius: 6,
    fontSize: 12,
    lineHeight: 1.5,
  },
};
