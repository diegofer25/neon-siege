import { Player } from "./Player.js";
import { Particle } from "./Particle.js";
import { Projectile } from "./Projectile.js";
import { GameConfig } from "./config/GameConfig.js";
import { ObjectPool } from "./utils/ObjectPool.js";
import { PerformanceManager } from "./managers/PerformanceManager.js";
import { SkillManager } from "./managers/SkillManager.js";
import { CollisionSystem } from "./systems/CollisionSystem.js";
import { WaveManager } from "./systems/WaveManager.js";
import { EffectsManager } from "./systems/EffectsManager.js";
import { EntityManager } from "./systems/EntityManager.js";
import { ComboSystem } from "./systems/ComboSystem.js";
import { LootSystem } from "./systems/LootSystem.js";
import { AchievementSystem } from "./systems/AchievementSystem.js";
import { ChallengeSystem } from "./systems/ChallengeSystem.js";
import { AscensionSystem } from "./systems/AscensionSystem.js";
import { getMilestoneForWave, isMiniMilestone } from "./config/MilestoneConfig.js";
import { LEVEL_CONFIG } from "./config/SkillConfig.js";
import { GameEventBus } from "./skills/GameEventBus.js";
import { SkillEffectEngine } from "./skills/SkillEffectEngine.js";
import { SKILL_PLUGIN_REGISTRY } from "./skills/registry.js";
import { playSFX } from "./main.js";
import { vfxHelper } from "./managers/VFXHelper.js";
const createFloatingText = vfxHelper.createFloatingText.bind(vfxHelper);
const screenFlash = vfxHelper.screenFlash.bind(vfxHelper);
import { skillUI } from "./ui/SkillUIController.js";
const showLevelUpPanel = () => skillUI.showLevelUpPanel();
const showAscensionPanel = () => skillUI.showAscensionPanel();
const closeAllSkillOverlays = () => skillUI.closeAll();
import { ProgressionManager } from "./managers/ProgressionManager.js";
import { telemetry } from "./managers/TelemetryManager.js";
import { MathUtils } from "./utils/MathUtils.js";

// ── State System ────────────────────────────────────────────────────────────
import { createStateSystem, ActionTypes, GameFSM } from "./state/index.js";
import { syncPlayerStats } from "./state/ComputedStats.js";

const DEFAULT_RUNTIME_SETTINGS = {
	screenShakeEnabled: true,
	performanceModeEnabled: false,
};

const DEFAULT_RUN_DIFFICULTY = "normal";
const RUN_DIFFICULTY_VALUES = new Set(["easy", "normal", "hard"]);

/**
 * Main game class - now focused on coordination between systems rather than direct management.
 *
 * This refactored Game class delegates responsibilities to specialized systems:
 * - CollisionSystem: Handles all collision detection and responses
 * - WaveManager: Manages wave progression and enemy spawning
 * - EffectsManager: Handles visual effects and screen shake
 * - EntityManager: Manages entity lifecycle and updates
 */
export class Game {
	static STATES = {
		MENU: "menu",
		PLAYING: "playing",
		PAUSED: "paused",
		POWERUP: "powerup",        // kept for compatibility; now means "between-wave skill screen"
		LEVELUP: "levelup",        // mid-wave brief pause for skill pick
		ASCENSION: "ascension",    // Ascension pick event (every 10 waves)
		GAMEOVER: "gameover",
		VICTORY: "victory",        // Player completed wave 30
	};

	// ── FSM ↔ Legacy bridge ─────────────────────────────────────────────────
	// Maps legacy gameState strings to FSM states and vice versa.
	// External code that reads `game.gameState` still works via this getter.

	/** @type {Object<string, string>} Legacy state name → FSM state */
	static _LEGACY_TO_FSM = {
		menu: GameFSM.STATES.MENU,
		playing: GameFSM.STATES.PLAYING_ACTIVE,
		paused: GameFSM.STATES.PAUSED,
		powerup: GameFSM.STATES.BETWEEN_WAVES_POWERUP,
		levelup: GameFSM.STATES.PLAYING_MIDWAVE_LEVELUP,
		ascension: GameFSM.STATES.BETWEEN_WAVES_ASCENSION,
		gameover: GameFSM.STATES.GAMEOVER,
		victory: GameFSM.STATES.VICTORY,
	};

	/** @type {Object<string, string>} FSM state → Legacy state name */
	static _FSM_TO_LEGACY = {
		[GameFSM.STATES.MENU]: 'menu',
		[GameFSM.STATES.PLAYING]: 'playing',
		[GameFSM.STATES.PLAYING_COUNTDOWN]: 'playing',
		[GameFSM.STATES.PLAYING_ACTIVE]: 'playing',
		[GameFSM.STATES.PLAYING_MIDWAVE_LEVELUP]: 'levelup',
		[GameFSM.STATES.PAUSED]: 'paused',
		[GameFSM.STATES.BETWEEN_WAVES]: 'powerup',
		[GameFSM.STATES.BETWEEN_WAVES_ASCENSION]: 'ascension',
		[GameFSM.STATES.BETWEEN_WAVES_POWERUP]: 'powerup',
		[GameFSM.STATES.GAMEOVER]: 'gameover',
		[GameFSM.STATES.VICTORY]: 'victory',
	};

	/**
	 * Legacy gameState getter — maps FSM state to old string enum.
	 * @returns {string}
	 */
	get gameState() {
		if (!this.fsm) return this._gameStateLegacy || 'menu';
		return Game._FSM_TO_LEGACY[this.fsm.current] || this._gameStateLegacy || 'menu';
	}

	/**
	 * Legacy gameState setter — maps old string enum to FSM transition.
	 * @param {string} value
	 */
	set gameState(value) {
		this._gameStateLegacy = value;
		if (!this.fsm) return;

		const fsmTarget = Game._LEGACY_TO_FSM[value];
		if (fsmTarget && this.fsm.current !== fsmTarget) {
			// Use forceTransition since legacy code doesn't check allowed transitions
			this.fsm.forceTransition(fsmTarget);
		}
	}

	/**
	 * Creates a new game instance and initializes all subsystems.
	 */
	constructor(canvas, ctx) {
		if (!canvas || !ctx) {
			throw new Error("Canvas and context are required");
		}

		this.canvas = canvas;
		this.ctx = ctx;

		// ── State System (FSM + Store + Dispatcher) ──
		const { store, fsm, dispatcher, snapshot, devTools } = createStateSystem();
		/** @type {import('./state/GameStore.js').GameStore} */
		this.store = store;
		/** @type {import('./state/GameFSM.js').GameFSM} */
		this.fsm = fsm;
		/** @type {import('./state/ActionDispatcher.js').ActionDispatcher} */
		this.dispatcher = dispatcher;
		/** @type {import('./state/SnapshotManager.js').SnapshotManager} */
		this.snapshotManager = snapshot;
		/** @type {import('./state/StateDevTools.js').StateDevTools|null} */
		this.devTools = devTools;

		// Legacy gameState string — reads from FSM for backward compat
		this._gameStateLegacy = Game.STATES.MENU;
		this.fsm.transition(GameFSM.STATES.MENU);

		this._initializeDebugTrace();

		this._initializeEntities();
		this._initializeManagers();
		this._initializeSystems();
		this._initializeGameState();

		this.init();
	}

