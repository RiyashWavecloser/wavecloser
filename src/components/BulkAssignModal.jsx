/**
 * src/components/BulkAssignModal.jsx
 *
 * Admin-only modal for manual Craigslist search + bulk-assign to a specific agent.
 *
 * Flow:
 * 1. Admin picks a city from the dropdown (list loaded from server \u2014 not hardcoded)
 * 2. Admin enters keywords
 * 3. "Search Craigslist" \u2014 shows live results table with checkboxes
 * 4. Admin selects results, picks target agent from dropdown
 * 5. "Assign Selected" \u2014 bulk-assigns with dedup check, registers in registry
 */

import React, { useState, useEffect } from 'react';
import {
  fetchAvailableCities,
  fetchRecruitingAgents,
  searchCraigslistResumesAPI,
  bulkAssignResumeLeadsAPI,
} from '../lib/dataLayer.js';

export default function BulkAssignModal({ onClose }) {
  const [cities,      setCities]      = useState([]);
  const [agents,      setAgents]      = useState([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [keywords,    setKeywords]    = useState('sales');
  const [limit,       setLimit]       = useState(50);
  const [results,     setResults]     = useState([]);
  const [selected,    setSelected]    = useState(new Set());
  const [targetAgent, setTargetAgent] = useState('');
  const [searching,   setSearching]   = useState(false);
  const [assigning,   setAssigning]   = useState(false);
  const [assignResult, setAssignResult] = useState(null);
  const [error,       setError]       = useState(null);
  const [toast,       setToast]       = useState(null);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    Promise.all([fetchAvailableCities(), fetchRecruitingAgents()]).then(([c, a]) => {
      setCities(c);
      setAgents(a);
    });
  }, []);

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
      showToast(`✅ ${result.assigned} leads assigned to ${targetAgent}! (${result.skipped} skipped \u2014 already in system)`, 'success');
      setSelected(new Set());
    }
  };

  const selectedCityLabel = cities.find(c => c.slug === selectedCity)?.label || '';

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
            <div style={S.modalTitle}>🔍 Search & Bulk Assign Resume Leads</div>
            <div style={S.modalSub}>Search Craigslist, select candidates, assign to a recruiting agent</div>
          </div>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>

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
              <span style={S.resultsCount}>{results.length} results from {selectedCityLabel}</span>
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
                        <input
                          type="checkbox"
                          checked={selected.has(idx)}
                          onChange={() => toggleSelect(idx)}
                          style={{ width: 16, height: 16, cursor: 'pointer' }}
                        />
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
                      <td style={S.td}>
                        {r.phone ? <a href={`tel:${r.phone}`} style={S.telLink}>{r.phone}</a> : <span style={S.noData}>—</span>}
                      </td>
                      <td style={S.td}>
                        {r.email ? <span style={S.emailText}>{r.email}</span> : <span style={S.noData}>—</span>}
                      </td>
                      <td style={S.td}>
                        {r.link ? <a href={r.link} target="_blank" rel="noopener noreferrer" style={S.clLink}>View</a> : <span style={S.noData}>—</span>}
                      </td>
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
      </div>
    </div>
  );
}

const S = {
  overlay:        { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16 },
  toast:          { position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', padding: '12px 24px', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, zIndex: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', maxWidth: '90vw', textAlign: 'center' },
  modal:          { background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', gap: 16 },
  modalHeader:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  modalTitle:     { fontSize: 20, fontWeight: 800, color: '#1A1A1A' },
  modalSub:       { fontSize: 13, color: '#666', marginTop: 4 },
  closeBtn:       { background: '#F5F5F5', border: 'none', borderRadius: 8, width: 36, height: 36, fontSize: 16, cursor: 'pointer', color: '#555', flexShrink: 0 },
  searchRow:      { display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' },
  fieldWrap:      { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  fieldLabel:     { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' },
  selectInput:    { padding: '9px 12px', borderRadius: 6, border: '1px solid #DDD', fontSize: 13, fontFamily: 'inherit', background: '#fff', height: 38 },
  textInput:      { padding: '9px 12px', borderRadius: 6, border: '1px solid #DDD', fontSize: 13, fontFamily: 'inherit', height: 38, width: '100%', boxSizing: 'border-box' },
  searchBtn:      { padding: '0 20px', background: 'linear-gradient(135deg, #1F4E79, #2D9B5E)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', height: 38, alignSelf: 'flex-end', flexShrink: 0 },
  errorMsg:       { color: '#D44A4A', fontSize: 13, padding: '10px 14px', background: '#FEF0F0', borderRadius: 8 },
  resultsHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  resultsCount:   { fontSize: 13, fontWeight: 700, color: '#555' },
  selectAllBtn:   { padding: '6px 14px', background: '#F0F0F0', border: '1px solid #DDD', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  tableWrap:      { overflowX: 'auto', maxHeight: 360, overflowY: 'auto', borderRadius: 8, border: '1px solid #EEE' },
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
