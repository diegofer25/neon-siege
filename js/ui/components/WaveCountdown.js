/**
 * @fileoverview <wave-countdown> — 3-2-1-GO countdown overlay.
 *
 * Public API:
 *   show()          — make visible
 *   hide()          — hide
 *   setText(label)  — set the countdown text
 *   setGo(bool)     — toggle the "go" style class
 *   restartAnimation() — retrigger the pulse CSS animation
 */

import { BaseComponent } from './BaseComponent.js';
import { createSheet } from './shared-styles.js';

const styles = createSheet(/* css */ `
  .wave-countdown {
    position: absolute;
    inset: 0;
    display: none;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: calc(var(--z-overlay) + 5);
  }
  .wave-countdown.show {
    display: flex;
  }
  .wave-countdown span {
    font-family: var(--font-pixel);
    font-size: 96px;
    line-height: 1;
    color: var(--color-secondary-neon);
    text-shadow:
      0 0 10px var(--color-secondary-neon),
      0 0 28px var(--color-secondary-neon);
    transform: scale(1);
    animation: countdownPulse 0.32s ease-out;
  }
  .wave-countdown span.go {
    color: var(--color-primary-neon);
    text-shadow:
      0 0 10px var(--color-primary-neon),
      0 0 28px var(--color-primary-neon);
  }
  @keyframes countdownPulse {
    from { opacity: 0; transform: scale(0.7); }
    to   { opacity: 1; transform: scale(1); }
  }
`);

class WaveCountdown extends BaseComponent {
    connectedCallback() {
        this._render(/* html */ `
            <div class="wave-countdown">
                <span id="text">3</span>
            </div>
        `, styles);

        this._root = this._$('.wave-countdown');
        this._text = this._$('#text');
    }

    show() {
        this._root?.classList.add('show');
    }

    hide() {
        this._root?.classList.remove('show');
    }

    /** @param {string} label */
    setText(label) {
        if (this._text) this._text.textContent = label;
    }

    /** @param {boolean} isGo */
    setGo(isGo) {
        this._text?.classList.toggle('go', isGo);
    }

    /** Retrigger the CSS pulse animation. */
    restartAnimation() {
        if (!this._text) return;
        this._text.style.animation = 'none';
        void this._text.offsetWidth; // force reflow
        this._text.style.animation = '';
    }
}

customElements.define('wave-countdown', WaveCountdown);
export { WaveCountdown };