	_initializeDebugTrace() {
		const params = new URLSearchParams(window.location.search);
		this.traceEnabled = params.get("trace") === "true";
		this._traceSeq = 0;
		this._traceFrame = 0;
		window.__NEON_TRACE_ENABLED__ = this.traceEnabled;
		if (this.traceEnabled) {
			console.info("[TRACE] enabled (?trace=true)");
		}
	}

	trace(event, payload = {}) {
		if (!this.traceEnabled) return;
		this._traceSeq += 1;
		console.log(`[TRACE #${this._traceSeq}] ${event}`, {
			frame: this._traceFrame,
			ts: Math.round(performance.now()),
			...payload,
		});
	}

	/**
	 * Initialize all game entity arrays.
	 * @private
	 */
	_initializeEntities() {
		this.player = null;
		this.enemies = [];
		this.projectiles = [];
		this.particles = [];
	}

	/**
	 * Initialize performance managers and object pools.
	 * @private
	 */
	_initializeManagers() {
		this.performanceManager = new PerformanceManager();
		this.progressionManager = new ProgressionManager();
		this.skillManager = new SkillManager(this.progressionManager);
		this.performanceProfileKey = GameConfig.DERIVED.selectPerformanceProfile();
		this.modifierState = {
			enemySpeedMultiplier: 1,
			enemyDamageTakenMultiplier: 1,
			playerRegenMultiplier: 1,
			playerTurnSpeedMultiplier: 1,
			visibilityReduction: false
		};
		this._initializeObjectPools();
		this.runtimeSettings = { ...DEFAULT_RUNTIME_SETTINGS };
		this.runDifficulty = DEFAULT_RUN_DIFFICULTY;
	}

	/**
	 * Initialize all game systems.
	 * @private
	 */
	_initializeSystems() {
		this.collisionSystem = new CollisionSystem(this);
		this.waveManager = new WaveManager(this);
		this.effectsManager = new EffectsManager(this);
		this.entityManager = new EntityManager(this);
		this.comboSystem = new ComboSystem(this);
		this.lootSystem = new LootSystem(this);
		this.achievementSystem = new AchievementSystem(this);
		this.challengeSystem = new ChallengeSystem(this);
		this.ascensionSystem = new AscensionSystem(this);

		// Skill plugin system
		this.eventBus = new GameEventBus();
		this.skillEffectEngine = new SkillEffectEngine(this.eventBus, this);
		this.skillEffectEngine.registerAll(SKILL_PLUGIN_REGISTRY);

		// Wire engine into SkillManager for auto-notification on skill learn
		this.skillManager._skillEffectEngine = this.skillEffectEngine;
		this.skillManager._dispatcher = this.dispatcher;
	}

	/**
	 * Initialize object pools for high-frequency objects.
	 * @private
	 */
	_initializeObjectPools() {
		this._configurePoolsForProfile(this.performanceProfileKey);
	}

	_configurePoolsForProfile(profileKey) {
		const profile = GameConfig.PERFORMANCE_PROFILES[profileKey] || GameConfig.PERFORMANCE_PROFILES.HIGH;
		this.performanceProfileKey = profileKey;

		this.particlePool = new ObjectPool(
			() => new Particle(0, 0, 0, 0, 0),
			this._resetParticle.bind(this),
			profile.particlePoolSize.initial,
			profile.particlePoolSize.max
		);

		this.projectilePool = new ObjectPool(
			() => new Projectile(0, 0, 0, 0, 1),
			this._resetProjectile.bind(this),
			profile.projectilePoolSize.initial,
			profile.projectilePoolSize.max
		);
	}

	/**
	 * Reset particle properties for object pool reuse.
	 * @private
	 */
	_resetParticle(particle, x, y, vx, vy, life, color) {
		particle.x = x;
		particle.y = y;
		particle.vx = vx;
		particle.vy = vy;
		particle.life = life;
		particle.maxLife = life;
		particle.color = color || "#fff";
		particle.glowColor = color || "#fff";
		particle._destroy = false;
		particle._fromPool = true;
	}

	_resetProjectile(projectile, x, y, angle, damage, speedMod = 1, options = {}) {
		projectile.reset(x, y, angle, damage, speedMod, options);
		projectile._fromPool = true;
	}

	/**
	 * Initialize core game state variables.
	 * @private
	 */
	_initializeGameState() {
		this.wave = 0;
		this.score = 0;
		// XP/level now owned by skillManager; keep accessors for compatibility
		this._waveStartTime = 0;
		this._waveCountdownTimeouts = [];

		/** @type {boolean} DevPanel: draw collision radii overlay */
		this.debugHitboxes = false;
	}

	_clearWaveCountdownTimeouts() {
		for (const timeoutId of this._waveCountdownTimeouts) {
			clearTimeout(timeoutId);
		}
		this._waveCountdownTimeouts = [];
	}

	_setCountdownDisplay(label, isGo = false) {
		const cd = document.querySelector('wave-countdown');
		if (!cd) return;
		cd.setText(label);
		cd.setGo(isGo);
		cd.restartAnimation();
	}

	_runWaveCountdown(onGo) {
		const cd = document.querySelector('wave-countdown');
		if (!cd) {
			onGo();
			return;
		}

		this._clearWaveCountdownTimeouts();
		const sequence = ['3', '2', '1', 'GO'];
		let index = 0;

		cd.show();

		const runStep = () => {
			const current = sequence[index];
			const isGo = current === 'GO';
			this._setCountdownDisplay(current, isGo);

			if (isGo) {
				onGo();
				const hideId = setTimeout(() => cd.hide(), 450);
				this._waveCountdownTimeouts.push(hideId);
				return;
			}

			playSFX('ui_countdown_tick');
			index += 1;
			const nextId = setTimeout(runStep, 1000);
			this._waveCountdownTimeouts.push(nextId);
		};

		runStep();
	}

	// Shop system removed — progression is now skill-based via SkillManager

	/**
	 * Initialize the game world and create the player.
	 */
	init() {
		const { width: logicalWidth, height: logicalHeight } = this.getLogicalCanvasSize();
		
		const centerX = logicalWidth / 2;
		const centerY = logicalHeight / 2;
		this.player = new Player(centerX, centerY);
		this.applyResponsiveEntityScale();

		// Pre-render static background grid to an offscreen canvas
		this._gridCanvas = null;
		this._gridWidth = 0;
		this._gridHeight = 0;
		this._rebuildGridCanvas();

		// Pre-allocate reusable tick payload to avoid per-frame allocation
		this._tickPayload = { delta: 0 };
		// Pre-allocate per-frame dispatch actions to avoid GC churn
		this._cooldownTickAction = { type: ActionTypes.COOLDOWN_TICK, payload: { delta: 0 } };
		this._comboTickAction = { type: ActionTypes.COMBO_TICK, payload: { delta: 0 } };
		this._buffTickAction = { type: ActionTypes.BUFF_TICK, payload: { delta: 0 } };
	}

