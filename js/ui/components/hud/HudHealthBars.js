/**
 * @fileoverview <hud-health-bars> — health bar, defense/shield bar, and coin display.
 *
 * Internal IDs exposed for HUDManager shadow-root caching:
 *   healthBar, healthFill, healthText,
 *   defenseBar, defenseFill, defenseText,
 *   coinDisplay, coinAmount
 */

import { BaseComponent } from '../BaseComponent.js';
import { createSheet } from '../shared-styles.js';

const styles = createSheet(/* css */`
  :host {
    display: contents;
  }

  .hud-element {
    display: inline-block;
    pointer-events: auto;
  }

  #healthBar {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 6px var(--spacing-sm);
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(0, 255, 255, 0.26);
    border-radius: var(--radius-md);
    box-shadow: 0 0 10px rgba(0, 255, 255, 0.16);
  }

  #defenseBar {
    position: absolute;
    top: 46px;
    left: 0;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 6px var(--spacing-sm);
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(255, 45, 236, 0.26);
    border-radius: var(--radius-md);
    box-shadow: 0 0 10px rgba(255, 45, 236, 0.16);
  }

  .healthbar, .defensebar {
    position: relative;
    width: clamp(140px, 15vw, 200px);
    height: 16px;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 99px;
    overflow: hidden;
    box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.8);
  }

  .healthfill {
    position: absolute;
    top: 0; left: 0;
    height: 100%;
    width: 100%;
    background: linear-gradient(90deg, var(--color-accent-green) 0%, #00e67a 50%, #39ff8e 100%);
    border-radius: 99px;
    transition: width 0.2s ease;
    box-shadow: 0 0 8px var(--color-accent-green);
  }

  .defensefill {
    position: absolute;
    top: 0; left: 0;
    height: 100%;
    width: 100%;
    background: linear-gradient(90deg, var(--color-secondary-neon) 0%, #ff5def 50%, #ff80f4 100%);
    border-radius: 99px;
    transition: width 0.2s ease;
    box-shadow: 0 0 8px var(--color-secondary-neon);
  }

  #healthText, #defenseText {
    font-family: var(--font-pixel);
    font-size: 9px;
    color: #fff;
    text-shadow: 0 0 4px rgba(0, 0, 0, 0.7);
    white-space: nowrap;
  }

  .coin-display {
    position: absolute;
    top: 52px;
    left: 120px;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    background: var(--bg-glass);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    border: 2px solid var(--color-accent-yellow);
    box-shadow:
      0 0 12px rgba(255, 255, 0, 0.25),
      inset 0 0 10px rgba(255, 255, 0, 0.08);
    transition: top var(--transition-normal);
  }

  .coin-display.with-shield {
    top: 100px;
    left: 120px;
  }

  .coin-icon {
    color: var(--color-accent-yellow);
    font-size: 14px;
    filter: drop-shadow(0 0 3px var(--color-accent-yellow));
  }

  .coin-amount {
    font-family: var(--font-pixel);
    color: var(--color-accent-yellow);
    text-shadow: 0 0 3px var(--color-accent-yellow);
    font-size: 11px;
  }

  /* Responsive — Tablet */
  @media (max-width: 768px) {
    #healthBar, #defenseBar { padding: 5px 6px; gap: 6px; }
    #defenseBar { top: 42px; }
    .healthbar, .defensebar { width: clamp(120px, 33vw, 180px); height: 12px; }
    #healthText, #defenseText { font-size: 8px; }
    .coin-display { top: 42px; padding: 5px 7px; }
    .coin-display.with-shield { top: 78px; }
    .coin-icon { font-size: 10px; }
    .coin-amount { font-size: 8px; }
  }

  /* Responsive — Mobile */
  @media (max-width: 480px) {
    #healthBar, #defenseBar { max-width: calc(100vw - 112px); padding: 4px 5px; gap: 5px; }
    #defenseBar { top: 39px; }
    .healthbar, .defensebar { width: clamp(104px, 35vw, 150px); height: 11px; }
    #healthText, #defenseText { font-size: 7px; }
    .coin-display { top: 40px; padding: 5px 7px; }
    .coin-display.with-shield { top: 74px; }
    .coin-icon { font-size: 10px; }
    .coin-amount { font-size: 8px; }
  }

  /* Responsive — Landscape */
  @media (max-width: 900px) and (orientation: landscape) {
    #healthBar, #defenseBar { padding: 4px 6px; gap: 5px; }
    #defenseBar { top: 34px; }
    .healthbar, .defensebar { width: clamp(120px, 18vw, 170px); height: 10px; }
    #healthText, #defenseText { font-size: 7px; }
    .coin-display { top: 36px; padding: 4px 8px; }
    .coin-display.with-shield { top: 68px; }
    .coin-icon { font-size: 10px; }
    .coin-amount { font-size: 10px; }
  }
`);

class HudHealthBars extends BaseComponent {
    connectedCallback() {
        this._render(/* html */`
            <div id="healthBar" class="hud-element">
                <div class="healthbar">
                    <div class="healthfill" id="healthFill"></div>
                </div>
                <span id="healthText">100/100</span>
            </div>
            <div id="defenseBar" class="hud-element" style="display: none;">
                <div class="defensebar">
                    <div class="defensefill" id="defenseFill"></div>
                </div>
                <span id="defenseText">0/0</span>
            </div>
            <div id="coinDisplay" class="coin-display" style="display: none;">
                <span class="coin-icon">🪙</span>
                <span id="coinAmount" class="coin-amount">0</span>
            </div>
        `, styles);
    }
}

customElements.define('hud-health-bars', HudHealthBars);
export { HudHealthBars };
