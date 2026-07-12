/**
 * src/modules/RecruiterPortal.jsx
 * Workflow B -- Recruiting / Salesperson Onboarding pipeline.
 *
 * Tabs:
 *   1. My Recruiting Pipeline -- step-by-step status flow, edit/delete per recruit
 *   2. Search Craigslist Resumes -- find candidates via Apify or RSS fallback
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PageHeader, Card, CardHeader, Note } from '../components/ui.jsx';
import {
  RECRUIT_STATUSES, RECRUIT_STAGES, RECRUIT_SOURCES, RECRUIT_TYPES, ONBOARDING_STAGES,
} from '../data/constants.js';
import {
  getRecruitingPipelineAPI,
  addRecruitAPI,
  updateRecruitStatusAPI,
  updateRecruitAPI,
  deleteRecruitAPI,
  searchCraigslistResumesAPI,
} from '../lib/dataLayer.js';
import EmptyState from '../components/EmptyState.jsx';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  New:        { bg: '#F0F5FF', color: '#1F4E79' },
  Contacted:  { bg: '#FBF3DC', color: '#8A5A1A' },
  Interested: { bg: '#EDF7F1', color: '#1D7A48' },
  Onboarding: { bg: '#F3EDFD', color: '#5B2DA8' },
  Active:     { bg: '#E8F7EC', color: '#1A5C32' },
  Declined:   { bg: '#FDF0F0', color: '#882222' },
};

const BLANK_FORM = {
  name: '', email: '', phone: '', source: 'LinkedIn', type: 'Independent Rep', notes: '',
};

const CRAIGSLIST_CITIES = [
  { label: 'New York',        value: 'newyork' },
  { label: 'New Jersey',      value: 'newjersey' },
  { label: 'Connecticut',     value: 'newhaven' },
  { label: 'Brooklyn',        value: 'brooklyn' },
  { label: 'Queens',          value: 'queens' },
  { label: 'Bronx',           value: 'bronx' },
  { label: 'Staten Island',   value: 'statenisland' },
  { label: 'Newark NJ',       value: 'newark' },
  { label: 'Jersey City NJ',  value: 'jerseycity' },
  { label: 'Bridgeport CT',   value: 'bridgeport' },
  { label: 'Hartford CT',     value: 'hartford' },
  { label: 'Stamford CT',     value: 'stamford' },
];

const DEFAULT_KEYWORDS = 'sales, commission, cold calling, payment processing, B2B sales';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStepIndex(status) {
  // Returns 0-based index in RECRUIT_STAGES, or -1 if Declined/unknown
  return RECRUIT_STAGES.findIndex(s => s.status === status);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 3600)   return 'just now';
    if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 172800) return 'yesterday';
    return `${Math.floor(diff / 86400)} days ago`;
  } catch { return dateStr; }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RecruiterPortal({ currentUser }) {
  const recruiterName = currentUser?.name || 'Recruiter';

  // Tab state
  const [activeTab, setActiveTab] = useState('pipeline');

  // Pipeline state
  const [recruits,      setRecruits]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [toast,         setToast]         = useState(null);
  const [filterStatus,  setFilterStatus]  = useState('All');
  const [filterType,    setFilterType]    = useState('All');
  const [showForm,      setShowForm]      = useState(false);
  const [form,          setForm]          = useState(BLANK_FORM);
  const [submitting,    setSubmitting]    = useState(false);
  const [selected,      setSelected]      = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Edit state (inside detail panel)
  const [editMode,    setEditMode]    = useState(false);
  const [editForm,    setEditForm]    = useState(BLANK_FORM);
  const [editSaving,  setEditSaving]  = useState(false);

  // Delete state
  const [deleteTarget,   setDeleteTarget]   = useState(null); // recruit to delete
  const [deleteConfirm,  setDeleteConfirm]  = useState(false);
  const [deleting,       setDeleting]       = useState(false);

  // Row action menu state
  const [openMenu, setOpenMenu] = useState(null); // recruit id or null
  const menuRef = useRef(null);

  // Craigslist state
  const [clCity,     setClCity]     = useState('newyork');
  const [clKeywords, setClKeywords] = useState(DEFAULT_KEYWORDS);
  const [clResults,  setClResults]  = useState([]);
  const [clSearched, setClSearched] = useState(false);
  const [clLoading,  setClLoading]  = useState(false);
  const [clDemo,     setClDemo]     = useState(false);
  const [clAdding,   setClAdding]   = useState({});
  const [clAdded,    setClAdded]    = useState({});

  // ─── Close menu on outside click ────────────────────────────────────────────
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ─── Toast helper ────────────────────────────────────────────────────────────
  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  }

  // ─── Pipeline load ───────────────────────────────────────────────────────────
  const loadPipeline = useCallback(async () => {
    setLoading(true);
    setError('');
    const data = await getRecruitingPipelineAPI();
    if (data && Array.isArray(data)) {
      setRecruits(data);
    } else {
      setError('Could not load pipeline. Backend may be offline.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPipeline(); }, [loadPipeline]);

  // ─── Add recruit ─────────────────────────────────────────────────────────────
  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setSubmitting(true);
    const result = await addRecruitAPI({ ...form, addedBy: recruiterName });
    if (result?.duplicate) {
      showToast(`${form.email} is already in the pipeline (status: ${result.recruit?.status || 'existing'}).`, 'info');
    } else if (result && !result.demo && result.id) {
      setRecruits(prev => [result, ...prev]);
      showToast(`${form.name} added to pipeline!`);
      setForm(BLANK_FORM);
      setShowForm(false);
    } else if (result?.demo) {
      const local = { id: `LOCAL-${Date.now()}`, ...form, addedBy: recruiterName, status: 'New', addedAt: new Date().toISOString() };
      setRecruits(prev => [local, ...prev]);
      showToast(`${form.name} added (offline mode).`, 'info');
      setForm(BLANK_FORM);
      setShowForm(false);
    } else {
      showToast('Failed to add recruit. Check backend.', 'error');
    }
    setSubmitting(false);
  }

  // ─── Step-by-step status handlers ───────────────────────────────────────────
  async function moveToStatus(recruit, newStatus) {
    setStatusUpdating(true);
    const notes = recruit.notes || '';
    const res = await updateRecruitStatusAPI(recruit.id, newStatus, notes);
    const updated = { ...recruit, status: newStatus };
    setRecruits(prev => prev.map(r => r.id === recruit.id ? updated : r));
    setSelected(updated);
    if (newStatus === 'Onboarding') {
      showToast(`${recruit.name} moved to Onboarding! Mildred's queue notified.`);
    } else if (newStatus === 'Active') {
      showToast(`${recruit.name} is now Active! User record created in Users (Orca).`);
    } else if (newStatus === 'Declined') {
      showToast(`${recruit.name} marked as Declined.`, 'info');
    } else {
      showToast(`${recruit.name} moved to ${newStatus}.`);
    }
    setStatusUpdating(false);
    return res;
  }

  function handleStepForward(recruit) {
    const idx = getStepIndex(recruit.status);
    const next = RECRUIT_STAGES[idx + 1];
    if (!next) return;
    moveToStatus(recruit, next.status);
  }

  function handleStepBack(recruit) {
    const idx = getStepIndex(recruit.status);
    const prev = RECRUIT_STAGES[idx - 1];
    if (!prev) return;
    moveToStatus(recruit, prev.status);
  }

  // ─── Edit handlers ───────────────────────────────────────────────────────────
  function openEdit(recruit) {
    setEditForm({
      name:   recruit.name   || '',
      email:  recruit.email  || '',
      phone:  recruit.phone  || '',
      source: recruit.source || 'LinkedIn',
      type:   recruit.type   || 'Independent Rep',
      notes:  recruit.notes  || '',
    });
    setEditMode(true);
    setOpenMenu(null);
  }

  async function handleEditSave(e) {
    e.preventDefault();
    setEditSaving(true);
    const res = await updateRecruitAPI(selected.id, editForm);
    if (res?.updated) {
      const updated = { ...selected, ...editForm };
      setRecruits(prev => prev.map(r => r.id === selected.id ? updated : r));
      setSelected(updated);
      showToast(`${editForm.name} updated.`);
      setEditMode(false);
    } else {
      showToast('Failed to save changes.', 'error');
    }
    setEditSaving(false);
  }

  // ─── Delete handlers ─────────────────────────────────────────────────────────
  function confirmDelete(recruit) {
    setDeleteTarget(recruit);
    setDeleteConfirm(true);
    setOpenMenu(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await deleteRecruitAPI(deleteTarget.id);
    if (res?.deleted || res?.demo) {
      setRecruits(prev => prev.filter(r => r.id !== deleteTarget.id));
      if (selected?.id === deleteTarget.id) setSelected(null);
      showToast(`${deleteTarget.name} removed from pipeline.`, 'info');
    } else {
      showToast('Failed to delete. Try again.', 'error');
    }
    setDeleteTarget(null);
    setDeleteConfirm(false);
    setDeleting(false);
  }

  // ─── Craigslist handlers ─────────────────────────────────────────────────────
  async function handleCraigslistSearch(e) {
    e.preventDefault();
    setClLoading(true);
    setClSearched(false);
    setClResults([]);
    setClAdded({});
    setClAdding({});
    const data = await searchCraigslistResumesAPI(clCity, clKeywords);
    setClResults(data?.results || []);
    setClDemo(!!data?.demo);
    setClSearched(true);
    setClLoading(false);
  }

  async function handleAddFromCraigslist(result) {
    const key = result.link || result.title;
    setClAdding(prev => ({ ...prev, [key]: true }));
    const rawName = result.title.split(/[-,]/)[0].trim();
    const name    = rawName.length > 2 ? rawName : result.title.slice(0, 40);
    const recruitData = {
      name,
      email:   '',
      phone:   result.phone || '',
      source:  'Craigslist',
      type:    '',
      notes:   `${result.description || ''}${result.link ? '\n\nCraigslist post: ' + result.link : ''}`.trim().slice(0, 500),
      addedBy: recruiterName,
    };
    const res = await addRecruitAPI(recruitData);
    setClAdding(prev => ({ ...prev, [key]: false }));
    if (res?.duplicate) {
      showToast(`"${name}" is already in the pipeline.`, 'info');
      setClAdded(prev => ({ ...prev, [key]: true }));
    } else if (res && !res.demo && res.id) {
      setRecruits(prev => [res, ...prev]);
      setClAdded(prev => ({ ...prev, [key]: true }));
      showToast(`"${name}" added to pipeline!`);
    } else if (res?.demo) {
      const local = { id: `LOCAL-${Date.now()}`, ...recruitData, status: 'New', addedAt: new Date().toISOString() };
      setRecruits(prev => [local, ...prev]);
      setClAdded(prev => ({ ...prev, [key]: true }));
      showToast(`"${name}" added (offline mode).`, 'info');
    } else {
      showToast('Failed to add candidate.', 'error');
    }
  }

  // ─── Derived state ───────────────────────────────────────────────────────────
  const filtered = recruits.filter(r => {
    const matchStatus = filterStatus === 'All' || r.status === filterStatus;
    const matchType   = filterType   === 'All' || r.type   === filterType;
    return matchStatus && matchType;
  });

  const counts = RECRUIT_STATUSES.reduce((acc, s) => {
    acc[s] = recruits.filter(r => r.status === s).length;
    return acc;
  }, {});

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={S.wrap}>
      {/* Toast */}
      {toast && (
        <div style={{
          ...S.toast,
          background: toast.type === 'success' ? '#2D9B5E' : toast.type === 'error' ? '#D44A4A' : '#5B8DEF',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && deleteTarget && (
        <div style={S.overlay}>
          <div style={S.dialog}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
              Delete {deleteTarget.name}?
            </div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
              This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setDeleteConfirm(false); setDeleteTarget(null); }} style={S.outBtn}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting} style={S.dangerBtn}>
                {deleting ? 'Deleting...' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        title="Recruiting Portal"
        subtitle="Workflow B -- Find, manage, and onboard salespeople"
      />

      {/* Tabs */}
      <div style={S.tabBar}>
        <button
          id="tab-pipeline"
          onClick={() => setActiveTab('pipeline')}
          style={{ ...S.tabBtn, ...(activeTab === 'pipeline' ? S.tabActive : {}) }}
        >
          My Recruiting Pipeline
          {recruits.length > 0 && <span style={S.tabBadge}>{recruits.length}</span>}
        </button>
        <button
          id="tab-craigslist"
          onClick={() => setActiveTab('craigslist')}
          style={{ ...S.tabBtn, ...(activeTab === 'craigslist' ? S.tabActive : {}) }}
        >
          Search Craigslist Resumes
        </button>
      </div>

      {/* ================================================================
          TAB 1 -- PIPELINE
      ================================================================ */}
      {activeTab === 'pipeline' && (
        <>
          {/* Funnel counts */}
          <div style={S.funnelRow}>
            {RECRUIT_STATUSES.map(s => {
              const sc = STATUS_COLORS[s] || {};
              return (
                <div key={s} style={{ ...S.funnelCard, background: sc.bg, borderTop: `3px solid ${sc.color}` }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: sc.color }}>{counts[s] || 0}</div>
                  <div style={{ fontSize: 11, color: sc.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s}</div>
                </div>
              );
            })}
          </div>

          {/* Toolbar */}
          <div style={S.toolbar}>
            <button id="add-recruit-btn" onClick={() => setShowForm(v => !v)} style={S.addBtn}>
              {showForm ? 'Cancel' : '+ Add New Recruit'}
            </button>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={S.select}>
              <option value="All">All Statuses</option>
              {RECRUIT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={S.select}>
              <option value="All">All Types</option>
              {RECRUIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={loadPipeline} style={S.refreshBtn} title="Refresh">Refresh</button>
          </div>

          {/* Add form */}
          {showForm && (
            <Card>
              <CardHeader title="Add New Recruit" sub="Found outside the system -- LinkedIn, referral, job board, etc." />
              <form onSubmit={handleAdd}>
                <div style={S.formGrid}>
                  <div>
                    <label style={S.label}>Full name *</label>
                    <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={S.input} placeholder="e.g. John Smith" />
                  </div>
                  <div>
                    <label style={S.label}>Email *</label>
                    <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} style={S.input} placeholder="john@example.com" />
                  </div>
                  <div>
                    <label style={S.label}>Phone</label>
                    <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} style={S.input} placeholder="+1 (555) 000-0000" />
                  </div>
                  <div>
                    <label style={S.label}>Source</label>
                    <select value={form.source} onChange={e => setForm({...form, source: e.target.value})} style={S.input}>
                      {RECRUIT_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>Interested role</label>
                    <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} style={S.input}>
                      {RECRUIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={S.label}>Notes</label>
                    <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} style={{ ...S.input, resize: 'vertical', minHeight: 60 }} placeholder="First impression, referral context, etc." />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button type="submit" disabled={submitting} style={S.primaryBtn}>{submitting ? 'Adding...' : 'Add to Pipeline'}</button>
                  <button type="button" onClick={() => { setShowForm(false); setForm(BLANK_FORM); }} style={S.outBtn}>Cancel</button>
                </div>
                <Note>Authorized Resellers come through a different channel -- they are NOT in this recruiting pipeline.</Note>
              </form>
            </Card>
          )}

          {/* Pipeline table + detail panel */}
          <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 16, alignItems: 'start' }}>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-line)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{filtered.length} recruit{filtered.length !== 1 ? 's' : ''}</span>
              </div>
              {loading
                ? <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading pipeline...</div>
                : error
                  ? <div style={{ padding: 24, color: '#D44A4A', fontSize: 13 }}>{error}</div>
                  : filtered.length === 0
                    ? <EmptyState icon="+" title="No recruits yet" message="Add your first recruit or search Craigslist for candidates." />
                    : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={S.table}>
                          <thead>
                            <tr>
                              {['Name', 'Type', 'Source', 'Status', 'Added', 'Actions'].map(h => (
                                <th key={h} style={S.th}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map(r => {
                              const sc = STATUS_COLORS[r.status] || {};
                              const isMenuOpen = openMenu === r.id;
                              return (
                                <tr key={r.id} style={{ ...S.tr, background: selected?.id === r.id ? '#EEF4FF' : 'transparent' }}>
                                  <td style={S.td} onClick={() => { setSelected(selected?.id === r.id ? null : r); setEditMode(false); }}>
                                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                                    <div style={{ fontSize: 11, color: '#999' }}>{r.email}</div>
                                  </td>
                                  <td style={S.td} onClick={() => { setSelected(selected?.id === r.id ? null : r); setEditMode(false); }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>{r.type || '--'}</span>
                                  </td>
                                  <td style={S.td} onClick={() => { setSelected(selected?.id === r.id ? null : r); setEditMode(false); }}>
                                    <span style={{ fontSize: 12, color: '#777' }}>{r.source}</span>
                                  </td>
                                  <td style={S.td} onClick={() => { setSelected(selected?.id === r.id ? null : r); setEditMode(false); }}>
                                    <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 4, fontWeight: 600, background: sc.bg, color: sc.color }}>{r.status}</span>
                                  </td>
                                  <td style={S.td} onClick={() => { setSelected(selected?.id === r.id ? null : r); setEditMode(false); }}>
                                    <span style={{ fontSize: 12, color: '#888' }}>{r.addedAt ? new Date(r.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '--'}</span>
                                  </td>
                                  <td style={{ ...S.td, position: 'relative' }}>
                                    <div style={{ position: 'relative', display: 'inline-block' }} ref={isMenuOpen ? menuRef : null}>
                                      <button
                                        id={`menu-btn-${r.id}`}
                                        onClick={e => { e.stopPropagation(); setOpenMenu(isMenuOpen ? null : r.id); }}
                                        style={S.menuBtn}
                                        title="Actions"
                                      >
                                        ...
                                      </button>
                                      {isMenuOpen && (
                                        <div style={S.dropdown}>
                                          <button
                                            onClick={() => { setSelected(r); openEdit(r); }}
                                            style={S.dropdownItem}
                                          >
                                            Edit recruit
                                          </button>
                                          <button
                                            onClick={() => confirmDelete(r)}
                                            style={{ ...S.dropdownItem, color: '#D44A4A' }}
                                          >
                                            Delete recruit
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
              }
            </Card>

            {/* Detail panel */}
            {selected && (() => {
              const sc     = STATUS_COLORS[selected.status] || {};
              const stepIdx = getStepIndex(selected.status);
              const isDeclined = selected.status === 'Declined';
              const nextStage  = !isDeclined && stepIdx >= 0 ? RECRUIT_STAGES[stepIdx + 1] : null;
              const prevStage  = !isDeclined && stepIdx > 0  ? RECRUIT_STAGES[stepIdx - 1] : null;

              return (
                <Card style={{ position: 'sticky', top: 16 }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{selected.name}</div>
                      <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{selected.email}</div>
                      {selected.phone && <div style={{ fontSize: 13, color: '#888' }}>{selected.phone}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!editMode && (
                        <button onClick={() => openEdit(selected)} style={S.iconBtn} title="Edit recruit">Edit</button>
                      )}
                      <button onClick={() => { setSelected(null); setEditMode(false); }} style={{ ...S.iconBtn, color: '#888' }} title="Close">x</button>
                    </div>
                  </div>

                  {/* Edit form */}
                  {editMode ? (
                    <form onSubmit={handleEditSave}>
                      <div style={S.formGrid}>
                        <div>
                          <label style={S.label}>Full name *</label>
                          <input required value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} style={S.input} />
                        </div>
                        <div>
                          <label style={S.label}>Email *</label>
                          <input required type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} style={S.input} />
                        </div>
                        <div>
                          <label style={S.label}>Phone</label>
                          <input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} style={S.input} />
                        </div>
                        <div>
                          <label style={S.label}>Source</label>
                          <select value={editForm.source} onChange={e => setEditForm({...editForm, source: e.target.value})} style={S.input}>
                            {RECRUIT_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={S.label}>Role</label>
                          <select value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value})} style={S.input}>
                            {RECRUIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={S.label}>Notes</label>
                          <textarea value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} style={{ ...S.input, resize: 'vertical', minHeight: 60 }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button type="submit" disabled={editSaving} style={S.primaryBtn}>{editSaving ? 'Saving...' : 'Save changes'}</button>
                        <button type="button" onClick={() => setEditMode(false)} style={S.outBtn}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      {/* Current status badge */}
                      <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 4, fontWeight: 700, background: sc.bg, color: sc.color }}>
                        {selected.status}
                      </span>

                      {/* Step-by-step progress */}
                      <div style={{ marginTop: 18, marginBottom: 6 }}>
                        <div style={S.infoLabel}>RECRUITING PROGRESS</div>
                      </div>

                      {isDeclined ? (
                        <div style={{ padding: '12px', background: '#FDF0F0', borderRadius: 8, fontSize: 13, color: '#882222', fontWeight: 600, marginBottom: 12 }}>
                          This recruit was declined at the {selected.status} stage.
                        </div>
                      ) : (
                        <>
                          {RECRUIT_STAGES.map((stage, i) => {
                            const isCompleted = i < stepIdx;
                            const isCurrent   = i === stepIdx;
                            const isUpcoming  = i > stepIdx;
                            return (
                              <div key={stage.status} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                                <div style={{
                                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                  background: isCompleted ? 'var(--color-primary, #1F4E79)' : isCurrent ? stage.color : '#E8E8E8',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 11, fontWeight: 700,
                                  color: isCompleted || isCurrent ? 'white' : '#AAA',
                                  border: isCurrent ? `2px solid ${stage.color}` : 'none',
                                  boxSizing: 'border-box',
                                }}>
                                  {isCompleted ? 'v' : stage.step}
                                </div>
                                <span style={{
                                  fontSize: 13,
                                  fontWeight: isCurrent ? 700 : 400,
                                  color: isCompleted ? '#333' : isCurrent ? stage.color : '#BBB',
                                }}>
                                  {stage.label}
                                </span>
                                {isCurrent && (
                                  <span style={{ fontSize: 11, color: stage.color, marginLeft: 'auto', fontWeight: 600 }}>
                                    Current
                                  </span>
                                )}
                              </div>
                            );
                          })}

                          {/* Navigation buttons */}
                          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                            <button
                              id="step-back-btn"
                              onClick={() => handleStepBack(selected)}
                              disabled={statusUpdating || stepIdx <= 0}
                              style={{ flex: 1, ...S.outBtn, opacity: stepIdx <= 0 ? 0.4 : 1 }}
                            >
                              &lt; Step back
                            </button>
                            <button
                              id="step-forward-btn"
                              onClick={() => handleStepForward(selected)}
                              disabled={statusUpdating || !nextStage}
                              style={{ flex: 1, ...S.primaryBtn, opacity: !nextStage ? 0.4 : 1 }}
                            >
                              {nextStage
                                ? (nextStage.status === 'Active' ? 'Mark as Active' : `Move to ${nextStage.label}`)
                                : 'Active (Final)'}
                            </button>
                          </div>

                          {/* Declined button */}
                          <button
                            id="decline-btn"
                            onClick={() => moveToStatus(selected, 'Declined')}
                            disabled={statusUpdating}
                            style={{ width: '100%', marginTop: 8, ...S.dangerBtn }}
                          >
                            Mark as Declined
                          </button>
                        </>
                      )}

                      {/* Onboarding stages (when in Onboarding status) */}
                      {selected.status === 'Onboarding' && (
                        <div style={{ marginTop: 16 }}>
                          <div style={S.infoLabel}>CX ONBOARDING STEPS</div>
                          <div style={{ marginTop: 8 }}>
                            {ONBOARDING_STAGES.map(stage => (
                              <div key={stage.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#EEE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#888', flexShrink: 0 }}>{stage.id}</div>
                                <div>
                                  <div style={{ fontSize: 12 }}>{stage.label}</div>
                                  {stage.note && <div style={{ fontSize: 10, color: '#D49A2B', fontStyle: 'italic' }}>Note: {stage.note}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Info grid */}
                      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div><div style={S.infoLabel}>Source</div><div style={S.infoVal}>{selected.source}</div></div>
                        <div><div style={S.infoLabel}>Type</div><div style={S.infoVal}>{selected.type || '--'}</div></div>
                        <div><div style={S.infoLabel}>Added by</div><div style={S.infoVal}>{selected.addedBy || recruiterName}</div></div>
                        <div><div style={S.infoLabel}>Added</div><div style={S.infoVal}>{selected.addedAt ? new Date(selected.addedAt).toLocaleDateString() : '--'}</div></div>
                      </div>

                      {selected.notes && (
                        <div style={{ marginTop: 12 }}>
                          <div style={S.infoLabel}>Notes</div>
                          <div style={{ fontSize: 12, color: '#444', lineHeight: 1.6, marginTop: 4, background: '#F9F9F9', borderRadius: 6, padding: '8px 10px' }}>{selected.notes}</div>
                        </div>
                      )}

                      {/* Delete button at bottom of panel */}
                      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #F0F0F0' }}>
                        <button onClick={() => confirmDelete(selected)} style={{ ...S.dangerOutBtn, width: '100%' }}>
                          Delete this recruit
                        </button>
                      </div>
                    </>
                  )}
                </Card>
              );
            })()}
          </div>
        </>
      )}

      {/* ================================================================
          TAB 2 -- CRAIGSLIST RESUME SEARCH
      ================================================================ */}
      {activeTab === 'craigslist' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <CardHeader
              title="Search Craigslist Resumes"
              sub="Find commission-driven sales candidates from Craigslist's resumes / job-wanted section"
            />
            <form id="craigslist-search-form" onSubmit={handleCraigslistSearch}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px auto', gap: 12, alignItems: 'end' }}>
                <div>
                  <label style={S.label}>Keywords</label>
                  <input
                    id="craigslist-keywords"
                    value={clKeywords}
                    onChange={e => setClKeywords(e.target.value)}
                    style={S.input}
                    placeholder="sales, commission, cold calling..."
                  />
                </div>
                <div>
                  <label style={S.label}>City / Market</label>
                  <select id="craigslist-city" value={clCity} onChange={e => setClCity(e.target.value)} style={S.input}>
                    {CRAIGSLIST_CITIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  id="craigslist-search-btn"
                  type="submit"
                  disabled={clLoading}
                  style={{ ...S.primaryBtn, whiteSpace: 'nowrap', padding: '9px 20px' }}
                >
                  {clLoading ? 'Searching...' : 'Search Craigslist'}
                </button>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: '#888' }}>
                <strong>Tip:</strong> Craigslist hides email addresses -- you&apos;ll fill those in after contacting candidates. Phone numbers are extracted automatically when available.
              </div>
            </form>
          </Card>

          {clLoading && (
            <div style={{ textAlign: 'center', padding: 48, color: '#888' }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>Searching Craigslist resumes...</div>
              <div style={{ fontSize: 12 }}>This may take a few seconds</div>
            </div>
          )}

          {clSearched && !clLoading && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>
                  {clResults.length} candidate{clResults.length !== 1 ? 's' : ''} found
                </span>
                {clDemo && (
                  <span style={{ fontSize: 11, background: '#FFF3CD', color: '#856404', padding: '3px 9px', borderRadius: 4, fontWeight: 600, border: '1px solid #FFE69C' }}>
                    Demo Mode -- sample results (backend offline or Craigslist blocked)
                  </span>
                )}
                <span style={{ fontSize: 12, color: '#888' }}>
                  in {CRAIGSLIST_CITIES.find(c => c.value === clCity)?.label || clCity}
                </span>
              </div>

              {clResults.length === 0 ? (
                <EmptyState
                  icon="0"
                  title="No results found"
                  message="Try different keywords or a different city. Craigslist may also temporarily block scrapers -- try again in a few minutes."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {clResults.map((result, idx) => {
                    const key      = result.link || result.title || idx;
                    const isAdding = clAdding[key];
                    const isAdded  = clAdded[key];
                    return (
                      <Card key={key} style={{ padding: 0, overflow: 'hidden', border: isAdded ? '1px solid #2D9B5E' : undefined }}>
                        <div style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 14, color: '#1F2D3D', marginBottom: 4 }}>
                                {result.title}
                              </div>
                              <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#888', marginBottom: 8, flexWrap: 'wrap' }}>
                                {result.date && <span>Posted: {formatDate(result.date)}</span>}
                                {result.phone
                                  ? <span style={{ color: '#1F4E79', fontWeight: 600 }}>Tel: {result.phone}</span>
                                  : <span style={{ color: '#BBB' }}>No phone listed</span>
                                }
                              </div>
                              {result.description && (
                                <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, background: '#F8F9FA', borderRadius: 6, padding: '8px 12px', fontStyle: 'italic' }}>
                                  &ldquo;{result.description.slice(0, 300)}{result.description.length > 300 ? '...' : ''}&rdquo;
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                              {result.link && (
                                <a
                                  href={result.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ ...S.outBtn, display: 'block', textAlign: 'center', fontSize: 12, padding: '7px 14px', textDecoration: 'none' }}
                                >
                                  View Post
                                </a>
                              )}
                              <button
                                id={`add-candidate-${idx}`}
                                disabled={isAdding || isAdded}
                                onClick={() => handleAddFromCraigslist(result)}
                                style={{
                                  ...S.primaryBtn,
                                  fontSize: 12, padding: '7px 14px',
                                  background: isAdded ? '#2D9B5E' : 'var(--color-primary)',
                                  opacity: isAdding ? 0.7 : 1,
                                  cursor: isAdded || isAdding ? 'default' : 'pointer',
                                }}
                              >
                                {isAdded ? 'Added!' : isAdding ? 'Adding...' : '+ Add to Pipeline'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!clSearched && !clLoading && (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#AAA' }}>
              <div style={{ fontSize: 48, marginBottom: 16, color: '#DDD', fontWeight: 200 }}>[ ]</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#888', marginBottom: 8 }}>Ready to search</div>
              <div style={{ fontSize: 13 }}>
                Enter keywords (e.g. <em>sales commission</em>) and select a city, then click <strong>Search Craigslist</strong>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  wrap:        { display: 'flex', flexDirection: 'column', gap: 16 },
  toast:       { position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', padding: '12px 24px', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, zIndex: 9000, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', maxWidth: '90vw', textAlign: 'center' },

  // Tabs
  tabBar:      { display: 'flex', gap: 0, borderBottom: '2px solid var(--color-line)', marginBottom: 4 },
  tabBtn:      { background: 'none', border: 'none', padding: '11px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#888', borderBottom: '3px solid transparent', marginBottom: '-2px', display: 'flex', alignItems: 'center', gap: 7, transition: 'color .15s, border-color .15s' },
  tabActive:   { color: 'var(--color-primary)', borderBottomColor: 'var(--color-primary)' },
  tabBadge:    { fontSize: 10, fontWeight: 700, background: 'var(--color-primary)', color: 'white', borderRadius: 10, padding: '1px 6px' },

  // Pipeline
  funnelRow:   { display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10 },
  funnelCard:  { borderRadius: 8, padding: '14px 12px', textAlign: 'center', border: '1px solid #EEE' },
  toolbar:     { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  addBtn:      { background: 'var(--color-primary)', color: 'white', border: 'none', padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  select:      { padding: '9px 12px', border: '1px solid var(--color-line)', borderRadius: 6, fontSize: 13, outline: 'none', background: 'white', cursor: 'pointer' },
  refreshBtn:  { background: 'white', border: '1px solid var(--color-line)', borderRadius: 6, padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: '#666' },
  formGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 },
  label:       { display: 'block', fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, marginBottom: 4 },
  input:       { width: '100%', padding: '9px 12px', border: '1px solid #DDD3C2', borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  primaryBtn:  { background: 'var(--color-primary)', color: 'white', border: 'none', padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  outBtn:      { background: 'white', color: '#555', border: '1px solid #DDD3C2', padding: '9px 18px', borderRadius: 6, fontSize: 13, cursor: 'pointer' },
  dangerBtn:   { background: '#D44A4A', color: 'white', border: 'none', padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  dangerOutBtn:{ background: 'white', color: '#D44A4A', border: '1px solid #D44A4A', padding: '9px 18px', borderRadius: 6, fontSize: 13, cursor: 'pointer' },
  iconBtn:     { background: 'white', color: '#1F4E79', border: '1px solid #DDD3C2', padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 },

  // Table
  table:       { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:          { textAlign: 'left', padding: '10px 10px', borderBottom: '1px solid var(--color-line)', fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 },
  td:          { padding: '12px 10px', borderBottom: '1px solid #F5F5F5', color: '#333', verticalAlign: 'middle', cursor: 'pointer' },
  tr:          { transition: 'background .1s' },

  // Action menu
  menuBtn:     { background: 'white', border: '1px solid #DDD', borderRadius: 4, padding: '4px 10px', fontSize: 15, cursor: 'pointer', fontWeight: 700, color: '#555', lineHeight: 1 },
  dropdown:    { position: 'absolute', right: 0, top: '100%', background: 'white', border: '1px solid #DDD', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 160, overflow: 'hidden' },
  dropdownItem:{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '10px 14px', fontSize: 13, cursor: 'pointer', color: '#333' },

  // Detail info
  infoLabel:   { fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 },
  infoVal:     { fontSize: 12, fontWeight: 500, marginTop: 2, color: '#333' },

  // Delete dialog
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 8000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  dialog:      { background: 'white', borderRadius: 12, padding: '24px 28px', maxWidth: 380, width: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
};