	getLogicalCanvasSize() {
		return {
			width:
				this.canvas.logicalWidth ||
				parseInt(this.canvas.style.width, 10) ||
				this.canvas.clientWidth ||
				this.canvas.width,
			height:
				this.canvas.logicalHeight ||
				parseInt(this.canvas.style.height, 10) ||
				this.canvas.clientHeight ||
				this.canvas.height,
		};
	}

	getArenaScale() {
		const { width, height } = this.getLogicalCanvasSize();
		const widthScale = width / GameConfig.CANVAS.MAX_WIDTH;
		const heightScale = height / GameConfig.CANVAS.MAX_HEIGHT;
		return Math.max(0.2, Math.min(widthScale, heightScale));
	}

	getEntityScale() {
		return Math.max(0.72, Math.min(this.getArenaScale(), 1.5));
	}

	applyResponsiveEntityScale() {
		const entityScale = this.getEntityScale();
		if (this.player?.baseRadius) {
			this.player.radius = this.player.baseRadius * entityScale;
		}

		this.enemies.forEach((enemy) => {
			enemy.applyResponsiveScale?.(entityScale);
		});
	}

	/**
	 * Start a new game session.
	 */
	start() {
		// Dispatch GAME_START to reset all store slices
		this.dispatcher.dispatch({ type: ActionTypes.GAME_START, payload: {} });

		this.gameState = "playing";
		this.wave = 1;
		this.score = 0;
		this.enemies = [];
		this.projectiles = [];
		this.particles = [];
		this._gameOverTracked = false;
		this._lastRunResult = null;
		this._endlessMode = false;

		this.player.reset();
		this.skillManager.reset();
		this.ascensionSystem.reset();
		this.skillEffectEngine.reset();
		this.eventBus.clear();
		this.applyResponsiveEntityScale();
		this.waveManager.reset();
		this.waveManager.setDifficulty(this.runDifficulty);
		this.comboSystem.resetForRun();
		this.lootSystem.resetForRun();
		this.achievementSystem.resetForRun();
		this.challengeSystem.selectChallenges();

		// Sync player with initial skill/attribute state (via ComputedStats)
		this._syncPlayerFromSkills();

		this._runWaveCountdown(() => {
			this._waveStartTime = performance.now();
			this.challengeSystem.onWaveStart();
			this.waveManager.startWave(this.wave);

			// Dispatch WAVE_START to store
			this.dispatcher.dispatch({
				type: ActionTypes.WAVE_START,
				payload: {
					wave: this.wave,
					enemiesToSpawn: this.waveManager.enemiesToSpawn,
					isBoss: this.waveManager.isBossWave,
				},
			});
		});

		// Dispatch difficulty
		this.dispatcher.dispatch({
			type: ActionTypes.SET_DIFFICULTY,
			payload: { difficulty: this.runDifficulty },
		});

		telemetry.track("run_start", {
			wave: this.wave,
			playerHp: this.player.hp,
			playerMaxHp: this.player.maxHp
		});
	}

	/**
	 * Restart the current game session.
	 */
	restart() {
		this.init();
		this.start();
	}

	/**
	 * Trigger victory after completing the max wave.
	 * Records the run and transitions to the victory state.
	 */
	_triggerVictory() {
		this.gameState = Game.STATES.VICTORY;
		this.trace('victory', {
			wave: this.wave,
			score: this.score,
			level: this.skillManager.level,
		});

		if (!this._gameOverTracked) {
			this._gameOverTracked = true;
			this._lastRunResult = this.progressionManager.recordRunEnd(
				this.wave,
				this.score,
				this.comboSystem.maxStreakThisRun,
				this.achievementSystem.killsThisRun
			);

			this.dispatcher.dispatch({
				type: ActionTypes.PROGRESSION_RUN_END,
				payload: {
					wave: this.wave,
					score: this.score,
					maxCombo: this.comboSystem.maxStreakThisRun,
					totalKills: this.achievementSystem.killsThisRun,
					result: this._lastRunResult,
					victory: true,
				},
			});

			telemetry.track('victory', {
				wave: this.wave,
				score: this.score,
				level: this.skillManager.level,
			});
		}
	}

	/**
	 * Continue to endless mode after victory.
	 * Resets the victory-tracked flag and resumes wave progression.
	 */
	continueToEndless() {
		this._endlessMode = true;
		this._gameOverTracked = false;
		this.wave++;
		this.gameState = 'playing';

		telemetry.track('endless_start', {
			wave: this.wave,
			score: this.score,
		});

		this._runWaveCountdown(() => {
			this._waveStartTime = performance.now();
			this.challengeSystem.onWaveStart();
			this.waveManager.startWave(this.wave);

			this.dispatcher.dispatch({
				type: ActionTypes.WAVE_START,
				payload: {
					wave: this.wave,
					enemiesToSpawn: this.waveManager.enemiesToSpawn,
					isBoss: this.waveManager.isBossWave,
				},
			});
		});
	}

	setRunDifficulty(difficulty = DEFAULT_RUN_DIFFICULTY) {
		const normalizedDifficulty = RUN_DIFFICULTY_VALUES.has(difficulty)
			? difficulty
			: DEFAULT_RUN_DIFFICULTY;
		this.runDifficulty = normalizedDifficulty;
		this.waveManager.setDifficulty(this.runDifficulty);
	}

	getRunDifficulty() {
		return this.runDifficulty;
	}

	setRuntimeSettings(settings = {}) {
		this.runtimeSettings = {
			...this.runtimeSettings,
			...settings,
		};
	}

	/**
	 * Pause the game and preserve current state.
	 */
	pause() {
		this.gameState = "paused";
		// Clear particles to prevent visual artifacts when resuming
		this.particles = [];
		// Clear any pooled particles
		this.particlePool.clear();
	}

	/**
	 * Resume the game from paused state.
	 */
	resume() {
		this.gameState = "playing";
	}

