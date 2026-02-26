/**
 * @fileoverview Centralized HUD rendering with cached DOM references.
 *
 * Owns every per-frame and per-event DOM update for the in-game overlay:
 * health/defense bars, wave counter, score, XP, combo, challenges,
 * skill/passive slots, ascension badges, performance stats, and HUD tooltips.
 *
 * Usage:
 *   import { hudManager } from './managers/HUDManager.js';
 *   hudManager.game = game;
 *   hudManager.update();               // call each frame
 */

import { skillIconHtml } from '../utils/IconUtils.js';

// ---------------------------------------------------------------------------
// DOM-ref helper – returns element or a stub so we never null-check in hot path
// ---------------------------------------------------------------------------
const NOOP_EL = /** @type {HTMLElement} */ (
    Object.freeze({ style: {}, textContent: '', className: '', classList: { add() {}, remove() {} }, dataset: {}, innerHTML: '' })
);

/** @param {string} id @returns {HTMLElement} */
function $(id) { return document.getElementById(id) || NOOP_EL; }

// ---------------------------------------------------------------------------
// HUDManager
// ---------------------------------------------------------------------------

class HUDManager {
    constructor() {
        /** @type {import('../Game.js').Game | null} */
        this.game = null;

        /** Whether the performance overlay is enabled. */
        this.showPerformanceStats = false;

        // ----- cached DOM refs (populated on first `update()`) -----
        /** @type {boolean} */
        this._cached = false;

        // Health
        /** @type {HTMLElement} */ this._healthFill = NOOP_EL;
        /** @type {HTMLElement} */ this._healthText = NOOP_EL;

        // Defense
        /** @type {HTMLElement} */ this._defenseBar = NOOP_EL;
        /** @type {HTMLElement} */ this._defenseFill = NOOP_EL;
        /** @type {HTMLElement} */ this._defenseText = NOOP_EL;

        // Wave / score / XP
        /** @type {HTMLElement} */ this._waveEl = NOOP_EL;
        /** @type {HTMLElement} */ this._scoreValue = NOOP_EL;
        /** @type {HTMLElement} */ this._scoreMultiplier = NOOP_EL;
        /** @type {HTMLElement} */ this._xpFill = NOOP_EL;
        /** @type {HTMLElement} */ this._xpLevel = NOOP_EL;

        // Combo
        /** @type {HTMLElement} */ this._comboCounter = NOOP_EL;
        /** @type {HTMLElement} */ this._comboLabel = NOOP_EL;
        /** @type {HTMLElement} */ this._comboCount = NOOP_EL;
        /** @type {HTMLElement} */ this._comboTimerFill = NOOP_EL;

        // Challenges
        /** @type {HTMLElement} */ this._challengeDisplay = NOOP_EL;

        // Skill / passive slots
        /** @type {HTMLElement[]} */ this._skillNames = [];
        /** @type {HTMLElement[]} */ this._skillCds = [];
        /** @type {(HTMLElement|null)[]} */ this._skillSlots = [];
        /** @type {HTMLElement[]} */ this._passiveNames = [];
        /** @type {(HTMLElement|null)[]} */ this._passiveSlots = [];

        // Ascension
        /** @type {HTMLElement} */ this._ascensionSlots = NOOP_EL;

        // Performance
        /** @type {HTMLElement} */ this._perfContainer = NOOP_EL;
        /** @type {HTMLElement} */ this._fpsValue = NOOP_EL;
        /** @type {HTMLElement} */ this._frameTimeValue = NOOP_EL;
        /** @type {HTMLElement} */ this._avgFpsValue = NOOP_EL;
        /** @type {HTMLElement} */ this._optimizedValue = NOOP_EL;

        // Stats
        /** @type {HTMLElement} */ this._attackValue = NOOP_EL;
        /** @type {HTMLElement} */ this._speedValue = NOOP_EL;
        /** @type {HTMLElement} */ this._regenValue = NOOP_EL;
        /** @type {HTMLElement} */ this._hpsValue = NOOP_EL;

        // Tooltip
        /** @type {HTMLElement|null} */ this._hudTooltipEl = null;
    }

