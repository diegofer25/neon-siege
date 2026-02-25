import { MathUtils } from './utils/MathUtils.js';

/**
 * Represents an enemy unit in the tower defense game.
 * Enemies move toward the player, can take damage, and have visual effects.
 * Supports different enemy types with varying stats and behaviors.
 */
export class Enemy {
    static nextId = 0;
    /**
     * Creates a new Enemy instance.
     * @param {number} x - Initial X coordinate
     * @param {number} y - Initial Y coordinate  
     * @param {number} speed - Movement speed in pixels per second
     * @param {number} health - Maximum health points
     * @param {number} damage - Damage dealt to player on contact
     */
    constructor(x, y, speed, health, damage) {
        this.id = Enemy.nextId++;
        // Position properties
        this.x = x;
        this.y = y;
        
        // Combat properties
        this.speed = speed;
        this.health = health;
        this.maxHealth = health;
        this.damage = damage;
        this.baseRadius = 20; // Collision radius baseline in pixels
        this.radius = this.baseRadius;
        
        // Velocity tracking for predictive targeting
        this.vx = 0; // Velocity X component in pixels per second
        this.vy = 0; // Velocity Y component in pixels per second
        this.prevX = x; // Previous X position for velocity calculation
        this.prevY = y; // Previous Y position for velocity calculation
        
        // Visual properties
        this.color = '#0ff'; // Main body color (cyan)
        this.glowColor = '#0ff'; // Glow effect color
        this.flashTimer = 0; // Timer for hit flash effect in milliseconds
        
        // Status effects
        this.slowFactor = 1; // Movement speed multiplier (1 = normal, <1 = slowed)
        this._empSlowTimer = 0; // Remaining EMP slow duration (ms)
        this.isBurning = false; // Whether enemy is currently affected by burn
        
        // Death animation properties
        this.dying = false; // Whether enemy is in death animation
        this.deathTimer = 0; // Timer for death animation in milliseconds
        
        // Enemy type identification
        this.isBoss = false; // Whether this enemy is a boss type
        this.isSplitter = false; // Whether this enemy is a splitter type

        /** @type {import('./Game.js').Game | null} */
        this.game = null;
    }
    
    /**
     * Updates the enemy's position, status effects, and handles player collision.
     * @param {number} delta - Time elapsed since last update in milliseconds
     * @param {Object} player - Player object with x, y, and radius properties
     */
    update(delta, player, game = null) {
        // Handle death animation
        if (this.dying) {
            this.deathTimer += delta;
            // Mark for removal after death animation completes (500ms instead of 200ms)
            if (this.deathTimer >= 500) {
                this.health = -1; // Force negative health to trigger removal
            }
            return;
        }
        
        // Update flash timer for hit effect
        if (this.flashTimer > 0) {
            this.flashTimer -= delta;
        }
        
        // Find direction vector towards player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = MathUtils.distance(this.x, this.y, player.x, player.y);
        
        // Move towards player using normalized direction vector
        if (distance > 0) {
            const normalizedDx = dx / distance;
            const normalizedDy = dy / distance;
            
            const speedMultiplier = (game && game.modifierState && game.modifierState.enemySpeedMultiplier) ? game.modifierState.enemySpeedMultiplier : 1;
            // Apply global enemy slow from ascension Bullet Time plugin
            const globalSlow = (game && game.player && game.player.globalEnemySlow) ? (1 - game.player.globalEnemySlow) : 1;
            const arenaScale = game?.getArenaScale?.() || 1;

            // Convert speed from pixels per second to pixels per frame
            const actualSpeed = this.speed * arenaScale * speedMultiplier * globalSlow * this.slowFactor * (delta / 1000);
            
            // Store previous position for velocity calculation
            this.prevX = this.x;
            this.prevY = this.y;
            
            // Update position
            this.x += normalizedDx * actualSpeed;
            this.y += normalizedDy * actualSpeed;
            
            // Calculate velocity in pixels per second for predictive targeting
            const deltaSeconds = delta / 1000;
            this.vx = (this.x - this.prevX) / deltaSeconds;
            this.vy = (this.y - this.prevY) / deltaSeconds;
        } else {
            // Enemy is very close or at player position - zero velocity
            this.vx = 0;
            this.vy = 0;
        }
        
        // Reset slow factor each frame (reapplied by slow towers if in range),
        // unless an EMP timed slow is active
        if (this._empSlowTimer > 0) {
            this._empSlowTimer -= delta;
            if (this._empSlowTimer <= 0) {
                this._empSlowTimer = 0;
                this.slowFactor = 1;
            }
            // slowFactor stays as set by EMP Pulse
        } else {
            this.slowFactor = 1;
        }
        
        // Player collision is handled centrally by CollisionSystem
    }
    
