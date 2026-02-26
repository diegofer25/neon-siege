/**
 * @fileoverview <ascension-panel> – full-screen overlay shown every 10 waves
 * for the player to pick an ascension modifier.
 *
 * API (called by SkillUIController):
 *   setOptions(options, iconRenderer)  – populate cards from data
 *   show() / hide()
 *
 * Events emitted:
 *   'select-ascension'  detail: { modId }
 */

import { BaseComponent } from './BaseComponent.js';
import { createSheet, overlayStyles } from './shared-styles.js';

// -------------------------------------------------------------------
// Styles
// -------------------------------------------------------------------
const ascensionSheet = createSheet(/* css */`
    .ascension-container {
        background: rgba(0, 0, 0, 0.92);
        border: 2px solid #ff0;
        border-radius: 12px;
        padding: 28px 32px;
        max-width: 650px;
        width: 90vw;
        box-shadow: 0 0 50px rgba(255, 255, 0, 0.2);
        text-align: center;
    }

    .ascension-container h2 {
        font-family: 'Audiowide', sans-serif;
        font-size: 1.8rem;
        color: #ff0;
        text-shadow: 0 0 16px rgba(255, 255, 0, 0.5);
        margin: 0 0 6px;
    }

    .ascension-subtitle {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.5);
        margin: 0 0 20px;
    }

    .ascension-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
    }

    .ascension-card {
        background: rgba(255, 255, 0, 0.04);
        border: 2px solid rgba(255, 255, 0, 0.2);
        border-radius: 10px;
        padding: 18px 14px;
        cursor: pointer;
        text-align: center;
        transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s;
    }

    .ascension-card:hover {
        border-color: #ff0;
        transform: translateY(-2px);
        box-shadow: 0 4px 20px rgba(255, 255, 0, 0.25);
    }

    .ascension-icon {
        font-size: 2rem;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .ascension-icon .skill-icon-img {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        object-fit: cover;
    }

    .ascension-name {
        font-family: 'Audiowide', sans-serif;
        font-size: 0.85rem;
        color: #fff;
        margin-bottom: 6px;
    }

    .ascension-desc {
        font-size: 0.65rem;
        color: rgba(255, 255, 255, 0.5);
        line-height: 1.4;
    }
`);

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------
class AscensionPanel extends BaseComponent {
    connectedCallback() {
        this._render(/* html */`
            <div class="overlay">
                <div class="ascension-container">
                    <h2>ASCENSION</h2>
                    <p class="ascension-subtitle">Choose a run-warping modifier</p>
                    <div class="ascension-grid"></div>
                </div>
            </div>
        `, overlayStyles, ascensionSheet);
    }

    /**
     * Populate the grid with ascension modifier cards.
     * @param {Array<{ id:string, name:string, description:string, icon?:string, iconImage?:string }>} options
     * @param {(mod: object, size: number) => string} iconRenderer  e.g. skillIconHtml
     */
    setOptions(options, iconRenderer) {
        const grid = this._$('.ascension-grid');
        if (!grid) return;
        grid.innerHTML = '';

        for (const mod of options) {
            const card = document.createElement('div');
            card.className = 'ascension-card';
            card.innerHTML = `
                <div class="ascension-icon">${iconRenderer(mod, 40)}</div>
                <div class="ascension-name">${mod.name}</div>
                <div class="ascension-desc">${mod.description}</div>
            `;
            card.addEventListener('click', () => {
                this._emit('select-ascension', { modId: mod.id });
            });
            grid.appendChild(card);
        }
    }
}

customElements.define('ascension-panel', AscensionPanel);