	/**
	 * Update canvas-dependent positions when canvas size changes.
	 */
	updateCanvasSize(previousSize = null) {
		const { width: logicalWidth, height: logicalHeight } = this.getLogicalCanvasSize();
		const prevWidth = previousSize?.width || logicalWidth;
		const prevHeight = previousSize?.height || logicalHeight;
		
		const centerX = logicalWidth / 2;
		const centerY = logicalHeight / 2;

		if (this.player) {
			// Scale player position proportionally to new canvas size
			this.player.x = (this.player.x / prevWidth) * logicalWidth;
			this.player.y = (this.player.y / prevHeight) * logicalHeight;
			// Clamp to canvas bounds
			this.player.x = Math.max(this.player.radius, Math.min(logicalWidth - this.player.radius, this.player.x));
			this.player.y = Math.max(this.player.radius, Math.min(logicalHeight - this.player.radius, this.player.y));
		}

		this.applyResponsiveEntityScale();

		// Preserve enemy relative placement when canvas dimensions change.
		this.enemies.forEach((enemy) => {
			enemy.x = (enemy.x / prevWidth) * logicalWidth;
			enemy.y = (enemy.y / prevHeight) * logicalHeight;

			const distance = MathUtils.distance(enemy.x, enemy.y, centerX, centerY);
			const maxDistance =
				Math.max(logicalWidth, logicalHeight) / 2 + GameConfig.ENEMY.SPAWN_MARGIN;

			if (distance > maxDistance) {
				const angle = MathUtils.angleBetween(centerX, centerY, enemy.x, enemy.y);
				enemy.x = centerX + Math.cos(angle) * maxDistance;
				enemy.y = centerY + Math.sin(angle) * maxDistance;
			}
		});

		this.projectiles = this.projectiles.filter((proj) => {
			proj.x = (proj.x / prevWidth) * logicalWidth;
			proj.y = (proj.y / prevHeight) * logicalHeight;
			return (
				proj.x >= 0 &&
				proj.x <= logicalWidth &&
				proj.y >= 0 &&
				proj.y <= logicalHeight
			);
		});
	}

	/**
	 * Main game update loop - now delegates to specialized systems.
	 */
	update(delta, input) {
		this._lastDelta = delta;
		// Always update effects manager for visual feedback (e.g. screen shake during level up)
		this.effectsManager.update(delta);

		if (this.gameState !== "playing") return;
		this._traceFrame += 1;

		// PerformanceManager is updated by the outer game loop in js/main.js
		const avgFps = this.performanceManager.getAverageFps();
		const targetProfile = GameConfig.DERIVED.selectPerformanceProfile(avgFps);
		if (targetProfile !== this.performanceProfileKey) {
			this._configurePoolsForProfile(targetProfile);
		}

		// Update skill cooldowns
		this.skillManager.updateCooldowns(delta);

		// Dispatch cooldown tick to store (reuse pre-allocated action)
		this._cooldownTickAction.payload.delta = delta;
		this.dispatcher.dispatch(this._cooldownTickAction);

		// Update all game systems
		this.waveManager.update(delta);
		this.entityManager.updateAll(delta, input);
		this.comboSystem.update(delta);
		this.lootSystem.update(delta);
		this.achievementSystem.update(delta);

		// Dispatch combo and buff ticks (reuse pre-allocated actions)
		this._comboTickAction.payload.delta = delta;
		this.dispatcher.dispatch(this._comboTickAction);
		this._buffTickAction.payload.delta = delta;
		this.dispatcher.dispatch(this._buffTickAction);

		// Handle collisions
		this.collisionSystem.checkAllCollisions();

		// Emit per-frame tick event for skill plugins (reuse payload object)
		this._tickPayload.delta = delta;
		this.eventBus.emit('tick', this._tickPayload);

		// Check game over
		if (this.player.hp <= 0) {
			this.gameState = "gameover";
			this.trace("gameover", {
				wave: this.wave,
				score: this.score,
				level: this.skillManager.level,
			});
			if (!this._gameOverTracked) {
				this._gameOverTracked = true;
				this._lastRunResult = this.progressionManager.recordRunEnd(
					this.wave,
					this.score,
					this.comboSystem.maxStreakThisRun,
					this.achievementSystem.killsThisRun
				);

				// Dispatch run end to store
				this.dispatcher.dispatch({
					type: ActionTypes.PROGRESSION_RUN_END,
					payload: {
						wave: this.wave,
						score: this.score,
						maxCombo: this.comboSystem.maxStreakThisRun,
						totalKills: this.achievementSystem.killsThisRun,
						result: this._lastRunResult,
					},
				});

				telemetry.track("game_over", {
					wave: this.wave,
					score: this.score,
					level: this.skillManager.level,
				});
			}
		}
	}

	/**
	 * Handle wave completion logic — skill-based progression (no shop).
	 */
	completeWave() {
		this.trace("wave.complete", {
			wave: this.wave,
			enemiesRemaining: this.enemies.length,
			enemiesKilled: this.waveManager.enemiesKilled,
			enemiesSpawned: this.waveManager.enemiesSpawned,
			enemiesToSpawn: this.waveManager.enemiesToSpawn,
		});

		playSFX("wave_complete");
		this.progressionManager.recordWaveCompletion(this.wave, this.waveManager.isBossWave);

		// Wave completion score bonus
		const completionTime = performance.now() - this._waveStartTime;
		const waveClearBonus = 100 * this.wave;
		const speedBonus = completionTime < 30000 ? 200 : (completionTime < 60000 ? 100 : 0);
		const perfectBonus = (this.player.hp === this.player.maxHp) ? 300 : 0;
		const totalBonus = waveClearBonus + speedBonus + perfectBonus;
		this.score += totalBonus;

		// Dispatch score and wave completion to store
		this.dispatcher.dispatch({ type: ActionTypes.SCORE_ADD, payload: { amount: totalBonus } });
		this.dispatcher.dispatch({
			type: ActionTypes.WAVE_COMPLETE,
			payload: { wave: this.wave },
		});
		this.dispatcher.dispatch({
			type: ActionTypes.PROGRESSION_WAVE,
			payload: {
				wave: this.wave,
				isBossWave: this.waveManager.isBossWave,
				tokensEarned: 0,
			},
		});

		// XP for wave clear (via SkillManager — xpMultiplier applied inside addXP)
		const xpAmount = LEVEL_CONFIG.XP_PER_WAVE_CLEAR_BASE + this.wave * LEVEL_CONFIG.XP_PER_WAVE_CLEAR_SCALING;
		this.addXP(xpAmount);

		// Milestone celebrations
		const milestone = getMilestoneForWave(this.wave);
		if (milestone) {
			const { width, height } = this.getLogicalCanvasSize();
			screenFlash();
			this.effectsManager.addScreenShake(12, 500);
			createFloatingText(milestone.label, width / 2, height / 2 - 40, 'milestone-major');
			this.progressionManager._incrementCurrency('LEGACY_TOKENS', milestone.bonusTokens);
			this.progressionManager._saveState();
			this.addXP(milestone.bonusXP);

			// Dispatch milestone tokens to store
			this.dispatcher.dispatch({
				type: ActionTypes.CURRENCY_ADD,
				payload: { currency: 'LEGACY_TOKENS', amount: milestone.bonusTokens },
			});

			playSFX('boss_defeat');
		} else if (isMiniMilestone(this.wave)) {
			const { width, height } = this.getLogicalCanvasSize();
			createFloatingText(`WAVE ${this.wave} CLEAR!`, width / 2, height / 2 - 40, 'milestone-minor');
		}

		// Reset combo for new wave, notify subsystems
		this.comboSystem.resetForWave();
		this.challengeSystem.onWaveComplete();
		this.achievementSystem.onWaveComplete();

		// Emit wave:completed event for skill plugins
		this.eventBus.emit('wave:completed', { wave: this.wave });

		telemetry.track("wave_complete", {
			wave: this.wave,
			score: this.score,
			level: this.skillManager.level,
			remainingHp: this.player.hp,
			isBossWave: this.waveManager.isBossWave
		});

		// Decide what UI to show between waves
		this._showBetweenWaveUI();
	}

