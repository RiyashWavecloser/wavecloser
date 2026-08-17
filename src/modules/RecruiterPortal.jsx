/**
 * src/modules/RecruiterPortal.jsx
 * Workflow B -- Recruiting / Salesperson Onboarding pipeline.
 * Updated to include Resume Lead Performance tab and Bulk Assign modal.
 */
import React, { useState } from 'react';
import { PageHeader } from '../components/ui.jsx';
import RecruitingPipelineView from '../components/RecruitingPipelineView.jsx';
import ResumePerformanceTab from '../components/ResumePerformanceTab.jsx';
import BulkAssignModal from '../components/BulkAssignModal.jsx';
import { clearFakeResumeLeadsAPI, purgeDemoDataAPI, verifyURLsAPI, checkPoolStatusAPI, clearRecentDedup } from '../lib/dataLayer.js';

const ADMIN_ROLES = ['admin', 'pm', 'sponsor', 'recruiter', 'wave_closer_recruiter'];

export default function RecruiterPortal({ currentUser }) {
  const [activeTab,      setActiveTab]      = useState('pipeline');
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [clearing,       setClearing]       = useState(false);
  const [purging,        setPurging]        = useState(false);
  const [verifying,      setVerifying]      = useState(false);
  const [dedupDays,      setDedupDays]      = useState(10);
  const [clearingDedup,  setClearingDedup]  = useState(false);
  const [clearResult,    setClearResult]    = useState(null);

  const canViewPerformance = ADMIN_ROLES.includes(currentUser?.role);

  async function handleClearFakeLeads() {
    if (!window.confirm('This will delete all demo/fake leads from the system. Real leads from Apify will replace them after next distribution. Continue?')) return;
    setClearing(true);
    try {
      const data = await clearFakeResumeLeadsAPI();
      if (data.success) {
        alert(`✓ Deleted ${data.deleted} fake leads. Click "Run Distribution Now" to fetch real ones from Apify.`);
      } else {
        alert(`Error: ${data.error || data.message || 'Failed to clear fake leads'}`);
      }
    } catch (err) {
      alert(`Error clearing fake leads: ${err.message}`);
    } finally {
      setClearing(false);
    }
  }

  async function handleVerifyURLs() {
    setVerifying(true);
    try {
      const data = await verifyURLsAPI();
      alert(
        `URL Quality Report:\n\n` +
        `Total leads checked: ${data.total || 0}\n` +
        `Valid URLs: ${data.valid || 0}\n` +
        `Invalid URLs (will 404): ${data.invalid || 0} (${data.invalidPercentage || '0%'})\n\n` +
        `Sample invalid:\n${data.samples?.map(s => `- ${s.title}: ${s.url}`).join('\n') || 'None'}`
      );
    } catch (err) {
      alert(`Error checking URLs: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  }

  async function handlePurgeDemoData() {
    const confirmed = window.confirm(
      'This will permanently delete ALL demo/fake leads from the production Airtable.\n\n' +
      'Specifically removes:\n' +
      '- Leads with demo/fake descriptions ("Energetic sales professional...", etc.)\n' +
      '- Any leads with @waveclosers.com in description or fake candidate email\n' +
      '- Any leads without valid Craigslist URLs\n' +
      '- Leads assigned to placeholder agents (Agent 1, Agent 2, etc.)\n\n' +
      'This cannot be undone. Continue?'
    );
    if (!confirmed) return;

    setPurging(true);
    try {
      const data = await purgeDemoDataAPI();
      if (data.success) {
        alert(`✓ ${data.message}`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert(`Failed: ${e.message}`);
    } finally {
      setPurging(false);
    }
  }

  async function handleCheckPoolStatus() {
    try {
      const data = await checkPoolStatusAPI();
      alert(
        `Pool Status Report\n\n` +
        `Apify configured: ${data.apifyConfigured ? '✅ Yes' : '❌ No — add APIFY_API_KEY to Railway'}\n` +
        `Dedup registry size: ${data.dedupeRegistrySize} URLs locked\n` +
        `Agents: ${data.agentCount}\n` +
        `Daily leads needed: ${data.dailyLeadsNeeded}\n\n` +
        `Test fetch (New York):\n` +
        `  Raw results: ${data.testRawResults}\n` +
        `  Fresh results: ${data.testFreshResults}\n\n` +
        `Diagnosis: ${data.diagnosis}`
      );
    } catch (err) {
      alert(`Error checking pool status: ${err.message}`);
    }
  }

  async function handleClearRecentDedup() {
    const confirmed = window.confirm(
      `Clear dedup registry for last ${dedupDays} days?\n\n` +
      `This will unlock real Craigslist leads from the last ${dedupDays} days ` +
      `so they can be reassigned to agents.\n\n` +
      `Demo data (fake leads, waveclosers-candidate.com, etc.) ` +
      `will still be blocked permanently.\n\n` +
      `After clearing — click "Run Distribution Now" to assign fresh real leads.`
    );

    if (!confirmed) return;

    setClearingDedup(true);
    setClearResult(null);

    try {
      const data = await clearRecentDedup(dedupDays);
      setClearResult(data);
    } catch (e) {
      setClearResult({ success: false, message: e.message });
    }

    setClearingDedup(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <PageHeader
            title="Recruiting Portal"
            subtitle="Workflow B — Find, manage, and onboard salespeople"
          />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {currentUser?.role === 'admin' && (
            <button
              onClick={handleClearFakeLeads}
              disabled={clearing}
              style={S.dangerBtn}
            >
              {clearing ? '⏳ Clearing...' : '🗑 Clear Demo/Fake Leads'}
            </button>
          )}
          {['admin', 'pm'].includes(currentUser?.role) && (
            <>
              <button
                onClick={handleCheckPoolStatus}
                style={S.outBtn}
              >
                🔍 Check Pool Status
              </button>
              <button
                onClick={handleVerifyURLs}
                disabled={verifying}
                style={S.outBtn}
              >
                {verifying ? '⏳ Checking...' : '🔍 Check Lead URL Quality'}
              </button>
              <button
                onClick={handlePurgeDemoData}
                disabled={purging}
                style={{ ...S.dangerBtn, background: '#7B1FA2', marginBottom: 0 }}
              >
                {purging ? '⏳ Purging...' : '🗑️ Purge All Demo Data'}
              </button>
            </>
          )}

          {canViewPerformance && (
            <button
              onClick={() => setShowBulkAssign(true)}
              style={S.bulkBtn}
            >
              🔍 Bulk Assign Resumes
            </button>
          )}
        </div>

      </div>

      {/* Admin Card */}
      {['admin', 'pm'].includes(currentUser?.role) && (
        <div style={S.adminCard}>
          <div style={S.adminCardHeader}>
            🔓 Unlock Real Leads for Reassignment
          </div>
          <div style={S.adminCardBody}>
            <p style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
              Clears the dedup registry for the last N days so those
              real Craigslist leads can be reassigned to agents again.
              Demo data is still permanently blocked.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: '#555' }}>Clear last</label>
              <select
                value={dedupDays}
                onChange={e => setDedupDays(parseInt(e.target.value))}
                style={S.select}
              >
                <option value={7}>7 days</option>
                <option value={10}>10 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
              </select>
              <label style={{ fontSize: 13, color: '#555' }}>of dedup history</label>
            </div>

            <button
              onClick={handleClearRecentDedup}
              disabled={clearingDedup}
              style={{ ...S.primaryBtn, background: '#D49A2B' }}
            >
              {clearingDedup ? '⟳ Clearing...' : `🔓 Clear Last ${dedupDays} Days`}
            </button>

            {clearResult && (
              <div style={{
                marginTop: 12,
                padding: '10px 14px',
                borderRadius: 8,
                background: clearResult.success ? 'var(--color-green-bg, #E8F5E9)' : 'var(--color-red-bg, #FFEBEE)',
                color: clearResult.success ? 'var(--color-green-text, #2E7D32)' : 'var(--color-red-text, #C62828)',
                fontSize: 13,
              }}>
                {clearResult.message}
                {clearResult.success && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#555' }}>
                    Now click &quot;Run Distribution Now&quot; to reassign real leads to agents.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab bar */}
      {canViewPerformance && (
        <div style={S.tabBar}>
          <button
            onClick={() => setActiveTab('pipeline')}
            style={{ ...S.tabBtn, ...(activeTab === 'pipeline' ? S.tabBtnActive : {}) }}
          >
            👥 Recruiting Pipeline
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            style={{ ...S.tabBtn, ...(activeTab === 'performance' ? S.tabBtnActive : {}) }}
          >
            📊 Resume Lead Performance
          </button>
        </div>
      )}

      {/* Tab content */}
      <div style={S.content}>
        {activeTab === 'pipeline' && (
          <RecruitingPipelineView currentUser={currentUser} />
        )}
        {activeTab === 'performance' && canViewPerformance && (
          <ResumePerformanceTab currentUser={currentUser} />
        )}
      </div>

      {/* Bulk Assign Modal */}
      {showBulkAssign && (
        <BulkAssignModal onClose={() => setShowBulkAssign(false)} />
      )}
    </div>
  );
}

const S = {
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0 0 8px', flexWrap: 'wrap', gap: 12 },
  bulkBtn:     { padding: '10px 20px', background: 'linear-gradient(135deg, #1F4E79, #2D9B5E)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif", marginTop: 4, flexShrink: 0 },
  dangerBtn:   { padding: '10px 16px', background: '#D9381E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif", marginTop: 4, flexShrink: 0 },
  outBtn:      { padding: '10px 16px', background: '#fff', border: '1px solid #1F4E79', color: '#1F4E79', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif", marginTop: 4, flexShrink: 0 },
  tabBar:      { display: 'flex', borderBottom: '2px solid #EBE6DC', background: '#fff', padding: '0', marginBottom: 0 },

  tabBtn:      { padding: '14px 20px', border: 'none', background: 'none', fontSize: 13, fontWeight: 600, color: '#888', cursor: 'pointer', fontFamily: "'Inter', sans-serif", borderBottom: '2px solid transparent', marginBottom: -2, transition: 'all 0.2s', whiteSpace: 'nowrap' },
  tabBtnActive: { color: '#1F4E79', borderBottom: '2px solid #1F4E79' },
  content:     { minHeight: 400 },

  adminCard: {
    background: '#FFFFFF',
    border: '1px solid #EBE6DC',
    borderRadius: 12,
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 4px 12px rgba(31, 78, 121, 0.05)',
  },
  adminCardHeader: {
    fontSize: 15,
    fontWeight: 700,
    color: '#1F4E79',
    marginBottom: 10,
    borderBottom: '1px solid #EBE6DC',
    paddingBottom: 8,
  },
  adminCardBody: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  select: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #C4BCA8',
    backgroundColor: '#fff',
    fontFamily: 'inherit',
    fontSize: 13,
    color: '#333',
    outline: 'none',
  },
  primaryBtn: {
    padding: '10px 18px',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
  },
};

