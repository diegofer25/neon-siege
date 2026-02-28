/**
 * @fileoverview SkillManager — owns the unified skill tree state, attribute allocation,
 * prerequisite validation, cooldown ticking, and APIs consumed by Player/Game/UI.
 *
 * Design:
 * - One instance per run, created in Game.js
 * - All skill trees are open; each skill requires its connected prerequisite at the same rank
 * - Ultimates are standalone — gated by total tree investment (ULTIMATE_MIN_TREE_INVESTMENT)
 * - Escalating tempo: cooldowns decrease with level + INT
 */

import {
	ATTRIBUTES,
	ATTRIBUTE_POINTS_PER_LEVEL,
	ARCHETYPES,
	ULTIMATE_MIN_TREE_INVESTMENT,
	SKILL_SLOTS,
	COOLDOWN_CONFIG,
	LEVEL_CONFIG,
} from '../config/SkillConfig.js';
import { ActionTypes } from '../state/index.js';

export class SkillManager {
	/**
	 * @param {import('../managers/ProgressionManager.js').ProgressionManager} progressionManager
	 */
	constructor(progressionManager) {
		this.progressionManager = progressionManager;
		/** @type {import('../skills/SkillEffectEngine.js').SkillEffectEngine|null} Set by Game.js */
		this._skillEffectEngine = null;
		/** @type {import('../state/ActionDispatcher.js').ActionDispatcher|null} Set by Game.js */
		this._dispatcher = null;
		this.reset();
	}

	/** Reset all state for a new run */
	reset() {
		// Attribute points allocated per stat
		this.attributes = {};
		for (const key of Object.keys(ATTRIBUTES)) {
			this.attributes[key] = 0;
		}

		// Skill ranks: { skillId: currentRank }
		this.skillRanks = {};

		// Points invested per archetype tree: { GUNNER: 0, TECHNOMANCER: 0, ... }
		this.treeInvestment = {};
		for (const key of Object.keys(ARCHETYPES)) {
			this.treeInvestment[key] = 0;
		}

		// Equipped skills (by id) split by slot type
		this.equippedPassives = [];   // up to SKILL_SLOTS.PASSIVE_MAX
		this.equippedActives = [];    // up to SKILL_SLOTS.ACTIVE_MAX
		this.equippedUltimate = null; // at most 1

		// Active skill cooldowns: { skillId: remainingMs }
		this.cooldowns = {};

		// Unspent points
		this.unspentSkillPoints = 0;
		this.unspentAttributePoints = 0;

		/** @type {number} Ascension cooldown multiplier applied to active skills */
		this._ascensionCooldownMultiplier = 1;

		// Level tracking (authoritative source of truth; Game.js delegates here)
		this.level = 1;
		this.xp = 0;
		this.xpToNextLevel = LEVEL_CONFIG.getXPForLevel(1);

		// Pending level-up queue for mid-wave pickups
		this.pendingLevelUps = 0;
	}

	// ─── XP / LEVELING ──────────────────────────────────────────────────────────

	/**
	 * Add XP; may trigger one or more level-ups.
	 * @param {number} amount
	 * @returns {number} Number of levels gained this call
	 */
	addXP(amount) {
		this.xp += amount;
		let levelsGained = 0;
		while (this.xp >= this.xpToNextLevel) {
			this.xp -= this.xpToNextLevel;
			this.level++;
			this.xpToNextLevel = LEVEL_CONFIG.getXPForLevel(this.level);
			this.unspentSkillPoints += LEVEL_CONFIG.SKILL_POINTS_PER_LEVEL;
			this.unspentAttributePoints += ATTRIBUTE_POINTS_PER_LEVEL;
			this.pendingLevelUps++;
			levelsGained++;
		}
		return levelsGained;
	}

	// ─── ATTRIBUTE ALLOCATION ────────────────────────────────────────────────────

