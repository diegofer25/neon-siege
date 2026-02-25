/**
 * @fileoverview SkillUIController – manages all skill-tree / level-up /
 * ascension panel DOM state.
 *
 * Extracted from main.js to keep the entry-point lean.
 *
 * Usage:
 *   import { skillUI } from './ui/SkillUIController.js';
 *   skillUI.game = game;
 *   skillUI.showLevelUpPanel();
 *   skillUI.showAscensionPanel();
 *   skillUI.closeAll();
 */

import { SkillTreeRenderer } from './SkillTreeRenderer.js';
import { GameConfig } from '../config/GameConfig.js';
import { vfxHelper } from '../managers/VFXHelper.js';
import { audioManager } from '../managers/AudioManager.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Attribute-to-color mapping for purchase burst particles. */
const ATTR_COLORS = {
    STR: '#ff4500',
    DEX: '#00e5ff',
    VIT: '#00ff88',
    INT: '#aa44ff',
    LUCK: '#ffd700',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** @param {string} soundName */
function playSFX(soundName) { audioManager.playSFX(soundName); }

function _areArraysEqual(a = [], b = []) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function _isObjectShallowEqual(a = {}, b = {}) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
        if (a[key] !== b[key]) return false;
    }
    return true;
}

// ---------------------------------------------------------------------------
// SkillUIController
// ---------------------------------------------------------------------------

class SkillUIController {
    constructor() {
        /** @type {import('../Game.js').Game | null} */
        this.game = null;

        /** @type {SkillTreeRenderer|null} */
        this._treeRenderer = null;

        /** Snapshot taken when the level-up panel opens (for reset). */
        this._levelUpPanelSnapshot = null;
    }

