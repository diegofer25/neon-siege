import { Projectile } from './Projectile.js';
import { GameConfig } from './config/GameConfig.js';
import { playSFX } from './main.js';
import { MathUtils } from './utils/MathUtils.js';

/**
 * Player character class for the neon tower defense game
 * 
 * Handles all player-related functionality including:
 * - Character state management (health, shields, position)
 * - Combat system (auto-targeting, firing, damage calculations)
 * - Power-up system (stackable and non-stackable abilities)
 * - Visual effects (muzzle flash, glow effects, slow field)
 * - Stat-driven progression (stats set externally by SkillManager)
 * 
 * @class Player
 */
export class Player {
    /**
     * Creates a new player instance with default stats and power-ups
     * 
     * @param {number} x - Initial x coordinate position
     * @param {number} y - Initial y coordinate position
     * @example
     * const player = new Player(400, 300); // Center of 800x600 canvas
     */
    constructor(x, y) {
        this._initializePosition(x, y);
        this._initializeStats();
        this._initializeCombatFlags();
    }
    
    /**
     * Initialize player position and basic geometric properties
     * 
     * @private
     * @param {number} x - Initial x coordinate
     * @param {number} y - Initial y coordinate
     */
    _initializePosition(x, y) {
        /** @type {number} Current x position */
        this.x = x;
        /** @type {number} Current y position */
        this.y = y;
        /** @type {number} Base player collision radius before responsive scaling */
        this.baseRadius = GameConfig.PLAYER.RADIUS;
        /** @type {number} Player collision radius */
        this.radius = this.baseRadius;
        /** @type {number} Current facing angle in radians */
        this.angle = 0;
        
        // Rotation system properties
        /** @type {number|null} Target angle the player is rotating towards */
        this.targetAngle = null;
        /** @type {boolean} Whether player is currently rotating to face a target */
        this.isRotating = false;
        /** @type {number} Time spent rotating towards current target */
        this.rotationTime = 0;
        /** @type {Object|null} Current enemy target being tracked */
        this.currentTarget = null;
    }
    
    /**
     * Initialize player combat and health statistics
     * 
     * @private
     */
    _initializeStats() {
        /** @type {number} Maximum health points */
        this.maxHp = GameConfig.PLAYER.MAX_HP;
        /** @type {number} Current health points */
        this.hp = this.maxHp;
        /** @type {number} Time remaining until next shot (milliseconds) */
        this.fireCooldown = 0;
        /** @type {number} Base time between shots (milliseconds) */
        this.baseFireRate = GameConfig.PLAYER.BASE_FIRE_RATE;
        // Combat modifiers (multipliers)
        /** @type {number} Damage multiplier (1.0 = normal damage) */
        this.damageMod = 1;
        /** @type {number} Fire rate multiplier (2.0 = twice as fast) */
        this.fireRateMod = 1;
        /** @type {number} Projectile speed multiplier */
        this.projectileSpeedMod = 1;
        /** @type {number} Rotation speed multiplier (2.0 = twice as fast rotation) */
        this.rotationSpeedMod = 1;
        /** @type {{regenMultiplier:number, turnSpeedMultiplier:number, critBonus:number}} */
        this.externalModifiers = {
            regenMultiplier: 1,
            turnSpeedMultiplier: 1,
            critBonus: 0
        };
        /** @type {number} Persistent critical chance bonuses from meta/synergies */
        this.persistentCritBonus = 0;

        /** @type {number} Time remaining for enemy projectile invulnerability (ms) */
        this.enemyProjectileIFrames = 0;
        /** @type {number} Duration applied after an enemy projectile hit (ms) */
        this.enemyProjectileIFrameDuration = GameConfig.PLAYER.ENEMY_PROJECTILE_IFRAMES_MS;
    }
    
    /**
     * Initialize all combat flags and ability properties.
     * Values are set externally by Game._syncPlayerFromSkills().
     * 
     * @private
     */
    _initializeCombatFlags() {
        // Boolean power-up flags
		/** @type {number} The number of enemies projectiles can pierce. 0 = no piercing. */
		this.piercingLevel = 0;
		/** @type {boolean} Whether player fires three projectiles per shot */
		this.hasTripleShot = false;
		/** @type {boolean} Whether player heals when killing enemies */
		this.hasLifeSteal = false;
		/** @type {boolean} Whether slow field is active */
		this.hasSlowField = false;
		/** @type {boolean} Whether shield protection is active */
		this.hasShield = false;
		/** @type {boolean} Whether projectiles explode on impact */
		this.explosiveShots = false;
		
		// Numeric power-up properties
		/** @type {number} Current shield health points */
		this.shieldHp = 0;
		/** @type {number} Maximum shield health points */
		this.maxShieldHp = 0;
		/** @type {number} Health regeneration per second */
		this.hpRegen = 0;
		/** @type {number} Shield regeneration per second */
		this.shieldRegen = 0;
		/** @type {number} Explosion radius for explosive shots */
		this.explosionRadius = 50;
		/** @type {number} Explosion damage for explosive shots */
		this.explosionDamage = 20;
		// Lucky Shots configuration
		/** @type {Object|null} Lucky shots configuration object */
		this.luckyShots = null;
		
		// Slow field configuration
		/** @type {number} Radius of slow field effect */
		this.slowFieldRadius = GameConfig.PLAYER.SLOW_FIELD_BASE_RADIUS;
		/** @type {number} Current slow field strength (stack count) */
		this.slowFieldStrength = 0;
		/** @type {number} Maximum allowed slow field stacks */
		this.maxSlowFieldStacks = GameConfig.PLAYER.MAX_SLOW_FIELD_STACKS;
        /** @type {number} Additional slow strength bonus from synergies */
        this.slowFieldBonus = 0;
		
		// Immolation Aura configuration
		/** @type {Object|null} Immolation Aura configuration object */
		this.immolationAura = null;
        /** @type {number} Additional aura damage bonus from synergies */
        this.immolationAuraBonus = 0;
		
		// Shield Boss Counter Power-ups
		/** @type {boolean} Whether Shield Breaker is active */
		this.hasShieldBreaker = false;
		/** @type {number} Shield damage multiplier */
		this.shieldBreakerDamage = 1.0;
		/** @type {number} Shield regeneration delay */
		this.shieldRegenDelay = 0;
		/** @type {number} Shield breaker stack count */
		this.shieldBreakerStacks = 0;
		
		/** @type {boolean} Whether Adaptive Targeting is active */
		this.hasAdaptiveTargeting = false;
		/** @type {number} Extended targeting range */
		this.targetingRange = 200;
		/** @type {boolean} Whether projectiles have homing ability */
		this.hasHomingShots = false;
		
		/** @type {boolean} Whether Barrier Phase is active */
		this.hasBarrierPhase = false;
		/** @type {number} Barrier Phase cooldown timer */
		this.barrierPhaseCooldown = 0;
		/** @type {number} Maximum cooldown for Barrier Phase */
		this.barrierPhaseMaxCooldown = 60000;
		/** @type {number} Duration of invulnerability */
		this.barrierPhaseDuration = 3000;
		/** @type {boolean} Whether currently invulnerable */
		this.barrierPhaseActive = false;
		/** @type {number} Health threshold to trigger barrier */
		this.barrierPhaseThreshold = 0.25;
		
		/** @type {Object|null} Overcharge Burst configuration */
		this.overchargeBurst = null;
		
		/** @type {Object|null} Emergency Heal configuration */
		this.emergencyHeal = null;

        /** @type {number} Additional life steal provided by ascension modifiers */
        this._ascensionLifeSteal = 0;

        /** @type {Object|null} Aggregated ascension effects cache */
        this._ascensionEffects = null;

		// ── Active skill buff state ──
		/** @type {Object} Active skill buffs keyed by name, each with its own timer/state */
		this._skillBuffs = {};

		// ── Technomancer passive effect slots (set by Game._syncPlayerFromSkills) ──
		/** @type {Object|null} Chain Hit config: {chance, range, escalation} */
		this.chainHit = null;
		/** @type {Object|null} Volatile Kills config: {percent, radius} */
		this.volatileKills = null;
		/** @type {Object|null} Elemental Synergy config: {bonus} */
		this.elementalSynergy = null;
		/** @type {Object|null} Meltdown config: {chance, damageRatio, radius} */
		this.meltdown = null;

		// ── Visual state (driven by _syncPlayerFromSkills, read in draw) ──
		/** @type {{strLevel:number, dexLevel:number, vitLevel:number, intLevel:number, luckLevel:number, learnedSkills:Set<string>, flashTimer:number, flashColor:string}} */
		this.visualState = {
			strLevel: 0,
			dexLevel: 0,
			vitLevel: 0,
			intLevel: 0,
			luckLevel: 0,
			learnedSkills: new Set(),
			flashTimer: 0,
			flashColor: '#fff',
		};

		// ── Aura animation state (internal timers, not saved) ──
		/** @type {number} Accumulated angle for orbiting particles (rad) */
		this._auraOrbitAngle = 0;
		/** @type {number} Last target angle before switch (for DEX sweep) */
		this._lastTargetAngle = 0;
		/** @type {number} Remaining time on DEX sweep arc (ms) */
		this._sweepTimer = 0;
		/** @type {number} Timer for crit mastery spark effect */
		this._critSparkTimer = 0;
		/** @type {number} Timer for chain hit lightning flicker */
		this._chainFlickerTimer = 0;
		/** @type {number} Next chain flicker threshold (randomised) */
		this._chainFlickerNext = 800;
		/** @type {boolean} Whether chain flicker is currently on */
		this._chainFlickerOn = false;
		/** @type {{x:number,y:number,life:number,maxLife:number}[]} Active luck sparkles */
		this._luckSparkles = [];
    }

