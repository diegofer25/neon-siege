import * as LeaderboardModel from '../models/leaderboard.model';
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
  clientVersion?: string;
  checksum?: string;
}

export async function submitScore(data: SubmitScoreData) {
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
    checksum: data.checksum,
  });

  if (!validation.valid) {
    throw new Error(validation.reason || 'Score rejected by anti-cheat');
  }

  // Create the entry
  const entry = await LeaderboardModel.createEntry({
    ...data,
    flagged: validation.flagged,
  });

  // Get the user's rank
  const rank = await LeaderboardModel.getUserRank(data.userId, data.difficulty);

  return { entry, rank, flagged: validation.flagged };
}

export async function getLeaderboard(difficulty: string, limit: number, offset: number, userId?: string) {
  const result = await LeaderboardModel.getLeaderboard(difficulty, limit, offset);

  let userRank: number | null = null;
  if (userId) {
    userRank = await LeaderboardModel.getUserRank(userId, difficulty);
  }

  return { ...result, userRank };
}

export async function getUserEntries(userId: string, difficulty: string, limit: number) {
  return LeaderboardModel.getUserEntries(userId, difficulty, limit);
}