	/**
	 * Determine the right between-wave screen to show.
	 * Priority: Ascension > Skill allocation.
	 * @private
	 */
	_showBetweenWaveUI() {
		// Ascension event every 10 waves
		if (this.ascensionSystem.isAscensionWave(this.wave)) {
			this.gameState = Game.STATES.ASCENSION;
			showAscensionPanel();
			return;
		}

		// Default: skill allocation screen (between-wave)
		this.gameState = Game.STATES.POWERUP;
		showLevelUpPanel();
	}

	/**
	 * Continue to the next wave after between-wave skill allocation.
	 */
	continueToNextWave() {
		closeAllSkillOverlays();
		// Sync player stats from skill tree before next wave
		this._syncPlayerFromSkills();

		// Victory condition: if we just completed the max wave, show victory screen
		const maxWave = GameConfig.BOSS.MAX_WAVE;
		if (this.wave >= maxWave && !this._endlessMode) {
			this._triggerVictory();
			return;
		}

		this.wave++;
		this.gameState = "playing";

		telemetry.track("wave_start", {
			wave: this.wave,
			playerHp: this.player.hp,
			level: this.skillManager.level,
		});

		this._runWaveCountdown(() => {
			this._waveStartTime = performance.now();
			this.challengeSystem.onWaveStart();
			this.waveManager.startWave(this.wave);

			// Dispatch WAVE_START to store
			this.dispatcher.dispatch({
				type: ActionTypes.WAVE_START,
				payload: {
					wave: this.wave,
					enemiesToSpawn: this.waveManager.enemiesToSpawn,
					isBoss: this.waveManager.isBossWave,
				},
			});
		});
	}

	/**
	 * Cast an active/ultimate skill — triggers cooldown and executes the gameplay effect.
	 * Called from keybind handler in main.js.
	 * All active/ultimate skills are now handled by their plugin's onCast() method.
	 * @param {string} skillId
	 * @returns {boolean} true if cast succeeded
	 */
	castActiveSkill(skillId) {
		if (!this.skillManager.tryCast(skillId)) return false;

		const info = this.skillManager.getActiveSkillInfo(skillId);
		if (!info) return false;

		const { skill, rank } = info;

		// Dispatch to plugin — all active/ultimate skills are registered plugins
		this.skillEffectEngine.castSkill(skill.id, { skill, rank });
		return true;
	}

	/**
	 * Create a visual lightning line effect between two points.
	 * Used by LightningCascadePlugin for chain lightning visuals.
	 * @param {{x: number, y: number}} from
	 * @param {{x: number, y: number}} to
	 */
	_createLightningEffect(from, to) {
		// Use particles to simulate lightning along the path
		const segments = 6;
		for (let i = 0; i <= segments; i++) {
			const t = i / segments;
			const x = from.x + (to.x - from.x) * t + (Math.random() - 0.5) * 15;
			const y = from.y + (to.y - from.y) * t + (Math.random() - 0.5) * 15;
			this.particles.push(new Particle(x, y, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, 300 + Math.random() * 200, '#aa44ff'));
		}
	}