    /**
     * Apply external modifiers from wave effects or meta progression
     * @param {{regenMultiplier?:number, turnSpeedMultiplier?:number, critBonus?:number}} modifiers
     */
    setExternalModifiers(modifiers = {}) {
        this.externalModifiers.regenMultiplier = modifiers.regenMultiplier ?? 1;
        this.externalModifiers.turnSpeedMultiplier = modifiers.turnSpeedMultiplier ?? 1;
        const transientCrit = typeof modifiers.critBonus === 'number' ? modifiers.critBonus : 0;
        this.externalModifiers.critBonus = this.persistentCritBonus + transientCrit;
    }

    /**
     * Ensure lucky shot structure exists and apply base critical chance bonus
     * @param {number} chanceBonus - Additional critical chance to apply (0-1)
     */
    applyLuckyStartBonus(chanceBonus) {
        if (!this.luckyShots) {
            this.luckyShots = { chance: 0, active: true };
        }
        this.persistentCritBonus += chanceBonus;
        this.luckyShots.chance = Math.min(0.6, this.luckyShots.chance + chanceBonus);
        this.externalModifiers.critBonus = this.persistentCritBonus;
    }

    addPersistentCritBonus(amount) {
        this.persistentCritBonus += amount;
        this.externalModifiers.critBonus = this.persistentCritBonus;
    }

	/**
	 * Activate a timed skill buff (called by Game.castActiveSkill).
	 * @param {string} buffName - Unique buff identifier
	 * @param {Object} config - Buff-specific configuration with at least a `duration` field (ms)
	 */
	activateSkillBuff(buffName, config) {
		this._skillBuffs[buffName] = { ...config, elapsed: 0 };
	}

	/**
	 * Check if a skill buff is currently active.
	 * @param {string} buffName
	 * @returns {Object|null} The buff state or null
	 */
	getSkillBuff(buffName) {
		return this._skillBuffs[buffName] || null;
	}
    
    /**
     * Reset player to initial state (called on game restart)
     * Clears all power-ups, resets health, and restores default values
     * 
     * @public
     */
    reset() {
        this.hp = this.maxHp;
        this.fireCooldown = 0;
        this.angle = 0;

        this.enemyProjectileIFrames = 0;
        
        // Reset rotation system
        this.targetAngle = null;
        this.isRotating = false;
        this.rotationTime = 0;
        this.currentTarget = null;
        
        // Reset all power-up modifiers
        this.damageMod = 1;
        this.fireRateMod = 1;
        this.projectileSpeedMod = 1;
        this.rotationSpeedMod = 1;
        
        this.piercingLevel = 0;
        this.hasTripleShot = false;
        this.hasLifeSteal = false;
        this.hasSlowField = false;
        this.hasShield = false;
        this.shieldHp = 0;
        this.maxShieldHp = 0;
        this.hpRegen = 0;
        this.shieldRegen = 0;
        this.explosiveShots = false;
        this.persistentCritBonus = 0;
        
        // Reset slow field properties
        this.slowFieldRadius = GameConfig.PLAYER.SLOW_FIELD_BASE_RADIUS;
        this.slowFieldStrength = 0;
        this.maxSlowFieldStacks = GameConfig.PLAYER.MAX_SLOW_FIELD_STACKS;
        this.slowFieldBonus = 0;
        
        // Reset Lucky Shots
        this.luckyShots = null;
        
        // Reset Immolation Aura
        this.immolationAura = null;
        this.immolationAuraBonus = 0;
        
        // Reset Shield Boss Counter Power-ups
        this.hasShieldBreaker = false;
        this.shieldBreakerDamage = 1.0;
        this.shieldRegenDelay = 0;
        this.shieldBreakerStacks = 0;
        
        this.hasAdaptiveTargeting = false;
        this.targetingRange = 200;
        this.hasHomingShots = false;
        
        this.hasBarrierPhase = false;
        this.barrierPhaseCooldown = 0;
        this.barrierPhaseMaxCooldown = 60000;
        this.barrierPhaseDuration = 3000;
        this.barrierPhaseActive = false;
        this.barrierPhaseThreshold = 0.25;
        
        this.overchargeBurst = null;
        this.emergencyHeal = null;

        // Reset skill buffs and Technomancer passives
        this._skillBuffs = {};
        this.chainHit = null;
        this.volatileKills = null;
        this.elementalSynergy = null;
        this.meltdown = null;
    }

    /**
     * Update player state each frame
     * Handles rotation, targeting, firing, regeneration, and power-up effects
     * 
     * @param {number} delta - Time elapsed since last frame (milliseconds)
     * @param {Object} input - Input state object (currently unused)
     * @param {import('./Game.js').Game} game - Game instance containing enemies, projectiles, particles
     */
    update(delta, input, game) {
        // Skip all updates if game is not in playing state
        if (game.gameState !== 'playing') return;

        if (this.enemyProjectileIFrames > 0) {
            this.enemyProjectileIFrames = Math.max(0, this.enemyProjectileIFrames - delta);
        }
        
        // Find and acquire target
        const nearestEnemy = this.findNearestEnemy(game.enemies);
        
        if (nearestEnemy) {
            this._updateTargeting(nearestEnemy, delta);
            this._updateRotation(delta);
            this._updateFiring(game);
        } else {
            // No enemies - stop rotating and clear target
            this.isRotating = false;
            this.currentTarget = null;
            this.targetAngle = null;
            this.rotationTime = 0;
        }
        
        // Update fire cooldown timer
        if (this.fireCooldown > 0) {
            this.fireCooldown -= delta;
        }
        
        // Apply regeneration effects over time
        if (this.hpRegen > 0) {
            this.heal(this.hpRegen * this.externalModifiers.regenMultiplier * (delta / 1000));
        }
        
        if (this.shieldRegen > 0 && this.hasShield) {
            this.healShield(this.shieldRegen * this.externalModifiers.regenMultiplier * (delta / 1000));
        }
        
        // Apply area-of-effect slow field to nearby enemies
        if (this.hasSlowField && this.slowFieldStrength > 0) {
            this.applySlowField(game.enemies);
        }
        
        // Apply Immolation Aura damage to nearby enemies
        if (this.immolationAura && this.immolationAura.active) {
            this.applyImmolationAura(game.enemies, delta);
        }
        
        // Update Barrier Phase cooldown
        if (this.hasBarrierPhase && this.barrierPhaseCooldown > 0) {
            this.barrierPhaseCooldown -= delta;
        }
        
        // Check for Barrier Phase activation
        if (this.hasBarrierPhase && !this.barrierPhaseActive && 
            this.hp / this.maxHp <= this.barrierPhaseThreshold && 
            this.barrierPhaseCooldown <= 0) {
            this.activateBarrierPhase();
        }
        
        // Update Barrier Phase duration
        if (this.barrierPhaseActive) {
            this.barrierPhaseDuration -= delta;
            if (this.barrierPhaseDuration <= 0) {
                this.barrierPhaseActive = false;
                playSFX('player_barrier_off');
            }
        }
        
        // Update Emergency Heal cooldown
        if (this.emergencyHeal && this.emergencyHeal.cooldown > 0) {
            this.emergencyHeal.cooldown -= delta;
        }
        
        // Check for Emergency Heal activation
        if (this.emergencyHeal && this.emergencyHeal.active &&
            this.hp / this.maxHp <= this.emergencyHeal.healThreshold &&
            this.emergencyHeal.cooldown <= 0) {
            this.activateEmergencyHeal();
        }

		// ── Tick active skill buffs ──
		this._updateSkillBuffs(delta, game);

		// ── Tick visual state timers ──
		this._updateVisualTimers(delta);
    }
    
