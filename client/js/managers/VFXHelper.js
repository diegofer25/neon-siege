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
    constructor() {
        /** Canvas-based screen flash state (replaces DOM flash element) */
        this._flashAlpha = 0;
    }

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

        const container = document.querySelector('floating-texts');
        if (container) {
            container.addText(text, x, y, className);
        }
    }

    /**
     * Flash the screen white for a brief dramatic moment (canvas-based).
     * Sets flash alpha; call renderFlash() in the render loop.
     */
    screenFlash() {
        this._flashAlpha = 0.4;
    }

    /**
     * Update and render the canvas flash overlay. Call at the end of the frame.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} width
     * @param {number} height
     * @param {number} dt - delta time in seconds
     */
    renderFlash(ctx, width, height, dt) {
        if (this._flashAlpha <= 0) return;
        ctx.globalAlpha = this._flashAlpha;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 1;
        // Fade out quickly (~200ms at 60fps)
        this._flashAlpha -= dt * 5;
        if (this._flashAlpha < 0.01) this._flashAlpha = 0;
    }
}

/** Singleton instance. */
export const vfxHelper = new VFXHelper();
