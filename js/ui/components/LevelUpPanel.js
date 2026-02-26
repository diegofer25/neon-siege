/**
 * @fileoverview <level-up-panel> – full-screen skill tree overlay shown when
 * the player levels up.  Contains the header (title, point badges), the
 * SkillTreeRenderer viewport, action buttons, and the first-time onboarding
 * banner.
 *
 * API (called by SkillUIController):
 *   show() / hide()
 *   setTitle(text)
 *   setPoints(attrPts, skillPts)
 *   setButtonStates({ resetDisabled, confirmDisabled, confirmReady })
 *   getViewport()              – returns the viewport element for SkillTreeRenderer
 *   showOnboarding() / hideOnboarding()
 *
 * Events emitted:
 *   'reset-click'
 *   'confirm-click'
 *   'onboarding-close'
 */

import { BaseComponent } from './BaseComponent.js';
import { createSheet, overlayStyles } from './shared-styles.js';

// -------------------------------------------------------------------
// Styles  (skill tree panel + all tree node/edge/tooltip CSS)
// -------------------------------------------------------------------
const levelUpSheet = createSheet(/* css */`
    /* ---- Panel shell ---- */
    .skill-tree-panel {
        display: flex;
        flex-direction: column;
        width: 100vw;
        max-width: none;
        height: 100vh;
        max-height: none;
        background:
            radial-gradient(ellipse at center, rgba(8, 20, 40, 0.97) 0%, rgba(2, 4, 12, 0.99) 100%);
        border: 2px solid rgba(0, 255, 255, 0.3);
        border-radius: 0;
        box-shadow:
            0 0 60px rgba(0, 255, 255, 0.12),
            inset 0 0 80px rgba(0, 0, 0, 0.6);
        overflow: hidden;
    }

    /* Header bar */
    .skill-tree-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 24px 10px;
        border-bottom: 1px solid rgba(0, 255, 255, 0.12);
        flex-shrink: 0;
    }

    .skill-tree-title-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .skill-tree-header h2 {
        font-family: 'Audiowide', sans-serif;
        font-size: 1.4rem;
        color: #0ff;
        text-shadow: 0 0 14px rgba(0, 255, 255, 0.5);
        margin: 0;
    }

    .level-up-hint {
        font-family: 'Press Start 2P', monospace;
        font-size: 0.55rem;
        color: rgba(255, 255, 255, 0.8);
        text-shadow: 0 0 4px rgba(255, 255, 255, 0.3);
        animation: hintPulse 2s infinite;
    }

    @keyframes hintPulse {
        0%, 100% { opacity: 0.7; }
        50% { opacity: 1; text-shadow: 0 0 8px rgba(255, 255, 255, 0.8); }
    }

    .skill-tree-points {
        display: flex;
        gap: 10px;
    }

    .points-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: 'Press Start 2P', monospace;
        font-size: 0.7rem;
        padding: 6px 14px;
        border-radius: 12px;
        font-weight: bold;
        transition: transform 0.2s, box-shadow 0.2s;
    }

    .points-badge.has-points {
        animation: badgePulse 1.5s infinite;
    }

    @keyframes badgePulse {
        0%, 100% { transform: scale(1); box-shadow: 0 0 5px currentColor; }
        50% { transform: scale(1.08); box-shadow: 0 0 15px currentColor; }
    }

    .points-badge.attr-badge {
        background: rgba(0, 255, 255, 0.18);
        color: #0ff;
        border: 1px solid rgba(0, 255, 255, 0.35);
    }

    .points-badge.skill-badge {
        background: rgba(200, 100, 255, 0.18);
        color: #c864ff;
        border: 1px solid rgba(200, 100, 255, 0.35);
    }

    /* Viewport (clips / scales the world) */
    .skill-tree-viewport {
        flex: 1;
        position: relative;
        overflow: hidden;
        touch-action: none;
    }

    /* World container (fixed size, scaled with CSS transform) */
    .tree-world {
        position: absolute;
        will-change: transform;
    }

    /* SVG edge layer */
    .tree-svg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
    }

    /* Tier-ring decorations */
    .tier-ring {
        fill: none;
        stroke: rgba(0, 255, 255, 0.05);
        stroke-width: 1;
        stroke-dasharray: 6 10;
    }

    /* ---- Edges ---- */
    .tree-edge {
        stroke-width: 2;
        stroke-linecap: round;
        transition: stroke 0.3s, opacity 0.3s;
    }

    .tree-edge--attr {
        stroke: rgba(0, 255, 255, 0.18);
        stroke-width: 2;
    }

    .tree-edge--dim {
        stroke: rgba(255, 255, 255, 0.06) !important;
        stroke-width: 1.2;
    }

    .tree-edge--available {
        opacity: 0.35;
        stroke-width: 2;
    }

    .tree-edge--active {
        opacity: 1;
        stroke-width: 2.6;
        filter: url(#edgeGlow);
    }

    /* ---- Nodes (shared base) ---- */
    .tree-node {
        position: absolute;
        border-radius: 50%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        user-select: none;
        transition:
            border-color 0.25s,
            box-shadow 0.25s,
            opacity 0.25s,
            transform 0.18s;
        z-index: 2;
    }

    /* Hub (centre jewel) */
    .tree-node--hub {
        background: radial-gradient(circle, rgba(0, 255, 255, 0.15) 0%, transparent 70%);
        border: 2px solid rgba(0, 255, 255, 0.25);
        color: #0ff;
        font-size: 18px;
        pointer-events: none;
        box-shadow: 0 0 20px rgba(0, 255, 255, 0.15);
    }

    /* Attribute nodes */
    .tree-node--attr {
        background: radial-gradient(circle, rgba(0, 255, 255, 0.12) 0%, rgba(0, 20, 40, 0.8) 100%);
        border: 2px solid rgba(0, 255, 255, 0.4);
        box-shadow: 0 0 10px rgba(0, 255, 255, 0.1);
        cursor: default;
    }

    .tree-node--attr .tree-node__icon {
        font-size: 18px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .tree-node--attr .tree-node__icon .skill-icon-img {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        object-fit: cover;
    }

    .tree-node--attr .tree-node__value {
        font-family: 'Press Start 2P', monospace;
        font-size: 8px;
        color: #0ff;
        margin-top: 1px;
    }

    .tree-node--attr.tree-node--available {
        border-color: #0ff;
        box-shadow: 0 0 16px rgba(0, 255, 255, 0.35);
        animation: nodePulse 1.8s ease-in-out infinite;
        cursor: pointer;
    }

    .tree-node--attr.tree-node--available:hover {
        transform: scale(1.15);
        box-shadow: 0 0 22px rgba(0, 255, 255, 0.6);
        z-index: 5;
        animation: none;
    }

    .skill-tree-panel .tree-node__add {
        position: absolute;
        bottom: -6px;
        right: -6px;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        border: 2px solid #0ff;
        background: rgba(0, 40, 60, 0.9);
        color: #0ff;
        font-size: 18px;
        font-weight: bold;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 3;
        transition: background 0.15s, transform 0.15s;
        margin: 0;
        padding: 0;
        line-height: 1;
        box-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
        text-transform: none;
        letter-spacing: 0;
        font-family: 'Audiowide', sans-serif;
        font-weight: 700;
        animation: btnPulse 1.2s ease-in-out infinite;
    }

    @keyframes btnPulse {
        0%, 100% { box-shadow: 0 0 8px rgba(0, 255, 255, 0.5); transform: scale(1); }
        50% { box-shadow: 0 0 18px rgba(0, 255, 255, 0.9); transform: scale(1.12); }
    }

    .skill-tree-panel .tree-node__add::before {
        display: none;
    }

    .skill-tree-panel .tree-node__add:hover {
        animation: none;
        text-shadow: none;
        background: rgba(0, 255, 255, 0.7);
        color: #000;
        transform: scale(1.25);
    }

    /* Skill nodes */
    .tree-node--skill {
        background: radial-gradient(circle, rgba(40, 40, 60, 0.85) 0%, rgba(10, 10, 20, 0.9) 100%);
        border: 2px solid rgba(255, 255, 255, 0.12);
        cursor: default;
    }

    .tree-node--skill .tree-node__icon {
        font-size: 18px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .tree-node--skill .tree-node__icon .skill-icon-img {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        object-fit: cover;
    }

    .tree-node__rank {
        font-family: 'Press Start 2P', monospace;
        font-size: 7px;
        color: rgba(255, 255, 255, 0.7);
        margin-top: 1px;
    }

    /* Ultimate shape — larger, hexagonal feel */
    .tree-node--ultimate {
        border-radius: 12px;
        transform: rotate(0deg);
    }

    /* ---- Node states ---- */
    .tree-node--locked {
        opacity: 0.35;
        border-color: rgba(255, 255, 255, 0.08);
    }

    .tree-node--dimmed {
        opacity: 0.15;
        pointer-events: none;
        border-color: rgba(255, 255, 255, 0.04);
    }

    .tree-node--available {
        border-color: var(--arch-color, #0ff);
        box-shadow: 0 0 14px color-mix(in srgb, var(--arch-color, #0ff) 40%, transparent);
        animation: nodePulse 1.8s ease-in-out infinite;
    }

    .tree-node--clickable {
        cursor: pointer;
    }

    .tree-node--clickable:hover {
        transform: scale(1.15);
        box-shadow: 0 0 22px color-mix(in srgb, var(--arch-color, #0ff) 60%, transparent);
        z-index: 5;
        animation: none;
    }

    .tree-node--learned {
        border-color: var(--arch-color, #0ff);
        box-shadow:
            0 0 12px color-mix(in srgb, var(--arch-color, #0ff) 50%, transparent),
            inset 0 0 8px color-mix(in srgb, var(--arch-color, #0ff) 15%, transparent);
        background: radial-gradient(circle,
            color-mix(in srgb, var(--arch-color, #0ff) 14%, transparent) 0%,
            rgba(10, 10, 20, 0.9) 100%);
        opacity: 1;
    }

    .tree-node--learned .tree-node__rank {
        color: var(--arch-color, #0ff);
    }

    .tree-node--maxed {
        border-color: #ffd700;
        box-shadow:
            0 0 16px rgba(255, 215, 0, 0.45),
            inset 0 0 10px rgba(255, 215, 0, 0.12);
        background: radial-gradient(circle, rgba(255, 215, 0, 0.12) 0%, rgba(10, 10, 20, 0.9) 100%);
        opacity: 1;
    }

    .tree-node--maxed .tree-node__rank {
        color: #ffd700;
    }

    /* ---- Archetype sector labels ---- */
    .tree-arch-label {
        position: absolute;
        transform: translate(-50%, -50%);
        text-align: center;
        font-family: 'Audiowide', sans-serif;
        font-size: 0.72rem;
        text-shadow: 0 0 12px currentColor;
        opacity: 0.7;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        z-index: 1;
    }

    .tree-arch-label span:first-child {
        font-size: 1.4rem;
    }

    .tree-arch-label--chosen {
        opacity: 1;
        font-size: 0.82rem;
    }

    .tree-arch-label--stub {
        opacity: 0.2;
        font-size: 0.6rem;
    }

    /* ---- Tree Tooltip ---- */
    .tree-tooltip {
        position: absolute;
        width: 210px;
        background: rgba(4, 8, 18, 0.95);
        border: 1px solid rgba(0, 255, 255, 0.3);
        border-radius: 8px;
        padding: 10px 12px;
        z-index: 50;
        pointer-events: none;
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.7);
    }

    .tree-tooltip__header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
    }

    .tree-tooltip__name {
        font-family: 'Audiowide', sans-serif;
        font-size: 0.8rem;
    }

    .tree-tooltip__extra {
        font-family: 'Press Start 2P', monospace;
        font-size: 0.45rem;
        color: rgba(255, 255, 255, 0.45);
        margin-bottom: 6px;
    }

    .tree-tooltip__desc {
        font-size: 0.68rem;
        color: rgba(255, 255, 255, 0.7);
        line-height: 1.4;
        margin-bottom: 6px;
    }

    .tree-tooltip__status {
        font-family: 'Press Start 2P', monospace;
        font-size: 0.5rem;
        color: #0ff;
        padding-top: 4px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
    }

    .tree-tooltip__action-hint {
        font-family: 'Press Start 2P', monospace;
        font-size: 0.45rem;
        color: rgba(0, 255, 255, 0.9);
        padding-top: 5px;
        margin-top: 4px;
        border-top: 1px solid rgba(0, 255, 255, 0.15);
        text-align: center;
        animation: hintPulse 2s infinite;
    }

    /* ---- Action bar ---- */
    .glow-btn {
        margin: 0;
        display: inline-flex;
        min-width: 160px;
    }

    .skill-tree-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
        align-items: center;
        padding: 0 20px 14px;
    }

    .skill-tree-actions button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
        filter: saturate(0.55);
        box-shadow: none;
        text-shadow: none;
    }

    .skill-tree-actions button:disabled::before {
        display: none;
    }

    .skill-tree-actions button:disabled:hover {
        animation: none;
        transform: none;
    }

    .skill-tree-actions button.ready-to-confirm {
        border-color: #00ff88;
        color: #00ff88;
        box-shadow: 0 0 18px rgba(0, 255, 136, 0.5);
        animation: confirmPulse 1.5s ease-in-out infinite;
    }

    @keyframes confirmPulse {
        0%, 100% { box-shadow: 0 0 12px rgba(0, 255, 136, 0.4); }
        50% { box-shadow: 0 0 28px rgba(0, 255, 136, 0.7); }
    }

    @keyframes nodePulse {
        0%, 100% {
            box-shadow: 0 0 10px color-mix(in srgb, var(--arch-color, #0ff) 30%, transparent);
            transform: scale(1);
        }
        50% {
            box-shadow: 0 0 26px color-mix(in srgb, var(--arch-color, #0ff) 70%, transparent);
            transform: scale(1.08);
        }
    }

    /* ---- Onboarding banner ---- */
    .skill-tree-onboarding {
        position: fixed;
        bottom: 100px;
        left: 0;
        right: 0;
        display: flex;
        justify-content: center;
        background: linear-gradient(180deg, transparent 0%, rgba(0, 6, 16, 0.95) 25%);
        padding: 20px 0 16px 24px;
        pointer-events: none;
        z-index: 200;
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.5s ease, transform 0.5s ease;
    }

    .skill-tree-onboarding.show {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
    }

    .onboarding-close {
        position: absolute;
        top: 8px;
        right: 12px;
        background: none;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        width: 28px;
        height: 28px;
        color: rgba(255, 255, 255, 0.8);
        font-size: 1.2rem;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s, color 0.2s, border-color 0.2s;
        z-index: 201;
    }

    .onboarding-close:hover {
        background: rgba(0, 255, 255, 0.15);
        color: #0ff;
        border-color: #0ff;
    }

    .onboarding-content {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-width: 600px;
        margin: 0 auto;
    }

    .onboarding-row {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        font-family: 'Audiowide', sans-serif;
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.85);
    }

    .onboarding-icon {
        font-size: 1.1rem;
        flex-shrink: 0;
        filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.5));
    }

    .onboarding-row strong {
        color: #0ff;
    }
`);

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------
class LevelUpPanel extends BaseComponent {
    connectedCallback() {
        this._render(/* html */`
            <div class="overlay">
                <div class="skill-tree-panel">
                    <div class="skill-tree-header">
                        <div class="skill-tree-title-group">
                            <h2 class="title">LEVEL UP!</h2>
                            <span class="level-up-hint hint">Click glowing nodes to spend points!</span>
                        </div>
                        <div class="skill-tree-points">
                            <span class="points-badge attr-badge">⚡ <span class="attr-pts">3</span> AP</span>
                            <span class="points-badge skill-badge">🔮 <span class="skill-pts">1</span> SP</span>
                        </div>
                    </div>
                    <div class="skill-tree-viewport"></div>
                    <div class="skill-tree-actions">
                        <button class="glow-btn reset-btn" disabled>RESET</button>
                        <button class="primary glow-btn confirm-btn" disabled>CONFIRM</button>
                    </div>
                </div>
                <div class="skill-tree-onboarding onboarding">
                    <div class="onboarding-content">
                        <div class="onboarding-row"><span class="onboarding-icon">⚡</span><span><strong>AP (Attribute Points)</strong> — Click the <strong>+ button</strong> on the glowing centre nodes to boost your stats</span></div>
                        <div class="onboarding-row"><span class="onboarding-icon">🔮</span><span><strong>SP (Skill Points)</strong> — Click any <strong>glowing skill node</strong> on the outer rings to unlock an ability</span></div>
                        <div class="onboarding-row"><span class="onboarding-icon">✅</span><span>Spend all points, then hit <strong>CONFIRM</strong> to continue the run</span></div>
                    </div>
                    <button class="onboarding-close close-onboarding" aria-label="Close">&times;</button>
                </div>
            </div>
        `, overlayStyles, levelUpSheet);

        // Wire button events
        this._$('.reset-btn')?.addEventListener('click', () => {
            this._emit('reset-click');
        });
        this._$('.confirm-btn')?.addEventListener('click', () => {
            if (/** @type {HTMLButtonElement} */ (this._$('.confirm-btn')).disabled) return;
            this._emit('confirm-click');
        });
        this._$('.close-onboarding')?.addEventListener('click', () => {
            this.hideOnboarding();
            this._emit('onboarding-close');
        });
    }

