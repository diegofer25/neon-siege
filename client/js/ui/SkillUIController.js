/**
 * @fileoverview SkillUIController – manages all skill-tree / level-up /
 * ascension panel DOM state via Web Component APIs.
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
import { skillIconHtml } from '../utils/IconUtils.js';
import { GameConfig } from '../config/GameConfig.js';
import { vfxHelper } from '../managers/VFXHelper.js';
import { audioManager } from '../managers/AudioManager.js';

// Side-effect imports — register custom elements
import './components/panels/LevelUpPanel.js';
import './components/panels/AscensionPanel.js';

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

/** @returns {LevelUpPanelElement} */
function _getLevelUpPanel() {
    return /** @type {LevelUpPanelElement} */ (document.querySelector('level-up-panel'));
}

/** @returns {AscensionPanelElement} */
function _getAscensionPanel() {
    return /** @type {AscensionPanelElement} */ (document.querySelector('ascension-panel'));
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

        /** @type {boolean} Whether component events have been wired. */
        this._eventsWired = false;
    }

    // ------------------------------------------------------------------
    // Internal: one-time event wiring for level-up-panel component
    // ------------------------------------------------------------------
    _wireEvents() {
        if (this._eventsWired) return;
        this._eventsWired = true;

        const panel = _getLevelUpPanel();
        if (!panel) return;

        panel.addEventListener('reset-click', () => {
            if (!this._levelUpPanelSnapshot) return;
            const sm = this.game?.skillManager;
            if (!sm) return;
            sm.restoreFromSave(this._levelUpPanelSnapshot);
            this._refreshTree(sm);
            playSFX('ui_click');
        });

        panel.addEventListener('confirm-click', () => {
            const g = this.game;
            if (!g) return;
            this._levelUpPanelSnapshot = null;
            panel.hide();
            if (g.gameState === 'levelup') {
                g.completeMidWaveLevelUp();
            } else {
                g.continueToNextWave();
            }
        });

        panel.addEventListener('onboarding-close', () => {
            localStorage.setItem('neon_seen_skilltree', '1');
        });

        const ascPanel = _getAscensionPanel();
        if (ascPanel) {
            ascPanel.addEventListener('select-ascension', (/** @type {CustomEvent} */ e) => {
                const g = this.game;
                if (!g) return;
                g.selectAscension(e.detail.modId);
                ascPanel.hide();
                playSFX('ui_purchase_success');
            });
        }
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
        const panel = _getLevelUpPanel();
        if (!panel) return;

        const hasChanges = this._hasSelectionChanges(sm);
        const hasUnspentPoints = sm.unspentAttributePoints > 0 || sm.unspentSkillPoints > 0;
        const mustSpendPoints = this.game?.gameState === 'levelup';

        panel.setButtonStates({
            resetDisabled: !hasChanges,
            confirmDisabled: mustSpendPoints && hasUnspentPoints,
            confirmReady: !(mustSpendPoints && hasUnspentPoints) && !hasUnspentPoints,
        });
    }

    // ------------------------------------------------------------------
    // Internal: refresh tree + point badges after spending a point
    // ------------------------------------------------------------------
    _refreshTree(sm) {
        const panel = _getLevelUpPanel();
        if (panel) panel.setPoints(sm.unspentAttributePoints, sm.unspentSkillPoints);
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
        const panel = _getLevelUpPanel();
        if (!panel) return;

        this._wireEvents();
        this._levelUpPanelSnapshot = sm.getSaveState();

        panel.setTitle(`LEVEL ${sm.level}!`);
        panel.setPoints(sm.unspentAttributePoints, sm.unspentSkillPoints);

        // Render the skill tree
        const viewport = panel.getViewport();
        if (!this._treeRenderer) {
            this._treeRenderer = new SkillTreeRenderer(viewport);
        }
        this._treeRenderer.setCallbacks(
            (skillId) => {
                if (!sm.learnSkill(skillId)) return;
                g.achievementSystem?.onSkillLearned();
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

        // Show panel BEFORE rendering so viewport has real dimensions for centering
        panel.show();
        this._updateActionButtons(sm);
        this._treeRenderer.render(sm);

        // Show first-time onboarding banner (stays open until user clicks X)
        const hasSeenSkillTree = localStorage.getItem('neon_seen_skilltree');
        if (!hasSeenSkillTree) {
            panel.showOnboarding();
        }
    }

    /**
     * Show the ascension-pick panel (every 10 waves).
     */
    showAscensionPanel() {
        const g = this.game;
        if (!g || !g.ascensionSystem) return;

        this._wireEvents();

        const options = g.ascensionSystem.generateOptions();
        const ascPanel = _getAscensionPanel();
        if (!ascPanel) return;

        ascPanel.setOptions(options, skillIconHtml);
        ascPanel.show();
    }

    /**
     * Close all skill-related overlays.
     */
    closeAll() {
        _getLevelUpPanel()?.hide();
        _getAscensionPanel()?.hide();
    }
}

/** Singleton instance. */
export const skillUI = new SkillUIController();