	/**
	 * Spend attribute points into a stat.
	 * @param {string} attrKey - e.g. 'STR'
	 * @param {number} amount
	 * @returns {boolean}
	 */
	allocateAttribute(attrKey, amount = 1) {
		const def = ATTRIBUTES[attrKey];
		if (!def) return false;
		if (amount > this.unspentAttributePoints) return false;
		if (this.attributes[attrKey] + amount > def.maxPoints) return false;

		this.attributes[attrKey] += amount;
		this.unspentAttributePoints -= amount;

		// Dispatch to state store
		this._dispatcher?.dispatch({
			type: ActionTypes.ATTR_ALLOCATE,
			payload: {
				attrKey,
				amount,
				newValue: this.attributes[attrKey],
				unspentAttributePoints: this.unspentAttributePoints,
			},
		});

		return true;
	}

	/**
	 * Compute effective attribute bonuses for Player consumption.
	 * @returns {Object}
	 */
	getComputedAttributes() {
		const str = this.attributes.STR;
		const dex = this.attributes.DEX;
		const vit = this.attributes.VIT;
		const int = this.attributes.INT;
		const luck = this.attributes.LUCK;

		return {
			damageMultiplier: 1 + str * ATTRIBUTES.STR.perPoint.damageMultiplier,
			explosionDamageMultiplier: 1 + str * ATTRIBUTES.STR.perPoint.explosionDamage,
			projectileSpeedMultiplier: 1 + str * ATTRIBUTES.STR.perPoint.projectileSpeedMultiplier,
			fireRateMultiplier: 1 + dex * ATTRIBUTES.DEX.perPoint.fireRateMultiplier,
			turnSpeedMultiplier: 1 + dex * ATTRIBUTES.DEX.perPoint.turnSpeedMultiplier,
			moveSpeedMultiplier: 1 + dex * ATTRIBUTES.DEX.perPoint.moveSpeedMultiplier,
			maxHpBonus: vit * ATTRIBUTES.VIT.perPoint.maxHpBonus,
			shieldCapacity: vit * ATTRIBUTES.VIT.perPoint.shieldCapacity,
			hpRegen: vit * ATTRIBUTES.VIT.perPoint.hpRegen,
			cooldownReduction: Math.min(0.60, int * ATTRIBUTES.INT.perPoint.cooldownReduction),
			aoeRadiusMultiplier: 1 + int * ATTRIBUTES.INT.perPoint.aoeRadiusMultiplier,
			critChance: Math.min(
				ATTRIBUTES.LUCK.maxCritChance,
				luck * ATTRIBUTES.LUCK.perPoint.critChance
			),
			lootQualityBonus: luck * ATTRIBUTES.LUCK.perPoint.lootQualityBonus,
		};
	}

	// ─── SKILL ACQUISITION ───────────────────────────────────────────────────────

	/**
	 * Check if a skill can be learned/ranked up.
	 */
	canLearnSkill(skillId) {
		const { skill, archetypeKey } = this._findSkill(skillId);
		if (!skill) return { allowed: false, reason: 'Skill not found.' };

		const currentRank = this.skillRanks[skillId] || 0;
		if (currentRank >= skill.maxRank) return { allowed: false, reason: 'Max rank reached.' };
		if (this.unspentSkillPoints < 1) return { allowed: false, reason: 'No skill points available.' };

		// Prerequisite check (skip for ultimates — they are standalone nodes)
		// A prerequisite just needs to be learned (rank >= 1) to unlock any rank of a downstream skill.
		// This avoids dead-ends when the prerequisite has a lower maxRank than the dependent skill.
		if (skill.type !== 'ultimate') {
			const prereq = this._getTierPrerequisite(skillId, archetypeKey);
			if (prereq) {
				const prereqRank = this.skillRanks[prereq.id] || 0;
				if (prereqRank < 1) {
					return { allowed: false, reason: `Need ${prereq.name} learned first.` };
				}
			}
		}

		// Slot capacity check for first rank
		if (currentRank === 0) {
			if (skill.type === 'active' && this.equippedActives.length >= SKILL_SLOTS.ACTIVE_MAX) {
				return { allowed: false, reason: `Max ${SKILL_SLOTS.ACTIVE_MAX} actives equipped.` };
			}
			if (skill.type === 'ultimate') {
				// Ultimate requires minimum total investment in this archetype's tree
				const treePoints = this.treeInvestment[archetypeKey] || 0;
				if (treePoints < ULTIMATE_MIN_TREE_INVESTMENT) {
					return { allowed: false, reason: `Need ${ULTIMATE_MIN_TREE_INVESTMENT} skill points in ${ARCHETYPES[archetypeKey].label} tree (have ${treePoints}).` };
				}
				if (this.equippedUltimate) {
					return { allowed: false, reason: 'Ultimate slot already filled.' };
				}
			}
		}

		return { allowed: true, reason: '' };
	}

