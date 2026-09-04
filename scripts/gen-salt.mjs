/**
 * Prints a fresh IP_HASH_SALT.
 *
 *   bun run salt
 *
 * The salt is what turns a stored IP digest from something reversible into a
 * pseudonym: without a secret, hashing the whole IPv4 space and matching the
 * results is a few hours of work. See the README for what that means for GDPR.
 *
 * Changing it invalidates every stored digest, which is also the intended way
 * to clear the deduplication history.
 */
import { randomBytes } from 'node:crypto';

const salt = randomBytes(32).toString('base64url');

console.log('');
console.log('  IP_HASH_SALT');
console.log(`  ${salt}`);
console.log('');
console.log('  Add it in Vercel: Project -> Settings -> Environment Variables.');
console.log('  Apply to Production, Preview and Development, then redeploy.');
console.log('');
console.log('  Locally, put it in .env (already gitignored):');
console.log(`  IP_HASH_SALT=${salt}`);
console.log('');
