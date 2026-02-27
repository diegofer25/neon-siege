/**
 * @fileoverview Server-authoritative save-state manager.
 *
 * All saves go to the server — there is no localStorage fallback.
 * Every user (including anonymous guests) is authenticated before the game
 * runs, so the server path is always available.
 *
 * Public API is synchronous so callers don't need to change:
 *   hasSave()        — reads in-memory cache (populated by init())
 *   getRawSave()     — reads in-memory cache
 *   saveSnapshot()   — sync write to cache; async fire-and-forget to server
 *   clearSave()      — sync clear of cache; async DELETE on server
 *
 * Call `await saveStateManager.init()` once after auth is restored to pull
 * the canonical save from the server into the in-memory cache.
 */

import { telemetry } from './TelemetryManager.js';
import {
    loadSaveFromServer,
    persistSaveToServer,
    deleteSaveFromServer,
    startSaveSession,
    getSaveSessionToken,
    clearSaveSession,
} from '../services/SaveApiService.js';

const SAVE_SCHEMA_VERSION = 2;

export class SaveStateManager {
    constructor() {
        /** @type {object|null} In-memory cache — source of truth for sync reads. */
        this._cache = null;
        /** Whether init() has been called at least once. */
        this._initialized = false;
    }

    // ─── Initialisation ──────────────────────────────────────────────────────

    /**
     * Load the canonical save into the in-memory cache from the server.
     * Should be awaited once after the auth session is restored and again
     * after every successful login / account switch.
     */
    async init() {
        this._initialized = true;
        try {
            const serverSave = await loadSaveFromServer();
            this._cache = serverSave; // null when the user has no save yet
        } catch (err) {
            console.warn('[SaveStateManager] Could not load save from server:', err.message);
            // Keep whatever was in _cache (null on first load, stale on retry)
        }
    }

    // ─── Sync public API (safe to call anywhere) ──────────────────────────────

    /** @returns {boolean} */
    hasSave() {
        return this._cache !== null;
    }

    /** @returns {object|null} */
    getRawSave() {
        return this._cache;
    }

    /**
     * Persist a save snapshot.
     * Sync path: updates the in-memory cache immediately.
     * Async path: sends to the server in the background (fire-and-forget).
     *
     * On the first call per run, requests a fresh session token from the server
     * so that the save is tied to a real game session.
     *
     * @param {object} snapshot
     */
    saveSnapshot(snapshot) {
        const payload = {
            schemaVersion: SAVE_SCHEMA_VERSION,
            savedAt: Date.now(),
            ...snapshot,
        };

        // Update cache synchronously — callers can read hasSave() / getRawSave() immediately
        this._cache = payload;

        // Fire-and-forget server sync
        this._syncToServer(payload);

        telemetry.track('save_created', {
            wave: payload.wave ?? payload.legacyCompat?.wave,
            checkpointWave: payload.checkpointWave ?? payload.legacyCompat?.checkpointWave,
            gameState: payload.gameState ?? payload.legacyCompat?.gameState,
        });
    }

    /**
     * Clear the save.
     * Sync: clears in-memory cache immediately.
     * Async: deletes from server.
     *
     * @returns {boolean} always true (optimistic)
     */
    clearSave() {
        this._cache = null;
        clearSaveSession();

        deleteSaveFromServer().catch(err =>
            console.warn('[SaveStateManager] Server delete failed:', err.message)
        );

        telemetry.track('save_cleared');
        return true;
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    /**
     * Async background sync to the server.
     * Lazily requests a session token the first time it's needed.
     * @param {object} payload
     */
    async _syncToServer(payload) {
        try {
            if (!getSaveSessionToken()) {
                await startSaveSession();
            }
            await persistSaveToServer(payload);
        } catch (err) {
            console.warn('[SaveStateManager] Server sync failed:', err.message);
        }
    }
}

export const saveStateManager = new SaveStateManager();