	/**
	 * Learn or rank-up a skill. Assumes canLearnSkill was checked.
	 * @param {string} skillId
	 * @returns {boolean}
	 */
	learnSkill(skillId) {
		const check = this.canLearnSkill(skillId);
		if (!check.allowed) return false;

		const { skill, archetypeKey } = this._findSkill(skillId);
		const currentRank = this.skillRanks[skillId] || 0;

		this.skillRanks[skillId] = currentRank + 1;
		this.unspentSkillPoints--;
		this.treeInvestment[archetypeKey]++;

		// Auto-equip on first rank
		if (currentRank === 0) {
			if (skill.type === 'passive') this.equippedPassives.push(skillId);
			if (skill.type === 'active') {
				this.equippedActives.push(skillId);
				this.cooldowns[skillId] = 0; // ready immediately
			}
			if (skill.type === 'ultimate') {
				this.equippedUltimate = skillId;
				this.cooldowns[skillId] = 0;
			}
		}

		// Notify SkillEffectEngine (if available — set by Game.js after construction)
		if (this._skillEffectEngine) {
			this._skillEffectEngine.equipSkill(skillId, this.skillRanks[skillId], skill);
		}

		// Dispatch to state store
		this._dispatcher?.dispatch({
			type: ActionTypes.SKILL_LEARN,
			payload: {
				skillId,
				rank: this.skillRanks[skillId],
				archetypeKey,
				skillType: skill.type,
				unspentSkillPoints: this.unspentSkillPoints,
			},
		});

		return true;
	}

	// ─── COOLDOWN TICKING ────────────────────────────────────────────────────────

	/**
	 * Tick all active/ultimate cooldowns.
	 * @param {number} delta - ms since last frame
	 */
	updateCooldowns(delta) {
		for (const skillId of Object.keys(this.cooldowns)) {
			if (this.cooldowns[skillId] > 0) {
				this.cooldowns[skillId] = Math.max(0, this.cooldowns[skillId] - delta);
			}
		}
	}

	/**
	 * Try to cast an active/ultimate skill. Puts it on cooldown if ready.
	 * @param {string} skillId
	 * @returns {boolean} true if cast succeeded
	 */
	tryCast(skillId) {
		if (this.cooldowns[skillId] > 0) return false;

		const { skill } = this._findSkill(skillId);
		if (!skill || (skill.type !== 'active' && skill.type !== 'ultimate')) return false;

		const rank = this.skillRanks[skillId] || 0;
		if (rank < 1) return false;

		const effectiveCD = this._getEffectiveCooldown(skill, this._ascensionCooldownMultiplier || 1);
		this.cooldowns[skillId] = effectiveCD;
		return true;
	}

	/**
	 * Get the skill definition and rank for an active/ultimate skill, used by Game
	 * to execute the actual effect after tryCast() succeeds.
	 * @param {string} skillId
	 * @returns {{skill: Object, rank: number}|null}
	 */
	getActiveSkillInfo(skillId) {
		const { skill } = this._findSkill(skillId);
		if (!skill) return null;
		const rank = this.skillRanks[skillId] || 0;
		if (rank < 1) return null;
		return { skill, rank };
	}

