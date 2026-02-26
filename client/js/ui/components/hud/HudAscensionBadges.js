/**
 * @fileoverview <hud-ascension-badges> — ascension modifier badge slots.
 *
 * Internal IDs for HUDManager: ascensionSlots
 */

import { BaseComponent } from '../BaseComponent.js';
import { createSheet } from '../shared-styles.js';

const styles = createSheet(/* css */`
  :host { display: contents; }

  .ascension-slots {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    justify-content: center;
    position: absolute;
    bottom: 190px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    pointer-events: auto;
    max-width: 320px;
  }

  .ascension-badge {
    width: 30px;
    height: 30px;
    border: 2px solid rgba(255, 215, 0, 0.65);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    cursor: default;
    box-shadow: 0 0 8px rgba(255, 215, 0, 0.3), inset 0 0 6px rgba(255, 215, 0, 0.08);
    transition: transform 0.15s, box-shadow 0.15s;
    user-select: none;
  }

  .ascension-badge .skill-icon-img {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    object-fit: cover;
    image-rendering: auto;
  }

  .ascension-badge:hover {
    transform: scale(1.18);
    box-shadow: 0 0 16px rgba(255, 215, 0, 0.65);
  }
`);

class HudAscensionBadges extends BaseComponent {
    connectedCallback() {
        this._render(/* html */`
            <div id="ascensionSlots" class="ascension-slots"></div>
        `, styles);
    }
}

customElements.define('hud-ascension-badges', HudAscensionBadges);
export { HudAscensionBadges };
