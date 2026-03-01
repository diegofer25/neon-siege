/**
 * @fileoverview Collects diagnostics from all available game buffers for bug reports.
 *
 * Gathers: console logs, network history, game-store action log, FSM transition
 * history, performance stats, and browser/environment metadata into a single
 * JSON-serializable object.
 */

import { getConsoleLogs } from './LogCollector.js';
import { getNetworkHistory } from '../services/ApiClient.js';
import { game } from '../main.js';

/**
 * @typedef {Object} DiagnosticsSnapshot
 * @property {number} timestamp
 * @property {string} userAgent
 * @property {string} url
 * @property {{ width: number, height: number }} screenResolution
 * @property {string|null} gameState
 * @property {import('./LogCollector.js').LogEntry[]} consoleLogs
 * @property {import('../services/ApiClient.js').NetworkEntry[]} networkHistory
 * @property {Array} gameActions
 * @property {Array} fsmTransitions
 * @property {Object|null} performanceStats
 * @property {number[]} fpsHistory
 */

/**
 * Snapshot all diagnostic data for attachment to a bug report.
 * @returns {DiagnosticsSnapshot}
 */
export function collectDiagnostics() {
  /** @type {DiagnosticsSnapshot} */
  const snapshot = {
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    screenResolution: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    gameState: null,
    consoleLogs: getConsoleLogs(),
    networkHistory: getNetworkHistory(),
    gameActions: [],
    fsmTransitions: [],
    performanceStats: null,
    fpsHistory: [],
  };

  // Tap into game instance if available
  if (game) {
    try {
      snapshot.gameState = game.gameState ?? null;
    } catch { /* ignore */ }

    try {
      if (game.store && typeof game.store.getActionLog === 'function') {
        snapshot.gameActions = game.store.getActionLog();
      }
    } catch { /* ignore */ }

    try {
      if (game.fsm && typeof game.fsm.getHistory === 'function') {
        snapshot.fsmTransitions = game.fsm.getHistory();
      }
    } catch { /* ignore */ }

    try {
      if (game.performanceManager) {
        snapshot.performanceStats = game.performanceManager.getStats();
        snapshot.fpsHistory = game.performanceManager.fpsHistory?.slice() ?? [];
      }
    } catch { /* ignore */ }
  }

  return snapshot;
}

/**
 * Collect diagnostics and return as a JSON Blob (for FormData attachment).
 * @returns {Blob}
 */
export function collectDiagnosticsBlob() {
  const data = collectDiagnostics();
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}
