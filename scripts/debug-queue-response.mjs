import dotenv from 'dotenv';
dotenv.config();
import { getQualificationQueue } from '../server/airtableClient.js';

async function run() {
  try {
    const queue = await getQualificationQueue();
    console.log(`getQualificationQueue returned ${queue.length} leads:`);
    queue.forEach((l, idx) => {
      console.log(`\nLead #${idx + 1}:`);
      console.log(`  businessName: "${l.businessName}"`);
      console.log(`  qualifierStatus: "${l.qualifierStatus}"`);
      console.log(`  status: "${l.status}"`);
      console.log(`  qualifierContactedAt: ${l.qualifierContactedAt}`);
      console.log(`  qualifierQualifiedAt: ${l.qualifierQualifiedAt}`);
    });
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
