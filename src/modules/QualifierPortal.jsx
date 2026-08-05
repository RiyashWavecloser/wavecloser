import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BUSINESS_TYPES, QUALIFIER_STATUSES, USER_TYPES } from '../data/constants.js';
import {
  fetchQualifierQueueAPI,
  fetchQualifierCompletedAPI,
  updateQualifierStatusAPI,
  qualifyLeadAPI,
  loadLeadsFromStorage,
} from '../lib/dataLayer.js';

/**
 * QualifierPortal — Qualifier's workspace for qualifying interested leads.
 *
 * Props:
 *   embedded      — if true, hide standalone header (rendered inside sidebar layout)
 *   completedView — if true, show only completed leads (Qualified + NotAFit)
 *   currentUser   — logged in user object
 *   onLogout      — logout handler
 */
export default function QualifierPortal({ currentUser: _currentUser, onLogout, embedded, completedView, setUsers }) {
  const [leads, setLeads] = useState([]);
  const [filter, setFilter] = useState(completedView ? 'completed' : 'all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('score');
  const [toast, setToast] = useState(null);
  const [isDemo, setIsDemo] = useState(true);
  const [qualifyModal, setQualifyModal] = useState(null);
  const [qualifyType, setQualifyType] = useState('');
  const [qualifyNotes, setQualifyNotes] = useState('');
  const [noteValues, setNoteValues] = useState({});

  // Deduplicate leads by placeId — keeps the first (most recent) occurrence
  function deduplicateLeads(arr) {
    const seen = new Set();
    return arr.filter(l => {
      const key = l.placeId;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Load Qualifier's queue or completed list
  const loadQueue = useCallback(async () => {
    if (completedView) {
      const rawCompleted = await fetchQualifierCompletedAPI();
      if (rawCompleted !== null) {
        const live = deduplicateLeads(rawCompleted);
        setLeads(live);
        setIsDemo(false);
        setNoteValues(prev => {
          const next = { ...prev };
          live.forEach(l => {
            next[l.placeId] = l.qualifierNotes || '';
          });
          return next;
        });
      } else if (leads.length === 0) {
        setIsDemo(true);
        const stored = loadLeadsFromStorage();
        const all = stored || [];
        setLeads(all.filter(l => l.qualifierStatus === 'QualifierQualified' || l.qualifierStatus === 'QualifierNotAFit'));
      }
    } else {
      const raw = await fetchQualifierQueueAPI();
      if (raw !== null) {
        const live = deduplicateLeads(raw);
        setLeads(live);
        setIsDemo(false);
        setNoteValues(prev => {
          const next = { ...prev };
          live.forEach(l => {
            next[l.placeId] = l.qualifierNotes || '';
          });
          return next;
        });
      } else if (leads.length === 0) {
        setIsDemo(true);
        const stored = loadLeadsFromStorage();
        const all = stored || [];
        setLeads(all.filter(l => l.outcome === 'Interested' || l.status === 'SentToQualifier'));
      }
    }
  }, [completedView, leads.length]);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 30000); // 30 seconds polling
    return () => clearInterval(interval);
  }, [loadQueue]);

  // Sync completedView prop to filter
  useEffect(() => {
    if (completedView) setFilter('completed');
  }, [completedView]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Optimistic status update helper ──────────────────────────────────────────
  async function handleStatusChange(leadPlaceId, newStatus, extraFields = {}) {
    // 1. Grab current notes from noteValues state
    const currentNotes = noteValues[leadPlaceId] ?? '';

    // 2. Snapshot old state for rollback on error
    const prevLeads = leads;

    // 3. Optimistic update — lead moves to the correct tab instantly
    setLeads(prev => prev.map(l =>
      l.placeId === leadPlaceId
        ? { ...l, qualifierStatus: newStatus, qualifierNotes: currentNotes, ...extraFields }
        : l
    ));

    // 4. Save to server — show error and rollback on failure
    try {
      const result = await updateQualifierStatusAPI(leadPlaceId, newStatus, currentNotes);
      if (result?.demo) {
        // Server returned demo mode — Airtable not configured or save silently failed
        setLeads(prevLeads);
        showToast('⚠️ Could not save — server offline or session expired. Please refresh.', 'error');
      }
    } catch (err) {
      setLeads(prevLeads);
      if (err.message === 'SESSION_EXPIRED') {
        showToast('⏱ Session expired — please log in again.', 'error');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        showToast(`❌ Save failed: ${err.message || 'Unknown error'}`, 'error');
      }
    }
  }

  // Mark contacted
  function handleContacted(lead) {
    handleStatusChange(lead.placeId, 'QualifierContacted', {
      qualifierContactedAt: new Date().toISOString(),
    });
    showToast(`${lead.businessName} marked as Contacted`);
  }

  // Mark not a fit
  function handleNotAFit(lead) {
    handleStatusChange(lead.placeId, 'QualifierNotAFit');
    showToast(`${lead.businessName} marked as Not a Fit`, 'info');
  }

  // Mark follow up
  function handleFollowUp(lead) {
    handleStatusChange(lead.placeId, 'QualifierFollowUp');
    showToast(`${lead.businessName} marked for Follow Up`);
  }

  // Update notes — onBlur (also saves to server)
  function handleNotesBlur(lead, notes) {
    setNoteValues(prev => ({ ...prev, [lead.placeId]: notes }));
    setLeads(prev => prev.map(l =>
      l.placeId === lead.placeId ? { ...l, qualifierNotes: notes } : l
    ));
    updateQualifierStatusAPI(lead.placeId, lead.qualifierStatus || 'QualifierNew', notes).catch(() => {});
  }

  // Track notes as user types (state, reactive)
  function handleNotesInput(placeId, value) {
    setNoteValues(prev => ({ ...prev, [placeId]: value }));
  }

  // Open qualify modal
  function openQualify(lead) {
    setQualifyModal(lead);
    setQualifyType('');
    setQualifyNotes(noteValues[lead.placeId] ?? lead.qualifierNotes ?? '');
  }

  // Submit qualify
  async function handleQualifySubmit() {
    if (!qualifyType || !qualifyModal) return;
    const lead = qualifyModal;
    const routeTo = (qualifyType === 'REFERRAL' || qualifyType === 'REP') ? 'CX' : 'Recruiter';
    const notesToSave = qualifyNotes ?? noteValues[lead.placeId] ?? lead.qualifierNotes ?? '';

    // Optimistically update local state immediately
    setLeads(prev => prev.map(l =>
      l.placeId === lead.placeId
        ? { ...l, qualifierStatus: 'QualifierQualified', qualifiedUserType: qualifyType, routedTo: routeTo, qualifierNotes: notesToSave }
        : l
    ));
    setNoteValues(prev => ({ ...prev, [lead.placeId]: notesToSave }));
    setQualifyModal(null);

    const res = await qualifyLeadAPI(lead.placeId, qualifyType, notesToSave);

    // Sync newly created user with dashboard user state (if in live or demo mode)
    if (res && res.newUser && setUsers) {
      setUsers(prev => {
        if (prev.some(u => u.id === res.newUser.id)) return prev;
        return [...prev, res.newUser];
      });
    } else if ((!res || res.demo) && setUsers) {
      const nextId = 'WC-' + (1000 + Math.floor(Math.random() * 9000));
      const newUser = {
        id: nextId,
        name: lead.businessName,
        type: qualifyType,
        stage: 1,
        leadsThisWeek: 0,
        dealsThisMonth: 0,
        joined: new Date().toISOString().slice(0, 10),
        market: lead.market || '',
        email: '',
        notes: `Created from Qualifier portal. Phone: ${lead.phone}. Score: ${lead.score}/100. Agent notes: ${lead.agentNotes || 'N/A'}`,
      };
      setUsers(prev => [...prev, newUser]);
    }

    if (routeTo === 'CX') {
      showToast(`${lead.businessName} → ${USER_TYPES[qualifyType]?.label} → New user created in Dashboard!`);
    } else {
      showToast(`${lead.businessName} → ${USER_TYPES[qualifyType]?.label} → New user created & Recruiter notified!`);
    }
  }

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const s = { total: leads.length, new: 0, contacted: 0, qualified: 0, notAFit: 0, followUp: 0, routed: 0, completed: 0 };
    for (const l of leads) {
      if (l.qualifierStatus === 'QualifierContacted')       s.contacted++;
      else if (l.qualifierStatus === 'QualifierQualified')  { s.qualified++; s.completed++; }
      else if (l.qualifierStatus === 'QualifierNotAFit')    { s.notAFit++; s.completed++; }
      else if (l.qualifierStatus === 'QualifierFollowUp')   s.followUp++;
      else s.new++;
      if (l.routedTo) s.routed++;
    }
    return s;
  }, [leads]);

  // ── Filtered + sorted leads ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...leads];
    if (filter === 'new')       list = list.filter(l => !l.qualifierStatus || l.qualifierStatus === 'QualifierNew');
    if (filter === 'contacted') list = list.filter(l => l.qualifierStatus === 'QualifierContacted');
    if (filter === 'qualified') list = list.filter(l => l.qualifierStatus === 'QualifierQualified');
    if (filter === 'notAFit')   list = list.filter(l => l.qualifierStatus === 'QualifierNotAFit');
    if (filter === 'followUp')  list = list.filter(l => l.qualifierStatus === 'QualifierFollowUp');
    if (filter === 'completed') list = list.filter(l => l.qualifierStatus === 'QualifierQualified' || l.qualifierStatus === 'QualifierNotAFit');
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l => l.businessName.toLowerCase().includes(q));
    }
    if (sortBy === 'score') list.sort((a, b) => b.score - a.score);
    else list.sort((a, b) => new Date(b.qualifierNotifiedAt || b.calledAt || 0) - new Date(a.qualifierNotifiedAt || a.calledAt || 0));
    return list;
  }, [leads, filter, search, sortBy]);

  // Qualifier status badge
  function statusBadge(status) {
    const ms = Object.values(QUALIFIER_STATUSES).find(s => s.id === status);
    if (!ms) return { label: 'New', color: '#D49A2B', icon: '🟡' };
    return ms;
  }

  const typeIcon = (type) => BUSINESS_TYPES.find(t => t.id === type)?.icon || '🏢';

  function scoreColor(score) {
    if (score >= 75) return '#2D9B5E';
    if (score >= 50) return '#D49A2B';
    return '#D44A4A';
  }

  // ── Tab definitions ──────────────────────────────────────────────────────────
  const tabs = completedView
    ? [
        { id: 'completed', label: `All Completed (${stats.completed})` },
        { id: 'qualified', label: `Qualified (${stats.qualified})` },
        { id: 'notAFit',   label: `Not a Fit (${stats.notAFit})` },
      ]
    : [
        { id: 'all',       label: `All (${leads.length})` },
        { id: 'new',       label: `New (${stats.new})` },
        { id: 'contacted', label: `Contacted (${stats.contacted})` },
        { id: 'qualified', label: `Qualified (${stats.qualified})` },
        { id: 'followUp',  label: `Follow Up (${stats.followUp})` },
        { id: 'notAFit',   label: `Not a Fit (${stats.notAFit})` },
      ];

  return (
    <div style={embedded ? S.rootEmbedded : S.root}>
      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, background: toast.type === 'success' ? '#2D9B5E' : '#5B8DEF' }}>
          {toast.msg}
        </div>
      )}

      {/* Qualify Modal */}
      {qualifyModal && (
        <div style={S.modalOverlay} onClick={() => setQualifyModal(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Qualify Lead — {qualifyModal.businessName}</div>
            <div style={{ fontSize: 13, color: '#777', marginBottom: 16 }}>
              Score: {qualifyModal.score}/100 · {qualifyModal.phone} · {qualifyModal.market}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>User Type:</div>
            {['REFERRAL', 'REP', 'RESELLER', 'ISO'].map(t => (
              <label key={t} style={{ ...S.radioLabel, border: qualifyType === t ? '2px solid #1F4E79' : '2px solid #EBE6DC' }}>
                <input type="radio" name="userType" value={t} checked={qualifyType === t} onChange={() => setQualifyType(t)} style={{ marginRight: 10 }} />
                <span>{USER_TYPES[t]?.label || t}</span>
                <span style={{ fontSize: 11, color: '#888', marginLeft: 'auto' }}>
                  {(t === 'REFERRAL' || t === 'REP') ? '→ CX Onboarding' : '→ Recruiter closes'}
                </span>
              </label>
            ))}
            <textarea
              placeholder="Qualifier's notes..."
              value={qualifyNotes}
              onChange={e => setQualifyNotes(e.target.value)}
              style={S.modalTextarea}
            />
            <button
              onClick={handleQualifySubmit}
              disabled={!qualifyType}
              style={{ ...S.qualifySubmitBtn, opacity: qualifyType ? 1 : 0.5 }}
            >
              Confirm & Route →
            </button>
          </div>
        </div>
      )}

      {/* Standalone header — only when NOT embedded in sidebar layout */}
      {!embedded && (
        <header style={S.header}>
          <div style={S.headerLeft}>
            <div style={S.mark}>WC</div>
            <div>
              <div style={S.headerTitle}>WAVE CLOSERS</div>
              <div style={S.headerSub}>Qualifier&apos;s Portal</div>
            </div>
          </div>
          <div style={S.headerRight}>
            <span style={S.headerAgent}>CX Team & Lead Qualifier</span>
            <button onClick={onLogout} style={S.logoutBtn}>→ Logout</button>
          </div>
        </header>
      )}

      {/* Page title when embedded */}
      {embedded && (
        <div style={S.pageTitle}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
            {completedView ? '📋 My Completed' : '🔔 My Queue'}
          </h1>
          <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0 0' }}>
            {completedView
              ? 'All fully processed leads — qualified or marked not a fit.'
              : 'Interested leads from agents waiting for your follow-up.'}
          </p>
        </div>
      )}

      {/* Demo banner */}
      {isDemo && (
        <div style={S.demoBanner}>
          ⚠️ Demo mode — showing sample interested leads. Real leads appear when agents mark them as Interested.
        </div>
      )}

      {/* Stats bar */}
      {!completedView && (
        <div style={S.statsBar}>
          <div style={S.statsBarItem}>
            <span style={S.statsNum}>{stats.new}</span>
            <span style={S.statsLabel}>new leads</span>
          </div>
          <div style={S.statsBarItem}>
            <span style={S.statsNum}>{stats.contacted}</span>
            <span style={S.statsLabel}>contacted</span>
          </div>
          <div style={S.statsBarItem}>
            <span style={S.statsNum}>{stats.qualified}</span>
            <span style={S.statsLabel}>qualified</span>
          </div>
          <div style={S.statsBarItem}>
            <span style={S.statsNum}>{stats.routed}</span>
            <span style={S.statsLabel}>routed</span>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div style={S.tabBar}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            style={{
              ...S.tabBtn,
              ...(filter === tab.id ? S.tabBtnActive : {}),
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div style={S.filterBar}>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={S.filterSelect}>
          <option value="received">Newest first</option>
          <option value="score">Highest score</option>
        </select>
        <input
          type="text"
          placeholder="Search business..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={S.searchInput}
        />
      </div>

      {/* Leads list */}
      <div key={'leads-' + filter} style={S.leadsList}>
        {filtered.length === 0 && (
          <div style={S.emptyState}>
            {leads.length === 0
              ? 'No interested leads in your queue yet. They\'ll appear here automatically when agents mark leads as Interested.'
              : 'No leads match this filter.'}
          </div>
        )}
        {filtered.map((lead, idx) => {
          const badge = statusBadge(lead.qualifierStatus);
          const isQualified = lead.qualifierStatus === 'QualifierQualified';
          const isNotAFit = lead.qualifierStatus === 'QualifierNotAFit';
          return (
            <div key={lead._airtableId || lead.placeId || idx} style={{
              ...S.leadCard,
              borderLeft: `4px solid ${badge.color}`,
              opacity: isNotAFit ? 0.6 : 1,
            }}>
              <div style={S.leadHeader}>
                <span style={S.leadName}>{lead.businessName}</span>
                <span style={S.leadType}>{typeIcon(lead.type)} {BUSINESS_TYPES.find(t => t.id === lead.type)?.label || lead.type}</span>
                <span style={{ ...S.qualifierBadge, background: badge.color + '20', color: badge.color }}>{badge.icon} {badge.label}</span>
              </div>
              <div style={S.leadAddress}>{lead.address}</div>
              <a href={`tel:${lead.phone?.replace(/\D/g, '')}`} style={S.leadPhone}>
                📞 {lead.phone}
              </a>
              <div style={S.metaRow}>
                <span style={S.metaItem}>Score: <strong style={{ color: scoreColor(lead.score) }}>{lead.score}</strong></span>
                <span style={S.metaItem}>Called by: <strong>{lead.assignedAgent || '—'}</strong></span>
                <span style={S.metaItem}>Agent notes: {lead.agentNotes || '—'}</span>
              </div>
              {lead.qualifierNotifiedAt && (
                <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>
                  Received: {new Date(lead.qualifierNotifiedAt).toLocaleString()}
                </div>
              )}
              {isQualified && (
                <div style={S.routedBanner}>
                  ✅ Qualified as {USER_TYPES[lead.qualifiedUserType]?.label || lead.qualifiedUserType} — Routed to {lead.routedTo}
                </div>
              )}
              {isNotAFit && (
                <div style={S.notAFitBanner}>
                  ❌ Not a Fit {lead.qualifierNotes ? `— ${lead.qualifierNotes}` : ''}
                </div>
              )}

              {/* Qualifier notes */}
              <input
                type="text"
                placeholder="Add your notes..."
                value={noteValues[lead.placeId] ?? lead.qualifierNotes ?? ''}
                onChange={e => handleNotesInput(lead.placeId, e.target.value)}
                onBlur={e => handleNotesBlur(lead, e.target.value)}
                style={S.notesInput}
              />

              {/* Action buttons — only if not qualified or not a fit */}
              {!isQualified && !isNotAFit && (
                <div style={S.actionRow}>
                  {(!lead.qualifierStatus || lead.qualifierStatus === 'QualifierNew') && (
                    <button onClick={() => handleContacted(lead)} style={{ ...S.actionBtn, background: '#5B8DEF', color: '#fff' }}>📞 Mark Contacted</button>
                  )}
                  <button onClick={() => openQualify(lead)} style={{ ...S.actionBtn, background: '#2D9B5E', color: '#fff' }}>✅ Qualify</button>
                  <button onClick={() => handleNotAFit(lead)} style={{ ...S.actionBtn, background: '#D44A4A', color: '#fff' }}>❌ Not a Fit</button>
                  <button onClick={() => handleFollowUp(lead)} style={{ ...S.actionBtn, background: '#7B6FDB', color: '#fff' }}>📅 Follow Up</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom stats */}
      <div style={S.bottomStats}>
        <div style={S.bottomStatsText}>
          This week: <strong>{stats.total}</strong> leads received · <strong>{stats.contacted}</strong> contacted · <strong>{stats.qualified}</strong> qualified · <strong>{stats.routed}</strong> routed
        </div>
        {stats.total > 0 && (
          <div style={S.bottomStatsText}>
            Conversion rate: <strong>{Math.round((stats.qualified / Math.max(stats.total, 1)) * 100)}%</strong>
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  root: { minHeight: '100vh', background: '#FAF8F4', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", maxWidth: 900, margin: '0 auto', padding: '0 0 80px 0' },
  rootEmbedded: { background: 'transparent', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", maxWidth: 960, padding: '0 0 40px 0' },
  toast: { position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', padding: '12px 24px', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, zIndex: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', maxWidth: '90vw', textAlign: 'center' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#1A1A1A', color: '#fff', flexWrap: 'wrap', gap: 8 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  mark: { width: 36, height: 36, background: '#7B6FDB', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, borderRadius: 6, flexShrink: 0 },
  headerTitle: { fontSize: 13, fontWeight: 700, letterSpacing: '0.1em' },
  headerSub: { fontSize: 10, color: '#B8A0F0', letterSpacing: '0.08em', textTransform: 'uppercase' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  headerAgent: { fontSize: 12, color: '#ccc' },
  logoutBtn: { background: 'transparent', border: '1px solid #555', color: '#ccc', padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  pageTitle: { padding: '24px 0 8px 0' },
  demoBanner: { background: '#FBF1DD', color: '#8A5A1A', padding: '10px 20px', fontSize: 13, textAlign: 'center', borderBottom: '1px solid #EBE6DC', borderRadius: 8, marginBottom: 8 },
  statsBar: { display: 'flex', gap: 0, margin: '0', background: '#fff', borderBottom: '1px solid #EBE6DC', borderRadius: '8px 8px 0 0', overflow: 'hidden' },
  statsBarItem: { flex: 1, textAlign: 'center', padding: '16px 8px', borderRight: '1px solid #EBE6DC' },
  statsNum: { display: 'block', fontSize: 22, fontWeight: 700, color: '#1A1A1A' },
  statsLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' },
  tabBar: { display: 'flex', gap: 0, overflowX: 'auto', background: '#fff', borderBottom: '2px solid #EBE6DC', marginBottom: 4 },
  tabBtn: { flex: 'none', padding: '12px 18px', background: 'transparent', border: 'none', borderBottom: '3px solid transparent', fontSize: 13, fontWeight: 600, color: '#888', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all .15s' },
  tabBtnActive: { color: '#1F4E79', borderBottomColor: '#1F4E79', background: '#F0F5FA' },
  filterBar: { display: 'flex', gap: 10, padding: '12px 0', flexWrap: 'wrap' },
  filterSelect: { padding: '10px 14px', borderRadius: 6, border: '1px solid #DDD', fontSize: 14, background: '#fff', fontFamily: 'inherit', minHeight: 44 },
  searchInput: { flex: 1, padding: '10px 14px', borderRadius: 6, border: '1px solid #DDD', fontSize: 14, fontFamily: 'inherit', minHeight: 44, minWidth: 140 },
  leadsList: { padding: '0' },
  emptyState: { textAlign: 'center', padding: 40, color: '#888', fontSize: 14 },
  leadCard: { background: '#fff', borderRadius: 10, padding: '16px 20px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #EBE6DC' },
  leadHeader: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  leadName: { fontSize: 16, fontWeight: 700, color: '#1A1A1A' },
  leadType: { fontSize: 12, background: '#F0F5FA', color: '#1F4E79', padding: '3px 8px', borderRadius: 4 },
  qualifierBadge: { fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600, marginLeft: 'auto' },
  leadAddress: { fontSize: 13, color: '#777', marginBottom: 4 },
  leadPhone: { display: 'block', fontSize: 16, fontWeight: 600, color: '#1F4E79', textDecoration: 'none', padding: '8px 0', marginBottom: 4 },
  metaRow: { display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8, fontSize: 13, color: '#555' },
  metaItem: {},
  routedBanner: { background: '#E8F4EA', color: '#1F6E3C', padding: '10px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, marginBottom: 10 },
  notAFitBanner: { background: '#FDECEA', color: '#9A2C2C', padding: '10px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, marginBottom: 10 },
  notesInput: { width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #DDD', fontSize: 14, fontFamily: 'inherit', marginBottom: 10, minHeight: 44, boxSizing: 'border-box' },
  actionRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  actionBtn: { flex: 1, minHeight: 44, minWidth: 44, borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s', padding: '8px 4px' },
  bottomStats: { padding: '24px 0', textAlign: 'center', borderTop: '1px solid #EBE6DC', marginTop: 20 },
  bottomStatsText: { fontSize: 14, color: '#555', marginBottom: 4 },
  // Modal
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#fff', borderRadius: 12, padding: '28px 28px 24px', maxWidth: 480, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
  modalTitle: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  radioLabel: { display: 'flex', alignItems: 'center', padding: '12px 14px', borderRadius: 8, marginBottom: 8, cursor: 'pointer', fontSize: 14, transition: 'border 0.15s' },
  modalTextarea: { width: '100%', padding: '12px', borderRadius: 6, border: '1px solid #DDD', fontSize: 14, fontFamily: 'inherit', minHeight: 80, marginTop: 12, marginBottom: 16, boxSizing: 'border-box', resize: 'vertical' },
  qualifySubmitBtn: { width: '100%', padding: '14px', borderRadius: 8, background: '#1F4E79', color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
};
