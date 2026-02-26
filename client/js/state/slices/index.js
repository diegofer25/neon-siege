/**
 * @fileoverview State slice definitions — initial states, reducers, and action mappings.
 *
 * All game state is partitioned into 10 typed slices. Each slice has:
 *   - initialState: the default shape
 *   - reducers: registered on the ActionDispatcher as pure (state, action, store) → updates
 *
 * Slices:
 *   phase, run, player, skills, combat, entities, wave, ascension, progression, settings
 */

import { ActionTypes } from '../ActionDispatcher.js';
import { GameConfig } from '../../config/GameConfig.js';
import { LEVEL_CONFIG } from '../../config/SkillConfig.js';

// ─── INITIAL STATES ─────────────────────────────────────────────────────────

export const phaseSlice = {
	current: 'menu',
	previous: null,
	countdown: 0,
};

export const runSlice = {
	wave: 0,
	score: 0,
	kills: 0,
	difficulty: 'normal',
	waveModifierKey: null,
	modifierState: {
		enemySpeedMultiplier: 1,
		enemyDamageTakenMultiplier: 1,
		playerRegenMultiplier: 1,
		playerTurnSpeedMultiplier: 1,
		visibilityReduction: false,
	},
	waveStartTime: 0,
	gameOverTracked: false,
	lastRunResult: null,
};

export const playerSlice = {
	hp: GameConfig.PLAYER.MAX_HP,
	maxHp: GameConfig.PLAYER.MAX_HP,
	shieldHp: 0,
	maxShieldHp: 0,
	x: 0,
	y: 0,
	angle: 0,
	hpRegen: 0,
	shieldRegen: 0,
	damageMod: 1,
	fireRateMod: 1,
	rotationSpeedMod: 1,
	piercingLevel: 0,
	hasTripleShot: false,
	tripleShotSideDamage: 1.0,
	hasHomingShots: false,
	hasLifeSteal: false,
	hasShield: false,
	explosiveShots: false,
	explosionRadius: 50,
	explosionDamage: 20,
	luckyShots: null,
	overchargeBurst: null,
	immolationAura: null,
	chainHit: null,
	volatileKills: null,
	elementalSynergy: null,
	meltdown: null,
	// Active loot buffs on player (first-class state, not hidden in LootSystem)
	activeBuffs: [],
	godModeActive: false,
	ascensionEffects: null,
	// Computed composite stats (output of ComputedStats derivation)
	computedStats: null,
};

export const skillsSlice = {
	attributes: {
		STR: 0,
		DEX: 0,
		VIT: 0,
		INT: 0,
		LUCK: 0,
	},
	skillRanks: {},
	treeInvestment: {},
	equippedPassives: [],
	equippedActives: [],
	equippedUltimate: null,
	cooldowns: {},
	unspentSkillPoints: 0,
	unspentAttributePoints: 0,
	level: 1,
	xp: 0,
	xpToNextLevel: LEVEL_CONFIG.getXPForLevel(1),
	pendingLevelUps: 0,
};

export const combatSlice = {
	combo: {
		streak: 0,
		timer: 0,
		tier: 0,
		maxStreakThisWave: 0,
		maxStreakThisRun: 0,
		totalBonusScore: 0,
	},
	loot: {
		activeBuffs: [],
	},
	// Processed enemy IDs this frame to prevent double-death
	processedDeathsThisFrame: new Set(),
};

export const entitiesSlice = {
	enemyCount: 0,
	projectileCount: 0,
	particleCount: 0,
};

export const waveSlice = {
	current: 0,
	enemiesSpawned: 0,
	enemiesKilled: 0,
	enemiesToSpawn: 0,
	spawnTimer: 0,
	spawnInterval: GameConfig.WAVE.BASE_SPAWN_INTERVAL,
	scaling: { health: 1, speed: 1, damage: 1 },
	isBoss: false,
	waveActive: false,
	waveComplete: false,
	waveCompletionTimer: 0,
	waveStartTime: 0,
};

