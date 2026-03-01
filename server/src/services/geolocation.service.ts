/**
 * @fileoverview IP geolocation — Cloudflare Workers port.
 *
 * On Cloudflare Workers, the incoming request object has a `cf` property with
 * geographic data (country, region, city, etc.). We prefer that over ip-api.com
 * when available.
 *
 * Fallback to ip-api.com is kept for local dev (`wrangler dev`) where `cf` may
 * not be populated.
 *
 * In-memory cache is per-isolate (short-lived on Workers), but still useful for
 * local dev and `wrangler dev --remote` scenarios.
 */

export interface GeoLocation {
  country: string;
  countryCode: string;
  region: string;
  city: string;
}

/* ── In-memory cache ──────────────────────────────────────────────────── */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { data: GeoLocation; expiresAt: number }>();

/* ── Private IP detection ─────────────────────────────────────────────── */
const PRIVATE_RE =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|0\.0\.0\.0|localhost)/;

function isPrivateIp(ip: string): boolean {
  return PRIVATE_RE.test(ip);
}

/* ── Extract location from CF request ─────────────────────────────────── */

/**
 * Extract geolocation from Cloudflare's `cf` object on the request.
 * Returns null if the data isn't available (local dev without --remote).
 */
export function resolveLocationFromCf(request: Request): GeoLocation | null {
  const cf = (request as any).cf as
    | { country?: string; regionCode?: string; city?: string; region?: string }
    | undefined;

  if (!cf?.country) return null;

  return {
    country: cf.country,
    countryCode: cf.country, // CF uses ISO-3166-1 alpha-2 for `cf.country`
    region: cf.region ?? cf.regionCode ?? '',
    city: cf.city ?? '',
  };
}

/* ── ip-api.com fallback ──────────────────────────────────────────────── */

export async function resolveLocation(ip: string): Promise<GeoLocation | null> {
  if (!ip || isPrivateIp(ip)) return null;

  const cached = cache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city`,
      { signal: AbortSignal.timeout(3_000) },
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
    return null;
  }
}

/**
 * Extract client IP from Cloudflare request headers.
 * CF-Connecting-IP is set automatically by the Cloudflare edge.
 */
export function getClientIp(request: Request): string | null {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null
  );
}
