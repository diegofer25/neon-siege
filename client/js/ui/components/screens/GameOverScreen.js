/**
 * @fileoverview <game-over-screen> — end-of-run game over overlay.
 *
 * Public API:
 *   setStats({ wave, score, combo, level })
 *   setNewRecord(bool)
 *   setNearMiss(text | null)
 *   setLoadSaveVisible(bool)
 *   show() / hide()
 *
 * Events (composed, bubbling):
 *   'restart'    — "Start Again" button clicked
 *   'load-save'  — "Load Last Save" button clicked
 */

import { BaseComponent } from '../BaseComponent.js';
import { overlayStyles, createSheet } from '../shared-styles.js';

const styles = createSheet(/* css */ `
  :host { display: contents; }
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
                <neon-button id="loadBtn" style="display: none;">LOAD LAST SAVE</neon-button>
                <neon-button id="leaderboardBtn">VIEW LEADERBOARD</neon-button>
                <neon-button id="restartBtn" variant="primary">START AGAIN</neon-button>
            </div>
        `, overlayStyles, styles);

        this._$('#restartBtn').addEventListener('click', () => this._emit('restart'));
        this._$('#loadBtn').addEventListener('click', () => this._emit('load-save'));
        this._$('#leaderboardBtn').addEventListener('click', () => this._emit('show-leaderboard'));
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

    /** @param {boolean} visible */
    setLoadSaveVisible(visible) {
        const el = this._$('#loadBtn');
        if (el) el.style.display = visible ? 'inline-block' : 'none';
    }
}

customElements.define('game-over-screen', GameOverScreen);
export { GameOverScreen };
