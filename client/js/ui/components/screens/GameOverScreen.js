/**
 * @fileoverview <game-over-screen> — end-of-run game over overlay.
 *
 * Public API:
 *   setStats({ wave, score, combo, level })
 *   setNewRecord(bool)
 *   setNearMiss(text | null)
 *   setCreditInfo({ freeRemaining, purchased, total }, hasSave)
 *   setContinueLoading(bool)
 *   show() / hide()
 *
 * Events (composed, bubbling):
 *   'restart'       — "Start Again" button clicked
 *   'continue'      — "Continue" button clicked (spend 1 credit)
 *   'buy-credits'   — "Buy Credits" button clicked
 *   'show-leaderboard' — "View Leaderboard" button clicked
 *   'register-to-save' — "Register to Save & Submit Score" button clicked
 */

import { BaseComponent } from '../BaseComponent.js';
import { overlayStyles, createSheet } from '../shared-styles.js';
import { GameConfig } from '../../../config/GameConfig.js';

const styles = createSheet(/* css */ `
  :host { display: contents; }

  .credit-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin: 10px 0;
  }

  .credit-badge {
    display: inline-block;
    font-family: var(--font-pixel);
    font-size: 10px;
    color: var(--color-accent-yellow);
    text-shadow: 0 0 8px var(--color-accent-yellow);
    margin-top: 4px;
  }

  .credit-badge.empty {
    color: var(--color-accent-red);
    text-shadow: 0 0 8px var(--color-accent-red);
  }

  #buyBtn {
    --neon-bg: linear-gradient(45deg, #00c853, #00e676);
  }

  .continue-error {
    color: var(--color-accent-red);
    font-size: 12px;
    font-family: var(--font-pixel);
    margin-top: 4px;
    display: none;
  }

    .register-lock {
        display: none;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        margin: 8px 0 14px;
        max-width: 560px;
    }

    .register-lock p {
        margin: 0;
        font-size: 14px;
        color: #fff;
        line-height: 1.5;
        text-align: center;
    }

    .register-lock .register-hint {
        color: var(--color-primary-neon);
        text-shadow: 0 0 8px var(--color-primary-neon);
        font-family: var(--font-pixel);
        font-size: 10px;
        letter-spacing: 0.6px;
    }
`);

class GameOverScreen extends BaseComponent {
    connectedCallback() {
        this._render(/* html */ `
            <div class="overlay">
                <h1>GAME OVER</h1>
                <div id="newRecord" class="new-record" style="display: none;">NEW PERSONAL BEST!</div>
                <div class="game-over-stats">
                    <div class="go-stat-row"><span>Wave Reached</span><span id="wave">0</span></div>
                    <div class="go-stat-row"><span>Final Score</span><span id="score">0</span></div>
                    <div class="go-stat-row"><span>Best Combo</span><span id="combo">0</span></div>
                    <div class="go-stat-row"><span>Level Reached</span><span id="level">1</span></div>
                </div>
                <div id="nearMiss" class="near-miss" style="display: none;"></div>

                <div id="registerLock" class="register-lock">
                    <p>Save progress and submit your score by creating a registered account.</p>
                    <p class="register-hint">YOUR RUN STAYS ON SCREEN — REGISTER NOW TO UNLOCK SAVE + LEADERBOARD</p>
                    <neon-button id="registerBtn" variant="primary">REGISTER TO SAVE &amp; SUBMIT SCORE</neon-button>
                </div>

                <div class="credit-section">
                    <neon-button id="continueBtn" variant="primary" style="display: none;">CONTINUE</neon-button>
                    <span id="creditBadge" class="credit-badge"></span>
                    <span id="continueError" class="continue-error"></span>
                    <neon-button id="buyBtn" style="display: none;">BUY 10 CONTINUES — ${GameConfig.CONTINUE.PRICE_DISPLAY}</neon-button>
                </div>

                <neon-button id="leaderboardBtn">VIEW LEADERBOARD</neon-button>
                <neon-button id="restartBtn">START AGAIN</neon-button>
            </div>
        `, overlayStyles, styles);

        this._$('#restartBtn').addEventListener('click', () => this._emit('restart'));
        this._$('#leaderboardBtn').addEventListener('click', () => this._emit('show-leaderboard'));
        this._$('#continueBtn').addEventListener('click', () => this._emit('continue'));
        this._$('#buyBtn').addEventListener('click', () => this._emit('buy-credits'));
        this._$('#registerBtn').addEventListener('click', () => this._emit('register-to-save'));

        this._registrationRequired = false;
    }

