/**
 * @fileoverview <hud-challenges> — challenge progress display.
 *
 * Internal IDs for HUDManager: challengeDisplay
 */

import { BaseComponent } from '../BaseComponent.js';
import { createSheet } from '../shared-styles.js';

const styles = createSheet(/* css */`
  :host { display: contents; }

  .challenge-display {
    position: absolute;
    top: 56px;
    right: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    pointer-events: none;
  }

  .challenge-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: 3px var(--spacing-sm);
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-sm);
    font-family: var(--font-pixel);
    font-size: 7px;
    color: #aaa;
  }

  .challenge-item.completed {
    border-color: var(--color-accent-green);
    color: var(--color-accent-green);
  }

  .challenge-icon {
    font-size: 10px;
  }

  .challenge-progress {
    font-family: var(--font-pixel);
  }
`);

class HudChallenges extends BaseComponent {
    connectedCallback() {
        this._render(/* html */`
            <div id="challengeDisplay" class="challenge-display" style="display: none;"></div>
        `, styles);
    }
}

customElements.define('hud-challenges', HudChallenges);
export { HudChallenges };
