/**
 * simulate_ddos.js
 * Simulates a DDoS brute-force attack against the login endpoint.
 *
 * Usage:
 *   node scripts/simulate_ddos.js
 *
 * Requirements:
 *   - Server must be running: npm run dev
 */

const TARGET = 'http://localhost:3000/api/auth/login';
const EMAIL  = 'victim@example.com';

const PASSWORDS = [
  '123456', 'password', 'qwerty', 'admin', 'letmein',
  'welcome', 'monkey', 'dragon', 'master', '123123',
  'abc123', 'iloveyou', 'sunshine', 'princess', 'football',
  'shadow', 'superman', 'michael', 'password1', '12345678',
];

async function sendLoginRequest(password, index) {
  const start = Date.now();
  try {
    const res = await fetch(TARGET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password }),
    });
    const elapsed = Date.now() - start;
    const data = await res.json();

    if (res.status === 429) {
      const retry = data.retryAfter ?? '?';
      console.log(`[${String(index).padStart(2, '0')}] BLOCKED  (429) — tried: '${password}' — retry in ${retry}s`);
      return 'blocked';
    } else {
      const label = res.status === 200 ? 'LOGIN OK' : 'Wrong pw';
      console.log(`[${String(index).padStart(2, '0')}] ${label} (${res.status}) — tried: '${password}' — ${elapsed}ms`);
      return 'allowed';
    }
  } catch (err) {
    console.log(`[${String(index).padStart(2, '0')}] ERROR — ${err.message}`);
    return 'error';
  }
}

async function main() {
  const total = PASSWORDS.length;
  console.log(`Starting DDoS simulation — ${total} requests to ${TARGET}`);
  console.log(`Target account: ${EMAIL}`);
  console.log('-'.repeat(60));

  let allowed = 0, blocked = 0, errors = 0;

  for (let i = 0; i < total; i++) {
    const result = await sendLoginRequest(PASSWORDS[i], i + 1);
    if (result === 'allowed') allowed++;
    else if (result === 'blocked') blocked++;
    else errors++;
  }

  console.log('-'.repeat(60));
  console.log(`RESULT : ${allowed} processed | ${blocked} blocked | ${errors} errors`);
  console.log(`Success: ${Math.round((allowed / total) * 100)}% of attack requests reached the server`);
  console.log(`Blocked: ${Math.round((blocked / total) * 100)}% of attack requests were rejected`);
}

main();
