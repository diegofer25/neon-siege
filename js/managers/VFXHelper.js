/**
 * @fileoverview Visual effects helpers for DOM-based game feedback.
 *
 * Provides `createFloatingText` (damage numbers, combo labels, etc.) and
 * `screenFlash` (dramatic white flash on level-up / crit).  Extracted from
 * main.js so that every system importing these doesn't need a dependency
 * on the monolithic entry-point.
 *
 * Usage:
 *   import { vfxHelper } from './managers/VFXHelper.js';
 *   vfxHelper.createFloatingText('-25', screenX, screenY, 'damage');
 *   vfxHelper.screenFlash();
 */

/**
 * Lightweight singleton for DOM-based visual effects.
 */
class VFXHelper {
    /**
     * Create a floating text element that auto-removes after its CSS animation.
     *
     * @param {string} text     - Display text (e.g. "-10", "COMBO x5!")
     * @param {number} x        - Screen-space X position in CSS pixels
     * @param {number} y        - Screen-space Y position in CSS pixels
     * @param {string} [className='damage'] - Extra CSS class for styling
     */
    createFloatingText(text, x, y, className = 'damage') {
        if (window.__NEON_TRACE_ENABLED__) {
            const stack = new Error().stack?.split('\n').slice(2, 6).map(line => line.trim());
            console.log('[TRACE floatingText.create]', {
                text,
                className,
                x: Math.round(x),
                y: Math.round(y),
                stack,
            });
        }

        const el = document.createElement('div');
        el.className = `floating-text ${className}`;
        el.textContent = text;
        el.style.left = x + 'px';
        el.style.top = y + 'px';

        document.getElementById('floatingTexts').appendChild(el);

        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 1000);
    }

    /**
     * Flash the screen white for a brief dramatic moment.
     */
    screenFlash() {
        const flash = document.createElement('div');
        flash.className = 'screen-flash';
        document.getElementById('gameContainer').appendChild(flash);

        setTimeout(() => {
            if (flash.parentNode) flash.parentNode.removeChild(flash);
        }, 200);
    }
}

/** Singleton instance. */
export const vfxHelper = new VFXHelper();
