import { GameConfig } from '../config/GameConfig.js';
import {
    loadProgressionFromServer,
    persistProgressionToServer,
} from '../services/ProgressionApiService.js';

const PROGRESSION_SCHEMA_VERSION = 1;
/** Debounce delay in ms — prevents a server write on every single wave */
const SAVE_DEBOUNCE_MS = 2000;

/**
 * Handles persistent meta-progression across runs.
 * Data is stored on the server (replaces localStorage neon_td_meta).
 * In-memory state is the authoritative runtime copy; server writes are
 * debounced and fire-and-forget.
 *
 * Call `await progressionManager.init()` after auth is restored to load
 * the server data into memory.
 */
export class ProgressionManager {
    constructor() {
        this.state = this._createDefaultState();
        /** @type {ReturnType<typeof setTimeout>|null} */
        this._saveTimer = null;
    }

    // ─── Initialisation ──────────────────────────────────────────────────────

    /**
     * Load the authoritative progression from the server into memory.
     * Should be called once after auth is restored and after every login.
     */
    async init() {
        try {
            const { data, schemaVersion } = await loadProgressionFromServer();
            const defaults = this._createDefaultState();
            // Merge server data with defaults so new fields are always present
            this.state = {
                ...defaults,
                ...data,
                currencies: { ...defaults.currencies, ...(data.currencies ?? {}) },
                unlocks: { ...defaults.unlocks, ...(data.unlocks ?? {}) },
            };
            // Ignore schemaVersion mismatch for now — last-write-wins is fine
            void schemaVersion;
        } catch (err) {
            console.warn('[ProgressionManager] Failed to load from server, using defaults:', err.message);
            // Keep in-memory defaults — game is still playable
        }
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Record completion of a wave and grant legacy tokens.
     * @param {number} waveNumber
     * @param {boolean} isBossWave
     */
    recordWaveCompletion(waveNumber, isBossWave = false) {
        const tokensEarned = this._calculateWaveReward(isBossWave);
        this._incrementCurrency('LEGACY_TOKENS', tokensEarned);
        this.state.highestWave = Math.max(this.state.highestWave ?? 0, waveNumber);
        this.state.totalWavesCompleted = (this.state.totalWavesCompleted ?? 0) + 1;
        if (isBossWave) {
            this.state.bossWavesCleared = (this.state.bossWavesCleared ?? 0) + 1;
        }
        this._saveState();
    }

    /**
     * Attempt to unlock a permanent upgrade by spending currency.
     * @param {string} unlockKey
     * @returns {boolean} true if unlocked this call.
     */
    unlock(unlockKey) {
        if (this.isUnlocked(unlockKey)) return false;

        const unlockConfig = GameConfig.META.UNLOCKS[unlockKey];
        if (!unlockConfig) {
            console.warn(`[ProgressionManager] Unknown unlock key: ${unlockKey}`);
            return false;
        }

        const cost = unlockConfig.cost ?? 0;
        if (!this.spendCurrency('LEGACY_TOKENS', cost)) return false;

        this.state.unlocks[unlockKey] = true;
        this._saveState();
        return true;
    }

    /** @param {string} unlockKey */
    isUnlocked(unlockKey) {
        return !!this.state.unlocks?.[unlockKey];
    }

    /** @param {string} currencyKey */
    getCurrencyBalance(currencyKey) {
        return this.state.currencies?.[currencyKey] ?? 0;
    }

    /**
     * @param {string} currencyKey
     * @param {number} amount
     * @returns {boolean}
     */
    spendCurrency(currencyKey, amount) {
        if (amount <= 0) return true;
        const balance = this.getCurrencyBalance(currencyKey);
        if (balance < amount) return false;
        this.state.currencies[currencyKey] = balance - amount;
        this._saveState();
        return true;
    }

    /**
     * @param {number} wave
     * @param {number} score
     * @param {number} maxCombo
     * @param {number} totalKills
     * @returns {{isNewBestWave: boolean, isNewBestScore: boolean, isNewBestCombo: boolean}}
     */
    recordRunEnd(wave, score, maxCombo, totalKills) {
        this.state.totalRuns = (this.state.totalRuns ?? 0) + 1;
        this.state.totalKills = (this.state.totalKills ?? 0) + totalKills;

        const isNewBestWave  = wave     > (this.state.bestWave  ?? 0);
        const isNewBestScore = score    > (this.state.bestScore ?? 0);
        const isNewBestCombo = maxCombo > (this.state.bestCombo ?? 0);

        if (isNewBestWave)  this.state.bestWave  = wave;
        if (isNewBestScore) this.state.bestScore = score;
        if (isNewBestCombo) this.state.bestCombo = maxCombo;

        if (!this.state.runHistory) this.state.runHistory = [];
        this.state.runHistory.push({ wave, score, date: Date.now() });
        if (this.state.runHistory.length > 10) this.state.runHistory.shift();

        this._saveState();
        return { isNewBestWave, isNewBestScore, isNewBestCombo };
    }

    /** Reset all stored progression. */
    reset() {
        this.state = this._createDefaultState();
        this._saveState();
    }

    /** Return a deep copy of persistent stats for UI rendering. */
    getSnapshot() {
        return JSON.parse(JSON.stringify(this.state));
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    _calculateWaveReward(isBossWave) {
        const cfg = GameConfig.META.CURRENCIES.LEGACY_TOKENS;
        if (!cfg) return 0;
        let total = cfg.perWaveReward ?? 0;
        if (isBossWave) total += cfg.bossBonus ?? 0;
        return total;
    }

    _incrementCurrency(currencyKey, amount) {
        if (!this.state.currencies[currencyKey]) this.state.currencies[currencyKey] = 0;
        this.state.currencies[currencyKey] += amount;
    }

    /**
     * Debounced fire-and-forget server write.
     * In-memory state is already updated synchronously before this is called.
     */
    _saveState() {
        if (this._saveTimer !== null) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            this._saveTimer = null;
            persistProgressionToServer(this.state, PROGRESSION_SCHEMA_VERSION)
                .catch(err => console.warn('[ProgressionManager] Server save failed:', err.message));
        }, SAVE_DEBOUNCE_MS);
    }

    _createDefaultState() {
        const defaultCurrencies = {};
        for (const key of Object.keys(GameConfig.META.CURRENCIES)) {
            defaultCurrencies[key] = 0;
        }
        return {
            highestWave: 0,
            totalWavesCompleted: 0,
            bossWavesCleared: 0,
            currencies: defaultCurrencies,
            unlocks: {},
            bestWave: 0,
            bestScore: 0,
            bestCombo: 0,
            totalRuns: 0,
            totalKills: 0,
            runHistory: [],
            achievements: {},
        };
    }
}