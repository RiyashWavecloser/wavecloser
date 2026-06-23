import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SEED_LEADS } from '../data/seed.js';
import { BUSINESS_TYPES } from '../data/constants.js';
import {
  fetchMyLeadsAPI,
  updateLeadAPI,
  loadLeadsFromStorage,
  saveLeadsToStorage,
} from '../lib/dataLayer.js';

// Helper to get the Monday of the current week (same logic as backend)
const getMondayOfCurrentWeek = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

/**
 * AgentPortal — Mobile-first standalone view for cold-calling agents.
 * No sidebar, no other modules. Agent sees ONLY their assigned leads.
 * Polls /api/leads/my-leads every 15 seconds for new assignments.
 */
export default function AgentPortal({ currentUser, onLogout }) {
  const agentName = currentUser?.name || 'Agent';
  const [leads, setLeads] = useState([]);
  const [filter, setFilter] = useState('uncalled');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [isDemo, setIsDemo] = useState(true);
  const [viewMode, setViewMode] = useState('recommended'); // 'recommended' or 'weekly'

  const WEEKLY_TARGET = 500;
  const DAILY_TARGET = 100;

  // Load leads on mount and poll every 15 seconds
  const loadMyLeads = useCallback(async () => {
    const live = await fetchMyLeadsAPI();
    if (live && live.length) {
      // Check for new leads
      if (leads.length > 0 && live.length > leads.length) {
        showToast(`${live.length - leads.length} new leads assigned to you!`, 'info');
      }
      setLeads(live);
      setIsDemo(false);
      saveLeadsToStorage(live);
    } else if (leads.length === 0) {
      // Demo mode: show agent's seed leads
      const stored = loadLeadsFromStorage();
      const all = stored || SEED_LEADS;
      setLeads(all.filter(l => l.assignedAgent === agentName));
    }
  }, [agentName, leads.length]);

  useEffect(() => {
    loadMyLeads();
    const interval = setInterval(loadMyLeads, 15000);
    return () => clearInterval(interval);
  }, []);// eslint-disable-line react-hooks/exhaustive-deps

  // Toast helper
  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  // Stats
  const stats = useMemo(() => {
    const s = { total: leads.length, called: 0, interested: 0, notInterested: 0, callback: 0, noAnswer: 0, uncalled: 0 };
    for (const l of leads) {
      if (l.outcome === 'Interested')    s.interested++;
      else if (l.outcome === 'NotInterested') s.notInterested++;
      else if (l.outcome === 'Callback')      s.callback++;
      else if (l.outcome === 'NoAnswer')      s.noAnswer++;
      if (['Interested','NotInterested','Callback','NoAnswer'].includes(l.outcome)) s.called++;
      else s.uncalled++;
    }
    return s;
  }, [leads]);

  // Current week's leads (assigned or called this week)
  const weeklyLeads = useMemo(() => {
    const monday = getMondayOfCurrentWeek();
    return leads.filter(l => {
      const date = l.calledAt ? new Date(l.calledAt) : new Date(l.createdAt || Date.now());
      return date >= monday;
    });
  }, [leads]);

  const weeklyCalledCount = useMemo(() => {
    return weeklyLeads.filter(l => ['Interested', 'NotInterested', 'Callback', 'NoAnswer'].includes(l.outcome)).length;
  }, [weeklyLeads]);

  const weeklyUncalledCount = useMemo(() => {
    return weeklyLeads.filter(l => !l.outcome).length;
  }, [weeklyLeads]);

  // Daily target called count
  const todayStr = new Date().toISOString().slice(0, 10);
  const calledToday = useMemo(() => {
    return leads.filter(l => l.calledAt && l.calledAt.startsWith(todayStr)).length;
  }, [leads, todayStr]);

  // Weekly progress percentage
  const weeklyProgress = Math.round((weeklyCalledCount / WEEKLY_TARGET) * 100);

  // Filtered leads for the "weekly" tab view
  const filtered = useMemo(() => {
    let list = leads;
    if (filter === 'uncalled')    list = list.filter(l => !l.outcome);
    if (filter === 'callbacks')   list = list.filter(l => l.outcome === 'Callback');
    if (filter === 'interested')  list = list.filter(l => l.outcome === 'Interested');
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l => l.businessName.toLowerCase().includes(q));
    }
    return list;
  }, [leads, filter, search]);

  // Lists for the "Today's Recommended" view
  const callbacksList = useMemo(() => {
    let list = leads.filter(l => l.outcome === 'Callback');
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l => l.businessName.toLowerCase().includes(q));
    }
    return list;
  }, [leads, search]);

  const recommendedFocusList = useMemo(() => {
    let list = leads.filter(l => !l.outcome);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l => l.businessName.toLowerCase().includes(q));
    }
    return list.slice(0, 100);
  }, [leads, search]);

  // Mark lead outcome
  async function handleOutcome(lead, outcome) {
    const now = new Date().toISOString();
    setLeads(prev => prev.map(l =>
      l.placeId === lead.placeId
        ? { ...l, outcome, status: outcome === 'Interested' ? 'SentToQualifier' : outcome, calledAt: now }
        : l
    ));

    await updateLeadAPI(lead.placeId, {
      status: outcome === 'Interested' ? 'Interested' : outcome,
      outcome,
      calledAt: now,
      agentNotes: lead.agentNotes || '',
    });

    if (outcome === 'Interested') {
      showToast(`${lead.businessName} marked Interested — Qualifier notified`, 'success');
    } else {
      showToast(`${lead.businessName} → ${outcome}`, 'info');
    }

    // Save to localStorage for demo persistence
    setLeads(prev => {
      saveLeadsToStorage(prev);
      return prev;
    });
  }

  // Update agent notes
  async function handleNotesBlur(lead, notes) {
    setLeads(prev => prev.map(l =>
      l.placeId === lead.placeId ? { ...l, agentNotes: notes } : l
    ));
    await updateLeadAPI(lead.placeId, { agentNotes: notes });
    setLeads(prev => { saveLeadsToStorage(prev); return prev; });
  }

  // Score bar color
  function scoreColor(score) {
    if (score >= 75) return '#2D9B5E';
    if (score >= 50) return '#D49A2B';
    return '#D44A4A';
  }

  const typeIcon = (type) => BUSINESS_TYPES.find(t => t.id === type)?.icon || '🏢';

  const renderLeadCard = (lead, index) => {
    return (
      <div key={lead.placeId} style={{
        ...S.leadCard,
        borderLeft: `4px solid ${lead.outcome === 'Interested' ? '#2D9B5E' : lead.outcome === 'NotInterested' ? '#D44A4A' : lead.outcome === 'Callback' ? '#D49A2B' : lead.outcome === 'NoAnswer' ? '#999' : '#5B8DEF'}`,
      }}>
        <div style={S.leadHeader}>
          <span style={S.leadRank}>#{index + 1}</span>
          <span style={S.leadName}>{lead.businessName}</span>
          <span style={S.leadType}>{typeIcon(lead.type)} {BUSINESS_TYPES.find(t => t.id === lead.type)?.label || lead.type}</span>
        </div>
        <div style={S.leadAddress}>{lead.address}</div>
        <a href={`tel:${lead.phone?.replace(/\D/g, '')}`} style={S.leadPhone}>
          📞 {lead.phone}
        </a>
        <div style={S.scoreRow}>
          <span style={{ fontSize: 12, color: '#888' }}>Score:</span>
          <div style={S.scoreBarOuter}>
            <div style={{ ...S.scoreBarInner, width: `${lead.score}%`, background: scoreColor(lead.score) }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(lead.score) }}>{lead.score}</span>
        </div>
        {lead.scoreReason && <div style={S.scoreReason}>{lead.scoreReason}</div>}

        {/* Notes */}
        <input
          type="text"
          placeholder="Add call notes..."
          defaultValue={lead.agentNotes || ''}
          onBlur={e => handleNotesBlur(lead, e.target.value)}
          style={S.notesInput}
        />

        {/* Action buttons */}
        {!lead.outcome ? (
          <div style={S.actionRow}>
            <button onClick={() => handleOutcome(lead, 'Interested')} style={{ ...S.actionBtn, background: '#2D9B5E', color: '#fff' }}>✅ Interested</button>
            <button onClick={() => handleOutcome(lead, 'NotInterested')} style={{ ...S.actionBtn, background: '#D44A4A', color: '#fff' }}>❌ No</button>
            <button onClick={() => handleOutcome(lead, 'Callback')} style={{ ...S.actionBtn, background: '#D49A2B', color: '#fff' }}>📞 CB</button>
            <button onClick={() => handleOutcome(lead, 'NoAnswer')} style={{ ...S.actionBtn, background: '#888', color: '#fff' }}>🔇</button>
          </div>
        ) : (
          <div style={{ ...S.outcomeBadge, background: lead.outcome === 'Interested' ? '#E8F4EA' : lead.outcome === 'NotInterested' ? '#FBE5E5' : lead.outcome === 'Callback' ? '#FBF1DD' : '#F0F0F0', color: lead.outcome === 'Interested' ? '#1F6E3C' : lead.outcome === 'NotInterested' ? '#9B2727' : lead.outcome === 'Callback' ? '#8A5A1A' : '#666' }}>
            {lead.outcome === 'Interested' ? '✅ Interested — Qualifier notified' : lead.outcome === 'NotInterested' ? '❌ Not Interested' : lead.outcome === 'Callback' ? '📞 Callback scheduled' : '🔇 No Answer'}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={S.root}>
      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, background: toast.type === 'success' ? '#2D9B5E' : '#5B8DEF' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.mark}>WC</div>
          <div>
            <div style={S.headerTitle}>WAVE CLOSERS</div>
            <div style={S.headerSub}>Agent Portal</div>
          </div>
        </div>
        <div style={S.headerRight}>
          <span style={S.headerAgent}>{agentName}</span>
          <button onClick={onLogout} style={S.logoutBtn}>→ Logout</button>
        </div>
      </header>

      {/* Demo banner */}
      {isDemo && (
        <div style={S.demoBanner}>
          ⚠️ Demo mode — showing sample data. Real leads appear when Riyash assigns them to you.
        </div>
      )}

      {/* Progress */}
      <div style={S.progressCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={S.progressLabel}>Weekly Progress</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: weeklyCalledCount >= WEEKLY_TARGET ? '#E8F4EA' : '#FFF3E0', padding: '6px 14px', borderRadius: 20, border: weeklyCalledCount >= WEEKLY_TARGET ? '1px solid #81C784' : '1px solid #FFB74D' }}>
            <span style={{ fontSize: 18 }}>{weeklyCalledCount >= WEEKLY_TARGET ? '🎉' : '📞'}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: weeklyCalledCount >= WEEKLY_TARGET ? '#2E7D32' : '#E65100' }}>
              {weeklyCalledCount >= WEEKLY_TARGET ? 'Weekly Goal Met!' : `${WEEKLY_TARGET - weeklyCalledCount} calls left`}
            </span>
          </div>
        </div>
        <div style={S.progressBarOuter}>
          <div style={{ ...S.progressBarInner, width: `${Math.min(weeklyProgress, 100)}%` }} />
        </div>
        <div style={S.progressText}>{weeklyCalledCount} called this week · {weeklyUncalledCount} uncalled · {WEEKLY_TARGET} weekly target</div>
        
        {/* Daily Recommended Target Guideline */}
        <div style={{ marginTop: 14, borderTop: '1px solid #EEE', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#666', fontWeight: 600 }}>Daily Goal (Recommended)</span>
          <span style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 700 }}>{calledToday} / {DAILY_TARGET} called today</span>
        </div>
        <div style={{ ...S.progressBarOuter, height: 6, marginTop: 6 }}>
          <div style={{ ...S.progressBarInner, height: '100%', width: `${Math.min((calledToday / DAILY_TARGET) * 100, 100)}%`, background: '#5B8DEF' }} />
        </div>

        <div style={S.statsRow}>
          <span style={{ ...S.statPill, background: '#E8F4EA', color: '#1F6E3C' }}>✅ {stats.interested}</span>
          <span style={{ ...S.statPill, background: '#FBE5E5', color: '#9B2727' }}>❌ {stats.notInterested}</span>
          <span style={{ ...S.statPill, background: '#FBF1DD', color: '#8A5A1A' }}>📞 {stats.callback}</span>
          <span style={{ ...S.statPill, background: '#F0F0F0', color: '#666' }}>🔇 {stats.noAnswer}</span>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div style={S.toggleContainer}>
        <button 
          onClick={() => setViewMode('recommended')} 
          style={{ ...S.toggleBtn, ...(viewMode === 'recommended' ? S.toggleBtnActive : {}) }}
        >
          📋 Today&apos;s Recommended
        </button>
        <button 
          onClick={() => setViewMode('weekly')} 
          style={{ ...S.toggleBtn, ...(viewMode === 'weekly' ? S.toggleBtnActive : {}) }}
        >
          📅 Full Weekly Batch
        </button>
      </div>

      {/* Search Bar / Filter Bar for Weekly View */}
      {viewMode === 'weekly' && (
        <div style={S.filterBar}>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={S.filterSelect}>
            <option value="all">All ({leads.length})</option>
            <option value="uncalled">Uncalled ({stats.uncalled})</option>
            <option value="callbacks">Callbacks ({stats.callback})</option>
            <option value="interested">Interested ({stats.interested})</option>
          </select>
          <input
            type="text"
            placeholder="Search business..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={S.searchInput}
          />
        </div>
      )}

      {/* Search Bar only for Recommended View */}
      {viewMode === 'recommended' && (
        <div style={{ ...S.filterBar, marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Search in recommended focus..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={S.searchInput}
          />
        </div>
      )}

      {/* Leads list */}
      <div style={S.leadsList}>
        {viewMode === 'recommended' ? (
          <div>
            {/* Callbacks Section */}
            {callbacksList.length > 0 && (
              <div>
                <div style={S.sectionHeader}>📞 Callbacks from Earlier Days ({callbacksList.length})</div>
                {callbacksList.map((lead, i) => renderLeadCard(lead, i))}
              </div>
            )}

            {/* Today's Focus Section */}
            <div>
              <div style={S.sectionHeader}>🎯 Today&apos;s Recommended Focus ({recommendedFocusList.length} uncalled)</div>
              {recommendedFocusList.length === 0 ? (
                <div style={S.emptyState}>
                  No uncalled leads in your recommended batch. Toggle to &quot;Full Weekly Batch&quot; or check for new assignments!
                </div>
              ) : (
                recommendedFocusList.map((lead, i) => renderLeadCard(lead, i))
              )}
            </div>
          </div>
        ) : (
          /* Weekly Batch List View */
          <div>
            {filtered.length === 0 ? (
              <div style={S.emptyState}>
                {leads.length === 0
                  ? 'No leads assigned yet. Riyash will assign leads to you soon.'
                  : 'No leads match this filter.'}
              </div>
            ) : (
              filtered.map((lead, i) => renderLeadCard(lead, i))
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={S.footer}>
        {stats.uncalled === 0 && stats.total > 0
          ? <div style={S.footerText}>All caught up for the week? Great work! 🎉</div>
          : <div style={S.footerText}>Need more leads? Contact Riyash</div>}
      </div>
    </div>
  );
}

const S = {
  root: { minHeight: '100vh', background: '#FAF8F4', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", maxWidth: 800, margin: '0 auto', padding: '0 0 80px 0' },
  toast: { position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', padding: '12px 24px', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', maxWidth: '90vw', textAlign: 'center' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#1A1A1A', color: '#fff' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  mark: { width: 36, height: 36, background: '#1F4E79', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, borderRadius: 6, flexShrink: 0 },
  headerTitle: { fontSize: 13, fontWeight: 700, letterSpacing: '0.1em' },
  headerSub: { fontSize: 10, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  headerAgent: { fontSize: 13, fontWeight: 600 },
  logoutBtn: { background: 'transparent', border: '1px solid #555', color: '#ccc', padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  demoBanner: { background: '#FBF1DD', color: '#8A5A1A', padding: '10px 20px', fontSize: 13, textAlign: 'center', borderBottom: '1px solid #EBE6DC' },
  progressCard: { margin: '16px 20px', background: '#fff', borderRadius: 10, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #EBE6DC' },
  progressLabel: { fontSize: 14, fontWeight: 700, color: '#1A1A1A', marginBottom: 10 },
  progressBarOuter: { width: '100%', height: 10, background: '#EBE6DC', borderRadius: 5, overflow: 'hidden' },
  progressBarInner: { height: '100%', background: 'linear-gradient(90deg, #2D9B5E, #5B8DEF)', borderRadius: 5, transition: 'width 0.4s ease' },
  progressText: { fontSize: 13, color: '#555', marginTop: 8 },
  statsRow: { display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  statPill: { padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600 },
  
  toggleContainer: { display: 'flex', gap: 10, padding: '0 20px', marginBottom: 16 },
  toggleBtn: { flex: 1, padding: '12px', borderRadius: 8, border: '1px solid #DDD', background: '#fff', color: '#555', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' },
  toggleBtnActive: { background: '#1F4E79', color: '#fff', borderColor: '#1F4E79', boxShadow: '0 2px 8px rgba(31, 78, 121, 0.2)' },
  sectionHeader: { fontSize: 13, fontWeight: 800, color: '#1F4E79', margin: '24px 0 12px 0', letterSpacing: '0.03em', textTransform: 'uppercase', borderBottom: '2px solid #EBE6DC', paddingBottom: 6 },

  filterBar: { display: 'flex', gap: 10, padding: '0 20px', marginBottom: 12 },
  filterSelect: { padding: '10px 14px', borderRadius: 6, border: '1px solid #DDD', fontSize: 14, background: '#fff', fontFamily: 'inherit', minHeight: 44 },
  searchInput: { flex: 1, padding: '10px 14px', borderRadius: 6, border: '1px solid #DDD', fontSize: 14, fontFamily: 'inherit', minHeight: 44 },
  leadsList: { padding: '0 20px' },
  emptyState: { textAlign: 'center', padding: 40, color: '#888', fontSize: 14 },
  leadCard: { background: '#fff', borderRadius: 10, padding: '16px 20px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #EBE6DC' },
  leadHeader: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  leadRank: { fontSize: 12, fontWeight: 700, color: '#888', minWidth: 28 },
  leadName: { fontSize: 16, fontWeight: 700, color: '#1A1A1A' },
  leadType: { fontSize: 12, background: '#F0F5FA', color: '#1F4E79', padding: '3px 8px', borderRadius: 4, marginLeft: 'auto' },
  leadAddress: { fontSize: 13, color: '#777', marginBottom: 6 },
  leadPhone: { display: 'block', fontSize: 16, fontWeight: 600, color: '#1F4E79', textDecoration: 'none', padding: '8px 0', marginBottom: 4 },
  scoreRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  scoreBarOuter: { flex: 1, height: 6, background: '#EBE6DC', borderRadius: 3, overflow: 'hidden' },
  scoreBarInner: { height: '100%', borderRadius: 3, transition: 'width 0.3s ease' },
  scoreReason: { fontSize: 12, color: '#888', fontStyle: 'italic', marginBottom: 8 },
  notesInput: { width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #DDD', fontSize: 14, fontFamily: 'inherit', marginBottom: 10, minHeight: 44, boxSizing: 'border-box' },
  actionRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  actionBtn: { flex: 1, minHeight: 44, minWidth: 44, borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s', padding: '8px 4px' },
  outcomeBadge: { padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, textAlign: 'center' },
  footer: { padding: '24px 20px', textAlign: 'center' },
  footerText: { fontSize: 14, color: '#888' },
};
