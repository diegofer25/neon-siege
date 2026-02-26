/**
 * @fileoverview Projectile system for Neon Siege.
 * Handles different types of projectiles including standard, piercing, and explosive bullets.
 */

import { game } from './main.js';
import { GameConfig } from './config/GameConfig.js';
import { vfxHelper } from './managers/VFXHelper.js';
const createFloatingText = vfxHelper.createFloatingText.bind(vfxHelper);
import { MathUtils } from './utils/MathUtils.js';
import { dealAreaDamage } from './utils/AOEUtils.js';

/**
 * Represents a projectile fired by towers in the game.
 * Supports multiple projectile types with different behaviors and visual effects.
 * 
 * @class Projectile
 * @example
 * // Create a standard projectile
 * const bullet = new Projectile(100, 100, Math.PI/4, 25);
 * 
 * // Create using factory methods
 * const piercingBullet = Projectile.createPiercing(100, 100, 0, 30);
 */
export class Projectile {
    /**
     * Creates a new projectile instance.
     * 
     * @param {number} x - Initial X position
     * @param {number} y - Initial Y position  
     * @param {number} angle - Launch angle in radians
     * @param {number} damage - Base damage value
     * @param {number} [speedMod=1] - Speed modifier (1.0 = normal speed)
     */
    constructor(x, y, angle, damage, speedMod = 1) {
        // Static configuration
        this.baseSpeed = GameConfig.PLAYER.BASE_PROJECTILE_SPEED;
        this.radius = 5;
        this.trailLength = 8;
        this.trail = new Array(this.trailLength);
        for (let i = 0; i < this.trailLength; i++) this.trail[i] = { x: 0, y: 0 };
        this._trailHead = 0;
        this._trailCount = 0;
        this.hitEnemyIds = [];

        // Lifecycle defaults
        this.maxLifetime = 3000;

        // Initialize special property placeholders
        this.hasShieldBreaker = false;
        this.shieldBreakerDamage = 1.0;
        this.shieldRegenDelay = 0;
        this.hasHoming = false;
        this.homingStrength = 0;

        this.reset(x, y, angle, damage, speedMod);
        this._fromPool = false;
    }

    /**
     * Reset projectile state for reuse with object pools
     * @param {number} x
     * @param {number} y
     * @param {number} angle
     * @param {number} damage
     * @param {number} speedMod
     * @param {Object} [options={}]
     */
    reset(x, y, angle, damage, speedMod = 1, options = {}) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.damage = damage;
        this.originalDamage = damage;
        this.speed = this.baseSpeed * speedMod;
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;

        this.isExtra = !!options.isExtra;
        this.isEnemyProjectile = !!options.isEnemyProjectile;
        this.isOverchargeBurst = !!options.isOvercharge;
        this.ignoresShields = !!options.ignoresShields;
        this.size = options.size || this.radius;

        this.piercing = false;
        this.piercingCount = 0;
        this.enemiesHit = 0;
        this.hitEnemyIds.length = 0;
        this.explosive = false;
        this.explosionRadius = 50;
        this.explosionDamage = 20;
        this.exploded = false;

        this.color = '#fff';
        this.glowColor = '#fff';
        this._trailHead = 0;
        this._trailCount = 0;

        this.lifetime = 0;
        this._destroy = false;
        this.isCritical = false;
        this.isCriticalVisual = false;

        this.hasShieldBreaker = false;
        this.shieldBreakerDamage = 1.0;
        this.shieldRegenDelay = 0;
        this.hasHoming = false;
        this.homingStrength = 0;

        // Chain explosion tracking (prevents infinite chain loops)
        this._isChainExplosion = false;
        this._chainBounce = 0;

        // DEX tracer level (0 = no tracer, higher = longer glow trail)
        this.tracerLevel = 0;

        // Ricochet: number of wall bounces remaining (set by Player._applyProjectileModifications)
        this.ricochetBounces = 0;

        // Echo flag: prevents recursive echo duplication
        this._isEcho = false;

