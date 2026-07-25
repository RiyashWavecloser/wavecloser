import dotenv from 'dotenv';
dotenv.config();
import Airtable from 'airtable';

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

Airtable.configure({ apiKey: API_KEY });
const base = new Airtable().base(BASE_ID);

async function run() {
  try {
    console.log('Checking ResumeLeads...');
    const recs1 = await base('ResumeLeads').select({ maxRecords: 1 }).all();
    console.log('ResumeLeads exists! Records count:', recs1.length);
    if (recs1.length > 0) {
      console.log('Fields in ResumeLeads:', Object.keys(recs1[0].fields));
    }
  } catch (err) {
    console.error('Error with ResumeLeads:', err.message);
  }

  try {
    console.log('Checking ResumeDeduplicationRegistry...');
    const recs2 = await base('ResumeDeduplicationRegistry').select({ maxRecords: 1 }).all();
    console.log('ResumeDeduplicationRegistry exists! Records count:', recs2.length);
    if (recs2.length > 0) {
      console.log('Fields in ResumeDeduplicationRegistry:', Object.keys(recs2[0].fields));
    }
  } catch (err) {
    console.error('Error with ResumeDeduplicationRegistry:', err.message);
  }
}

run();
