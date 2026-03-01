/**
 * @fileoverview <start-screen> — initial menu screen with difficulty selector.
 *
 * Public API:
 *   setLastRunStats({ lastWave, lastScore, bestWave, bestScore })
 *   setContinueInfo(credits, saveData)
 *   setContinueLoading(bool)
 *   showContinueError(message)
 *   getSelectedDifficulty() → string
 *   setDifficulty(difficulty)
 *   show() / hide()
 *
 * Events (composed, bubbling):
 *   'start-game'         — "Click to Start" button clicked
 *   'continue-game'      — "Continue" button clicked (spends 1 credit)
 *   'buy-credits'        — "Buy Credits" button clicked
 *   'settings-click'     — "Settings" button clicked
 *   'difficulty-change'  — difficulty option clicked, detail: { difficulty }
 */

import { BaseComponent } from '../BaseComponent.js';
import { overlayStyles, createSheet } from '../shared-styles.js';
import { GameConfig } from '../../../config/GameConfig.js';
import '../hud/HudSettings.js';

const RUN_DIFFICULTY_VALUES = new Set(['easy', 'normal', 'hard']);
const APP_VERSION = import.meta.env.APP_VERSION || '0.0.0';

/** @param {string} value @returns {string} */
function normalizeDifficulty(value) {
    return RUN_DIFFICULTY_VALUES.has(value) ? value : 'normal';
}