	/**
	 * Sync player stats from SkillManager attributes + plugin effects + ascension.
	 * Called after each skill/attribute allocation.
	 */
	_syncPlayerFromSkills() {
		const attrs = this.skillManager.getComputedAttributes();
		const context = { attrs };

		// Gather plugin-based modifiers (declarative stat bonuses from all equipped skills + ascension)
		const pluginMods = this.skillEffectEngine.getAggregatedModifiers(context);

		// ── Base stats from attributes + plugin pipeline (replaces manual ascension aggregation) ──
		const baseHp = GameConfig.PLAYER.BASE_HP;
		const newMaxHp = Math.floor(
			this.skillEffectEngine.resolveStatValue('maxHp', baseHp + attrs.maxHpBonus, pluginMods)
		);
		const hpRatio = this.player.maxHp > 0 ? this.player.hp / this.player.maxHp : 1;
		this.player.maxHp = newMaxHp;
		this.player.hp = Math.min(newMaxHp, Math.ceil(newMaxHp * hpRatio));

		// Shield from attributes
		this.player.maxShieldHp = attrs.shieldCapacity;
		if (attrs.shieldCapacity > 0) {
			this.player.hasShield = true;
			this.player.shieldHp = Math.min(this.player.shieldHp, this.player.maxShieldHp);
		}

		// Regen from attributes + plugin pipeline
		this.player.hpRegen = this.skillEffectEngine.resolveStatValue('hpRegen', attrs.hpRegen, pluginMods);
		this.player.shieldRegen = attrs.shieldCapacity > 0 ? attrs.shieldCapacity * 0.05 : 0;

		// ── Combat stats via plugin modifier pipeline ──
		const baseDamage = attrs.damageMultiplier;
		this.player.damageMod = this.skillEffectEngine.resolveStatValue('damage', baseDamage, pluginMods);

		this.player.fireRateMod = this.skillEffectEngine.resolveStatValue('fireRate', attrs.fireRateMultiplier, pluginMods);
		this.player.rotationSpeedMod = this.skillEffectEngine.resolveStatValue('rotationSpeed', attrs.turnSpeedMultiplier, pluginMods);
		this.player.projectileSpeedMod = this.skillEffectEngine.resolveStatValue('projectileSpeed', attrs.projectileSpeedMultiplier, pluginMods);
		this.player.moveSpeedMod = this.skillEffectEngine.resolveStatValue('moveSpeed', attrs.moveSpeedMultiplier, pluginMods);

		// Pierce and homing from modifiers
		this.player.piercingLevel = Math.round(this.skillEffectEngine.resolveStatValue('pierceCount', 0, pluginMods));
		this.player.hasHomingShots = this.skillEffectEngine.resolveStatValue('homingStrength', 0, pluginMods) > 0;

		// Crit from LUCK attribute + plugin modifiers (CriticalMasteryPlugin)
		const critFromPlugins = this.skillEffectEngine.resolveStatValue('critChance', 0, pluginMods);
		const totalCrit = Math.min(0.60, attrs.critChance + critFromPlugins);
		if (totalCrit > 0) {
			const critDmgMult = this.skillEffectEngine.resolveStatValue('critDamageMultiplier', 1.0, pluginMods);
			this.player.luckyShots = {
				chance: totalCrit,
				active: true,
				critDamageMultiplier: critDmgMult,
			};
		} else {
			this.player.luckyShots = null;
		}

		// Explosive shots from plugin modifiers (ExplosiveRoundsPlugin + BiggerBoomsPlugin)
		const explosionRadius = this.skillEffectEngine.resolveStatValue('explosionRadius', 0, pluginMods);

		// ── Reset complex configs before applying plugin configs ──
		this.player.hasTripleShot = false;
		this.player.tripleShotSideDamage = 0;
		this.player.explosiveShots = false;
		this.player.overchargeBurst = null;
		this.player.immolationAura = null;
		this.player.chainHit = null;
		this.player.volatileKills = null;
		this.player.elementalSynergy = null;
		this.player.meltdown = null;
		// Reset ascension config fields (set by plugins via getPlayerConfig)
		this.player.ricochetEnabled = false;
		this.player.globalEnemySlow = 0;
		this.player.berserker = null;

		// Apply complex configs from plugins (TripleShot, Overcharge, Burn, ChainHit, etc.)
		context.pluginMods = pluginMods;
		const pluginConfigs = this.skillEffectEngine.getPlayerConfigs(context);
		for (const { config } of pluginConfigs) {
			for (const [key, value] of Object.entries(config)) {
				this.player[key] = value;
			}
		}

		// Finalize explosion values after configs set explosiveShots flag
		if (this.player.explosiveShots && explosionRadius > 0) {
			this.player.explosionRadius = explosionRadius * attrs.aoeRadiusMultiplier;
			const explosionDmgRatio = this.skillEffectEngine.resolveStatValue('explosionDamageRatio', 0, pluginMods);
			this.player.explosionDamage = GameConfig.PLAYER.BASE_DAMAGE * this.player.damageMod * explosionDmgRatio;
		}

		// Life steal handled by LifeStealPlugin via enemy:killed event
		this.player.hasLifeSteal = false;
		this.player._ascensionLifeSteal = 0;

		// ── Resolve ascension pipeline stats for runtime consumption ──
		this.player._damageTakenMultiplier = this.skillEffectEngine.resolveStatValue('damageTaken', 1, pluginMods);
		this.player._damageReduction = this.skillEffectEngine.resolveStatValue('damageReduction', 0, pluginMods);
		this.player._cooldownMultiplier = this.skillEffectEngine.resolveStatValue('cooldownMultiplier', 1, pluginMods);
		this.player._scoreMultiplier = this.skillEffectEngine.resolveStatValue('scoreMultiplier', 1, pluginMods);
		this.player._lootChanceMultiplier = this.skillEffectEngine.resolveStatValue('lootChanceMultiplier', 1, pluginMods);
		this.player._xpMultiplier = this.skillEffectEngine.resolveStatValue('xpMultiplier', 1, pluginMods);

		// Propagate cooldown multiplier to SkillManager for active skill cooldowns
		this.skillManager._ascensionCooldownMultiplier = this.player._cooldownMultiplier;

		// Store plugin modifiers on player for systems that read them
		this.player._ascensionEffects = null;

		// ── Visual state for player auras / VFX ──
		const rawAttrs = this.skillManager.attributes;
		this.player.visualState.strLevel = rawAttrs.STR || 0;
		this.player.visualState.dexLevel = rawAttrs.DEX || 0;
		this.player.visualState.vitLevel = rawAttrs.VIT || 0;
		this.player.visualState.intLevel = rawAttrs.INT || 0;
		this.player.visualState.luckLevel = rawAttrs.LUCK || 0;
		this.player.visualState.learnedSkills = new Set(this.skillManager.equippedPassives);
		for (const id of Object.keys(this.skillManager.skillRanks)) {
			if (this.skillManager.skillRanks[id] > 0) {
				this.player.visualState.learnedSkills.add(id);
			}
		}

		// Emit stats:sync event for plugins that need to react to stat changes
		this.eventBus.emit('stats:sync', { player: this.player, attrs });

		// Mirror computed stats to the store (dual-write)
		syncPlayerStats(this.store, this.dispatcher, this.skillEffectEngine, this.player);
	}

	/**
	 * Re-equip all plugins from current SkillManager + AscensionSystem state.
	 * Used after restoring from save or on any full re-sync.
	 * @private
	 */
	_reequipPluginsFromState() {
		this.skillEffectEngine.reset();
		this.eventBus.clear();

		// Re-equip skill plugins
		const allEquipped = [
			...this.skillManager.equippedPassives,
			...this.skillManager.equippedActives,
		];
		if (this.skillManager.equippedUltimate) {
			allEquipped.push(this.skillManager.equippedUltimate);
		}
		for (const skillId of allEquipped) {
			const rank = this.skillManager.skillRanks[skillId] || 0;
			if (rank < 1) continue;
			const { skill } = this.skillManager._findSkill(skillId);
			if (skill) {
				this.skillEffectEngine.equipSkill(skillId, rank, skill);
			}
		}

		// Re-equip ascension plugins
		for (const mod of this.ascensionSystem.activeModifiers) {
			if (this.skillEffectEngine.hasPlugin(mod.id)) {
				this.skillEffectEngine.equipSkill(mod.id, 1, mod);
			}
		}
	}

	/**
	 * Handle ascension modifier selection (called from UI).
	 * @param {string} modifierId
	 */
	selectAscension(modifierId) {
		if (this.ascensionSystem.selectModifier(modifierId)) {
			// Equip ascension plugin if registered
			const mod = this.ascensionSystem.activeModifiers.find(m => m.id === modifierId);
			if (mod && this.skillEffectEngine.hasPlugin(modifierId)) {
				this.skillEffectEngine.equipSkill(modifierId, 1, mod);
			}

			// Dispatch to store
			this.dispatcher.dispatch({
				type: ActionTypes.ASCENSION_SELECT,
				payload: { modifier: mod },
			});

			this._syncPlayerFromSkills();
			telemetry.track('ascension_picked', { modifierId, wave: this.wave });

			// Continue to skill allocation
			this.gameState = Game.STATES.POWERUP;
			showLevelUpPanel();
		}
	}

	/**
	 * Handle mid-wave level-up: brief pause, show quick pick, resume.
	 * @private
	 */
	_triggerMidWaveLevelUp() {
		if (this.gameState !== Game.STATES.PLAYING) return;
		if (this.skillManager.pendingLevelUps <= 0) return;

		this.gameState = Game.STATES.LEVELUP;
		showLevelUpPanel();
	}

	/**
	 * Complete a mid-wave level-up pick and resume play.
	 */
	completeMidWaveLevelUp() {
		this.skillManager.pendingLevelUps = Math.max(0, this.skillManager.pendingLevelUps - 1);
		this._syncPlayerFromSkills();

		// If more level-ups pending, stay in LEVELUP state
		if (this.skillManager.pendingLevelUps > 0) {
			showLevelUpPanel();
			return;
		}

		closeAllSkillOverlays();
		this.gameState = Game.STATES.PLAYING;
	}

