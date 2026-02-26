/**
 * @fileoverview <floating-texts> — container for damage / heal / XP floating text.
 *
 * Public API:
 *   addText(text, className, x, y)  — create a floating text element
 */

import { BaseComponent } from './BaseComponent.js';
import { createSheet } from './shared-styles.js';

const styles = createSheet(/* css */ `
  :host {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: var(--z-floating-text);
  }
  .floating-text {
    position: absolute;
    font-family: var(--font-pixel);
    font-size: 16px;
    font-weight: bold;
    pointer-events: none;
    z-index: var(--z-floating-text);
    animation: floatUp 1s ease-out forwards;
    white-space: nowrap;
    text-align: center;
  }
  .floating-text.damage {
    color: var(--color-accent-yellow);
    text-shadow: 0 0 5px var(--color-accent-yellow);
  }
  .floating-text.heal {
    color: var(--color-accent-green);
    text-shadow: 0 0 5px var(--color-accent-green);
  }
  .floating-text.player-damage {
    color: var(--color-accent-red);
    text-shadow: 0 0 5px var(--color-accent-red);
  }
  .floating-text.coins {
    color: var(--color-accent-yellow);
    text-shadow: 0 0 5px var(--color-accent-yellow);
  }
  .floating-text.combo-tier {
    color: var(--color-accent-yellow);
    text-shadow: 0 0 10px var(--color-accent-yellow), 0 0 20px var(--color-accent-yellow);
    font-size: 22px;
    animation: comboFloat 1.2s ease-out forwards;
  }
  .floating-text.combo-break {
    color: #888;
    text-shadow: 0 0 5px #888;
    font-size: 14px;
  }
  .floating-text.loot-common {
    color: #fff;
    text-shadow: 0 0 5px #fff;
  }
  .floating-text.loot-uncommon {
    color: var(--color-primary-neon);
    text-shadow: 0 0 8px var(--color-primary-neon);
    font-size: 18px;
  }
  .floating-text.loot-rare {
    color: var(--color-accent-yellow);
    text-shadow: 0 0 10px var(--color-accent-yellow), 0 0 20px var(--color-accent-yellow);
    font-size: 20px;
    animation: rareFloat 1.2s ease-out forwards;
  }
  .floating-text.loot-legendary {
    color: var(--color-secondary-neon);
    text-shadow: 0 0 12px var(--color-secondary-neon), 0 0 24px var(--color-secondary-neon);
    font-size: 24px;
    animation: legendaryFloat 1.5s ease-out forwards;
  }
  .floating-text.milestone-major {
    color: var(--color-accent-yellow);
    text-shadow: 0 0 10px var(--color-accent-yellow), 0 0 20px var(--color-accent-yellow), 0 0 40px var(--color-accent-yellow);
    font-size: 28px;
    animation: milestoneFloat 2s ease-out forwards;
  }
  .floating-text.milestone-minor {
    color: var(--color-primary-neon);
    text-shadow: 0 0 8px var(--color-primary-neon), 0 0 16px var(--color-primary-neon);
    font-size: 20px;
    animation: comboFloat 1.2s ease-out forwards;
  }
  .floating-text.level-up {
    color: var(--color-secondary-neon);
    text-shadow: 0 0 10px var(--color-secondary-neon), 0 0 20px var(--color-secondary-neon);
    font-size: 24px;
    animation: levelUpFloat 1.5s ease-out forwards;
  }
  .floating-text.challenge-complete {
    color: var(--color-accent-green);
    text-shadow: 0 0 10px var(--color-accent-green), 0 0 20px var(--color-accent-green);
    font-size: 20px;
    animation: comboFloat 1.2s ease-out forwards;
  }
  .floating-text.achievement-unlock {
    color: var(--color-primary-neon);
    text-shadow: 0 0 10px var(--color-primary-neon), 0 0 20px var(--color-primary-neon);
    font-size: 20px;
    animation: comboFloat 1.2s ease-out forwards;
  }
  .floating-text.skill-acquired {
    color: #ff2dec;
    text-shadow: 0 0 10px #ff2dec, 0 0 24px #ff2dec, 0 0 40px rgba(255, 45, 236, 0.4);
    font-size: 22px;
    font-weight: bold;
    letter-spacing: 1px;
    animation: skillAcquiredFloat 1.5s ease-out forwards;
  }
  /* Keyframes */
  @keyframes floatUp {
    0%   { transform: translateY(0) scale(1); opacity: 1; }
    100% { transform: translateY(-50px) scale(1.2); opacity: 0; }
  }
  @keyframes comboFloat {
    0%   { opacity: 1; transform: translateY(0) scale(1.3); }
    50%  { opacity: 1; transform: translateY(-20px) scale(1); }
    100% { opacity: 0; transform: translateY(-50px) scale(0.8); }
  }
  @keyframes rareFloat {
    0%   { opacity: 1; transform: translateY(0) scale(1.5); }
    30%  { opacity: 1; transform: translateY(-15px) scale(1.1); }
    100% { opacity: 0; transform: translateY(-60px) scale(0.8); }
  }
  @keyframes legendaryFloat {
    0%   { opacity: 1; transform: translateY(0) scale(2); }
    20%  { opacity: 1; transform: translateY(-10px) scale(1.2); }
    80%  { opacity: 1; transform: translateY(-40px) scale(1); }
    100% { opacity: 0; transform: translateY(-70px) scale(0.8); }
  }
  @keyframes milestoneFloat {
    0%   { opacity: 1; transform: translateY(0) scale(2); }
    20%  { opacity: 1; transform: translateY(-10px) scale(1.3); }
    70%  { opacity: 1; transform: translateY(-30px) scale(1); }
    100% { opacity: 0; transform: translateY(-60px) scale(0.8); }
  }
  @keyframes levelUpFloat {
    0%   { opacity: 1; transform: translateY(0) scale(1.8); }
    30%  { opacity: 1; transform: translateY(-15px) scale(1.1); }
    100% { opacity: 0; transform: translateY(-50px) scale(0.8); }
  }
  @keyframes skillAcquiredFloat {
    0%   { opacity: 1; transform: translateY(0) scale(2); }
    20%  { opacity: 1; transform: translateY(-8px) scale(1.2); }
    70%  { opacity: 1; transform: translateY(-30px) scale(1); }
    100% { opacity: 0; transform: translateY(-55px) scale(0.85); }
  }
  @media (max-width: 768px) {
    .floating-text { font-size: 12px; }
  }
  @media (max-width: 480px) {
    .floating-text { font-size: 10px; }
  }
`);

class FloatingTexts extends BaseComponent {
    connectedCallback() {
        this._render('', styles);
    }

    /**
     * Create a floating text element.
     * @param {string} text      Display text (e.g. "-10", "COMBO x5!")
     * @param {number} x         Screen-space X position in CSS pixels
     * @param {number} y         Screen-space Y position in CSS pixels
     * @param {string} [className='damage'] Extra CSS class for styling
     */
    addText(text, x, y, className = 'damage') {
        const el = document.createElement('div');
        el.className = `floating-text ${className}`;
        el.textContent = text;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        this.shadowRoot.appendChild(el);

        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 1000);
    }
}

customElements.define('floating-texts', FloatingTexts);
export { FloatingTexts };
