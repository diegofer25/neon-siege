/**
 * @fileoverview <start-screen> — initial menu screen with difficulty selector.
 *
 * Public API:
 *   setLastRunStats({ lastWave, lastScore, bestWave, bestScore })
 *   getSelectedDifficulty() → string
 *   setDifficulty(difficulty)
 *   show() / hide()
 *
 * Events (composed, bubbling):
 *   'start-game'         — "Click to Start" button clicked
 *   'difficulty-change'  — difficulty option clicked, detail: { difficulty }
 */

import { BaseComponent } from '../BaseComponent.js';
import { overlayStyles, createSheet } from '../shared-styles.js';

const RUN_DIFFICULTY_VALUES = new Set(['easy', 'normal', 'hard']);

/** @param {string} value @returns {string} */
function normalizeDifficulty(value) {
    return RUN_DIFFICULTY_VALUES.has(value) ? value : 'normal';
}

const styles = createSheet(/* css */ `
  :host { display: contents; }
  /* Override overlay ::before for start-screen background image */
  .overlay::before {
    background:
      linear-gradient(180deg, rgba(2, 5, 18, 0.42) 0%, rgba(2, 5, 18, 0.78) 100%),
      radial-gradient(circle at 20% 20%, rgba(0, 255, 255, 0.1) 0%, transparent 45%),
      radial-gradient(circle at 80% 80%, rgba(255, 45, 236, 0.12) 0%, transparent 45%),
      url('/assets/images/start_screen_bg.jpg') center/cover no-repeat;
    animation: none;
  }
  .start-logo {
    width: clamp(96px, 18vw, 180px);
    height: auto;
    margin-bottom: 14px;
    border-radius: 16px;
    border: 1px solid rgba(0, 255, 255, 0.35);
    box-shadow:
      0 0 18px rgba(0, 255, 255, 0.28),
      0 0 28px rgba(255, 45, 236, 0.2);
  }
  .start-difficulty-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    margin: 5px 0 var(--spacing-md);
    color: #fff;
    font-size: 16px;
  }
  .start-difficulty-options {
    display: inline-flex;
    gap: var(--spacing-xs);
    padding: 4px;
    border: 1px solid rgba(0, 255, 255, 0.45);
    border-radius: var(--radius-md);
    background: rgba(0, 0, 0, 0.45);
    box-shadow: 0 0 10px rgba(0, 255, 255, 0.2);
  }
  .start-difficulty-option {
    min-width: 72px;
    margin: 0 !important;
    padding: 8px 12px !important;
    font-size: 13px !important;
    border-radius: var(--radius-sm) !important;
    border: 1px solid rgba(255, 255, 255, 0.35) !important;
    background: rgba(255, 255, 255, 0.06) !important;
    box-shadow: none !important;
    text-transform: none !important;
    letter-spacing: 0 !important;
  }
  .start-difficulty-option::before { display: none; }
  .start-difficulty-option:hover {
    animation: none !important;
    border-color: var(--color-secondary-neon) !important;
    box-shadow: 0 0 10px rgba(255, 45, 236, 0.35) !important;
  }
  .start-difficulty-option.active {
    border-color: var(--color-primary-neon) !important;
    background: rgba(0, 255, 255, 0.14) !important;
    box-shadow: 0 0 12px rgba(0, 255, 255, 0.45) !important;
    color: var(--color-primary-neon);
  }
  .last-run-stats {
    margin-top: var(--spacing-lg);
    padding: var(--spacing-md) var(--spacing-lg);
    border: 1px solid rgba(0, 255, 255, 0.2);
    border-radius: var(--radius-md);
    background: rgba(0, 0, 0, 0.4);
    min-width: 280px;
  }
  .last-run-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-xs) 0;
    font-size: 14px;
    color: #aaa;
  }
  .last-run-row span:first-child {
    margin-right: var(--spacing-lg);
  }
  .last-run-row span:last-child {
    font-family: var(--font-pixel);
    font-size: 11px;
    color: var(--color-primary-neon);
    text-shadow: 0 0 4px var(--color-primary-neon);
  }
  .last-run-row.best span:first-child { color: #ffcc00; }
  .last-run-row.best span:last-child {
    color: #ffcc00;
    text-shadow: 0 0 4px #ffcc00;
  }
`);

