/**
 * @fileoverview Lore Intro — cinematic narrative overlay for first-time players.
 *
 * Shows 7 scenes with Ken Burns image animations, typewriter text reveals, and
 * smooth crossfade transitions. Plays a dedicated music track and scene-specific
 * SFX. Auto-advances scenes on a timer but allows click / tap / keyboard to
 * advance manually.
 *
 * Emits `lore-complete` (composed, bubbling) when the sequence finishes or is
 * skipped so the host can proceed to `startGame()`.
 *
 * Usage (in main.js):
 *   const lore = document.querySelector('lore-intro');
 *   lore.show();
 *   lore.addEventListener('lore-complete', () => startGame(), { once: true });
 */

import { BaseComponent } from '../BaseComponent.js';
import { createSheet } from '../shared-styles.js';
import { audioManager } from '../../../managers/AudioManager.js';

// ── Scene data ───────────────────────────────────────────────────────────────

const SCENES = [
    {
        image: 'assets/images/lore/lore_01_city.jpg',
        text: 'In 2187, humanity built NEXUS PRIME — a city of light, powered by the Neon Grid, an infinite energy lattice that connected every mind, every machine.',
        voice: 'assets/audio/voice/lore_voice_01_city.mp3',
        duration: 10000,
        sfx: null,
    },
    {
        image: 'assets/images/lore/lore_02_breach.jpg',
        text: 'Then the Grid tore open. From the breach came THE SWARM — entities of pure entropy, drawn to the Grid\'s light like moths to a flame. They consumed everything they touched.',
        voice: 'assets/audio/voice/lore_voice_02_breach.mp3',
        duration: 12000,
        sfx: 'lore_breach_rumble',
    },
    {
        image: 'assets/images/lore/lore_03_fall.jpg',
        text: 'In 72 hours, the outer districts fell. The military was overwhelmed. The Swarm adapted to every weapon, every strategy. Humanity was losing.',
        voice: 'assets/audio/voice/lore_voice_03_fall.mp3',
        duration: 10000,
        sfx: null,
    },
    {
        image: 'assets/images/lore/lore_04_project.jpg',
        text: 'Deep beneath the city, Project SIEGE had been waiting. A fusion of human will and Grid energy — a living weapon designed to channel the very power the Swarm craved.',
        voice: 'assets/audio/voice/lore_voice_04_project.mp3',
        duration: 11000,
        sfx: null,
    },
    {
        image: 'assets/images/lore/lore_05_awakening.jpg',
        text: 'You are the Siege Protocol. The last line of defense. The Grid flows through you — every shot, every shield, every spark of power drawn from the same energy they seek to devour.',
        voice: 'assets/audio/voice/lore_voice_05_awakening.mp3',
        duration: 12000,
        sfx: 'lore_awakening_power',
    },
    {
        image: 'assets/images/lore/lore_06_mission.jpg',
        text: 'They will come in waves. They will adapt. They will send their strongest. But with each wave you survive, you grow stronger. The Grid remembers. The Grid evolves.',
        voice: 'assets/audio/voice/lore_voice_06_mission.mp3',
        duration: 11000,
        sfx: null,
    },
    {
        image: 'assets/images/lore/lore_07_stand.jpg',
        text: 'Hold the line. 30 waves. 6 siege commanders. One chance. The city\'s last light\u2026 is you.',
        voice: 'assets/audio/voice/lore_voice_07_stand.mp3',
        duration: 10000,
        sfx: null,
    },
];

