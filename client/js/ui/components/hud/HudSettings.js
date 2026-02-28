/**
 * @fileoverview <hud-settings> — settings gear button in the HUD.
 *
 * Events emitted:
 *   'settings-click' — user clicked the settings gear
 */

import { BaseComponent } from '../BaseComponent.js';
import { createSheet } from '../shared-styles.js';

const styles = createSheet(/* css */`
  :host { display: contents; }

  #settingsButton {
    position: absolute;
    top: 4px;
    right: 0;
    pointer-events: auto;
  }

  #settingsBtn {
    background: rgba(4, 10, 26, 0.78);
    border: 1px solid var(--color-secondary-neon);
    color: var(--color-secondary-neon);
    padding: 7px 10px;
    cursor: pointer;
    font-size: 14px;
    border-radius: var(--radius-lg);
    transition: var(--transition-normal);
    box-shadow:
      0 0 12px rgba(255, 45, 236, 0.22),
      inset 0 0 8px rgba(255, 45, 236, 0.1);
  }

  #settingsBtn:hover {
    background: rgba(16, 16, 34, 0.95);
    box-shadow: 0 0 14px var(--color-secondary-neon);
    transform: translateY(-1px);
  }

  /* Responsive — Mobile */
  @media (max-width: 480px) {
    #settingsBtn {
      font-size: 13px;
      padding: 6px 9px;
    }
  }

  /* Responsive — Landscape */
  @media (max-width: 900px) and (orientation: landscape) {
    #settingsBtn {
      font-size: 12px;
      padding: 4px 8px;
    }
  }
`);

class HudSettings extends BaseComponent {
    connectedCallback() {
        this._render(/* html */`
            <div id="settingsButton" class="hud-element">
                <button id="settingsBtn" title="Settings">⚙️</button>
            </div>
        `, styles);

        this._$('#settingsBtn')?.addEventListener('click', () => {
            this._emit('settings-click');
        });
    }
}

customElements.define('hud-settings', HudSettings);
export { HudSettings };