class StartScreen extends BaseComponent {
    connectedCallback() {
        this._render(/* html */ `
            <div class="overlay">
                <img class="start-logo" src="assets/images/start_screen_logo.png" alt="Neon Siege emblem">
                <h1>NEON SIEGE</h1>
                <p>Conquer 30 waves and defeat 6 unique bosses</p>
                <p>Auto-targeting turret defense game</p>
                <p>Level up and unlock skills between waves!</p>
                <div class="start-difficulty-row" aria-label="Difficulty">
                    <span>Difficulty</span>
                    <div class="start-difficulty-options" id="difficultyGroup" role="radiogroup" aria-label="Select difficulty">
                        <button type="button" role="radio" class="start-difficulty-option" data-difficulty="easy" aria-checked="false" tabindex="-1">Easy</button>
                        <button type="button" role="radio" class="start-difficulty-option active" data-difficulty="normal" aria-checked="true" tabindex="0">Normal</button>
                        <button type="button" role="radio" class="start-difficulty-option" data-difficulty="hard" aria-checked="false" tabindex="-1">Hard</button>
                    </div>
                </div>
                <neon-button id="startBtn" variant="primary">CLICK TO START</neon-button>
                <div id="lastRunStats" class="last-run-stats" style="display: none;">
                    <div class="last-run-row"><span>Last Run: </span><span>Wave <span id="lastRunWave">0</span> — <span id="lastRunScore">0</span> pts</span></div>
                    <div class="last-run-row best"><span>Best: </span><span>Wave <span id="bestWave">0</span> — <span id="bestScore">0</span> pts</span></div>
                </div>
            </div>
        `, overlayStyles, styles);

        this._$('#startBtn').addEventListener('click', () => this._emit('start-game'));
        this._setupDifficultyControls();
    }

    /** @private */
    _setupDifficultyControls() {
        const root = this._$('#difficultyGroup');
        if (!root) return;

        root.addEventListener('click', (e) => {
            const target = /** @type {HTMLElement} */ (e.target);
            const optionButton = /** @type {HTMLButtonElement|null} */ (target.closest('.start-difficulty-option'));
            if (!optionButton) return;
            const difficulty = normalizeDifficulty(optionButton.dataset.difficulty || 'normal');
            this.setDifficulty(difficulty);
            this._emit('difficulty-change', { difficulty });
        });

        root.addEventListener('keydown', (e) => {
            const isForward = e.key === 'ArrowRight' || e.key === 'ArrowDown';
            const isBackward = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
            const isFirst = e.key === 'Home';
            const isLast = e.key === 'End';
            if (!isForward && !isBackward && !isFirst && !isLast) return;

            const target = /** @type {HTMLElement} */ (e.target);
            const options = Array.from(root.querySelectorAll('.start-difficulty-option'));
            if (!options.length) return;

            const currentButton = target.closest('.start-difficulty-option');
            const currentIndex = Math.max(0, options.indexOf(currentButton || options[0]));
            let nextIndex = currentIndex;
            if (isFirst) nextIndex = 0;
            else if (isLast) nextIndex = options.length - 1;
            else if (isForward) nextIndex = (currentIndex + 1) % options.length;
            else if (isBackward) nextIndex = (currentIndex - 1 + options.length) % options.length;

            const nextButton = /** @type {HTMLButtonElement} */ (options[nextIndex]);
            const nextDifficulty = normalizeDifficulty(nextButton.dataset.difficulty || 'normal');
            e.preventDefault();
            this.setDifficulty(nextDifficulty);
            nextButton.focus();
            this._emit('difficulty-change', { difficulty: nextDifficulty });
        });
    }

    /** @returns {string} */
    getSelectedDifficulty() {
        const active = this._$('.start-difficulty-option.active');
        return normalizeDifficulty(active?.dataset?.difficulty || 'normal');
    }

    /** @param {string} difficulty */
    setDifficulty(difficulty) {
        const normalized = normalizeDifficulty(difficulty);
        const options = this._$$('.start-difficulty-option');
        options.forEach(option => {
            const isActive = normalizeDifficulty(option.dataset.difficulty || '') === normalized;
            option.classList.toggle('active', isActive);
            option.setAttribute('aria-checked', isActive ? 'true' : 'false');
            option.tabIndex = isActive ? 0 : -1;
        });
    }

    /** @param {{ lastWave?: number, lastScore?: number, bestWave?: number, bestScore?: number }} data */
    setLastRunStats({ lastWave, lastScore, bestWave, bestScore }) {
        const container = this._$('#lastRunStats');
        if (!container) return;

        if (lastWave == null && bestWave == null) {
            container.style.display = 'none';
            return;
        }

        if (lastWave != null) {
            const waveEl = this._$('#lastRunWave');
            const scoreEl = this._$('#lastRunScore');
            if (waveEl) waveEl.textContent = lastWave.toString();
            if (scoreEl) scoreEl.textContent = (lastScore || 0).toLocaleString();
        }

        const bestWaveEl = this._$('#bestWave');
        const bestScoreEl = this._$('#bestScore');
        if (bestWaveEl) bestWaveEl.textContent = (bestWave || 0).toString();
        if (bestScoreEl) bestScoreEl.textContent = (bestScore || 0).toLocaleString();

        container.style.display = 'block';
    }

}

customElements.define('start-screen', StartScreen);
export { StartScreen };