    // ------------------------------------------------------------------
    // Cache all DOM refs once
    // ------------------------------------------------------------------
    _cacheRefs() {
        this._healthFill = $('healthFill');
        this._healthText = $('healthText');

        this._defenseBar = $('defenseBar');
        this._defenseFill = $('defenseFill');
        this._defenseText = $('defenseText');

        this._waveEl = $('wave');
        this._scoreValue = $('scoreValue');
        this._scoreMultiplier = $('scoreMultiplier');
        this._xpFill = $('xpFill');
        this._xpLevel = $('xpLevel');

        this._comboCounter = $('comboCounter');
        this._comboLabel = $('comboLabel');
        this._comboCount = $('comboCount');
        this._comboTimerFill = $('comboTimerFill');

        this._challengeDisplay = $('challengeDisplay');

        // Skill / passive slot arrays
        this._skillNames = [];
        this._skillCds = [];
        this._skillSlots = [];
        for (let i = 0; i < 4; i++) {
            const nameEl = $(`skillName${i}`);
            this._skillNames.push(nameEl);
            this._skillCds.push($(`skillCd${i}`));
            this._skillSlots.push(nameEl !== NOOP_EL ? nameEl.closest('.skill-slot') : null);
        }

        this._passiveSlotsContainer = $('passiveSlots');
        this._passiveSlotCount = 0; // tracks how many DOM children exist

        this._ascensionSlots = $('ascensionSlots');

        this._perfContainer = $('performanceStats');
        this._fpsValue = $('fpsValue');
        this._frameTimeValue = $('frameTimeValue');
        this._avgFpsValue = $('avgFpsValue');
        this._optimizedValue = $('optimizedValue');

        this._attackValue = $('attackValue');
        this._speedValue = $('speedValue');
        this._regenValue = $('regenValue');
        this._hpsValue = $('hpsValue');

        this._cached = true;
    }