    /**
     * Applies damage to the enemy and triggers visual feedback.
     * @param {number} amount - Amount of damage to deal
     * @param {unknown} [source] - Optional damage source metadata
     */
    takeDamage(amount, source = null) {
        const damageTakenMultiplier = this.game?.getEnemyDamageTakenMultiplier?.() || 1;
        const healthBefore = this.health;
        const appliedDamage = amount * damageTakenMultiplier;
        this.health -= appliedDamage;
        this.game?.trace?.('enemy.damage', {
            enemyId: this.id,
            amount,
            sourceType: source?.constructor?.name || typeof source,
            damageTakenMultiplier,
            appliedDamage,
            healthBefore,
            healthAfter: this.health
        });
        
        // Trigger white flash effect when hit
        this.flashTimer = 100; // Flash duration in milliseconds
        
        // Start death animation if health depleted
        if (this.health <= 0) {
            this.dying = true;
            this.deathTimer = 0;
            this.game?.trace?.('enemy.state.dying', {
                enemyId: this.id,
                health: this.health
            });
        }
    }
    
    /**
     * Renders the enemy with glow effects, health bar, and status indicators.
     * @param {CanvasRenderingContext2D} ctx - 2D rendering context
     */
    draw(ctx) {
        // Calculate visual intensity based on current health
        const healthPercent = this.health / this.maxHealth;
        const intensity = 0.5 + (healthPercent * 0.5);
        
        // Flash effect when hit
        let drawColor = this.color;
        if (this.flashTimer > 0) {
            drawColor = '#fff';
        }
        
        // Fake glow: semi-transparent circle behind enemy body (replaces expensive shadowBlur)
        ctx.save();
        ctx.fillStyle = this.glowColor;
        ctx.globalAlpha = 0.25 * intensity;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // Draw enemy body
        if (this.dying) {
            // Death animation - scale down and fade
            const deathProgress = Math.min(this.deathTimer / 200, 1);
            const scale = 1 - deathProgress;
            const alpha = 1 - deathProgress;
            
            ctx.globalAlpha = alpha;
            ctx.translate(this.x, this.y);
            ctx.scale(scale, scale);
            ctx.translate(-this.x, -this.y);
        }
        
        // Draw main body (hexagon for variety)
        ctx.fillStyle = drawColor;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        const sides = 6;
        for (let i = 0; i < sides; i++) {
            const angle = (Math.PI * 2 / sides) * i;
            const x = this.x + Math.cos(angle) * this.radius;
            const y = this.y + Math.sin(angle) * this.radius;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Draw health indicator
        if (healthPercent < 1 && !this.dying) {
            const barWidth = this.radius * 2;
            const barHeight = 4;
            const barY = this.y - this.radius - 10;
            
            // Background
            ctx.fillStyle = '#333';
            ctx.fillRect(this.x - barWidth/2, barY, barWidth, barHeight);
            
            // Health bar
            ctx.fillStyle = healthPercent > 0.5 ? '#0f0' : '#f80';
            ctx.fillRect(this.x - barWidth/2, barY, barWidth * healthPercent, barHeight);
        }
        
        // Draw slow effect if slowed
        if (this.slowFactor < 1 && !this.dying) {
            ctx.strokeStyle = '#8f00ff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5;
            
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    /**
     * Sets the game reference for this enemy (used by splitter enemies).
     * @param {import('./Game.js').Game} game - Game instance
     */
    setGameReference(game) {
        this.game = game;
        this.applyResponsiveScale(game?.getEntityScale?.() || 1);
    }

    /**
     * Sets enemy base radius and reapplies responsive scaling.
     * @param {number} radius
     */
    setBaseRadius(radius) {
        this.baseRadius = radius;
        this.applyResponsiveScale(this.game?.getEntityScale?.() || 1);
    }

    /**
     * Applies responsive radius scaling based on arena size.
     * @param {number} scale
     */
    applyResponsiveScale(scale = 1) {
        this.radius = this.baseRadius * scale;
    }
    
}

