/**
 * @fileoverview Leaderboard service — Cloudflare Workers port.
 */

import * as LeaderboardModel from '../models/leaderboard.model';
import type { LocationFilter } from '../models/leaderboard.model';
import { validateScore, verifyChecksum } from './anticheat.service';

interface SubmitScoreData {
  userId: string;
  difficulty: string;
  score: number;
  wave: number;
  kills: number;
  maxCombo: number;
  level: number;
  isVictory: boolean;
  runDetails: LeaderboardModel.RunDetails;
  gameDurationMs?: number;
  startWave?: number;
  clientVersion?: string;
  checksum?: string;
  continuesUsed?: number;
  /** Per-session HMAC key from game session service — used to verify checksum. */
  sessionHmacKey?: string;
}

export async function submitScore(db: D1Database, data: SubmitScoreData) {
  // SECURITY: Verify HMAC checksum if both checksum and session key are present
  if (data.checksum && data.sessionHmacKey) {
    // Build canonical payload string (sorted, deterministic)
    const checksumPayload = JSON.stringify({
      difficulty: data.difficulty,
      gameDurationMs: data.gameDurationMs ?? 0,
      isVictory: data.isVictory,
      kills: data.kills,
      level: data.level,
      maxCombo: data.maxCombo,
      score: data.score,
      startWave: data.startWave ?? 1,
      wave: data.wave,
    });

    const checksumValid = await verifyChecksum(checksumPayload, data.checksum, data.sessionHmacKey);
    if (!checksumValid) {
      throw new Error('Score checksum verification failed');
    }
  }

  // Validate the score with heuristic anti-cheat
  const validation = await validateScore({
    score: data.score,
    wave: data.wave,
    kills: data.kills,
    maxCombo: data.maxCombo,
    level: data.level,
    isVictory: data.isVictory,
    difficulty: data.difficulty,
    gameDurationMs: data.gameDurationMs,
    startWave: data.startWave,
    checksum: data.checksum,
  });

  if (!validation.valid) {
    throw new Error(validation.reason || 'Score rejected by anti-cheat');
  }

  // Upsert — only replaces if new score is higher
  const { entry, isNewBest } = await LeaderboardModel.upsertEntry(db, {
    ...data,
    flagged: validation.flagged,
  });

  // Get the user's rank
  const rank = await LeaderboardModel.getUserRank(db, data.userId, data.difficulty);

  return { entry, rank, isNewBest, flagged: validation.flagged };
}

export async function getLeaderboard(
  db: D1Database,
  difficulty: string,
  limit: number,
  offset: number,
  userId?: string,
  locationFilter?: LocationFilter,
) {
  const result = await LeaderboardModel.getLeaderboard(db, difficulty, limit, offset, locationFilter);

  let userRank: number | null = null;
  if (userId) {
    userRank = await LeaderboardModel.getUserRank(db, userId, difficulty, locationFilter);
  }

  return { ...result, userRank };
}

export async function getUserEntry(db: D1Database, userId: string, difficulty: string) {
  return LeaderboardModel.getUserEntry(db, userId, difficulty);
}
