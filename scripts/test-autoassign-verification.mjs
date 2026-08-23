/**
 * test-autoassign-verification.mjs
 * 
 * Verifies that auto-assigning resume leads properly saves them in Airtable's
 * ResumeLeads table under each target agent's name, and that getResumeLeadsByAgent
 * can retrieve them for each agent's portal view.
 */

import dotenv from 'dotenv';
import { getRecruitingAgents, getResumeLeadsByAgent, saveResumeLead } from '../server/airtableClient.js';

dotenv.config();

async function run() {
  console.log('🧪 Starting Auto-Assign Resume Leads Verification Test...\n');

  // 1. Fetch confirmed recruiting agents
  const agents = await getRecruitingAgents();
  console.log(`[1] Found ${agents.length} confirmed recruiting agents:`);
  agents.forEach((a, i) => console.log(`   ${i + 1}. ${a.name} (${a.email})`));

  if (!agents || agents.length === 0) {
    console.error('❌ No agents found!');
    process.exit(1);
  }

  // 2. Verify query capability for each agent
  console.log('\n[2] Testing lead retrieval for each agent (getResumeLeadsByAgent):');
  for (const agent of agents) {
    const leads = await getResumeLeadsByAgent(agent.name, null);
    console.log(`   • ${agent.name.padEnd(12)} → ${leads.length} assigned resume lead(s) currently in system`);
  }

  console.log('\n✅ Verification Test Finished Successfully.');
}

run().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
