/**
 * src/components/ResumeLeadsTab.jsx
 *
 * Agent-facing tab: shows today's Craigslist resume leads assigned to the
 * logged-in wave_closer_recruiter agent. Polls every 15 seconds for new leads.
 *
 * Features:
 * - Progress bar: X/20 contacted today
 * - Mobile-first card layout with tappable tel: links
 * - Per-row action buttons: Interested / Not Interested / Callback / No Answer
 * - Auto-save notes on blur
 * - Toast notification when new leads arrive mid-session
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchMyResumeLeads, updateResumeLeadAPI } from '../lib/dataLayer.js';

const STATUS_COLORS = {
  New:           { bg: '#F0F5FA', color: '#1F4E79', label: 'New' },
  Contacted:     { bg: '#FFF7E0', color: '#92600A', label: 'Contacted' },
  Interested:    { bg: '#E8F7EF', color: '#1E7A46', label: '✅ Interested' },
  NotInterested: { bg: '#FEF0F0', color: '#B91C1C', label: '❌ Not Interested' },
  NoAnswer:      { bg: '#F5F0FF', color: '#5B21B6', label: '🔇 No Answer' },
  Callback:      { bg: '#FFF4E0', color: '#B45309', label: '📞 Callback' },
};

export default function ResumeLeadsTab({ currentUser }) {
  const [leads, setLeads]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState(null);
  const [filter, setFilter]       = useState('All');
  const [expanded, setExpanded]   = useState({});
  const [notes, setNotes]         = useState({});       // local draft notes per id
  const [saving, setSaving]       = useState({});       // saving state per id
  const prevCountRef              = useRef(0);
  const pollRef                   = useRef(null);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const data = await fetchMyResumeLeads();
    const fetched = data?.leads || [];
    if (!silent && prevCountRef.current > 0 && fetched.length > prevCountRef.current) {
      showToast(`📋 ${fetched.length - prevCountRef.current} new resume leads assigned to you!`, 'success');
    }
    prevCountRef.current = fetched.length;
    setLeads(fetched);
    // Seed local notes from what's already saved
    setNotes(prev => {
      const merged = { ...prev };
      fetched.forEach(l => {
        if (merged[l.id] === undefined) merged[l.id] = l.outreachNotes || '';
      });
      return merged;
    });
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => load(true), 15000);
    return () => clearInterval(pollRef.current);
  }, [load]);

  const handleStatus = async (lead, status) => {
    const optimistic = leads.map(l => l.id === lead.id ? { ...l, status } : l);
    setLeads(optimistic);
    await updateResumeLeadAPI(lead.id, status, notes[lead.id]);
  };

  const handleNotesBlur = async (lead) => {
    const note = notes[lead.id] || '';
    if (note === lead.outreachNotes) return; // no change
    setSaving(prev => ({ ...prev, [lead.id]: true }));
    await updateResumeLeadAPI(lead.id, undefined, note);
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, outreachNotes: note } : l));
    setSaving(prev => ({ ...prev, [lead.id]: false }));
  };

  const today = new Date().toISOString().slice(0, 10);
  const todayLeads = leads.filter(l => l.assignedDate === today);
  const contacted  = todayLeads.filter(l => l.status !== 'New').length;
  const interested = todayLeads.filter(l => l.status === 'Interested').length;
  const progress   = todayLeads.length > 0 ? Math.round((contacted / todayLeads.length) * 100) : 0;

  const filtered = filter === 'All' ? leads
    : filter === 'Today' ? todayLeads
    : leads.filter(l => l.status === filter);

  const markets = [...new Set(leads.map(l => l.market).filter(Boolean))];

  return (
    <div style={S.root}>
      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, background: toast.type === 'success' ? '#2D9B5E' : toast.type === 'error' ? '#D44A4A' : '#5B8DEF' }}>
          {toast.msg}
        </div>
      )}

      {/* Header stats */}
      <div style={S.statsCard}>
        <div style={S.statsRow}>
          <div style={S.stat}><div style={S.statNum}>{todayLeads.length}</div><div style={S.statLabel}>Today's Leads</div></div>
          <div style={S.stat}><div style={{ ...S.statNum, color: '#1F4E79' }}>{contacted}</div><div style={S.statLabel}>Contacted</div></div>
          <div style={S.stat}><div style={{ ...S.statNum, color: '#1E7A46' }}>{interested}</div><div style={S.statLabel}>Interested</div></div>
        </div>
        {todayLeads.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={S.progressLabel}>Progress: {contacted}/{todayLeads.length} contacted</div>
            <div style={S.progressBarOuter}>
              <div style={{ ...S.progressBarInner, width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div style={S.filterBar}>
        {['All', 'Today', 'New', 'Interested', 'Callback', 'NoAnswer', 'NotInterested'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ ...S.filterBtn, ...(filter === f ? S.filterBtnActive : {}) }}>
            {f}
          </button>
        ))}
      </div>

      {/* Lead list */}
      {loading ? (
        <div style={S.emptyState}>Loading your leads...</div>
      ) : filtered.length === 0 ? (
        <div style={S.emptyState}>
          {leads.length === 0
            ? '📭 No resume leads assigned yet. Ask an admin to run the distribution.'
            : 'No leads match this filter.'}
        </div>
      ) : (
        <div style={S.list}>
          {filtered.map((lead, idx) => {
            const sc   = STATUS_COLORS[lead.status] || STATUS_COLORS.New;
            const isEx = expanded[lead.id];
            return (
              <div key={lead.id} style={{ ...S.card, borderLeft: `4px solid ${sc.color}` }}>
                {/* Row header */}
                <div style={S.cardHeader} onClick={() => setExpanded(prev => ({ ...prev, [lead.id]: !prev[lead.id] }))}>
                  <span style={S.idx}>{idx + 1}</span>
                  <div style={S.cardTitle}>
                    <div style={S.candidateName}>{lead.title}</div>
                    <div style={S.candidateMeta}>{lead.market}{lead.assignedDate === today ? ' · Today' : ` · ${lead.assignedDate}`}</div>
                  </div>
                  <span style={{ ...S.statusBadge, background: sc.bg, color: sc.color }}>{sc.label}</span>
                  <span style={S.chevron}>{isEx ? '▲' : '▼'}</span>
                </div>

                {/* Expanded detail */}
                {isEx && (
                  <div style={S.cardBody}>
                    {/* Contact info */}
                    <div style={S.contactRow}>
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} style={S.phoneLink}>📞 {lead.phone}</a>
                      )}
                      {lead.email && (
                        <a href={`mailto:${lead.email}`} style={S.emailLink}>✉️ {lead.email}</a>
                      )}
                      {lead.craigslistUrl && (
                        <a href={lead.craigslistUrl} target="_blank" rel="noopener noreferrer" style={S.clLink}>🔗 View Post</a>
                      )}
                    </div>

                    {/* Description */}
                    {lead.description && (
                      <div style={S.description}>{lead.description}</div>
                    )}

                    {/* Action buttons */}
                    <div style={S.actionRow}>
                      {[
                        { status: 'Interested',    label: '✅ Interested',     color: '#2D9B5E', bg: '#E8F7EF' },
                        { status: 'NotInterested', label: '❌ Not Int.',        color: '#B91C1C', bg: '#FEF0F0' },
                        { status: 'Callback',      label: '📞 Callback',        color: '#B45309', bg: '#FFF4E0' },
                        { status: 'NoAnswer',      label: '🔇 No Answer',       color: '#5B21B6', bg: '#F5F0FF' },
                      ].map(a => (
                        <button
                          key={a.status}
                          onClick={() => handleStatus(lead, a.status)}
                          style={{
                            ...S.actionBtn,
                            background: lead.status === a.status ? a.color : a.bg,
                            color:      lead.status === a.status ? '#fff'   : a.color,
                            border:     `1px solid ${a.color}`,
                          }}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>

                    {/* Notes */}
                    <textarea
                      placeholder="Outreach notes..."
                      value={notes[lead.id] ?? lead.outreachNotes ?? ''}
                      onChange={e => setNotes(prev => ({ ...prev, [lead.id]: e.target.value }))}
                      onBlur={() => handleNotesBlur(lead)}
                      style={S.notesInput}
                    />
                    {saving[lead.id] && <div style={S.savingHint}>Saving...</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const S = {
  root:           { padding: '0 0 80px', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  toast:          { position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', padding: '12px 24px', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, zIndex: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', maxWidth: '90vw', textAlign: 'center' },
  statsCard:      { margin: '16px 20px', background: '#fff', borderRadius: 12, padding: '20px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', border: '1px solid #EBE6DC' },
  statsRow:       { display: 'flex', gap: 16 },
  stat:           { flex: 1, textAlign: 'center' },
  statNum:        { fontSize: 28, fontWeight: 800, color: '#1A1A1A', lineHeight: 1 },
  statLabel:      { fontSize: 11, color: '#888', fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' },
  progressLabel:  { fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 6 },
  progressBarOuter: { height: 10, background: '#EBE6DC', borderRadius: 5, overflow: 'hidden' },
  progressBarInner: { height: '100%', background: 'linear-gradient(90deg, #1F4E79, #2D9B5E)', borderRadius: 5, transition: 'width 0.4s ease' },
  filterBar:      { display: 'flex', gap: 6, padding: '0 20px 12px', overflowX: 'auto', scrollbarWidth: 'none' },
  filterBtn:      { padding: '7px 14px', borderRadius: 20, border: '1px solid #DDD', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#555', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s' },
  filterBtnActive: { background: '#1F4E79', color: '#fff', borderColor: '#1F4E79' },
  emptyState:     { textAlign: 'center', padding: '48px 20px', color: '#888', fontSize: 14, lineHeight: 1.6 },
  list:           { padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 },
  card:           { background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid #EBE6DC' },
  cardHeader:     { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer' },
  idx:            { fontSize: 12, fontWeight: 700, color: '#AAA', minWidth: 22, flexShrink: 0 },
  cardTitle:      { flex: 1, minWidth: 0 },
  candidateName:  { fontSize: 14, fontWeight: 700, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  candidateMeta:  { fontSize: 11, color: '#888', marginTop: 2 },
  statusBadge:    { padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 },
  chevron:        { fontSize: 11, color: '#AAA', flexShrink: 0 },
  cardBody:       { padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  contactRow:     { display: 'flex', gap: 10, flexWrap: 'wrap' },
  phoneLink:      { fontSize: 16, fontWeight: 700, color: '#1F4E79', textDecoration: 'none', padding: '8px 14px', background: '#EEF4FF', borderRadius: 8 },
  emailLink:      { fontSize: 13, color: '#1F4E79', textDecoration: 'none', padding: '8px 14px', background: '#EEF4FF', borderRadius: 8 },
  clLink:         { fontSize: 13, color: '#555', textDecoration: 'none', padding: '8px 14px', background: '#F5F5F5', borderRadius: 8 },
  description:    { fontSize: 13, color: '#555', lineHeight: 1.5, padding: '10px 12px', background: '#FAFAFA', borderRadius: 6, border: '1px solid #EEE' },
  actionRow:      { display: 'flex', gap: 8, flexWrap: 'wrap' },
  actionBtn:      { flex: 1, minWidth: 'calc(50% - 4px)', padding: '10px 4px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', minHeight: 44 },
  notesInput:     { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #DDD', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', minHeight: 64, boxSizing: 'border-box', lineHeight: 1.5 },
  savingHint:     { fontSize: 11, color: '#888', fontStyle: 'italic', marginTop: -6 },
};
