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
        `, styles);
    }
}

customElements.define('hud-passive-slots', HudPassiveSlots);
export { HudPassiveSlots };
