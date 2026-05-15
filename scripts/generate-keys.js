/**
 * Activation Key Generator
 * ────────────────────────────────────────────────
 * Generates XXXX-XXXX-XXXX-XXXX format keys using
 * uppercase alphanumeric characters (excluding ambiguous
 * chars: 0/O, 1/I/L).
 *
 * Usage:
 *   node scripts/generate-keys.js 10
 *   node scripts/generate-keys.js 5 --user "Client A"
 *   node scripts/generate-keys.js 3 --api http://localhost:8001
 *
 * Options:
 *   --user "Name"    Assign a user to all generated keys
 *   --api URL        Auto-push keys to the backend via bulk API
 *   --secret KEY     Admin secret for API auth (default: env ACTIVATION_ADMIN_SECRET)
 */

import crypto from 'crypto';

// Characters excluding ambiguous ones: 0/O, 1/I/L
const CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function generateSegment(length = 4) {
  let segment = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    segment += CHARSET[bytes[i] % CHARSET.length];
  }
  return segment;
}

function generateKey() {
  return [
    generateSegment(4),
    generateSegment(4),
    generateSegment(4),
    generateSegment(4),
  ].join('-');
}

async function main() {
  const args = process.argv.slice(2);

  // Parse count (first positional arg)
  const count = parseInt(args[0], 10) || 5;

  // Parse flags
  let user = '';
  let apiUrl = '';
  let adminSecret = process.env.ACTIVATION_ADMIN_SECRET || '';

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--user' && args[i + 1]) {
      user = args[++i];
    }
    if (args[i] === '--api' && args[i + 1]) {
      apiUrl = args[++i];
    }
    if (args[i] === '--secret' && args[i + 1]) {
      adminSecret = args[++i];
    }
  }

  console.log(`\n🔑 Generating ${count} activation key(s):\n`);

  const keys = [];
  for (let i = 0; i < count; i++) {
    const key = generateKey();
    keys.push(key);
    console.log(`  ${i + 1}. ${key}`);
  }

  console.log('');

  // Push to API if --api is provided
  if (apiUrl) {
    if (!adminSecret) {
      console.error('❌ --secret or ACTIVATION_ADMIN_SECRET env var is required for API push.');
      process.exit(1);
    }

    console.log(`📡 Pushing ${keys.length} key(s) to ${apiUrl}/api/activation/keys/bulk ...`);

    try {
      const payload = {
        keys: keys.map((k) => ({ key: k, user, expiry: null })),
      };

      const response = await fetch(`${apiUrl}/api/activation/keys/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        console.log(`✅ ${result.count} key(s) stored in database.`);
      } else {
        console.error(`❌ API error: ${result.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(`❌ Network error: ${err.message}`);
    }
  }

  console.log('\n✅ Done! Use these keys with your backend endpoint.\n');
}

main();
