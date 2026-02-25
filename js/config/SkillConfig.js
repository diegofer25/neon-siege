/**
 * @fileoverview Skill tree, attribute, and ascension configuration
 * 
 * Defines the complete skill-based progression system:
 * - 5 RPG attributes (STR, DEX, VIT, INT, LUCK) allocated via points
 * - 5 archetype skill trees (2 shipped: Gunner, Technomancer; 3 stubbed)
 * - 4 tiers per tree with gate thresholds (3/6/10 points)
 * - Ultimates per archetype, unlocked by completing branch (T4 passive learned)
 * - Ascension modifiers (pick 1 of 3 every 10 waves)
 * - XP/level curve targeting 15-20 levels in a 50-wave run
 */
// cspell:words Technomancer TECHNOMANCER cooldowns crits aimbot Aimbot Debuffs

// ─── ATTRIBUTES ────────────────────────────────────────────────────────────────

/**
 * Bundled RPG attribute definitions.
 * Each level grants 3 attribute points distributed among these 5.
 */
export const ATTRIBUTES = {
	STR: {
		id: 'STR',
		label: 'Strength',
		description: 'Increases bullet damage, bullet speed, and explosion damage.',
		icon: '💥',
		perPoint: {
			damageMultiplier: 0.05,      // +5% damage per point
			explosionDamage: 0.04,        // +4% explosion damage per point
			projectileSpeedMultiplier: 0.03, // +3% projectile speed per point
		},
		maxPoints: 50,
	},
	DEX: {
		id: 'DEX',
		label: 'Dexterity',
		description: 'Increases fire rate, turn speed, and movement speed.',
		icon: '⚡',
		perPoint: {
			fireRateMultiplier: 0.04,     // +4% fire rate per point
			turnSpeedMultiplier: 0.03,    // +3% turn speed per point
			moveSpeedMultiplier: 0.03,    // +3% movement speed per point
		},
		maxPoints: 50,
	},
	VIT: {
		id: 'VIT',
		label: 'Vitality',
		description: 'Increases max HP, shield capacity, and regeneration.',
		icon: '❤️',
		perPoint: {
			maxHpBonus: 8,                // +8 max HP per point
			shieldCapacity: 4,            // +4 max shield per point
			hpRegen: 0.3,                 // +0.3 HP/s per point
		},
		maxPoints: 50,
	},
	INT: {
		id: 'INT',
		label: 'Intelligence',
		description: 'Reduces skill cooldowns and increases AoE size.',
		icon: '🧠',
		perPoint: {
			cooldownReduction: 0.03,      // +3% CDR per point (multiplicative)
			aoeRadiusMultiplier: 0.03,    // +3% AoE radius per point
		},
		maxPoints: 50,
	},
	LUCK: {
		id: 'LUCK',
		label: 'Luck',
		description: 'Increases critical hit chance and loot quality.',
		icon: '🍀',
		perPoint: {
			critChance: 0.015,            // +1.5% crit chance per point
			lootQualityBonus: 0.02,       // +2% loot quality per point
		},
		maxPoints: 50,
		maxCritChance: 0.60,              // hard cap at 60%
	},
};

export const ATTRIBUTE_POINTS_PER_LEVEL = 3;

// ─── LEVEL / XP CURVE ─────────────────────────────────────────────────────────

/**
 * XP required for each level: 50 * 1.25^(level-1)
 * Targets ~18 levels in a 50-wave run.
 */
export const LEVEL_CONFIG = {
	BASE_XP: 50,
	EXPONENT: 1.25,
	SKILL_POINTS_PER_LEVEL: 1,

	/** XP grants per source */
	XP_PER_KILL: {
		basic: 5,
		fast: 8,
		tank: 15,
		splitter: 10,
		boss: 100,
	},
	XP_PER_WAVE_CLEAR_BASE: 20,
	XP_PER_WAVE_CLEAR_SCALING: 5,  // +5 per wave number

	/**
	 * Calculate XP needed for a specific level
	 * @param {number} level - Current level (1-based)
	 * @returns {number}
	 */
	getXPForLevel(level) {
		return Math.floor(this.BASE_XP * Math.pow(this.EXPONENT, level - 1));
	},
};

// ─── SKILL SLOT LIMITS ─────────────────────────────────────────────────────────

export const SKILL_SLOTS = {
	PASSIVE_MAX: 4,
	ACTIVE_MAX: 3,
	ULTIMATE_MAX: 1,
	ULTIMATE_UNLOCK_WAVE: 10,  // unlocks after first boss
};

// ─── TIER GATES ────────────────────────────────────────────────────────────────

