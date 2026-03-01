/**
 * @fileoverview Anti-cheat score validation — Cloudflare Workers port.
 *
 * Already used Web Crypto in the original — fully compatible.
 */

import { timingSafeEqual } from './crypto.utils';

interface ScorePayload {
  score: number;
  wave: number;
  kills: number;
  maxCombo: number;
  level: number;
  isVictory: boolean;
  difficulty: string;
  gameDurationMs?: number;
  startWave?: number;
  checksum?: string;
}

interface ValidationResult {
  valid: boolean;
  flagged: boolean;
  reason?: string;
}

// Min duration: ~10 minutes for a decent run
const MIN_GAME_DURATION_MS = 600_000;

// Max plausible score per wave.
// Realistic breakdown at wave 30 (absolute ceiling):
//   Kill score: ~40 enemies × 25 base × 3.0 combo × 4.0 wave mult ≈ 12K
//   Boss kill:  500 × 3.0 × 4.0 ≈ 6K
//   Wave clear: 100 × 30 + 200 speed + 300 perfect ≈ 3.5K
//   Combo tier: ≈ 1.2K
//   Loot/misc:  ≈ 1K
// Total ≈ ~24K at wave 30. Using 12K as a generous per-wave average
// (factoring that early waves score much less).
const MAX_SCORE_PER_WAVE = 12_000;

export async function validateScore(payload: ScorePayload): Promise<ValidationResult> {
  // Hard rejection: impossible wave
  if (payload.wave < 1) {
    return { valid: false, flagged: true, reason: 'Invalid wave number' };
  }

  // Hard rejection: negative score
  if (payload.score < 0) {
    return { valid: false, flagged: true, reason: 'Negative score' };
  }

  // Hard rejection: game too short for the waves played this session
  const wavesPlayed = payload.wave - Math.max(1, payload.startWave ?? 1);
  if (payload.gameDurationMs !== undefined && wavesPlayed > 5 && payload.gameDurationMs < MIN_GAME_DURATION_MS) {
    return { valid: false, flagged: true, reason: 'Game duration too short for waves reached' };
  }

  // Soft flag: score-to-wave ratio too high
  const maxPlausibleScore = payload.wave * MAX_SCORE_PER_WAVE;
  if (payload.score > maxPlausibleScore) {
    return { valid: true, flagged: true, reason: 'Score exceeds plausible range for waves completed' };
  }

  // Soft flag: kills-to-wave ratio implausible
  if (payload.kills > payload.wave * 60) {
    return { valid: true, flagged: true, reason: 'Kill count exceeds plausible range' };
  }

  // Soft flag: level too high for wave count
  if (payload.level > payload.wave * 2) {
    return { valid: true, flagged: true, reason: 'Level exceeds plausible range for waves completed' };
  }

  return { valid: true, flagged: false };
}

export async function verifyChecksum(
  payload: string,
  checksum: string,
  scoreHmacSecret: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(scoreHmacSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expected = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return timingSafeEqual(expected, checksum);
}
