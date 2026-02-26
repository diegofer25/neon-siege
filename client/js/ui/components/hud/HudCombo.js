/**
 * @fileoverview <hud-combo> — combo counter with timer bar.
 *
 * Internal IDs for HUDManager: comboCounter, comboLabel, comboCount, comboTimerFill
 */

import { BaseComponent } from '../BaseComponent.js';
import { createSheet } from '../shared-styles.js';

const styles = createSheet(/* css */`
  :host { display: contents; }

  .combo-counter {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: var(--spacing-sm) var(--spacing-lg);
    background: rgba(0, 0, 0, 0.7);
    border: 2px solid #fff;
    border-radius: var(--radius-lg);
    pointer-events: none;
    transition: border-color 0.2s;
  }

  .combo-label {
    font-family: var(--font-pixel);
    font-size: 10px;
    color: #fff;
    text-shadow: 0 0 8px currentColor;
    letter-spacing: 1px;
    transition: color 0.2s;
  }

  .combo-count {
    font-family: var(--font-pixel);
    font-size: 20px;
    color: #fff;
    text-shadow: 0 0 12px currentColor;
    line-height: 1;
    transition: color 0.2s;
  }

  .combo-timer-bar {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 2px;
    overflow: hidden;
  }

  .combo-timer-fill {
    height: 100%;
    width: 100%;
    background: #fff;
    border-radius: 2px;
    transition: width 0.1s linear, background 0.2s;
    box-shadow: 0 0 6px currentColor;
  }
`);

class HudCombo extends BaseComponent {
    connectedCallback() {
        this._render(/* html */`
            <div id="comboCounter" class="combo-counter" style="display: none;">
                <span id="comboLabel" class="combo-label">COMBO</span>
                <span id="comboCount" class="combo-count">0</span>
                <div class="combo-timer-bar">
                    <div id="comboTimerFill" class="combo-timer-fill"></div>
                </div>
            </div>
        `, styles);
    }
}

customElements.define('hud-combo', HudCombo);
export { HudCombo };
