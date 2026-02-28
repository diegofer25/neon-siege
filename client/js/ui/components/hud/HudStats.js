/**
 * @fileoverview <hud-stats> — ATK / SPD / HP REG / DEF REG stat display.
 *
 * Internal IDs for HUDManager: statsDisplay, attackValue, speedValue, hpsValue, regenValue
 */

import { BaseComponent } from '../BaseComponent.js';
import { createSheet } from '../shared-styles.js';

const styles = createSheet(/* css */`
  :host { display: contents; }

  #statsDisplay {
    position: absolute;
    bottom: 2px;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 5px;
  }

  .stat-item {
    display: flex;
    align-items: center;
    margin-bottom: 0;
    background: rgba(4, 10, 26, 0.72);
    padding: 6px 10px;
    border-radius: var(--radius-lg);
    border: 1px solid rgba(0, 255, 255, 0.34);
    box-shadow:
      0 0 10px rgba(0, 255, 255, 0.2),
      inset 0 0 10px rgba(0, 255, 255, 0.08);
    min-width: 150px;
    justify-content: space-between;
  }

  .stat-icon {
    font-size: 12px;
    margin-right: var(--spacing-sm);
    filter: drop-shadow(0 0 3px currentColor);
    flex-shrink: 0;
  }

  .stat-label {
    font-family: var(--font-pixel);
    color: var(--color-primary-neon);
    text-shadow: 0 0 3px var(--color-primary-neon);
    font-size: 7px;
    margin-right: var(--spacing-xs);
    flex-shrink: 0;
  }

  .stat-value {
    font-family: var(--font-pixel);
    color: #fff;
    text-shadow: 0 0 3px #fff;
    font-size: 7px;
    text-align: right;
    flex-grow: 1;
    transition: color 0.3s, text-shadow 0.3s, transform 0.3s;
  }

  /* Responsive — Tablet */
  @media (max-width: 768px) {
    .stat-item { margin-bottom: 2px; padding: 3px var(--spacing-md); min-width: 100px; }
    .stat-label, .stat-value { font-size: 7px; }
    .stat-icon { font-size: 10px; }
  }

  /* Responsive — Mobile */
  @media (max-width: 480px) {
    #statsDisplay { transform: scale(0.85); transform-origin: bottom right; }
    .stat-item { min-width: 80px; }
    .stat-label, .stat-value { font-size: 6px; }
    .stat-icon { font-size: 8px; }
  }

  /* Responsive — Landscape */
  @media (max-width: 900px) and (orientation: landscape) {
    #statsDisplay { transform: scale(0.9); transform-origin: bottom right; }
  }
`);

class HudStats extends BaseComponent {
    connectedCallback() {
        this._render(/* html */`
            <div id="statsDisplay" class="hud-element">
                <div class="stat-item">
                    <span class="stat-icon">⚔️</span>
                    <span class="stat-label">ATK:</span>
                    <span id="attackValue" class="stat-value">10</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">⚡</span>
                    <span class="stat-label">SPD:</span>
                    <span id="speedValue" class="stat-value">1.0x</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">❤️</span>
                    <span class="stat-label">HP REG:</span>
                    <span id="hpsValue" class="stat-value">0</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">💚</span>
                    <span class="stat-label">DEF REG:</span>
                    <span id="regenValue" class="stat-value">0</span>
                </div>
            </div>
        `, styles);
    }
}

customElements.define('hud-stats', HudStats);
export { HudStats };
