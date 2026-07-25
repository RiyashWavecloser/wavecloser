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

const ADMIN_ROLES = ['admin', 'pm', 'sponsor', 'recruiter', 'wave_closer_recruiter'];

export default function RecruiterPortal({ currentUser }) {
  const [activeTab,      setActiveTab]      = useState('pipeline');
  const [showBulkAssign, setShowBulkAssign] = useState(false);

  const canViewPerformance = ADMIN_ROLES.includes(currentUser?.role);

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
        {canViewPerformance && (
          <button
            onClick={() => setShowBulkAssign(true)}
            style={S.bulkBtn}
          >
            🔍 Bulk Assign Resumes
          </button>
        )}
      </div>

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
  tabBar:      { display: 'flex', borderBottom: '2px solid #EBE6DC', background: '#fff', padding: '0', marginBottom: 0 },
  tabBtn:      { padding: '14px 20px', border: 'none', background: 'none', fontSize: 13, fontWeight: 600, color: '#888', cursor: 'pointer', fontFamily: "'Inter', sans-serif", borderBottom: '2px solid transparent', marginBottom: -2, transition: 'all 0.2s', whiteSpace: 'nowrap' },
  tabBtnActive: { color: '#1F4E79', borderBottom: '2px solid #1F4E79' },
  content:     { minHeight: 400 },
};