    /** @param {{ wave: number, score: number, combo: number, level: number }} data */
    setStats({ wave, score, combo, level }) {
        this._$('#wave').textContent = wave.toString();
        this._$('#score').textContent = score.toLocaleString();
        this._$('#combo').textContent = combo.toString();
        this._$('#level').textContent = level.toString();
    }

    /** @param {boolean} isNew */
    setNewRecord(isNew) {
        const el = this._$('#newRecord');
        if (el) el.style.display = isNew ? 'block' : 'none';
    }

    /** @param {string|null} text */
    setNearMiss(text) {
        const el = this._$('#nearMiss');
        if (!el) return;
        if (text) {
            el.textContent = text;
            el.style.display = 'block';
        } else {
            el.style.display = 'none';
        }
    }

    /**
     * Update the continue/credits UI based on server balance and save availability.
     * @param {{ freeRemaining: number, purchased: number, total: number }} credits
     * @param {boolean} hasSave — whether a save checkpoint exists to continue from
     */
    setCreditInfo(credits, hasSave = false) {
        if (this._registrationRequired) {
            return;
        }

        const continueBtn = this._$('#continueBtn');
        const buyBtn = this._$('#buyBtn');
        const badge = this._$('#creditBadge');
        const errorEl = this._$('#continueError');

        // Clear any previous error
        if (errorEl) errorEl.style.display = 'none';

        if (hasSave && credits.total > 0) {
            // Show continue button with credit count
            continueBtn.style.display = 'inline-block';
            continueBtn.removeAttribute('disabled');
            delete continueBtn.dataset.prevLabel;
            continueBtn.textContent = `CONTINUE (${credits.total} left)`;
            badge.textContent = credits.freeRemaining > 0
                ? `${credits.freeRemaining} free + ${credits.purchased} purchased`
                : `${credits.purchased} purchased continues`;
            badge.classList.toggle('empty', false);
            buyBtn.style.display = 'none';
        } else if (hasSave && credits.total === 0) {
            // No continues — show buy button, hide continue
            continueBtn.style.display = 'none';
            badge.textContent = 'NO CONTINUES REMAINING';
            badge.classList.toggle('empty', true);
            buyBtn.style.display = 'inline-block';
        } else {
            // No save — nothing to continue from
            continueBtn.style.display = 'none';
            badge.textContent = '';
            buyBtn.style.display = 'none';
        }
    }

    /** @param {boolean} required */
    setRegistrationPrompt(required) {
        this._registrationRequired = !!required;

        const lock = this._$('#registerLock');
        const leaderboardBtn = this._$('#leaderboardBtn');
        const continueBtn = this._$('#continueBtn');
        const buyBtn = this._$('#buyBtn');
        const badge = this._$('#creditBadge');
        const errorEl = this._$('#continueError');

        if (lock) lock.style.display = required ? 'flex' : 'none';
        if (leaderboardBtn) leaderboardBtn.style.display = required ? 'none' : 'inline-block';
        if (continueBtn && required) continueBtn.style.display = 'none';
        if (buyBtn && required) buyBtn.style.display = 'none';
        if (badge && required) badge.textContent = '';
        if (errorEl && required) errorEl.style.display = 'none';
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
}

customElements.define('game-over-screen', GameOverScreen);
export { GameOverScreen };
