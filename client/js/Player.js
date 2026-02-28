import { Projectile } from './Projectile.js';
import { GameConfig } from './config/GameConfig.js';
import { playSFX } from './main.js';
import { MathUtils } from './utils/MathUtils.js';
import { renderPlayer, updatePlayerVisualTimers } from './ui/PlayerRenderer.js';

/**
 * Player character class for Neon Siege
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
     * Default values for all combat flags and ability properties.
     * Shared by _initializeCombatFlags() and reset() to avoid drift.
     * @type {Object}
     */
    static _COMBAT_DEFAULTS = Object.freeze({
        piercingLevel: 0,
        hasTripleShot: false,
        tripleShotSideDamage: 1.0,
        hasLifeSteal: false,
        hasSlowField: false,
        hasShield: false,
        explosiveShots: false,
        shieldHp: 0,
        maxShieldHp: 0,
        hpRegen: 0,
        shieldRegen: 0,
        explosionRadius: 50,
        explosionDamage: 20,
        luckyShots: null,
        slowFieldRadius: GameConfig.PLAYER.SLOW_FIELD_BASE_RADIUS,
        slowFieldStrength: 0,
        maxSlowFieldStacks: GameConfig.PLAYER.MAX_SLOW_FIELD_STACKS,
        slowFieldBonus: 0,
        immolationAura: null,
        immolationAuraBonus: 0,
        hasShieldBreaker: false,
        shieldBreakerDamage: 1.0,
        shieldRegenDelay: 0,
        shieldBreakerStacks: 0,
        hasAdaptiveTargeting: false,
        targetingRange: 200,
        hasHomingShots: false,
        hasBarrierPhase: false,
        barrierPhaseCooldown: 0,
        barrierPhaseMaxCooldown: 60000,
        barrierPhaseDuration: 3000,
        barrierPhaseActive: false,
        barrierPhaseThreshold: 0.25,
        overchargeBurst: null,
        emergencyHeal: null,
        _ascensionLifeSteal: 0,
        _ascensionEffects: null,
        // Ascension plugin pipeline fields
        ricochetEnabled: false,
        globalEnemySlow: 0,
        berserker: null,
        _damageTakenMultiplier: 1,
        _damageReduction: 0,
        _cooldownMultiplier: 1,
        _scoreMultiplier: 1,
        _lootChanceMultiplier: 1,
        _xpMultiplier: 1,
        _shieldJustBroke: false,
        chainHit: null,
        volatileKills: null,
        elementalSynergy: null,
        meltdown: null,
    });
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

        // Movement state (for visual feedback in renderer)
        /** @type {boolean} Whether the player is currently moving via WASD/arrows */
        this.isMoving = false;
        /** @type {number} Movement velocity X in px/s (for renderer thruster direction) */
        this.moveVx = 0;
        /** @type {number} Movement velocity Y in px/s (for renderer thruster direction) */
        this.moveVy = 0;
        
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
        /** @type {number} Movement speed multiplier (from DEX attribute) */
        this.moveSpeedMod = 1;
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
        const d = Player._COMBAT_DEFAULTS;

        // ── Combat abilities (set externally by Game._syncPlayerFromSkills) ──
        /** @type {number} */ this.piercingLevel = d.piercingLevel;
        /** @type {boolean} */ this.hasTripleShot = d.hasTripleShot;
        /** @type {number} */ this.tripleShotSideDamage = d.tripleShotSideDamage;
        /** @type {boolean} */ this.hasLifeSteal = d.hasLifeSteal;
        /** @type {boolean} */ this.hasSlowField = d.hasSlowField;
        /** @type {boolean} */ this.hasShield = d.hasShield;
        /** @type {boolean} */ this.explosiveShots = d.explosiveShots;
        /** @type {number} */ this.shieldHp = d.shieldHp;
        /** @type {number} */ this.maxShieldHp = d.maxShieldHp;
        /** @type {number} */ this.hpRegen = d.hpRegen;
        /** @type {number} */ this.shieldRegen = d.shieldRegen;
        /** @type {number} */ this.explosionRadius = d.explosionRadius;
        /** @type {number} */ this.explosionDamage = d.explosionDamage;
        /** @type {?{chance:number, active:boolean, critDamageMultiplier?:number}} */ this.luckyShots = d.luckyShots;
        /** @type {number} */ this.slowFieldRadius = d.slowFieldRadius;
        /** @type {number} */ this.slowFieldStrength = d.slowFieldStrength;
        /** @type {number} */ this.maxSlowFieldStacks = d.maxSlowFieldStacks;
        /** @type {number} */ this.slowFieldBonus = d.slowFieldBonus;
        /** @type {?{active:boolean, range:number, damagePercent:number}} */ this.immolationAura = d.immolationAura;
        /** @type {number} */ this.immolationAuraBonus = d.immolationAuraBonus;
        /** @type {boolean} */ this.hasShieldBreaker = d.hasShieldBreaker;
        /** @type {number} */ this.shieldBreakerDamage = d.shieldBreakerDamage;
        /** @type {number} */ this.shieldRegenDelay = d.shieldRegenDelay;
        /** @type {number} */ this.shieldBreakerStacks = d.shieldBreakerStacks;
        /** @type {boolean} */ this.hasAdaptiveTargeting = d.hasAdaptiveTargeting;
        /** @type {number} */ this.targetingRange = d.targetingRange;
        /** @type {boolean} */ this.hasHomingShots = d.hasHomingShots;
        /** @type {boolean} */ this.hasBarrierPhase = d.hasBarrierPhase;
        /** @type {number} */ this.barrierPhaseCooldown = d.barrierPhaseCooldown;
        /** @type {number} */ this.barrierPhaseMaxCooldown = d.barrierPhaseMaxCooldown;
        /** @type {number} */ this.barrierPhaseDuration = d.barrierPhaseDuration;
        /** @type {boolean} */ this.barrierPhaseActive = d.barrierPhaseActive;
        /** @type {number} */ this.barrierPhaseThreshold = d.barrierPhaseThreshold;
        /** @type {?{active:boolean, interval:number, multiplier:number, shotCount:number, shotCounter?:number, burstInterval?:number, burstDamageMultiplier?:number, ignoresShields?:boolean}} */ this.overchargeBurst = d.overchargeBurst;
        /** @type {?{active:boolean, healThreshold:number, healTarget:number, cooldown:number, maxCooldown:number}} */ this.emergencyHeal = d.emergencyHeal;
        /** @type {number} */ this._ascensionLifeSteal = d._ascensionLifeSteal;
        /** @type {?Object} */ this._ascensionEffects = d._ascensionEffects;
        /** @type {?{chance:number, range:number, escalation:number}} */ this.chainHit = d.chainHit;
        /** @type {?Object} */ this.volatileKills = d.volatileKills;
        /** @type {?{bonus:number}} */ this.elementalSynergy = d.elementalSynergy;
        /** @type {?Object} */ this.meltdown = d.meltdown;

        // ── Ascension plugin pipeline fields ──
        /** @type {boolean} */ this.ricochetEnabled = d.ricochetEnabled;
        /** @type {number} */ this.globalEnemySlow = d.globalEnemySlow;
        /** @type {?Object} */ this.berserker = d.berserker;
        /** @type {number} */ this._damageTakenMultiplier = d._damageTakenMultiplier;
        /** @type {number} */ this._damageReduction = d._damageReduction;
        /** @type {number} */ this._cooldownMultiplier = d._cooldownMultiplier;
        /** @type {number} */ this._scoreMultiplier = d._scoreMultiplier;
        /** @type {number} */ this._lootChanceMultiplier = d._lootChanceMultiplier;
        /** @type {number} */ this._xpMultiplier = d._xpMultiplier;
        /** @type {boolean} */ this._shieldJustBroke = d._shieldJustBroke;

		/** @type {boolean} God mode — blocks all damage (set by LootSystem buff or DevPanel) */
		this._godModeActive = false;

		// ── Active skill buff state ──
		/** @type {Object} Active skill buffs keyed by name, each with its own timer/state */
		this._skillBuffs = {};

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

        this.isMoving = false;
        this.moveVx = 0;
        this.moveVy = 0;

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
        this.moveSpeedMod = 1;
        this.rotationSpeedMod = 1;
        this.persistentCritBonus = 0;

        // Apply shared combat defaults (keeps init and reset in sync)
        Object.assign(this, Player._COMBAT_DEFAULTS);

        // Reset skill buffs
        this._skillBuffs = {};
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

        // Handle WASD / Arrow key movement
        this._updateMovement(delta, input, game);
        
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
     * Handle WASD / Arrow key movement each frame.
     * Clamps the player position to stay within the visible canvas.
     *
     * @private
     * @param {number} delta - ms since last frame
     * @param {Object} input - Input state with `keys` map
     * @param {import('./Game.js').Game} game
     */
    _updateMovement(delta, input, game) {
        if (!input?.keys) {
            this.isMoving = false;
            this.moveVx = 0;
            this.moveVy = 0;
            return;
        }

        let dx = 0;
        let dy = 0;

        if (input.keys['KeyW'] || input.keys['ArrowUp'])    dy -= 1;
        if (input.keys['KeyS'] || input.keys['ArrowDown'])  dy += 1;
        if (input.keys['KeyA'] || input.keys['ArrowLeft'])  dx -= 1;
        if (input.keys['KeyD'] || input.keys['ArrowRight']) dx += 1;

        if (dx === 0 && dy === 0) {
            this.isMoving = false;
            this.moveVx = 0;
            this.moveVy = 0;
            return;
        }

        // Normalize diagonal movement
        const len = Math.sqrt(dx * dx + dy * dy);
        dx /= len;
        dy /= len;

        const pressureScale = game?.getPressureScale?.() || 1;
        const speed = GameConfig.PLAYER.MOVE_SPEED * this.moveSpeedMod * pressureScale * (delta / 1000);
        this.x += dx * speed;
        this.y += dy * speed;

        // Store velocity for renderer (px/s, normalized direction × move speed)
        this.isMoving = true;
        this.moveVx = dx * GameConfig.PLAYER.MOVE_SPEED * this.moveSpeedMod * pressureScale;
        this.moveVy = dy * GameConfig.PLAYER.MOVE_SPEED * this.moveSpeedMod * pressureScale;

        // Clamp to canvas bounds
        const { width: cw, height: ch } = game.getLogicalCanvasSize();
        this.x = Math.max(this.radius, Math.min(cw - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(ch - this.radius, this.y));
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
        
        for (let eIdx = 0; eIdx < enemies.length; eIdx++) {
            const enemy = enemies[eIdx];
            if (enemy.dying) continue; // Skip enemies already dying
            
            // Skip enemies outside the visible targeting area
            if (enemy.x < minX || enemy.x > maxX || enemy.y < minY || enemy.y > maxY) {
                continue;
            }
            
            const distance = this._calculateDistanceSqTo(enemy);
            // Lower health enemies get higher priority (lower score)
            const healthFactor = (enemy.maxHealth - enemy.health) * 0.1;
            const priority = distance - healthFactor * healthFactor;
            
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
        return MathUtils.distance(this.x, this.y, entity.x, entity.y);
    }

    /**
     * Calculate squared distance to another entity (avoids sqrt — use for comparisons only)
     * @private
     * @param {Object} entity
     * @returns {number}
     */
    _calculateDistanceSqTo(entity) {
        return MathUtils.distanceSquared(this.x, this.y, entity.x, entity.y);
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
        return Math.max(this.baseFireRate / mod, GameConfig.BALANCE.MIN_BASIC_FIRE_INTERVAL_MS);
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

        // Side projectile damage
        const damageModifier = this.tripleShotSideDamage || 0.75;

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

        // Emit projectile:fired event for ascension plugins (EchoStrikePlugin, etc.)
        if (game.eventBus && !options.isEcho) {
            game.eventBus.emit('projectile:fired', { projectile, angle, damage: projectile.damage });
        }

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

        // Ricochet: allow projectile to bounce off walls once
        if (this.ricochetEnabled) {
            projectile.ricochetBounces = 1;
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

        // God mode — set by LootSystem legendary buff or DevPanel
        if (this._godModeActive) {
            return;
        }

        // Apply ascension damage modifiers (Overclock: damageTaken multiplier, Resilience: damage reduction)
        if (this._damageTakenMultiplier && this._damageTakenMultiplier !== 1) {
            amount *= this._damageTakenMultiplier;
        }
        if (this._damageReduction && this._damageReduction > 0) {
            amount *= (1 - this._damageReduction);
        }
        
        // Shield absorbs damage first
        if (this.hasShield && this.shieldHp > 0) {
            const shieldDamage = Math.min(amount, this.shieldHp);
            const shieldHpBefore = this.shieldHp;
            this.shieldHp -= shieldDamage;
            amount -= shieldDamage;

            // Flag shield break for callers to emit shield:broken event
            if (shieldHpBefore > 0 && this.shieldHp <= 0) {
                this._shieldJustBroke = true;
            }
            
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
            const distance = MathUtils.distance(this.x, this.y, enemy.x, enemy.y);
            
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
            
            const distance = MathUtils.distance(this.x, this.y, enemy.x, enemy.y);
            
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
     * Render the player and all associated visual effects.
     * Delegates to the standalone PlayerRenderer module.
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        renderPlayer(ctx, this);
    }

    /**
     * Update visual effect timers each frame.
     * Delegates to the standalone PlayerRenderer module.
     * @param {number} delta - ms since last frame
     */
    _updateVisualTimers(delta) {
        updatePlayerVisualTimers(this, delta);
    }
}
