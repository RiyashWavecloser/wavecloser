/**
 * src/components/BulkAssignModal.jsx
 *
 * Bulk Assign Modal — multi-city pill interface (Req 5)
 *
 * Two modes:
 *  A) Manual search: search one city at a time, select rows, assign to single agent
 *  B) Auto round-robin: pick multiple cities + agents, fires backend bulk-assign
 */

import React, { useState, useEffect } from 'react';
import {
  fetchAvailableCities,
  fetchRecruitingAgents,
  searchCraigslistResumesAPI,
  bulkAssignResumeLeadsAPI,
  bulkAssignResumes,
} from '../lib/dataLayer.js';

// Quick-access market buttons (Req 5)
const QUICK_MARKETS = [
  'New York, NY',
  'New Jersey, NJ',
  'Brooklyn, NY',
  'Queens, NY',
  'Bronx, NY',
  'Miami, FL',
  'Houston, TX',
  'Chicago, IL',
  'Atlanta, GA',
  'Los Angeles, CA',
];

export default function BulkAssignModal({ onClose }) {
  // Multi-city state (Req 5)
  const [selectedCities, setSelectedCities] = useState(['New York, NY']);
  const [cityInput,       setCityInput]      = useState('');

  // Legacy single-city for manual search tab
  const [cities,        setCities]       = useState([]);
  const [agents,        setAgents]       = useState([]);
  const [selectedCity,  setSelectedCity] = useState('');
  const [keywords,      setKeywords]     = useState('sales');
  const [limit,         setLimit]        = useState(50);
  const [results,       setResults]      = useState([]);
  const [selected,      setSelected]     = useState(new Set());
  const [targetAgent,   setTargetAgent]  = useState('');
  const [searching,     setSearching]    = useState(false);
  const [assigning,     setAssigning]    = useState(false);
  const [assignResult,  setAssignResult] = useState(null);
  const [error,         setError]        = useState(null);
  const [toast,         setToast]        = useState(null);

  // Tab: 'manual' | 'auto'
  const [activeMode,    setActiveMode]   = useState('auto');

  // Auto round-robin state
  const [autoKeywords,     setAutoKeywords]     = useState('sales, cold calling, telemarketing, customer service, appointment setter');
  const [autoAgentNames,   setAutoAgentNames]   = useState([]);
  const [autoCountPerAgent, setAutoCountPerAgent] = useState(20);
  const [autoResult,       setAutoResult]       = useState(null);
  const [autoRunning,      setAutoRunning]       = useState(false);

  const [dedupChecking, setDedupChecking] = useState(false);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    Promise.all([fetchAvailableCities(), fetchRecruitingAgents()]).then(([c, a]) => {
      setCities(c);
      setAgents(a);
      if (a.length) setAutoAgentNames(a.map(ag => ag.name));
    });
  }, []);

  // ─── Multi-city pill management ─────────────────────────────────────────────

  function addCity(city) {
    const trimmed = city.trim();
    if (!trimmed) return;
    if (!selectedCities.includes(trimmed)) {
      setSelectedCities(prev => [...prev, trimmed]);
    }
    setCityInput('');
  }

  function removeCity(city) {
    setSelectedCities(prev => prev.filter(c => c !== city));
  }

  function toggleQuickMarket(market) {
    if (selectedCities.includes(market)) {
      removeCity(market);
    } else {
      setSelectedCities(prev => [...prev, market]);
    }
  }

  // ─── Manual search handlers ──────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!selectedCity) { setError('Please select a city'); return; }
    if (!keywords.trim()) { setError('Please enter keywords'); return; }
    setError(null);
    setResults([]);
    setSelected(new Set());
    setAssignResult(null);
    setSearching(true);
    try {
      const data = await searchCraigslistResumesAPI(selectedCity, keywords);
      const items = data?.results || [];
      setResults(items.slice(0, limit));
      if (items.length === 0) setError('No results found. Try different keywords or city.');
    } catch (err) {
      setError(err.message);
    }
    setSearching(false);
  };

  const toggleSelect = (idx) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === results.length) setSelected(new Set());
    else setSelected(new Set(results.map((_, i) => i)));
  };

  const handleAssign = async () => {
    if (!targetAgent) { showToast('Select a target agent', 'error'); return; }
    if (!selected.size) { showToast('Select at least one resume', 'error'); return; }
    setAssigning(true);
    setAssignResult(null);
    const selectedResumes = results.filter((_, i) => selected.has(i));
    const cityLabel = cities.find(c => c.slug === selectedCity)?.label || selectedCity;
    const result = await bulkAssignResumeLeadsAPI(selectedResumes, targetAgent, cityLabel);
    setAssigning(false);
    if (result?.demo) {
      showToast('Backend unavailable — demo mode', 'error');
    } else {
      setAssignResult(result);
      showToast(`✅ ${result.assigned} leads assigned to ${targetAgent}! (${result.skipped} skipped — already in system)`, 'success');
      setSelected(new Set());
    }
  };

  // ─── Auto round-robin handler ────────────────────────────────────────────────

  const handleAutoRun = async () => {
    if (!selectedCities.length) { showToast('Add at least one city', 'error'); return; }
    if (!autoAgentNames.length) { showToast('Select at least one agent', 'error'); return; }
    setAutoRunning(true);
    setAutoResult(null);
    try {
      const result = await bulkAssignResumes({
        cities: selectedCities,
        keywords: autoKeywords,
        agentNames: autoAgentNames,
        countPerAgent: autoCountPerAgent,
      });
      setAutoResult(result);
      if (result.success) {
        showToast(`✅ ${result.totalAssigned} leads distributed across ${autoAgentNames.length} agents from ${selectedCities.length} cities!`, 'success');
      } else {
        showToast(result.message || 'No fresh leads found', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
    setAutoRunning(false);
  };

  // ─── Dedup Integrity Check ───────────────────────────────────────────────────
  const handleDedupCheck = async () => {
    setDedupChecking(true);
    try {
      const BASE = import.meta.env.VITE_API_URL || '';
      const token = localStorage.getItem('wc_session_token') || '';
      const resp = await fetch(`${BASE}/api/resume-leads/dedup-integrity-check`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!resp.ok) {
        showToast(`Dedup check failed: ${data.error || resp.status}`, 'error');
        return;
      }
      const samples = (data.duplicateSamples || []).slice(0, 3)
        .map(d => `  • ${d.url}\n    Agents: ${d.agents.join(', ')}`)
        .join('\n');
      alert(
        `🔍 Dedup Integrity Report\n\n` +
        `Total leads in system: ${data.totalLeads}\n` +
        `Dedup registry size:   ${data.dedupRegistrySize}\n` +
        `Duplicate URLs found:  ${data.duplicateUrlCount}\n\n` +
        `Status: ${data.status}` +
        (samples ? `\n\nSample duplicates:\n${samples}` : '')
      );
    } catch (err) {
      showToast(`Dedup check error: ${err.message}`, 'error');
    } finally {
      setDedupChecking(false);
    }
  };

  const toggleAgent = (name) => {
    setAutoAgentNames(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, background: toast.type === 'success' ? '#2D9B5E' : toast.type === 'error' ? '#D44A4A' : '#5B8DEF' }}>
          {toast.msg}
        </div>
      )}

      <div style={S.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={S.modalHeader}>
          <div>
            <div style={S.modalTitle}>🔍 Bulk Assign Resume Leads</div>
            <div style={S.modalSub}>Auto round-robin across multiple cities and agents</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleDedupCheck}
              disabled={dedupChecking}
              title="Check for duplicate leads assigned to multiple agents"
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#F9FAFB', color: '#374151', cursor: dedupChecking ? 'wait' : 'pointer' }}
            >
              {dedupChecking ? '...' : '🔍 Dedup Check'}
            </button>
            <button onClick={onClose} style={S.closeBtn}>✕</button>
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 0, background: '#F0F0F0', borderRadius: 8, padding: 3 }}>
          <button onClick={() => setActiveMode('auto')} style={{ ...S.modeBtn, background: activeMode === 'auto' ? '#1F4E79' : 'transparent', color: activeMode === 'auto' ? '#fff' : '#555' }}>
            🚀 Auto Round-Robin
          </button>
          <button onClick={() => setActiveMode('manual')} style={{ ...S.modeBtn, background: activeMode === 'manual' ? '#1F4E79' : 'transparent', color: activeMode === 'manual' ? '#fff' : '#555' }}>
            🔎 Manual Search
          </button>
        </div>

        {/* ── AUTO ROUND-ROBIN MODE ── */}
        {activeMode === 'auto' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Cities section */}
            <div>
              <div style={S.sectionLabel}>🌆 Cities to Search</div>
              {/* Quick market toggles */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {QUICK_MARKETS.map(m => (
                  <button
                    key={m}
                    onClick={() => toggleQuickMarket(m)}
                    style={{
                      ...S.quickBtn,
                      background: selectedCities.includes(m) ? '#1F4E79' : '#F5F5F5',
                      color: selectedCities.includes(m) ? '#fff' : '#555',
                      borderColor: selectedCities.includes(m) ? '#1F4E79' : '#DDD',
                    }}
                  >{m}</button>
                ))}
              </div>
              {/* Custom city input */}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={cityInput}
                  onChange={e => setCityInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCity(cityInput)}
                  placeholder="Add custom city (e.g. Dallas, TX)"
                  style={{ ...S.textInput, flex: 1 }}
                />
                <button onClick={() => addCity(cityInput)} style={S.addBtn}>+ Add</button>
              </div>
              {/* Selected city pills */}
              {selectedCities.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {selectedCities.map(c => (
                    <span key={c} style={S.pill}>
                      {c}
                      <button onClick={() => removeCity(c)} style={S.pillX}>×</button>
                    </span>
                  ))}
                  {selectedCities.length > 1 && (
                    <button onClick={() => setSelectedCities([])} style={{ ...S.quickBtn, color: '#D44A4A', borderColor: '#D44A4A', background: '#FEF0F0' }}>Clear All</button>
                  )}
                </div>
              )}
            </div>

            {/* Keywords + count */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={S.fieldLabel}>Keywords</label>
                <input
                  value={autoKeywords}
                  onChange={e => setAutoKeywords(e.target.value)}
                  style={S.textInput}
                  placeholder="sales commission cold calling..."
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
                <label style={S.fieldLabel}>Leads Per Agent</label>
                <select value={autoCountPerAgent} onChange={e => setAutoCountPerAgent(Number(e.target.value))} style={S.selectInput}>
                  {[10, 15, 20, 25, 30, 40, 50].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            {/* Agents */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={S.fieldLabel}>Agents to distribute to</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setAutoAgentNames(agents.map(a => a.name))} style={{ ...S.quickBtn, fontSize: 11 }}>All</button>
                  <button onClick={() => setAutoAgentNames([])} style={{ ...S.quickBtn, fontSize: 11 }}>None</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {agents.map(a => (
                  <button
                    key={a.name}
                    onClick={() => toggleAgent(a.name)}
                    style={{
                      ...S.quickBtn,
                      background: autoAgentNames.includes(a.name) ? '#2D9B5E' : '#F5F5F5',
                      color: autoAgentNames.includes(a.name) ? '#fff' : '#555',
                      borderColor: autoAgentNames.includes(a.name) ? '#2D9B5E' : '#DDD',
                    }}
                  >{a.name}</button>
                ))}
              </div>
            </div>

            {/* Run button */}
            <button
              onClick={handleAutoRun}
              disabled={autoRunning || !selectedCities.length || !autoAgentNames.length}
              style={{ ...S.searchBtn, padding: '12px', fontSize: 14, opacity: (autoRunning || !selectedCities.length || !autoAgentNames.length) ? 0.5 : 1 }}
            >
              {autoRunning
                ? `⏳ Searching ${selectedCities.length} cities...`
                : `🚀 Distribute to ${autoAgentNames.length} agent${autoAgentNames.length !== 1 ? 's' : ''} across ${selectedCities.length} city${selectedCities.length !== 1 ? 'ies' : ''}`}
            </button>

            {/* Auto result */}
            {autoResult && (
              <div style={{ background: autoResult.success ? '#E8F7EF' : '#FEF0F0', borderRadius: 8, padding: '14px 16px', fontSize: 13 }}>
                {autoResult.success ? (
                  <>
                    <div style={{ fontWeight: 800, color: '#1E7A46', marginBottom: 8 }}>
                      ✅ {autoResult.totalAssigned} leads distributed across {autoAgentNames.length} agents
                    </div>
                    {autoResult.perCity?.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, color: '#444', marginBottom: 4 }}>Per-city breakdown:</div>
                        {autoResult.perCity.map(c => (
                          <div key={c.city} style={{ fontSize: 12, color: '#555' }}>• {c.city}: {c.fresh} fresh ({c.found} found)</div>
                        ))}
                      </div>
                    )}
                    {autoResult.summary?.length > 0 && (
                      <div>
                        <div style={{ fontWeight: 700, color: '#444', marginBottom: 4 }}>Per-agent:</div>
                        {autoResult.summary.map(s => (
                          <div key={s.agent} style={{ fontSize: 12, color: '#555' }}>• {s.agent}: {s.assigned} leads{s.note ? ` (${s.note})` : ''}</div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ color: '#D44A4A', fontWeight: 700 }}>❌ {autoResult.message || 'No fresh leads found. Try different cities or keywords.'}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── MANUAL SEARCH MODE ── */}
        {activeMode === 'manual' && (
          <>
            {/* Search controls */}
            <div style={S.searchRow}>
              <div style={S.fieldWrap}>
                <label style={S.fieldLabel}>City *</label>
                <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} style={S.selectInput}>
                  <option value="">— Select city —</option>
                  {cities.map(c => (
                    <option key={c.slug} value={c.slug}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ ...S.fieldWrap, flex: 2 }}>
                <label style={S.fieldLabel}>Keywords</label>
                <input
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  style={S.textInput}
                  placeholder="sales commission cold calling..."
                />
              </div>
              <div style={S.fieldWrap}>
                <label style={S.fieldLabel}>Limit</label>
                <select value={limit} onChange={e => setLimit(Number(e.target.value))} style={S.selectInput}>
                  {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <button onClick={handleSearch} disabled={searching} style={S.searchBtn}>
                {searching ? 'Searching...' : '🔍 Search'}
              </button>
            </div>

            {error && <div style={S.errorMsg}>{error}</div>}

            {/* Results table */}
            {results.length > 0 && (
              <>
                <div style={S.resultsHeader}>
                  <span style={S.resultsCount}>{results.length} results from {cities.find(c => c.slug === selectedCity)?.label || selectedCity}</span>
                  <button onClick={selectAll} style={S.selectAllBtn}>
                    {selected.size === results.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div style={S.tableWrap}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}></th>
                        <th style={S.th}>Candidate</th>
                        <th style={S.th}>Phone</th>
                        <th style={S.th}>Email</th>
                        <th style={S.th}>Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, idx) => (
                        <tr key={idx} style={{ ...S.tr, background: selected.has(idx) ? '#EEF4FF' : 'transparent' }}>
                          <td style={S.td}>
                            <input type="checkbox" checked={selected.has(idx)} onChange={() => toggleSelect(idx)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                          </td>
                          <td style={{ ...S.td, maxWidth: 280 }}>
                            <div style={S.rTitle}>
                              {r.title}
                              {r.alreadyAssigned && (
                                <span style={{ marginLeft: 8, fontSize: 10, background: '#FEE2E2', color: '#991B1B', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                                  Already Assigned
                                </span>
                              )}
                            </div>
                            {r.description && <div style={S.rDesc}>{r.description.slice(0, 100)}{r.description.length > 100 ? '...' : ''}</div>}
                          </td>
                          <td style={S.td}>{r.phone ? <a href={`tel:${r.phone}`} style={S.telLink}>{r.phone}</a> : <span style={S.noData}>—</span>}</td>
                          <td style={S.td}>{r.email ? <span style={S.emailText}>{r.email}</span> : <span style={S.noData}>—</span>}</td>
                          <td style={S.td}>{r.link ? <a href={r.link} target="_blank" rel="noopener noreferrer" style={S.clLink}>View</a> : <span style={S.noData}>—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Assign bar */}
                <div style={S.assignBar}>
                  <div style={S.assignLeft}>
                    <span style={S.selectedCount}>{selected.size} selected</span>
                    <select value={targetAgent} onChange={e => setTargetAgent(e.target.value)} style={S.agentSelect}>
                      <option value="">— Select agent to assign —</option>
                      {agents.map(a => (
                        <option key={a.email || a.name} value={a.name}>
                          {a.name} ({a.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleAssign}
                    disabled={assigning || !selected.size || !targetAgent}
                    style={{ ...S.assignBtn, opacity: (!selected.size || !targetAgent) ? 0.5 : 1 }}
                  >
                    {assigning ? 'Assigning...' : `✅ Assign ${selected.size} to ${targetAgent || 'agent'}`}
                  </button>
                </div>

                {/* Assign result */}
                {assignResult && (
                  <div style={S.assignResult}>
                    ✅ <strong>{assignResult.assigned}</strong> leads assigned •{' '}
                    <span style={{ color: '#888' }}>{assignResult.skipped} skipped (already in system)</span>
                  </div>
                )}
              </>
            )}

            {results.length === 0 && !searching && !error && (
              <div style={S.emptyState}>
                Search Craigslist above to find resume leads, then assign them to a specific agent.
                <br />All assigned leads are permanently registered to prevent duplicates.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const S = {
  overlay:        { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16 },
  toast:          { position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', padding: '12px 24px', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, zIndex: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', maxWidth: '90vw', textAlign: 'center' },
  modal:          { background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 820, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', gap: 16 },
  modalHeader:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  modalTitle:     { fontSize: 20, fontWeight: 800, color: '#1A1A1A' },
  modalSub:       { fontSize: 13, color: '#666', marginTop: 4 },
  closeBtn:       { background: '#F5F5F5', border: 'none', borderRadius: 8, width: 36, height: 36, fontSize: 16, cursor: 'pointer', color: '#555', flexShrink: 0 },
  modeBtn:        { flex: 1, padding: '8px 14px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  sectionLabel:   { fontSize: 13, fontWeight: 800, color: '#1A1A1A', marginBottom: 8, letterSpacing: '0.02em' },
  fieldLabel:     { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' },
  quickBtn:       { padding: '5px 12px', borderRadius: 6, border: '1px solid #DDD', background: '#F5F5F5', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  addBtn:         { padding: '8px 16px', background: '#1F4E79', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  pill:           { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#E8EFF8', color: '#1F4E79', padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  pillX:          { background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 14, lineHeight: 1, padding: 0, fontFamily: 'inherit' },
  searchRow:      { display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' },
  fieldWrap:      { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  selectInput:    { padding: '9px 12px', borderRadius: 6, border: '1px solid #DDD', fontSize: 13, fontFamily: 'inherit', background: '#fff', height: 38 },
  textInput:      { padding: '9px 12px', borderRadius: 6, border: '1px solid #DDD', fontSize: 13, fontFamily: 'inherit', height: 38, width: '100%', boxSizing: 'border-box' },
  searchBtn:      { padding: '0 20px', background: 'linear-gradient(135deg, #1F4E79, #2D9B5E)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', height: 38, alignSelf: 'flex-end', flexShrink: 0 },
  errorMsg:       { color: '#D44A4A', fontSize: 13, padding: '10px 14px', background: '#FEF0F0', borderRadius: 8 },
  resultsHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  resultsCount:   { fontSize: 13, fontWeight: 700, color: '#555' },
  selectAllBtn:   { padding: '6px 14px', background: '#F0F0F0', border: '1px solid #DDD', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  tableWrap:      { overflowX: 'auto', maxHeight: 320, overflowY: 'auto', borderRadius: 8, border: '1px solid #EEE' },
  table:          { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th:             { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', background: '#FAFAFA', position: 'sticky', top: 0, borderBottom: '2px solid #EEE' },
  tr:             { borderBottom: '1px solid #F5F5F5', cursor: 'pointer' },
  td:             { padding: '10px 12px', verticalAlign: 'top' },
  rTitle:         { fontSize: 13, fontWeight: 700, color: '#1A1A1A', marginBottom: 2 },
  rDesc:          { fontSize: 11, color: '#888', lineHeight: 1.4 },
  telLink:        { color: '#1F4E79', textDecoration: 'none', fontWeight: 700, fontSize: 13 },
  emailText:      { color: '#555', fontSize: 12 },
  clLink:         { color: '#1F4E79', textDecoration: 'underline', fontSize: 12 },
  noData:         { color: '#CCC', fontSize: 12 },
  assignBar:      { display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px', background: '#F8FAFF', borderRadius: 10, border: '1px solid #DDE6F5', flexWrap: 'wrap' },
  assignLeft:     { display: 'flex', gap: 10, alignItems: 'center', flex: 1 },
  selectedCount:  { fontSize: 13, fontWeight: 700, color: '#1F4E79', whiteSpace: 'nowrap' },
  agentSelect:    { padding: '8px 12px', borderRadius: 6, border: '1px solid #DDD', fontSize: 13, fontFamily: 'inherit', flex: 1, minWidth: 180 },
  assignBtn:      { padding: '10px 20px', background: 'linear-gradient(135deg, #1F4E79, #2D9B5E)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s', whiteSpace: 'nowrap' },
  assignResult:   { padding: '12px 16px', background: '#E8F7EF', borderRadius: 8, fontSize: 13, color: '#1E7A46' },
  emptyState:     { textAlign: 'center', padding: '40px 20px', color: '#888', fontSize: 14, lineHeight: 2 },
};
