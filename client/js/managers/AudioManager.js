/**
 * @fileoverview Centralized audio manager for SFX and background music.
 *
 * Extracted from main.js to keep audio concerns in one place and reduce
 * the size of the monolithic entry-point file.
 *
 * Usage:
 *   import { audioManager } from './managers/AudioManager.js';
 *   audioManager.playSFX('player_shoot_basic');
 */

import { GameConfig } from '../config/GameConfig.js';
import { SOUND_EFFECT_MANIFEST } from '../../scripts/sfx-manifest.mjs';

// ── Constants ────────────────────────────────────────────────────────────────

const SFX_VARIANTS = 1;

/** @type {Record<string, string>} Short aliases → canonical SFX keys */
const SFX_ALIASES = {
    shoot: 'player_shoot_basic',
    explode: 'enemy_death',
    hurt: 'player_hurt',
    powerup: 'ui_purchase_success',
    click: 'ui_click',
};

/** @type {Record<string, {src: string, loop: boolean}>} */
const MUSIC_TRACKS = {
    music_menu_main:                { src: 'assets/audio/music/music_menu_main.mp3',                loop: true  },
    music_menu_settings:            { src: 'assets/audio/music/music_menu_settings.mp3',            loop: true  },
    music_menu_consent:             { src: 'assets/audio/music/music_menu_consent.mp3',             loop: true  },
    music_run_wave_early:           { src: 'assets/audio/music/music_run_wave_early.mp3',           loop: true  },
    music_run_wave_mid:             { src: 'assets/audio/music/music_run_wave_mid.mp3',             loop: true  },
    music_run_wave_late:            { src: 'assets/audio/music/music_run_wave_late.mp3',            loop: true  },
    music_wave_countdown_stinger:   { src: 'assets/audio/music/music_wave_countdown_stinger.mp3',   loop: false },
    music_shop_between_waves:       { src: 'assets/audio/music/music_shop_between_waves.mp3',       loop: true  },
    music_boss_classic:             { src: 'assets/audio/music/music_boss_classic.mp3',             loop: true  },
    music_boss_shield:              { src: 'assets/audio/music/music_boss_shield.mp3',              loop: true  },
    music_pause_overlay:            { src: 'assets/audio/music/music_pause_overlay.mp3',            loop: true  },
    music_gameover_defeat:          { src: 'assets/audio/music/music_gameover_defeat.mp3',          loop: false },
    music_restore_resume_stinger:   { src: 'assets/audio/music/music_restore_resume_stinger.mp3',   loop: false },
    music_run_resume_stinger:       { src: 'assets/audio/music/music_run_resume_stinger.mp3',       loop: false },
    music_lore_intro:               { src: 'assets/audio/music/music_lore_intro.mp3',               loop: false },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Clamp a slider/setting value to [0, 100]. */
function clampVolume(value, fallback = 0) {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(0, Math.min(100, Math.round(value)));
}

/** Convert a 0-100 slider value to 0-1 unit volume. */
function sliderToUnit(value, fallback = 0) {
    return clampVolume(value, Math.round(fallback * 100)) / 100;
}

/** Determine which wave-tier music key to use. */
function getWaveMusicKey(wave = 1) {
    if (wave >= 31) return 'music_run_wave_late';
    if (wave >= 11) return 'music_run_wave_mid';
    return 'music_run_wave_early';
}

// ── AudioManager class ──────────────────────────────────────────────────────

/**
 * Singleton audio manager that owns all SFX / BGM state.
 *
 * Set the `game` reference once the Game instance is ready:
 * ```
 * audioManager.game = gameInstance;
 * ```
 */
export class AudioManager {
    constructor() {
        /** @type {HTMLAudioElement|null} */
        this.bgm = null;
        /** @type {string|null} */
        this.currentMusicKey = null;
        /** @type {Record<string, HTMLAudioElement[]>} */
        this.sfx = {};
        /** @type {number} 0-1 */
        this.soundVolume = GameConfig.AUDIO.SFX_VOLUME;
        /** @type {number} 0-1 */
        this.musicVolume = GameConfig.AUDIO.BGM_VOLUME;

        /** @type {import('../Game.js').Game|null} Set after game creation. */
        this.game = null;

        // Menu scroll SFX throttle
        /** @private */ this._lastMenuScrollSfxAt = 0;
        /** @private */ this._lastSettingsPanelScrollTop = null;
    }

    // ── Bootstrap ────────────────────────────────────────────────────────

    /**
     * Pre-load background music and SFX audio elements.
     * Call once from the init routine.
     */
    loadAudio() {
        this.bgm = new Audio(MUSIC_TRACKS.music_menu_main.src);
        this.bgm.preload = 'auto';
        this.bgm.loop = MUSIC_TRACKS.music_menu_main.loop;
        this.bgm.volume = Math.max(0, Math.min(1, this.musicVolume));
        this.currentMusicKey = 'music_menu_main';

        this.sfx = {};
        SOUND_EFFECT_MANIFEST.forEach(({ key }) => {
            const variants = [];
            for (let v = 1; v <= SFX_VARIANTS; v += 1) {
                const sound = new Audio(`assets/audio/sfx/${key}_v${v}.mp3`);
                sound.preload = 'auto';
                sound.volume = this.soundVolume;
                variants.push(sound);
            }
            this.sfx[key] = variants;
        });
    }

    /**
     * Register one-shot user-gesture listeners that kick off music playback
     * the first time the user interacts.
     */
    setupAudioUnlockHooks() {
        const unlockAudio = () => {
            if (this.musicVolume <= 0) return;
            this.syncMusicTrack();
        };
        document.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
        document.addEventListener('keydown', unlockAudio, { once: true });
    }

    /**
     * Attach scroll listeners to the settings panel for scroll SFX.
     */
    setupMenuScrollSoundHooks() {
        const settingsPanel = document.querySelector('.settings-panel');
        if (!settingsPanel) return;

        this._lastSettingsPanelScrollTop = /** @type {HTMLElement} */ (settingsPanel).scrollTop;
        settingsPanel.addEventListener('scroll', () => {
            this._playMenuScrollSfx(/** @type {HTMLElement} */ (settingsPanel).scrollTop);
        }, { passive: true });
    }

    // ── SFX ──────────────────────────────────────────────────────────────

    /**
     * Play a sound effect by name (or alias).
     * @param {string} soundName
     */
    playSFX(soundName) {
        const canonicalName = SFX_ALIASES[soundName] || soundName;
        const forceMaxVolume = canonicalName === 'game_over';

        if (!forceMaxVolume && this.soundVolume <= 0) return;

        const pool = this.sfx[canonicalName];
        if (!pool || pool.length === 0) return;

        try {
            const source = pool[0];
            const sound = /** @type {HTMLAudioElement} */ (source.cloneNode());
            sound.volume = forceMaxVolume
                ? 1
                : Math.max(0, Math.min(1, GameConfig.AUDIO.SFX_VOLUME * this.soundVolume));
            sound.play().catch(e => console.log('Audio play failed:', e));
        } catch (e) {
            console.log('Audio error:', e);
        }
    }

    // ── Music ────────────────────────────────────────────────────────────

    /**
     * Evaluate current game state and swap/resume/restart BGM as needed.
     * @param {{restart?: boolean}} [opts]
     */
    syncMusicTrack({ restart = false } = {}) {
        const desiredKey = this._resolveMusicKeyForState();
        const nextTrack = MUSIC_TRACKS[desiredKey];
        if (!nextTrack || !this.bgm) return;

        if (this.currentMusicKey === desiredKey) {
            if (restart) this.bgm.currentTime = 0;
            if (this.musicVolume > 0 && this._shouldPlayMusicForState() && this.bgm.paused) {
                this.bgm.play().catch(() => {});
            }
            return;
        }

        this.bgm.pause();
        this.bgm.currentTime = 0;
        this.currentMusicKey = desiredKey;
        this.bgm.src = nextTrack.src;
        this.bgm.loop = nextTrack.loop;
        if (restart) this.bgm.currentTime = 0;
        this.bgm.volume = Math.max(0, Math.min(1, this.musicVolume));
        if (this.musicVolume > 0 && this._shouldPlayMusicForState()) {
            this.bgm.play().catch(() => {});
        }
    }

    // ── Settings integration ─────────────────────────────────────────────

    /**
     * Apply audio-related portions of the settings object.
     * Call this from the settings apply routine in main.js.
     *
     * @param {{soundVolume?: number, musicVolume?: number}} settings
     */
    applySettings(settings) {
        const soundSlider = clampVolume(settings.soundVolume, 30);
        const musicSlider = clampVolume(settings.musicVolume, 20);
        this.soundVolume = sliderToUnit(soundSlider, GameConfig.AUDIO.SFX_VOLUME);
        this.musicVolume = sliderToUnit(musicSlider, GameConfig.AUDIO.BGM_VOLUME);

        if (this.bgm) {
            this.bgm.volume = Math.max(0, Math.min(1, this.musicVolume));
            if (this.musicVolume > 0) {
                if (this._shouldPlayMusicForState() && this.bgm.paused) {
                    this.bgm.play().catch(() => {});
                }
            } else {
                this.bgm.pause();
            }
        }
    }

    // ── Private helpers ──────────────────────────────────────────────────

    /** @private */
    _resolveMusicKeyForState() {
        const g = this.game;
        if (!g) return 'music_menu_main';
        if (g.gameState === 'gameover') return 'music_gameover_defeat';
        if (g.gameState === 'paused') return 'music_pause_overlay';
        if (g.gameState === 'powerup') return 'music_shop_between_waves';
        if (g.gameState === 'playing') {
            if (g.waveManager?.isBossWave) {
                return g.wave % 20 === 0 ? 'music_boss_shield' : 'music_boss_classic';
            }
            return getWaveMusicKey(g.wave);
        }
        return 'music_menu_main';
    }

    /** @private */
    _shouldPlayMusicForState() {
        const g = this.game;
        if (!g) return false;
        return ['menu', 'playing', 'powerup', 'paused', 'gameover'].includes(g.gameState);
    }

    /** @private */
    _playMenuScrollSfx(scrollTop) {
        if (this._lastSettingsPanelScrollTop === null) {
            this._lastSettingsPanelScrollTop = scrollTop;
            return;
        }
        if (Math.abs(scrollTop - this._lastSettingsPanelScrollTop) < 1) return;
        this._lastSettingsPanelScrollTop = scrollTop;
        const now = performance.now();
        if (now - this._lastMenuScrollSfxAt < 70) return;
        this._lastMenuScrollSfxAt = now;
        this.playSFX('ui_menu_scroll');
    }
}

/** Singleton instance (import this). */
export const audioManager = new AudioManager();