/**
 * Points invested in a single tree required to unlock each tier.
 * Tier 1: always available
 * Tier 2: 3+ points in tree
 * Tier 3: 6+ points in tree (requires Legacy Token unlock)
 * Tier 4: 10+ points in tree (requires Legacy Token unlock, includes ultimate)
 */
export const TIER_GATES = [0, 3, 6, 10];

/**
 * Legacy Token costs to unlock tier 3 and 4 branches per archetype
 */
export const TIER_UNLOCK_COSTS = {
	tier3: 15,
	tier4: 30,
};

// ─── COOLDOWN SYSTEM ───────────────────────────────────────────────────────────

/**
 * Escalating tempo: base cooldowns are long; reduced by level and INT.
 * effectiveCD = baseCooldown * (1 - levelCDR) * (1 - intCDR)
 * levelCDR = min(0.40, level * 0.02) — up to 40% at level 20
 */
export const COOLDOWN_CONFIG = {
	LEVEL_CDR_PER_LEVEL: 0.02,
	MAX_LEVEL_CDR: 0.40,
	/** Minimum cooldown floor as fraction of base (never below 20% of base) */
	MIN_CD_FRACTION: 0.20,
};

// ─── ARCHETYPE DEFINITIONS ─────────────────────────────────────────────────────

/**
 * @typedef {Object} SkillDef
 * @property {string} id - Unique skill identifier
 * @property {string} name - Display name
 * @property {string} description - Tooltip description
 * @property {string} icon - Emoji icon (replaced with images later)
 * @property {'passive'|'active'|'ultimate'} type
 * @property {number} tier - 1-4
 * @property {number} [maxRank=1] - Max upgrade ranks
 * @property {number} [cooldown] - Base cooldown in ms (actives/ultimates only)
 * @property {Object} effect - Per-rank effect values
 */