	addXP(amount) {
		// Apply ascension XP multiplier to all XP sources
		const multiplied = Math.floor(amount * (this.player?._xpMultiplier || 1));
		const levelsGained = this.skillManager.addXP(multiplied);

		// Mirror XP to store
		this.dispatcher.dispatch({ type: ActionTypes.XP_ADD, payload: { amount: multiplied } });

		for (let i = 0; i < levelsGained; i++) {
			this._onLevelUp();
		}
	}

	_onLevelUp() {
		const { width, height } = this.getLogicalCanvasSize();
		createFloatingText(`LEVEL ${this.skillManager.level}!`, width / 2, height / 2, 'level-up');
		this.effectsManager.addScreenShake(5, 200);
		playSFX('ui_purchase_success');

		telemetry.track('level_up', {
			level: this.skillManager.level,
			wave: this.wave,
			unspentSkillPoints: this.skillManager.unspentSkillPoints,
			unspentAttributePoints: this.skillManager.unspentAttributePoints,
		});
	}

	/** Convenience getters for backward compatibility */
	get level() { return this.skillManager?.level ?? 1; }
	get xp() { return this.skillManager?.xp ?? 0; }
	get xpToNextLevel() { return this.skillManager?.xpToNextLevel ?? 50; }

	getActiveParticleLimit() {
		const profile = GameConfig.PERFORMANCE_PROFILES[this.performanceProfileKey] || GameConfig.PERFORMANCE_PROFILES.HIGH;
		return profile.particleLimit;
	}

	applyWaveModifier(modifierKey) {
		const previousVisibility = this.modifierState.visibilityReduction;
		this.modifierState = {
			enemySpeedMultiplier: 1,
			enemyDamageTakenMultiplier: 1,
			playerRegenMultiplier: 1,
			playerTurnSpeedMultiplier: 1,
			visibilityReduction: false
		};
		this.waveModifierKey = modifierKey;
		if (modifierKey && GameConfig.WAVE_MODIFIERS[modifierKey]) {
			Object.assign(this.modifierState, GameConfig.WAVE_MODIFIERS[modifierKey].effect);
		}

		// Dispatch modifier to store
		this.dispatcher.dispatch({
			type: ActionTypes.APPLY_MODIFIER,
			payload: { key: modifierKey },
		});

		if (this.player) {
			this.player.setExternalModifiers({
				regenMultiplier: this.modifierState.playerRegenMultiplier,
				turnSpeedMultiplier: this.modifierState.playerTurnSpeedMultiplier
			});
		}

		if (this.modifierState.visibilityReduction !== previousVisibility) {
			const container = document.getElementById('gameContainer');
			if (container) {
				container.classList.toggle('modifier-fog', this.modifierState.visibilityReduction);
			}
		}
	}

	getEnemyDamageTakenMultiplier() {
		return this.modifierState.enemyDamageTakenMultiplier || 1;
	}

	// Delegate methods to effects manager
	addScreenShake(intensity, duration) {
		this.effectsManager.addScreenShake(intensity, duration);
	}

	createExplosion(x, y, particleCount = 8) {
		this.effectsManager.createExplosion(x, y, particleCount);
	}

	createExplosionRing(x, y, radius) {
		this.effectsManager.createExplosionRing(x, y, radius);
	}

	/**
	 * Render all game elements to the canvas.
	 */
	render() {
		const ctx = this.ctx;
		const canvasWidth = this.canvas.logicalWidth || this.canvas.width;
		const canvasHeight = this.canvas.logicalHeight || this.canvas.height;

		ctx.clearRect(0, 0, canvasWidth, canvasHeight);

		// Apply screen shake from effects manager
		ctx.save();
		ctx.translate(
			this.effectsManager.screenShake.offsetX,
			this.effectsManager.screenShake.offsetY
		);

		this.drawBackground();

		// Draw entities — indexed for-loops avoid closure/iterator overhead
		// Particles: batch save/restore (individual particles no longer save/restore)
		ctx.save();
		for (let i = 0; i < this.particles.length; i++) this.particles[i].draw(ctx);
		ctx.restore();

		for (let i = 0; i < this.enemies.length; i++) this.enemies[i].draw(ctx);
		for (let i = 0; i < this.projectiles.length; i++) this.projectiles[i].draw(ctx);
		this.player.draw(ctx);

		// Draw spawn warning if enemies are incoming
		if (this.waveManager.enemiesToSpawn > 0) {
			this.drawSpawnWarning(ctx);
		}

		// Debug hitbox overlay (toggled via DevPanel)
		if (this.debugHitboxes) {
			this._drawHitboxes(ctx);
		}

		ctx.restore();

		// Canvas-based screen flash overlay (replaces DOM flash element)
		vfxHelper.renderFlash(ctx, canvasWidth, canvasHeight, this._lastDelta || 0.016);
	}

	/**
	 * Draw collision radii for all entities (debug overlay).
	 * @param {CanvasRenderingContext2D} ctx
	 */
	_drawHitboxes(ctx) {
		ctx.save();
		ctx.lineWidth = 1;

		// Player — green
		if (this.player) {
			ctx.strokeStyle = '#0f0';
			ctx.beginPath();
			ctx.arc(this.player.x, this.player.y, this.player.radius, 0, Math.PI * 2);
			ctx.stroke();
		}

		// Enemies — red
		ctx.strokeStyle = '#f44';
		for (const e of this.enemies) {
			ctx.beginPath();
			ctx.arc(e.x, e.y, e.radius || e.size || 10, 0, Math.PI * 2);
			ctx.stroke();
		}

		// Projectiles — cyan
		ctx.strokeStyle = '#0ff';
		for (const p of this.projectiles) {
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.radius || 4, 0, Math.PI * 2);
			ctx.stroke();
		}

