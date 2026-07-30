import { hashPassword } from '../server/auth.js';
import { updateStaffPassword, getStaff } from '../server/airtableClient.js';

const newPass = 'AgentTest123!';
const hash = hashPassword(newPass);
console.log('Hash generated:', hash.substring(0, 20) + '...');
await updateStaffPassword('janina@waveclosers.com', hash);
console.log('Password hash written to Airtable for janina@waveclosers.com');

// Verify
const staff = await getStaff('janina@waveclosers.com');
console.log('PasswordHash starts with pbkdf2:', staff.passwordHash.startsWith('pbkdf2'));

// Now verify login
const r = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'janina@waveclosers.com', password: newPass })
});
const d = await r.json();
console.log('Login verify:', r.status, d.user ? 'SUCCESS role=' + d.user.role : d.error);