const CHAR_DELAY_MS = 35;          // Typewriter speed per character
const TRANSITION_MS = 900;         // Crossfade duration
const SKIP_REVEAL_MS = 3000;       // Delay before skip button appears
const FADE_OUT_MS = 600;           // Final fade-out when complete/skipped

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = createSheet(/* css */ `
  .lore-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: #000;
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity ${FADE_OUT_MS}ms ease;
  }
  .lore-overlay.show {
    display: flex;
    opacity: 1;
  }
  .lore-overlay.fade-out {
    opacity: 0;
  }

  /* Letterbox bars */
  .letterbox-top, .letterbox-bottom {
    position: absolute;
    left: 0; right: 0;
    height: 6%;
    background: #000;
    z-index: 3;
  }
  .letterbox-top { top: 0; }
  .letterbox-bottom { bottom: 0; }

  /* Scene container */
  .scene-viewport {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  /* Individual scene wrapper */
  .scene {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    opacity: 0;
    transition: opacity ${TRANSITION_MS}ms ease-in-out,
                transform ${TRANSITION_MS}ms ease-in-out;
    transform: translateY(10px);
    pointer-events: none;
  }
  .scene.active {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }
  .scene.exiting {
    opacity: 0;
    transform: translateY(-15px);
  }

  /* Scene image — Ken Burns */
  .scene-image-wrap {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .scene-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    animation: kenBurns 13s ease-in-out forwards;
    filter: brightness(0.75) saturate(1.3);
  }
  @keyframes kenBurns {
    0%   { transform: scale(1) translate(0, 0); }
    100% { transform: scale(1.08) translate(-1%, -1%); }
  }

  /* Gradient overlay on image so text is readable */
  .scene-image-wrap::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      rgba(0, 0, 0, 0.95) 0%,
      rgba(0, 0, 0, 0.85) 25%,
      rgba(0, 0, 0, 0.5) 45%,
      transparent 65%
    );
    z-index: 1;
  }

  /* Text area */
  .scene-text {
    position: relative;
    z-index: 2;
    max-width: 800px;
    width: 90%;
    padding: 24px 16px;
    margin-bottom: max(10%, 60px);
    font-family: var(--font-primary, 'Audiowide', cursive);
    font-size: clamp(14px, 2.2vw, 20px);
    line-height: 1.7;
    color: #e0e0e0;
    text-align: center;
    text-shadow: 0 0 8px rgba(0, 255, 255, 0.3), 0 2px 4px rgba(0, 0, 0, 0.8);
    min-height: 100px;
  }
  .scene-text .cursor {
    display: inline-block;
    width: 2px;
    height: 1em;
    background: var(--color-primary-neon, #0ff);
    box-shadow: 0 0 6px var(--color-primary-neon, #0ff);
    margin-left: 2px;
    vertical-align: text-bottom;
    animation: cursorBlink 0.7s step-end infinite;
  }
  @keyframes cursorBlink {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0; }
  }

  /* Skip button */
  .skip-btn {
    position: absolute;
    top: max(7%, 30px);
    right: 24px;
    z-index: 10;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(0, 255, 255, 0.3);
    color: rgba(255, 255, 255, 0.6);
    font-family: var(--font-primary, 'Audiowide', cursive);
    font-size: 13px;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 8px 18px;
    border-radius: 4px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.5s ease, color 0.2s, border-color 0.2s, background 0.2s;
    pointer-events: none;
  }
  .skip-btn.visible {
    opacity: 1;
    pointer-events: auto;
  }
  .skip-btn:hover {
    color: #fff;
    border-color: var(--color-primary-neon, #0ff);
    background: rgba(0, 255, 255, 0.1);
  }

  /* Progress bar */
  .progress-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--color-primary-neon, #0ff), var(--color-secondary-neon, #ff2dec));
    box-shadow: 0 0 8px var(--color-primary-neon, #0ff);
    z-index: 5;
    transition: width 0.3s linear;
  }

  /* Click-to-advance hint */
  .advance-hint {
    position: absolute;
    bottom: max(7%, 28px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 5;
    font-family: var(--font-primary, 'Audiowide', cursive);
    font-size: 11px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.35);
    opacity: 0;
    transition: opacity 0.6s ease;
    pointer-events: none;
  }
  .advance-hint.visible {
    opacity: 1;
  }

  /* Responsive tweaks */
  @media (max-width: 600px) {
    .scene-text {
      font-size: clamp(12px, 3.5vw, 16px);
      padding: 16px 12px 40px;
    }
    .skip-btn {
      font-size: 11px;
      padding: 6px 12px;
    }
  }
`);

// ── Component ────────────────────────────────────────────────────────────────

class LoreIntro extends BaseComponent {
    constructor() {
        super();

        /** @private */ this._currentScene = -1;
        /** @private */ this._isPlaying = false;
        /** @private */ this._autoTimer = null;
        /** @private */ this._typeTimer = null;
        /** @private */ this._skipTimer = null;
        /** @private */ this._advancing = false;
        /** @private */ this._typewriterDone = false;
        /** @private */ this._loreAudio = null;
        /** @private */ this._voiceAudio = null;

        this._onKeyDown = this._onKeyDown.bind(this);
        this._onPointerDown = this._onPointerDown.bind(this);
    }

    connectedCallback() {
        const scenesHTML = SCENES.map((_, i) => /* html */ `
            <div class="scene" data-index="${i}">
                <div class="scene-image-wrap">
                    <img class="scene-image" data-src="${SCENES[i].image}" alt="">
                </div>
                <div class="scene-text" id="text-${i}"></div>
            </div>
        `).join('');

        this._render(/* html */ `
            <div class="lore-overlay">
                <div class="letterbox-top"></div>
                <div class="letterbox-bottom"></div>
                <div class="scene-viewport">
                    ${scenesHTML}
                </div>
                <button class="skip-btn">SKIP ▶</button>
                <div class="progress-bar"></div>
                <div class="advance-hint">click to continue</div>
            </div>
        `, styles);
    }

    // ── Public API ───────────────────────────────────────────────────────

