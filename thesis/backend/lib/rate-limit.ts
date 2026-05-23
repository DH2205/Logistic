interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store: key (IP) → { count, resetAt }
const store = new Map<string, RateLimitEntry>();

/**
 * Check if a request is within the allowed rate for a given key (IP address).
 *
 * @param key      - Usually the client IP address
 * @param max      - Max requests allowed within the window
 * @param windowMs - Time window in milliseconds (default: 60 seconds)
 */
export function checkRateLimit(
  key: string,
  max: number,
  windowMs = 60_000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  // No entry yet, or the window has expired — start a fresh window
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs };
  }

  // Window is still active — check against limit
  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  // Within limit — increment and allow
  entry.count++;
  return { allowed: true, remaining: max - entry.count, resetAt: entry.resetAt };
}

/**
 * Extract the real client IP from a Next.js request.
 * Handles reverse proxies (Vercel, Nginx) via x-forwarded-for header.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}
