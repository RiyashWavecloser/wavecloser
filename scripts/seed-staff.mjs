import dotenv from 'dotenv'; dotenv.config();
import Airtable from 'airtable';
import { hashPassword } from '../server/auth.js';

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || 'password';

if (!API_KEY || !BASE_ID) {
  console.error('[seed-staff] ✗ AIRTABLE_API_KEY or AIRTABLE_BASE_ID not set in .env');
  process.exit(1);
}

Airtable.configure({ apiKey: API_KEY });
const base = new Airtable().base(BASE_ID);

// ─── Staff operator accounts ──────────────────────────────────────────────────
const STAFF_ACCOUNTS = [
  { email: 'riyash@waveclosers.com',   name: 'Riyash',   role: 'pm'        }, // Project Manager
  { email: 'william@waveclosers.com',  name: 'William',  role: 'admin'     }, // Executive Sponsor
  { email: 'mildred@waveclosers.com',  name: 'Mildred',  role: 'cx'        }, // CX Qualifier
  { email: 'sergey@waveclosers.com',   name: 'Sergey',   role: 'marketer'  }, // Marketer
  { email: 'matt@waveclosers.com',     name: 'Matt',     role: 'trainer'   }, // Sales Trainer

  // ⚠️ PLACEHOLDER EMAIL — William to confirm Aureliab's real email address.
  // Update RECRUITER_EMAIL in .env once confirmed — no code changes needed.
  // Open Item #11: "Confirm Aureliab's exact email address (Recruiter/Franchise Sales)"
  { email: 'aureliab@waveclosers.com', name: 'Aureliab', role: 'recruiter' }, // Recruiter
];

// ─── Cold-calling agent accounts (9 agents seeded as role: agent) ─────────────
const AGENT_ACCOUNTS = [
  { email: 'janina@waveclosers.com',   name: 'Janina',    password: 'JaninaPass1!'  },
  { email: 'johnm@waveclosers.com',    name: 'John M',    password: 'JohnmPass1!'   },
  { email: 'giana@waveclosers.com',    name: 'Giana',     password: 'GianaPass1!'   },
  { email: 'juliusb@waveclosers.com',  name: 'Julius B',  password: 'JuliusbPass1!' },
  { email: 'karenm@waveclosers.com',   name: 'Karen M',   password: 'KarenmPass1!'  },
  { email: 'jemelyna@waveclosers.com', name: 'Jemelyn',   password: 'JemelynPass1!' },
  { email: 'manilynp@waveclosers.com', name: 'Manilyn',   password: 'ManilynPass1!' },
  { email: 'melaniea@waveclosers.com', name: 'Melanie',   password: 'MelaniePass1!' },
  { email: 'aprils@waveclosers.com',   name: 'April S',   password: 'AprilsPass1!'  },
].map(a => ({ ...a, role: 'agent' }));

// ─── Supervisor account ───────────────────────────────────────────────────────
const SUPERVISOR_ACCOUNTS = [
  { email: 'agentsservices@waveclosers.com', name: 'Agent Services', role: 'agent_supervisor', password: 'SupervisorPass1!' },
];