export const ARCHETYPES = {
	GUNNER: {
		id: 'GUNNER',
		label: 'Gunner',
		description: 'Pure DPS glass cannon. Faster fire, crits, piercing, multi-shot.',
		color: '#ff4444',
		icon: '🎯',
		skills: [
			// ── Tier 1 "Fundamentals" ──
			// Positional order determines T2 prerequisites:
			//   [0] Sharp Rounds → Piercing Shots
			//   [1] Rapid Fire   → Triple Shot
			//   [2] Focused Fire → Quick Aim
			{
				id: 'gunner_sharp_rounds',
				name: 'Sharp Rounds',
				description: '+20% bullet damage per rank.',
				icon: '⚡',
				type: 'passive',
				tier: 1,
				maxRank: 3,
				effect: { damageBonus: 0.20 },
			},
			{
				id: 'gunner_rapid_fire',
				name: 'Rapid Fire',
				description: '+15% fire rate per rank.',
				icon: '🔥',
				type: 'passive',
				tier: 1,
				maxRank: 3,
				effect: { fireRateBonus: 0.15 },
			},
			{
				id: 'gunner_focused_fire',
				name: 'Focused Fire',
				description: 'Active: +100% fire rate for 4s. 18s base CD. +1s duration per rank.',
				icon: '💥',
				type: 'active',
				tier: 1,
				maxRank: 2,
				cooldown: 18000,
				effect: { fireRateMultiplier: 2.0, duration: 4000, durationPerRank: 1000 },
			},
			// ── Tier 2 "Projectile Mastery" (gate: 3 pts) ──
			// Prerequisites: [0]←Sharp Rounds  [1]←Rapid Fire  [2]←Focused Fire
			{
				id: 'gunner_piercing',
				name: 'Piercing Shots',
				description: 'Projectiles pierce +1 enemy per rank. -25% damage per pierce.',
				icon: '🎯',
				type: 'passive',
				tier: 2,
				maxRank: 3,
				effect: { pierceCount: 1 },
			},
			{
				id: 'gunner_triple_shot',
				name: 'Triple Shot',
				description: 'Fire 3 bullets in a spread. Side bullets deal 30% damage (+10%/rank).',
				icon: '🔱',
				type: 'passive',
				tier: 2,
				maxRank: 3,
				effect: { sideDamageBase: 0.30, sideDamagePerRank: 0.10 },
			},
			{
				id: 'gunner_quick_aim',
				name: 'Quick Aim',
				description: '+20% turn speed per rank.',
				icon: '🌀',
				type: 'passive',
				tier: 2,
				maxRank: 2,
				effect: { turnSpeedBonus: 0.20 },
			},
			// ── Tier 3 "Lethal Precision" (gate: 6 pts, token-locked) ──
			// Prerequisites: [0]←Piercing  [1]←Triple Shot  [2]←Quick Aim
			{
				id: 'gunner_critical_mastery',
				name: 'Critical Mastery',
				description: '+8% crit chance and +50% crit damage per rank.',
				icon: '💎',
				type: 'passive',
				tier: 3,
				maxRank: 3,
				effect: { critChance: 0.08, critDamageMultiplier: 0.50 },
			},
			{
				id: 'gunner_barrage',
				name: 'Bullet Storm',
				description: 'Active: Fire a rapid burst of 20 homing shots over 3s. 25s base CD. +5 shots per rank.',
				icon: '🌪️',
				type: 'active',
				tier: 3,
				maxRank: 2,
				cooldown: 25000,
				effect: { shotCount: 20, duration: 3000, shotsPerRank: 5 },
			},
			{
				id: 'gunner_overcharge',
				name: 'Overcharge Burst',
				description: 'Every 8th shot deals 5x damage. -2 interval and +2x damage per rank.',
				icon: '⚡',
				type: 'passive',
				tier: 3,
				maxRank: 2,
				effect: { shotInterval: 8, damageMultiplier: 5, intervalReduction: 2, multiplierPerRank: 2 },
			},
			// ── Tier 4 "Perfection" (gate: 10 pts, token-locked) ──
			// Prerequisites: [0]←Critical Mastery  [1]←Bullet Storm
			{
				id: 'gunner_homing',
				name: 'Homing Rounds',
				description: 'All projectiles gently track enemies.',
				icon: '🧲',
				type: 'passive',
				tier: 4,
				maxRank: 1,
				effect: { homingStrength: 0.03 },
			},
			{
				id: 'gunner_aimbot_overdrive',
				name: 'Aimbot Overdrive',
				description: 'Ultimate: Lock onto every enemy simultaneously. Fire homing shots at all of them for 6s. 90s base CD.',
				icon: '🎯',
				type: 'ultimate',
				tier: 4,
				maxRank: 1,
				cooldown: 90000,
				effect: { duration: 6000, damagePerShot: 1.5 },
			},
		],
	},

	TECHNOMANCER: {
		id: 'TECHNOMANCER',
		label: 'Technomancer',
		description: 'AoE explosions, burn, chain lightning, elemental combos.',
		color: '#aa44ff',
		icon: '⚡',
		skills: [
			// ── Tier 1 "Ignition" ──
			// Positional order determines T2 prerequisites:
			//   [0] Explosive Rounds → Chain Hit
			//   [1] Bigger Booms     → Volatile Kills
			//   [2] EMP Pulse        → Immolation Aura
			{
				id: 'techno_explosive_rounds',
				name: 'Explosive Rounds',
				description: 'Bullets explode on impact, dealing 30% damage in an area. 50px radius.',
				icon: '💣',
				type: 'passive',
				tier: 1,
				maxRank: 1,
				effect: { explosionDamageRatio: 0.30, explosionRadius: 50 },
			},
			{
				id: 'techno_bigger_booms',
				name: 'Bigger Booms',
				description: '+25% explosion radius and +15% explosion damage per rank.',
				icon: '🔥',
				type: 'passive',
				tier: 1,
				maxRank: 3,
				effect: { radiusBonus: 0.25, damageBonus: 0.15 },
			},
			{
				id: 'techno_emp_pulse',
				name: 'EMP Pulse',
				description: 'Active: Slow all enemies by 60% for 4s in a large radius. 20s base CD. +1.5s duration per rank.',
				icon: '📡',
				type: 'active',
				tier: 1,
				maxRank: 2,
				cooldown: 20000,
				effect: { slowAmount: 0.60, duration: 4000, radius: 200, durationPerRank: 1500 },
			},
			// ── Tier 2 "Amplification" (gate: 3 pts) ──
			// Prerequisites: [0]←Explosive Rounds  [1]←Bigger Booms  [2]←EMP Pulse
			{
				id: 'techno_chain_hit',
				name: 'Chain Hit',
				description: 'Explosions have 30% chance (+15%/rank) to chain to a nearby enemy. 120px range.',
				icon: '⛓️',
				type: 'passive',
				tier: 2,
				maxRank: 3,
				effect: { chainChance: 0.30, chainChancePerRank: 0.15, chainRange: 120 },
			},
			{
				id: 'techno_volatile_kills',
				name: 'Volatile Kills',
				description: 'Enemies explode on death, dealing 20% of their max HP to nearby. +10%/rank. 80px radius.',
				icon: '💀',
				type: 'passive',
				tier: 2,
				maxRank: 2,
				effect: { deathExplosionPercent: 0.20, percentPerRank: 0.10, deathExplosionRadius: 80 },
			},
			{
				id: 'techno_burn',
				name: 'Immolation Aura',
				description: 'Burn nearby enemies for 1% max HP/sec. +20 range per rank.',
				icon: '🔥',
				type: 'passive',
				tier: 2,
				maxRank: 3,
				effect: { burnDamagePercent: 0.01, rangePerRank: 20, baseRange: 60 },
			},
			// ── Tier 3 "Elemental Mastery" (gate: 6 pts, token-locked) ──
			// Prerequisites: [0]←Chain Hit  [1]←Volatile Kills  [2]←Immolation Aura
			{
				id: 'techno_elemental_synergy',
				name: 'Elemental Synergy',
				description: 'Burn + explosions deal 25% more damage combined. +15%/rank.',
				icon: '🌟',
				type: 'passive',
				tier: 3,
				maxRank: 2,
				effect: { synergyDamageBonus: 0.25, bonusPerRank: 0.15 },
			},
			{
				id: 'techno_neon_nova',
				name: 'Neon Nova',
				description: 'Active: Massive AoE blast dealing 40% max HP to all enemies in range. 30s base CD. +50px radius per rank.',
				icon: '☀️',
				type: 'active',
				tier: 3,
				maxRank: 2,
				cooldown: 30000,
				effect: { damagePercent: 0.40, radius: 250, radiusPerRank: 50 },
			},
			{
				id: 'techno_meltdown',
				name: 'Meltdown',
				description: 'Projectiles hitting burning enemies have 15% (+10%/rank) chance to trigger a bonus explosion.',
				icon: '🌋',
				type: 'passive',
				tier: 3,
				maxRank: 2,
				effect: { meltdownChance: 0.15, chancePerRank: 0.10, meltdownDamageRatio: 0.50, meltdownRadius: 60 },
			},
			// ── Tier 4 "Cataclysm" (gate: 10 pts, token-locked) ──
			// Prerequisites: [0]←Elemental Synergy  [1]←Neon Nova
			{
				id: 'techno_chain_master',
				name: 'Chain Master',
				description: 'Chain hits deal escalating damage (+25% per bounce).',
				icon: '🔗',
				type: 'passive',
				tier: 4,
				maxRank: 1,
				effect: { chainDamageEscalation: 0.25 },
			},
			{
				id: 'techno_lightning_cascade',
				name: 'Lightning Cascade',
				description: 'Ultimate: Chain lightning bounces between ALL enemies. Each bounce amplifies damage by 15%. 90s base CD.',
				icon: '⚡',
				type: 'ultimate',
				tier: 4,
				maxRank: 1,
				cooldown: 90000,
				effect: { baseDamage: 50, bounceAmplification: 0.15, maxBounces: 100 },
			},
		],
	},

	// ── STUBBED ARCHETYPES (config only, no gameplay) ──

	SENTINEL: {
		id: 'SENTINEL',
		label: 'Sentinel',
		description: 'Shields, regen, reflect, auras. Survive forever, wear enemies down.',
		color: '#44aaff',
		icon: '🛡️',
		skills: [
			{ id: 'sentinel_placeholder_1', name: 'Fortify', description: 'Coming soon.', icon: '🛡️', type: 'passive', tier: 1, maxRank: 1, effect: {} },
			{ id: 'sentinel_placeholder_ult', name: 'Bastion', description: 'Coming soon.', icon: '🏰', type: 'ultimate', tier: 4, maxRank: 1, cooldown: 90000, effect: {} },
		],
	},

	ENGINEER: {
		id: 'ENGINEER',
		label: 'Engineer',
		description: 'Summons, drones, turrets, traps. Build an army and control zones.',
		color: '#44ff44',
		icon: '🔧',
		skills: [
			{ id: 'engineer_placeholder_1', name: 'Deploy Turret', description: 'Coming soon.', icon: '🔧', type: 'passive', tier: 1, maxRank: 1, effect: {} },
			{ id: 'engineer_placeholder_ult', name: 'Drone Swarm', description: 'Coming soon.', icon: '🤖', type: 'ultimate', tier: 4, maxRank: 1, cooldown: 90000, effect: {} },
		],
	},

	TACTICIAN: {
		id: 'TACTICIAN',
		label: 'Tactician',
		description: 'Debuffs, marks, vulnerability stacks. Tactical precision gameplay.',
		color: '#ffaa44',
		icon: '🎖️',
		skills: [
			{ id: 'tactician_placeholder_1', name: 'Mark Target', description: 'Coming soon.', icon: '🎖️', type: 'passive', tier: 1, maxRank: 1, effect: {} },
			{ id: 'tactician_placeholder_ult', name: 'Tactical Strike', description: 'Coming soon.', icon: '💀', type: 'ultimate', tier: 4, maxRank: 1, cooldown: 90000, effect: {} },
		],
	},
};

