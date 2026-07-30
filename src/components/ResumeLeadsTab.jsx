/**
 * src/components/ResumeLeadsTab.jsx
 *
 * Agent-facing tab: shows Craigslist resume leads assigned to the logged-in
 * wave_closer_recruiter agent.
 *
 * Tabs:
 *   "My Assigned Leads"  — lists all leads assigned by admin or via self-search
 *   "Find My Own Leads"  — free-text city + keyword input to self-search Craigslist
 *
 * All leads are globally deduplicated on the server — agents only ever see fresh candidates.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchMyResumeLeads, updateResumeLeadAPI, agentSelfSearchAndClaim } from '../lib/dataLayer.js';

const STATUS_COLORS = {
  New:           { bg: '#F0F5FA', color: '#1F4E79', label: 'New' },
  Contacted:     { bg: '#FFF7E0', color: '#92600A', label: 'Contacted' },
  Interested:    { bg: '#E8F7EF', color: '#1E7A46', label: '✅ Interested' },
  NotInterested: { bg: '#FEF0F0', color: '#B91C1C', label: '❌ Not Interested' },
  NoAnswer:      { bg: '#F5F0FF', color: '#5B21B6', label: '🔇 No Answer' },
  Callback:      { bg: '#FFF4E0', color: '#B45309', label: '📞 Callback' },
};

export default function ResumeLeadsTab({ currentUser }) {
  // ─── Assigned leads state ───────────────────────────────────────────────────
  const [leads, setLeads]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState(null);
  const [filter, setFilter]       = useState('All');
  const [expanded, setExpanded]   = useState({});
  const [notes, setNotes]         = useState({});
  const [saving, setSaving]       = useState({});
  const prevCountRef              = useRef(0);
  const pollRef                   = useRef(null);

  // ─── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('assigned'); // 'assigned' | 'find'

  // ─── Self-search state ──────────────────────────────────────────────────────
  const [searchCity, setSearchCity]       = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchCount, setSearchCount]     = useState(20);
  const [searching, setSearching]         = useState(false);
  const [searchResult, setSearchResult]   = useState(null);

  // ─── Toast ──────────────────────────────────────────────────────────────────
  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  // ─── Load assigned leads ─────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const data = await fetchMyResumeLeads();
    const fetched = data?.leads || [];
    if (!silent && prevCountRef.current > 0 && fetched.length > prevCountRef.current) {
      showToast(`📋 ${fetched.length - prevCountRef.current} new resume leads assigned to you!`, 'success');
    }
    prevCountRef.current = fetched.length;
    setLeads(fetched);
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

  // ─── Update lead status ──────────────────────────────────────────────────────
  const handleStatus = async (lead, status) => {
    const optimistic = leads.map(l => l.id === lead.id ? { ...l, status } : l);
    setLeads(optimistic);
    await updateResumeLeadAPI(lead.id, status, notes[lead.id]);
  };

  const handleNotesBlur = async (lead) => {
    const note = notes[lead.id] || '';
    if (note === lead.outreachNotes) return;
    setSaving(prev => ({ ...prev, [lead.id]: true }));
    await updateResumeLeadAPI(lead.id, undefined, note);
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, outreachNotes: note } : l));
    setSaving(prev => ({ ...prev, [lead.id]: false }));
  };

  // ─── Self-search handler ─────────────────────────────────────────────────────
  const handleSelfSearch = async (e) => {
    e.preventDefault();
    if (!searchCity.trim()) {
      showToast('Enter a city name first', 'error');
      return;
    }
    setSearching(true);
    setSearchResult(null);
    try {
      const result = await agentSelfSearchAndClaim(
        searchCity.trim(),
        searchKeyword.trim() || 'sales',
        searchCount
      );
      setSearchResult(result);
      if (result.success && result.assigned > 0) {
        showToast(`${result.assigned} fresh lead${result.assigned !== 1 ? 's' : ''} added to your queue!`, 'success');
        setTimeout(() => load(true), 1500);
      } else if (!result.success) {
        showToast(result.message || result.error || 'No new leads found', 'error');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
      setSearchResult({ success: false, message: err.message });
    } finally {
      setSearching(false);
    }
  };

  // ─── Stats ───────────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const todayLeads = leads.filter(l => l.assignedDate === today);
  const contacted  = todayLeads.filter(l => l.status !== 'New').length;
  const interested = todayLeads.filter(l => l.status === 'Interested').length;
  const progress   = todayLeads.length > 0 ? Math.round((contacted / todayLeads.length) * 100) : 0;

  const filtered = filter === 'All' ? leads
    : filter === 'Today' ? todayLeads
    : leads.filter(l => l.status === filter);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={S.root}>
      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, background: toast.type === 'success' ? '#2D9B5E' : toast.type === 'error' ? '#D44A4A' : '#5B8DEF' }}>
          {toast.msg}
        </div>
      )}

      {/* Tab Toggle */}
      <div style={S.tabRow}>
        <button
          style={{ ...S.tab, ...(activeTab === 'assigned' ? S.tabActive : {}) }}
          onClick={() => setActiveTab('assigned')}
        >
          📋 My Assigned Leads{leads.length > 0 ? ` (${leads.length})` : ''}
        </button>
        <button
          style={{ ...S.tab, ...(activeTab === 'find' ? S.tabActive : {}) }}
          onClick={() => setActiveTab('find')}
        >
          🔍 Find My Own Leads
        </button>
      </div>

      {/* ── TAB: MY ASSIGNED LEADS ────────────────────────────────────────── */}
      {activeTab === 'assigned' && (
        <>
          {/* Stats card */}
          <div style={S.statsCard}>
            <div style={S.statsRow}>
              <div style={S.stat}><div style={S.statNum}>{todayLeads.length}</div><div style={S.statLabel}>Today</div></div>
              <div style={S.stat}><div style={{ ...S.statNum, color: '#1F4E79' }}>{contacted}</div><div style={S.statLabel}>Contacted</div></div>
              <div style={S.stat}><div style={{ ...S.statNum, color: '#1E7A46' }}>{interested}</div><div style={S.statLabel}>Interested</div></div>
              <div style={S.stat}><div style={{ ...S.statNum, color: '#444' }}>{leads.length}</div><div style={S.statLabel}>Total</div></div>
            </div>
            {todayLeads.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={S.progressLabel}>Progress: {contacted}/{todayLeads.length} contacted today</div>
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
              {leads.length === 0 ? (
                <div>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
                  <div style={{ fontWeight: 700, marginBottom: 8, color: '#444' }}>No resume leads assigned yet</div>
                  <div style={{ fontSize: 13, color: '#999', marginBottom: 16 }}>Find your own leads from Craigslist below.</div>
                  <button onClick={() => setActiveTab('find')} style={S.ctaBtn}>
                    🔍 Find My Own Leads
                  </button>
                </div>
              ) : 'No leads match this filter.'}
            </div>
          ) : (
            <div style={S.list}>
              {filtered.map((lead, idx) => {
                const sc   = STATUS_COLORS[lead.status] || STATUS_COLORS.New;
                const isEx = expanded[lead.id];
                return (
                  <div key={lead.id} style={{ ...S.card, borderLeft: `4px solid ${sc.color}` }}>
                    <div style={S.cardHeader} onClick={() => setExpanded(prev => ({ ...prev, [lead.id]: !prev[lead.id] }))}>
                      <span style={S.idx}>{idx + 1}</span>
                      <div style={S.cardTitle}>
                        <div style={S.candidateName}>{lead.title}</div>
                        <div style={S.candidateMeta}>{lead.market}{lead.assignedDate === today ? ' · Today' : ` · ${lead.assignedDate}`}</div>
                      </div>
                      <span style={{ ...S.statusBadge, background: sc.bg, color: sc.color }}>{sc.label}</span>
                      <span style={S.chevron}>{isEx ? '▲' : '▼'}</span>
                    </div>

                    {isEx && (
                      <div style={S.cardBody}>
                        <div style={S.contactRow}>
                          {lead.phone && <a href={`tel:${lead.phone}`} style={S.phoneLink}>📞 {lead.phone}</a>}
                          {lead.email && <a href={`mailto:${lead.email}`} style={S.emailLink}>✉️ {lead.email}</a>}
                          {lead.craigslistUrl && (
                            <a href={lead.craigslistUrl} target="_blank" rel="noopener noreferrer" style={S.clLink}>🔗 View Post</a>
                          )}
                        </div>
                        {lead.description && <div style={S.description}>{lead.description}</div>}
                        <div style={S.actionRow}>
                          {[
                            { status: 'Interested',    label: '✅ Interested',  color: '#2D9B5E', bg: '#E8F7EF' },
                            { status: 'NotInterested', label: '❌ Not Int.',     color: '#B91C1C', bg: '#FEF0F0' },
                            { status: 'Callback',      label: '📞 Callback',     color: '#B45309', bg: '#FFF4E0' },
                            { status: 'NoAnswer',      label: '🔇 No Answer',    color: '#5B21B6', bg: '#F5F0FF' },
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
        </>
      )}

      {/* ── TAB: FIND MY OWN LEADS ────────────────────────────────────────── */}
      {activeTab === 'find' && (
        <div style={S.findRoot}>
          <div style={S.findCard}>
            <div style={S.findTitle}>🔍 Find Craigslist Leads</div>
            <div style={S.findSubtitle}>
              Enter any city and a keyword to search Craigslist resumes. Only fresh candidates (never assigned to anyone before) will be added to your queue.
            </div>

            <form onSubmit={handleSelfSearch}>
              {/* City input — free-text, no dropdown */}
              <label style={S.label}>City</label>
              <input
                type="text"
                placeholder="e.g. Houston TX, Miami, Chicago IL, Atlanta..."
                value={searchCity}
                onChange={e => setSearchCity(e.target.value)}
                style={S.input}
                required
              />
              <div style={S.hint}>Type any city name — no dropdown needed, just type it.</div>

              {/* Keyword input */}
              <label style={S.label}>Keyword</label>
              <input
                type="text"
                placeholder="e.g. sales, customer service, driver, admin..."
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                style={S.input}
              />
              <div style={S.hint}>Short single keywords work best — try "sales" or "admin".</div>

              {/* Count picker */}
              <label style={S.label}>How many leads?</label>
              <div style={S.countRow}>
                {[10, 20, 30, 50].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSearchCount(n)}
                    style={{
                      ...S.countBtn,
                      background:  searchCount === n ? '#1F4E79' : '#fff',
                      color:       searchCount === n ? '#fff'    : '#555',
                      borderColor: searchCount === n ? '#1F4E79' : '#DDD',
                    }}
                  >
                    {n}
                  </button>
                ))}
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={searchCount}
                  onChange={e => setSearchCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                  style={S.countCustom}
                />
              </div>
              <div style={S.hint}>Max 100 per search</div>

              <button
                type="submit"
                disabled={searching}
                style={{ ...S.submitBtn, opacity: searching ? 0.7 : 1 }}
              >
                {searching ? '⏳ Searching Craigslist...' : '🔍 Search & Claim Leads'}
              </button>
            </form>

            {/* Result box */}
            {searchResult && !searching && (
              <div style={{
                ...S.resultBox,
                borderColor: searchResult.success ? '#A7F3D0' : '#FCA5A5',
                background:  searchResult.success ? '#F0FDF4' : '#FFF5F5',
              }}>
                {searchResult.success ? (
                  <>
                    <div style={{ color: '#2D9B5E', fontWeight: 800, fontSize: 16, marginBottom: 6 }}>
                      ✅ {searchResult.assigned} fresh lead{searchResult.assigned !== 1 ? 's' : ''} added to your queue!
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {searchResult.totalFound} found on Craigslist · {searchResult.freshFound} never assigned before · {searchResult.assigned} saved to your leads
                    </div>
                    <button
                      onClick={() => setActiveTab('assigned')}
                      style={{ ...S.submitBtn, marginTop: 14, fontSize: 14, padding: '10px 20px' }}
                    >
                      📋 View My Assigned Leads →
                    </button>
                  </>
                ) : (
                  <div style={{ color: '#B91C1C', fontWeight: 600 }}>
                    ⚠️ {searchResult.message || searchResult.error || 'No new leads found. Try a different city or keyword.'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tips */}
          <div style={S.tipsCard}>
            <div style={{ fontWeight: 700, marginBottom: 10, color: '#1F4E79' }}>💡 Tips for Best Results</div>
            <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 13, color: '#555', lineHeight: 1.9 }}>
              <li>Use <strong>short single keywords</strong> — "sales" finds more than "sales manager"</li>
              <li>Type the city naturally — "Chicago IL", "Houston TX", "Miami" all work</li>
              <li>Already-assigned candidates are automatically filtered out — fresh only</li>
              <li>Try different keywords for the same city to get more leads</li>
              <li>Leads appear in "My Assigned Leads" immediately after claiming</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  root:           { padding: '0 0 80px', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  toast:          { position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', padding: '12px 24px', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, zIndex: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', maxWidth: '90vw', textAlign: 'center' },

  // Tab toggle
  tabRow:         { display: 'flex', background: '#EAECEF', borderRadius: 8, padding: 4, margin: '14px 20px 0 20px' },
  tab:            { flex: 1, border: 0, background: 'transparent', color: '#555', padding: '9px 12px', fontSize: 13, fontWeight: 600, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' },
  tabActive:      { background: '#1F4E79', color: '#fff' },

  // Assigned leads tab
  statsCard:      { margin: '16px 20px', background: '#fff', borderRadius: 12, padding: '20px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', border: '1px solid #EBE6DC' },
  statsRow:       { display: 'flex', gap: 12 },
  stat:           { flex: 1, textAlign: 'center' },
  statNum:        { fontSize: 24, fontWeight: 800, color: '#1A1A1A', lineHeight: 1 },
  statLabel:      { fontSize: 10, color: '#888', fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' },
  progressLabel:  { fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 6 },
  progressBarOuter: { height: 10, background: '#EBE6DC', borderRadius: 5, overflow: 'hidden' },
  progressBarInner: { height: '100%', background: 'linear-gradient(90deg, #1F4E79, #2D9B5E)', borderRadius: 5, transition: 'width 0.4s ease' },
  filterBar:      { display: 'flex', gap: 6, padding: '12px 20px 10px', overflowX: 'auto', scrollbarWidth: 'none' },
  filterBtn:      { padding: '7px 14px', borderRadius: 20, border: '1px solid #DDD', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#555', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s' },
  filterBtnActive: { background: '#1F4E79', color: '#fff', borderColor: '#1F4E79' },
  emptyState:     { textAlign: 'center', padding: '48px 20px', color: '#888', fontSize: 14, lineHeight: 1.6 },
  ctaBtn:         { display: 'inline-block', padding: '12px 24px', background: 'linear-gradient(135deg, #1F4E79, #2D9B5E)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
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

  // Find My Own Leads tab
  findRoot:       { padding: '16px 20px' },
  findCard:       { background: '#fff', borderRadius: 14, padding: '24px', border: '1px solid #EBE6DC', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', marginBottom: 16 },
  findTitle:      { fontSize: 20, fontWeight: 800, color: '#1A1A1A', marginBottom: 6 },
  findSubtitle:   { fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 1.65 },
  label:          { display: 'block', fontSize: 13, fontWeight: 700, color: '#333', marginBottom: 6, marginTop: 18 },
  input:          { width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #DDD', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', minHeight: 48, outline: 'none', transition: 'border-color 0.2s' },
  hint:           { fontSize: 11, color: '#999', marginTop: 4 },
  countRow:       { display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' },
  countBtn:       { padding: '9px 16px', borderRadius: 8, border: '1px solid #DDD', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', minWidth: 54 },
  countCustom:    { width: 72, padding: '9px 12px', borderRadius: 8, border: '1px solid #DDD', fontSize: 14, fontFamily: 'inherit', textAlign: 'center' },
  submitBtn:      { width: '100%', marginTop: 22, padding: '15px', background: 'linear-gradient(135deg, #1F4E79, #2D9B5E)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(31,78,121,0.2)', transition: 'opacity 0.2s' },
  resultBox:      { marginTop: 20, padding: '18px', borderRadius: 10, border: '2px solid', fontSize: 14 },
  tipsCard:       { background: '#F8FAFF', borderRadius: 12, padding: '18px 20px', border: '1px solid #D6E6FF' },
};
