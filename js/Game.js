import { Player } from "./Player.js";
import { Particle } from "./Particle.js";
import { Projectile } from "./Projectile.js";
import { Shop } from "./Shop.js";
import { GameConfig } from "./config/GameConfig.js";
import { ObjectPool } from "./utils/ObjectPool.js";
import { PerformanceManager } from "./managers/PerformanceManager.js";
import { CollisionSystem } from "./systems/CollisionSystem.js";
import { WaveManager } from "./systems/WaveManager.js";
import { EffectsManager } from "./systems/EffectsManager.js";
import { EntityManager } from "./systems/EntityManager.js";
import { playSFX } from "./main.js";
import { ProgressionManager } from "./managers/ProgressionManager.js";
import { telemetry } from "./managers/TelemetryManager.js";
import { monetizationManager } from "./managers/MonetizationManager.js";

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
		POWERUP: "powerup",
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

		this._initializeEntities();
		this._initializeManagers();
		this._initializeSystems();
		this._initializeGameState();
		this._initializeShop();

		this.init();
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
		this.performanceProfileKey = GameConfig.DERIVED.selectPerformanceProfile();
		this.modifierState = {
			enemySpeedMultiplier: 1,
			enemyDamageTakenMultiplier: 1,
			playerRegenMultiplier: 1,
			playerTurnSpeedMultiplier: 1,
			visibilityReduction: false
		};
		this._initializeObjectPools();
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
	}

	/**
	 * Initialize the shop system for power-ups.
	 * @private
	 */
	_initializeShop() {
		this.shop = new Shop();
	}

	/**
	 * Initialize the game world and create the player.
	 */
	init() {
		// Get logical canvas dimensions with fallback chain for better reliability
		const logicalWidth = this.canvas.logicalWidth || 
			parseInt(this.canvas.style.width) || 
			this.canvas.clientWidth || 
			this.canvas.width;
		const logicalHeight = this.canvas.logicalHeight || 
			parseInt(this.canvas.style.height) || 
			this.canvas.clientHeight || 
			this.canvas.height;
		
		const centerX = logicalWidth / 2;
		const centerY = logicalHeight / 2;
		this.player = new Player(centerX, centerY);
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

		this.player.reset();
		this.waveManager.reset();
		this.waveManager.startWave(this.wave);

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
	updateCanvasSize() {
		// Get logical canvas dimensions with fallback chain for better reliability
		const logicalWidth = this.canvas.logicalWidth || 
			parseInt(this.canvas.style.width) || 
			this.canvas.clientWidth || 
			this.canvas.width;
		const logicalHeight = this.canvas.logicalHeight || 
			parseInt(this.canvas.style.height) || 
			this.canvas.clientHeight || 
			this.canvas.height;
		
		const centerX = logicalWidth / 2;
		const centerY = logicalHeight / 2;

		if (this.player) {
			this.player.x = centerX;
			this.player.y = centerY;
		}

		// Update enemy positions to maintain relative positions from center
		this.enemies.forEach((enemy) => {
			const dx = enemy.x - centerX;
			const dy = enemy.y - centerY;
			const distance = Math.sqrt(dx * dx + dy * dy);

			// If enemy is off-screen due to resize, move it to visible area
			const maxDistance =
				Math.max(logicalWidth, logicalHeight) / 2 + 50;
			if (distance > maxDistance) {
				const angle = Math.atan2(dy, dx);
				enemy.x = centerX + Math.cos(angle) * maxDistance;
				enemy.y = centerY + Math.sin(angle) * maxDistance;
			}
		});

		// Remove projectiles and particles that are now off-screen
		this.projectiles = this.projectiles.filter((proj) => {
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

		// PerformanceManager is updated by the outer game loop in js/main.js
		const avgFps = this.performanceManager.getAverageFps();
		const targetProfile = GameConfig.DERIVED.selectPerformanceProfile(avgFps);
		if (targetProfile !== this.performanceProfileKey) {
			this._configurePoolsForProfile(targetProfile);
		}

		// Update all game systems
		this.effectsManager.update(delta);
		this.waveManager.update(delta);
		this.entityManager.updateAll(delta, input);

		// Handle collisions
		this.collisionSystem.checkAllCollisions();

		// Check game over
		if (this.player.hp <= 0) {
			this.gameState = "gameover";
			if (!this._gameOverTracked) {
				this._gameOverTracked = true;
				telemetry.track("game_over", {
					wave: this.wave,
					score: this.score,
					coins: this.player.coins
				});
				monetizationManager.registerOpportunity("game_over", {
					wave: this.wave,
					score: this.score
				});
			}
		}
	}

	/**
	 * Handle wave completion logic and transition to shop.
	 */
	completeWave() {
		this.gameState = "powerup";

		// Calculate and award coins
		const totalCoins = this.waveManager.calculateWaveReward();
		this.player.addCoins(totalCoins);
		this.progressionManager.recordWaveCompletion(this.wave, this.waveManager.isBossWave);

		telemetry.track("wave_complete", {
			wave: this.wave,
			coinsRewarded: totalCoins,
			remainingHp: this.player.hp,
			isBossWave: this.waveManager.isBossWave
		});

		monetizationManager.registerOpportunity("between_waves", {
			wave: this.wave,
			coinsRewarded: totalCoins,
			isBossWave: this.waveManager.isBossWave
		});

		this.showShop();
	}

	/**
	 * Display the shop interface for power-up purchases.
	 */
	showShop() {
		this.shop.showShop(
			this.player,
			this.player.coins,
			(powerUp, price) => this.purchasePowerUp(powerUp, price),
			() => this.continueToNextWave(),
			() => this.showRewardedCoinBoost()
		);
	}

	/**
	 * Process a power-up purchase from the shop.
	 */
	purchasePowerUp(powerUp, price) {
		if (this.player.spendCoins(price)) {
			powerUp.apply(this.player);
			this.player.evaluateSynergies();
			playSFX("powerup");
			telemetry.track("shop_purchase", {
				wave: this.wave,
				powerUp: powerUp.name,
				price,
				coinsAfterPurchase: this.player.coins
			});
		} else {
			telemetry.track("shop_purchase_failed", {
				wave: this.wave,
				powerUp: powerUp.name,
				price,
				coinsAvailable: this.player.coins
			});
		}
	}

	/**
	 * Continue to the next wave after shopping phase.
	 */
	continueToNextWave() {
		this.shop.closeShop();
		this.wave++;
		this.gameState = "playing";

		telemetry.track("wave_start", {
			wave: this.wave,
			playerHp: this.player.hp,
			coins: this.player.coins
		});

		setTimeout(() => {
			this.waveManager.startWave(this.wave);
		}, 1000);
	}

	async showRewardedCoinBoost() {
		const bonus = Math.max(1, Math.ceil(this.waveManager.calculateWaveReward() * 0.5));
		return monetizationManager.tryShowRewarded(
			"between_waves_coin_boost",
			{ wave: this.wave, proposedBonus: bonus },
			() => {
				this.player.addCoins(bonus);
				telemetry.track("rewarded_bonus_applied", {
					placement: "between_waves_coin_boost",
					wave: this.wave,
					bonus
				});
			}
		);
	}

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
}