const styles = createSheet(/* css */ `
  :host { display: contents; }
  /* Override overlay ::before for start-screen background image */
  .overlay {
    padding: clamp(18px, 4vh, 40px);
  }
  .overlay.show {
    animation: none;
    opacity: 1;
  }
  .overlay::before {
    background:
      linear-gradient(180deg, rgba(2, 5, 18, 0.42) 0%, rgba(2, 5, 18, 0.78) 100%),
      radial-gradient(circle at 20% 20%, rgba(0, 255, 255, 0.1) 0%, transparent 45%),
      radial-gradient(circle at 80% 80%, rgba(255, 45, 236, 0.12) 0%, transparent 45%),
      url('/assets/images/start_screen_bg.jpg') center/cover no-repeat;
    animation: none;
  }
  .menu-shell {
    width: min(92vw, 760px);
    max-height: 92vh;
    overflow: auto;
    border: 1px solid rgba(0, 255, 255, 0.34);
    border-radius: var(--radius-xxl);
    padding: clamp(18px, 3vw, 28px);
    background:
      linear-gradient(180deg, rgba(4, 10, 28, 0.88) 0%, rgba(6, 8, 20, 0.9) 100%);
    box-shadow:
      0 0 26px rgba(0, 255, 255, 0.22),
      0 0 34px rgba(255, 45, 236, 0.16),
      inset 0 0 20px rgba(0, 255, 255, 0.08);
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: var(--spacing-lg);
    opacity: 0;
    transform: translateY(10px);
  }
  .overlay.show .menu-shell {
    animation: menuReveal 0.45s ease-out 0.8s forwards;
  }
  .overlay.hide .menu-shell {
    animation: menuHide 0.2s ease-in forwards;
  }
  .menu-utility {
    display: flex;
    justify-content: flex-end;
  }
  #settingsBtn {
    --hud-settings-position: fixed;
    --hud-settings-top: clamp(14px, 2.2vw, 20px);
    --hud-settings-right: clamp(14px, 2.2vw, 20px);
    --hud-settings-z-index: calc(var(--z-overlay) + 1);
  }
  .menu-main {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
  }
  .start-logo {
    width: clamp(96px, 18vw, 180px);
    height: auto;
    margin-bottom: var(--spacing-sm);
    border-radius: 16px;
    border: 1px solid rgba(0, 255, 255, 0.35);
    box-shadow:
      0 0 18px rgba(0, 255, 255, 0.28),
      0 0 28px rgba(255, 45, 236, 0.2);
  }
  .menu-main h1 {
    margin-bottom: 2px;
    font-size: clamp(36px, 7vw, 54px);
    letter-spacing: 1.2px;
  }
  .menu-subtitle,
  .menu-objective {
    margin: 0;
    color: rgba(255, 255, 255, 0.92);
  }
  .menu-subtitle {
    font-size: clamp(15px, 2.3vw, 18px);
  }
  .menu-objective {
    font-size: clamp(13px, 2vw, 16px);
    color: rgba(255, 255, 255, 0.78);
  }
  .start-difficulty-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    margin: var(--spacing-md) 0 var(--spacing-sm);
    color: #fff;
    font-size: 16px;
    flex-wrap: wrap;
    justify-content: center;
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
  .menu-main neon-button {
    margin: 0;
    width: 100%;
    max-width: 480px;
  }
  .menu-main neon-button::part(button) {
    min-height: 54px;
    font-size: 16px;
    letter-spacing: 0.7px;
    padding: 13px 18px;
  }
  .menu-main neon-button::part(button):hover {
    animation: none;
    transform: translateY(-1px);
    text-shadow: 0 0 6px rgba(255, 255, 255, 0.55);
    box-shadow:
      0 0 14px rgba(0, 255, 255, 0.35),
      0 0 20px rgba(255, 45, 236, 0.26);
  }
  .menu-main neon-button::part(button):active {
    transform: translateY(0) scale(0.99);
  }
  .primary-actions {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    margin-top: var(--spacing-xs);
  }
  .last-run-stats {
    margin-top: var(--spacing-md);
    padding: var(--spacing-md) var(--spacing-lg);
    border: 1px solid rgba(0, 255, 255, 0.2);
    border-radius: var(--radius-md);
    background: rgba(0, 0, 0, 0.4);
    min-width: 280px;
    width: min(100%, 520px);
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
  .continue-section {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-xs);
  }
  #continueBtn::part(button) {
    background: rgba(255, 45, 236, 0.14);
    border-color: var(--color-secondary-neon);
    color: #fff;
    text-shadow: none;
    box-shadow: 0 0 14px rgba(255, 45, 236, 0.35);
    white-space: normal;
    line-height: 1.3;
  }
  #continueBtn::part(button):hover {
    animation: none;
    transform: translateY(-1px);
    background: rgba(255, 45, 236, 0.24);
    text-shadow: 0 0 4px rgba(255, 255, 255, 0.35);
    box-shadow:
      0 0 16px rgba(255, 45, 236, 0.52),
      0 0 20px rgba(0, 255, 255, 0.2);
  }
  .credit-badge {
    display: inline-block;
    font-family: var(--font-pixel);
    font-size: 10px;
    color: var(--color-accent-yellow);
    text-shadow: 0 0 8px var(--color-accent-yellow);
    text-align: center;
  }
  .credit-badge.empty {
    color: var(--color-accent-red);
    text-shadow: 0 0 8px var(--color-accent-red);
  }
  .continue-error {
    color: var(--color-accent-red);
    font-size: 12px;
    font-family: var(--font-pixel);
    display: none;
  }
  #buyBtn {
    --neon-bg: linear-gradient(45deg, #00c853, #00e676);
  }
  .menu-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
    padding-top: var(--spacing-xs);
    border-top: 1px solid rgba(0, 255, 255, 0.18);
  }
  .menu-footer-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }
  .menu-footer neon-button {
    margin: 0;
    width: auto;
    min-width: 190px;
  }
  #leaderboardBtn {
    margin-top: var(--spacing-xs);
  }
  .menu-footer neon-button::part(button) {
    width: auto;
    min-height: 46px;
    font-size: 14px;
    padding: 10px 18px;
  }
  .utility-btn {
    width: auto;
    min-width: 160px;
  }
  .utility-btn::part(button) {
    width: auto;
    min-height: 44px;
    font-size: 13px;
    padding: 10px 14px;
  }
  .version-badge {
    position: static;
    font-family: var(--font-pixel);
    font-size: 10px;
    color: var(--color-primary-neon);
    text-shadow: 0 0 6px var(--color-primary-neon);
    letter-spacing: 0.4px;
    opacity: 0.9;
    pointer-events: none;
    user-select: none;
  }
  @media (max-width: 900px) {
    .menu-shell {
      width: min(94vw, 640px);
    }
    .menu-footer {
      flex-direction: column;
      align-items: stretch;
    }
    .menu-footer-left {
      display: flex;
      flex-direction: column;
      width: 100%;
      gap: var(--spacing-sm);
    }
    .menu-footer neon-button {
      width: 100%;
      min-width: 0;
    }
  }
  @media (max-width: 640px) {
    .menu-shell {
      padding: 16px;
      gap: var(--spacing-md);
    }
    .menu-main h1 {
      font-size: clamp(30px, 11vw, 42px);
      margin-bottom: 4px;
    }
    .menu-subtitle {
      font-size: 15px;
    }
    .menu-objective {
      font-size: 13px;
    }
    .start-difficulty-row {
      justify-content: flex-start;
      width: 100%;
      font-size: 14px;
    }
    .start-difficulty-options {
      width: 100%;
      justify-content: space-between;
    }
    .start-difficulty-option {
      flex: 1;
      min-width: 0;
      padding: 8px 6px !important;
      font-size: 12px !important;
    }
    .last-run-stats {
      min-width: 0;
      width: 100%;
      padding: var(--spacing-sm) var(--spacing-md);
    }
    .last-run-row {
      font-size: 13px;
    }
    .last-run-row span:first-child {
      margin-right: var(--spacing-md);
    }
    .last-run-row span:last-child {
      font-size: 10px;
    }
    .utility-btn {
      width: 100%;
      min-width: 0;
    }
    #settingsBtn {
      --hud-settings-top: 12px;
      --hud-settings-right: 12px;
    }
  }
  @keyframes menuReveal {
    0% {
      opacity: 0;
      transform: translateY(10px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes menuHide {
    0% {
      opacity: 1;
      transform: translateY(0);
    }
    100% {
      opacity: 0;
      transform: translateY(8px);
    }
  }
`);

