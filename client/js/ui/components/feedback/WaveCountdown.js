/**
 * @fileoverview <wave-countdown> — 3-2-1-GO countdown overlay.
 *
 * Public API:
 *   show()          — make visible
 *   hide()          — hide
 *   setText(label)  — set the countdown text
 *   setHintText(label) — set optional helper hint text below countdown
 *   setGo(bool)     — toggle the "go" style class
 *   restartAnimation() — retrigger the pulse CSS animation
 */

import { BaseComponent } from '../BaseComponent.js';
import { createSheet } from '../shared-styles.js';

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
  .countdown-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    transform: translateY(-8px);
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
  .countdown-hint {
    min-height: 14px;
    font-family: var(--font-pixel);
    font-size: 11px;
    letter-spacing: 0.5px;
    color: rgba(255, 255, 255, 0.9);
    text-shadow: 0 0 8px rgba(255, 255, 255, 0.35);
    opacity: 0;
    transition: opacity 120ms ease-out;
  }
  .countdown-hint.show {
    opacity: 1;
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
          <div class="countdown-inner">
            <span id="text">3</span>
            <div id="hint" class="countdown-hint"></div>
          </div>
            </div>
        `, styles);

        this._root = this._$('.wave-countdown');
        this._text = this._$('#text');
      this._hint = this._$('#hint');
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

    /** @param {string} hint */
    setHintText(hint) {
      if (!this._hint) return;
      const hasHint = typeof hint === 'string' && hint.trim().length > 0;
      this._hint.textContent = hasHint ? hint.trim() : '';
      this._hint.classList.toggle('show', hasHint);
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
