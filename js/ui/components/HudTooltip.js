/**
 * @fileoverview <hud-tooltip> – floating tooltip that appears when hovering
 * HUD skill slots, passive slots, or ascension badges.
 *
 * API (called by HUDManager):
 *   showTooltip(info, anchorEl)  – render & position
 *   hideTooltip()                – hide
 *   positionTooltip(cx, cy)      – reposition on mousemove
 *   isShown                      – read-only visibility flag
 */

import { BaseComponent } from './BaseComponent.js';
import { createSheet } from './shared-styles.js';

// -------------------------------------------------------------------
// Styles
// -------------------------------------------------------------------
const tooltipSheet = createSheet(/* css */`
    .hud-tooltip {
        position: fixed;
        z-index: 9999;
        background: rgba(4, 8, 20, 0.96);
        border: 1px solid rgba(0, 255, 255, 0.45);
        border-radius: 8px;
        padding: 10px 14px;
        pointer-events: none;
        max-width: 230px;
        min-width: 140px;
        box-shadow: 0 0 24px rgba(0, 255, 255, 0.12), 0 4px 16px rgba(0,0,0,0.5);
        display: none;
    }

    .hud-tooltip__header {
        display: flex;
        align-items: center;
        gap: 7px;
        margin-bottom: 5px;
    }

    .hud-tooltip__header .skill-icon-img {
        width: 20px;
        height: 20px;
        border-radius: 4px;
        object-fit: cover;
    }

    .hud-tooltip__icon {
        font-size: 18px;
        line-height: 1;
    }

    .hud-tooltip__name {
        font-family: 'Press Start 2P', monospace;
        font-size: 8px;
        color: #0ff;
        line-height: 1.4;
    }

    .hud-tooltip__meta {
        font-family: 'Audiowide', sans-serif;
        font-size: 9px;
        color: rgba(255, 255, 255, 0.45);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 7px;
    }

    .hud-tooltip__desc {
        font-family: 'Audiowide', sans-serif;
        font-size: 10px;
        color: rgba(255, 255, 255, 0.85);
        line-height: 1.55;
    }

    .hud-tooltip__cd {
        font-family: 'Audiowide', sans-serif;
        font-size: 9px;
        color: rgba(255, 200, 60, 0.9);
        margin-top: 6px;
    }

    .hud-tooltip--ascension {
        border-color: rgba(255, 215, 0, 0.5);
        box-shadow: 0 0 24px rgba(255, 215, 0, 0.1), 0 4px 16px rgba(0,0,0,0.5);
    }

    .hud-tooltip--ascension .hud-tooltip__name {
        color: #ffd700;
    }
`);

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------
class HudTooltip extends BaseComponent {
    connectedCallback() {
        this._render(/* html */`
            <div class="hud-tooltip"></div>
        `, tooltipSheet);
    }

    /** @returns {boolean} */
    get isShown() {
        const el = this._$('.hud-tooltip');
        return el ? el.style.display !== 'none' : false;
    }

    /**
     * Show the tooltip with the given info, positioned near the anchor element.
     * @param {{ icon:string, iconImage?:string, name:string, meta:string, desc:string, cd?:string, type:string }} info
     * @param {string} iconHtml  Pre-rendered icon HTML (from skillIconHtml)
     */
    showTooltip(info, iconHtml) {
        const el = this._$('.hud-tooltip');
        if (!el) return;

        el.className = `hud-tooltip${info.type === 'ascension' ? ' hud-tooltip--ascension' : ''}`;
        el.innerHTML = `
            <div class="hud-tooltip__header">
                ${iconHtml}
                <span class="hud-tooltip__name">${info.name}</span>
            </div>
            <div class="hud-tooltip__meta">${info.meta}</div>
            <div class="hud-tooltip__desc">${info.desc}</div>
            ${info.cd ? `<div class="hud-tooltip__cd">${info.cd}</div>` : ''}
        `;
        el.style.display = 'block';
    }

    hideTooltip() {
        const el = this._$('.hud-tooltip');
        if (el) el.style.display = 'none';
    }

    /**
     * Reposition the tooltip near (cx, cy) with viewport clamping.
     * @param {number} cx
     * @param {number} cy
     */
    positionTooltip(cx, cy) {
        const el = this._$('.hud-tooltip');
        if (!el) return;

        const tw = el.offsetWidth;
        const th = el.offsetHeight;
        const margin = 10;

        let x = cx - tw / 2;
        let y = cy - th - 12;

        x = Math.max(margin, Math.min(window.innerWidth - tw - margin, x));
        if (y < margin) y = cy + 20;

        el.style.left = x + 'px';
        el.style.top = y + 'px';
    }
}

customElements.define('hud-tooltip', HudTooltip);
