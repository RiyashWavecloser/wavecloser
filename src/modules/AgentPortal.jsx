import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BUSINESS_TYPES, AGENTS } from '../data/constants.js';
import {
  fetchMyLeadsAPI,
  fetchAllAgentLeadsAPI,
  generateMyOwnLeads,
  updateLeadAPI,
  loadLeadsFromStorage,
  saveLeadsToStorage,
} from '../lib/dataLayer.js';

const IS_SUPERVISOR_ROLE = 'agent_supervisor';

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
 * Tabs: My Assigned Leads | Generate My Own Leads | My History
 * Supervisor role gets an additional agent-selector dropdown.
 */
export default function AgentPortal({ currentUser, onLogout }) {
  const agentName    = currentUser?.name || 'Agent';
  const isSupervisor = currentUser?.role === IS_SUPERVISOR_ROLE;

  // Role-aware portal label
  const portalLabel = {
    cold_caller:         'Cold Caller Portal',
    independent_rep:     'Independent Rep Portal',
    authorized_reseller: 'Authorized Reseller Portal',
    iso_investor:        'ISO Investor Portal',
    referral_partner:    'Referral Partner Portal',
    agent_supervisor:    'Supervisor View',
  }[currentUser?.role] || 'Agent Portal';

  // Priority badge — only for Authorized Resellers
  const showPriorityBadge = currentUser?.role === 'authorized_reseller';

  // ─── State ─────────────────────────────────────────────────────────────────
  const [leads, setLeads] = useState([]);
  const [filter, setFilter] = useState('uncalled');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [isDemo, setIsDemo] = useState(true);
  // 'assigned' | 'generate' | 'history'
  const [activeTab, setActiveTab] = useState('assigned');

  // Supervisor state
  const [supervisorAgent, setSupervisorAgent] = useState('all');

  // Self-service lead generation state
  const [genLocation, setGenLocation] = useState('');
  const [genTypes, setGenTypes] = useState([]);
  const [genRadius, setGenRadius] = useState(5);
  const [maxLeads, setMaxLeads] = useState(50);
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState(null);

  const WEEKLY_TARGET = 500;
  const DAILY_TARGET  = 100;

  // ─── Load leads ─────────────────────────────────────────────────────────────
  const loadMyLeads = useCallback(async () => {
    if (isSupervisor) {
      const agentFilter = supervisorAgent === 'all' ? null : supervisorAgent;
      const live = await fetchAllAgentLeadsAPI(agentFilter);
      if (live && live.length) {
        setLeads(live);
        setIsDemo(false);
      } else if (leads.length === 0) {
        setLeads([]);
      }
      return;
    }
    const live = await fetchMyLeadsAPI();
    if (live && live.length) {
      if (leads.length > 0 && live.length > leads.length) {
        showToast(`${live.length - leads.length} new lead(s) assigned to you!`, 'info');
      }
      setLeads(live);
      setIsDemo(false);
      saveLeadsToStorage(live);
    } else if (leads.length === 0) {
      const stored = loadLeadsFromStorage();
      const all = stored || [];
      setLeads(all.filter(l => l.assignedAgent === agentName));
    }
  }, [agentName, leads.length, isSupervisor, supervisorAgent]);

  useEffect(() => {
    loadMyLeads();
    const interval = setInterval(loadMyLeads, 15000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload when supervisor changes agent filter
  useEffect(() => {
    if (isSupervisor) loadMyLeads();
  }, [supervisorAgent]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Toast ──────────────────────────────────────────────────────────────────
  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  }

  // ─── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const s = { total: leads.length, called: 0, interested: 0, notInterested: 0, callback: 0, noAnswer: 0, uncalled: 0 };
    for (const l of leads) {
      if      (l.outcome === 'Interested')    s.interested++;
      else if (l.outcome === 'NotInterested') s.notInterested++;
      else if (l.outcome === 'Callback')      s.callback++;
      else if (l.outcome === 'NoAnswer')      s.noAnswer++;
      if (['Interested','NotInterested','Callback','NoAnswer'].includes(l.outcome)) s.called++;
      else s.uncalled++;
    }
    return s;
  }, [leads]);

  const weeklyLeads = useMemo(() => {
    const monday = getMondayOfCurrentWeek();
    return leads.filter(l => {
      const date = l.calledAt ? new Date(l.calledAt) : new Date(l.createdAt || Date.now());
      return date >= monday;
    });
  }, [leads]);

  const weeklyCalledCount  = useMemo(() => weeklyLeads.filter(l => ['Interested','NotInterested','Callback','NoAnswer'].includes(l.outcome)).length, [weeklyLeads]);
  const weeklyUncalledCount = useMemo(() => weeklyLeads.filter(l => !l.outcome).length, [weeklyLeads]);
  const todayStr            = new Date().toISOString().slice(0, 10);
  const calledToday         = useMemo(() => leads.filter(l => l.calledAt && l.calledAt.startsWith(todayStr)).length, [leads, todayStr]);
  const weeklyProgress      = Math.round((weeklyCalledCount / WEEKLY_TARGET) * 100);

  const filtered = useMemo(() => {
    let list = leads;
    if (filter === 'uncalled')   list = list.filter(l => !l.outcome);
    if (filter === 'callbacks')  list = list.filter(l => l.outcome === 'Callback');
    if (filter === 'interested') list = list.filter(l => l.outcome === 'Interested');
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l => l.businessName.toLowerCase().includes(q));
    }
    return list;
  }, [leads, filter, search]);

  const callbacksList = useMemo(() => {
    let list = leads.filter(l => l.outcome === 'Callback');
    if (search) list = list.filter(l => l.businessName.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [leads, search]);

  const recommendedFocusList = useMemo(() => {
    let list = leads.filter(l => !l.outcome);
    if (search) list = list.filter(l => l.businessName.toLowerCase().includes(search.toLowerCase()));
    return list.slice(0, 100);
  }, [leads, search]);

  const historyList = useMemo(() => leads.filter(l => l.outcome), [leads]);

  // ─── Lead actions ───────────────────────────────────────────────────────────
  async function handleOutcome(lead, outcome) {
    const now = new Date().toISOString();
    setLeads(prev => prev.map(l =>
      l.placeId === lead.placeId
        ? { ...l, outcome, status: outcome === 'Interested' ? 'SentToQualifier' : outcome, calledAt: now }
        : l
    ));
    await updateLeadAPI(lead.placeId, {
      status: outcome === 'Interested' ? 'Interested' : outcome,
      outcome, calledAt: now,
      agentNotes: lead.agentNotes || '',
    });
    if (outcome === 'Interested') showToast(`${lead.businessName} → Interested! Qualifier notified.`, 'success');
    else showToast(`${lead.businessName} → ${outcome}`, 'info');
    setLeads(prev => { saveLeadsToStorage(prev); return prev; });
  }

  async function handleNotesBlur(lead, notes) {
    setLeads(prev => prev.map(l => l.placeId === lead.placeId ? { ...l, agentNotes: notes } : l));
    await updateLeadAPI(lead.placeId, { agentNotes: notes });
    setLeads(prev => { saveLeadsToStorage(prev); return prev; });
  }

  // ─── Self-service lead generation ────────────────────────────────────────────
  async function handleGenerateSelf(e) {
    e.preventDefault();
    if (!genLocation.trim()) { showToast('Enter a city, state (e.g. Miami, FL)', 'error'); return; }
    if (!genTypes.length)    { showToast('Select at least one business type', 'error'); return; }
    setGenLoading(true);
    setGenResult(null);
    try {
      const result = await generateMyOwnLeads(genLocation.trim(), genTypes, genRadius, maxLeads);
      setGenResult(result);
      if (result.leads && result.leads.length > 0) {
        showToast(`${result.leads.length} new leads generated and assigned to you!`, 'success');
        // Reload leads list to include new ones
        setTimeout(() => loadMyLeads(), 1000);
        setActiveTab('assigned');
      } else if (result.demo) {
        showToast('Backend offline — demo mode. No leads saved.', 'error');
      } else {
        showToast(`All businesses in ${genLocation} were already in the system. Try another city!`, 'info');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setGenLoading(false);
    }
  }

  function toggleGenType(typeId) {
    setGenTypes(prev => prev.includes(typeId) ? prev.filter(t => t !== typeId) : [...prev, typeId]);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────
  function scoreColor(s) { return s >= 75 ? '#2D9B5E' : s >= 50 ? '#D49A2B' : '#D44A4A'; }
  const typeIcon = (type) => BUSINESS_TYPES.find(t => t.id === type)?.icon || '🏢';

  // ─── Lead Card ──────────────────────────────────────────────────────────────
  const renderLeadCard = (lead, index) => {
    const borderColor = lead.outcome === 'Interested' ? '#2D9B5E' : lead.outcome === 'NotInterested' ? '#D44A4A' : lead.outcome === 'Callback' ? '#D49A2B' : lead.outcome === 'NoAnswer' ? '#999' : '#5B8DEF';
    return (
      <div key={lead.placeId} style={{ ...S.leadCard, borderLeft: `4px solid ${borderColor}` }}>
        <div style={S.leadHeader}>
          <span style={S.leadRank}>#{index + 1}</span>
          <span style={S.leadName}>{lead.businessName}</span>
          <span style={S.leadType}>{typeIcon(lead.type)} {BUSINESS_TYPES.find(t => t.id === lead.type)?.label || lead.type}</span>
        </div>
        {isSupervisor && lead.assignedAgent && (
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>👤 Agent: <strong>{lead.assignedAgent}</strong></div>
        )}
        <div style={S.leadAddress}>{lead.address}</div>
        <a href={`tel:${lead.phone?.replace(/\D/g, '')}`} style={S.leadPhone}>📞 {lead.phone}</a>
        <div style={S.scoreRow}>
          <span style={{ fontSize: 12, color: '#888' }}>Score:</span>
          <div style={S.scoreBarOuter}>
            <div style={{ ...S.scoreBarInner, width: `${lead.score}%`, background: scoreColor(lead.score) }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(lead.score) }}>{lead.score}</span>
        </div>
        {lead.scoreReason && <div style={S.scoreReason}>{lead.scoreReason}</div>}

        {!isSupervisor && (
          <>
            <input
              type="text" placeholder="Add call notes..."
              defaultValue={lead.agentNotes || ''}
              onBlur={e => handleNotesBlur(lead, e.target.value)}
              style={S.notesInput}
            />
            {!lead.outcome ? (
              <div style={S.actionRow}>
                <button onClick={() => handleOutcome(lead, 'Interested')}  style={{ ...S.actionBtn, background: '#2D9B5E', color: '#fff' }}>✅ Interested</button>
                <button onClick={() => handleOutcome(lead, 'NotInterested')} style={{ ...S.actionBtn, background: '#D44A4A', color: '#fff' }}>❌ No</button>
                <button onClick={() => handleOutcome(lead, 'Callback')}    style={{ ...S.actionBtn, background: '#D49A2B', color: '#fff' }}>📞 CB</button>
                <button onClick={() => handleOutcome(lead, 'NoAnswer')}    style={{ ...S.actionBtn, background: '#888', color: '#fff' }}>🔇</button>
              </div>
            ) : (
              <div style={{ ...S.outcomeBadge, background: lead.outcome === 'Interested' ? '#E8F4EA' : lead.outcome === 'NotInterested' ? '#FBE5E5' : lead.outcome === 'Callback' ? '#FBF1DD' : '#F0F0F0', color: lead.outcome === 'Interested' ? '#1F6E3C' : lead.outcome === 'NotInterested' ? '#9B2727' : lead.outcome === 'Callback' ? '#8A5A1A' : '#666' }}>
                {lead.outcome === 'Interested' ? '✅ Interested — Qualifier notified' : lead.outcome === 'NotInterested' ? '❌ Not Interested' : lead.outcome === 'Callback' ? '📞 Callback scheduled' : '🔇 No Answer'}
              </div>
            )}
          </>
        )}
        {isSupervisor && lead.outcome && (
          <div style={{ ...S.outcomeBadge, background: lead.outcome === 'Interested' ? '#E8F4EA' : lead.outcome === 'NotInterested' ? '#FBE5E5' : lead.outcome === 'Callback' ? '#FBF1DD' : '#F0F0F0', color: lead.outcome === 'Interested' ? '#1F6E3C' : lead.outcome === 'NotInterested' ? '#9B2727' : lead.outcome === 'Callback' ? '#8A5A1A' : '#666' }}>
            {lead.outcome === 'Interested' ? '✅ Interested' : lead.outcome === 'NotInterested' ? '❌ Not Interested' : lead.outcome === 'Callback' ? '📞 Callback' : '🔇 No Answer'}
          </div>
        )}
      </div>
    );
  };

  // ─── Self-service Generate Tab ────────────────────────────────────────────
  const renderGenerateTab = () => (
    <div style={{ padding: '0 20px' }}>
      <div style={S.genCard}>
        <div style={S.genTitle}>🚀 Generate My Own Leads</div>
        <div style={S.genSubtitle}>Enter a city and select business types. Leads are globally deduplicated — you&apos;ll only see businesses that have never been called by anyone on the team.</div>
        <form onSubmit={handleGenerateSelf}>
          <label style={S.genLabel}>City / Market</label>
          <input
            type="text" placeholder="e.g. Miami, FL or Houston, TX"
            value={genLocation} onChange={e => setGenLocation(e.target.value)}
            style={S.genInput} required
          />
          <label style={S.genLabel}>Search Radius (miles)</label>
          <select value={genRadius} onChange={e => setGenRadius(Number(e.target.value))} style={S.genInput}>
            {[2, 3, 5, 10, 15, 20].map(r => <option key={r} value={r}>{r} miles</option>)}
          </select>
          <div style={S.maxLeadsRow}>
            <label style={S.genLabel}>How many leads do you want?</label>
            <div style={S.quickPicks}>
              {[25, 50, 100].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMaxLeads(n)}
                  style={{
                    ...S.pickBtn,
                    background: maxLeads === n ? '#1F4E79' : '#fff',
                    color: maxLeads === n ? '#fff' : '#555',
                    borderColor: maxLeads === n ? '#1F4E79' : '#DDD',
                  }}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min="1"
                max="500"
                placeholder="Custom"
                value={maxLeads}
                onChange={e => setMaxLeads(Math.min(500, Math.max(1, parseInt(e.target.value) || 1)))}
                style={S.customInput}
              />
            </div>
            <div style={S.hint}>Max 500 leads per request</div>
          </div>
          <label style={S.genLabel}>Business Types</label>
          <div style={S.genTypesGrid}>
            {BUSINESS_TYPES.filter(t => !t.disabled).map(type => (
              <button
                key={type.id} type="button"
                onClick={() => toggleGenType(type.id)}
                style={{ ...S.genTypeBtn, ...(genTypes.includes(type.id) ? S.genTypeBtnActive : {}) }}
              >
                {type.icon} {type.label}
              </button>
            ))}
          </div>
          <button
            type="submit" disabled={genLoading}
            style={{ ...S.genSubmitBtn, opacity: genLoading ? 0.7 : 1 }}
          >
            {genLoading ? '⏳ Generating leads...' : '🔍 Generate Leads for Me'}
          </button>
        </form>
        {genResult && !genLoading && (
          <div style={S.genResultBox}>
            {genResult.demo ? (
              <div style={{ color: '#D49A2B' }}>⚠️ Demo mode — no real leads generated. Backend offline.</div>
            ) : genResult.leads?.length > 0 ? (
              <>
                <div style={{ color: '#2D9B5E', fontWeight: 700, marginBottom: 8 }}>✅ {genResult.leads.length} fresh leads assigned to you!</div>
                {genResult.stats && (
                  <div style={{ fontSize: 13, color: '#666' }}>
                    {genResult.stats.google || 0} Google + {genResult.stats.yelp || 0} Yelp found
                    {genResult.stats.duplicatesFiltered > 0 && ` · ${genResult.stats.duplicatesFiltered} duplicates filtered`}
                    {genResult.stats.saved > 0 && ` · ${genResult.stats.saved} saved to Airtable`}
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: '#888' }}>No new businesses found in {genLocation}. All results were already in the system. Try a different city or business type.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={S.root}>
      {toast && (
        <div style={{ ...S.toast, background: toast.type === 'success' ? '#2D9B5E' : toast.type === 'error' ? '#D44A4A' : '#5B8DEF' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.mark}>WC</div>
          <div>
            <div style={S.headerTitle}>WAVE CLOSERS</div>
            <div style={S.headerSub}>{portalLabel}</div>
          </div>
        </div>
        {showPriorityBadge && (
          <div style={S.priorityBadge}>
            ⭐ Priority lead access — you receive leads before Independent Reps and Cold Callers
          </div>
        )}
        <div style={S.headerRight}>
          <span style={S.headerAgent}>{agentName}</span>
          <button onClick={onLogout} style={S.logoutBtn}>→ Logout</button>
        </div>
      </header>

      {/* Demo banner */}
      {isDemo && !isSupervisor && (
        <div style={S.demoBanner}>
          ⚠️ Demo mode — no real leads yet. Use <strong>&quot;Generate My Own Leads&quot;</strong> to pull fresh leads, or wait for batch assignment.
        </div>
      )}

      {/* Supervisor: agent selector */}
      {isSupervisor && (
        <div style={{ padding: '12px 20px', background: '#F0F5FA', borderBottom: '1px solid #DDE6F0' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#1F4E79', marginRight: 10 }}>Viewing Agent:</label>
          <select value={supervisorAgent} onChange={e => setSupervisorAgent(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #BCD', fontSize: 14 }}>
            <option value="all">All Agents ({leads.length} leads)</option>
            {AGENTS.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
        </div>
      )}

      {/* Progress card (agents only) */}
      {!isSupervisor && (
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
      )}

      {/* Tab bar */}
      <div style={S.tabBar}>
        <button
          id="tab-assigned" onClick={() => setActiveTab('assigned')}
          style={{ ...S.tabBtn, ...(activeTab === 'assigned' ? S.tabBtnActive : {}) }}
        >
          📋 My Leads{leads.length > 0 ? ` (${leads.length})` : ''}
        </button>
        {!isSupervisor && (
          <button
            id="tab-generate" onClick={() => setActiveTab('generate')}
            style={{ ...S.tabBtn, ...(activeTab === 'generate' ? S.tabBtnActive : {}) }}
          >
            ⚡ Generate Leads
          </button>
        )}
        <button
          id="tab-history" onClick={() => setActiveTab('history')}
          style={{ ...S.tabBtn, ...(activeTab === 'history' ? S.tabBtnActive : {}) }}
        >
          📖 History{historyList.length > 0 ? ` (${historyList.length})` : ''}
        </button>
      </div>

      {/* Tab: Generate My Own Leads */}
      {activeTab === 'generate' && !isSupervisor && renderGenerateTab()}

      {/* Tab: History */}
      {activeTab === 'history' && (
        <div style={{ padding: '0 20px' }}>
          {historyList.length === 0 ? (
            <div style={S.emptyState}>No called leads yet. Start calling and your history will appear here.</div>
          ) : (
            <>
              <div style={{ ...S.sectionHeader, margin: '20px 0 12px' }}>📖 Called Leads — All Time ({historyList.length})</div>
              {historyList.map((lead, i) => renderLeadCard(lead, i))}
            </>
          )}
        </div>
      )}

      {/* Tab: My Assigned Leads */}
      {activeTab === 'assigned' && (
        <div>
          {/* Filter/search bar */}
          <div style={S.filterBar}>
            <select value={filter} onChange={e => setFilter(e.target.value)} style={S.filterSelect}>
              <option value="all">All ({leads.length})</option>
              <option value="uncalled">Uncalled ({stats.uncalled})</option>
              <option value="callbacks">Callbacks ({stats.callback})</option>
              <option value="interested">Interested ({stats.interested})</option>
            </select>
            <input
              type="text" placeholder="Search business..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={S.searchInput}
            />
          </div>

          <div style={S.leadsList}>
            {/* Callbacks section — shown in uncalled/all views */}
            {(filter === 'all' || filter === 'uncalled') && callbacksList.length > 0 && (
              <div>
                <div style={S.sectionHeader}>📞 Callbacks ({callbacksList.length})</div>
                {callbacksList.map((lead, i) => renderLeadCard(lead, i))}
              </div>
            )}

            {/* Main list */}
            {filter === 'uncalled' || filter === 'all' ? (
              <>
                <div style={S.sectionHeader}>🎯 Focus List — {filter === 'uncalled' ? 'Uncalled' : 'All'} ({recommendedFocusList.length})</div>
                {recommendedFocusList.length === 0 ? (
                  <div style={S.emptyState}>
                    {leads.length === 0
                      ? (
                        <div>
                          No leads assigned yet.{' '}
                          <button onClick={() => setActiveTab('generate')} style={{ background: 'none', border: 'none', color: '#5B8DEF', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}>
                            Generate your own leads ⚡
                          </button>
                        </div>
                      )
                      : 'No uncalled leads. All leads are called for now!'}
                  </div>
                ) : (
                  recommendedFocusList.map((lead, i) => renderLeadCard(lead, i))
                )}
              </>
            ) : (
              <>
                {filtered.length === 0 ? (
                  <div style={S.emptyState}>No leads match this filter.</div>
                ) : (
                  filtered.map((lead, i) => renderLeadCard(lead, i))
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={S.footer}>
        {!isSupervisor && stats.uncalled === 0 && stats.total > 0
          ? <div style={S.footerText}>All caught up! 🎉 Generate more leads whenever you&apos;re ready.</div>
          : <div style={S.footerText}>Wave Closers — Agent Portal</div>}
      </div>
    </div>
  );
}

const S = {
  root: { minHeight: '100vh', background: '#FAF8F4', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", maxWidth: 800, margin: '0 auto', padding: '0 0 80px 0' },
  toast: { position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', padding: '12px 24px', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', maxWidth: '90vw', textAlign: 'center' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#1A1A1A', color: '#fff', flexWrap: 'wrap', gap: 8 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  priorityBadge: { background: '#D49A2B', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 4, order: 3, width: '100%', textAlign: 'center' },
  mark: { width: 36, height: 36, background: '#1F4E79', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, borderRadius: 6, flexShrink: 0 },
  headerTitle: { fontSize: 13, fontWeight: 700, letterSpacing: '0.1em' },
  headerSub: { fontSize: 10, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  headerAgent: { fontSize: 13, fontWeight: 600 },
  logoutBtn: { background: 'transparent', border: '1px solid #555', color: '#ccc', padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  demoBanner: { background: '#FBF1DD', color: '#8A5A1A', padding: '10px 20px', fontSize: 13, textAlign: 'center', borderBottom: '1px solid #EBE6DC' },
  progressCard: { margin: '16px 20px', background: '#fff', borderRadius: 10, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #EBE6DC' },
  progressLabel: { fontSize: 14, fontWeight: 700, color: '#1A1A1A' },
  progressBarOuter: { width: '100%', height: 10, background: '#EBE6DC', borderRadius: 5, overflow: 'hidden' },
  progressBarInner: { height: '100%', background: 'linear-gradient(90deg, #2D9B5E, #5B8DEF)', borderRadius: 5, transition: 'width 0.4s ease' },
  progressText: { fontSize: 13, color: '#555', marginTop: 8 },
  statsRow: { display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  statPill: { padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600 },

  tabBar: { display: 'flex', gap: 0, borderBottom: '2px solid #EBE6DC', background: '#fff', padding: '0 20px', marginBottom: 16 },
  tabBtn: { flex: 1, padding: '14px 8px', border: 'none', background: 'none', fontSize: 13, fontWeight: 600, color: '#888', cursor: 'pointer', fontFamily: 'inherit', borderBottom: '2px solid transparent', marginBottom: -2, transition: 'all 0.2s' },
  tabBtnActive: { color: '#1F4E79', borderBottom: '2px solid #1F4E79' },

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

  // Generate tab
  genCard: { background: '#fff', borderRadius: 12, padding: '24px', border: '1px solid #EBE6DC', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: 8 },
  genTitle: { fontSize: 18, fontWeight: 800, color: '#1A1A1A', marginBottom: 8 },
  genSubtitle: { fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 1.6 },
  genLabel: { display: 'block', fontSize: 13, fontWeight: 700, color: '#444', marginBottom: 6, marginTop: 16 },
  genInput: { width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #DDD', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', minHeight: 48 },
  genTypesGrid: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  genTypeBtn: { padding: '8px 14px', borderRadius: 8, border: '1px solid #DDD', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#555', transition: 'all 0.15s' },
  genTypeBtnActive: { background: '#1F4E79', color: '#fff', borderColor: '#1F4E79' },
  genSubmitBtn: { width: '100%', marginTop: 20, padding: '16px', background: 'linear-gradient(135deg, #1F4E79, #2D9B5E)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(31,78,121,0.2)' },
  genResultBox: { marginTop: 16, padding: '14px', background: '#F5F9F5', borderRadius: 8, border: '1px solid #E0EDE5', fontSize: 14 },
  maxLeadsRow: { marginBottom: 16 },
  quickPicks: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 },
  pickBtn: { flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #DDD', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, transition: 'all 0.15s' },
  customInput: { width: 80, padding: '8px 12px', borderRadius: 6, border: '1px solid #DDD', fontSize: 14, fontFamily: 'inherit', textAlign: 'center' },
  hint: { fontSize: 11, color: '#888', marginTop: 4 },

  footer: { padding: '24px 20px', textAlign: 'center' },
  footerText: { fontSize: 14, color: '#888' },
};
