/**
 * @fileoverview <achievement-toast> — slide-in toast notification.
 *
 * Public API:
 *   showToast(icon, name) — display then auto-hide after ~3 s
 *   hideToast()           — immediately hide
 */

import { BaseComponent } from '../BaseComponent.js';
import { createSheet } from '../shared-styles.js';

const styles = createSheet(/* css */ `
  .achievement-toast {
    position: absolute;
    top: 60px;
    right: var(--spacing-lg);
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md) var(--spacing-lg);
    background: rgba(0, 0, 0, 0.85);
    border: 2px solid var(--color-accent-yellow);
    border-radius: var(--radius-lg);
    box-shadow:
      0 0 15px rgba(255, 255, 0, 0.3),
      inset 0 0 10px rgba(255, 255, 0, 0.08);
    z-index: calc(var(--z-overlay) + 10);
    transform: translateX(120%);
    opacity: 0;
    transition: transform 0.4s ease, opacity 0.4s ease;
    pointer-events: none;
  }
  .achievement-toast.show {
    transform: translateX(0);
    opacity: 1;
  }
  .achievement-icon {
    font-size: 28px;
    filter: drop-shadow(0 0 6px rgba(255, 255, 0, 0.5));
  }
  .achievement-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .achievement-label {
    font-family: var(--font-pixel);
    font-size: 7px;
    color: var(--color-accent-yellow);
    text-shadow: 0 0 4px var(--color-accent-yellow);
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .achievement-name {
    font-family: var(--font-pixel);
    font-size: 10px;
    color: #fff;
    text-shadow: 0 0 3px #fff;
  }
`);

class AchievementToast extends BaseComponent {
    connectedCallback() {
        this._render(/* html */ `
            <div class="achievement-toast">
                <span id="icon" class="achievement-icon"></span>
                <div class="achievement-text">
                    <span class="achievement-label">ACHIEVEMENT UNLOCKED</span>
                    <span id="name" class="achievement-name"></span>
                </div>
            </div>
        `, styles);

        this._toast = this._$('.achievement-toast');
        this._icon = this._$('#icon');
        this._name = this._$('#name');
    }

    /**
     * Show the toast with given icon & achievement name.
     * @param {string} icon
     * @param {string} name
     */
    showToast(icon, name) {
        if (this._icon) this._icon.textContent = icon;
        if (this._name) this._name.textContent = name;
        this._toast?.classList.add('show');
    }

    /** Hide the toast immediately. */
    hideToast() {
        this._toast?.classList.remove('show');
    }
}

customElements.define('achievement-toast', AchievementToast);
export { AchievementToast };
