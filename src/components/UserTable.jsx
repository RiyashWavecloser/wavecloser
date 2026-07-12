import React from 'react';
import { USER_TYPES, BENCHMARKS } from '../data/constants.js';
import { computeStatus } from '../lib/status.js';
import { StatusPill } from './ui.jsx';

export default function UserTable({ users, onSelectUser }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>User</th>
            <th style={styles.th}>Type</th>
            <th style={styles.th}>Stage</th>
            <th style={styles.th}>Leads / wk</th>
            <th style={styles.th}>Deals / mo</th>
            <th style={styles.th}>Market</th>
            <th style={styles.th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const t = USER_TYPES[u.type];
            const bm = BENCHMARKS[u.type];
            const status = computeStatus(u);
            return (
              <tr key={u.id} onClick={() => onSelectUser(u)} style={styles.tr}>
                <td style={styles.td}>
                  <div style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{u.id}</div>
                </td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.typePill,
                      background: `${t.color}15`,
                      color: t.color,
                    }}
                  >
                    {t.short}
                  </span>
                </td>
                <td style={styles.td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={styles.stageBar}>
                      <div style={{ ...styles.stageFill, width: `${(u.stage / 6) * 100}%` }} />
                    </div>
                    <span style={{ fontSize: 12, color: '#666' }}>{u.stage}/6</span>
                  </div>
                </td>
                <td style={styles.td}>
                  {u.leadsThisWeek} <span style={styles.tdMuted}>/ {bm.weeklyLeads}</span>
                </td>
                <td style={styles.td}>
                  {u.dealsThisMonth} <span style={styles.tdMuted}>/ {bm.monthlyQuota}</span>
                </td>
                <td style={styles.td}>{u.market}</td>
                <td style={styles.td}>
                  <StatusPill tier={status.tier} label={status.label} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left',
    padding: '10px 8px',
    borderBottom: '1px solid var(--color-line)',
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 600,
  },
  td: { padding: '12px 8px', borderBottom: '1px solid var(--color-line-soft)', color: '#333' },
  tdMuted: { color: '#AAA', fontSize: 12 },
  tr: { cursor: 'pointer', transition: 'background 0.1s' },
  typePill: {
    fontSize: 11,
    padding: '3px 8px',
    borderRadius: 4,
    fontWeight: 600,
    display: 'inline-block',
  },
  stageBar: {
    width: 60,
    height: 6,
    background: 'var(--color-line)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  stageFill: {
    height: '100%',
    background: 'var(--color-primary)',
    borderRadius: 3,
    transition: 'width 0.3s',
  },
};