    show() {
        const overlay = this._$('.lore-overlay');
        if (!overlay || this._isPlaying) return;

        overlay.classList.add('show');
        overlay.classList.remove('fade-out');
        this._isPlaying = true;
        this._currentScene = -1;

        // Activate listeners
        document.addEventListener('keydown', this._onKeyDown);
        this.shadowRoot.addEventListener('pointerdown', this._onPointerDown);

        // Wire skip button
        const skipBtn = this._$('.skip-btn');
        skipBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this._complete();
        });

        // Reveal skip button after delay
        this._skipTimer = setTimeout(() => {
            skipBtn?.classList.add('visible');
        }, SKIP_REVEAL_MS);

        // Start background music
        this._startMusic();

        // Preload first scene image then kick off
        this._preloadScene(0).then(() => this._advanceScene());
    }

    hide() {
        this._cleanup();
        const overlay = this._$('.lore-overlay');
        overlay?.classList.remove('show');
    }

    // ── Scene management ─────────────────────────────────────────────────

    /** @private */
    async _advanceScene() {
        if (this._advancing || !this._isPlaying) return;
        this._advancing = true;

        const prev = this._currentScene;
        const next = prev + 1;

        if (next >= SCENES.length) {
            this._advancing = false;
            this._complete();
            return;
        }

        // Exit previous scene
        if (prev >= 0) {
            const prevEl = this._$(`.scene[data-index="${prev}"]`);
            prevEl?.classList.remove('active');
            prevEl?.classList.add('exiting');

            // Play transition whoosh
            audioManager.playSFX('lore_transition_whoosh');
        }

        // Preload next + 1 scene image in the background
        if (next + 1 < SCENES.length) {
            this._preloadScene(next + 1);
        }

        // Brief delay for crossfade overlap
        await this._wait(prev >= 0 ? TRANSITION_MS * 0.4 : 0);

        this._currentScene = next;
        const scene = SCENES[next];
        const sceneEl = this._$(`.scene[data-index="${next}"]`);

        // Load image if not already loaded
        /** @type {HTMLImageElement | null} */
        const img = sceneEl?.querySelector('.scene-image');
        if (img && !img.src) {
            img.src = img.dataset.src;
        }

        // Reset Ken Burns animation
        if (img) {
            img.style.animation = 'none';
            // Force reflow
            void img.offsetHeight;
            img.style.animation = '';
        }

        // Activate
        sceneEl?.classList.remove('exiting');
        sceneEl?.classList.add('active');

        // Play scene-specific SFX
        if (scene.sfx) {
            audioManager.playSFX(scene.sfx);
        }

        // Play voice-over narration
        this._playVoice(scene.voice);

        // Update progress bar
        this._updateProgress(next);

        // Start typewriter text
        this._typewriterDone = false;
        this._typeText(next, scene.text, () => {
            this._typewriterDone = true;
            this._showAdvanceHint();
        });

        // Auto-advance after scene duration
        clearTimeout(this._autoTimer);
        this._autoTimer = setTimeout(() => {
            if (this._isPlaying) {
                this._advancing = false;
                this._hideAdvanceHint();
                this._advanceScene();
            }
        }, scene.duration);

        this._advancing = false;
    }

    /** @private */
    _typeText(sceneIndex, text, onDone) {
        const el = this._$(`#text-${sceneIndex}`);
        if (!el) { onDone?.(); return; }

        el.innerHTML = '<span class="cursor"></span>';

        let charIndex = 0;
        const cursor = el.querySelector('.cursor');

        clearInterval(this._typeTimer);
        this._typeTimer = setInterval(() => {
            if (charIndex >= text.length) {
                clearInterval(this._typeTimer);
                // Remove cursor after a brief pause
                setTimeout(() => {
                    if (cursor) /** @type {HTMLElement} */ (cursor).style.display = 'none';
                }, 1200);
                onDone?.();
                return;
            }
            // Insert character before cursor
            if (cursor) {
                cursor.insertAdjacentText('beforebegin', text[charIndex]);
            }
            charIndex++;
        }, CHAR_DELAY_MS);
    }

    /** @private */
    _completeCurrentTypewriter() {
        const scene = SCENES[this._currentScene];
        if (!scene || this._typewriterDone) return;

        clearInterval(this._typeTimer);
        const el = this._$(`#text-${this._currentScene}`);
        if (el) {
            el.innerHTML = scene.text;
        }
        this._typewriterDone = true;
        this._showAdvanceHint();
    }

    /** @private */
    _updateProgress(sceneIndex) {
        const bar = this._$('.progress-bar');
        if (!bar) return;
        const pct = ((sceneIndex + 1) / SCENES.length) * 100;
        bar.style.width = `${pct}%`;
    }

    /** @private */
    _showAdvanceHint() {
        this._$('.advance-hint')?.classList.add('visible');
    }

    /** @private */
    _hideAdvanceHint() {
        this._$('.advance-hint')?.classList.remove('visible');
    }

    // ── Audio ────────────────────────────────────────────────────────────

    /** @private */
    _startMusic() {
        // Fade out existing BGM
        if (audioManager.bgm && !audioManager.bgm.paused) {
            audioManager.bgm.pause();
        }

        // Create dedicated audio for lore
        this._loreAudio = new Audio('assets/audio/music/music_lore_intro.mp3');
        this._loreAudio.loop = false;
        this._loreAudio.volume = Math.max(0, Math.min(1, audioManager.musicVolume * 0.4));
        this._loreAudio.play().catch(() => {});
    }

    /** @private */
    _playVoice(voiceSrc) {
        // Stop any existing voice-over
        this._stopVoice();

        if (!voiceSrc) return;

        this._voiceAudio = new Audio(voiceSrc);
        this._voiceAudio.volume = Math.max(0, Math.min(1, audioManager.soundVolume * 1.5));
        this._voiceAudio.play().catch(() => {});
    }

    /** @private */
    _stopVoice() {
        if (!this._voiceAudio) return;
        this._voiceAudio.pause();
        this._voiceAudio.src = '';
        this._voiceAudio = null;
    }

    /** @private */
    _stopMusic() {
        if (!this._loreAudio) return;

        // Quick fade out
        const audio = this._loreAudio;
        const startVol = audio.volume;
        const steps = 15;
        const stepMs = FADE_OUT_MS / steps;
        let step = 0;

        const fadeInterval = setInterval(() => {
            step++;
            audio.volume = Math.max(0, startVol * (1 - step / steps));
            if (step >= steps) {
                clearInterval(fadeInterval);
                audio.pause();
                audio.src = '';
                this._loreAudio = null;
            }
        }, stepMs);
    }

    // ── Input handlers ───────────────────────────────────────────────────

    /** @private */
    _onKeyDown(e) {
        if (!this._isPlaying) return;
        if (e.key === 'Escape') {
            this._complete();
            return;
        }
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            this._handleAdvance();
        }
    }

    /** @private */
    _onPointerDown(e) {
        if (!this._isPlaying) return;
        // Ignore if clicking skip button (handled separately)
        if (e.target?.classList?.contains('skip-btn')) return;
        this._handleAdvance();
    }

    /** @private */
    _handleAdvance() {
        if (!this._typewriterDone) {
            // First tap: complete the typewriter instantly
            this._completeCurrentTypewriter();
            return;
        }
        // Second tap: advance to next scene
        clearTimeout(this._autoTimer);
        this._hideAdvanceHint();
        this._advanceScene();
    }

    // ── Completion & cleanup ─────────────────────────────────────────────

    /** @private */
    _complete() {
        if (!this._isPlaying) return;
        this._isPlaying = false;

        // Fade-out overlay
        const overlay = this._$('.lore-overlay');
        overlay?.classList.add('fade-out');

        // Stop voice and music with fade
        this._stopVoice();
        this._stopMusic();

        setTimeout(() => {
            overlay?.classList.remove('show', 'fade-out');
            this._cleanup();
            this._emit('lore-complete');
        }, FADE_OUT_MS + 50);
    }

    /** @private */
    _cleanup() {
        this._isPlaying = false;
        clearTimeout(this._autoTimer);
        clearInterval(this._typeTimer);
        clearTimeout(this._skipTimer);

        document.removeEventListener('keydown', this._onKeyDown);
        this.shadowRoot?.removeEventListener('pointerdown', this._onPointerDown);

        // Reset all scenes
        this._$$('.scene').forEach(el => {
            el.classList.remove('active', 'exiting');
        });
        this._$$('.scene-text').forEach(el => {
            el.innerHTML = '';
        });
        this._$('.progress-bar')?.style.setProperty('width', '0%');
        this._$('.skip-btn')?.classList.remove('visible');
        this._$('.advance-hint')?.classList.remove('visible');

        if (this._voiceAudio) {
            this._voiceAudio.pause();
            this._voiceAudio.src = '';
            this._voiceAudio = null;
        }

        if (this._loreAudio) {
            this._loreAudio.pause();
            this._loreAudio.src = '';
            this._loreAudio = null;
        }
    }

    // ── Utilities ────────────────────────────────────────────────────────

    /** @private */
    _preloadScene(index) {
        return new Promise(resolve => {
            if (index < 0 || index >= SCENES.length) { resolve(); return; }
            const img = new Image();
            img.onload = resolve;
            img.onerror = resolve; // Resolve even on error to not block
            img.src = SCENES[index].image;
        });
    }

    /** @private */
    _wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

customElements.define('lore-intro', LoreIntro);
export { LoreIntro };