    /**
     * Tick all active skill buffs, removing expired ones and executing per-frame effects.
     * @private
     * @param {number} delta - ms since last frame
     * @param {import('./Game.js').Game} game
     */
    _updateSkillBuffs(delta, game) {
        // ── Focused Fire: just a timed fire rate buff ──
        const ff = this._skillBuffs.focusedFire;
        if (ff) {
            ff.elapsed += delta;
            if (ff.elapsed >= ff.duration) {
                delete this._skillBuffs.focusedFire;
            }
        }

        // ── Bullet Storm: spawn homing projectiles over duration ──
        const bs = this._skillBuffs.bulletStorm;
        if (bs && bs.shotsRemaining > 0) {
            bs.elapsed += delta;
            bs.timer += delta;
            while (bs.timer >= bs.interval && bs.shotsRemaining > 0) {
                bs.timer -= bs.interval;
                bs.shotsRemaining--;
                // Fire a homing projectile at nearest enemy
                const target = this.findNearestEnemy(game.enemies);
                if (target) {
                    const angle = Math.atan2(target.y - this.y, target.x - this.x);
                    const baseDmg = GameConfig.PLAYER.BASE_DAMAGE * this.damageMod;
                    const proj = this._createProjectile(game, angle, baseDmg);
                    if (proj) {
                        proj.hasHoming = true;
                        proj.homingStrength = 0.08;
                        game.projectiles.push(proj);
                    }
                }
            }
            if (bs.shotsRemaining <= 0 || bs.elapsed >= bs.duration) {
                delete this._skillBuffs.bulletStorm;
            }
        }

        // ── Aimbot Overdrive: rapid-fire homing shots at ALL enemies ──
        const ao = this._skillBuffs.aimbotOverdrive;
        if (ao) {
            ao.elapsed += delta;
            ao.fireTimer += delta;
            while (ao.fireTimer >= ao.fireInterval && game.enemies.length > 0) {
                ao.fireTimer -= ao.fireInterval;
                // Pick a random enemy to fire at
                const enemy = game.enemies[Math.floor(Math.random() * game.enemies.length)];
                if (enemy) {
                    const angle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                    const baseDmg = GameConfig.PLAYER.BASE_DAMAGE * this.damageMod * ao.damageMultiplier;
                    const proj = this._createProjectile(game, angle, baseDmg);
                    if (proj) {
                        proj.hasHoming = true;
                        proj.homingStrength = 0.12;
                        game.projectiles.push(proj);
                    }
                }
            }
            if (ao.elapsed >= ao.duration) {
                delete this._skillBuffs.aimbotOverdrive;
            }
        }
    }

    /**
     * Update targeting system - track current target and decide when to switch
     *
     * @private
     * @param {Object} nearestEnemy - Closest enemy to player
     * @param {number} delta - Time elapsed since last frame
     */
    _updateTargeting(nearestEnemy, delta) {
        // Check if we should switch targets
        const shouldSwitchTarget = !this.currentTarget || 
                                 this.currentTarget !== nearestEnemy ||
                                 this.currentTarget.health <= 0 ||
                                 this.rotationTime > GameConfig.PLAYER.MAX_ROTATION_TIME;
        
        if (shouldSwitchTarget) {
            // DEX sweep arc: record old angle before switching
            if (this.currentTarget && this.targetAngle !== null) {
                this._lastTargetAngle = this.angle;
                this._sweepTimer = GameConfig.VFX.PLAYER_AURAS.DEX.SWEEP_DURATION;
            }
            this.currentTarget = nearestEnemy;
            this.isRotating = true;
            this.rotationTime = 0;
        }
        
        // Update target angle with predictive aiming for moving enemies
        if (this.currentTarget) {
            this.targetAngle = this._calculatePredictiveAngle(this.currentTarget);
        }
        
        // Update rotation timer if currently rotating
        if (this.isRotating) {
            this.rotationTime += delta;
        }
    }
    
    /**
     * Update player rotation towards target angle
     * 
     * @private
     * @param {number} delta - Time elapsed since last frame
     */
    _updateRotation(delta) {
        if (this.targetAngle === null) return;
        
        // Check if already facing target within tolerance
        if (MathUtils.isAngleWithinTolerance(this.angle, this.targetAngle, GameConfig.PLAYER.FIRING_TOLERANCE)) {
            this.isRotating = false;
            this.rotationTime = 0;
            return;
        }
        
        // Mark as rotating if we're not within tolerance
        this.isRotating = true;
        
        // Calculate rotation amount for this frame with rotation speed modifier
        const baseRotationSpeed = GameConfig.PLAYER.ROTATION_SPEED;
        const modifiedRotationSpeed = baseRotationSpeed * this.rotationSpeedMod * this.externalModifiers.turnSpeedMultiplier;
        const maxRotation = modifiedRotationSpeed * (delta / 1000);
        
        // Use smooth angle interpolation with speed limiting
        const angleDiff = MathUtils.angleDifference(this.angle, this.targetAngle);
        const rotationAmount = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxRotation);
        