    // ------------------------------------------------------------------
    // Internal: coloured particle burst on skill/attribute purchase
    // ------------------------------------------------------------------
    _createColoredBurst(x, y, count, color) {
        const g = this.game;
        if (!g) return;
        const em = g.effectsManager;
        if (!em) return;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
            const speed = 40 + Math.random() * 80;
            const life = 300 + Math.random() * 400;
            const particle = g.particlePool.get(
                x, y,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                life,
                color,
            );
            g.particles.push(particle);
        }
    }

    // ------------------------------------------------------------------
    // Internal: change-detection for the reset / confirm buttons
    // ------------------------------------------------------------------
    _hasSelectionChanges(sm) {
        const snap = this._levelUpPanelSnapshot;
        if (!snap) return false;
        return !(
            _isObjectShallowEqual(sm.attributes, snap.attributes) &&
            _isObjectShallowEqual(sm.skillRanks, snap.skillRanks) &&
            _isObjectShallowEqual(sm.treeInvestment, snap.treeInvestment) &&
            _areArraysEqual(sm.equippedPassives, snap.equippedPassives) &&
            _areArraysEqual(sm.equippedActives, snap.equippedActives) &&
            sm.equippedUltimate === snap.equippedUltimate &&
            sm.unspentSkillPoints === snap.unspentSkillPoints &&
            sm.unspentAttributePoints === snap.unspentAttributePoints
        );
    }

    _updateActionButtons(sm) {
        /** @type {HTMLButtonElement | null} */
        const resetBtn = document.querySelector('button#levelUpResetBtn');
        /** @type {HTMLButtonElement | null} */
        const confirmBtn = document.querySelector('button#levelUpConfirmBtn');
        if (!resetBtn || !confirmBtn) return;

        const hasChanges = this._hasSelectionChanges(sm);
        const hasUnspentPoints = sm.unspentAttributePoints > 0 || sm.unspentSkillPoints > 0;
        const mustSpendPoints = this.game?.gameState === 'levelup';

        resetBtn.disabled = !hasChanges;
        confirmBtn.disabled = mustSpendPoints && hasUnspentPoints;

        if (!confirmBtn.disabled && !hasUnspentPoints) {
            confirmBtn.classList.add('ready-to-confirm');
        } else {
            confirmBtn.classList.remove('ready-to-confirm');
        }
    }

    // ------------------------------------------------------------------
    // Internal: refresh tree + point badges after spending a point
    // ------------------------------------------------------------------
    _refreshTree(sm) {
        document.getElementById('attrPointsLeft').textContent = sm.unspentAttributePoints;
        document.getElementById('skillPointsLeft').textContent = sm.unspentSkillPoints;

        const attrBadge = document.getElementById('attrBadge');
        const skillBadge = document.getElementById('skillBadge');
        const hintEl = document.getElementById('levelUpHint');

        if (attrBadge) attrBadge.classList.toggle('has-points', sm.unspentAttributePoints > 0);
        if (skillBadge) skillBadge.classList.toggle('has-points', sm.unspentSkillPoints > 0);
        if (hintEl) hintEl.style.display = (sm.unspentAttributePoints > 0 || sm.unspentSkillPoints > 0) ? 'block' : 'none';

        if (this._treeRenderer) this._treeRenderer.update(sm);
        this._updateActionButtons(sm);
    }

    // ==================================================================
    // Public API
    // ==================================================================

    /**
     * Show the level-up panel with the full PoE-style skill tree.
     */
    showLevelUpPanel() {
        const g = this.game;
        if (!g || !g.skillManager) return;
        const sm = g.skillManager;
        const panel = document.getElementById('levelUpPanel');
        const titleEl = document.getElementById('levelUpTitle');
        this._levelUpPanelSnapshot = sm.getSaveState();
        titleEl.textContent = `LEVEL ${sm.level}!`;

        // Update point badges
        document.getElementById('attrPointsLeft').textContent = sm.unspentAttributePoints;
        document.getElementById('skillPointsLeft').textContent = sm.unspentSkillPoints;

        const attrBadge = document.getElementById('attrBadge');
        const skillBadge = document.getElementById('skillBadge');
        const hintEl = document.getElementById('levelUpHint');

        if (attrBadge) attrBadge.classList.toggle('has-points', sm.unspentAttributePoints > 0);
        if (skillBadge) skillBadge.classList.toggle('has-points', sm.unspentSkillPoints > 0);
        if (hintEl) hintEl.style.display = (sm.unspentAttributePoints > 0 || sm.unspentSkillPoints > 0) ? 'block' : 'none';

        // Render the skill tree
        const viewport = document.getElementById('skillTreeViewport');
        if (!this._treeRenderer) {
            this._treeRenderer = new SkillTreeRenderer(viewport);
        }
        this._treeRenderer.setCallbacks(
            (skillId) => {
                sm.learnSkill(skillId);
                this._refreshTree(sm);
                playSFX('ui_purchase_success');
                // Purchase juice: burst + shake + flash + floating text
                if (g.player && g.effectsManager) {
                    const p = g.player;
                    const cfg = GameConfig.VFX.PLAYER_AURAS.PURCHASE;
                    g.effectsManager.addScreenShake(cfg.SKILL_SHAKE_INTENSITY, cfg.SKILL_SHAKE_DURATION);
                    this._createColoredBurst(p.x, p.y, cfg.SKILL_BURST_COUNT, '#ff2dec');
                    p.visualState.flashTimer = cfg.FLASH_DURATION;
                    p.visualState.flashColor = '#ff2dec';
                    const skillDef = sm.getSkillDef(skillId);
                    if (skillDef) {
                        vfxHelper.createFloatingText(skillDef.label, p.x, p.y - 40, 'skill-acquired');
                    }
                }
            },
            (attrKey) => {
                if (sm.allocateAttribute(attrKey)) {
                    this._refreshTree(sm);
                    // Attribute purchase juice: small colored burst + flash
                    if (g.player && g.effectsManager) {
                        const p = g.player;
                        const cfg = GameConfig.VFX.PLAYER_AURAS.PURCHASE;
                        const color = ATTR_COLORS[attrKey] || '#fff';
                        this._createColoredBurst(p.x, p.y, cfg.ATTR_BURST_COUNT, color);
                        p.visualState.flashTimer = cfg.FLASH_DURATION * 0.5;
                        p.visualState.flashColor = color;
                    }
                }
            },
        );

        /** @type {HTMLButtonElement | null} */
        const resetBtn = document.querySelector('button#levelUpResetBtn');
        /** @type {HTMLButtonElement | null} */
        const confirmBtn = document.querySelector('button#levelUpConfirmBtn');

        if (resetBtn) {
            resetBtn.onclick = () => {
                if (!this._levelUpPanelSnapshot) return;
                sm.restoreFromSave(this._levelUpPanelSnapshot);
                this._refreshTree(sm);
                playSFX('ui_click');
            };
        }
        if (confirmBtn) {
            confirmBtn.onclick = () => {
                if (confirmBtn.disabled) return;
                this._levelUpPanelSnapshot = null;
                panel.classList.remove('show');
                if (g.gameState === 'levelup') {
                    g.completeMidWaveLevelUp();
                } else {
                    g.continueToNextWave();
                }
            };
        }

        // Show panel BEFORE rendering so viewport has real dimensions for centering
        panel.classList.add('show');
        this._updateActionButtons(sm);
        this._treeRenderer.render(sm);

        // Show first-time onboarding banner (stays open until user clicks X)
        const hasSeenSkillTree = localStorage.getItem('neon_seen_skilltree');
        const onboardingEl = document.getElementById('skillTreeOnboarding');
        if (!hasSeenSkillTree && onboardingEl) {
            onboardingEl.classList.add('show');
            const closeBtn = document.getElementById('onboardingCloseBtn');
            if (closeBtn) {
                closeBtn.onclick = () => {
                    onboardingEl.classList.remove('show');
                    localStorage.setItem('neon_seen_skilltree', '1');
                };
            }
        }
    }

    /**
     * Show the ascension-pick panel (every 10 waves).
     */
    showAscensionPanel() {
        const g = this.game;
        if (!g || !g.ascensionSystem) return;
        const options = g.ascensionSystem.generateOptions();
        const container = document.getElementById('ascensionOptions');
        container.innerHTML = '';

        for (const mod of options) {
            const card = document.createElement('div');
            card.className = 'ascension-card';
            card.innerHTML = `
                <div class="ascension-icon">${mod.icon || '✨'}</div>
                <div class="ascension-name">${mod.name}</div>
                <div class="ascension-desc">${mod.description}</div>
            `;
            card.onclick = () => {
                g.selectAscension(mod.id);
                document.getElementById('ascensionPanel').classList.remove('show');
                playSFX('ui_purchase_success');
            };
            container.appendChild(card);
        }

        document.getElementById('ascensionPanel').classList.add('show');
    }

    /**
     * Close all skill-related overlays.
     */
    closeAll() {
        document.getElementById('levelUpPanel')?.classList.remove('show');
        document.getElementById('ascensionPanel')?.classList.remove('show');
    }
}

/** Singleton instance. */
export const skillUI = new SkillUIController();