        // Homing throttle state
        this._homingFrame = 0;
        this._homingTarget = null;
    }
    
    /**
     * Calculates the current damage this projectile should deal based on piercing mechanics.
     * For piercing projectiles, damage decreases by 25% for each enemy hit.
     * First hit: 100% damage, Second hit: 75% damage, Third hit: 50% damage, etc.
     *
     * @returns {number} The current damage this projectile should deal
     */
    getCurrentDamage() {
        if (!this.piercing) {
            return this.damage;
        }

        // Calculate damage reduction: 25% less damage for each enemy hit
        const damageReduction = this.enemiesHit * 0.25;
        const currentDamageMultiplier = Math.max(0, 1 - damageReduction);

        return this.damage * currentDamageMultiplier;
    }
    
    /**
     * Updates the projectile's position, lifetime, and visual effects.
     * Called once per frame by the game loop.
     * 
     * @param {number} delta - Time elapsed since last frame in milliseconds
     */
    update(delta) {
        // Skip position updates if game is not playing
        if (game && game.gameState !== 'playing') return;
        
        // Apply basic homing if enabled
        if (this.hasHoming && this.homingStrength > 0 && game && game.enemies) {
            this.applyHoming(game.enemies, delta);
        }
        
        // Update position using velocity and frame time
        // Convert from pixels per second to pixels per frame
        // Scale by arenaScale so projectiles traverse the screen in consistent
        // proportional time regardless of viewport size (matches enemy scaling).
        const arenaScale = game?.getArenaScale?.() || 1;
        this.x += this.vx * arenaScale * (delta / 1000);
        this.y += this.vy * arenaScale * (delta / 1000);
        
        // Track projectile age for automatic cleanup
        this.lifetime += delta;
        if (this.lifetime > this.maxLifetime) {
            this._destroy = true;
        }
        
        // Maintain visual trail via ring buffer (zero allocation)
        const slot = (this._trailHead + this._trailCount) % this.trailLength;
        this.trail[slot].x = this.x;
        this.trail[slot].y = this.y;
        if (this._trailCount < this.trailLength) {
            this._trailCount++;
        } else {
            this._trailHead = (this._trailHead + 1) % this.trailLength;
        }
    }
    
    /**
     * Apply basic homing behavior to track nearby enemies.
     * Throttled: only recalculates nearest target every 3 frames.
     * 
     * @param {Array.<import('./Enemy.js').Enemy>} enemies - Array of enemy objects
     * @param {number} delta - Time elapsed since last frame
     */
    applyHoming(enemies, delta) {
        this._homingFrame++;

        // On non-scan frames, steer toward cached target if still alive
        if (this._homingFrame % 3 !== 0 && this._homingTarget) {
            const target = this._homingTarget;
            if (target.dying || target.health <= 0) {
                this._homingTarget = null;
            } else {
                this._steerToward(target, delta);
                return;
            }
        }

        // Full nearest-enemy search (runs every 3rd frame or when cache is stale)
        let nearestEnemy = null;
        let nearestDistSq = 150 * 150; // Only home within 150 pixels

        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (enemy.dying) continue;

            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < nearestDistSq) {
                nearestDistSq = distSq;
                nearestEnemy = enemy;
            }
        }

        this._homingTarget = nearestEnemy;
        if (nearestEnemy) {
            this._steerToward(nearestEnemy, delta);
        }
    }

    /**
     * Steer velocity toward a target entity.
     * @private
     * @param {{ x: number, y: number }} target
     * @param {number} delta
     */
    _steerToward(target, delta) {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const distSq = dx * dx + dy * dy;

        if (distSq > 0) {
            const distance = Math.sqrt(distSq);
            const desiredVx = (dx / distance) * this.speed;
            const desiredVy = (dy / distance) * this.speed;

            const strength = this.homingStrength * (delta / 1000);
            this.vx = this.vx * (1 - strength) + desiredVx * strength;
            this.vy = this.vy * (1 - strength) + desiredVy * strength;

            const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (currentSpeed > 0) {
                this.vx = (this.vx / currentSpeed) * this.speed;
                this.vy = (this.vy / currentSpeed) * this.speed;
            }
        }
    }
    
    /**
     * Checks if the projectile has moved outside the visible game area.
     * If ricochet bounces remain, reflects off screen edges instead of being destroyed.
     * 
     * @param {HTMLCanvasElement} canvas - The game canvas element
     * @returns {boolean} True if projectile is outside screen bounds and has no bounces left
     */
    isOffScreen(canvas) {
        const margin = 50; // Extra margin to account for projectile size
        const canvasWidth = canvas.logicalWidth || canvas.width;
        const canvasHeight = canvas.logicalHeight || canvas.height;

        // If ricochet bounces remain, reflect off walls instead of dying
        if (this.ricochetBounces > 0) {
            let bounced = false;
            if (this.x < 0) { this.x = 0; this.vx = Math.abs(this.vx); bounced = true; }
            else if (this.x > canvasWidth) { this.x = canvasWidth; this.vx = -Math.abs(this.vx); bounced = true; }
            if (this.y < 0) { this.y = 0; this.vy = Math.abs(this.vy); bounced = true; }
            else if (this.y > canvasHeight) { this.y = canvasHeight; this.vy = -Math.abs(this.vy); bounced = true; }
            if (bounced) {
                this.ricochetBounces--;
                this.angle = Math.atan2(this.vy, this.vx);
                return false;
            }
        }

        return (
            this.x < -margin ||
            this.x > canvasWidth + margin ||
            this.y < -margin ||
            this.y > canvasHeight + margin
        );
    }
    
    /**
     * Triggers explosion effect if this is an explosive projectile.
     * Damages all enemies within explosion radius and creates visual effects.
     * 
     * @param {import('./Game.js').Game} game - The main game instance for accessing enemies and effects
     * @param {number | null} excludedEnemyId - Enemy id to exclude from AoE (typically direct-hit target)
     */
    explode(game, excludedEnemyId = null) {
        if (!this.explosive) return;
        if (this.exploded) return;
        this.exploded = true;
        game.trace('explosion.start', {
            x: this.x,
            y: this.y,
            radius: this.explosionRadius,
            excludedEnemyId
        });
        
        // Generate visual explosion particles
        game.createExplosion(this.x, this.y, 12);
        
        // Create visual explosion ring to show blast radius
        game.createExplosionRing(this.x, this.y, this.explosionRadius);
        
        // Apply area damage to all enemies within explosion radius
        const synergy = game.player?.elementalSynergy;
        const hitEnemies = dealAreaDamage(game.enemies, this.x, this.y, this.explosionRadius, {
            excludeId: excludedEnemyId,
            calcDamage: (enemy, dist) => {
                let dmg = this.explosionDamage * (1 - dist / this.explosionRadius);
                if (synergy && enemy.isBurning) dmg *= (1 + synergy.bonus);
                return dmg;
            },
        });

        // Floating text for each hit
        for (const hit of hitEnemies) {
            const screen = MathUtils.canvasToScreen(game.canvas, hit.enemy.x, hit.enemy.y);
            createFloatingText(`-${hit.damage.toFixed(1)}`, screen.x, screen.y, 'damage');
        }

        // Chain Hit: chance to chain explosion to a nearby enemy
        const chainHit = game.player?.chainHit;
        if (chainHit && hitEnemies.length > 0 && !this._isChainExplosion) {
            const chainChance = chainHit.chance;
            if (Math.random() < chainChance) {
                // Find nearest enemy NOT already hit by this explosion
                const hitIds = new Set(hitEnemies.map(h => h.enemy.id));
                if (excludedEnemyId !== null) hitIds.add(excludedEnemyId);
                let nearest = null;
                let nearestDist = Infinity;
                for (const enemy of game.enemies) {
                    if (hitIds.has(enemy.id) || enemy.dying || enemy.health <= 0) continue;
                    const dx = enemy.x - this.x;
                    const dy = enemy.y - this.y;
                    const dist = dx * dx + dy * dy;
                    if (dist <= chainHit.range * chainHit.range && dist < nearestDist) {
                        nearestDist = dist;
                        nearest = enemy;
                    }
                }
                if (nearest) {
                    // Chain Master: escalating damage per bounce
                    const bounceNum = (this._chainBounce || 0) + 1;
                    const escalation = chainHit.escalation || 0;
                    const chainDamage = this.explosionDamage * (1 + escalation * bounceNum);

                    game.createExplosion(nearest.x, nearest.y, 8);
                    game.createExplosionRing(nearest.x, nearest.y, this.explosionRadius * 0.7);

                    // Apply chain damage to the target
                    nearest.takeDamage(chainDamage);

                    // If Chain Master allows further chaining, attempt another bounce
                    if (escalation > 0 && Math.random() < chainChance) {
                        // Re-use explode logic for further chains
                        const furtherHitIds = new Set([...hitIds, nearest.id]);
                        let nextNearest = null;
                        let nextDist = Infinity;
                        for (const enemy of game.enemies) {
                            if (furtherHitIds.has(enemy.id) || enemy.dying || enemy.health <= 0) continue;
                            const ddx = enemy.x - nearest.x;
                            const ddy = enemy.y - nearest.y;
                            const d = ddx * ddx + ddy * ddy;
                            if (d <= chainHit.range * chainHit.range && d < nextDist) {
                                nextDist = d;
                                nextNearest = enemy;
                            }
                        }
                        if (nextNearest) {
                            const nextDamage = chainDamage * (1 + escalation);
                            nextNearest.takeDamage(nextDamage);
                            game.createExplosion(nextNearest.x, nextNearest.y, 6);
                            game.createExplosionRing(nextNearest.x, nextNearest.y, this.explosionRadius * 0.5);
                        }
                    }
                }
            }
        }

        // Add screen shake effect for impact feedback
        game.addScreenShake(5, 200);
    }
    
    /**
     * Render the projectile with appropriate visual effects
     * 
     * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
     */
    draw(ctx) {
        // Fake glow: larger semi-transparent circle behind the body (replaces shadowBlur)
        const glowAlpha = this.isCriticalVisual ? 0.35 : 0.2;
        const glowRadius = this.isCriticalVisual ? 12 : 8;
        const glowColor = this.isCriticalVisual ? this.glowColor : '#fff';
        ctx.globalAlpha = glowAlpha;
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.arc(this.x, this.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // Different colors and sizes for special projectiles
        let fillColor = '#fff';
        let strokeColor = '#fff';
        let lineWidth = 2;
        let drawSize = 4;
        
        if (this.isOverchargeBurst) {
            // Overcharge burst - bright yellow/gold
            fillColor = this.glowColor || '#ffff00';
            strokeColor = '#ffaa00';
            lineWidth = 4;
            drawSize = this.size || 8;
        } else if (this.isCriticalVisual) {
            // Critical hit - golden
            fillColor = this.glowColor;
            strokeColor = '#ffaa00';
            lineWidth = 3;
            drawSize = 6;
        } else if (this.hasShieldBreaker) {
            // Shield breaker - cyan/blue
            fillColor = '#00ffff';
            strokeColor = '#0088ff';
            lineWidth = 3;
            drawSize = 5;
        }
        
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        
        // Draw projectile body
        ctx.beginPath();
        ctx.arc(this.x, this.y, drawSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // DEX tracer — extended glowing trail behind the projectile (ring buffer)
        if (this.tracerLevel > 0 && this._trailCount >= 2) {
            const tracerLen = 3 + this.tracerLevel * 0.4;
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 1.5;
            const steps = Math.min(this._trailCount, Math.ceil(tracerLen));
            for (let i = 0; i < steps - 1; i++) {
                const idx0 = (this._trailHead + i) % this.trailLength;
                const idx1 = (this._trailHead + i + 1) % this.trailLength;
                const t = 1 - i / steps;
                ctx.globalAlpha = t * 0.6;
                ctx.beginPath();
                ctx.moveTo(this.trail[idx0].x, this.trail[idx0].y);
                ctx.lineTo(this.trail[idx1].x, this.trail[idx1].y);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
    }
    
    /**
     * Factory method for creating standard projectiles.
     * 
     * @static
     * @param {number} x - Initial X position
     * @param {number} y - Initial Y position
     * @param {number} angle - Launch angle in radians
     * @param {number} damage - Base damage value
     * @param {number} [speedMod=1] - Speed modifier
     * @returns {Projectile} A new standard projectile instance
     * @example
     * const bullet = Projectile.createStandard(100, 100, 0, 25, 1.2);
     */
    static createStandard(x, y, angle, damage, speedMod = 1) {
        return new Projectile(x, y, angle, damage, speedMod);
    }
    
    /**
     * Factory method for creating piercing projectiles.
     * These projectiles can pass through multiple enemies.
     * 
     * @static
     * @param {number} x - Initial X position
     * @param {number} y - Initial Y position
     * @param {number} angle - Launch angle in radians
     * @param {number} damage - Base damage value
     * @param {number} [speedMod=1] - Speed modifier
     * @returns {Projectile} A new piercing projectile instance
     * @example
     * const piercingBullet = Projectile.createPiercing(100, 100, Math.PI/2, 30);
     */
    static createPiercing(x, y, angle, damage, speedMod = 1) {
        const projectile = new Projectile(x, y, angle, damage, speedMod);
        projectile.piercing = true;
        projectile.piercingCount = 2;      // Can pierce through 2 enemies
        projectile.color = '#0ff';         // Cyan color for piercing bullets
        projectile.glowColor = '#0ff';
        return projectile;
    }
    
    /**
     * Factory method for creating explosive projectiles.
     * These projectiles explode on impact, dealing area damage.
     * 
     * @static
     * @param {number} x - Initial X position
     * @param {number} y - Initial Y position
     * @param {number} angle - Launch angle in radians
     * @param {number} damage - Base damage value (explosion does 50% of this)
     * @param {number} [speedMod=1] - Speed modifier
     * @returns {Projectile} A new explosive projectile instance
     * @example
     * const explosive = Projectile.createExplosive(100, 100, Math.PI/4, 40);
     */
    static createExplosive(x, y, angle, damage, speedMod = 1) {
        const projectile = new Projectile(x, y, angle, damage, speedMod);
        projectile.explosive = true;
        projectile.explosionRadius = 50;           // 50 pixel explosion radius
        projectile.explosionDamage = damage * 0.5; // 50% of direct damage for area effect
        projectile.color = '#f80';                 // Orange color for explosive bullets
        projectile.glowColor = '#f80';
        return projectile;
    }
}