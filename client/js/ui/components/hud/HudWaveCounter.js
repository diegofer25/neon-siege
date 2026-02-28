/**
 * @fileoverview <hud-wave-counter> — wave counter and XP bar.
 *
 * Internal IDs for HUDManager: wave, xpBar, xpFill, xpLevel
 */

import { BaseComponent } from '../BaseComponent.js';
import { createSheet } from '../shared-styles.js';

const styles = createSheet(/* css */`
  :host { display: contents; }

  .hud-element {
    display: inline-block;
    pointer-events: auto;
  }

  #waveCounter {
    position: absolute;
    top: 4px;
    left: 50%;
    transform: translateX(-50%);
    padding: 9px 16px;
    border: 1px solid rgba(0, 255, 255, 0.4);
    border-radius: var(--radius-lg);
    background: rgba(4, 10, 26, 0.72);
    box-shadow:
      0 0 14px rgba(0, 255, 255, 0.24),
      inset 0 0 12px rgba(0, 255, 255, 0.08);
  }

  #wave {
    font-family: var(--font-pixel);
    color: var(--color-primary-neon);
    text-shadow: 0 0 5px var(--color-primary-neon), 0 0 10px var(--color-primary-neon);
    font-size: 12px;
    line-height: 1;
    letter-spacing: 0.4px;
  }

  .xp-bar {
    position: absolute;
    top: 44px;
    left: 50%;
    transform: translateX(-50%);
    width: 220px;
    height: 12px;
    background: rgba(0, 0, 0, 0.66);
    border: 1px solid rgba(143, 0, 255, 0.45);
    border-radius: 999px;
    overflow: hidden;
    pointer-events: none;
    box-shadow: inset 0 0 6px rgba(143, 0, 255, 0.28);
  }

  .xp-fill {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, var(--color-tertiary-neon), var(--color-secondary-neon));
    border-radius: 999px;
    transition: width 0.3s ease;
    box-shadow: 0 0 8px rgba(143, 0, 255, 0.5);
  }

  .xp-level {
    position: absolute;
    right: -48px;
    top: 50%;
    transform: translateY(-50%);
    font-family: var(--font-pixel);
    font-size: 8px;
    color: var(--color-secondary-neon);
    text-shadow: 0 0 4px var(--color-secondary-neon);
    white-space: nowrap;
  }

  /* Responsive — Tablet */
  @media (max-width: 768px) {
    #waveCounter {
      top: 2px;
      left: 60%;
      transform: translateX(-50%);
      padding: 6px var(--spacing-sm);
    }
    #wave { font-size: 9px; }
    .xp-bar { width: 178px; top: 36px; height: 10px; }
    .xp-level { right: -42px; font-size: 7px; }
  }

  /* Responsive — Mobile */
  @media (max-width: 480px) {
    #waveCounter {
      top: 2px;
      left: 62%;
      padding: 5px 7px;
    }
    #wave { font-size: 8px; }
    .xp-bar { width: 156px; top: 33px; height: 9px; }
    .xp-level { right: -36px; font-size: 6px; }
  }

  /* Responsive — Landscape */
  @media (max-width: 900px) and (orientation: landscape) {
    #waveCounter {
      top: 2px;
      left: 50%;
      transform: translateX(-50%);
      padding: 6px 8px;
    }
    #wave { font-size: 10px; }
    .xp-bar { width: 164px; top: 33px; height: 9px; }
    .xp-level { right: -38px; font-size: 7px; }
  }
`);

class HudWaveCounter extends BaseComponent {
    connectedCallback() {
        this._render(/* html */`
            <div id="waveCounter" class="hud-element">
                <span id="wave">Wave: 1</span>
            </div>
            <div id="xpBar" class="xp-bar">
                <div id="xpFill" class="xp-fill"></div>
                <span id="xpLevel" class="xp-level">Lv.1</span>
            </div>
        `, styles);
    }
}

customElements.define('hud-wave-counter', HudWaveCounter);
export { HudWaveCounter };
