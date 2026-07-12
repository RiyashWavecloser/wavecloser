import dotenv from 'dotenv'; dotenv.config();
import Airtable from 'airtable';

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!API_KEY || !BASE_ID) {
  console.error('[delete-dummy-users] ✗ AIRTABLE_API_KEY or AIRTABLE_BASE_ID not set in .env');
  process.exit(1);
}

Airtable.configure({ apiKey: API_KEY });
const base = new Airtable().base(BASE_ID);

const DUMMY_IDS = [
  'WC-1001', 'WC-1002', 'WC-1003', 'WC-1004', 'WC-1005',
  'WC-1006', 'WC-1007', 'WC-1008', 'WC-1009', 'WC-1010',
  'WC-1011', 'WC-1012', 'WC-1013', 'WC-1014', 'WC-1015'
];

async function main() {
  console.log('[delete-dummy-users] Fetching dummy users from Airtable...');
  try {
    const formula = `OR(${DUMMY_IDS.map(id => `{ID} = "${id}"`).join(',')})`;
    const records = await base('Users').select({
      filterByFormula: formula
    }).all();

    console.log(`[delete-dummy-users] Found ${records.length} dummy user records in Airtable.`);

    if (records.length === 0) {
      console.log('[delete-dummy-users] No dummy records found. Nothing to delete.');
      return;
    }

    for (const record of records) {
      const id = record.get('ID');
      const name = record.get('Name');
      console.log(`[delete-dummy-users] Deleting user: ${name} (${id}) [Record ID: ${record.id}]...`);
      await base('Users').destroy(record.id);
      console.log(`[delete-dummy-users] Successfully deleted ${name} (${id}).`);
    }

    console.log('[delete-dummy-users] All dummy users deleted successfully!');
  } catch (err) {
    console.error('[delete-dummy-users] ❌ Error:', err.message);
  }
}

main();