async function upsertStaff(member, passwordHash, mustChangePassword, fallbackRole = null) {
  try {
    const existing = await base('Staff')
      .select({ filterByFormula: `{Email} = "${member.email}"`, maxRecords: 1 })
      .all();

    if (existing.length) {
      const updateFields = { Name: member.name, Role: member.role };
      if (member.email !== 'riyash@waveclosers.com') {
        updateFields.PasswordHash = passwordHash;
        updateFields.MustChangePassword = mustChangePassword;
      }
      await base('Staff').update(existing[0].id, updateFields);
      return member.email === 'riyash@waveclosers.com'
        ? `  ✓ ${member.email} — updated (password & MustChangePassword unchanged)`
        : `  ✓ ${member.email} — updated (password reset)`;
    } else {
      await base('Staff').create({
        Email: member.email,
        Name: member.name,
        Role: member.role,
        PasswordHash: passwordHash,
        MustChangePassword: mustChangePassword,
      });
      return `  ✓ ${member.email} — created`;
    }
  } catch (err) {
    // If role option doesn't exist in Airtable, retry with fallback role
    if (fallbackRole && (err.message?.includes('select option') || err.message?.includes('Insufficient permissions'))) {
      try {
        const existing = await base('Staff')
          .select({ filterByFormula: `{Email} = "${member.email}"`, maxRecords: 1 })
          .all();
        const fields = { Email: member.email, Name: member.name, Role: fallbackRole, PasswordHash: passwordHash, MustChangePassword: mustChangePassword };
        if (existing.length) {
          await base('Staff').update(existing[0].id, { Name: member.name, Role: fallbackRole, PasswordHash: passwordHash, MustChangePassword: mustChangePassword });
        } else {
          await base('Staff').create(fields);
        }
        return `  ⚠️  ${member.email} — created with role "${fallbackRole}" (MANUAL FIX NEEDED: add "agent_supervisor" option to the Role field in Airtable Staff table, then change this account's role)`;
      } catch (err2) {
        return `  ✗ Failed seeding ${member.email}: ${err2.message}`;
      }
    }
    return `  ✗ Failed seeding ${member.email}: ${err.message}`;
  }
}

async function seed() {
  console.log('\n[seed-staff] Seeding Wave Closers operator accounts to Airtable...');
  console.log(`Using staff password: "${STAFF_PASSWORD}"\n`);

  const staffHash = hashPassword(STAFF_PASSWORD);

  // ─── 6 Staff operators ────────────────────────────────────────────────────
  console.log('[seed-staff] Seeding 6 staff operators...');
  for (const member of STAFF_ACCOUNTS) {
    const msg = await upsertStaff(member, staffHash, true);
    console.log(msg);
  }

  // ─── 9 Cold-calling agents ────────────────────────────────────────────────
  console.log('\n[seed-staff] Seeding 9 cold-calling agents (Janina is cold_caller, NOT recruiter)...');
  for (const agent of AGENT_ACCOUNTS) {
    const hash = hashPassword(agent.password);
    const msg = await upsertStaff(agent, hash, false);
    console.log(msg + ` (password: ${agent.password})`);
  }

  // ─── 1 Supervisor ─────────────────────────────────────────────────────────
  console.log('\n[seed-staff] Seeding supervisor account...');
  for (const sup of SUPERVISOR_ACCOUNTS) {
    const hash = hashPassword(sup.password);
    const msg = await upsertStaff(sup, hash, false, 'agent'); // fallback if agent_supervisor not in Airtable yet
    console.log(msg + ` (password: ${sup.password})`);
  }

  const total = STAFF_ACCOUNTS.length + AGENT_ACCOUNTS.length + SUPERVISOR_ACCOUNTS.length;
  console.log(`\n[seed-staff] Seeding complete! 🎉`);
  console.log(`  Total: ${STAFF_ACCOUNTS.length} staff + ${AGENT_ACCOUNTS.length} agents + ${SUPERVISOR_ACCOUNTS.length} supervisor = ${total} accounts`);
  console.log('  Roles: riyash=pm, william=admin, mildred=cx, sergey=marketer, matt=trainer, aureliab=recruiter');
  console.log('  Agents: all 9 agents seeded as agent role');
  console.log('\n  ⚠️  REMINDER: Aureliab\'s email (aureliab@waveclosers.com) is a PLACEHOLDER.');
  console.log('  Update RECRUITER_EMAIL in .env once William confirms the real address.\n');
  console.log('  ⚠️  ACTION NEEDED: Manually add \'cold_caller\', \'independent_rep\', \'authorized_reseller\',');
  console.log('  \'iso_investor\', \'referral_partner\', \'pm\', and \'recruiter\' to the Role field');
  console.log('  options in Airtable Staff table if not already present.\n');
}

seed();
