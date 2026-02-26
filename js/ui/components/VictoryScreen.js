/**
 * @fileoverview <victory-screen> — wave-30 victory overlay.
 *
 * Public API:
 *   setStats({ wave, score, combo, level, kills })
 *   setNewRecord(bool)
 *   show() / hide()
 *
 * Events (composed, bubbling):
 *   'continue-endless'  — "Continue to Endless" button clicked
 *   'return-to-menu'    — "Return to Menu" button clicked
 */

import { BaseComponent } from './BaseComponent.js';
import { overlayStyles, createSheet } from './shared-styles.js';

const styles = createSheet(/* css */ `
  :host { display: contents; }
  .victory-title {
    color: #ffcc00 !important;
    text-shadow:
      0 0 8px #ffcc00,
      0 0 20px #ffcc00,
      0 0 40px rgba(255, 204, 0, 0.5) !important;
    animation: victoryGlow 1.5s ease-in-out infinite alternate !important;
    font-size: 56px !important;
  }
  .victory-subtitle {
    color: #fff;
    font-size: 18px;
    margin-bottom: var(--spacing-lg);
    text-shadow: 0 0 10px rgba(255, 204, 0, 0.4);
  }
  .victory-stats {
    border-color: rgba(255, 204, 0, 0.4) !important;
    box-shadow: 0 0 20px rgba(255, 204, 0, 0.15) !important;
  }
  .victory-stats .go-stat-row {
    border-color: rgba(255, 204, 0, 0.25);
  }
  .victory-stats .go-stat-row span:last-child {
    color: #ffcc00;
    text-shadow: 0 0 4px #ffcc00;
  }
  @keyframes victoryGlow {
    from {
      text-shadow:
        0 0 8px #ffcc00,
        0 0 20px #ffcc00,
        0 0 40px rgba(255, 204, 0, 0.5);
    }
    to {
      text-shadow:
        0 0 12px #ffcc00,
        0 0 30px #ffcc00,
        0 0 60px rgba(255, 204, 0, 0.7),
        0 0 80px rgba(255, 204, 0, 0.3);
    }
  }
  /* Override overlay ::before for victory-specific radials */
  .overlay::before {
    background:
      radial-gradient(circle at 50% 40%, rgba(255, 204, 0, 0.15) 0%, transparent 50%),
      radial-gradient(circle at 30% 70%, rgba(0, 255, 102, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 70% 20%, rgba(153, 0, 255, 0.1) 0%, transparent 50%);
    animation: screenOverlay 8s ease-in-out infinite alternate;
  }
`);

class VictoryScreen extends BaseComponent {
    connectedCallback() {
        this._render(/* html */ `
            <div class="overlay">
                <h1 class="victory-title">VICTORY!</h1>
                <p class="victory-subtitle">You conquered all 30 waves!</p>
                <div id="newRecord" class="new-record" style="display: none;">NEW PERSONAL BEST!</div>
                <div class="game-over-stats victory-stats">
                    <div class="go-stat-row"><span>Waves Cleared</span><span id="wave">30</span></div>
                    <div class="go-stat-row"><span>Final Score</span><span id="score">0</span></div>
                    <div class="go-stat-row"><span>Best Combo</span><span id="combo">0</span></div>
                    <div class="go-stat-row"><span>Level Reached</span><span id="level">1</span></div>
                    <div class="go-stat-row"><span>Enemies Defeated</span><span id="kills">0</span></div>
                </div>
                <button id="continueBtn" class="primary">CONTINUE TO ENDLESS</button>
                <button id="menuBtn">RETURN TO MENU</button>
            </div>
        `, overlayStyles, styles);

        this._$('#continueBtn').addEventListener('click', () => this._emit('continue-endless'));
        this._$('#menuBtn').addEventListener('click', () => this._emit('return-to-menu'));
    }

    /** @param {{ wave: number, score: number, combo: number, level: number, kills: number }} data */
    setStats({ wave, score, combo, level, kills }) {
        this._$('#wave').textContent = wave.toString();
        this._$('#score').textContent = score.toLocaleString();
        this._$('#combo').textContent = combo.toString();
        this._$('#level').textContent = level.toString();
        this._$('#kills').textContent = kills.toString();
    }

    /** @param {boolean} isNew */
    setNewRecord(isNew) {
        const el = this._$('#newRecord');
        if (el) el.style.display = isNew ? 'block' : 'none';
    }
}

customElements.define('victory-screen', VictoryScreen);
export { VictoryScreen };
