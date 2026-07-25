/**
 * src/components/ResumePerformanceTab.jsx
 *
 * Admin/Recruiter-only tab inside RecruiterPortal.
 * Shows:
 *  - Totals row (Assigned, Contacted, Interested, Rate)
 *  - Per-agent breakdown table with status indicators
 *  - Per-market breakdown
 *  - Deduplication registry stats
 *  - [Run Distribution Now] button (opens modal to pick cities)
 *  - [Export CSV] button
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchResumeLeadStats,
  fetchDedupStats,
  bulkAssignResumes,
} from '../lib/dataLayer.js';
import { RECRUITING_AGENTS } from '../data/constants.js';

function agentStatusIcon(a) {
  if (a.contacted >= 10) return '✅';
  if (a.contacted >= 1)  return '⚠️';
  return '🔴';
}

export default function ResumePerformanceTab({ currentUser }) {
  const [stats,   setStats]   = useState(null);
  const [dedup,   setDedup]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Filters — default to empty string for "All Dates" so all records show immediately
  const [dateFilter,   setDateFilter]   = useState('');
  const [marketFilter, setMarketFilter] = useState('');
  const [agentFilter,  setAgentFilter]  = useState('');

  // Bulk Assign Modal state
  const [showDistModal, setShowDistModal] = useState(false);
  const [city,         setCity]         = useState('New York, NY');
  const [keywords,     setKeywords]     = useState('sales commission cold calling payment processing');
  const [countPerAgent,setCountPerAgent]= useState(20);
  const [selectedAgents, setSelectedAgents] = useState(
    RECRUITING_AGENTS.map(a => a.name) // all selected by default
  );
  const [assigning,    setAssigning]    = useState(false);
  const [assignResult, setAssignResult] = useState(null);
  const [toast,         setToast]         = useState(null);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [s, d] = await Promise.all([
      fetchResumeLeadStats({ date: dateFilter, market: marketFilter, agent: agentFilter }),
      fetchDedupStats(),
    ]);
    setStats(s);
    setDedup(d);
    setLoading(false);
  }, [dateFilter, marketFilter, agentFilter]);

  useEffect(() => { load(); }, [load]);

  function toggleAgent(name) {
    setSelectedAgents(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  }

  function toggleAll() {
    if (selectedAgents.length === RECRUITING_AGENTS.length) {
      setSelectedAgents([]); // deselect all
    } else {
      setSelectedAgents(RECRUITING_AGENTS.map(a => a.name)); // select all
    }
  }

  async function handleBulkAssign() {
    if (selectedAgents.length === 0) {
      alert('Please select at least one agent');
      return;
    }
    if (!city.trim()) {
      alert('Please enter a city');
      return;
    }

    setAssigning(true);
    setAssignResult(null);

    try {
      const result = await bulkAssignResumes({
        city:          city.trim(),
        keywords:      keywords.trim(),
        agentNames:    selectedAgents,
        countPerAgent: Math.min(100, Math.max(1, countPerAgent)),
      });
      setAssignResult(result);
      if (result.success) {
        showToast(`✅ ${result.totalAssigned} resumes assigned!`, 'success');
        setTimeout(() => load(), 3000); // refresh stats after a few seconds
      } else {
        showToast(`⚠ ${result.message || 'Assignment failed'}`, 'error');
      }
    } catch (e) {
      setAssignResult({ success: false, message: e.message });
      showToast(`⚠ ${e.message}`, 'error');
    }

    setAssigning(false);
  }

  const exportCSV = () => {
    if (!stats?.agents?.length) return;
    const rows = [['Agent', 'Assigned', 'Contacted', 'Interested', 'Rate', 'Status']];
    stats.agents.forEach(a => rows.push([a.agent, a.assigned, a.contacted, a.interested, `${a.rate}%`, agentStatusIcon(a)]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `resume-leads-${dateFilter || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };


  return (
    <div style={S.root}>
      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, background: toast.type === 'success' ? '#2D9B5E' : toast.type === 'error' ? '#D44A4A' : '#5B8DEF' }}>
          {toast.msg}
        </div>
      )}

      {/* Filters + actions toolbar */}
      <div style={S.toolbar}>
        <div style={S.filterGroup}>
          <label style={S.filterLabel}>Date</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={S.filterInput} />
            {dateFilter && (
              <button onClick={() => setDateFilter('')} style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #DDD', cursor: 'pointer', background: '#fff' }}>
                Clear (All Time)
              </button>
            )}
          </div>
        </div>
        <div style={S.filterGroup}>
          <label style={S.filterLabel}>Agent</label>
          <input placeholder="All agents" value={agentFilter} onChange={e => setAgentFilter(e.target.value)} style={S.filterInput} />
        </div>
        <div style={S.filterGroup}>
          <label style={S.filterLabel}>Market</label>
          <input placeholder="All markets" value={marketFilter} onChange={e => setMarketFilter(e.target.value)} style={S.filterInput} />
        </div>
        <button onClick={load} style={S.refreshBtn}>🔄 Refresh</button>
        <button onClick={() => setShowDistModal(true)} style={S.distBtn}>⚡ Run Distribution Now</button>
        <button onClick={exportCSV} style={S.exportBtn}>↓ Export CSV</button>
      </div>

      {loading ? (
        <div style={S.loading}>Loading performance data...</div>
      ) : error ? (
        <div style={S.errorMsg}>{error}</div>
      ) : (
        <>
          {/* Totals row */}
          <div style={S.totalsRow}>
            {[
              { label: 'Assigned',   val: stats?.totals?.assigned   ?? 0, color: '#1F4E79' },
              { label: 'Contacted',  val: stats?.totals?.contacted  ?? 0, color: '#92600A' },
              { label: 'Interested', val: stats?.totals?.interested ?? 0, color: '#1E7A46' },
              { label: 'Success Rate', val: `${stats?.totals?.rate ?? '0.0'}%`, color: '#7C3AED' },
            ].map(t => (
              <div key={t.label} style={S.totalCard}>
                <div style={{ ...S.totalNum, color: t.color }}>{t.val}</div>
                <div style={S.totalLabel}>{t.label}</div>
              </div>
            ))}
          </div>

          {/* Dedup stats */}
          <div style={S.dedupRow}>
            <span style={S.dedupLabel}>🔒 Permanently locked URLs in system:</span>
            <span style={S.dedupNum}>{dedup?.totalLocked?.toLocaleString() ?? '—'}</span>
          </div>

          {/* Per-agent table */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Per-Agent Breakdown</div>
            {!stats?.agents?.length ? (
              <div style={S.emptyMsg}>No data found matching current filters.</div>
            ) : (
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      {['', 'Agent', 'Assigned', 'Contacted', 'Interested', 'Rate'].map(h => (
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.agents.map(a => (
                      <tr key={a.agent} style={S.tr}>
                        <td style={S.td}>{agentStatusIcon(a)}</td>
                        <td style={{ ...S.td, fontWeight: 700 }}>{a.agent}</td>
                        <td style={S.td}>{a.assigned}</td>
                        <td style={S.td}>{a.contacted}</td>
                        <td style={{ ...S.td, color: '#1E7A46', fontWeight: 700 }}>{a.interested}</td>
                        <td style={{ ...S.td, color: '#7C3AED', fontWeight: 700 }}>{a.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Per-market breakdown */}
          {stats?.markets?.length > 0 && (
            <div style={S.section}>
              <div style={S.sectionTitle}>By Market</div>
              <div style={S.marketGrid}>
                {stats.markets.map(m => (
                  <div key={m.market} style={S.marketCard}>
                    <div style={S.marketName}>{m.market}</div>
                    <div style={S.marketStats}>{m.assigned} leads → <span style={{ color: '#1E7A46', fontWeight: 700 }}>{m.interested} interested</span></div>
                    <div style={S.marketRate}>{m.assigned > 0 ? ((m.interested / m.assigned) * 100).toFixed(1) : '0.0'}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Resume Leads Table */}
          <div style={S.section}>
            <div style={S.sectionTitle}>📋 Assigned Craigslist Resumes ({stats?.leadDetails?.length || 0})</div>
            {!stats?.leadDetails?.length ? (
              <div style={S.emptyMsg}>No Craigslist resume leads assigned yet. Click "⚡ Run Distribution Now" or use "🔍 Bulk Assign Resumes" to fetch candidates.</div>
            ) : (
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Candidate / Resume Title</th>
                      <th style={S.th}>Phone</th>
                      <th style={S.th}>Email</th>
                      <th style={S.th}>Assigned To</th>
                      <th style={S.th}>Market</th>
                      <th style={S.th}>Status</th>
                      <th style={S.th}>Date</th>
                      <th style={S.th}>Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.leadDetails.map((lead, idx) => (
                      <tr key={lead.id || idx} style={S.tr}>
                        <td style={{ ...S.td, maxWidth: 300 }}>
                          <div style={{ fontWeight: 700, color: '#1F4E79' }}>{lead.title || 'Craigslist Resume Lead'}</div>
                          {lead.description && <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{lead.description.slice(0, 90)}{lead.description.length > 90 ? '...' : ''}</div>}
                        </td>
                        <td style={S.td}>
                          {lead.phone ? <a href={`tel:${lead.phone}`} style={{ color: '#1F4E79', fontWeight: 600, textDecoration: 'none' }}>{lead.phone}</a> : <span style={{ color: '#AAA' }}>—</span>}
                        </td>
                        <td style={S.td}>
                          {lead.email ? <span style={{ fontSize: 12, color: '#333' }}>{lead.email}</span> : <span style={{ color: '#AAA' }}>—</span>}
                        </td>
                        <td style={{ ...S.td, fontWeight: 700 }}>{lead.assignedTo}</td>
                        <td style={S.td}>{lead.market}</td>
                        <td style={S.td}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            background: lead.status === 'Interested' ? '#E8F7EF' : lead.status === 'NotInterested' ? '#FDEBEB' : '#F4F5F7',
                            color: lead.status === 'Interested' ? '#1E7A46' : lead.status === 'NotInterested' ? '#D44A4A' : '#555'
                          }}>
                            {lead.status}
                          </span>
                        </td>
                        <td style={{ ...S.td, fontSize: 12, color: '#777' }}>{lead.assignedDate}</td>
                        <td style={S.td}>
                          {lead.craigslistUrl ? (
                            <a href={lead.craigslistUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#5B8DEF', fontWeight: 600, textDecoration: 'none' }}>View</a>
                          ) : (
                            <span style={{ color: '#AAA' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Distribution Modal */}
      {showDistModal && (
        <div style={S.overlay} onClick={() => setShowDistModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>⚡ Bulk Assign Resume Leads</div>
              <button onClick={() => setShowDistModal(false)} style={S.closeBtn}>✕</button>
            </div>

            {/* City input — free text, not dropdown */}
            <label style={S.label}>City / Location</label>
            <input
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="e.g. New York NY, Newark NJ, Miami FL, Chicago IL"
              style={S.input}
            />
            <div style={S.hint}>Type any US city — the system will match the Craigslist region automatically</div>

            {/* Keywords */}
            <label style={S.label}>Search Keywords</label>
            <input
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              placeholder="sales commission cold calling..."
              style={S.input}
            />

            {/* Count per agent */}
            <label style={S.label}>Leads per agent</label>
            <input
              type="number"
              value={countPerAgent}
              onChange={e => setCountPerAgent(parseInt(e.target.value) || 20)}
              min={1}
              max={100}
              style={{ ...S.input, width: 80 }}
            />

            {/* Agent selection */}
            <label style={S.label}>Assign to:</label>
            <div style={S.agentList}>
              <label style={S.agentRow}>
                <input
                  type="checkbox"
                  checked={selectedAgents.length === RECRUITING_AGENTS.length}
                  onChange={toggleAll}
                />
                <strong>Select All / Deselect All</strong>
              </label>
              {RECRUITING_AGENTS.map(agent => (
                <label key={agent.name} style={S.agentRow}>
                  <input
                    type="checkbox"
                    checked={selectedAgents.includes(agent.name)}
                    onChange={() => toggleAgent(agent.name)}
                  />
                  <span style={S.agentName}>{agent.name}</span>
                  <span style={S.agentEmail}>{agent.email}</span>
                </label>
              ))}
            </div>

            {/* Assign button */}
            <button
              onClick={handleBulkAssign}
              disabled={assigning || selectedAgents.length === 0}
              style={S.primaryBtn}
            >
              {assigning ? '⟳ Fetching and assigning...' : `⚡ Bulk Assign Resumes → (${selectedAgents.length} agents)`}
            </button>

            {/* Result display */}
            {assigning && (
              <div style={S.progress}>
                Fetching resumes from Craigslist for "{city}"...
              </div>
            )}

            {assignResult && (
              <div style={assignResult.success ? S.successBox : S.errorBox}>
                {assignResult.success ? (
                  <>
                    <div>✅ Done — {assignResult.totalAssigned} resumes assigned across {selectedAgents.length} agents</div>
                    <div style={S.subtext}>Found {assignResult.totalFound} total — {assignResult.freshFound} were fresh (not previously assigned)</div>
                    {assignResult.summary?.map(s => (
                      <div key={s.agent} style={S.summaryRow}>
                        {s.assigned > 0 ? '✓' : '⚠'} {s.agent} — {s.assigned} assigned {s.note ? `(${s.note})` : ''}
                      </div>
                    ))}
                  </>
                ) : (
                  <div>⚠ {assignResult.message || 'Assignment failed — check server logs'}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  root:           { padding: '20px', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  toast:          { position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', padding: '12px 24px', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, zIndex: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', maxWidth: '90vw', textAlign: 'center' },
  toolbar:        { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 },
  filterGroup:    { display: 'flex', flexDirection: 'column', gap: 4 },
  filterLabel:    { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' },
  filterInput:    { padding: '8px 12px', borderRadius: 6, border: '1px solid #DDD', fontSize: 13, fontFamily: 'inherit', background: '#fff', height: 36 },
  refreshBtn:     { padding: '8px 16px', background: '#F5F5F5', border: '1px solid #DDD', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', height: 36, alignSelf: 'flex-end' },
  distBtn:        { padding: '8px 16px', background: 'linear-gradient(135deg, #1F4E79, #2D9B5E)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', height: 36, alignSelf: 'flex-end' },
  exportBtn:      { padding: '8px 16px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', height: 36, alignSelf: 'flex-end' },
  loading:        { textAlign: 'center', padding: 40, color: '#888', fontSize: 14 },
  errorMsg:       { textAlign: 'center', padding: 20, color: '#D44A4A', fontSize: 13 },
  emptyMsg:       { color: '#888', fontSize: 13, fontStyle: 'italic', padding: '12px 0' },
  totalsRow:      { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 },
  totalCard:      { background: '#fff', borderRadius: 10, padding: 16, textAlign: 'center', border: '1px solid #EBE6DC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  totalNum:       { fontSize: 28, fontWeight: 800, lineHeight: 1 },
  totalLabel:     { fontSize: 11, color: '#888', fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' },
  dedupRow:       { display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px', background: '#1A1A2E', borderRadius: 10, marginBottom: 20 },
  dedupLabel:     { color: '#9BA4B5', fontSize: 13, fontWeight: 600 },
  dedupNum:       { color: '#E2E8F0', fontSize: 18, fontWeight: 800 },
  section:        { background: '#fff', borderRadius: 10, padding: 20, border: '1px solid #EBE6DC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: 16 },
  sectionTitle:   { fontSize: 13, fontWeight: 800, color: '#1F4E79', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 },
  tableWrap:      { overflowX: 'auto' },
  table:          { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:             { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #EBE6DC' },
  tr:             { borderBottom: '1px solid #F5F5F5' },
  td:             { padding: '12px 12px', fontSize: 13, color: '#333' },
  marketGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 },
  marketCard:     { background: '#F8FAFF', borderRadius: 8, padding: '14px', border: '1px solid #E0E8F0' },
  marketName:     { fontSize: 13, fontWeight: 700, color: '#1F4E79', marginBottom: 4 },
  marketStats:    { fontSize: 12, color: '#555' },
  marketRate:     { fontSize: 20, fontWeight: 800, color: '#7C3AED', marginTop: 4 },
  overlay:        { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 },
  modal:          { background: '#fff', borderRadius: 16, padding: 28, maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: 16 },
  modalTitle:     { fontSize: 20, fontWeight: 800, color: '#1A1A1A' },
  modalSub:       { fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 1.5 },
  fieldLabel:     { display: 'block', fontSize: 12, fontWeight: 700, color: '#444', marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: '0.04em' },
  cityGrid:       { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  cityChip:       { padding: '7px 14px', borderRadius: 20, border: '1.5px solid #DDD', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#555', transition: 'all 0.15s', userSelect: 'none' },
  cityChipActive: { background: '#1F4E79', color: '#fff', borderColor: '#1F4E79' },
  textInput:      { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #DDD', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' },
  distResult:     { marginTop: 12, padding: '10px 14px', background: '#E8F7EF', borderRadius: 8, fontSize: 13, color: '#1E7A46', fontWeight: 600 },
  modalActions:   { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 },
  cancelBtn:      { padding: '10px 20px', background: '#F5F5F5', border: '1px solid #DDD', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  runBtn:         { padding: '10px 24px', background: 'linear-gradient(135deg, #1F4E79, #2D9B5E)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  
  modalHeader:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  closeBtn:       { background: '#F5F5F5', border: 'none', borderRadius: 8, width: 36, height: 36, fontSize: 16, cursor: 'pointer', color: '#555', flexShrink: 0 },
  label:          { display: 'block', fontSize: 12, fontWeight: 700, color: '#444', marginBottom: 2, marginTop: 12, textTransform: 'uppercase', letterSpacing: '0.04em' },
  input:          { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #DDD', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' },
  hint:           { fontSize: 11, color: '#888', marginTop: 2 },
  agentList:      { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', border: '1px solid #DDD', borderRadius: 8, padding: 12 },
  agentRow:       { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#333', cursor: 'pointer' },
  agentName:      { fontWeight: 600, minWidth: 100 },
  agentEmail:     { color: '#888', fontSize: 12 },
  primaryBtn:     { padding: '12px 24px', background: 'linear-gradient(135deg, #1F4E79, #2D9B5E)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 14 },
  progress:       { marginTop: 12, fontSize: 13, color: '#666', fontStyle: 'italic' },
  successBox:     { marginTop: 16, padding: '14px', background: '#E8F7EF', border: '1px solid #BCE5CE', borderRadius: 8, fontSize: 13, color: '#1E7A46' },
  errorBox:       { marginTop: 16, padding: '14px', background: '#FDEBEB', border: '1px solid #F3C6C6', borderRadius: 8, fontSize: 13, color: '#D44A4A' },
  subtext:        { fontSize: 11, color: '#666', marginTop: 4 },
  summaryRow:     { fontSize: 12, marginTop: 4 },
};
