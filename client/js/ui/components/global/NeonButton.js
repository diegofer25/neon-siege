/**
 * @fileoverview <neon-button> — reusable neon-styled button used throughout the
 * game UI. Supports variants: default, primary, danger, glow, icon.
 *
 * Attributes:
 *   variant  — "default" | "primary" | "danger" | "glow" | "icon"  (default: "default")
 *   disabled — standard boolean attribute
 *   label    — button text (alternative to slotted content)
 *
 * Slots:
 *   default — button content (overrides `label` attribute)
 *
 * Events:
 *   Inherits native `click` — composed, bubbles through shadow boundaries.
 */

import { BaseComponent } from '../BaseComponent.js';
import { createSheet } from '../shared-styles.js';

const btnSheet = createSheet(/* css */`
  :host {
    display: inline-block;
  }

  button {
    background: var(--gradient-button);
    border: 2px solid var(--color-secondary-neon);
    color: #fff;
    padding: 15px var(--spacing-xxl);
    font-family: var(--font-primary);
    font-size: 18px;
    cursor: pointer;
    border-radius: var(--radius-lg);
    transition: all var(--transition-normal);
    box-shadow:
      0 0 10px var(--color-secondary-neon),
      0 0 var(--spacing-xl) rgba(255, 45, 236, 0.3);
    margin: 0;
    position: relative;
    overflow: hidden;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: bold;
    width: 100%;
  }

  button::before {
    content: '';
    position: absolute;
    top: 0; left: -100%;
    width: 100%; height: 100%;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.2) 50%,
      transparent 100%);
    transition: left 0.5s;
  }

  button:hover {
    animation: buttonHover 0.3s ease-out forwards;
    text-shadow: 0 0 10px #fff;
  }

  button:hover::before { left: 100%; }

  button:active {
    transform: translateY(0) scale(0.98);
    transition: transform 0.1s ease;
  }

  /* --- Primary variant --- */
  :host([variant="primary"]) button {
    background: linear-gradient(45deg, var(--color-primary-neon), var(--color-secondary-neon));
    border-color: var(--color-primary-neon);
    box-shadow:
      0 0 10px var(--color-primary-neon),
      0 0 var(--spacing-xl) rgba(0, 255, 255, 0.3);
  }

  /* --- Danger variant --- */
  :host([variant="danger"]) button {
    background: linear-gradient(45deg, var(--color-accent-red), #ff6b6b);
    border-color: var(--color-accent-red);
    box-shadow:
      0 0 10px var(--color-accent-red),
      0 0 var(--spacing-xl) rgba(255, 0, 0, 0.3);
  }

  /* --- Glow variant (skill-tree style) --- */
  :host([variant="glow"]) button {
    background: var(--gradient-button);
    border: 2px solid var(--color-secondary-neon);
    min-width: 160px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  /* --- Icon variant (compact, e.g. settings gear) --- */
  :host([variant="icon"]) button {
    background: rgba(20, 20, 28, 0.88);
    border: 2px solid var(--color-secondary-neon);
    color: var(--color-secondary-neon);
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: 16px;
    box-shadow:
      0 0 10px rgba(255, 45, 236, 0.4),
      inset 0 0 8px rgba(255, 45, 236, 0.12);
  }

  :host([variant="icon"]) button:hover {
    background: #333;
    box-shadow: 0 0 15px var(--color-secondary-neon);
    transform: translateY(-2px);
    animation: none;
  }

  /* --- Disabled state --- */
  :host([disabled]) button,
  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    filter: saturate(0.55);
    box-shadow: none;
    text-shadow: none;
    pointer-events: none;
  }

  :host([disabled]) button::before,
  button:disabled::before {
    display: none;
  }

  :host([disabled]) button:hover,
  button:disabled:hover {
    animation: none;
    transform: none;
  }

  /* --- Loading state --- */
  :host([loading]) button {
    pointer-events: none;
    opacity: 0.7;
    cursor: wait;
  }
  :host([loading]) button slot,
  :host([loading]) button .label-text {
    visibility: hidden;
  }
  :host([loading]) button::after {
    content: '';
    position: absolute;
    top: 50%; left: 50%;
    width: 20px; height: 20px;
    margin: -10px 0 0 -10px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: btnSpin 0.6s linear infinite;
  }
  :host([loading]) button:hover {
    animation: none;
    transform: none;
  }
  :host([loading]) button::before { display: none; }

  /* --- Ready state (confirm pulse) --- */
  :host([ready]) button {
    border-color: #00ff88;
    color: #00ff88;
    box-shadow: 0 0 18px rgba(0, 255, 136, 0.5);
    animation: confirmPulse 1.5s ease-in-out infinite;
  }

  @keyframes btnSpin {
    to { transform: rotate(360deg); }
  }

  @keyframes buttonHover {
    0% { transform: translateY(0) scale(1); box-shadow: 0 0 10px currentColor; }
    100% {
      transform: translateY(-3px) scale(1.05);
      box-shadow: 0 0 20px currentColor, 0 0 40px currentColor, 0 5px 15px rgba(0,0,0,0.3);
    }
  }

  @keyframes confirmPulse {
    0%, 100% { box-shadow: 0 0 12px rgba(0, 255, 136, 0.4); }
    50% { box-shadow: 0 0 28px rgba(0, 255, 136, 0.7); }
  }
`);

class NeonButton extends BaseComponent {
    static get observedAttributes() {
        return ['label', 'disabled', 'variant', 'ready', 'loading'];
    }

    connectedCallback() {
        const label = this.getAttribute('label') || '';
        this._render(/* html */`
            <button part="button"><slot>${label}</slot></button>
        `, btnSheet);

        // Reflect disabled
        this._syncDisabled();
    }

    attributeChangedCallback(name, _old, _new) {
        if (!this.shadowRoot?.firstElementChild) return;
        if (name === 'label') {
            const slot = this._$('slot');
            if (slot) slot.textContent = _new || '';
        }
        if (name === 'disabled') {
            this._syncDisabled();
        }
        if (name === 'loading') {
            this._syncDisabled();
        }
    }

    /** @private */
    _syncDisabled() {
        const btn = /** @type {HTMLButtonElement|null} */ (this._$('button'));
        if (btn) btn.disabled = this.hasAttribute('disabled') || this.hasAttribute('loading');
    }
}

customElements.define('neon-button', NeonButton);
export { NeonButton };
