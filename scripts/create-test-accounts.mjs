import dotenv from 'dotenv';
dotenv.config();
import Airtable from 'airtable';
import { hashPassword } from '../server/auth.js';

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!API_KEY || !BASE_ID) {
  console.error('Missing Airtable credentials');
  process.exit(1);
}

Airtable.configure({ apiKey: API_KEY });
const base = new Airtable().base(BASE_ID);

const TEST_ACCOUNTS = [
  { email: 'testadmin@waveclosers.com', name: 'Test Admin', role: 'admin', password: 'TestAdmin1!' },
  { email: 'testrecruiter@waveclosers.com', name: 'Test Recruiter', role: 'recruiter', password: 'TestRecruiter1!' },
  { email: 'testwcr@waveclosers.com', name: 'Test WCR Agent', role: 'wave_closer_recruiter', password: 'TestWcr1!' }
];

async function createOrUpdate(member) {
  try {
    const existing = await base('Staff')
      .select({ filterByFormula: `{Email} = "${member.email}"`, maxRecords: 1 })
      .all();

    const hash = hashPassword(member.password);
    const fields = {
      Email: member.email,
      Name: member.name,
      Role: member.role,
      PasswordHash: hash,
      MustChangePassword: false
    };

    if (existing.length) {
      await base('Staff').update(existing[0].id, {
        Name: member.name,
        Role: member.role,
        PasswordHash: hash,
        MustChangePassword: false
      });
      console.log(`Updated test account: ${member.email}`);
    } else {
      await base('Staff').create(fields);
      console.log(`Created test account: ${member.email}`);
    }
  } catch (err) {
    console.error(`Failed for ${member.email}:`, err.message);
  }
}

async function run() {
  console.log('Seeding test credentials...');
  for (const acct of TEST_ACCOUNTS) {
    await createOrUpdate(acct);
  }
  console.log('Test seeding complete!');
}

run();