    // ------------------------------------------------------------------
    // Main per-frame HUD refresh
    // ------------------------------------------------------------------
    update() {
        const g = this.game;
        if (!g) return;
        if (!this._cached) this._cacheRefs();

        // Health bar
        const healthPct = Math.max(0, (g.player.hp / g.player.maxHp) * 100);
        this._healthFill.style.width = healthPct.toFixed(1) + '%';
        this._healthText.textContent = `${Math.max(0, Math.floor(g.player.hp))}/${g.player.maxHp}`;

        // Defense / shield bar
        if (g.player.hasShield) {
            this._defenseBar.style.display = 'block';
            const cur = g.player.shieldHp;
            const max = g.player.maxShieldHp;
            const pct = max > 0 ? Math.max(0, (cur / max) * 100) : 0;
            this._defenseFill.style.width = pct.toFixed(1) + '%';
            this._defenseText.textContent = `${Math.max(0, Math.floor(cur))}/${Math.floor(max)}`;
        } else {
            this._defenseBar.style.display = 'none';
        }

        // Wave progress
        const wp = g.getWaveProgress();
        const remaining = g.enemies.length + wp.enemiesToSpawn;
        this._waveEl.textContent = `Wave: ${g.wave} (${remaining}/${wp.totalEnemies})`;

        // Stats
        this._updateStatsDisplay(g);

        // Score + multiplier
        this._scoreValue.textContent = g.score.toLocaleString();
        const mult = g.comboSystem.getScoreMultiplier();
        if (mult > 1) {
            this._scoreMultiplier.style.display = 'inline';
            this._scoreMultiplier.textContent = `x${mult.toFixed(1)}`;
        } else {
            this._scoreMultiplier.style.display = 'none';
        }

        // XP bar
        if (g.skillManager) {
            this._xpFill.style.width = ((g.skillManager.xp / g.skillManager.xpToNextLevel) * 100).toFixed(1) + '%';
            this._xpLevel.textContent = `Lv.${g.skillManager.level}`;
        }

        // Combo counter
        const tierInfo = g.comboSystem.getCurrentTierInfo();
        if (tierInfo && g.comboSystem.currentStreak >= 5) {
            this._comboCounter.style.display = 'flex';
            this._comboLabel.textContent = tierInfo.label;
            this._comboCount.textContent = g.comboSystem.currentStreak.toString();
            this._comboTimerFill.style.width = (g.comboSystem.getTimerProgress() * 100) + '%';
            this._comboCounter.style.borderColor = tierInfo.color;
            this._comboLabel.style.color = tierInfo.color;
            this._comboCount.style.color = tierInfo.color;
            this._comboTimerFill.style.background = tierInfo.color;
        } else {
            this._comboCounter.style.display = 'none';
        }

        // Challenge display
        if (g.challengeSystem.activeChallenges.length > 0) {
            this._challengeDisplay.style.display = 'block';
            this._challengeDisplay.innerHTML = g.challengeSystem.activeChallenges.map(c => {
                const cls = c.completed ? 'challenge-item completed' : 'challenge-item';
                return `<div class="${cls}"><span class="challenge-icon">${c.icon}</span><span class="challenge-progress">${c.progress}/${c.target}</span></div>`;
            }).join('');
        }

        // QERT skill slots
        if (g.skillManager) {
            const slots = g.skillManager.getKeybindSlots();
            for (let i = 0; i < 4; i++) {
                const nameEl = this._skillNames[i];
                const cdEl = this._skillCds[i];
                const slotEl = this._skillSlots[i];
                const slot = slots[i];
                if (nameEl === NOOP_EL || cdEl === NOOP_EL) continue;
                if (slot?.skillId && slot.skill) {
                    nameEl.innerHTML = skillIconHtml(slot.skill, 32);
                    const cd = g.skillManager.cooldowns[slot.skillId];
                    if (cd && cd > 0) {
                        const maxCd = g.skillManager.getCooldownInfo(slot.skillId).total;
                        cdEl.style.height = ((cd / maxCd) * 100).toFixed(0) + '%';
                        slotEl?.classList.add('on-cooldown');
                    } else {
                        cdEl.style.height = '0%';
                        slotEl?.classList.remove('on-cooldown');
                    }
                } else {
                    nameEl.textContent = i === 3 ? '🔒' : '—';
                    cdEl.style.height = '0%';
                }
            }

            // Passive slots – dynamic
            this._syncPassiveSlots(g);
        }

        // Ascension modifier badges
        if (g.ascensionSystem) {
            const mods = g.ascensionSystem.activeModifiers;
            if (this._ascensionSlots.dataset.modCount !== String(mods.length)) {
                this._ascensionSlots.dataset.modCount = String(mods.length);
                this._ascensionSlots.innerHTML = mods.map(m =>
                    `<div class="ascension-badge" data-tooltip-type="ascension" data-mod-id="${m.id}" title="">${skillIconHtml(m, 22)}</div>`
                ).join('');
            }
        }

        // Performance overlay
        if (this.showPerformanceStats) {
            this._updatePerformanceStats(g);
        }
    }

    // ------------------------------------------------------------------
    // Player stat values
    // ------------------------------------------------------------------
    /** @param {import('../Game.js').Game} g */
    _updateStatsDisplay(g) {
        const baseDamage = 10;
        const currentAttack = baseDamage * g.player.damageMod;
        this._animateStat(this._attackValue, currentAttack.toFixed(1));

        const currentSpeed = g.player.fireRateMod.toFixed(1);
        this._animateStat(this._speedValue, `${currentSpeed}x`);

        const regenRate = g.player.hpRegen.toFixed(1);
        this._animateStat(this._regenValue, regenRate);

        const hpsValue = g.player.hpRegen;
        this._animateStat(this._hpsValue, hpsValue.toFixed(1));
    }

    /**
     * Update individual stat value with highlight animation on change.
     * @param {HTMLElement} el
     * @param {string} newValue
     */
    _animateStat(el, newValue) {
        if (el === NOOP_EL) return;
        const str = newValue.toString();
        if (el.textContent === str) return;
        el.textContent = str;
        el.style.color = '#0f0';
        el.style.textShadow = '0 0 10px #0f0';
        el.style.transform = 'scale(1.1)';
        setTimeout(() => {
            el.style.color = '#fff';
            el.style.textShadow = '0 0 3px #fff';
            el.style.transform = 'scale(1)';
        }, 500);
    }