        this.angle = MathUtils.normalizeAngle(this.angle + rotationAmount);
    }
    
    /**
     * Update firing logic - fire when reasonably aimed, even during minor adjustments
     * 
     * @private
     * @param {Object} game - Game instance
     */
    _updateFiring(game) {
        // Fire if we have a target, are off cooldown, and are reasonably aimed
        const hasValidTarget = this.currentTarget && this.currentTarget.health > 0;
        const isOffCooldown = this.fireCooldown <= 0;
        
        // Use current predictive angle for firing check to ensure accuracy
        const currentPredictiveAngle = this._calculatePredictiveAngle(this.currentTarget);
        const isReasonablyAimed = currentPredictiveAngle !== null && 
            MathUtils.isAngleWithinTolerance(this.angle, currentPredictiveAngle, GameConfig.PLAYER.FIRING_TOLERANCE);
        
        if (hasValidTarget && isOffCooldown && isReasonablyAimed) {
            // Use the predictive angle for firing to ensure we hit moving targets
            this.fireProjectile(game, currentPredictiveAngle);
            this.fireCooldown = this.getFireInterval();
        }
    }
    
    /**
     * Find the optimal target enemy using priority-based selection algorithm
     * Prioritizes enemies based on distance and health remaining
     * Only targets enemies within the visible game area
     * 
     * @param {Array<import('./Enemy.js').Enemy>} enemies - Array of enemy objects to evaluate
     * @returns {Object|null} Best target enemy or null if none available
     * 
     * @example
     * const target = player.findNearestEnemy(game.enemies);
     * if (target) {
     *   console.log(`Targeting enemy at (${target.x}, ${target.y})`);
     * }
     */
    findNearestEnemy(enemies) {
        if (!Array.isArray(enemies) || enemies.length === 0) {
            return null;
        }
        
        // Get canvas dimensions for boundary checking
        const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('gameCanvas'));
        if (!canvas) return null;
        
        const targetingMargin = 10; // Don't target enemies too close to edge
        const minX = targetingMargin;
        const minY = targetingMargin;
        const canvasWidth = canvas.logicalWidth || canvas.width;
        const canvasHeight = canvas.logicalHeight || canvas.height;
        const maxX = canvasWidth - targetingMargin;
        const maxY = canvasHeight - targetingMargin;
        
        let bestTarget = null;
        let bestPriority = Infinity;
        
        for (const enemy of enemies) {
            if (enemy.dying) continue; // Skip enemies already dying
            
            // Skip enemies outside the visible targeting area
            if (enemy.x < minX || enemy.x > maxX || enemy.y < minY || enemy.y > maxY) {
                continue;
            }
            
            const distance = this._calculateDistanceTo(enemy);
            // Lower health enemies get higher priority (lower score)
            const healthFactor = (enemy.maxHealth - enemy.health) * 0.1;
            const priority = distance - healthFactor;
            
            if (priority < bestPriority) {
                bestPriority = priority;
                bestTarget = enemy;
            }
        }
        
        return bestTarget;
    }
    
    /**
     * Calculate Euclidean distance to another entity
     * 
     * @private
     * @param {Object} entity - Entity with position properties
     * @param {number} entity.x - Entity x coordinate
     * @param {number} entity.y - Entity y coordinate
     * @returns {number} Distance to entity in pixels
     */
    _calculateDistanceTo(entity) {
        const dx = entity.x - this.x;
        const dy = entity.y - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * Calculate predictive angle to lead moving targets
     * 
     * @private
     * @param {Object} target - Target enemy with position and velocity
     * @returns {number} Predicted angle to intercept the target
     */
    _calculatePredictiveAngle(target) {
        if (!target) return null;
        
        // Calculate basic angle to current position
        const basicAngle = MathUtils.angleBetween(this.x, this.y, target.x, target.y);
        
        // If target has no velocity data or is not moving, use basic angle
        if (!target.vx || !target.vy || (Math.abs(target.vx) < 0.1 && Math.abs(target.vy) < 0.1)) {
            return basicAngle;
        }
        
        // Calculate time for projectile to reach target
        const distance = this._calculateDistanceTo(target);
        const projectileSpeed = GameConfig.PLAYER.BASE_PROJECTILE_SPEED * this.projectileSpeedMod;
        const timeToTarget = distance / projectileSpeed;
        
        // Predict where target will be when projectile arrives
        const predictedX = target.x + (target.vx * timeToTarget);
        const predictedY = target.y + (target.vy * timeToTarget);
        
        // Return angle to predicted position
        return MathUtils.angleBetween(this.x, this.y, predictedX, predictedY);
    }
    
    /**
     * Calculate effective fire interval based on current fire rate modifier
     * 
     * @returns {number} Time between shots in milliseconds
     * @example
     * // With fireRateMod = 2.0, fires twice as fast
     * const interval = player.getFireInterval(); // Returns baseFireRate / 2
     */
    getFireInterval() {
        let mod = this.fireRateMod;
        // Focused Fire active buff doubles fire rate
        const ff = this._skillBuffs.focusedFire;
        if (ff) {
            mod *= ff.fireRateMultiplier;
        }
        return this.baseFireRate / mod;
    }
    
    /**
     * Fire projectile(s) based on current power-up configuration
     * Handles single shots, triple shots, and all projectile modifications
     * 
     * @param {import('./Game.js').Game} game - Game instance for adding projectiles and effects
     * @param {number} [overrideAngle] - Optional angle override for predictive firing
     */
    fireProjectile(game, overrideAngle = null) {
        const damage = GameConfig.PLAYER.BASE_DAMAGE * this.damageMod;
        const firingAngle = overrideAngle !== null ? overrideAngle : this.angle;
        
        // Check for Overcharge Burst
        let isOverchargeBurst = false;
        if (this.overchargeBurst && this.overchargeBurst.active) {
            this.overchargeBurst.shotCounter++;
            if (this.overchargeBurst.shotCounter >= this.overchargeBurst.burstInterval) {
                isOverchargeBurst = true;
                this.overchargeBurst.shotCounter = 0;
            }
        }
        
        if (isOverchargeBurst) {
            this._fireOverchargeBurst(game, damage, firingAngle);
            playSFX('player_shoot_overcharge');
        } else if (this.hasTripleShot) {
            this._fireTripleShot(game, damage, firingAngle);
            playSFX('player_shoot_triple');
        } else {
            this._fireSingleShot(game, damage, firingAngle);
            playSFX('player_shoot_basic');
        }
        
        this.createMuzzleFlash(game);
    }
    
    /**
     * Fire three projectiles in a spread pattern
     * 
     * @private
     * @param {Object} game - Game instance
     * @param {number} damage - Base damage per projectile
     * @param {number} centerAngle - Center angle for the triple shot
     */
    _fireTripleShot(game, damage, centerAngle) {
        const spreadAngle = Math.PI / 12; // 15 degrees spread

        // Side projectile damage (75% of main)
        const damageModifier = 0.75;

        // Main projectile (center)
        this._fireSingleShot(game, damage, centerAngle);

        // Side projectiles
        const leftAngle = centerAngle - spreadAngle;
        const rightAngle = centerAngle + spreadAngle;

        const leftProjectile = this._createProjectile(game, leftAngle, damage * damageModifier, { isExtra: true });
        leftProjectile.isExtra = true;
        game.projectiles.push(leftProjectile);

        const rightProjectile = this._createProjectile(game, rightAngle, damage * damageModifier, { isExtra: true });
        rightProjectile.isExtra = true;
        game.projectiles.push(rightProjectile);
    }
    
    /**
     * Fire a single projectile straight ahead
     * 
     * @private
     * @param {Object} game - Game instance
     * @param {number} damage - Projectile damage
     * @param {number} angle - Firing angle
     */
    _fireSingleShot(game, damage, angle) {
        const projectile = this._createProjectile(game, angle, damage);
        game.projectiles.push(projectile);
    }
    
    /**
     * Fire an overcharged burst projectile with enhanced damage
     * 
     * @private
     * @param {Object} game - Game instance
     * @param {number} damage - Base projectile damage
     * @param {number} angle - Firing angle
     */
    _fireOverchargeBurst(game, damage, angle) {
        const burstDamage = damage * this.overchargeBurst.burstDamageMultiplier;
        const projectile = this._createProjectile(game, angle, burstDamage, { isOvercharge: true });
        
        // Special properties for overcharge burst
        projectile.isOverchargeBurst = true;
        projectile.ignoresShields = this.overchargeBurst.ignoresShields;
        projectile.glowColor = '#ffff00'; // Bright yellow for overcharge burst
        projectile.size = 8; // Larger projectile
        
        game.projectiles.push(projectile);
        
        console.log('Overcharge Burst fired!');
    }
    
    /**
     * Create a projectile with current power-up modifications applied
     * 
     * @private
     * @param {number} angle - Projectile trajectory angle in radians
     * @param {number} damage - Base damage value
     * @returns {Projectile} Fully configured projectile instance
     */
    _createProjectile(game, angle, damage, options = {}) {
        let projectile;
        if (game.projectilePool) {
            projectile = game.projectilePool.get(
                this.x,
                this.y,
                angle,
                damage,
                this.projectileSpeedMod,
                options
            );
        } else {
            projectile = new Projectile(this.x, this.y, angle, damage, this.projectileSpeedMod);
            projectile.reset(this.x, this.y, angle, damage, this.projectileSpeedMod, options);
        }
		
        this._applyProjectileModifications(projectile);
        return projectile;
    }
    
    /**
     * Apply power-up modifications to a projectile instance
     * 
     * @private
     * @param {Projectile} projectile - Projectile to modify
     */
    _applyProjectileModifications(projectile) {
        if (this.piercingLevel > 0) {
            projectile.piercing = true;
            projectile.piercingCount = this.piercingLevel;
            projectile.originalDamage = projectile.damage; // Store original damage for reduction calculation
            projectile.enemiesHit = 0; // Track how many enemies this projectile has hit
        }
        
        if (this.explosiveShots) {
            projectile.explosive = true;
            projectile.explosionRadius = this.explosionRadius;
            projectile.explosionDamage = this.explosionDamage;
        }
        
        // Apply Shield Breaker effects
        if (this.hasShieldBreaker) {
            projectile.hasShieldBreaker = true;
            projectile.shieldBreakerDamage = this.shieldBreakerDamage;
            projectile.shieldRegenDelay = this.shieldRegenDelay;
        }
        
        // Apply Adaptive Targeting homing effect
        if (this.hasHomingShots) {
            projectile.hasHoming = true;
            projectile.homingStrength = 0.1; // Slight homing effect
        }
        
        // Apply Lucky Shots critical hit chance with external bonuses
        const baseCritChance = (this.luckyShots && this.luckyShots.active) ? this.luckyShots.chance : 0;
        const totalCritChance = Math.min(0.75, baseCritChance + (this.externalModifiers.critBonus || 0));
        if (totalCritChance > 0 && Math.random() < totalCritChance) {
            projectile.isCritical = true;
            projectile.damage *= 2; // Double damage for critical hits
            projectile.glowColor = '#ffff00';
            projectile.isCriticalVisual = true;
        }

        // DEX tracer: extend projectile trail glow when DEX is invested
        if (this.visualState.dexLevel > 0) {
            projectile.tracerLevel = this.visualState.dexLevel;
        }
    }
    
    /**
     * Create visual muzzle flash effect when firing
     * Spawns particles at the gun barrel tip
     * 
     * @param {import('./Game.js').Game} game - Game instance for adding particles
     */
    createMuzzleFlash(game) {
        // Calculate position at gun barrel tip
        const flashDistance = this.radius + GameConfig.PLAYER.MUZZLE_FLASH_DISTANCE;
        const flashX = this.x + Math.cos(this.angle) * flashDistance;
        const flashY = this.y + Math.sin(this.angle) * flashDistance;
        
        // Create small white particles with random spread using game's particle pool
        for (let i = 0; i < GameConfig.PLAYER.MUZZLE_FLASH_PARTICLES; i++) {
            const angle = this.angle + (Math.random() - 0.5) * 0.5; // ±0.25 radian spread
            const speed = 30 + Math.random() * 20; // 30-50 pixel/second speed
            const life = 100 + Math.random() * 100; // 100-200ms lifetime
            
            // Use game's particle pool instead of creating new Particle
            const particle = game.particlePool.get(
                flashX, flashY,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                life,
                '#fff'
            );
            
            game.particles.push(particle);
        }
    }
    
    /**
     * Apply damage to player, prioritizing shield absorption
     * Shield absorbs damage first, then health takes remaining damage
     * 
     * @param {number} amount - Total damage amount to apply
     * @throws {Error} If amount is negative
     * 
     * @example
     * player.takeDamage(25); // Applies 25 damage to shield first, then health
     */
    takeDamage(amount, source = 'generic') {
        if (amount < 0) {
            throw new Error('Damage amount cannot be negative');
        }

        if (source === 'enemyProjectile') {
            if (this.enemyProjectileIFrames > 0) {
                return;
            }
            this.enemyProjectileIFrames = this.enemyProjectileIFrameDuration;
        }
        
        // Check if Barrier Phase is active (invulnerability)
        if (this.barrierPhaseActive) {
            return; // No damage taken during barrier phase
        }
        
        // Shield absorbs damage first
        if (this.hasShield && this.shieldHp > 0) {
            const shieldDamage = Math.min(amount, this.shieldHp);
            this.shieldHp -= shieldDamage;
            amount -= shieldDamage;
            
            if (amount <= 0) return; // All damage absorbed by shield
        }
        
        this.hp -= amount;
        this.hp = Math.max(0, this.hp);

        // Trigger low-health defensive power-ups immediately after damage is applied.
        const healthRatio = this.maxHp > 0 ? (this.hp / this.maxHp) : 0;
        if (this.hasBarrierPhase && !this.barrierPhaseActive && this.barrierPhaseCooldown <= 0 && healthRatio <= this.barrierPhaseThreshold) {
            this.activateBarrierPhase();
        }

        if (this.emergencyHeal && this.emergencyHeal.active && this.emergencyHeal.cooldown <= 0 && healthRatio <= this.emergencyHeal.healThreshold) {
            this.activateEmergencyHeal();
        }
    }
    
    /**
     * Heal the player by specified amount, capped at maximum health
     * Creates visual floating text effect if available
     * 
     * @param {number} amount - Amount of health to restore
     * @throws {Error} If amount is negative
     * 
     * @example
     * player.heal(15); // Restores 15 HP, shows "+15 health" floating text
     */
    heal(amount) {
        if (amount < 0) {
            throw new Error('Heal amount cannot be negative');
        }
        
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }
    
    /**
     * Heal the player's shield by specified amount, capped at maximum
     * Only works if shield power-up is active
     * 
     * @param {number} amount - Amount of shield to restore
     * @returns {boolean} True if healing occurred, false if no shield
     */
    healShield(amount) {
        if (!this.hasShield) return false;
        this.shieldHp = Math.min(this.maxShieldHp, this.shieldHp + amount);
        return true;
    }
    
    /**
     * Activate Barrier Phase for temporary invulnerability
     * Player becomes invulnerable for a short duration
     */
    activateBarrierPhase() {
        this.barrierPhaseActive = true;
        this.barrierPhaseCooldown = this.barrierPhaseMaxCooldown;
        this.barrierPhaseDuration = 3000; // Reset duration to 3 seconds
        playSFX('player_barrier_on');
        
        // Visual indicator - could add particle effects here
        console.log('Barrier Phase activated! Invulnerable for 3 seconds!');
    }
    
    /**
     * Activate Emergency Heal to restore health
     * Automatically heals player when health is critically low
     */
    activateEmergencyHeal() {
        const healAmount = Math.floor(this.maxHp * this.emergencyHeal.healTarget);
        this.hp = Math.min(this.maxHp, healAmount);
        this.emergencyHeal.cooldown = this.emergencyHeal.maxCooldown;
        playSFX('player_heal');
        
        console.log(`Emergency Heal activated! Restored to ${Math.floor(this.emergencyHeal.healTarget * 100)}% health!`);
    }
    
    /**
     * Apply slow field effect to all enemies within range
     * Slows enemy movement based on stack count (15% per stack, max 90%)
     * 
     * @param {Array<import('./Enemy.js').Enemy>} enemies - Array of enemy objects to affect
     */
    applySlowField(enemies) {
        if (this.slowFieldStrength <= 0) return; // No slow field effect
        
        // Calculate effective slow factor with synergy bonuses (max 90% slow)
        const slowPercent = Math.min(0.9, (this.slowFieldStrength * 0.10) + this.slowFieldBonus);
        const slowFactor = Math.max(0.1, 1 - slowPercent);
        
        enemies.forEach(enemy => {
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= this.slowFieldRadius) {
                enemy.slowFactor = slowFactor;
            } else {
                enemy.slowFactor = 1; // Normal speed outside field
            }
        });
    }
    
    /**
     * Apply Immolation Aura burn damage to nearby enemies
     * Deals percentage-based damage over time to all enemies within range
     * 
     * @param {Array<Object>} enemies - Array of enemy objects to affect
     * @param {number} delta - Time elapsed since last frame (milliseconds)
     */
    applyImmolationAura(enemies, delta) {
        if (!this.immolationAura || !this.immolationAura.active) return;
        
        const damagePerSecond = this.immolationAura.damagePercent + this.immolationAuraBonus;
        const range = this.immolationAura.range;
        const deltaSeconds = delta / 1000;
        
        enemies.forEach(enemy => {
            if (enemy.dying) return; // Skip dying enemies
            
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= range) {
                // Apply burn damage as percentage of enemy's max health
                const burnDamage = enemy.maxHealth * damagePerSecond * deltaSeconds;
                enemy.takeDamage(burnDamage);
                enemy.isBurning = true;
            } else {
                enemy.isBurning = false;
            }
        });
    }

    /**
     * Apply a diminishing multiplicative boost to a stat.
     * Still used by SkillManager passive effects when stat stacking.
     * @param {string} statKey - Player property to multiply
     * @param {number} increase - Percentage increase (0.25 for +25%)
     */
    applyMultiplicativeBoost(statKey, increase) {
        this[statKey] *= (1 + increase);
    }
    
    /**
     * Handle life steal effect when an enemy is killed
     * 
     * @param {Object} enemy - The killed enemy object
     * @param {number} enemy.maxHealth - Enemy's maximum health value
     */
    onEnemyKill(enemy) {
        if (this.hasLifeSteal) {
            const healAmount = enemy.maxHealth * GameConfig.PLAYER.LIFE_STEAL_PERCENTAGE;
            this.heal(healAmount);
        }
    }

    /**
     * Get list of owned ability flags (for UI display)
     * 
     * @returns {string[]} Array of ability names currently active
     */
    getActiveAbilities() {
        const abilities = [];
        if (this.hasLifeSteal) abilities.push('Life Steal');
        if (this.explosiveShots) abilities.push('Explosive Shots');
        if (this.hasTripleShot) abilities.push('Triple Shot');
        if (this.piercingLevel > 0) abilities.push('Piercing');
        if (this.hasShield) abilities.push('Shield');
        if (this.hasSlowField) abilities.push('Slow Field');
        if (this.hasHomingShots) abilities.push('Homing');
        if (this.immolationAura?.active) abilities.push('Burn Aura');
        return abilities;
    }

    /**
     * Render the player and all associated visual effects
     * Draws player body, gun barrel, shield, slow field, immolation aura, and rotation indicators
     * Also renders attribute auras and skill-specific VFX based on visualState.
     * 
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
     */
    draw(ctx) {
        const vs = this.visualState;
        const auraCfg = GameConfig.VFX.PLAYER_AURAS;
        const now = Date.now();

        // ── PRE-BODY: Attribute auras drawn behind the player ──

        // STR radial gradient glow (behind body)
        if (vs.strLevel >= auraCfg.STR.GRADIENT_THRESHOLD) {
            ctx.save();
            const strT = Math.min(vs.strLevel / 50, 1);
            const gradRadius = this.radius + 10 + strT * 18;
            const pulse = 0.5 + 0.5 * Math.sin(now / 400);
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, gradRadius);
            gradient.addColorStop(0, `rgba(255, 69, 0, ${0.15 * strT * pulse})`);
            gradient.addColorStop(0.6, `rgba(255, 140, 0, ${0.08 * strT * pulse})`);
            gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, gradRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // VIT heartbeat pulse ring
        if (vs.vitLevel > 0) {
            ctx.save();
            const vitT = Math.min(vs.vitLevel / 50, 1);
            const cfg = auraCfg.VIT;
            const pulseFreq = cfg.BASE_PULSE_SPEED + vs.vitLevel * cfg.PULSE_SPEED_PER_POINT;
            const pulse = 0.5 + 0.5 * Math.sin(now * pulseFreq);
            const ringRadius = this.radius + cfg.RING_OFFSET + pulse * 4;
            const thickness = cfg.MIN_THICKNESS + vitT * (cfg.MAX_THICKNESS - cfg.MIN_THICKNESS);
            const alpha = cfg.MIN_ALPHA + vitT * (cfg.MAX_ALPHA - cfg.MIN_ALPHA);
            ctx.strokeStyle = cfg.color;
            ctx.lineWidth = thickness;
            ctx.globalAlpha = alpha * pulse;
            ctx.shadowColor = cfg.color;
            ctx.shadowBlur = 6 * vitT;
            ctx.beginPath();
            ctx.arc(this.x, this.y, ringRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // INT orbiting sparks
        if (vs.intLevel >= auraCfg.INT.POINTS_PER_SPARK) {
            ctx.save();
            const cfg = auraCfg.INT;
            const sparkCount = Math.min(cfg.MAX_SPARKS, Math.floor(vs.intLevel / cfg.POINTS_PER_SPARK));
            const orbitR = this.radius + cfg.ORBIT_RADIUS;
            const hasTrail = vs.intLevel >= cfg.TRAIL_THRESHOLD;
            for (let i = 0; i < sparkCount; i++) {
                const baseAngle = this._auraOrbitAngle + (Math.PI * 2 / sparkCount) * i;
                const sx = this.x + Math.cos(baseAngle) * orbitR;
                const sy = this.y + Math.sin(baseAngle) * orbitR;
                const color = cfg.colors[i % cfg.colors.length];
                // Trail afterglow
                if (hasTrail) {
                    const trailAngle = baseAngle - 0.3;
                    const tx = this.x + Math.cos(trailAngle) * orbitR;
                    const ty = this.y + Math.sin(trailAngle) * orbitR;
                    ctx.globalAlpha = 0.25;
                    ctx.fillStyle = color;
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 4;
                    ctx.beginPath();
                    ctx.arc(tx, ty, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 0.8;
                ctx.fillStyle = color;
                ctx.shadowColor = color;
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // LUCK golden sparkles
        if (this._luckSparkles.length > 0) {
            ctx.save();
            const cfg = auraCfg.LUCK;
            for (const sp of this._luckSparkles) {
                const t = 1 - sp.life / sp.maxLife;
                const scale = 1 - t * 0.5;
                ctx.globalAlpha = 1 - t;
                ctx.fillStyle = cfg.color;
                ctx.shadowColor = cfg.color;
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(sp.x, sp.y, cfg.SPARKLE_RADIUS * scale, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // ── BODY: Player triangle + glow ──
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Set glow effect - change color when rotating; STR amplifies glow
        const glowColor = this.isRotating ? '#ff6d00' : '#ff2dec';
        ctx.shadowColor = glowColor;
        const strGlowBoost = vs.strLevel * auraCfg.STR.GLOW_PER_POINT;
        ctx.shadowBlur = 15 + strGlowBoost;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // Flash pulse overlay when skill/attr purchased
        let bodyColor = this.isRotating ? '#ff6d00' : '#ff2dec';
        if (vs.flashTimer > 0) {
            const flashT = vs.flashTimer / auraCfg.PURCHASE.FLASH_DURATION;
            bodyColor = flashT > 0.5 ? '#ffffff' : bodyColor;
            ctx.shadowBlur = 15 + strGlowBoost + 20 * flashT;
        }

        // Volatile Kills shimmer — body alpha oscillates
        if (vs.learnedSkills.has('techno_volatile_kills')) {
            const shimmer = 0.9 + 0.1 * Math.sin(now / 1000 * Math.PI * 2 * auraCfg.SKILL_VFX.VOLATILE_SHIMMER_HZ);
            ctx.globalAlpha = shimmer;
        }

        // Elemental Synergy — glow alternates orange/cyan
        if (vs.learnedSkills.has('techno_elemental_synergy')) {
            const cycle = Math.floor(now / auraCfg.SKILL_VFX.SYNERGY_SWAP_INTERVAL) % 2;
            ctx.shadowColor = cycle === 0 ? '#ff8c00' : '#00e5ff';
        }

        ctx.fillStyle = bodyColor;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius * 0.7, -this.radius * 0.5);
        ctx.lineTo(-this.radius * 0.7, this.radius * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // ── GUN BARREL with skill-specific visual overlays ──
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(this.radius + 15, 0);
        ctx.stroke();

        // Gunner Sharp Rounds — red edge glow on barrel
        if (vs.learnedSkills.has('gunner_sharp_rounds')) {
            ctx.save();
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#ff4444';
            ctx.shadowBlur = 8;
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.moveTo(this.radius, 0);
            ctx.lineTo(this.radius + 15, 0);
            ctx.stroke();
            ctx.restore();
        }

        // Explosive Rounds — warm orange glow on barrel
        if (vs.learnedSkills.has('techno_explosive_rounds')) {
            ctx.save();
            ctx.strokeStyle = '#ff8c00';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#ff8c00';
            ctx.shadowBlur = 10;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.moveTo(this.radius + 2, 0);
            ctx.lineTo(this.radius + 15, 0);
            ctx.stroke();
            // Bigger Booms — intensify + ember dots
            if (vs.learnedSkills.has('techno_bigger_booms')) {
                ctx.globalAlpha = 0.9;
                ctx.shadowBlur = 14;
                const emberY = Math.sin(now / 150) * 3;
                ctx.fillStyle = '#ff8c00';
                ctx.beginPath();
                ctx.arc(this.radius + 12, emberY, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // Piercing Shots — through-line extending past barrel
        if (vs.learnedSkills.has('gunner_piercing')) {
            ctx.save();
            ctx.strokeStyle = '#88ccff';
            ctx.lineWidth = 1.5;
            ctx.shadowColor = '#88ccff';
            ctx.shadowBlur = 6;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.moveTo(this.radius + 15, 0);
            ctx.lineTo(this.radius + 28, 0);
            ctx.stroke();
            ctx.restore();
        }

        // Triple Shot — three fan dots
        if (vs.learnedSkills.has('gunner_triple_shot')) {
            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 4;
            ctx.globalAlpha = 0.6;
            const tipX = this.radius + 18;
            for (const spreadAngle of [-0.25, 0, 0.25]) {
                ctx.beginPath();
                ctx.arc(tipX * Math.cos(spreadAngle), tipX * Math.sin(spreadAngle), 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // Homing Rounds — crosshair ring at barrel tip
        if (vs.learnedSkills.has('gunner_homing')) {
            ctx.save();
            ctx.strokeStyle = '#ff2dec';
            ctx.lineWidth = 1;
            ctx.shadowColor = '#ff2dec';
            ctx.shadowBlur = 6;
            ctx.globalAlpha = 0.5 + 0.2 * Math.sin(now / 300);
            ctx.beginPath();
            ctx.arc(this.radius + 20, 0, 5, 0, Math.PI * 2);
            ctx.stroke();
            // Crosshair lines
            for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
                ctx.beginPath();
                ctx.moveTo(this.radius + 20 + Math.cos(a) * 3, Math.sin(a) * 3);
                ctx.lineTo(this.radius + 20 + Math.cos(a) * 7, Math.sin(a) * 7);
                ctx.stroke();
            }
            ctx.restore();
        }

        ctx.restore(); // End body+barrel local transform
        
        // ── POST-BODY: Attribute auras and skill effects in world space ──

        // STR fire wisps (orbiting)
        if (vs.strLevel >= auraCfg.STR.WISP_THRESHOLD) {
            ctx.save();
            const cfg = auraCfg.STR;
            const wispCount = Math.min(cfg.MAX_WISPS, 1 + Math.floor((vs.strLevel - cfg.WISP_THRESHOLD) / 10));
            const orbitR = this.radius + cfg.ORBIT_RADIUS;
            for (let i = 0; i < wispCount; i++) {
                const wAngle = this._auraOrbitAngle * 0.7 + (Math.PI * 2 / wispCount) * i;
                const wx = this.x + Math.cos(wAngle) * orbitR;
                const wy = this.y + Math.sin(wAngle) * orbitR;
                ctx.globalAlpha = 0.6 + 0.3 * Math.sin(now / 200 + i);
                ctx.fillStyle = i % 2 === 0 ? cfg.color : cfg.colorAlt;
                ctx.shadowColor = cfg.color;
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(wx, wy, 3, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // DEX speed lines when rotating
        if (vs.dexLevel > 0 && this.isRotating) {
            ctx.save();
            const cfg = auraCfg.DEX;
            const lineCount = Math.min(cfg.SPEED_LINES, Math.max(1, Math.floor(vs.dexLevel / 10)));
            const streakLen = 5 + vs.dexLevel * cfg.STREAK_LEN_PER_POINT;
            ctx.strokeStyle = cfg.color;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = cfg.color;
            ctx.shadowBlur = 4;
            const rotDir = this._getRotationDirection();
            for (let i = 0; i < lineCount; i++) {
                const offset = (Math.PI * 2 / lineCount) * i;
                const startAngle = this.angle + Math.PI + offset + rotDir * 0.3;
                const arcR = this.radius + 8 + i * 2;
                ctx.globalAlpha = 0.3 + 0.3 * (1 - i / lineCount);
                ctx.beginPath();
                ctx.arc(this.x, this.y, arcR, startAngle, startAngle + rotDir * streakLen / arcR);
                ctx.stroke();
            }
            ctx.restore();
        }

        // DEX target sweep arc
        if (vs.dexLevel > 0 && this._sweepTimer > 0) {
            ctx.save();
            const cfg = auraCfg.DEX;
            const t = this._sweepTimer / cfg.SWEEP_DURATION;
            ctx.strokeStyle = cfg.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5 * t;
            ctx.shadowColor = cfg.color;
            ctx.shadowBlur = 6;
            const sweepR = this.radius + 15;
            const fromAngle = this._lastTargetAngle;
            const toAngle = this.angle;
            ctx.beginPath();
            ctx.arc(this.x, this.y, sweepR, Math.min(fromAngle, toAngle), Math.max(fromAngle, toAngle));
            ctx.stroke();
            ctx.restore();
        }

        // Critical Mastery — periodic red spark flash
        if (vs.learnedSkills.has('gunner_critical_mastery') && this._critSparkTimer <= auraCfg.SKILL_VFX.CRIT_SPARK_DURATION) {
            ctx.save();
            const sparkT = this._critSparkTimer / auraCfg.SKILL_VFX.CRIT_SPARK_DURATION;
            ctx.fillStyle = '#ff4444';
            ctx.shadowColor = '#ff4444';
            ctx.shadowBlur = 15;
            ctx.globalAlpha = 1 - sparkT;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 4 + 6 * sparkT, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Chain Hit — intermittent lightning arcs around player
        if ((vs.learnedSkills.has('techno_chain_hit') || vs.learnedSkills.has('techno_chain_master')) && this._chainFlickerOn) {
            ctx.save();
            const isChainMaster = vs.learnedSkills.has('techno_chain_master');
            ctx.strokeStyle = isChainMaster ? '#aa44ff' : '#6666ff';
            ctx.lineWidth = isChainMaster ? 2 : 1.5;
            ctx.shadowColor = ctx.strokeStyle;
            ctx.shadowBlur = isChainMaster ? 10 : 6;
            ctx.globalAlpha = 0.7;
            // Draw 2-3 jagged arcs
            const arcCount = isChainMaster ? 3 : 2;
            for (let a = 0; a < arcCount; a++) {
                const baseA = (Math.PI * 2 / arcCount) * a + now * 0.001;
                ctx.beginPath();
                const r1 = this.radius + 6;
                ctx.moveTo(this.x + Math.cos(baseA) * r1, this.y + Math.sin(baseA) * r1);
                for (let seg = 1; seg <= 3; seg++) {
                    const segA = baseA + seg * 0.15;
                    const segR = r1 + seg * (isChainMaster ? 7 : 5) + (Math.random() - 0.5) * 4;
                    ctx.lineTo(this.x + Math.cos(segA) * segR, this.y + Math.sin(segA) * segR);
                }
                ctx.stroke();
            }
            ctx.restore();
        }

        // Meltdown — heat haze ring (concentric arc segments)
        if (vs.learnedSkills.has('techno_meltdown')) {
            ctx.save();
            ctx.strokeStyle = '#ff4500';
            ctx.lineWidth = 1;
            ctx.shadowColor = '#ff4500';
            ctx.shadowBlur = 4;
            ctx.globalAlpha = 0.25 + 0.15 * Math.sin(now / 200);
            const hazeR = this.radius + 25;
            for (let s = 0; s < 6; s++) {
                const sAngle = (Math.PI * 2 / 6) * s + now * 0.0008;
                ctx.beginPath();
                ctx.arc(this.x, this.y, hazeR + Math.sin(now / 150 + s) * 3, sAngle, sAngle + 0.4);
                ctx.stroke();
            }
            ctx.restore();
        }

        // Overcharge Burst — charging energy ring pulsing as cooldown refills
        if (vs.learnedSkills.has('gunner_overcharge') && this.overchargeBurst?.active) {
            ctx.save();
            const chargeT = 0.5 + 0.5 * Math.sin(now / 250);
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 1.5;
            ctx.shadowColor = '#ffaa00';
            ctx.shadowBlur = 8 * chargeT;
            ctx.globalAlpha = 0.3 + 0.3 * chargeT;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 14, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // ── Targeting indicator when rotating ──
        if (this.isRotating && this.targetAngle !== null && this.currentTarget) {
            ctx.save();
            ctx.strokeStyle = '#ff6d00';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.globalAlpha = 0.7;
            
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.currentTarget.x, this.currentTarget.y);
            ctx.stroke();
            
            ctx.strokeStyle = '#ff6d00';
            ctx.lineWidth = 3;
            ctx.setLineDash([]);
            ctx.globalAlpha = 0.5;
            
            const indicatorLength = this.radius + 25;
            const targetX = this.x + Math.cos(this.targetAngle) * indicatorLength;
            const targetY = this.y + Math.sin(this.targetAngle) * indicatorLength;
            
            ctx.beginPath();
            ctx.moveTo(this.x + Math.cos(this.targetAngle) * this.radius, 
                      this.y + Math.sin(this.targetAngle) * this.radius);
            ctx.lineTo(targetX, targetY);
            ctx.stroke();
            
            ctx.restore();
        }
        
        // ── Shield ──
        if (this.hasShield && this.shieldHp > 0) {
            ctx.save();
            ctx.strokeStyle = '#0ff';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#0ff';
            ctx.shadowBlur = 10;
            
            const shieldRadius = this.radius + 10;
            const shieldAlpha = this.shieldHp / this.maxShieldHp;
            ctx.globalAlpha = shieldAlpha * 0.7;
            
            ctx.beginPath();
            ctx.arc(this.x, this.y, shieldRadius, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.restore();
        }
        
        // ── Slow field ──
        if (this.hasSlowField && this.slowFieldStrength > 0) {
            ctx.save();
            ctx.strokeStyle = '#8f00ff';
            ctx.lineWidth = Math.max(2, this.slowFieldStrength);
            ctx.shadowColor = '#8f00ff';
            ctx.shadowBlur = 5 + this.slowFieldStrength;
            ctx.globalAlpha = 0.2 + (this.slowFieldStrength * 0.05);
            
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.slowFieldRadius, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.restore();
        }
        
        // ── Immolation Aura ──
        if (this.immolationAura && this.immolationAura.active) {
            ctx.save();
            
            const pulseIntensity = 0.5 + 0.5 * Math.sin(now / 300);
            
            const gradient = ctx.createRadialGradient(
                this.x, this.y, 0,
                this.x, this.y, this.immolationAura.range
            );
            gradient.addColorStop(0, `rgba(255, 69, 0, ${0.3 * pulseIntensity})`);
            gradient.addColorStop(0.5, `rgba(255, 140, 0, ${0.2 * pulseIntensity})`);
            gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.immolationAura.range, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = `rgba(255, 69, 0, ${pulseIntensity * 0.8})`;
            ctx.lineWidth = 2;
            ctx.shadowColor = '#ff4500';
            ctx.shadowBlur = 12;
            
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.immolationAura.range, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.restore();
        }
        
        // ── Barrier Phase ──
        if (this.barrierPhaseActive) {
            ctx.save();
            
            const shimmerIntensity = 0.7 + 0.3 * Math.sin(now / 100);
            const barrierRadius = this.radius + 25;
            
            ctx.strokeStyle = `rgba(255, 255, 255, ${shimmerIntensity})`;
            ctx.lineWidth = 4;
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 20;
            
            ctx.beginPath();
            ctx.arc(this.x, this.y, barrierRadius, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.strokeStyle = `rgba(200, 200, 255, ${shimmerIntensity * 0.6})`;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            
            ctx.beginPath();
            ctx.arc(this.x, this.y, barrierRadius - 8, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.restore();
        }
    }

    /**
     * Update visual effect timers each frame.
     * @private
     * @param {number} delta - ms since last frame
     */
    _updateVisualTimers(delta) {
        const vs = this.visualState;
        const auraCfg = GameConfig.VFX.PLAYER_AURAS;

        // Orbit angle for INT sparks and STR wisps
        this._auraOrbitAngle += (auraCfg.INT.ORBIT_SPEED * delta) / 1000;

        // Flash pulse decay
        if (vs.flashTimer > 0) {
            vs.flashTimer = Math.max(0, vs.flashTimer - delta);
        }

        // DEX sweep decay
        if (this._sweepTimer > 0) {
            this._sweepTimer = Math.max(0, this._sweepTimer - delta);
        }

        // Critical Mastery spark timer
        if (vs.learnedSkills.has('gunner_critical_mastery')) {
            this._critSparkTimer += delta;
            if (this._critSparkTimer > auraCfg.SKILL_VFX.CRIT_SPARK_INTERVAL) {
                this._critSparkTimer = 0;
            }
        }

        // Chain Hit lightning flicker
        if (vs.learnedSkills.has('techno_chain_hit') || vs.learnedSkills.has('techno_chain_master')) {
            this._chainFlickerTimer += delta;
            if (this._chainFlickerTimer >= this._chainFlickerNext) {
                this._chainFlickerOn = !this._chainFlickerOn;
                this._chainFlickerTimer = 0;
                const cfg = auraCfg.SKILL_VFX;
                this._chainFlickerNext = this._chainFlickerOn
                    ? 80 + Math.random() * 120 // on duration: short
                    : cfg.CHAIN_FLICKER_MIN + Math.random() * (cfg.CHAIN_FLICKER_MAX - cfg.CHAIN_FLICKER_MIN);
            }
        }

        // LUCK sparkle spawning & lifecycle
        if (vs.luckLevel > 0) {
            const cfg = auraCfg.LUCK;
            if (this._luckSparkles.length < cfg.MAX_SPARKLES && Math.random() < vs.luckLevel * cfg.CHANCE_PER_POINT) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * cfg.SPAWN_RADIUS;
                const life = cfg.MIN_LIFE + Math.random() * (cfg.MAX_LIFE - cfg.MIN_LIFE);
                this._luckSparkles.push({
                    x: this.x + Math.cos(angle) * dist,
                    y: this.y + Math.sin(angle) * dist,
                    life,
                    maxLife: life,
                });
            }
            for (let i = this._luckSparkles.length - 1; i >= 0; i--) {
                this._luckSparkles[i].life -= delta;
                if (this._luckSparkles[i].life <= 0) {
                    this._luckSparkles.splice(i, 1);
                }
            }
        }
    }

    /**
     * Get the current rotation direction (+1 = CCW, -1 = CW).
     * @private
     * @returns {number}
     */
    _getRotationDirection() {
        if (this.targetAngle === null) return 1;
        let diff = this.targetAngle - this.angle;
        // Normalize to [-PI, PI]
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return diff >= 0 ? 1 : -1;
    }
}