/** Archetypes available for play in v1 */
export const PLAYABLE_ARCHETYPES = ['GUNNER', 'TECHNOMANCER'];

/** All archetype keys including stubs */
export const ALL_ARCHETYPE_KEYS = Object.keys(ARCHETYPES);

// ─── ASCENSION SYSTEM ──────────────────────────────────────────────────────────

/**
 * Ascension modifiers — pick 1 of 3 random from this pool every 10 waves.
 * These are powerful run-warping effects separate from the skill tree.
 */
export const ASCENSION_POOL = [
	{
		id: 'asc_ricochet',
		name: 'Ricochet Rounds',
		description: 'All projectiles bounce off screen walls once.',
		icon: '🏓',
		effect: { ricochet: true },
	},
	{
		id: 'asc_death_explosions',
		name: 'Volatile Death',
		description: 'All enemies explode on death dealing 15% HP to nearby foes.',
		icon: '💥',
		effect: { deathExplosion: 0.15 },
	},
	{
		id: 'asc_double_cd',
		name: 'Overclock Protocol',
		description: 'Skill cooldowns halved, but take 20% more damage.',
		icon: '⚡',
		effect: { cooldownMultiplier: 0.5, damageTakenMultiplier: 1.2 },
	},
	{
		id: 'asc_glass_cannon',
		name: 'Glass Cannon',
		description: '+60% damage dealt, but -30% max HP.',
		icon: '🔫',
		effect: { damageMultiplier: 1.6, maxHpMultiplier: 0.7 },
	},
	{
		id: 'asc_vampiric',
		name: 'Vampiric Touch',
		description: 'Heal 2% of damage dealt to enemies.',
		icon: '🧛',
		effect: { lifeStealPercent: 0.02 },
	},
	{
		id: 'asc_bullet_time',
		name: 'Bullet Time',
		description: 'Enemies move 20% slower permanently.',
		icon: '⏳',
		effect: { globalEnemySlow: 0.20 },
	},
	{
		id: 'asc_xp_surge',
		name: 'Knowledge Surge',
		description: '+40% XP from all sources.',
		icon: '📚',
		effect: { xpMultiplier: 1.4 },
	},
	{
		id: 'asc_thick_skin',
		name: 'Thick Skin',
		description: '+40% max HP and +2 HP regen/sec.',
		icon: '🛡️',
		effect: { maxHpMultiplier: 1.4, hpRegenBonus: 2 },
	},
	{
		id: 'asc_chain_reaction',
		name: 'Chain Reaction',
		description: 'Critical hits bounce to 1 nearby enemy at 50% damage.',
		icon: '⛓️',
		effect: { critBounce: true, critBounceDamage: 0.50 },
	},
	{
		id: 'asc_treasure_hunter',
		name: 'Treasure Hunter',
		description: '+100% score and loot drop chance doubled.',
		icon: '💰',
		effect: { scoreMultiplier: 2.0, lootChanceMultiplier: 2.0 },
	},
	{
		id: 'asc_rapid_evolution',
		name: 'Rapid Evolution',
		description: 'Gain +1 skill point and +5 attribute points immediately.',
		icon: '🧬',
		effect: { bonusSkillPoints: 1, bonusAttributePoints: 5 },
		consumeOnPick: true,
	},
	{
		id: 'asc_berserker',
		name: 'Berserker',
		description: 'Deal +3% more damage for each 10% HP missing.',
		icon: '🔥',
		effect: { berserkerDamagePerMissingHpPercent: 0.03 },
	},
	{
		id: 'asc_shield_nova',
		name: 'Shield Nova',
		description: 'When shield breaks, damage all nearby enemies for 200% shield capacity.',
		icon: '💫',
		effect: { shieldNovaMultiplier: 2.0, shieldNovaRadius: 150 },
	},
	{
		id: 'asc_echo',
		name: 'Echo Strike',
		description: '15% chance to fire a duplicate projectile.',
		icon: '👥',
		effect: { echoChance: 0.15 },
	},
	{
		id: 'asc_resilience',
		name: 'Resilience',
		description: 'Reduce all damage taken by 15%.',
		icon: '🪨',
		effect: { damageReduction: 0.15 },
	},
];

/** Number of ascension picks offered per event */
export const ASCENSION_PICKS = 3;

/** Waves at which Ascension events trigger */
export const ASCENSION_WAVES = [5, 10, 15, 20, 25, 30];