    // ------------------------------------------------------------------
    // Dynamic passive-slot sync
    // ------------------------------------------------------------------
    /** @param {import('../Game.js').Game} g */
    _syncPassiveSlots(g) {
        const container = this._passiveSlotsContainer;
        if (!container || container === NOOP_EL) return;

        const equipped = g.skillManager.equippedPassives;
        const count = equipped.length;

        // Toggle with-shield class so CSS shifts position down when shield bar is visible
        container.classList.toggle('with-shield', !!g.player.hasShield);

        // Add/remove DOM children to match count
        while (this._passiveSlotCount < count) {
            const idx = this._passiveSlotCount;
            const div = document.createElement('div');
            div.className = 'passive-slot filled';
            div.dataset.passiveSlot = String(idx);
            div.dataset.tooltipType = 'passive';
            const span = document.createElement('span');
            div.appendChild(span);
            container.appendChild(div);
            this._passiveSlotCount++;
        }
        while (this._passiveSlotCount > count) {
            container.removeChild(container.lastChild);
            this._passiveSlotCount--;
        }

        // Update text for each slot
        for (let i = 0; i < count; i++) {
            const skillId = equipped[i];
            const slotEl = /** @type {HTMLElement} */ (container.children[i]);
            const span = /** @type {HTMLElement} */ (slotEl.firstChild);
            const skill = g.skillManager.getSkillDef(skillId);
            const rank = g.skillManager.getSkillRank(skillId);
            if (skill) {
                span.innerHTML = `${skillIconHtml(skill, 18)} ${rank}`;
                slotEl.classList.add('filled');
                slotEl.dataset.passiveSlot = String(i);
            }
        }
    }

    // ------------------------------------------------------------------
    // Performance overlay
    // ------------------------------------------------------------------
    /** @param {import('../Game.js').Game} g */
    _updatePerformanceStats(g) {
        if (!g.performanceManager) return;
        const stats = g.performanceManager.getStats();

        const fps = Math.round(stats.currentFps);
        this._fpsValue.textContent = fps.toString();
        this._fpsValue.className = 'perf-value' + (fps < 15 ? ' warning critical' : fps < 30 ? ' warning' : '');

        this._frameTimeValue.textContent = `${stats.frameTime.toFixed(1)}ms`;

        const avg = Math.round(stats.averageFps);
        this._avgFpsValue.textContent = avg.toString();
        this._avgFpsValue.className = 'perf-value' + (avg < 15 ? ' warning critical' : avg < 30 ? ' warning' : '');

        const opt = g.performanceManager.needsOptimization();
        this._optimizedValue.textContent = opt ? 'Yes' : 'No';
        this._optimizedValue.className = 'perf-value' + (opt ? ' warning' : '');
    }

    // ------------------------------------------------------------------
    // Toggle performance overlay visibility
    // ------------------------------------------------------------------
    setPerformanceStatsVisible(visible) {
        this.showPerformanceStats = visible;
        this._perfContainer.style.display = visible ? 'flex' : 'none';
    }

    // ------------------------------------------------------------------
    // HUD Tooltip system
    // ------------------------------------------------------------------
    setupTooltips() {
        this._hudTooltipEl = document.getElementById('hudTooltip');
        if (!this._hudTooltipEl) return;

        document.addEventListener('mouseover', (e) => {
            if (!this.game) return;
            const target = /** @type {Element} */ (e.target);
            const skillSlot = /** @type {HTMLElement|null} */ (target.closest('.skill-slot[data-tooltip-type]'));
            const passiveSlot = /** @type {HTMLElement|null} */ (target.closest('.passive-slot[data-tooltip-type]'));
            const ascBadge = /** @type {HTMLElement|null} */ (target.closest('.ascension-badge[data-mod-id]'));

            if (skillSlot) {
                this._handleSkillSlotTooltip(skillSlot);
                return;
            }

            if (passiveSlot) {
                this._handlePassiveSlotTooltip(passiveSlot);
                return;
            }

            if (ascBadge) {
                this._handleAscensionBadgeTooltip(ascBadge);
                return;
            }

            if (!target.closest('.hud-tooltip')) {
                this._hideTooltip();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this._hudTooltipEl && this._hudTooltipEl.style.display !== 'none') {
                this._positionTooltip(e.clientX, e.clientY);
            }
        });
    }