class StartScreen extends BaseComponent {
    connectedCallback() {
        this._render(/* html */ `
            <div class="overlay">
          <div class="menu-shell">
            <div class="menu-utility">
              <neon-button id="loginBtn" class="utility-btn">SIGN IN / REGISTER</neon-button>
                    </div>
            <div class="menu-main">
              <img class="start-logo" src="assets/images/start_screen_logo.png" alt="Neon Siege emblem">
              <h1>NEON SIEGE</h1>
              <p class="menu-subtitle">Auto-target turret defense with arcade neon chaos</p>
              <p class="menu-objective">Survive 30 waves, defeat 6 bosses, and build your skill path</p>
              <div class="start-difficulty-row" aria-label="Difficulty">
                <span>Difficulty</span>
                <div class="start-difficulty-options" id="difficultyGroup" role="radiogroup" aria-label="Select difficulty">
                  <button type="button" role="radio" class="start-difficulty-option" data-difficulty="easy" aria-checked="false" tabindex="-1">Easy</button>
                  <button type="button" role="radio" class="start-difficulty-option active" data-difficulty="normal" aria-checked="true" tabindex="0">Normal</button>
                  <button type="button" role="radio" class="start-difficulty-option" data-difficulty="hard" aria-checked="false" tabindex="-1">Hard</button>
                </div>
              </div>
              <div class="primary-actions">
                <neon-button id="startBtn" variant="primary">START RUN</neon-button>
                <div class="continue-section">
                  <neon-button id="continueBtn" style="display: none;">CONTINUE</neon-button>
                  <span id="creditBadge" class="credit-badge"></span>
                  <span id="continueError" class="continue-error"></span>
                  <neon-button id="buyBtn" style="display: none;">BUY CONTINUES</neon-button>
                </div>
              </div>
              <div id="lastRunStats" class="last-run-stats" style="display: none;">
                <div class="last-run-row"><span>Last Run: </span><span>Wave <span id="lastRunWave">0</span> — <span id="lastRunScore">0</span> pts</span></div>
                <div class="last-run-row best"><span>Best: </span><span>Wave <span id="bestWave">0</span> — <span id="bestScore">0</span> pts</span></div>
              </div>
            </div>
            <div class="menu-footer">
              <div class="menu-footer-left">
                <neon-button id="leaderboardBtn">LEADERBOARD</neon-button>
                <neon-button id="achievementsBtn">ACHIEVEMENTS</neon-button>
              </div>
              <span id="versionBadge" class="version-badge">v${APP_VERSION}</span>
            </div>
                </div>
            <hud-settings id="settingsBtn"></hud-settings>
            </div>
        `, overlayStyles, styles);

        this._$('#startBtn').addEventListener('click', () => this._emit('start-game'));
        this._$('#continueBtn').addEventListener('click', () => this._emit('continue-game'));
        this._$('#buyBtn').addEventListener('click', () => this._emit('buy-credits'));
        this._$('#leaderboardBtn').addEventListener('click', () => this._emit('show-leaderboard'));
        this._$('#achievementsBtn').addEventListener('click', () => this._emit('show-achievements'));
        this._$('#loginBtn').addEventListener('click', () => this._emit('show-login'));
        this._setupDifficultyControls();
        this._syncVersionBadge();
    }

