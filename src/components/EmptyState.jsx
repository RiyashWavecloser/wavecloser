/**
 * src/components/EmptyState.jsx
 * [BRANCH] main only
 *
 * Reusable empty state component — shown instead of dummy/seed data
 * when no real Airtable data is available.
 */
import React from 'react';

export default function EmptyState({ icon = '◉', title, message }) {
  return (
    <div style={S.wrap}>
      <div style={S.icon}>{icon}</div>
      <div style={S.title}>{title}</div>
      {message && <div style={S.message}>{message}</div>}
    </div>
  );
}

const S = {
  wrap: {
    display:         'flex',
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         '60px 20px',
    textAlign:       'center',
  },
  icon: {
    fontSize:     48,
    marginBottom: 16,
    opacity:      0.25,
    lineHeight:   1,
  },
  title: {
    fontSize:     16,
    fontWeight:   600,
    color:        '#555',
    marginBottom: 8,
  },
  message: {
    fontSize:   13,
    color:      '#888',
    maxWidth:   320,
    lineHeight: 1.6,
  },
};
