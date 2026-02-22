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
import { playSFX, createFloatingText, screenFlash, showLevelUpPanel, showAscensionPanel, closeAllSkillOverlays } from "./main.js";
import { ProgressionManager } from "./managers/ProgressionManager.js";
import { telemetry } from "./managers/TelemetryManager.js";

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
	};

	/**
	 * Creates a new game instance and initializes all subsystems.
	 */
	constructor(canvas, ctx) {
		if (!canvas || !ctx) {
			throw new Error("Canvas and context are required");
		}

		this.canvas = canvas;
		this.ctx = ctx;
		this.gameState = Game.STATES.MENU;
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
	}

	_clearWaveCountdownTimeouts() {
		for (const timeoutId of this._waveCountdownTimeouts) {
			clearTimeout(timeoutId);
		}
		this._waveCountdownTimeouts = [];
	}

	_setCountdownDisplay(label, isGo = false) {
		const countdown = document.getElementById('waveCountdown');
		const text = document.getElementById('waveCountdownText');
		if (!countdown || !text) {
			return;
		}

		text.textContent = label;
		text.classList.toggle('go', isGo);
		text.style.animation = 'none';
		void text.offsetWidth;
		text.style.animation = '';
	}

	_runWaveCountdown(onGo) {
		const countdown = document.getElementById('waveCountdown');
		const text = document.getElementById('waveCountdownText');
		if (!countdown || !text) {
			onGo();
			return;
		}

		this._clearWaveCountdownTimeouts();
		const sequence = ['3', '2', '1', 'GO'];
		let index = 0;

		countdown.classList.add('show');

		const runStep = () => {
			const current = sequence[index];
			const isGo = current === 'GO';
			this._setCountdownDisplay(current, isGo);

			if (isGo) {
				onGo();
				const hideId = setTimeout(() => {
					countdown.classList.remove('show');
				}, 450);
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
		this.gameState = "playing";
		this.wave = 1;
		this.score = 0;
		this.enemies = [];
		this.projectiles = [];
		this.particles = [];
		this._gameOverTracked = false;
		this._lastRunResult = null;

		this.player.reset();
		this.skillManager.reset();
		this.ascensionSystem.reset();
		this.applyResponsiveEntityScale();
		this.waveManager.reset();
		this.waveManager.setDifficulty(this.runDifficulty);
		this.comboSystem.resetForRun();
		this.lootSystem.resetForRun();
		this.achievementSystem.resetForRun();
		this.challengeSystem.selectChallenges();

		// Sync player with initial skill/attribute state
		this._syncPlayerFromSkills();

		this._runWaveCountdown(() => {
			this._waveStartTime = performance.now();
			this.challengeSystem.onWaveStart();
			this.waveManager.startWave(this.wave);
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
			this.player.x = centerX;
			this.player.y = centerY;
		}

		this.applyResponsiveEntityScale();

		// Preserve enemy relative placement when canvas dimensions change.
		this.enemies.forEach((enemy) => {
			enemy.x = (enemy.x / prevWidth) * logicalWidth;
			enemy.y = (enemy.y / prevHeight) * logicalHeight;

			const dx = enemy.x - centerX;
			const dy = enemy.y - centerY;
			const distance = Math.sqrt(dx * dx + dy * dy);
			const maxDistance =
				Math.max(logicalWidth, logicalHeight) / 2 + GameConfig.ENEMY.SPAWN_MARGIN;

			if (distance > maxDistance) {
				const angle = Math.atan2(dy, dx);
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

		// Update all game systems
		this.effectsManager.update(delta);
		this.waveManager.update(delta);
		this.entityManager.updateAll(delta, input);
		this.comboSystem.update(delta);
		this.lootSystem.update(delta);
		this.achievementSystem.update(delta);

		// Handle collisions
		this.collisionSystem.checkAllCollisions();

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
		this.score += waveClearBonus + speedBonus + perfectBonus;

		// XP for wave clear (via SkillManager)
		const xpAmount = LEVEL_CONFIG.XP_PER_WAVE_CLEAR_BASE + this.wave * LEVEL_CONFIG.XP_PER_WAVE_CLEAR_SCALING;
		const ascEffects = this.ascensionSystem.getAggregatedEffects();
		this.addXP(Math.floor(xpAmount * (ascEffects.xpMultiplier || 1)));

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
			playSFX('boss_defeat');
		} else if (isMiniMilestone(this.wave)) {
			const { width, height } = this.getLogicalCanvasSize();
			createFloatingText(`WAVE ${this.wave} CLEAR!`, width / 2, height / 2 - 40, 'milestone-minor');
		}

		// Reset combo for new wave, notify subsystems
		this.comboSystem.resetForWave();
		this.challengeSystem.onWaveComplete();
		this.achievementSystem.onWaveComplete();

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
		});
	}

	/**
	 * Cast an active/ultimate skill — triggers cooldown and executes the gameplay effect.
	 * Called from keybind handler in main.js.
	 * @param {string} skillId
	 * @returns {boolean} true if cast succeeded
	 */
	castActiveSkill(skillId) {
		if (!this.skillManager.tryCast(skillId)) return false;

		const info = this.skillManager.getActiveSkillInfo(skillId);
		if (!info) return false;

		const { skill, rank } = info;

		switch (skill.id) {
			// ── Gunner actives ──
			case 'gunner_focused_fire': {
				const duration = skill.effect.duration + skill.effect.durationPerRank * (rank - 1);
				this.player.activateSkillBuff('focusedFire', {
					fireRateMultiplier: skill.effect.fireRateMultiplier,
					duration,
				});
				this.effectsManager.addScreenShake(3, 150);
				const { width, height } = this.getLogicalCanvasSize();
				createFloatingText('FOCUSED FIRE!', width / 2, height / 2 - 30, 'level-up');
				playSFX('powerup');
				break;
			}
			case 'gunner_barrage': {
				const shotCount = skill.effect.shotCount + skill.effect.shotsPerRank * (rank - 1);
				this.player.activateSkillBuff('bulletStorm', {
					shotsRemaining: shotCount,
					duration: skill.effect.duration,
					interval: skill.effect.duration / shotCount,
					timer: 0,
				});
				this.effectsManager.addScreenShake(5, 200);
				const { width, height } = this.getLogicalCanvasSize();
				createFloatingText('BULLET STORM!', width / 2, height / 2 - 30, 'level-up');
				playSFX('powerup');
				break;
			}

			// ── Gunner ultimate ──
			case 'gunner_aimbot_overdrive': {
				this.player.activateSkillBuff('aimbotOverdrive', {
					duration: skill.effect.duration,
					damageMultiplier: skill.effect.damagePerShot,
					fireInterval: 80, // rapid-fire interval in ms
					fireTimer: 0,
				});
				this.effectsManager.addScreenShake(8, 400);
				const { width, height } = this.getLogicalCanvasSize();
				createFloatingText('AIMBOT OVERDRIVE!', width / 2, height / 2 - 30, 'milestone-major');
				screenFlash();
				playSFX('boss_defeat');
				break;
			}

			// ── Technomancer actives ──
			case 'techno_emp_pulse': {
				const duration = skill.effect.duration + skill.effect.durationPerRank * (rank - 1);
				const radius = skill.effect.radius;
				const px = this.player.x;
				const py = this.player.y;
				const slowFactor = Math.max(0.1, 1 - skill.effect.slowAmount);
				// Apply slow to all enemies in radius via timed slow
				for (const enemy of this.enemies) {
					const dx = enemy.x - px;
					const dy = enemy.y - py;
					if (dx * dx + dy * dy <= radius * radius) {
						enemy.slowFactor = slowFactor;
						enemy._empSlowTimer = duration;
					}
				}
				// Visual: expanding ring
				this.createExplosionRing(px, py, radius);
				this.effectsManager.addScreenShake(4, 200);
				const { width, height } = this.getLogicalCanvasSize();
				createFloatingText('EMP PULSE!', width / 2, height / 2 - 30, 'level-up');
				playSFX('powerup');
				break;
			}
			case 'techno_neon_nova': {
				const radius = skill.effect.radius + skill.effect.radiusPerRank * (rank - 1);
				const px = this.player.x;
				const py = this.player.y;
				let hitCount = 0;
				for (const enemy of this.enemies) {
					const dx = enemy.x - px;
					const dy = enemy.y - py;
					if (dx * dx + dy * dy <= radius * radius) {
						const damage = enemy.maxHealth * skill.effect.damagePercent;
						enemy.takeDamage(damage);
						hitCount++;
					}
				}
				// Visual: massive explosion + ring
				this.createExplosion(px, py, 60);
				this.createExplosionRing(px, py, radius);
				this.effectsManager.addScreenShake(10, 400);
				const { width, height } = this.getLogicalCanvasSize();
				createFloatingText(`NEON NOVA! (${hitCount} hit)`, width / 2, height / 2 - 30, 'level-up');
				screenFlash();
				playSFX('boss_defeat');
				break;
			}

			// ── Technomancer ultimate ──
			case 'techno_lightning_cascade': {
				this._executeLightningCascade(skill);
				break;
			}

			default:
				break;
		}

		return true;
	}

	/**
	 * Execute Lightning Cascade ultimate — chain lightning bouncing between all enemies.
	 * @private
	 */
	_executeLightningCascade(skill) {
		if (this.enemies.length === 0) return;

		const maxBounces = skill.effect.maxBounces;
		const amplification = skill.effect.bounceAmplification;
		let damage = skill.effect.baseDamage;
		const px = this.player.x;
		const py = this.player.y;

		// Sort enemies by distance from player, start with nearest
		const sorted = [...this.enemies].sort((a, b) => {
			const da = (a.x - px) ** 2 + (a.y - py) ** 2;
			const db = (b.x - px) ** 2 + (b.y - py) ** 2;
			return da - db;
		});

		const visited = new Set();
		let current = sorted[0];
		let bounceCount = 0;
		const chainPositions = [{ x: px, y: py }]; // start from player

		while (current && bounceCount < maxBounces) {
			visited.add(current.id);
			chainPositions.push({ x: current.x, y: current.y });

			current.takeDamage(damage);
			bounceCount++;
			damage *= (1 + amplification);

			// Find nearest unvisited enemy
			let nearest = null;
			let nearestDist = Infinity;
			for (const enemy of this.enemies) {
				if (visited.has(enemy.id) || enemy.hp <= 0) continue;
				const dx = enemy.x - current.x;
				const dy = enemy.y - current.y;
				const dist = dx * dx + dy * dy;
				if (dist < nearestDist) {
					nearestDist = dist;
					nearest = enemy;
				}
			}
			current = nearest;
		}

		// Visual: lightning chain effect
		for (let i = 0; i < chainPositions.length - 1; i++) {
			const from = chainPositions[i];
			const to = chainPositions[i + 1];
			this._createLightningEffect(from, to);
		}

		this.effectsManager.addScreenShake(12, 500);
		const { width, height } = this.getLogicalCanvasSize();
		createFloatingText(`LIGHTNING CASCADE! (${bounceCount} bounces)`, width / 2, height / 2 - 30, 'milestone-major');
		screenFlash();
		playSFX('boss_defeat');
	}

	/**
	 * Create a visual lightning line effect between two points.
	 * @private
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
	 * Sync player stats from SkillManager attributes + passive effects.
	 * Called after each skill/attribute allocation.
	 * @private
	 */
	_syncPlayerFromSkills() {
		const attrs = this.skillManager.getComputedAttributes();
		const passives = this.skillManager.getPassiveEffects();
		const ascension = this.ascensionSystem.getAggregatedEffects();

		// Base stats from attributes
		const baseHp = GameConfig.PLAYER.BASE_HP;
		const newMaxHp = Math.floor((baseHp + attrs.maxHpBonus) * (ascension.maxHpMultiplier || 1));
		// Preserve HP ratio when max changes
		const hpRatio = this.player.maxHp > 0 ? this.player.hp / this.player.maxHp : 1;
		this.player.maxHp = newMaxHp;
		this.player.hp = Math.min(newMaxHp, Math.ceil(newMaxHp * hpRatio));

		// Shield from attributes
		this.player.maxShieldHp = attrs.shieldCapacity;
		if (attrs.shieldCapacity > 0) {
			this.player.hasShield = true;
			this.player.shieldHp = Math.min(this.player.shieldHp, this.player.maxShieldHp);
		}

		// Regen from attributes + ascension
		this.player.hpRegen = attrs.hpRegen + (ascension.hpRegenBonus || 0);
		this.player.shieldRegen = attrs.shieldCapacity > 0 ? attrs.shieldCapacity * 0.05 : 0;

		// Combat modifiers from attributes + passives + ascension
		this.player.damageMod = attrs.damageMultiplier * (1 + passives.damageBonus) * (ascension.damageMultiplier || 1);
		this.player.fireRateMod = attrs.fireRateMultiplier * (1 + passives.fireRateBonus);
		this.player.rotationSpeedMod = attrs.turnSpeedMultiplier * (1 + passives.turnSpeedBonus);

		// Passive skill effects
		this.player.piercingLevel = passives.pierceCount;
		this.player.hasTripleShot = passives.hasTripleShot;
		this.player.explosiveShots = passives.hasExplosiveRounds;
		if (passives.hasExplosiveRounds) {
			this.player.explosionRadius = passives.explosionRadius * attrs.aoeRadiusMultiplier;
			this.player.explosionDamage = GameConfig.PLAYER.BASE_DAMAGE * this.player.damageMod * passives.explosionDamageRatio;
		}
		this.player.hasHomingShots = passives.homingStrength > 0;

		// Crit from LUCK attribute + skill passives
		const totalCrit = Math.min(0.60, attrs.critChance + passives.critChanceBonus);
		if (totalCrit > 0) {
			this.player.luckyShots = {
				chance: totalCrit,
				active: true,
				critDamageMultiplier: passives.critDamageMultiplier,
			};
		} else {
			this.player.luckyShots = null;
		}

		// Burn aura from Technomancer
		if (passives.burnDamagePercent > 0) {
			this.player.immolationAura = {
				damagePercent: passives.burnDamagePercent,
				range: passives.burnRange * attrs.aoeRadiusMultiplier,
				active: true,
			};
		} else {
			this.player.immolationAura = null;
		}

		// Overcharge burst from Gunner
		if (passives.overcharge) {
			this.player.overchargeBurst = {
				interval: passives.overcharge.shotInterval,
				multiplier: passives.overcharge.damageMultiplier,
				shotCount: 0,
				active: true,
			};
		} else {
			this.player.overchargeBurst = null;
		}

		// Technomancer passives: chain hit, volatile kills, elemental synergy, meltdown, chain master
		this.player.chainHit = passives.chainChance > 0
			? { chance: passives.chainChance, range: passives.chainRange, escalation: passives.chainDamageEscalation }
			: null;
		this.player.volatileKills = passives.hasVolatileKills
			? { percent: passives.volatileKillPercent, radius: passives.volatileKillRadius }
			: null;
		this.player.elementalSynergy = passives.hasSynergyBonus
			? { bonus: passives.synergyDamageBonus }
			: null;
		this.player.meltdown = passives.hasMeltdown
			? { chance: passives.meltdownChance, damageRatio: passives.meltdownDamageRatio, radius: passives.meltdownRadius }
			: null;

		// Life steal from ascension
		this.player.hasLifeSteal = ascension.lifeStealPercent > 0;
		this.player._ascensionLifeSteal = ascension.lifeStealPercent;

		// Store ascension effects on player for runtime access
		this.player._ascensionEffects = ascension;

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
	}

	/**
	 * Handle ascension modifier selection (called from UI).
	 * @param {string} modifierId
	 */
	selectAscension(modifierId) {
		if (this.ascensionSystem.selectModifier(modifierId)) {
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
		const levelsGained = this.skillManager.addXP(amount);
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

		// Draw entities
		this.particles.forEach((particle) => particle.draw(ctx));
		
		// Draw regular enemies first
		this.enemies.forEach((enemy) => enemy.draw(ctx));
	
		
		this.projectiles.forEach((projectile) => projectile.draw(ctx));
		this.player.draw(ctx);

		// Draw spawn warning if enemies are incoming
		if (this.waveManager.enemiesToSpawn > 0) {
			this.drawSpawnWarning(ctx);
		}

		ctx.restore();
	}

	/**
	 * Draw the background neon grid effect.
	 */
	drawBackground() {
		// Skip drawing grid if performance is low
		if (this.performanceManager.needsOptimization()) return;

		const ctx = this.ctx;
		const gridSize = GameConfig.VFX.GRID_SIZE;

		ctx.strokeStyle = `rgba(0, 255, 255, ${GameConfig.VFX.GRID_ALPHA})`;
		ctx.lineWidth = 1;

		const canvasWidth = this.canvas.logicalWidth || this.canvas.width;
		const canvasHeight = this.canvas.logicalHeight || this.canvas.height;

		// Draw vertical lines
		for (let x = 0; x < canvasWidth; x += gridSize) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, canvasHeight);
			ctx.stroke();
		}

		// Draw horizontal lines
		for (let y = 0; y < canvasHeight; y += gridSize) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(canvasWidth, y);
			ctx.stroke();
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

		// Draw enemy count text
		ctx.fillStyle = "#ff0";
		ctx.font = '16px "Press Start 2P", monospace';
		ctx.textAlign = "center";
		ctx.shadowColor = "#ff0";
		ctx.shadowBlur = 10;

		const text = `Incoming: ${this.waveManager.enemiesToSpawn}`;
		ctx.fillText(text, canvasWidth / 2, 40);

		// Reset text properties
		ctx.textAlign = "left";
		ctx.shadowBlur = 0;
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
		return {
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

		const checkpointWave = Math.max(1, snapshot.checkpointWave || snapshot.wave || 1);

		this.enemies = [];
		this.projectiles = [];
		this.particles = [];
		this.particlePool.clear();
		this.projectilePool.clear();

		this.player.reset();

		// Restore skill & ascension state first, then sync player stats
		if (snapshot.skillManager) {
			this.skillManager.restoreFromSave(snapshot.skillManager);
		}
		if (snapshot.ascensionSystem) {
			this.ascensionSystem.restoreFromSave(snapshot.ascensionSystem);
		}
		this._syncPlayerFromSkills();

		// Overlay HP/shield from snapshot (player may have taken damage before save)
		if (snapshot.player) {
			this._applyPlayerSaveState(snapshot.player);
		}

		this.wave = checkpointWave;
		this.score = snapshot.score || 0;
		this.gameState = Game.STATES.PLAYING;
		this._gameOverTracked = false;
		this.setRunDifficulty(snapshot.difficulty || DEFAULT_RUN_DIFFICULTY);

		this.waveManager.reset();
		this.waveManager.setDifficulty(this.runDifficulty);
		this.waveManager.startWave(this.wave);

		if (snapshot.modifierKey) {
			this.applyWaveModifier(snapshot.modifierKey);
		}

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
