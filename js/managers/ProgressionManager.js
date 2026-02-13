import { GameConfig } from '../config/GameConfig.js';

/**
 * Handles persistent meta-progression across runs.
 * Stores earned legacy tokens, unlock states, and milestone stats using localStorage when available.
 */
export class ProgressionManager {
    constructor(storageKey = GameConfig.META.STORAGE_KEY) {
        this.storageKey = storageKey;
        this._supportsStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
        this.state = this._loadState();
    }

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
        if (this.isUnlocked(unlockKey)) {
            return false;
        }

        const unlockConfig = GameConfig.META.UNLOCKS[unlockKey];
        if (!unlockConfig) {
            console.warn(`[ProgressionManager] Unknown unlock key: ${unlockKey}`);
            return false;
        }

        const cost = unlockConfig.cost ?? 0;
        if (!this.spendCurrency('LEGACY_TOKENS', cost)) {
            return false;
        }

        this.state.unlocks[unlockKey] = true;
        this._saveState();
        return true;
    }

    /**
     * Check whether an unlock has been purchased.
     * @param {string} unlockKey
     */
    isUnlocked(unlockKey) {
        return !!this.state.unlocks?.[unlockKey];
    }

    /**
     * Get current balance for a currency.
     * @param {string} currencyKey
     */
    getCurrencyBalance(currencyKey) {
        return this.state.currencies?.[currencyKey] ?? 0;
    }

    /**
     * Spend an amount of a currency if possible.
     * @param {string} currencyKey
     * @param {number} amount
     * @returns {boolean}
     */
    spendCurrency(currencyKey, amount) {
        if (amount <= 0) {
            return true;
        }
        const balance = this.getCurrencyBalance(currencyKey);
        if (balance < amount) {
            return false;
        }

        this.state.currencies[currencyKey] = balance - amount;
        this._saveState();
        return true;
    }

    /**
     * Record the end of a run for personal best tracking.
     * @param {number} wave
     * @param {number} score
     * @param {number} maxCombo
     * @param {number} totalKills
     * @returns {{isNewBestWave: boolean, isNewBestScore: boolean, isNewBestCombo: boolean}}
     */
    recordRunEnd(wave, score, maxCombo, totalKills) {
        this.state.totalRuns = (this.state.totalRuns ?? 0) + 1;
        this.state.totalKills = (this.state.totalKills ?? 0) + totalKills;

        const isNewBestWave = wave > (this.state.bestWave ?? 0);
        const isNewBestScore = score > (this.state.bestScore ?? 0);
        const isNewBestCombo = maxCombo > (this.state.bestCombo ?? 0);

        if (isNewBestWave) this.state.bestWave = wave;
        if (isNewBestScore) this.state.bestScore = score;
        if (isNewBestCombo) this.state.bestCombo = maxCombo;

        if (!this.state.runHistory) this.state.runHistory = [];
        this.state.runHistory.push({ wave, score, date: Date.now() });
        if (this.state.runHistory.length > 10) this.state.runHistory.shift();

        this._saveState();
        return { isNewBestWave, isNewBestScore, isNewBestCombo };
    }

    /**
     * Reset all stored progression.
     */
    reset() {
        this.state = this._createDefaultState();
        this._saveState();
    }

    /**
     * Return a shallow copy of persistent stats for UI rendering.
     */
    getSnapshot() {
        return JSON.parse(JSON.stringify(this.state));
    }

    _calculateWaveReward(isBossWave) {
        const currencyConfig = GameConfig.META.CURRENCIES.LEGACY_TOKENS;
        if (!currencyConfig) {
            return 0;
        }
        let total = currencyConfig.perWaveReward ?? 0;
        if (isBossWave) {
            total += currencyConfig.bossBonus ?? 0;
        }
        return total;
    }

    _incrementCurrency(currencyKey, amount) {
        if (!this.state.currencies[currencyKey]) {
            this.state.currencies[currencyKey] = 0;
        }
        this.state.currencies[currencyKey] += amount;
    }

    _loadState() {
        const fallback = this._createDefaultState();
        if (!this._supportsStorage) {
            return fallback;
        }

        try {
            const stored = window.localStorage.getItem(this.storageKey);
            if (!stored) {
                return fallback;
            }
            const parsed = JSON.parse(stored);
            return { ...fallback, ...parsed, currencies: { ...fallback.currencies, ...parsed.currencies }, unlocks: { ...fallback.unlocks, ...parsed.unlocks } };
        } catch (error) {
            console.warn('[ProgressionManager] Failed to load stored data', error);
            return fallback;
        }
    }

    _saveState() {
        if (!this._supportsStorage) {
            return;
        }
        try {
            window.localStorage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (error) {
            console.warn('[ProgressionManager] Failed to save progression data', error);
        }
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
            achievements: {}
        };
    }
}
