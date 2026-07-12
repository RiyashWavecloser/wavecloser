/**
 * scripts/hash-password.mjs
 *
 * Helper script to generate secure PBKDF2 password hashes for insertion into the Airtable 'Staff' table.
 *
 * Usage:
 *   node scripts/hash-password.mjs <your-password>
 */

import { hashPassword } from '../server/auth.js';

const password = process.argv[2];
if (!password) {
  console.log('\nUsage:');
  console.log('  node scripts/hash-password.mjs <password>\n');
  process.exit(1);
}

const hash = hashPassword(password);
console.log('\n================================================================');
console.log(`Password:    ${password}`);
console.log(`Airtable PasswordHash value:\n\n${hash}`);
console.log('================================================================\n');
