/**
 * @fileoverview Hybrid save-state manager.
 *
 * When the player is authenticated saves are written to the server (with a
 * session-token anti-forgery check) and mirrored in localStorage as a fast
 * offline fallback.  Unauthenticated users get localStorage-only saves, which
 * is the legacy behaviour.
 *
 * Public API is intentionally synchronous so callers don't need to change:
 *   hasSave()        — reads in-memory cache (populated by init())
 *   getRawSave()     — reads in-memory cache
 *   saveSnapshot()   — sync write to cache + localStorage; async to server
 *   clearSave()      — sync clear everywhere; async delete on server
 *
 * Call `await saveStateManager.init()` once after auth is restored to pull
 * the canonical save from the server into the in-memory cache.
 */

import { telemetry } from './TelemetryManager.js';
import { isAuthenticated } from '../services/AuthService.js';
import {
    loadSaveFromServer,
    persistSaveToServer,
    deleteSaveFromServer,
    startSaveSession,
    getSaveSessionToken,
    clearSaveSession,
} from '../services/SaveApiService.js';

const SAVE_STORAGE_KEY = 'neon_td_save_v2';
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
     * Load the canonical save into the in-memory cache.
     * If authenticated:  fetch from server (authoritative); fall back to
     *                    localStorage on network error.
     * If not:            load from localStorage.
     *
     * Should be awaited once after the auth session is restored.
     */
    async init() {
        this._initialized = true;

        if (isAuthenticated()) {
            try {
                const serverSave = await loadSaveFromServer();
                if (serverSave) {
                    this._cache = serverSave;
                    // Mirror to localStorage so offline resumption still works
                    this._writeToLocalStorage(serverSave);
                } else {
                    // No server save — check if there's a pending local save to
                    // honour (e.g. guest→authenticated upgrade).
                    this._cache = this._readFromLocalStorage();
                }
            } catch {
                // Network is down — fall back to local copy
                this._cache = this._readFromLocalStorage();
            }
        } else {
            this._cache = this._readFromLocalStorage();
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
     * Sync path: updates the in-memory cache + localStorage immediately.
     * Async path: sends to the server in the background (fire-and-forget).
     *
     * On the first call per run, requests a fresh session token from the server
     * so that the save is tied to a real game session.
     *
     * @param {object} snapshot
     * @returns {boolean} true if the local write succeeded
     */
    saveSnapshot(snapshot) {
        const payload = {
            schemaVersion: SAVE_SCHEMA_VERSION,
            savedAt: Date.now(),
            ...snapshot,
        };

        // Update cache synchronously
        this._cache = payload;

        // Persist locally
        const localOk = this._writeToLocalStorage(payload);

        // Fire-and-forget server sync for authenticated users
        if (isAuthenticated()) {
            this._syncToServer(payload);
        }

        telemetry.track('save_created', {
            wave: payload.wave ?? payload.legacyCompat?.wave,
            checkpointWave: payload.checkpointWave ?? payload.legacyCompat?.checkpointWave,
            gameState: payload.gameState ?? payload.legacyCompat?.gameState,
        });

        return localOk;
    }

    /**
     * Clear the save everywhere.
     * Sync: clears cache + localStorage immediately.
     * Async: deletes from server if authenticated.
     *
     * @returns {boolean} always true (optimistic)
     */
    clearSave() {
        this._cache = null;
        clearSaveSession();

        try {
            localStorage.removeItem(SAVE_STORAGE_KEY);
        } catch { /* ignore */ }

        if (isAuthenticated()) {
            deleteSaveFromServer().catch(err =>
                console.warn('[SaveStateManager] Server delete failed:', err.message)
            );
        }

        telemetry.track('save_cleared');
        return true;
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    _readFromLocalStorage() {
        try {
            const raw = localStorage.getItem(SAVE_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }

    _writeToLocalStorage(payload) {
        try {
            localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Async background sync to the server.
     * Lazily requests a session token the first time it's needed.
     * @param {object} payload
     */
    async _syncToServer(payload) {
        try {
            // Lazy session initialisation — only start one if we don't have one
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
