"""
simulate_ddos.py
Simulates a DDoS brute-force attack against the login endpoint.

Usage:
    python scripts/simulate_ddos.py

Requirements:
    pip install requests
    npm run dev  (server must be running on localhost:3000)
"""

import requests
import time

TARGET    = "http://localhost:3000/api/auth/login"
EMAIL     = "victim@example.com"
TOTAL     = 10

PASSWORDS = [
    "123456", "password", "qwerty", "admin", "letmein",
    "welcome", "monkey", "dragon", "master", "123123",
]

results = {"allowed": 0, "blocked": 0, "errors": 0}

print(f"Starting DDoS simulation — {TOTAL} requests to {TARGET}")
print(f"Target account: {EMAIL}")
print("-" * 60)

for i, password in enumerate(PASSWORDS[:TOTAL], start=1):
    try:
        start = time.time()
        r = requests.post(TARGET, json={"email": EMAIL, "password": password}, timeout=5)
        elapsed = round((time.time() - start) * 1000)

        if r.status_code == 429:
            results["blocked"] += 1
            retry = r.json().get("retryAfter", "?")
            print(f"[{i:02d}] BLOCKED  (429) — tried: '{password}' — retry in {retry}s")
        elif r.status_code in (200, 401):
            results["allowed"] += 1
            label = "LOGIN OK" if r.status_code == 200 else "Wrong pw"
            print(f"[{i:02d}] {label} ({r.status_code}) — tried: '{password}' — {elapsed}ms")
        else:
            results["errors"] += 1
            print(f"[{i:02d}] Unexpected ({r.status_code}) — {r.text[:80]}")

    except requests.exceptions.RequestException as e:
        results["errors"] += 1
        print(f"[{i:02d}] ERROR — {e}")

print("-" * 60)
print(f"RESULT : {results['allowed']} processed | {results['blocked']} blocked | {results['errors']} errors")
print(f"Success: {round(results['allowed'] / TOTAL * 100)}% of attack requests reached the server")
print(f"Blocked: {round(results['blocked'] / TOTAL * 100)}% of attack requests were rejected")
