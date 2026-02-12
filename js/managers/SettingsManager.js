import { telemetry } from './TelemetryManager.js';

const SETTINGS_STORAGE_KEY = 'neon_td_settings_v1';

const DEFAULT_SETTINGS = {
    soundEnabled: true,
    musicEnabled: true,
    difficulty: 'normal',
    screenShakeEnabled: true,
    performanceModeEnabled: false,
    showPerformanceStats: false,
    showKeybindHints: true
};

const DIFFICULTY_VALUES = new Set(['easy', 'normal', 'hard']);

export class SettingsManager {
    constructor() {
        this.settings = { ...DEFAULT_SETTINGS };
        this._load();
        this._migrateLegacyAudioPreference();
    }

    getSettings() {
        return { ...this.settings };
    }

    getValue(key) {
        if (!(key in this.settings)) {
            return undefined;
        }
        return this.settings[key];
    }

    update(partialSettings = {}) {
        const next = {
            ...this.settings,
            ...partialSettings
        };

        if (!DIFFICULTY_VALUES.has(next.difficulty)) {
            next.difficulty = DEFAULT_SETTINGS.difficulty;
        }

        this.settings = next;
        this._save();

        telemetry.track('settings_changed', {
            updatedKeys: Object.keys(partialSettings),
            ...partialSettings
        });

        return this.getSettings();
    }

    resetToDefaults() {
        this.settings = { ...DEFAULT_SETTINGS };
        this._save();
        telemetry.track('settings_reset_defaults');
        return this.getSettings();
    }

    _load() {
        try {
            const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (!raw) {
                return;
            }
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') {
                return;
            }

            this.settings = {
                ...DEFAULT_SETTINGS,
                ...parsed
            };
        } catch {
            this.settings = { ...DEFAULT_SETTINGS };
        }
    }

    _save() {
        try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
        } catch {
            // Ignore storage quota/availability errors to keep gameplay uninterrupted.
        }
    }

    _migrateLegacyAudioPreference() {
        try {
            const rawLegacyMute = localStorage.getItem('mute');
            if (!rawLegacyMute) {
                return;
            }

            const legacyMuted = JSON.parse(rawLegacyMute) === true;
            this.settings.soundEnabled = !legacyMuted;
            this.settings.musicEnabled = !legacyMuted;
            localStorage.removeItem('mute');
            this._save();
        } catch {
            // Ignore malformed legacy values.
        }
    }
}

export const settingsManager = new SettingsManager();
