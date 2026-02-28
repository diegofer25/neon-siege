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

  #playerIdentity {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px var(--spacing-sm);
    background: rgba(0, 0, 0, 0.46);
    border: 1px solid rgba(0, 255, 255, 0.24);
    border-radius: var(--radius-md);
    box-shadow:
      0 0 10px rgba(0, 255, 255, 0.14),
      inset 0 0 8px rgba(0, 255, 255, 0.06);
    pointer-events: none;
  }

  #playerName {
    max-width: 170px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-pixel);
    font-size: 9px;
    color: #fff;
    text-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
    letter-spacing: 0.3px;
  }

  #playerLevel {
    font-family: var(--font-pixel);
    font-size: 8px;
    color: var(--color-primary-neon);
    text-shadow: 0 0 5px var(--color-primary-neon);
    border: 1px solid rgba(0, 255, 255, 0.34);
    border-radius: 999px;
    padding: 2px 6px;
    background: rgba(0, 255, 255, 0.08);
  }

  #healthBar {
    position: absolute;
    top: 30px;
    left: 0;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 6px var(--spacing-sm);
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(0, 255, 255, 0.34);
    border-radius: var(--radius-md);
    box-shadow:
      0 0 12px rgba(0, 255, 255, 0.2),
      inset 0 0 10px rgba(0, 255, 255, 0.06);
  }

  #defenseBar {
    position: absolute;
    top: 62px;
    left: 0;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 6px var(--spacing-sm);
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 45, 236, 0.34);
    border-radius: var(--radius-md);
    box-shadow:
      0 0 12px rgba(255, 45, 236, 0.2),
      inset 0 0 10px rgba(255, 45, 236, 0.06);
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
    top: 98px;
    left: 0;
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
    top: 130px;
    left: 0;
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
    #playerIdentity { padding: 4px 6px; gap: 5px; }
    #playerName { max-width: 138px; font-size: 8px; }
    #playerLevel { font-size: 7px; padding: 2px 5px; }
    #healthBar, #defenseBar { padding: 5px 6px; gap: 6px; }
    #healthBar { top: 26px; }
    #defenseBar { top: 54px; }
    .healthbar, .defensebar { width: clamp(120px, 33vw, 180px); height: 12px; }
    #healthText, #defenseText { font-size: 8px; }
    .coin-display { top: 84px; padding: 5px 7px; }
    .coin-display.with-shield { top: 112px; }
    .coin-icon { font-size: 10px; }
    .coin-amount { font-size: 8px; }
  }

  /* Responsive — Mobile */
  @media (max-width: 480px) {
    #playerIdentity { padding: 3px 5px; gap: 4px; }
    #playerName { max-width: 112px; font-size: 7px; }
    #playerLevel { font-size: 6px; padding: 2px 4px; }
    #healthBar, #defenseBar { max-width: calc(100vw - 112px); padding: 4px 5px; gap: 5px; }
    #healthBar { top: 23px; }
    #defenseBar { top: 49px; }
    .healthbar, .defensebar { width: clamp(104px, 35vw, 150px); height: 11px; }
    #healthText, #defenseText { font-size: 7px; }
    .coin-display { top: 77px; padding: 5px 7px; }
    .coin-display.with-shield { top: 102px; }
    .coin-icon { font-size: 10px; }
    .coin-amount { font-size: 8px; }
  }

  /* Responsive — Landscape */
  @media (max-width: 900px) and (orientation: landscape) {
    #playerIdentity { padding: 3px 6px; }
    #playerName { max-width: 122px; font-size: 7px; }
    #playerLevel { font-size: 6px; }
    #healthBar, #defenseBar { padding: 4px 6px; gap: 5px; }
    #healthBar { top: 22px; }
    #defenseBar { top: 46px; }
    .healthbar, .defensebar { width: clamp(120px, 18vw, 170px); height: 10px; }
    #healthText, #defenseText { font-size: 7px; }
    .coin-display { top: 72px; padding: 4px 8px; }
    .coin-display.with-shield { top: 95px; }
    .coin-icon { font-size: 10px; }
    .coin-amount { font-size: 10px; }
  }
`);

class HudHealthBars extends BaseComponent {
    connectedCallback() {
        this._render(/* html */`
          <div id="playerIdentity" class="hud-element">
            <span id="playerName">PLAYER</span>
            <span id="playerLevel">LV 1</span>
          </div>
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
