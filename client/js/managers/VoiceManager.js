/**
 * @fileoverview Lightweight voice-over manager for in-game narration.
 *
 * Plays short spoken callouts at key game moments (boss intros, game over,
 * milestones, combo tiers, etc.). Sits alongside AudioManager and respects
 * the user's sound-volume setting.
 *
 * Usage:
 *   import { voiceManager } from './managers/VoiceManager.js';
 *   voiceManager.play('boss_intro_shield');
 */

import { audioManager } from './AudioManager.js';

// ── Constants ────────────────────────────────────────────────────────────────

/** Base path to voice-over assets. */
const VOICE_BASE_PATH = 'assets/audio/voice';

/**
 * Priority tiers — higher number = higher priority.
 * A currently-playing line will only be interrupted by an equal-or-higher
 * priority line.
 */
const PRIORITY = /** @type {const} */ ({
    LOW:    1,  // combo tiers, minor milestones
    MEDIUM: 2,  // wave modifiers, milestones
    HIGH:   3,  // boss intros, ascension
    MAX:    4,  // game over, victory
});

/**
 * Map voice keys → priority tier.
 * Keys not listed default to MEDIUM.
 * @type {Record<string, number>}
 */
const KEY_PRIORITY = {
    // Boss intros — high
    boss_intro_classic:    PRIORITY.HIGH,
    boss_intro_shield:     PRIORITY.HIGH,
    boss_intro_teleporter: PRIORITY.HIGH,
    boss_intro_splitter:   PRIORITY.HIGH,
    boss_intro_vortex:     PRIORITY.HIGH,
    boss_intro_chrono:     PRIORITY.HIGH,

    // Game over / victory — max
    game_over_defeat: PRIORITY.MAX,
    game_over_close:  PRIORITY.MAX,
    game_over_record: PRIORITY.MAX,
    victory_wave30:   PRIORITY.MAX,

    // Ascension — high
    ascension_offer: PRIORITY.HIGH,

    // Wave modifiers — medium
    modifier_ion_storm: PRIORITY.MEDIUM,
    modifier_overclock: PRIORITY.MEDIUM,
    modifier_neon_fog:  PRIORITY.MEDIUM,

    // Milestones — medium
    milestone_wave10: PRIORITY.MEDIUM,
    milestone_wave25: PRIORITY.MEDIUM,
    milestone_wave50: PRIORITY.MEDIUM,

    // Combo tiers — low
    combo_rampage:     PRIORITY.LOW,
    combo_unstoppable: PRIORITY.LOW,
    combo_godmode:     PRIORITY.LOW,
};

/** Volume multiplier relative to the user's soundVolume setting. */
const VOICE_VOLUME_SCALE = 1.5;

// ── VoiceManager class ──────────────────────────────────────────────────────

export class VoiceManager {
    constructor() {
        /** @type {HTMLAudioElement | null} */
        this._audio = null;
        /** @type {string | null} */
        this._currentKey = null;
        /** @type {number} */
        this._currentPriority = 0;
        /** @type {boolean} Whether voice-over is enabled. */
        this.enabled = true;
    }

    // ── Public API ───────────────────────────────────────────────────────

    /**
     * Play a voice-over line. Respects priority — won't interrupt a
     * higher-priority line already playing.
     *
     * @param {string} key  The voice file key (e.g. 'boss_intro_shield').
     *                       Maps to `assets/audio/voice/{key}.mp3`.
     */
    play(key) {
        if (!this.enabled) return;
        if (audioManager.soundVolume <= 0) return;

        const priority = KEY_PRIORITY[key] ?? PRIORITY.MEDIUM;

        // Don't interrupt higher-priority playback
        if (this._audio && !this._audio.paused && this._currentPriority > priority) {
            return;
        }

        this.stop();

        const audio = new Audio(`${VOICE_BASE_PATH}/${key}.mp3`);
        audio.volume = Math.max(0, Math.min(1, audioManager.soundVolume * VOICE_VOLUME_SCALE));
        audio.play().catch(() => {});

        // Auto-cleanup when finished
        audio.addEventListener('ended', () => {
            if (this._audio === audio) {
                this._currentKey = null;
                this._currentPriority = 0;
            }
        }, { once: true });

        this._audio = audio;
        this._currentKey = key;
        this._currentPriority = priority;
    }

    /**
     * Stop any currently-playing voice-over.
     */
    stop() {
        if (!this._audio) return;
        this._audio.pause();
        this._audio.src = '';
        this._audio = null;
        this._currentKey = null;
        this._currentPriority = 0;
    }

    /**
     * Whether a voice-over is currently playing.
     * @returns {boolean}
     */
    isPlaying() {
        return !!(this._audio && !this._audio.paused);
    }

    /**
     * The key of the currently-playing line, or null.
     * @returns {string | null}
     */
    get currentKey() {
        return this._currentKey;
    }
}

/** Singleton instance (import this). */
export const voiceManager = new VoiceManager();
