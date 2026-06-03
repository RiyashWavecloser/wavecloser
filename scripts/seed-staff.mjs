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

const DEFAULT_STAFF = [
  { email: 'riyash@waveclosers.com',  name: 'Riyash',  role: 'admin' },
  { email: 'william@waveclosers.com', name: 'William', role: 'sponsor' },
  { email: 'mildred@waveclosers.com', name: 'Mildred', role: 'appointment_setter' },
  { email: 'janina@waveclosers.com',  name: 'Janina',  role: 'recruiter' },
  { email: 'sergey@waveclosers.com',  name: 'Sergey',  role: 'marketer' },
  { email: 'matt@waveclosers.com',    name: 'Matt',    role: 'trainer' },
];

async function seed() {
  console.log('\n[seed-staff] Seeding staff operator accounts to Airtable...');
  console.log(`Using default seed password: "${STAFF_PASSWORD}" (can be customized via STAFF_PASSWORD in .env)\n`);
  const passwordHash = hashPassword(STAFF_PASSWORD);

  for (const member of DEFAULT_STAFF) {
    try {
      const existing = await base('Staff')
        .select({ filterByFormula: `{Email} = "${member.email}"`, maxRecords: 1 })
        .all();

      if (existing.length) {
        await base('Staff').update(existing[0].id, {
          Name: member.name,
          Role: member.role,
        });
        console.log(`  ✓ ${member.email} — updated (password & MustChangePassword unchanged)`);
      } else {
        await base('Staff').create({
          Email: member.email,
          Name: member.name,
          Role: member.role,
          PasswordHash: passwordHash,
          MustChangePassword: true,
        });
        console.log(`  ✓ ${member.email} — created [must change password on first login]`);
      }
    } catch (err) {
      console.error(`  ✗ Failed seeding ${member.email}:`, err.message);
    }
  }
  console.log('\n[seed-staff] Seeding complete! 🎉\n');
}

seed();
