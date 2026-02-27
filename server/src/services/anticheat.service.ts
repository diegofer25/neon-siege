import { env } from '../config/env';

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

// Max plausible score per wave (generous upper bound)
const MAX_SCORE_PER_WAVE = 15_000;

// Max wave in the game
const MAX_WAVE = 30;

export async function validateScore(payload: ScorePayload): Promise<ValidationResult> {
  // Hard rejection: impossible wave
  if (payload.wave < 1 || payload.wave > MAX_WAVE) {
    return { valid: false, flagged: true, reason: 'Invalid wave number' };
  }

  // Hard rejection: negative score
  if (payload.score < 0) {
    return { valid: false, flagged: true, reason: 'Negative score' };
  }

  // Hard rejection: game too short for the waves played this session
  // startWave > 1 means the run was loaded from a save — only count waves played since load
  const wavesPlayed = payload.wave - Math.max(1, payload.startWave ?? 1);
  if (payload.gameDurationMs !== undefined && wavesPlayed > 5 && payload.gameDurationMs < MIN_GAME_DURATION_MS) {
    return { valid: false, flagged: true, reason: 'Game duration too short for waves reached' };
  }

  // Soft flag: score-to-wave ratio too high
  const maxPlausibleScore = payload.wave * MAX_SCORE_PER_WAVE;
  if (payload.score > maxPlausibleScore) {
    return { valid: true, flagged: true, reason: 'Score exceeds plausible range for waves completed' };
  }

  // Soft flag: kills-to-wave ratio implausible (more than ~50 kills per wave seems high)
  if (payload.kills > payload.wave * 60) {
    return { valid: true, flagged: true, reason: 'Kill count exceeds plausible range' };
  }

  // Soft flag: level too high for wave count
  if (payload.level > payload.wave * 2) {
    return { valid: true, flagged: true, reason: 'Level exceeds plausible range for waves completed' };
  }

  return { valid: true, flagged: false };
}

export async function verifyChecksum(payload: string, checksum: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.SCORE_HMAC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expected = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return expected === checksum;
}
