/**
 * @fileoverview <hud-skill-bar> — QERT active skill slot bar.
 *
 * Internal IDs for HUDManager: skillSlots, skillCd0-3, skillName0-3
 */

import { BaseComponent } from '../BaseComponent.js';
import { createSheet } from '../shared-styles.js';

const styles = createSheet(/* css */`
  :host { display: contents; }

  .skill-slots {
    display: flex;
    gap: 6px;
    position: absolute;
    bottom: 76px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    pointer-events: auto;
  }

  .skill-slot {
    position: relative;
    width: 52px;
    height: 52px;
    border: 2px solid rgba(0, 255, 255, 0.5);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    cursor: default;
    user-select: none;
  }

  .skill-slot.ultimate {
    border-color: rgba(255, 45, 236, 0.6);
  }

  .skill-slot.on-cooldown {
    opacity: 0.6;
  }

  .skill-key {
    position: absolute;
    top: 2px;
    left: 4px;
    font-family: 'Audiowide', sans-serif;
    font-size: 10px;
    color: rgba(0, 255, 255, 0.8);
    text-shadow: 0 0 4px rgba(0, 255, 255, 0.4);
    z-index: 2;
  }

  .skill-cd-fill {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 0%;
    background: rgba(0, 255, 255, 0.15);
    transition: height 0.1s linear;
    z-index: 1;
  }

  .skill-slot-name {
    font-family: 'Press Start 2P', monospace;
    font-size: 7px;
    color: #fff;
    text-align: center;
    z-index: 2;
    max-width: 48px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .skill-slot-name .skill-icon-img {
    width: 32px;
    height: 32px;
    border-radius: 4px;
    object-fit: cover;
    image-rendering: auto;
  }

  /* Responsive — Tablet */
  @media (max-width: 768px) {
    .skill-slots { bottom: 68px; }
  }

  /* Responsive — Mobile */
  @media (max-width: 480px) {
    .skill-slots { bottom: 64px; }
  }
`);

class HudSkillBar extends BaseComponent {
    connectedCallback() {
        this._render(/* html */`
            <div id="skillSlots" class="skill-slots">
                <div class="skill-slot" data-slot="0" data-key="Q" data-tooltip-type="active">
                    <span class="skill-key">Q</span>
                    <div class="skill-cd-fill" id="skillCd0"></div>
                    <span class="skill-slot-name" id="skillName0">—</span>
                </div>
                <div class="skill-slot" data-slot="1" data-key="E" data-tooltip-type="active">
                    <span class="skill-key">E</span>
                    <div class="skill-cd-fill" id="skillCd1"></div>
                    <span class="skill-slot-name" id="skillName1">—</span>
                </div>
                <div class="skill-slot" data-slot="2" data-key="R" data-tooltip-type="active">
                    <span class="skill-key">R</span>
                    <div class="skill-cd-fill" id="skillCd2"></div>
                    <span class="skill-slot-name" id="skillName2">—</span>
                </div>
                <div class="skill-slot ultimate" data-slot="3" data-key="T" data-tooltip-type="active">
                    <span class="skill-key">T</span>
                    <div class="skill-cd-fill" id="skillCd3"></div>
                    <span class="skill-slot-name" id="skillName3">🔒</span>
                </div>
            </div>
        `, styles);
    }
}

customElements.define('hud-skill-bar', HudSkillBar);
export { HudSkillBar };