      /** @private */
      async _syncVersionBadge() {
        const badge = this._$('#versionBadge');
        if (!badge) return;

        badge.textContent = `v${APP_VERSION}`;

        try {
          const response = await fetch('./package.json', { cache: 'no-store' });
          if (!response.ok) return;
          const pkg = await response.json();
          const version = typeof pkg?.version === 'string' ? pkg.version.trim() : '';
          if (version) {
            badge.textContent = `v${version}`;
          }
        } catch {
          // Keep compile-time version fallback
        }
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

    /**
     * Update the continue/credits UI based on credit balance and save availability.
     * Mirrors the GameOverScreen.setCreditInfo() API.
     * @param {{ freeRemaining: number, purchased: number, total: number }} credits
     * @param {{ wave?: number, checkpointWave?: number }|null} [saveData]
     */
    setContinueInfo(credits, saveData = null) {
        const continueBtn = this._$('#continueBtn');
        const buyBtn = this._$('#buyBtn');
        const badge = this._$('#creditBadge');
        const errorEl = this._$('#continueError');
        if (!continueBtn) return;

        if (errorEl) errorEl.style.display = 'none';

        if (saveData && credits.total > 0) {
            const wave = saveData.checkpointWave ?? saveData.wave ?? '?';
            const creditLabel = credits.total === 1 ? '1 continue' : `${credits.total} continues`;
            continueBtn.textContent = `CONTINUE — WAVE ${wave} (${creditLabel})`;
            continueBtn.style.display = '';
            continueBtn.removeAttribute('disabled');
            if (badge) {
                badge.textContent = credits.freeRemaining > 0
                    ? `${credits.freeRemaining} free + ${credits.purchased} purchased`
                    : `${credits.purchased} purchased continue${credits.purchased !== 1 ? 's' : ''}`;
                badge.classList.remove('empty');
            }
            if (buyBtn) buyBtn.style.display = 'none';
        } else if (saveData && credits.total === 0) {
            continueBtn.style.display = 'none';
            if (badge) {
                badge.textContent = 'NO CONTINUES REMAINING';
                badge.classList.add('empty');
            }
            if (buyBtn) {
                buyBtn.textContent = `BUY 10 CONTINUES — ${GameConfig.CONTINUE.PRICE_DISPLAY}`;
                buyBtn.style.display = 'inline-block';
            }
        } else {
            // No save — hide everything
            continueBtn.style.display = 'none';
            if (badge) badge.textContent = '';
            if (buyBtn) buyBtn.style.display = 'none';
        }
    }

    /**
     * Show loading state on the continue button.
     * @param {boolean} loading
     */
    setContinueLoading(loading) {
        const btn = this._$('#continueBtn');
        if (!btn) return;
        if (loading) {
        btn.dataset.prevLabel = btn.textContent || 'CONTINUE';
            btn.setAttribute('disabled', '');
            btn.textContent = 'CONTINUING...';
        } else {
            btn.removeAttribute('disabled');
        if (btn.textContent === 'CONTINUING...') {
          btn.textContent = btn.dataset.prevLabel || 'CONTINUE';
        }
        delete btn.dataset.prevLabel;
        }
    }

    /**
     * Show an error message under the continue section.
     * @param {string} message
     */
    showContinueError(message) {
        const el = this._$('#continueError');
        if (!el) return;
        el.textContent = message;
        el.style.display = 'block';
    }

    /** @param {{ display_name: string, auth_provider?: string }|null} user */
    setAuthUser(user) {
        const btn = this._$('#loginBtn');
        if (!btn) return;
      if (user) {
            btn.textContent = 'PROFILE';
        } else {
            btn.textContent = 'SIGN IN / REGISTER';
        }
    }

}

customElements.define('start-screen', StartScreen);
export { StartScreen };
