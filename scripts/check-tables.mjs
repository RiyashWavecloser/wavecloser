import dotenv from 'dotenv';
dotenv.config();
import Airtable from 'airtable';

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

Airtable.configure({ apiKey: API_KEY });
const base = new Airtable().base(BASE_ID);

async function checkFields() {
  // Get one full record to see ALL field names
  const recs = await base('Leads').select({ maxRecords: 1 }).all();
  if (recs.length > 0) {
    console.log('ALL fields in Leads table:');
    console.log(Object.keys(recs[0].fields));
  }

  // Try to update a test field to see what works
  // Find a lead with status Interested
  const interested = await base('Leads')
    .select({ filterByFormula: `{Status} = "Interested"`, maxRecords: 1 })
    .all();
  if (interested.length > 0) {
    console.log('\nSample Interested lead fields:');
    console.log(JSON.stringify(interested[0].fields, null, 2));
  } else {
    console.log('\nNo Interested leads found');
  }
}

checkFields().catch(err => console.error('Error:', err.message));
