import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { PageHeader, Card, CardHeader, StatCard } from '../components/ui.jsx';
import { BUSINESS_TYPES, AGENTS, DAILY_LEADS_PER_AGENT } from '../data/constants.js';
import { SEED_LEADS, SEED_LEAD_STATS } from '../data/seed.js';
import {
  loadLeadsFromStorage,
  saveLeadsToStorage,
  fetchLeadsFromAPI,
  generateLeadsAPI,
  assignLeadsAPI,
  updateLeadAPI,
  fetchLeadStatsAPI,
  assignLeadToPartnerAPI,
} from '../lib/dataLayer.js';

/**
 * Module 6 — AI Lead Generation Engine
 *
 * William has 10 cold-calling agents who each need 100 leads per day.
 * Target: restaurants, beauty salons, nail salons, delis, massage places, small retail.
 *
 * Tabs: Generate | Lead List | Agent Assignment | Qualifier Queue | Analytics
 */
export default function LeadGeneration({ users = [], setUsers, setLeadBadge }) {
  const [tab, setTab] = useState('generate');
  const [leads, setLeads] = useState(() => loadLeadsFromStorage() || SEED_LEADS);
  const [stats, setStats] = useState(SEED_LEAD_STATS);
  const [isDemo, setIsDemo] = useState(true);
  const [toast, setToast] = useState(null);

  // Sync leadBadge with count of SentToQualifier leads
  useEffect(() => {
    if (setLeadBadge) {
      const count = leads.filter(l => l.status === 'SentToQualifier').length;
      setLeadBadge(count);
    }
  }, [leads, setLeadBadge]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Generation form state ──
  const [location, setLocation] = useState('');
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [radius, setRadius] = useState(5);
  const [maxLeads, setMaxLeads] = useState(50);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState('');
  const [genResult, setGenResult] = useState(null);

  // ── Filters ──
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [sortBy, setSortBy] = useState('score');

  // ── On mount: try loading live data ──
  useEffect(() => {
    fetchLeadsFromAPI().then(live => {
      if (live && live.length) {
        setLeads(live);
        setIsDemo(false);
        saveLeadsToStorage(live);
      }
    });
    fetchLeadStatsAPI().then(s => {
      if (s) setStats(s);
    });
  }, []);

  // ── Persist to localStorage on every lead change ──
  useEffect(() => {
    saveLeadsToStorage(leads);
  }, [leads]);

  // ── Business type toggle ──
  function toggleType(id) {
    setSelectedTypes(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  }

  function toggleAllTypes() {
    if (selectedTypes.length === BUSINESS_TYPES.length) {
      setSelectedTypes([]);
    } else {
      setSelectedTypes(BUSINESS_TYPES.map(t => t.id));
    }
  }

  // ── Generate leads ──
  async function handleGenerate() {
    if (!location.trim() || !selectedTypes.length) return;
    setGenerating(true);
    setGenResult(null);

    setGenProgress('Searching Google Places...');
    await new Promise(r => setTimeout(r, 600));
    setGenProgress('Searching Yelp...');
    await new Promise(r => setTimeout(r, 400));
    setGenProgress('Scoring with Claude AI...');

    const result = await generateLeadsAPI(location.trim(), selectedTypes, radius, maxLeads);

    if (result.leads?.length) {
      setLeads(prev => {
        const existingIds = new Set(prev.map(l => l.placeId));
        const newLeads = result.leads.filter(l => !existingIds.has(l.placeId));
        return [...newLeads, ...prev].sort((a, b) => b.score - a.score);
      });
    }

    setGenProgress('');
    setGenResult(result);
    setGenerating(false);
    if (result.leads?.length) setTab('list');
  }

  // ── Lead actions ──
  const handleAssign = useCallback((placeId, agent) => {
    setLeads(prev => prev.map(l =>
      l.placeId === placeId ? { ...l, assignedAgent: agent, status: 'Assigned' } : l
    ));
    updateLeadAPI(placeId, { assignedAgent: agent, status: 'Assigned' });
  }, []);

  const handleMarkCalled = useCallback((placeId, outcome) => {
    const calledAt = new Date().toISOString();
    setLeads(prev => prev.map(l =>
      l.placeId === placeId ? { ...l, status: outcome, outcome, calledAt } : l
    ));
    updateLeadAPI(placeId, { status: outcome, outcome, calledAt });
  }, []);

  const handleSkip = useCallback((placeId) => {
    setLeads(prev => prev.map(l =>
      l.placeId === placeId ? { ...l, status: 'NotInterested', outcome: 'Skipped' } : l
    ));
    updateLeadAPI(placeId, { status: 'NotInterested', outcome: 'Skipped' });
  }, []);

  // ── Bulk assign ──
  const [bulkAgent, setBulkAgent] = useState('');
  function handleBulkAssign() {
    if (!bulkAgent) return;
    const unassigned = leads.filter(l => !l.assignedAgent && l.status === 'New');
    const batch = unassigned;
    const ids = batch.map(l => l.placeId);
    setLeads(prev => prev.map(l =>
      ids.includes(l.placeId) ? { ...l, assignedAgent: bulkAgent, status: 'Assigned' } : l
    ));
    assignLeadsAPI(ids, bulkAgent);
    setBulkAgent('');
  }

  // ── Filtered + sorted leads ──
  const filteredLeads = useMemo(() => {
    let result = [...leads];
    if (filterType)   result = result.filter(l => l.type === filterType);
    if (filterStatus) result = result.filter(l => l.status === filterStatus);
    if (filterArea)   result = result.filter(l => (l.market || l.address || '').toLowerCase().includes(filterArea.toLowerCase()));

    if (sortBy === 'score')  result.sort((a, b) => b.score - a.score);
    if (sortBy === 'name')   result.sort((a, b) => a.businessName.localeCompare(b.businessName));
    if (sortBy === 'rating') result.sort((a, b) => b.rating - a.rating);
    return result;
  }, [leads, filterType, filterStatus, filterArea, sortBy]);

  // ── Agent stats (computed from current leads) ──
  const agentStats = useMemo(() => {
    if (!isDemo) return stats.daily || [];
    // Compute from leads in demo mode
    const map = {};
    for (const agent of AGENTS) {
      map[agent.name] = { agent: agent.name, leadsAssigned: 0, callsToday: 0, interested: 0, notInterested: 0, callback: 0, noAnswer: 0 };
    }
    for (const l of leads) {
      if (l.assignedAgent && map[l.assignedAgent]) {
        map[l.assignedAgent].leadsAssigned++;
        if (l.calledAt) {
          map[l.assignedAgent].callsToday++;
          if (l.outcome === 'Interested')    map[l.assignedAgent].interested++;
          if (l.outcome === 'NotInterested') map[l.assignedAgent].notInterested++;
          if (l.outcome === 'Callback')      map[l.assignedAgent].callback++;
          if (l.outcome === 'NoAnswer')      map[l.assignedAgent].noAnswer++;
        }
      }
    }
    return Object.values(map);
  }, [leads, stats, isDemo]);

  // ── CSV export ──
  function exportCSV() {
    const rows = [
      ['Rank','Business','Type','Address','Phone','Score','Reason','Status','Agent','Outcome'],
      ...filteredLeads.map((l, i) => [i + 1, l.businessName, l.type, l.address, l.phone, l.score, l.scoreReason, l.status, l.assignedAgent, l.outcome]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wave-closers-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Summary stats ──
  const summary = useMemo(() => ({
    total:       leads.length,
    newLeads:    leads.filter(l => l.status === 'New').length,
    assigned:    leads.filter(l => l.status === 'Assigned').length,
    interested:  leads.filter(l => l.status === 'Interested').length,
    qualifierQueue:leads.filter(l => l.status === 'SentToQualifier').length,
    called:      leads.filter(l => l.calledAt).length,
    uncalled:    leads.filter(l => l.assignedAgent && !l.calledAt && !l.outcome).length,
    avgScore:    leads.length ? Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length) : 0,
  }), [leads]);

  const qualifierLeads = useMemo(() => {
    return leads.filter(l => l.status === 'SentToQualifier');
  }, [leads]);

  const statusPieData = useMemo(() => {
    const counts = { New: 0, Assigned: 0, SentToQualifier: 0, AssignedToPartner: 0, Other: 0 };
    leads.forEach(l => {
      if (l.status === 'New') counts.New++;
      else if (l.status === 'Assigned') counts.Assigned++;
      else if (l.status === 'SentToQualifier') counts.SentToQualifier++;
      else if (l.status === 'AssignedToPartner') counts.AssignedToPartner++;
      else counts.Other++;
    });
    return [
      { name: 'New (Unassigned)', value: counts.New, fill: '#5B8DEF' },
      { name: 'Assigned to Agents', value: counts.Assigned, fill: '#1F4E79' },
      { name: 'Qualifier Queue (Hot)', value: counts.SentToQualifier, fill: '#D49A2B' },
      { name: 'Assigned to Partner', value: counts.AssignedToPartner, fill: '#2D9B5E' },
      { name: 'Other / Declined', value: counts.Other, fill: '#D44A4A' },
    ].filter(d => d.value > 0);
  }, [leads]);

  const businessTypeInterestRates = useMemo(() => {
    const statsMap = {};
    BUSINESS_TYPES.forEach(t => {
      statsMap[t.id] = { label: t.label, icon: t.icon, called: 0, interested: 0 };
    });

    leads.forEach(l => {
      const typeStat = statsMap[l.type];
      if (typeStat) {
        const isCalled = !!l.calledAt || ['Interested', 'NotInterested', 'Callback', 'NoAnswer', 'SentToQualifier', 'AssignedToPartner'].includes(l.status) || !!l.outcome;
        const isInterested = l.outcome === 'Interested' || l.status === 'SentToQualifier' || l.status === 'AssignedToPartner';
        
        if (isCalled) {
          typeStat.called++;
          if (isInterested) {
            typeStat.interested++;
          }
        }
      }
    });

    return Object.values(statsMap)
      .map(t => ({
        ...t,
        rate: t.called > 0 ? Math.round((t.interested / t.called) * 100) : 0,
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [leads]);

  return (
    <div style={S.wrap}>
      {toast && (
        <div style={{ ...S.toast, background: toast.type === 'success' ? '#2D9B5E' : '#5B8DEF' }}>
          {toast.msg}
        </div>
      )}

      <PageHeader title="AI Lead Generation" subtitle="Generate scored leads for 10 cold-calling agents — 100 leads/agent/day" />

      {isDemo && (
        <div style={S.demoBanner}>
          📋 Demo mode — showing sample data. Connect API keys + backend for live lead generation.
          Call outcomes are saved to your browser and survive page refresh.
        </div>
      )}

      {summary.newLeads < 500 && (
        <div style={S.warningBanner}>
          ⚠️ Only {summary.newLeads} leads remaining in pool — generate more before Monday
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="wc-stat-grid" style={S.statGrid}>
        <StatCard label="Total leads"  value={summary.total}      sub="in system" />
        <StatCard label="New"          value={summary.newLeads}   sub="unassigned" tone="green" />
        <StatCard label="Assigned"     value={summary.assigned}   sub="to agents" />
        <StatCard label="Uncalled"     value={summary.uncalled}   sub="calls left" tone="amber" />
        <StatCard label="Qualifier Queue" value={summary.qualifierQueue} sub="hot leads" tone="amber" />
        <StatCard label="Called"       value={summary.called}     sub="today" />
        <StatCard label="Avg score"    value={summary.avgScore}   sub="out of 100" />
      </div>

      {/* ── Tabs ── */}
      <div style={S.tabRow}>
        {[
          { id: 'generate', label: '⚡ Generate Leads' },
          { id: 'list',     label: `📋 Lead List (${filteredLeads.length})` },
          { id: 'agents',   label: '👥 Agent Assignment' },
          { id: 'qualifier',  label: `📥 Qualifier's Queue (${summary.qualifierQueue})` },
          { id: 'analytics',label: '📊 Analytics' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ ...S.tab, ...(tab === t.id ? S.tabActive : {}) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════ TAB: Generate ═══════════════ */}
      {tab === 'generate' && (
        <Card>
          <CardHeader title="Generate new leads" sub="Search Google Places + Yelp, score with Claude AI" />

          <div style={S.formGrid}>
            <div>
              <label style={S.label}>Location (city, ZIP, or neighborhood)</label>
              <input
                placeholder="e.g. Brooklyn, NY or 33139"
                value={location}
                onChange={e => setLocation(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                style={S.input}
              />
            </div>
            <div>
              <label style={S.label}>Search radius</label>
              <select value={radius} onChange={e => setRadius(Number(e.target.value))} style={S.select}>
                {[1, 3, 5, 10, 25].map(r => (
                  <option key={r} value={r}>{r} mile{r > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={S.maxLeadsRow}>
            <label style={S.label}>How many leads do you want?</label>
            <div style={S.quickPicks}>
              {[25, 50, 100].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMaxLeads(n)}
                  style={{
                    ...S.pickBtn,
                    background: maxLeads === n ? 'var(--color-primary)' : 'white',
                    color: maxLeads === n ? 'white' : '#555',
                    borderColor: maxLeads === n ? 'var(--color-primary)' : '#DDD',
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

          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={S.label}>Business types</label>
              <button onClick={toggleAllTypes} style={S.selectAllBtn}>
                {selectedTypes.length === BUSINESS_TYPES.length ? '✓ Deselect all' : '☐ All foot-traffic businesses'}
              </button>
            </div>
            <div style={S.typeGrid}>
              {BUSINESS_TYPES.map(t => (
                <label key={t.id} style={{ ...S.typeCheck, ...(selectedTypes.includes(t.id) ? S.typeCheckActive : {}) }}>
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(t.id)}
                    onChange={() => toggleType(t.id)}
                    style={{ display: 'none' }}
                  />
                  <span style={{ fontSize: 18 }}>{t.icon}</span>
                  <span>{t.label}</span>
                  {selectedTypes.includes(t.id) && <span style={S.checkMark}>✓</span>}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={handleGenerate}
              disabled={generating || !location.trim() || !selectedTypes.length}
              style={{ ...S.primaryBtn, opacity: (generating || !location.trim() || !selectedTypes.length) ? 0.5 : 1 }}
            >
              {generating ? '⟳ Generating...' : '⚡ Generate Leads'}
            </button>
            {genProgress && <span className="wc-generating" style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 500 }}>{genProgress}</span>}
          </div>

          {genResult && (
            <div style={S.genResultBox}>
              <strong>✓ Generation complete</strong>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                {genResult.stats?.merged || 0} businesses found · {genResult.leads?.length || 0} scored · {genResult.stats?.saved || 0} saved to Airtable
                {genResult.demo && ' (demo mode)'}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ═══════════════ TAB: Lead List ═══════════════ */}
      {tab === 'list' && (
        <Card>
          <CardHeader
            title="Lead list"
            sub={`${filteredLeads.length} leads${isDemo ? ' (demo)' : ''}`}
            right={
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={exportCSV} style={S.smallBtn}>↓ Export CSV</button>
              </div>
            }
          />

          {/* Filters */}
          <div style={S.filterRow}>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={S.filterSelect}>
              <option value="">All types</option>
              {BUSINESS_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={S.filterSelect}>
              <option value="">All statuses</option>
              {['New', 'Assigned', 'Called', 'Interested', 'NotInterested', 'Callback', 'NoAnswer'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input placeholder="Filter by area..." value={filterArea} onChange={e => setFilterArea(e.target.value)} style={{ ...S.filterSelect, minWidth: 160 }} />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={S.filterSelect}>
              <option value="score">Sort: Score ↓</option>
              <option value="name">Sort: Name A→Z</option>
              <option value="rating">Sort: Rating ↓</option>
            </select>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={bulkAgent} onChange={e => setBulkAgent(e.target.value)} style={S.filterSelect}>
                <option value="">Bulk assign to...</option>
                {AGENTS.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
              {bulkAgent && <button onClick={handleBulkAssign} style={S.smallBtn}>Assign batch</button>}
            </div>
          </div>

          {/* Lead table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  {['#', 'Business', 'Type', 'Address', 'Phone', 'Score', 'Reason', 'Status', 'Actions'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLeads.slice(0, 100).map((lead, idx) => (
                  <LeadRow
                    key={lead.placeId}
                    lead={lead}
                    rank={idx + 1}
                    onAssign={handleAssign}
                    onMarkCalled={handleMarkCalled}
                    onSkip={handleSkip}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {filteredLeads.length > 100 && (
            <div style={{ fontSize: 12, color: '#888', textAlign: 'center', padding: 12 }}>
              Showing first 100 of {filteredLeads.length} leads. Use filters to narrow results.
            </div>
          )}
        </Card>
      )}

      {/* ═══════════════ TAB: Agent Assignment ═══════════════ */}
      {tab === 'agents' && (
        <Card>
          <CardHeader title="Agent assignment" sub={`${AGENTS.length} agents · ${DAILY_LEADS_PER_AGENT} leads/agent target`} />
          <div style={S.agentGrid}>
            {AGENTS.map(agent => {
              const as = agentStats.find(a => a.agent === agent.name) || { leadsAssigned: 0, callsToday: 0 };
              // Use demo stats if no real data
              const demoAs = SEED_LEAD_STATS.daily.find(a => a.agent === agent.name) || as;
              const display = isDemo && as.leadsAssigned === 0 ? demoAs : as;
              const pctAssigned = Math.min(100, Math.round((display.leadsAssigned / DAILY_LEADS_PER_AGENT) * 100));
              const pctCalled   = display.leadsAssigned > 0 ? Math.round((display.callsToday / DAILY_LEADS_PER_AGENT) * 100) : 0;

              return (
                <div key={agent.id} style={S.agentCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong style={{ fontSize: 14 }}>{agent.name}</strong>
                    <span style={{ fontSize: 11, color: pctAssigned >= 100 ? 'var(--color-green)' : 'var(--color-amber)', fontWeight: 600 }}>
                      {display.leadsAssigned}/{DAILY_LEADS_PER_AGENT} assigned
                    </span>
                  </div>

                  {/* Assigned progress bar */}
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Leads assigned</div>
                  <div style={S.progressBar}>
                    <div style={{ ...S.progressFill, width: `${pctAssigned}%`, background: pctAssigned >= 100 ? 'var(--color-green)' : 'var(--color-primary)' }} />
                  </div>

                  {/* Daily calls counter — William's core KPI */}
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3, marginTop: 10 }}>
                    Daily calls
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ ...S.progressBar, flex: 1 }}>
                      <div style={{
                        ...S.progressFill,
                        width: `${pctCalled}%`,
                        background: pctCalled >= 90 ? 'var(--color-green)' : pctCalled >= 50 ? 'var(--color-amber)' : 'var(--color-red)',
                      }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: pctCalled >= 90 ? 'var(--color-green)' : pctCalled >= 50 ? 'var(--color-amber)' : 'var(--color-red)', whiteSpace: 'nowrap' }}>
                      {display.callsToday}/{DAILY_LEADS_PER_AGENT}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11, color: '#888' }}>
                    <span>✓ {display.interested} interested</span>
                    <span>↺ {display.callback} callback</span>
                    <span>✗ {display.notInterested} declined</span>
                  </div>

                  <button
                    onClick={() => {
                      const unassigned = leads.filter(l => !l.assignedAgent && l.status === 'New');
                      if (!unassigned.length) return;
                      const batch = unassigned;
                      const ids = batch.map(l => l.placeId);
                      setLeads(prev => prev.map(l =>
                        ids.includes(l.placeId) ? { ...l, assignedAgent: agent.name, status: 'Assigned' } : l
                      ));
                      assignLeadsAPI(ids, agent.name);
                    }}
                    disabled={leads.filter(l => !l.assignedAgent && l.status === 'New').length === 0}
                    style={{ ...S.smallBtn, marginTop: 10, width: '100%', opacity: leads.filter(l => !l.assignedAgent && l.status === 'New').length === 0 ? 0.4 : 1 }}
                  >
                    {leads.filter(l => !l.assignedAgent && l.status === 'New').length === 0 ? '✓ No unassigned leads' : `Assign all unassigned (${leads.filter(l => !l.assignedAgent && l.status === 'New').length})`}
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ═══════════════ TAB: Qualifier's Queue ═══════════════ */}
      {tab === 'qualifier' && (
        <Card>
          <CardHeader
            title="Qualifier's Queue"
            sub={`${qualifierLeads.length} interested leads awaiting partner assignment`}
          />

          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  {['Business', 'Type', 'Phone', 'Score', 'Agent', 'Agent Notes', 'Received At', 'Assign Partner'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {qualifierLeads.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ ...S.td, textAlign: 'center', padding: 24, color: '#888' }}>
                      No interested leads in queue.
                    </td>
                  </tr>
                ) : (
                  qualifierLeads.map(lead => {
                    const typeLabels = {
                      restaurant: '🍽️', beauty_salon: '💇', nail_salon: '💅',
                      deli: '🥪', massage: '💆', small_retail: '🏪',
                    };
                    const scoreColor = lead.score >= 75 ? 'var(--color-green)' : lead.score >= 50 ? 'var(--color-amber)' : 'var(--color-red)';
                    
                    // Filter partners in the same market, fallback to all users
                    const filteredPartners = users.filter(u => u.market === lead.market);
                    const partnersToShow = filteredPartners.length > 0 ? filteredPartners : users;

                    return (
                      <tr key={lead.placeId}>
                        <td style={S.td}>
                          <strong>{lead.businessName}</strong>
                          <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{lead.market || lead.address}</div>
                        </td>
                        <td style={S.td}><span title={lead.type}>{typeLabels[lead.type] || lead.type}</span></td>
                        <td style={S.td}>{lead.phone || '—'}</td>
                        <td style={S.td}>
                          <strong style={{ color: scoreColor }}>{lead.score}</strong>
                        </td>
                        <td style={S.td}>{lead.assignedAgent || '—'}</td>
                        <td style={{ ...S.td, fontSize: 11, color: '#666', maxWidth: 150 }}>{lead.agentNotes || '—'}</td>
                        <td style={{ ...S.td, fontSize: 11, color: '#888' }}>
                          {lead.qualifierNotifiedAt ? new Date(lead.qualifierNotifiedAt).toLocaleDateString() : '—'}
                        </td>
                        <td style={S.td}>
                          <select
                            value=""
                            onChange={async (e) => {
                              const partnerId = e.target.value;
                              if (!partnerId) return;
                              const partner = users.find(u => u.id === partnerId);
                              if (!partner) return;

                              // Optimistically update locally
                              setLeads(prev => prev.map(l =>
                                l.placeId === lead.placeId
                                  ? { ...l, status: 'AssignedToPartner', assignedPartnerID: partnerId, assignedPartnerAt: new Date().toISOString() }
                                  : l
                              ));

                              // Update in Airtable
                              await assignLeadToPartnerAPI(lead.placeId, partnerId);

                              // Increment partner leads locally
                              if (setUsers) {
                                setUsers(prev => prev.map(u =>
                                  u.id === partnerId
                                    ? { ...u, leadsThisWeek: (u.leadsThisWeek || 0) + 1 }
                                    : u
                                ));
                              }

                              showToast(`${lead.businessName} assigned to partner ${partner.name}. Leads: ${partner.leadsThisWeek || 0} → ${(partner.leadsThisWeek || 0) + 1}`);
                            }}
                            style={S.miniSelect}
                          >
                            <option value="">Select partner...</option>
                            {partnersToShow.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.market || 'Unknown Market'}) - Leads: {p.leadsThisWeek || 0}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ═══════════════ TAB: Analytics ═══════════════ */}
      {tab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <CardHeader title="Daily calls per agent" sub="William's core KPI — 100 calls/agent/day target" />
            <div style={{ height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={agentStats.length ? agentStats : SEED_LEAD_STATS.daily} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
                  <XAxis dataKey="agent" tick={{ fontSize: 10, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#666' }} domain={[0, DAILY_LEADS_PER_AGENT]} />
                  <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #DDD', borderRadius: 8 }} />
                  <Bar dataKey="callsToday" name="Calls today" radius={[4, 4, 0, 0]}>
                    {(agentStats.length ? agentStats : SEED_LEAD_STATS.daily).map((entry, i) => (
                      <Cell key={i} fill={entry.callsToday >= 90 ? '#2D9B5E' : entry.callsToday >= 50 ? '#D49A2B' : '#D44A4A'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="wc-two-col" style={S.twoCol}>
            <Card>
              <CardHeader title="Conversion by agent" sub="Interest rate from calls" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {(agentStats.length ? agentStats : SEED_LEAD_STATS.daily).map(a => {
                  const convRate = a.callsToday > 0 ? Math.round((a.interested / a.callsToday) * 100) : 0;
                  return (
                    <div key={a.agent} style={S.convRow}>
                      <span style={{ fontSize: 13, fontWeight: 500, minWidth: 80 }}>{a.agent}</span>
                      <div style={{ ...S.progressBar, flex: 1 }}>
                        <div style={{ ...S.progressFill, width: `${convRate}%`, background: convRate >= 15 ? 'var(--color-green)' : convRate >= 8 ? 'var(--color-amber)' : 'var(--color-red)' }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, minWidth: 40, textAlign: 'right' }}>{convRate}%</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <CardHeader title="Top markets" sub="By lead volume" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(stats.topMarkets || SEED_LEAD_STATS.topMarkets).map((market, i) => {
                  const count = leads.filter(l => l.market === market).length;
                  return (
                    <div key={market} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-line-soft)' }}>
                      <span style={S.rankBadge}>{i + 1}</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{market}</span>
                      <span style={{ fontSize: 12, color: '#888' }}>{count} leads</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <div className="wc-two-col" style={S.twoCol}>
            <Card>
              <CardHeader title="Pipeline status breakdown" sub="Distribution of all leads in system" />
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {statusPieData.length === 0 ? (
                  <span style={{ fontSize: 13, color: '#888' }}>No data available</span>
                ) : (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        innerRadius={40}
                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                      >
                        {statusPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} leads`]} />
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Business types by interest rate" sub="Conversion rate per segment" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {businessTypeInterestRates.map((t, idx) => (
                  <div key={t.label} style={{ ...S.convRow, borderBottom: idx === businessTypeInterestRates.length - 1 ? 'none' : '1px solid var(--color-line-soft)' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, minWidth: 140 }}>
                      <span style={{ marginRight: 6 }}>{t.icon}</span>
                      {t.label}
                    </span>
                    <span style={{ fontSize: 12, color: '#888', minWidth: 85 }}>
                      {t.interested} / {t.called} called
                    </span>
                    <div style={{ ...S.progressBar, flex: 1, marginLeft: 10 }}>
                      <div style={{ ...S.progressFill, width: `${t.rate}%`, background: t.rate >= 15 ? 'var(--color-green)' : t.rate >= 8 ? 'var(--color-amber)' : 'var(--color-red)' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, minWidth: 40, textAlign: 'right' }}>{t.rate}%</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Lead row sub-component ───────────────────────────────────────────────────

function LeadRow({ lead, rank, onAssign, onMarkCalled, onSkip }) {
  const [showOutcome, setShowOutcome] = useState(false);
  const scoreColor = lead.score >= 75 ? 'var(--color-green)' : lead.score >= 50 ? 'var(--color-amber)' : 'var(--color-red)';
  const statusColors = {
    New: '#5B8DEF', Assigned: '#1F4E79', Called: '#D49A2B',
    Interested: '#2D9B5E', NotInterested: '#D44A4A', Callback: '#D49A2B', NoAnswer: '#999',
    SentToQualifier: '#D49A2B', AssignedToPartner: '#2D9B5E',
    RoutedToRecruiter: '#D97A5E', RoutedToCX: '#7B6FDB',
  };

  const typeLabels = {
    restaurant: '🍽️', beauty_salon: '💇', nail_salon: '💅',
    deli: '🥪', massage: '💆', small_retail: '🏪',
  };

  return (
    <tr>
      <td style={S.td}><span style={S.rankBadge}>{rank}</span></td>
      <td style={S.td}><strong>{lead.businessName}</strong></td>
      <td style={S.td}><span title={lead.type}>{typeLabels[lead.type] || lead.type}</span></td>
      <td style={{ ...S.td, fontSize: 11, maxWidth: 180 }}>{lead.address}</td>
      <td style={{ ...S.td, whiteSpace: 'nowrap' }}>{lead.phone || '—'}</td>
      <td style={S.td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 60, height: 6, background: '#EEE', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${lead.score}%`, background: scoreColor, borderRadius: 3 }} />
          </div>
          <strong style={{ color: scoreColor, fontSize: 12 }}>{lead.score}</strong>
        </div>
      </td>
      <td style={{ ...S.td, fontSize: 11, color: '#666', maxWidth: 200 }}>{lead.scoreReason}</td>
      <td style={S.td}>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
          background: `${statusColors[lead.status] || '#999'}15`,
          color: statusColors[lead.status] || '#999',
        }}>
          {lead.status}
        </span>
      </td>
      <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
        {lead.status === 'New' && (
          <select
            value={lead.assignedAgent}
            onChange={e => onAssign(lead.placeId, e.target.value)}
            style={S.miniSelect}
          >
            <option value="">Assign...</option>
            {AGENTS.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
        )}
        {(lead.status === 'Assigned' || lead.status === 'Callback') && !showOutcome && (
          <button onClick={() => setShowOutcome(true)} style={S.actionBtn}>📞 Called</button>
        )}
        {showOutcome && (
          <div style={{ display: 'flex', gap: 4 }}>
            {['Interested', 'NotInterested', 'Callback', 'NoAnswer'].map(o => (
              <button key={o} onClick={() => { onMarkCalled(lead.placeId, o); setShowOutcome(false); }} style={{
                ...S.actionBtn,
                fontSize: 10,
                background: o === 'Interested' ? 'var(--color-green-bg)' : o === 'NotInterested' ? 'var(--color-red-bg)' : 'var(--color-amber-bg)',
                color: o === 'Interested' ? 'var(--color-green-text)' : o === 'NotInterested' ? 'var(--color-red-text)' : 'var(--color-amber-text)',
              }}>
                {o === 'NotInterested' ? 'No' : o === 'NoAnswer' ? 'N/A' : o}
              </button>
            ))}
          </div>
        )}
        {(lead.status === 'New' || lead.status === 'Assigned') && (
          <button onClick={() => onSkip(lead.placeId)} style={{ ...S.actionBtn, color: '#999' }} title="Skip this lead">✕</button>
        )}
      </td>
    </tr>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  toast:       { position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', padding: '12px 24px', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, zIndex: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', maxWidth: '90vw', textAlign: 'center' },
  wrap:        { display: 'flex', flexDirection: 'column', gap: 16 },
  statGrid:    { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12 },
  twoCol:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  demoBanner:  { background: 'var(--color-info-bg)', border: '1px solid var(--color-info)', borderRadius: 8, padding: '10px 16px', fontSize: 12, color: 'var(--color-info-text)', lineHeight: 1.6 },
  warningBanner: { background: '#FFF3E0', color: '#E65100', padding: '12px 16px', borderRadius: 8, border: '1px solid #FFB74D', fontWeight: 'bold', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, lineHeight: 1.5 },

  tabRow:      { display: 'flex', gap: 4, borderBottom: '1px solid var(--color-line)', paddingBottom: 0 },
  tab:         { background: 'transparent', border: 'none', padding: '10px 16px', fontSize: 13, fontWeight: 500, color: '#888', cursor: 'pointer', borderBottom: '2px solid transparent', fontFamily: 'inherit', transition: 'all .15s' },
  tabActive:   { color: 'var(--color-primary)', borderBottom: '2px solid var(--color-primary)', fontWeight: 600 },

  formGrid:    { display: 'grid', gridTemplateColumns: '1fr 180px', gap: 16 },
  label:       { display: 'block', fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  input:       { width: '100%', padding: '10px 12px', border: '1px solid #DDD3C2', borderRadius: 6, fontSize: 13, outline: 'none', background: 'white', fontFamily: 'inherit' },
  select:      { width: '100%', padding: '10px 12px', border: '1px solid #DDD3C2', borderRadius: 6, fontSize: 13, outline: 'none', background: 'white', fontFamily: 'inherit' },

  typeGrid:    { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  typeCheck:   { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '1px solid var(--color-line)', borderRadius: 8, cursor: 'pointer', fontSize: 13, transition: 'all .15s', position: 'relative', background: 'white' },
  typeCheckActive: { borderColor: 'var(--color-primary)', background: 'var(--color-primary-soft)' },
  checkMark:   { position: 'absolute', right: 8, top: 8, fontSize: 12, color: 'var(--color-primary)', fontWeight: 700 },
  selectAllBtn:{ background: 'var(--color-primary-soft)', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },

  primaryBtn:  { background: 'var(--color-primary)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  smallBtn:    { background: 'var(--color-primary-soft)', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', borderRadius: 4, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  actionBtn:   { background: '#F5F3EE', border: '1px solid #DDD', borderRadius: 4, padding: '3px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },
  miniSelect:  { padding: '3px 6px', border: '1px solid #DDD', borderRadius: 4, fontSize: 11, fontFamily: 'inherit', background: 'white' },

  genResultBox:{ marginTop: 16, padding: '12px 16px', background: 'var(--color-green-bg)', borderRadius: 8, color: 'var(--color-green-text)', fontSize: 13 },

  filterRow:   { display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' },
  filterSelect:{ padding: '6px 10px', border: '1px solid #DDD', borderRadius: 4, fontSize: 12, fontFamily: 'inherit', background: 'white' },

  table:       { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:          { textAlign: 'left', padding: '9px 8px', borderBottom: '1px solid var(--color-line)', fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 },
  td:          { padding: '10px 8px', borderBottom: '1px solid var(--color-line-soft)', color: '#333', verticalAlign: 'middle' },
  rankBadge:   { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, background: 'var(--color-ink)', color: 'white', borderRadius: 4, fontSize: 11, fontWeight: 700 },

  agentGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 },
  agentCard:   { padding: 16, border: '1px solid var(--color-line)', borderRadius: 8, background: 'white' },
  progressBar: { height: 8, background: '#EEE', borderRadius: 4, overflow: 'hidden' },
  progressFill:{ height: '100%', borderRadius: 4, transition: 'width .5s' },

  convRow:     { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--color-line-soft)' },
  maxLeadsRow: { marginBottom: 16, marginTop: 16 },
  quickPicks:  { display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 },
  pickBtn:     { flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #DDD', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, transition: 'all 0.15s' },
  customInput: { width: 80, padding: '8px 12px', border: '1px solid #DDD', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', textAlign: 'center', boxSizing: 'border-box' },
  hint:        { fontSize: 11, color: '#888', marginTop: 4 },
};