export const ascensionSlice = {
	activeModifiers: [],
	activeModifierIds: [],
	offeredIds: [],
	pendingPick: false,
	currentOptions: null,
};

export const progressionSlice = {
	highestWave: 0,
	totalWavesCompleted: 0,
	bossWavesCleared: 0,
	currencies: { LEGACY_TOKENS: 0 },
	unlocks: {},
	achievements: {},
	bestWave: 0,
	bestScore: 0,
	bestCombo: 0,
	totalRuns: 0,
	totalKills: 0,
	runHistory: [],
};

export const settingsSlice = {
	soundVolume: 30,
	musicVolume: 20,
	screenShakeEnabled: true,
	performanceModeEnabled: false,
	showPerformanceStats: false,
	showKeybindHints: true,
};

/**
 * All slices combined as a single definitions object.
 * Pass to GameStore constructor.
 */
export const ALL_SLICE_DEFINITIONS = {
	phase: phaseSlice,
	run: runSlice,
	player: playerSlice,
	skills: skillsSlice,
	combat: combatSlice,
	entities: entitiesSlice,
	wave: waveSlice,
	ascension: ascensionSlice,
	progression: progressionSlice,
	settings: settingsSlice,
};

// ─── REDUCERS ───────────────────────────────────────────────────────────────

/**
 * Register all reducers on an ActionDispatcher instance.
 * @param {import('../ActionDispatcher.js').ActionDispatcher} dispatcher
 */
