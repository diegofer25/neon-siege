/**
 * @fileoverview ComputedStats — pure derivation replacing Game._syncPlayerFromSkills().
 *
 * Takes the centralized store slices (skills, player) + the SkillEffectEngine
 * and returns a fully resolved player stats object. This is a pure function with no
 * side effects — it reads store state and engine state, and returns a stats snapshot.
 *
 * All ascension effects are now handled via the plugin pipeline inside SkillEffectEngine.
 * No manual ascension aggregation is needed here.
 *
 * Called whenever skills, attributes, ascension, or loot buffs change.
 * The result is dispatched via PLAYER_SYNC_STATS to update the player slice.
 *
 * Bug fix: By deriving all stats from source-of-truth slices every time,
 * we eliminate the LootSystem stat desync (_originalFireRateMod going stale).
 */

import { GameConfig } from '../config/GameConfig.js';
import { ATTRIBUTES } from '../config/SkillConfig.js';

/**
 * Compute effective attribute bonuses from raw attribute points.
 * Mirrors SkillManager.getComputedAttributes() but reads from store slice.
 *
 * @param {{ STR: number, DEX: number, VIT: number, INT: number, LUCK: number }} attrs
 * @returns {Object} Derived attribute bonuses
 */
export function computeAttributeBonuses(attrs) {
	const str = attrs.STR || 0;
	const dex = attrs.DEX || 0;
	const vit = attrs.VIT || 0;
	const int = attrs.INT || 0;
	const luck = attrs.LUCK || 0;

	return {
		damageMultiplier: 1 + str * ATTRIBUTES.STR.perPoint.damageMultiplier,
		explosionDamageMultiplier: 1 + str * ATTRIBUTES.STR.perPoint.explosionDamage,
		fireRateMultiplier: 1 + dex * ATTRIBUTES.DEX.perPoint.fireRateMultiplier,
		turnSpeedMultiplier: 1 + dex * ATTRIBUTES.DEX.perPoint.turnSpeedMultiplier,
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

/**
 * Derive the full player combat stats from all contributing sources.
 * Ascension effects are resolved through the plugin modifier pipeline.
 *
 * @param {Object} params
 * @param {{ STR: number, DEX: number, VIT: number, INT: number, LUCK: number }} params.rawAttributes
 *   - Raw attribute points from skills slice
 * @param {import('../skills/SkillEffectEngine.js').SkillEffectEngine} params.skillEffectEngine
 *   - Engine instance for modifier aggregation + plugin configs
 * @param {{ hp: number, maxHp: number, shieldHp: number }} params.currentPlayerState
 *   - Current HP values to preserve HP ratio across maxHP changes
 * @param {Object[]} params.activeBuffs
 *   - Active loot buffs from player slice
 * @param {Record<string, number>} params.skillRanks
 *   - Skill rank data for visual state
 * @param {string[]} params.equippedPassives
 *   - Equipped passive skill IDs for visual state
 * @returns {Object} Full resolved stats to apply to the player
 */
export function derivePlayerStats({
	rawAttributes,
	skillEffectEngine,
	currentPlayerState,
	activeBuffs = [],
	skillRanks = {},
	equippedPassives = [],
}) {
	const attrs = computeAttributeBonuses(rawAttributes);
	const context = { attrs };

	// ── Plugin modifier aggregation (includes skill + ascension plugins) ──
	const pluginMods = skillEffectEngine.getAggregatedModifiers(context);

	// ── Max HP via plugin pipeline (ascension maxHp multipliers resolved here) ──
	const baseHp = GameConfig.PLAYER.BASE_HP;
	const newMaxHp = Math.floor(
		skillEffectEngine.resolveStatValue('maxHp', baseHp + attrs.maxHpBonus, pluginMods)
	);
	const hpRatio = currentPlayerState.maxHp > 0 ? currentPlayerState.hp / currentPlayerState.maxHp : 1;
	const newHp = Math.min(newMaxHp, Math.ceil(newMaxHp * hpRatio));

	// ── Shield ──
	const maxShieldHp = attrs.shieldCapacity;
	const hasShield = maxShieldHp > 0;
	const shieldHp = hasShield ? Math.min(currentPlayerState.shieldHp || 0, maxShieldHp) : 0;

	// ── Regen via plugin pipeline (ascension hpRegen bonuses resolved here) ──
	const hpRegen = skillEffectEngine.resolveStatValue('hpRegen', attrs.hpRegen, pluginMods);
	const shieldRegen = maxShieldHp > 0 ? maxShieldHp * 0.05 : 0;

	// ── Combat stats via plugin modifier pipeline ──
	const baseDamage = attrs.damageMultiplier;
	const damageMod = skillEffectEngine.resolveStatValue('damage', baseDamage, pluginMods);
	const fireRateMod = skillEffectEngine.resolveStatValue('fireRate', attrs.fireRateMultiplier, pluginMods);
	const rotationSpeedMod = skillEffectEngine.resolveStatValue('rotationSpeed', attrs.turnSpeedMultiplier, pluginMods);

	// ── Pierce and homing ──
	const piercingLevel = Math.round(skillEffectEngine.resolveStatValue('pierceCount', 0, pluginMods));
	const hasHomingShots = skillEffectEngine.resolveStatValue('homingStrength', 0, pluginMods) > 0;

	// ── Crit ──
	const critFromPlugins = skillEffectEngine.resolveStatValue('critChance', 0, pluginMods);
	const totalCrit = Math.min(0.60, attrs.critChance + critFromPlugins);
	let luckyShots = null;
	if (totalCrit > 0) {
		const critDmgMult = skillEffectEngine.resolveStatValue('critDamageMultiplier', 1.0, pluginMods);
		luckyShots = {
			chance: totalCrit,
			active: true,
			critDamageMultiplier: critDmgMult,
		};
	}

	// ── Explosive shots ──
	const explosionRadius = skillEffectEngine.resolveStatValue('explosionRadius', 0, pluginMods);

	// ── Reset complex configs ──
	let hasTripleShot = false;
	let tripleShotSideDamage = 0;
	let explosiveShots = false;
	let overchargeBurst = null;
	let immolationAura = null;
	let chainHit = null;
	let volatileKills = null;
	let elementalSynergy = null;
	let meltdown = null;
	let finalExplosionRadius = 50;
	let finalExplosionDamage = 20;
	// Ascension config fields (set by plugins via getPlayerConfig)
	let ricochetEnabled = false;
	let globalEnemySlow = 0;
	let berserker = null;

	// ── Apply complex configs from plugins ──
	context.pluginMods = pluginMods;
	const pluginConfigs = skillEffectEngine.getPlayerConfigs(context);
	for (const { config } of pluginConfigs) {
		for (const [key, value] of Object.entries(config)) {
			switch (key) {
				case 'hasTripleShot': hasTripleShot = value; break;
				case 'tripleShotSideDamage': tripleShotSideDamage = value; break;
				case 'explosiveShots': explosiveShots = value; break;
				case 'overchargeBurst': overchargeBurst = value; break;
				case 'immolationAura': immolationAura = value; break;
				case 'chainHit': chainHit = value; break;
				case 'volatileKills': volatileKills = value; break;
				case 'elementalSynergy': elementalSynergy = value; break;
				case 'meltdown': meltdown = value; break;
				case 'ricochetEnabled': ricochetEnabled = value; break;
				case 'globalEnemySlow': globalEnemySlow = value; break;
				case 'berserker': berserker = value; break;
			}
		}
	}

	// ── Finalize explosion values ──
	if (explosiveShots && explosionRadius > 0) {
		finalExplosionRadius = explosionRadius * attrs.aoeRadiusMultiplier;
		const explosionDmgRatio = skillEffectEngine.resolveStatValue('explosionDamageRatio', 0, pluginMods);
		finalExplosionDamage = GameConfig.PLAYER.BASE_DAMAGE * damageMod * explosionDmgRatio;
	}

	// ── Ascension pipeline stats ──
	const _damageTakenMultiplier = skillEffectEngine.resolveStatValue('damageTaken', 1, pluginMods);
	const _damageReduction = skillEffectEngine.resolveStatValue('damageReduction', 0, pluginMods);
	const _cooldownMultiplier = skillEffectEngine.resolveStatValue('cooldownMultiplier', 1, pluginMods);
	const _scoreMultiplier = skillEffectEngine.resolveStatValue('scoreMultiplier', 1, pluginMods);
	const _lootChanceMultiplier = skillEffectEngine.resolveStatValue('lootChanceMultiplier', 1, pluginMods);
	const _xpMultiplier = skillEffectEngine.resolveStatValue('xpMultiplier', 1, pluginMods);

	// ── Loot buff application (reads from source-of-truth, never stale) ──
	let buffedDamageMod = damageMod;
	let buffedFireRateMod = fireRateMod;
	let godModeActive = false;

	for (const buff of activeBuffs) {
		switch (buff.type) {
			case 'damage':
				buffedDamageMod *= (buff.multiplier || 1);
				break;
			case 'fireRate':
				buffedFireRateMod *= (buff.multiplier || 1);
				break;
			case 'godMode':
				godModeActive = true;
				break;
		}
	}

	// ── Visual state ──
	const visualState = {
		strLevel: rawAttributes.STR || 0,
		dexLevel: rawAttributes.DEX || 0,
		vitLevel: rawAttributes.VIT || 0,
		intLevel: rawAttributes.INT || 0,
		luckLevel: rawAttributes.LUCK || 0,
		learnedSkills: new Set([
			...equippedPassives,
			...Object.keys(skillRanks).filter(id => skillRanks[id] > 0),
		]),
	};

	return {
		// HP
		hp: newHp,
		maxHp: newMaxHp,
		shieldHp,
		maxShieldHp,
		hasShield,

		// Regen
		hpRegen,
		shieldRegen,

		// Combat (with loot buffs composed in)
		damageMod: buffedDamageMod,
		fireRateMod: buffedFireRateMod,
		rotationSpeedMod,

		// Projectile modifiers
		piercingLevel,
		hasHomingShots,
		hasTripleShot,
		tripleShotSideDamage,
		luckyShots,

		// Explosive
		explosiveShots,
		explosionRadius: finalExplosionRadius,
		explosionDamage: finalExplosionDamage,

		// Complex ability configs
		overchargeBurst,
		immolationAura,
		chainHit,
		volatileKills,
		elementalSynergy,
		meltdown,

		// Ascension config fields
		ricochetEnabled,
		globalEnemySlow,
		berserker,

		// Ascension pipeline stats
		_damageTakenMultiplier,
		_damageReduction,
		_cooldownMultiplier,
		_scoreMultiplier,
		_lootChanceMultiplier,
		_xpMultiplier,

		// Life steal (handled by plugin events, clear direct field)
		hasLifeSteal: false,
		_ascensionLifeSteal: 0,

		// Ascension effects no longer aggregated manually — plugins handle everything
		_ascensionEffects: null,

		// God mode from loot
		godModeActive,

		// Active buffs reference
		activeBuffs,

		// Visual state for player rendering
		visualState,
	};
}

/**
 * Convenience: derive stats and dispatch PLAYER_SYNC_STATS.
 * This is the primary integration point for callers.
 *
 * @param {import('../state/GameStore.js').GameStore} store
 * @param {import('../state/ActionDispatcher.js').ActionDispatcher} dispatcher
 * @param {import('../skills/SkillEffectEngine.js').SkillEffectEngine} skillEffectEngine
 * @param {{ hp: number, maxHp: number, shieldHp: number }} currentPlayerState
 *   - Live player HP state (from the Player instance, not store, to avoid circular dep)
 */
export function syncPlayerStats(store, dispatcher, skillEffectEngine, currentPlayerState) {
	const skillsState = store.get('skills');
	const playerState = store.get('player');

	const stats = derivePlayerStats({
		rawAttributes: skillsState.attributes,
		skillEffectEngine,
		currentPlayerState: currentPlayerState || {
			hp: playerState.hp,
			maxHp: playerState.maxHp,
			shieldHp: playerState.shieldHp,
		},
		activeBuffs: playerState.activeBuffs || [],
		skillRanks: skillsState.skillRanks,
		equippedPassives: skillsState.equippedPassives,
	});

	dispatcher.dispatch({
		type: 'PLAYER_SYNC_STATS',
		payload: { stats },
	});

	return stats;
}