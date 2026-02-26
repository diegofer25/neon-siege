/**
 * @fileoverview <hud-score> — score display with multiplier.
 *
 * Internal IDs for HUDManager: scoreValue, scoreMultiplier
 */

import { BaseComponent } from '../BaseComponent.js';
import { createSheet } from '../shared-styles.js';

const styles = createSheet(/* css */`
  :host { display: contents; }

  .score-display {
    position: absolute;
    top: 0;
    right: 70px;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(0, 0, 0, 0.55);
    border: 1px solid rgba(255, 45, 236, 0.35);
    border-radius: var(--radius-md);
    box-shadow: 0 0 10px rgba(255, 45, 236, 0.16);
    pointer-events: none;
  }

  .score-value {
    font-family: var(--font-pixel);
    color: #fff;
    text-shadow: 0 0 5px #fff;
    font-size: 12px;
    line-height: 1;
  }

  .score-multiplier {
    font-family: var(--font-pixel);
    color: var(--color-accent-yellow);
    text-shadow: 0 0 8px var(--color-accent-yellow);
    font-size: 10px;
    animation: pulseGlow 0.6s ease-in-out infinite alternate;
  }

  @keyframes pulseGlow {
    from { opacity: 0.7; }
    to   { opacity: 1; }
  }
`);

class HudScore extends BaseComponent {
    connectedCallback() {
        this._render(/* html */`
            <div id="scoreDisplay" class="score-display">
                <span id="scoreValue" class="score-value">0</span>
                <span id="scoreMultiplier" class="score-multiplier" style="display: none;">x1.0</span>
            </div>
        `, styles);
    }
}

customElements.define('hud-score', HudScore);
export { HudScore };
