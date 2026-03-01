/**
 * @fileoverview Constant-time comparison and crypto helpers for Workers runtime.
 *
 * All cryptographic equality checks **must** use `timingSafeEqual` to prevent
 * timing side-channel attacks.  Workers support `crypto.subtle.timingSafeEqual`
 * since 2024-09-25 compat date, but we use a manual constant-time comparison
 * on byte arrays as a portable fallback.
 */

/**
 * Convert a hex string to a Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Constant-time comparison of two equal-length byte arrays.
 * Returns false immediately if lengths differ (not a timing concern — the
 * attacker already knows expected length from the algorithm).
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Timing-safe comparison of two hex-encoded strings.
 *
 * Use this everywhere you compare HMAC signatures, password hashes,
 * checksums, or any other secret-derived value.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return constantTimeEqual(hexToBytes(a), hexToBytes(b));
}
