/**
 * @fileoverview IP geolocation via ip-api.com (free tier, no API key).
 * Resolves IP → { country, countryCode, region, city }.
 *
 * - In-memory cache with 24-hour TTL to stay well within 45 req/min.
 * - Private / localhost IPs are silently skipped.
 * - All errors are swallowed — location is always best-effort.
 */

export interface GeoLocation {
  country: string;
  countryCode: string;
  region: string;
  city: string;
}

/* ── In-memory cache ──────────────────────────────────────────────────── */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const cache = new Map<string, { data: GeoLocation; expiresAt: number }>();

/* ── Private IP detection ─────────────────────────────────────────────── */
const PRIVATE_RE =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|0\.0\.0\.0|localhost)/;

function isPrivateIp(ip: string): boolean {
  return PRIVATE_RE.test(ip);
}

/* ── Public API ───────────────────────────────────────────────────────── */

/**
 * Resolve an IP address to a geographic location.
 * Returns `null` for private IPs, cache misses that fail, or any error.
 */
export async function resolveLocation(ip: string): Promise<GeoLocation | null> {
  if (!ip || isPrivateIp(ip)) return null;

  // Check cache
  const cached = cache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city`,
      { signal: AbortSignal.timeout(3_000) }
    );

    if (!res.ok) return null;

    const json = (await res.json()) as {
      status: string;
      country?: string;
      countryCode?: string;
      regionName?: string;
      city?: string;
    };

    if (json.status !== 'success') return null;

    const data: GeoLocation = {
      country: json.country ?? '',
      countryCode: json.countryCode ?? '',
      region: json.regionName ?? '',
      city: json.city ?? '',
    };

    cache.set(ip, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  } catch {
    // Network error, timeout, etc. — silently ignore
    return null;
  }
}

/**
 * Extract the real client IP from request headers.
 * Checks X-Forwarded-For, X-Real-IP, then falls back to Bun server IP.
 */
export function extractClientIp(
  headers: Record<string, string | undefined>,
  server?: { requestIP?: (req: Request) => { address: string } | null },
  request?: Request
): string | null {
  // 1. X-Forwarded-For (first entry = original client)
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }

  // 2. X-Real-IP
  const realIp = headers['x-real-ip'];
  if (realIp) return realIp.trim();

  // 3. Bun server.requestIP()
  if (server?.requestIP && request) {
    try {
      const info = server.requestIP(request);
      if (info?.address) return info.address;
    } catch {
      // ignore
    }
  }

  return null;
}
