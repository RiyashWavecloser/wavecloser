import dotenv from 'dotenv';
dotenv.config();
import Airtable from 'airtable';

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

Airtable.configure({ apiKey: API_KEY });
const base = new Airtable().base(BASE_ID);

async function checkStaff() {
  const recs = await base('Staff').select().all();
  console.log('\n--- STAFF TABLE ---');
  recs.forEach(r => {
    console.log(`Email: ${r.get('Email')} | Name: ${r.get('Name')} | Role: ${r.get('Role')} | Hash: ${r.get('PasswordHash') ? 'set' : 'empty'}`);
  });
  console.log('-------------------\n');
}

checkStaff().catch(err => console.error('Error:', err.message));
