/**
 * src/modules/RecruiterPortal.jsx
 * Workflow B -- Recruiting / Salesperson Onboarding pipeline.
 */
import React from 'react';
import { PageHeader } from '../components/ui.jsx';
import RecruitingPipelineView from '../components/RecruitingPipelineView.jsx';

export default function RecruiterPortal({ currentUser }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        title="Recruiting Portal"
        subtitle="Workflow B -- Find, manage, and onboard salespeople"
      />
      <RecruitingPipelineView currentUser={currentUser} />
    </div>
  );
}