export function registerAllReducers(dispatcher) {
	// ──────────────────────────────────────────────────────────────────────────
	// RUN SLICE
	// ──────────────────────────────────────────────────────────────────────────

	dispatcher.addReducer(ActionTypes.GAME_START, 'run', () => ({
		wave: 1,
		score: 0,
		kills: 0,
		waveModifierKey: null,
		modifierState: {
			enemySpeedMultiplier: 1,
			enemyDamageTakenMultiplier: 1,
			playerRegenMultiplier: 1,
			playerTurnSpeedMultiplier: 1,
			visibilityReduction: false,
		},
		waveStartTime: 0,
		gameOverTracked: false,
		lastRunResult: null,
	}));

	dispatcher.addReducer(ActionTypes.SCORE_ADD, 'run', (state, action) => ({
		score: state.score + (action.payload.amount || 0),
	}));

	dispatcher.addReducer(ActionTypes.SET_DIFFICULTY, 'run', (state, action) => ({
		difficulty: action.payload.difficulty || 'normal',
	}));

	dispatcher.addReducer(ActionTypes.ENEMY_KILLED, 'run', (state, action) => ({
		kills: state.kills + 1,
		score: state.score + (action.payload.score || 0),
	}));

	dispatcher.addReducer(ActionTypes.WAVE_COMPLETE, 'run', (state) => ({
		wave: state.wave, // wave increment happens in WAVE_START of the next wave
		waveStartTime: 0,
	}));

	dispatcher.addReducer(ActionTypes.WAVE_START, 'run', (state, action) => ({
		wave: action.payload.wave || state.wave,
		waveStartTime: performance.now(),
	}));

	dispatcher.addReducer(ActionTypes.APPLY_MODIFIER, 'run', (state, action) => {
		const modifierKey = action.payload.key;
		const modifierDef = modifierKey && GameConfig.WAVE_MODIFIERS?.[modifierKey];
		const effect = modifierDef?.effect || {};
		return {
			waveModifierKey: modifierKey,
			modifierState: {
				enemySpeedMultiplier: effect.enemySpeedMultiplier ?? 1,
				enemyDamageTakenMultiplier: effect.enemyDamageTakenMultiplier ?? 1,
				playerRegenMultiplier: effect.playerRegenMultiplier ?? 1,
				playerTurnSpeedMultiplier: effect.playerTurnSpeedMultiplier ?? 1,
				visibilityReduction: effect.visibilityReduction ?? false,
			},
		};
	});

	dispatcher.addReducer(ActionTypes.PROGRESSION_RUN_END, 'run', (state, action) => ({
		gameOverTracked: true,
		lastRunResult: action.payload.result || null,
	}));

	// ──────────────────────────────────────────────────────────────────────────
	// PLAYER SLICE
	// ──────────────────────────────────────────────────────────────────────────

	dispatcher.addReducer(ActionTypes.GAME_START, 'player', () => ({
		...playerSlice,
	}));

	dispatcher.addReducer(ActionTypes.PLAYER_DAMAGE, 'player', (state, action) => {
		const damage = action.payload.damage || 0;
		let { hp, shieldHp } = state;

		// Shield absorbs first
		if (shieldHp > 0) {
			const absorbed = Math.min(shieldHp, damage);
			shieldHp -= absorbed;
			const remaining = damage - absorbed;
			if (remaining > 0) {
				hp -= remaining;
			}
		} else {
			hp -= damage;
		}

		return {
			hp: Math.max(0, hp),
			shieldHp: Math.max(0, shieldHp),
		};
	});

	dispatcher.addReducer(ActionTypes.PLAYER_HEAL, 'player', (state, action) => {
		const amount = action.payload.amount || 0;
		return {
			hp: Math.min(state.maxHp, state.hp + amount),
		};
	});

	dispatcher.addReducer(ActionTypes.PLAYER_SYNC_STATS, 'player', (state, action) => {
		// ComputedStats provides the full resolved stats object
		return action.payload.stats || {};
	});

	dispatcher.addReducer(ActionTypes.BUFF_APPLY, 'player', (state, action) => {
		const buff = action.payload.buff;
		if (!buff) return {};
		const newBuffs = [...state.activeBuffs, buff];
		const updates = { activeBuffs: newBuffs };

		// God mode is tracked as a top-level flag
		if (buff.type === 'godMode') {
			updates.godModeActive = true;
		}

		return updates;
	});

	dispatcher.addReducer(ActionTypes.BUFF_REMOVE, 'player', (state, action) => {
		const buffIndex = action.payload.index;
		const removedBuff = state.activeBuffs[buffIndex];
		const newBuffs = state.activeBuffs.filter((_, i) => i !== buffIndex);
		const updates = { activeBuffs: newBuffs };

		// Clear god mode if it was the removed buff
		if (removedBuff?.type === 'godMode') {
			updates.godModeActive = false;
		}

		return updates;
	});

	dispatcher.addReducer(ActionTypes.BUFF_TICK, 'player', (state, action) => {
		const delta = action.payload.delta || 0;
		if (state.activeBuffs.length === 0) return {};

		const newBuffs = [];
		const expired = [];
		for (let i = 0; i < state.activeBuffs.length; i++) {
			const buff = { ...state.activeBuffs[i] };
			buff.remaining -= delta;
			if (buff.remaining > 0) {
				newBuffs.push(buff);
			} else {
				expired.push(buff);
			}
		}

		const updates = { activeBuffs: newBuffs };

		// Clear god mode if it expired
		if (expired.some(b => b.type === 'godMode')) {
			updates.godModeActive = false;
		}

		return updates;
	});

	// ──────────────────────────────────────────────────────────────────────────
	// SKILLS SLICE
	// ──────────────────────────────────────────────────────────────────────────

	dispatcher.addReducer(ActionTypes.XP_ADD, 'skills', (state, action) => {
		const amount = action.payload.amount || 0;
		let xp = state.xp + amount;
		let level = state.level;
		let xpToNextLevel = state.xpToNextLevel;
		let unspentSkillPoints = state.unspentSkillPoints;
		let unspentAttributePoints = state.unspentAttributePoints;
		let pendingLevelUps = state.pendingLevelUps;

		while (xp >= xpToNextLevel) {
			xp -= xpToNextLevel;
			level++;
			xpToNextLevel = LEVEL_CONFIG.getXPForLevel(level);
			unspentSkillPoints += LEVEL_CONFIG.SKILL_POINTS_PER_LEVEL;
			unspentAttributePoints += 3; // ATTRIBUTE_POINTS_PER_LEVEL
			pendingLevelUps++;
		}

		return {
			xp,
			level,
			xpToNextLevel,
			unspentSkillPoints,
			unspentAttributePoints,
			pendingLevelUps,
		};
	});

	dispatcher.addReducer(ActionTypes.SKILL_LEARN, 'skills', (state, action) => {
		const { skillId, archetypeKey, skillType } = action.payload;
		const currentRank = state.skillRanks[skillId] || 0;
		const newRanks = { ...state.skillRanks, [skillId]: currentRank + 1 };
		const newInvestment = { ...state.treeInvestment, [archetypeKey]: (state.treeInvestment[archetypeKey] || 0) + 1 };
		const updates = {
			skillRanks: newRanks,
			treeInvestment: newInvestment,
			unspentSkillPoints: state.unspentSkillPoints - 1,
		};

		// Auto-equip on first rank
		if (currentRank === 0) {
			if (skillType === 'passive') {
				updates.equippedPassives = [...state.equippedPassives, skillId];
			} else if (skillType === 'active') {
				updates.equippedActives = [...state.equippedActives, skillId];
				updates.cooldowns = { ...state.cooldowns, [skillId]: 0 };
			} else if (skillType === 'ultimate') {
				updates.equippedUltimate = skillId;
				updates.cooldowns = { ...state.cooldowns, [skillId]: 0 };
			}
		}

		return updates;
	});

	dispatcher.addReducer(ActionTypes.ATTR_ALLOCATE, 'skills', (state, action) => {
		const { attrKey, amount = 1 } = action.payload;
		const newAttrs = { ...state.attributes, [attrKey]: state.attributes[attrKey] + amount };
		return {
			attributes: newAttrs,
			unspentAttributePoints: state.unspentAttributePoints - amount,
		};
	});

	dispatcher.addReducer(ActionTypes.COOLDOWN_TICK, 'skills', (state, action) => {
		const delta = action.payload.delta || 0;
		const cooldowns = state.cooldowns;
		if (!cooldowns || Object.keys(cooldowns).length === 0) return {};

		const newCooldowns = {};
		let anyChanged = false;
		for (const [id, remaining] of Object.entries(cooldowns)) {
			const newVal = Math.max(0, remaining - delta);
			newCooldowns[id] = newVal;
			if (newVal !== remaining) anyChanged = true;
		}

		return anyChanged ? { cooldowns: newCooldowns } : {};
	});

	dispatcher.addReducer(ActionTypes.SKILL_CAST, 'skills', (state, action) => {
		const { skillId, cooldownMs } = action.payload;
		return {
			cooldowns: { ...state.cooldowns, [skillId]: cooldownMs },
		};
	});

	dispatcher.addReducer(ActionTypes.GAME_START, 'skills', () => ({
		attributes: { STR: 0, DEX: 0, VIT: 0, INT: 0, LUCK: 0 },
		skillRanks: {},
		treeInvestment: {},
		equippedPassives: [],
		equippedActives: [],
		equippedUltimate: null,
		cooldowns: {},
		unspentSkillPoints: 0,
		unspentAttributePoints: 0,
		level: 1,
		xp: 0,
		xpToNextLevel: LEVEL_CONFIG.getXPForLevel(1),
		pendingLevelUps: 0,
	}));

	// ──────────────────────────────────────────────────────────────────────────
	// COMBAT SLICE
	// ──────────────────────────────────────────────────────────────────────────

	dispatcher.addReducer(ActionTypes.COMBO_HIT, 'combat', (state) => {
		const combo = { ...state.combo };
		combo.streak++;
		combo.timer = 0;
		if (combo.streak > combo.maxStreakThisWave) combo.maxStreakThisWave = combo.streak;
		if (combo.streak > combo.maxStreakThisRun) combo.maxStreakThisRun = combo.streak;
		return { combo };
	});

	dispatcher.addReducer(ActionTypes.COMBO_RESET, 'combat', (state) => {
		return {
			combo: {
				...state.combo,
				streak: 0,
				tier: 0,
				timer: 0,
			},
		};
	});

	dispatcher.addReducer(ActionTypes.COMBO_TICK, 'combat', (state, action) => {
		const delta = action.payload.delta || 0;
		if (state.combo.streak === 0) return {};

		const newTimer = state.combo.timer + delta;
		if (newTimer >= 2000) {
			// Combo expired
			return {
				combo: {
					...state.combo,
					streak: 0,
					tier: 0,
					timer: 0,
				},
			};
		}

		return {
			combo: {
				...state.combo,
				timer: newTimer,
			},
		};
	});

	dispatcher.addReducer(ActionTypes.GAME_START, 'combat', () => ({
		combo: {
			streak: 0,
			timer: 0,
			tier: 0,
			maxStreakThisWave: 0,
			maxStreakThisRun: 0,
			totalBonusScore: 0,
		},
		loot: { activeBuffs: [] },
		processedDeathsThisFrame: new Set(),
	}));

	dispatcher.addReducer(ActionTypes.WAVE_COMPLETE, 'combat', (state) => ({
		combo: {
			...state.combo,
			streak: 0,
			tier: 0,
			timer: 0,
			maxStreakThisWave: 0,
		},
	}));

	// ──────────────────────────────────────────────────────────────────────────
	// ENTITIES SLICE
	// ──────────────────────────────────────────────────────────────────────────

	dispatcher.addReducer(ActionTypes.ENEMY_SPAWNED, 'entities', (state) => ({
		enemyCount: state.enemyCount + 1,
	}));

	dispatcher.addReducer(ActionTypes.ENEMY_KILLED, 'entities', (state) => ({
		enemyCount: Math.max(0, state.enemyCount - 1),
	}));

	dispatcher.addReducer(ActionTypes.ENTITY_REMOVED, 'entities', (state, action) => {
		const type = action.payload.type;
		if (type === 'projectile') return { projectileCount: Math.max(0, state.projectileCount - 1) };
		if (type === 'particle') return { particleCount: Math.max(0, state.particleCount - 1) };
		if (type === 'enemy') return { enemyCount: Math.max(0, state.enemyCount - 1) };
		return {};
	});

	dispatcher.addReducer(ActionTypes.GAME_START, 'entities', () => ({
		enemyCount: 0,
		projectileCount: 0,
		particleCount: 0,
	}));

	// ──────────────────────────────────────────────────────────────────────────
	// WAVE SLICE
	// ──────────────────────────────────────────────────────────────────────────

	dispatcher.addReducer(ActionTypes.WAVE_START, 'wave', (state, action) => ({
		current: action.payload.wave,
		enemiesSpawned: 0,
		enemiesKilled: 0,
		enemiesToSpawn: action.payload.enemiesToSpawn || 0,
		spawnTimer: 0,
		spawnInterval: action.payload.spawnInterval || state.spawnInterval,
		scaling: action.payload.scaling || state.scaling,
		isBoss: action.payload.isBoss || false,
		waveActive: true,
		waveComplete: false,
		waveCompletionTimer: 0,
		waveStartTime: performance.now(),
	}));

	dispatcher.addReducer(ActionTypes.WAVE_ENEMY_SPAWNED, 'wave', (state) => ({
		enemiesSpawned: state.enemiesSpawned + 1,
		enemiesToSpawn: Math.max(0, state.enemiesToSpawn - 1),
	}));

	dispatcher.addReducer(ActionTypes.WAVE_ENEMY_KILLED, 'wave', (state) => ({
		enemiesKilled: state.enemiesKilled + 1,
	}));

	dispatcher.addReducer(ActionTypes.WAVE_COMPLETE, 'wave', () => ({
		waveActive: false,
		waveComplete: true,
	}));

	dispatcher.addReducer(ActionTypes.GAME_START, 'wave', () => ({
		current: 0,
		enemiesSpawned: 0,
		enemiesKilled: 0,
		enemiesToSpawn: 0,
		spawnTimer: 0,
		spawnInterval: GameConfig.WAVE.BASE_SPAWN_INTERVAL,
		scaling: { health: 1, speed: 1, damage: 1 },
		isBoss: false,
		waveActive: false,
		waveComplete: false,
		waveCompletionTimer: 0,
		waveStartTime: 0,
	}));

	// ──────────────────────────────────────────────────────────────────────────
	// ASCENSION SLICE
	// ──────────────────────────────────────────────────────────────────────────

	dispatcher.addReducer(ActionTypes.ASCENSION_OFFER, 'ascension', (state, action) => ({
		currentOptions: action.payload.options || [],
		pendingPick: true,
		offeredIds: [...new Set([...state.offeredIds, ...(action.payload.options || []).map(o => o.id)])],
	}));

	dispatcher.addReducer(ActionTypes.ASCENSION_SELECT, 'ascension', (state, action) => {
		const modifier = action.payload.modifier;
		if (!modifier) return {};
		return {
			activeModifiers: [...state.activeModifiers, modifier],
			activeModifierIds: [...state.activeModifierIds, modifier.id],
			pendingPick: false,
			currentOptions: null,
		};
	});

	dispatcher.addReducer(ActionTypes.ASCENSION_RESET, 'ascension', () => ({
		activeModifiers: [],
		activeModifierIds: [],
		offeredIds: [],
		pendingPick: false,
		currentOptions: null,
	}));

	dispatcher.addReducer(ActionTypes.GAME_START, 'ascension', () => ({
		activeModifiers: [],
		activeModifierIds: [],
		offeredIds: [],
		pendingPick: false,
		currentOptions: null,
	}));

	// ──────────────────────────────────────────────────────────────────────────
	// PROGRESSION SLICE
	// ──────────────────────────────────────────────────────────────────────────

	dispatcher.addReducer(ActionTypes.PROGRESSION_WAVE, 'progression', (state, action) => {
		const { wave, isBossWave, tokensEarned = 0 } = action.payload;
		const currencies = { ...state.currencies };
		currencies.LEGACY_TOKENS = (currencies.LEGACY_TOKENS || 0) + tokensEarned;
		return {
			highestWave: Math.max(state.highestWave, wave),
			totalWavesCompleted: state.totalWavesCompleted + 1,
			bossWavesCleared: state.bossWavesCleared + (isBossWave ? 1 : 0),
			currencies,
		};
	});

	dispatcher.addReducer(ActionTypes.PROGRESSION_RUN_END, 'progression', (state, action) => {
		const { wave, score, maxCombo, totalKills } = action.payload;
		const runHistory = [...state.runHistory, { wave, score, date: Date.now() }];
		if (runHistory.length > 10) runHistory.shift();

		return {
			totalRuns: state.totalRuns + 1,
			totalKills: state.totalKills + (totalKills || 0),
			bestWave: Math.max(state.bestWave, wave || 0),
			bestScore: Math.max(state.bestScore, score || 0),
			bestCombo: Math.max(state.bestCombo, maxCombo || 0),
			runHistory,
		};
	});

	dispatcher.addReducer(ActionTypes.CURRENCY_ADD, 'progression', (state, action) => {
		const { currency, amount } = action.payload;
		const currencies = { ...state.currencies };
		currencies[currency] = (currencies[currency] || 0) + (amount || 0);
		return { currencies };
	});

	dispatcher.addReducer(ActionTypes.ACHIEVEMENT_UNLOCK, 'progression', (state, action) => {
		const { achievementId } = action.payload;
		return {
			achievements: { ...state.achievements, [achievementId]: true },
		};
	});

	// ──────────────────────────────────────────────────────────────────────────
	// SETTINGS SLICE
	// ──────────────────────────────────────────────────────────────────────────

	dispatcher.addReducer(ActionTypes.SETTINGS_UPDATE, 'settings', (state, action) => {
		return action.payload.settings || {};
	});
}
