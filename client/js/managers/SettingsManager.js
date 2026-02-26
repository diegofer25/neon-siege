import { telemetry } from './TelemetryManager.js';

const SETTINGS_STORAGE_KEY = 'neon_td_settings_v1';

const DEFAULT_SETTINGS = {
    soundVolume: 30,
    musicVolume: 20,
    screenShakeEnabled: true,
    performanceModeEnabled: false,
    showPerformanceStats: false,
    showKeybindHints: true
};

function clampVolume(value, fallback) {
    if (!Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(0, Math.min(100, Math.round(value)));
}

export class SettingsManager {
    constructor() {
        this.settings = { ...DEFAULT_SETTINGS };
        this._load();
        this._migrateLegacyAudioSettings();
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
            if (legacyMuted) {
                this.settings.soundVolume = 0;
                this.settings.musicVolume = 0;
            }
            localStorage.removeItem('mute');
            this._save();
        } catch {
            // Ignore malformed legacy values.
        }
    }

    _migrateLegacyAudioSettings() {
        const settings = /** @type {any} */ (this.settings);
        const hasLegacySoundEnabled = typeof settings.soundEnabled === 'boolean';
        const hasLegacyMusicEnabled = typeof settings.musicEnabled === 'boolean';
        const hasModernSoundVolume = Number.isFinite(this.settings.soundVolume);
        const hasModernMusicVolume = Number.isFinite(this.settings.musicVolume);

        if (!hasLegacySoundEnabled && !hasLegacyMusicEnabled && hasModernSoundVolume && hasModernMusicVolume) {
            this.settings.soundVolume = clampVolume(this.settings.soundVolume, DEFAULT_SETTINGS.soundVolume);
            this.settings.musicVolume = clampVolume(this.settings.musicVolume, DEFAULT_SETTINGS.musicVolume);
            return;
        }

        if (hasLegacySoundEnabled && !hasModernSoundVolume) {
            this.settings.soundVolume = settings.soundEnabled ? DEFAULT_SETTINGS.soundVolume : 0;
        }

        if (hasLegacyMusicEnabled && !hasModernMusicVolume) {
            this.settings.musicVolume = settings.musicEnabled ? DEFAULT_SETTINGS.musicVolume : 0;
        }

        this.settings.soundVolume = clampVolume(this.settings.soundVolume, DEFAULT_SETTINGS.soundVolume);
        this.settings.musicVolume = clampVolume(this.settings.musicVolume, DEFAULT_SETTINGS.musicVolume);

        delete settings.soundEnabled;
        delete settings.musicEnabled;
        this._save();
    }
}

export const settingsManager = new SettingsManager();