	/**
	 * Get effective cooldown after level CDR + INT CDR + ascension modifiers.
	 * @param {Object} skill
	 * @returns {number} Effective cooldown in ms
	 */
	_getEffectiveCooldown(skill, ascensionCDMultiplier = 1) {
		const baseCd = skill.cooldown || 10000;
		const levelCDR = Math.min(
			COOLDOWN_CONFIG.MAX_LEVEL_CDR,
			this.level * COOLDOWN_CONFIG.LEVEL_CDR_PER_LEVEL
		);
		const intCDR = this.getComputedAttributes().cooldownReduction;

		let cd = baseCd * (1 - levelCDR) * (1 - intCDR) * ascensionCDMultiplier;
		const floor = baseCd * COOLDOWN_CONFIG.MIN_CD_FRACTION;
		return Math.max(floor, cd);
	}

	/**
	 * Get cooldown info for UI rendering.
	 * @param {string} skillId
	 * @returns {{remaining: number, total: number, ready: boolean, fraction: number}}
	 */
	getCooldownInfo(skillId) {
		const remaining = this.cooldowns[skillId] || 0;
		const { skill } = this._findSkill(skillId);
		const total = skill ? this._getEffectiveCooldown(skill) : 1;
		return {
			remaining,
			total,
			ready: remaining <= 0,
			fraction: remaining > 0 ? remaining / total : 0,
		};
	}

	// ─── QUERY HELPERS ───────────────────────────────────────────────────────────

	/**
	 * Get all skills available to learn (across all trees).
	 * Filters by tier gate; marks locked/reason for UI.
	 */
	getAvailableSkills() {
		const results = [];
		for (const archetypeKey of Object.keys(ARCHETYPES)) {
			const archetype = ARCHETYPES[archetypeKey];
			for (const skill of archetype.skills) {
				const { allowed, reason } = this.canLearnSkill(skill.id);
				const currentRank = this.skillRanks[skill.id] || 0;
				results.push({
					...skill,
					archetypeKey,
					archetypeLabel: archetype.label,
					archetypeColor: archetype.color,
					currentRank,
					canLearn: allowed,
					lockReason: reason,
				});
			}
		}
		return results;
	}

	/**
	 * Get the QERT keybind mapping for equipped actives + ultimate.
	 * @returns {Array<{key: string, skillId: string|null, skill: Object|null}>}
	 */
	getKeybindSlots() {
		const keys = ['Q', 'E', 'R', 'T'];
		const slots = [];

		// Q, E, R → actives
		for (let i = 0; i < 3; i++) {
			const skillId = this.equippedActives[i] || null;
			const skill = skillId ? this._findSkill(skillId).skill : null;
			slots.push({ key: keys[i], skillId, skill });
		}

		// T → ultimate
		const ultSkill = this.equippedUltimate ? this._findSkill(this.equippedUltimate).skill : null;
		slots.push({
			key: 'T',
			skillId: this.equippedUltimate,
			skill: ultSkill,
			isUltimate: true,
			locked: !this.equippedUltimate,
		});

		return slots;
	}

	/**
	 * Get skill rank (0 if not learned).
	 */
	getSkillRank(skillId) {
		return this.skillRanks[skillId] || 0;
	}

	/**
	 * Resolve a skill definition from its id.
	 */
	getSkillDef(skillId) {
		return this._findSkill(skillId).skill;
	}

