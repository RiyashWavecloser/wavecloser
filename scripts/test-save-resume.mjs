import dotenv from 'dotenv';
dotenv.config();
import Airtable from 'airtable';

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

Airtable.configure({ apiKey: API_KEY });
const base = new Airtable().base(BASE_ID);

async function run() {
  console.log('Testing create on ResumeLeads...');
  try {
    const res = await base('ResumeLeads').create({
      Title: 'Test Title',
      Description: 'Test Description',
      Phone: '123-456-7890',
      Email: 'test@example.com',
      CraigslistURL: 'https://newyork.craigslist.org/mnh/res/test.html',
      Market: 'New York, NY',
      AssignedTo: 'Test Agent',
      AssignedDate: '2026-07-18',
      Status: 'New',
      OutreachNotes: 'Test notes',
    });
    console.log('ResumeLeads create success! ID:', res.id);
  } catch (err) {
    console.error('ResumeLeads create FAILED:', err.message);
  }

  console.log('\nTesting create on ResumeDeduplicationRegistry...');
  try {
    const res = await base('ResumeDeduplicationRegistry').create({
      CraigslistURL: 'https://newyork.craigslist.org/mnh/res/test.html',
      FirstSeenAt: new Date().toISOString(),
      AssignedTo: 'Test Agent',
      AssignedDate: '2026-07-18',
    });
    console.log('ResumeDeduplicationRegistry create success! ID:', res.id);
  } catch (err) {
    console.error('ResumeDeduplicationRegistry create FAILED:', err.message);
  }
}

run();