    /** @param {HTMLElement} slotEl */
    _handleSkillSlotTooltip(slotEl) {
        const g = this.game;
        const slotIdx = parseInt(slotEl.dataset.slot, 10);
        const slots = g.skillManager?.getKeybindSlots?.();
        const slot = slots?.[slotIdx];
        if (slot?.skill) {
            const rank = g.skillManager.getSkillRank(slot.skillId);
            const cdInfo = g.skillManager.getCooldownInfo(slot.skillId);
            const cdSec = (cdInfo.total / 1000).toFixed(1);
            const typeLabel = /** @type {any} */ (slot)?.isUltimate ? 'Ultimate' : 'Active';
            this._showTooltip({
                icon: slot.skill.icon || '⚡',
                iconImage: slot.skill.iconImage,
                name: slot.skill.name,
                meta: `${typeLabel} · Tier ${slot.skill.tier} · Rank ${rank}/${slot.skill.maxRank}`,
                desc: slot.skill.description,
                cd: `Cooldown: ${cdSec}s`,
                type: 'active',
            }, slotEl);
        } else {
            this._hideTooltip();
        }
    }

    /** @param {HTMLElement} slotEl */
    _handlePassiveSlotTooltip(slotEl) {
        const g = this.game;
        const slotIdx = parseInt(slotEl.dataset.passiveSlot, 10);
        const skillId = g.skillManager?.equippedPassives?.[slotIdx];
        if (skillId) {
            const skill = g.skillManager.getSkillDef(skillId);
            const rank = g.skillManager.getSkillRank(skillId);
            if (skill) {
                this._showTooltip({
                    icon: skill.icon || '✨',
                    iconImage: skill.iconImage,
                    name: skill.name,
                    meta: `Passive · Tier ${skill.tier} · Rank ${rank}/${skill.maxRank}`,
                    desc: skill.description,
                    cd: undefined,
                    type: 'passive',
                }, slotEl);
                return;
            }
        }
        this._hideTooltip();
    }

    /** @param {HTMLElement} badge */
    _handleAscensionBadgeTooltip(badge) {
        const modId = badge.dataset.modId;
        const mod = this.game.ascensionSystem?.activeModifiers?.find(m => m.id === modId);
        if (mod) {
            this._showTooltip({
                icon: mod.icon || '✨',
                iconImage: mod.iconImage,
                name: mod.name,
                meta: 'Ascension Modifier',
                desc: mod.description,
                cd: undefined,
                type: 'ascension',
            }, badge);
        }
    }

    /** @param {{ icon:string, iconImage?:string, name:string, meta:string, desc:string, cd?:string, type:string }} info @param {HTMLElement} anchorEl */
    _showTooltip(info, anchorEl) {
        const el = this._hudTooltipEl;
        if (!el) return;
        el.className = `hud-tooltip${info.type === 'ascension' ? ' hud-tooltip--ascension' : ''}`;
        const iconHtml = info.iconImage
            ? skillIconHtml(info, 20)
            : `<span class="hud-tooltip__icon">${info.icon}</span>`;
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
        const rect = anchorEl.getBoundingClientRect();
        this._positionTooltip(rect.left + rect.width / 2, rect.top);
    }

    _hideTooltip() {
        if (this._hudTooltipEl) this._hudTooltipEl.style.display = 'none';
    }

    /** @param {number} cx @param {number} cy */
    _positionTooltip(cx, cy) {
        const el = this._hudTooltipEl;
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

/** Singleton instance. */
export const hudManager = new HUDManager();