    /**
     * Set the "LEVEL X!" title text.
     * @param {string} text
     */
    setTitle(text) {
        const el = this._$('.title');
        if (el) el.textContent = text;
    }

    /**
     * Update point badges and the hint visibility.
     * @param {number} attrPts
     * @param {number} skillPts
     */
    setPoints(attrPts, skillPts) {
        const attrEl = this._$('.attr-pts');
        const skillEl = this._$('.skill-pts');
        if (attrEl) attrEl.textContent = String(attrPts);
        if (skillEl) skillEl.textContent = String(skillPts);

        const attrBadge = this._$('.attr-badge');
        const skillBadge = this._$('.skill-badge');
        if (attrBadge) attrBadge.classList.toggle('has-points', attrPts > 0);
        if (skillBadge) skillBadge.classList.toggle('has-points', skillPts > 0);

        const hint = this._$('.hint');
        if (hint) hint.style.display = (attrPts > 0 || skillPts > 0) ? 'block' : 'none';
    }

    /**
     * Update the RESET / CONFIRM button states.
     * @param {{ resetDisabled: boolean, confirmDisabled: boolean, confirmReady: boolean }} states
     */
    setButtonStates({ resetDisabled, confirmDisabled, confirmReady }) {
        const resetBtn = /** @type {HTMLButtonElement|null} */ (this._$('.reset-btn'));
        const confirmBtn = /** @type {HTMLButtonElement|null} */ (this._$('.confirm-btn'));
        if (resetBtn) resetBtn.disabled = resetDisabled;
        if (confirmBtn) {
            confirmBtn.disabled = confirmDisabled;
            confirmBtn.classList.toggle('ready-to-confirm', confirmReady);
        }
    }

    /**
     * Return the viewport element so SkillTreeRenderer can render into it.
     * @returns {HTMLElement|null}
     */
    getViewport() {
        return this._$('.skill-tree-viewport');
    }

    showOnboarding() {
        const el = this._$('.onboarding');
        if (el) el.classList.add('show');
    }

    hideOnboarding() {
        const el = this._$('.onboarding');
        if (el) el.classList.remove('show');
    }
}

customElements.define('level-up-panel', LevelUpPanel);
