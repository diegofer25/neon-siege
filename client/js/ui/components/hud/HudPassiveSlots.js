/**
 * @fileoverview <hud-passive-slots> — dynamically populated passive skill icons.
 *
 * Internal IDs for HUDManager: passiveSlots
 */

import { BaseComponent } from '../BaseComponent.js';
import { createSheet } from '../shared-styles.js';

const styles = createSheet(/* css */`
  :host { display: contents; }

  .passive-slots {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    position: absolute;
    top: 90px;
    left: 0;
    max-width: 220px;
    z-index: 10;
    pointer-events: auto;
    transition: top var(--transition-normal);
  }

  .passive-slots.with-shield {
    top: 138px;
  }

  .passive-slot {
    width: 40px;
    height: 26px;
    border: 1px solid rgba(0, 255, 255, 0.35);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.58);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
  }

  .passive-slot:hover {
    transform: scale(1.18);
    box-shadow: 0 0 12px rgba(255, 45, 236, 0.55);
    border-color: rgba(255, 45, 236, 0.75);
  }

  .passive-slot span {
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    color: rgba(255, 255, 255, 0.75);
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .passive-slot .skill-icon-img {
    width: 18px;
    height: 18px;
    border-radius: 3px;
    object-fit: cover;
    image-rendering: auto;
  }

  .passive-slot.filled {
    border-color: rgba(255, 45, 236, 0.55);
    box-shadow: 0 0 10px rgba(255, 45, 236, 0.3);
  }

  .loot-buff-slots {
    position: absolute;
    top: 124px;
    left: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-width: 220px;
    z-index: 10;
    pointer-events: auto;
    transition: top var(--transition-normal);
  }

  .loot-buff-slots.with-shield {
    top: 172px;
  }

  .loot-buff-badge {
    min-width: 42px;
    height: 20px;
    padding: 0 5px;
    border: 1px solid rgba(0, 255, 255, 0.35);
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.58);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    cursor: pointer;
    transition: transform 0.12s, border-color 0.12s;
  }

  .loot-buff-badge:hover {
    transform: scale(1.05);
    border-color: rgba(255, 45, 236, 0.75);
  }

  .loot-buff-icon {
    font-size: 10px;
    line-height: 1;
  }

  .loot-buff-timer {
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    color: rgba(255, 255, 255, 0.9);
    letter-spacing: 0;
  }

  /* Responsive — Tablet */
  @media (max-width: 768px) {
    .passive-slots { bottom: 124px; }
  }

  /* Responsive — Mobile */
  @media (max-width: 480px) {
    .passive-slots { bottom: 116px; }
  }
`);

class HudPassiveSlots extends BaseComponent {
    connectedCallback() {
        this._render(/* html */`
            <div id="passiveSlots" class="passive-slots"></div>
      <div id="lootBuffSlots" class="loot-buff-slots"></div>
        `, styles);
    }
}

customElements.define('hud-passive-slots', HudPassiveSlots);
export { HudPassiveSlots };