	/**
	 * Build aggregated passive effects from all equipped passives.
	 * All skill effects are now handled by the SkillEffectEngine plugin system.
	 * This method returns safe defaults for any code that may still reference the shape.
	 * @returns {Object} Combined passive modifiers (all defaults — plugins handle effects)
	 */
	getPassiveEffects() {
		return {
			fireRateBonus: 0,
			damageBonus: 0,
			turnSpeedBonus: 0,
			pierceCount: 0,
			hasTripleShot: false,
			tripleShotSideDamage: 0,
			hasExplosiveRounds: false,
			explosionDamageRatio: 0,
			explosionRadius: 0,
			burnDamagePercent: 0,
			burnRange: 0,
			chainChance: 0,
			chainRange: 0,
			hasVolatileKills: false,
			volatileKillPercent: 0,
			volatileKillRadius: 0,
			critChanceBonus: 0,
			critDamageMultiplier: 1.0,
			overcharge: null,
			homingStrength: 0,
			hasSynergyBonus: false,
			synergyDamageBonus: 0,
			hasMeltdown: false,
			meltdownChance: 0,
			meltdownDamageRatio: 0,
			meltdownRadius: 0,
			chainDamageEscalation: 0,
		};
	}

	// ─── SAVE / RESTORE ──────────────────────────────────────────────────────────

	getSaveState() {
		return {
			attributes: { ...this.attributes },
			skillRanks: { ...this.skillRanks },
			treeInvestment: { ...this.treeInvestment },
			equippedPassives: [...this.equippedPassives],
			equippedActives: [...this.equippedActives],
			equippedUltimate: this.equippedUltimate,
			cooldowns: { ...this.cooldowns },
			unspentSkillPoints: this.unspentSkillPoints,
			unspentAttributePoints: this.unspentAttributePoints,
			level: this.level,
			xp: this.xp,
			xpToNextLevel: this.xpToNextLevel,
			pendingLevelUps: this.pendingLevelUps,
		};
	}

	restoreFromSave(state) {
		if (!state) return;
		this.attributes = { ...state.attributes };
		this.skillRanks = { ...state.skillRanks };
		this.treeInvestment = { ...state.treeInvestment };
		this.equippedPassives = [...(state.equippedPassives || [])];
		this.equippedActives = [...(state.equippedActives || [])];
		this.equippedUltimate = state.equippedUltimate || null;
		this.cooldowns = { ...state.cooldowns };
		this.unspentSkillPoints = state.unspentSkillPoints || 0;
		this.unspentAttributePoints = state.unspentAttributePoints || 0;
		this.level = state.level || 1;
		this.xp = state.xp || 0;
		this.xpToNextLevel = state.xpToNextLevel || LEVEL_CONFIG.getXPForLevel(this.level);
		this.pendingLevelUps = state.pendingLevelUps || 0;
	}

	// ─── INTERNAL ────────────────────────────────────────────────────────────────

	/**
	 * Find a skill definition by id across all archetypes.
	 * @param {string} skillId
	 * @returns {{skill: Object|null, archetypeKey: string|null}}
	 */
	_findSkill(skillId) {
		for (const archetypeKey of Object.keys(ARCHETYPES)) {
			const archetype = ARCHETYPES[archetypeKey];
			const skill = archetype.skills.find(s => s.id === skillId);
			if (skill) return { skill, archetypeKey };
		}
		return { skill: null, archetypeKey: null };
	}

	/**
	 * Resolve the branch prerequisite from previous tier for rank gating.
	 * @param {string} skillId
	 * @param {string} archetypeKey
	 * @returns {Object|null}
	 */
	_getTierPrerequisite(skillId, archetypeKey) {
		const archetype = ARCHETYPES[archetypeKey];
		if (!archetype) return null;

		const skill = archetype.skills.find(s => s.id === skillId);
		if (!skill || skill.tier <= 1) return null;

		const currentTierSkills = archetype.skills.filter(s => s.tier === skill.tier);
		const previousTierSkills = archetype.skills.filter(s => s.tier === skill.tier - 1);
		if (previousTierSkills.length === 0) return null;

		const tierIndex = currentTierSkills.findIndex(s => s.id === skill.id);
		const prereqIndex = Math.max(0, Math.min(tierIndex, previousTierSkills.length - 1));
		return previousTierSkills[prereqIndex] || null;
	}
}

