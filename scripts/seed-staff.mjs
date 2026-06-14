import dotenv from 'dotenv'; dotenv.config();
import Airtable from 'airtable';
import { hashPassword } from '../server/auth.js';

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || 'password';
const AGENT_PASSWORD = process.env.AGENT_PASSWORD || 'AgentPass1!';

if (!API_KEY || !BASE_ID) {
  console.error('[seed-staff] ✗ AIRTABLE_API_KEY or AIRTABLE_BASE_ID not set in .env');
  process.exit(1);
}

Airtable.configure({ apiKey: API_KEY });
const base = new Airtable().base(BASE_ID);

const DEFAULT_STAFF = [
  { email: 'riyash@waveclosers.com',  name: 'Riyash',  role: 'admin' },
  { email: 'william@waveclosers.com', name: 'William', role: 'sponsor' },
  { email: 'qualifier@waveclosers.com', name: 'Lead Qualifier', role: 'cx' },
  { email: 'recruiter@waveclosers.com',  name: 'Recruiter',  role: 'recruiter' },
  { email: 'sergey@waveclosers.com',  name: 'Sergey',  role: 'marketer' },
  { email: 'matt@waveclosers.com',    name: 'Matt',    role: 'trainer' },
];

// 10 cold-calling agents — William will confirm real names (Open item #10)
// Each agent gets an individual password: Agent1Pass! through Agent10Pass!
const AGENT_ACCOUNTS = Array.from({ length: 10 }, (_, i) => ({
  email: `agent${i + 1}@waveclosers.com`,
  name:  `Agent ${i + 1}`,
  role:  'agent',
  password: `Agent${i + 1}Pass!`,
}));

async function seed() {
  console.log('\n[seed-staff] Seeding staff operator accounts to Airtable...');
  console.log(`Using staff password: "${STAFF_PASSWORD}"`);
  console.log(`Using agent passwords: Agent1Pass! through Agent10Pass! (individual per agent)\n`);

  const staffHash = hashPassword(STAFF_PASSWORD);

  // Seed 6 staff operators
  for (const member of DEFAULT_STAFF) {
    try {
      const existing = await base('Staff')
        .select({ filterByFormula: `{Email} = "${member.email}"`, maxRecords: 1 })
        .all();

      if (existing.length) {
        const updateFields = {
          Name: member.name,
          Role: member.role,
        };
        if (member.email !== 'riyash@waveclosers.com') {
          updateFields.PasswordHash = staffHash;
          updateFields.MustChangePassword = true;
          console.log(`  ✓ ${member.email} — updated and reset password to default ("${STAFF_PASSWORD}")`);
        } else {
          console.log(`  ✓ ${member.email} — updated (password & MustChangePassword unchanged)`);
        }
        await base('Staff').update(existing[0].id, updateFields);
      } else {
        await base('Staff').create({
          Email: member.email,
          Name: member.name,
          Role: member.role,
          PasswordHash: staffHash,
          MustChangePassword: true,
        });
        console.log(`  ✓ ${member.email} — created [must change password on first login]`);
      }
    } catch (err) {
      console.error(`  ✗ Failed seeding ${member.email}:`, err.message);
    }
  }

  // Seed 10 agent accounts with individual PBKDF2 hashed passwords
  console.log('\n[seed-staff] Seeding 10 agent accounts...');
  for (const agent of AGENT_ACCOUNTS) {
    try {
      const existing = await base('Staff')
        .select({ filterByFormula: `{Email} = "${agent.email}"`, maxRecords: 1 })
        .all();

      const agentHash = hashPassword(agent.password);

      if (existing.length) {
        await base('Staff').update(existing[0].id, {
          Name: agent.name,
          Role: agent.role,
          PasswordHash: agentHash,
          MustChangePassword: false,
        });
        console.log(`  ✓ ${agent.email} — updated (password: ${agent.password})`);
      } else {
        await base('Staff').create({
          Email: agent.email,
          Name: agent.name,
          Role: agent.role,
          PasswordHash: agentHash,
          MustChangePassword: false,
        });
        console.log(`  ✓ ${agent.email} — created (password: ${agent.password})`);
      }
    } catch (err) {
      console.error(`  ✗ Failed seeding ${agent.email}:`, err.message);
    }
  }

  console.log('\n[seed-staff] Seeding complete! 🎉');
  console.log(`  Total: ${DEFAULT_STAFF.length} staff + ${AGENT_ACCOUNTS.length} agents = ${DEFAULT_STAFF.length + AGENT_ACCOUNTS.length} accounts\n`);
}

seed();
