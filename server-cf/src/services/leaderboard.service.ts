/**
 * @fileoverview Leaderboard service — Cloudflare Workers port.
 */

import * as LeaderboardModel from '../models/leaderboard.model';
import type { LocationFilter } from '../models/leaderboard.model';
import { validateScore } from './anticheat.service';

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
}

export async function submitScore(db: D1Database, data: SubmitScoreData) {
  // Validate the score
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