		ctx.restore();
	}

	/**
	 * Rebuild the offscreen grid canvas (call on init and resize).
	 * @private
	 */
	_rebuildGridCanvas() {
		const canvasWidth = this.canvas.logicalWidth || this.canvas.width;
		const canvasHeight = this.canvas.logicalHeight || this.canvas.height;

		// Skip rebuild if dimensions haven't changed
		if (this._gridCanvas && this._gridWidth === canvasWidth && this._gridHeight === canvasHeight) {
			return;
		}

		this._gridWidth = canvasWidth;
		this._gridHeight = canvasHeight;

		if (!this._gridCanvas) {
			this._gridCanvas = document.createElement('canvas');
		}
		this._gridCanvas.width = canvasWidth;
		this._gridCanvas.height = canvasHeight;

		const gctx = this._gridCanvas.getContext('2d');
		const gridSize = GameConfig.VFX.GRID_SIZE;

		gctx.strokeStyle = `rgba(0, 255, 255, ${GameConfig.VFX.GRID_ALPHA})`;
		gctx.lineWidth = 1;

		// Batch all grid lines into a single path + single stroke
		gctx.beginPath();
		for (let x = 0; x < canvasWidth; x += gridSize) {
			gctx.moveTo(x, 0);
			gctx.lineTo(x, canvasHeight);
		}
		for (let y = 0; y < canvasHeight; y += gridSize) {
			gctx.moveTo(0, y);
			gctx.lineTo(canvasWidth, y);
		}
		gctx.stroke();
	}

	/**
	 * Draw the background neon grid effect (single drawImage blit).
	 */
	drawBackground() {
		const canvasWidth = this.canvas.logicalWidth || this.canvas.width;
		const canvasHeight = this.canvas.logicalHeight || this.canvas.height;

		// Rebuild grid if canvas was resized
		if (this._gridWidth !== canvasWidth || this._gridHeight !== canvasHeight) {
			this._rebuildGridCanvas();
		}

		if (this._gridCanvas) {
			this.ctx.drawImage(this._gridCanvas, 0, 0);
		}
	}

	/**
	 * Draw visual warning when enemies are about to spawn.
	 */
	drawSpawnWarning(ctx) {
		const canvasWidth = this.canvas.logicalWidth || this.canvas.width;
		const canvasHeight = this.canvas.logicalHeight || this.canvas.height;
		const pulseIntensity = 0.5 + 0.5 * Math.sin(Date.now() / 200);
		const warningColor = `rgba(255, 165, 0, ${pulseIntensity * 0.3})`;

		ctx.strokeStyle = warningColor;
		ctx.lineWidth = 4;
		ctx.setLineDash([10, 10]);

		const margin = 20;
		ctx.strokeRect(
			margin,
			margin,
			canvasWidth - margin * 2,
			canvasHeight - margin * 2
		);

		ctx.setLineDash([]); // Reset line dash
	}

	/**
	 * Get current wave's enemy spawn progress for HUD display.
	 * @returns {{enemiesSpawned: number, enemiesToSpawn: number, totalEnemies: number}}
	 */
	getWaveProgress() {
		const enemiesSpawned = this.waveManager.enemiesSpawned || 0;
		const enemiesToSpawn = this.waveManager.enemiesToSpawn || 0;
		const totalEnemies = enemiesSpawned + enemiesToSpawn;

		return {
			enemiesSpawned,
			enemiesToSpawn,
			totalEnemies,
		};
	}

	canSaveCurrentRun() {
		return this.gameState === Game.STATES.PLAYING || this.gameState === Game.STATES.PAUSED;
	}

	getSaveSnapshot() {
		// Prefer SnapshotManager for full state capture
		const snapshot = this.snapshotManager.capture({
			player: this.player,
			enemies: this.enemies,
			projectiles: this.projectiles,
			ascensionSystem: this.ascensionSystem,
			skillEffectEngine: this.skillEffectEngine,
		});

		// Also include legacy fields for dual-format compatibility
		if (snapshot) {
			snapshot.legacyCompat = {
				gameState: this.gameState,
				difficulty: this.runDifficulty,
				wave: this.wave,
				checkpointWave: Math.max(1, this.wave),
				score: this.score,
				modifierKey: this.waveModifierKey || null,
				player: this._getPlayerSaveState(),
				waveState: this.waveManager.getSaveSnapshot(),
				skillManager: this.skillManager.getSaveState(),
				ascensionSystem: this.ascensionSystem.getSaveState(),
			};
		}

		return snapshot || {
			gameState: this.gameState,
			difficulty: this.runDifficulty,
			wave: this.wave,
			checkpointWave: Math.max(1, this.wave),
			score: this.score,
			modifierKey: this.waveModifierKey || null,
			player: this._getPlayerSaveState(),
			waveState: this.waveManager.getSaveSnapshot(),
			skillManager: this.skillManager.getSaveState(),
			ascensionSystem: this.ascensionSystem.getSaveState(),
		};
	}

	restoreFromSave(snapshot) {
		if (!snapshot || typeof snapshot !== "object") {
			return false;
		}

		// If this is a v3 SnapshotManager format, restore store directly
		if (snapshot.version >= 3 && snapshot.store) {
			const restoreResult = this.snapshotManager.restore(snapshot, this.ascensionSystem);
			if (!restoreResult) return false;
		}

		// Fall back to legacy fields for v1/v2 saves
		const legacy = snapshot.legacyCompat || snapshot;
		const checkpointWave = Math.max(1, legacy.checkpointWave || legacy.wave || 1);

		this.enemies = [];
		this.projectiles = [];
		this.particles = [];
		this.particlePool.clear();
		this.projectilePool.clear();

		this.player.reset();

		// Restore skill & ascension state first, then sync player stats
		if (legacy.skillManager) {
			this.skillManager.restoreFromSave(legacy.skillManager);
		}
		if (legacy.ascensionSystem) {
			this.ascensionSystem.restoreFromSave(legacy.ascensionSystem);
		}
		// Re-equip plugins for restored skills
		this._reequipPluginsFromState();
		this._syncPlayerFromSkills();

		// Overlay HP/shield from snapshot (player may have taken damage before save)
		if (legacy.player) {
			this._applyPlayerSaveState(legacy.player);
		}

		this.wave = checkpointWave;
		this.score = legacy.score || 0;
		this.gameState = Game.STATES.PLAYING;
		this._gameOverTracked = false;
		this.setRunDifficulty(legacy.difficulty || DEFAULT_RUN_DIFFICULTY);

		this.waveManager.reset();
		this.waveManager.setDifficulty(this.runDifficulty);
		this.waveManager.startWave(this.wave);

		if (legacy.modifierKey) {
			this.applyWaveModifier(legacy.modifierKey);
		}

		// Dispatch WAVE_START for the restored wave
		this.dispatcher.dispatch({
			type: ActionTypes.WAVE_START,
			payload: {
				wave: this.wave,
				enemiesToSpawn: this.waveManager.enemiesToSpawn,
				isBoss: this.waveManager.isBossWave,
			},
		});

		telemetry.track("save_loaded", {
			wave: this.wave,
			checkpointWave,
		});

		return true;
	}

	/**
	 * Minimal player combat state for mid-run saves.
	 * Skill/ascension state is saved separately.
	 */
	_getPlayerSaveState() {
		const player = this.player;
		return {
			hp: player.hp,
			shieldHp: player.shieldHp,
		};
	}

	/**
	 * Restores perishable combat state (HP, shield) on top of skill-derived stats.
	 */
	_applyPlayerSaveState(playerState) {
		const player = this.player;
		if (playerState.hp != null) player.hp = playerState.hp;
		if (playerState.shieldHp != null) player.shieldHp = playerState.shieldHp;
		player.setExternalModifiers({
			regenMultiplier: this.modifierState.playerRegenMultiplier,
			turnSpeedMultiplier: this.modifierState.playerTurnSpeedMultiplier,
		});
	}
}
