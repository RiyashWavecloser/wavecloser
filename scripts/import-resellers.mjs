import dotenv from 'dotenv'; dotenv.config();
import { upsertUsers } from '../server/airtableClient.js';

const MISSING = [
  { id:'WC-1003', name:'Priya Shah',    type:'RESELLER', stage:5, leadsThisWeek:9,  dealsThisMonth:3, joined:'2026-04-25', market:'Austin, TX',   email:'priya@example.com',  notes:'Awaiting lead deployment to landing page.' },
  { id:'WC-1006', name:'Jonas Kessler', type:'RESELLER', stage:4, leadsThisWeek:0,  dealsThisMonth:0, joined:'2026-05-04', market:'Phoenix, AZ',  email:'jonas@example.com',  notes:'CX onboarding in progress (Mildred).' },
  { id:'WC-1011', name:'Sara Bergmann', type:'RESELLER', stage:6, leadsThisWeek:14, dealsThisMonth:6, joined:'2026-04-08', market:'Boston, MA',   email:'sara@example.com',   notes:'Best reseller this week.' },
];

console.log('Importing 3 RESELLER users...');
const result = await upsertUsers(MISSING);
console.log('Result:', result);
