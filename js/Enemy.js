import { GameConfig } from "./config/GameConfig.js";
import { playSFX } from './main.js';
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
        
        // Set glow effect
        ctx.save();
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 10 * intensity;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
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
    
    /**
     * Creates a standard enemy with balanced stats.
     * @param {number} x - Spawn X coordinate
     * @param {number} y - Spawn Y coordinate
     * @param {number} waveScale - Difficulty scaling factor (default: 1)
     * @returns {Enemy} New basic enemy instance
     */
    static createBasicEnemy(x, y, waveScale = 1) {
        const baseHealth = GameConfig.ENEMY.BASE_HEALTH;
        const baseSpeed = GameConfig.ENEMY.BASE_SPEED;
        const baseDamage = GameConfig.ENEMY.BASE_DAMAGE;
        
        return new Enemy(
            x, y,
            baseSpeed * waveScale,
            baseHealth * waveScale,
            baseDamage * waveScale
        );
    }
    
    /**
     * Creates a fast, low-health enemy that moves quickly.
     * @param {number} x - Spawn X coordinate
     * @param {number} y - Spawn Y coordinate
     * @param {number} waveScale - Difficulty scaling factor (default: 1)
     * @returns {Enemy} New fast enemy instance with magenta coloring
     */
    static createFastEnemy(x, y, waveScale = 1) {
        const baseHealth = GameConfig.ENEMY.BASE_HEALTH * GameConfig.ENEMY.VARIANTS.FAST.health;
        const baseSpeed = GameConfig.ENEMY.BASE_SPEED * GameConfig.ENEMY.VARIANTS.FAST.speed;
        const baseDamage = GameConfig.ENEMY.BASE_DAMAGE * GameConfig.ENEMY.VARIANTS.FAST.damage;
        
        const enemy = new Enemy(
            x, y,
            baseSpeed * waveScale,
            baseHealth * waveScale,
            baseDamage * waveScale
        );
        
        // Visual differentiation
        enemy.color = '#f0f'; // Magenta
        enemy.glowColor = '#f0f';
        enemy.setBaseRadius(15); // Smaller collision radius
        
        return enemy;
    }
    
    /**
     * Creates a slow, high-health tank enemy.
     * @param {number} x - Spawn X coordinate
     * @param {number} y - Spawn Y coordinate
     * @param {number} waveScale - Difficulty scaling factor (default: 1)
     * @returns {Enemy} New tank enemy instance with yellow coloring
     */
    static createTankEnemy(x, y, waveScale = 1) {
        const baseHealth = GameConfig.ENEMY.BASE_HEALTH * GameConfig.ENEMY.VARIANTS.TANK.health;
        const baseSpeed = GameConfig.ENEMY.BASE_SPEED * GameConfig.ENEMY.VARIANTS.TANK.speed;
        const baseDamage = GameConfig.ENEMY.BASE_DAMAGE * GameConfig.ENEMY.VARIANTS.TANK.damage;
        
        const enemy = new Enemy(
            x, y,
            baseSpeed * waveScale,
            baseHealth * waveScale,
            baseDamage * waveScale
        );
        
        // Visual differentiation
        enemy.color = '#ff0'; // Yellow
        enemy.glowColor = '#ff0';
        enemy.setBaseRadius(25); // Larger collision radius
        
        return enemy;
    }
    
    /**
     * Creates a splitter enemy that splits into smaller enemies on death.
     * @param {number} x - Spawn X coordinate
     * @param {number} y - Spawn Y coordinate
     * @param {number} waveScale - Difficulty scaling factor (default: 1)
     * @returns {SplitterEnemy} New splitter enemy instance with orange coloring
     */
    static createSplitterEnemy(x, y, waveScale = 1) {
        const baseHealth = GameConfig.ENEMY.BASE_HEALTH * GameConfig.ENEMY.VARIANTS.SPLITTER.health;
        const baseSpeed = GameConfig.ENEMY.BASE_SPEED * GameConfig.ENEMY.VARIANTS.SPLITTER.speed;
        const baseDamage = GameConfig.ENEMY.BASE_DAMAGE * GameConfig.ENEMY.VARIANTS.SPLITTER.damage;
        
        const enemy = new SplitterEnemy(
            x, y,
            baseSpeed * waveScale,
            baseHealth * waveScale,
            baseDamage * waveScale
        );
        
        return enemy;
    }
}

/**
 * Splitter enemy variant that splits into smaller enemies when destroyed.
 * Provides a unique tactical challenge by potentially increasing enemy count.
 */
export class SplitterEnemy extends Enemy {
    constructor(x, y, speed, health, damage, generation = 1) {
        super(x, y, speed, health, damage);
        
        // Splitter-specific properties
        this.generation = generation; // Track split generation (1 = original, 2 = first split, etc.)
        this.maxGeneration = 3; // Maximum split generations
        this.splitCount = generation === 1 ? 3 : 2; // Number of splits (fewer for higher generations)
        this.isSplitter = true;
        
        // Visual differentiation based on generation
        this.updateVisuals();
        
        // Reference to game for spawning splits
        this.game = null;
    }
    
    /**
     * Update visual appearance based on generation.
     */
    updateVisuals() {
        switch (this.generation) {
            case 1:
                // Original splitter - orange
                this.color = '#ff8000';
                this.glowColor = '#ff8000';
                this.setBaseRadius(22);
                break;
            case 2:
                // First split - red-orange
                this.color = '#ff4000';
                this.glowColor = '#ff4000';
                this.setBaseRadius(18);
                break;
            case 3:
                // Second split - red
                this.color = '#ff2000';
                this.glowColor = '#ff2000';
                this.setBaseRadius(15);
                break;
        }
    }
    
    /**
     * Override takeDamage to handle splitting on death.
     * @param {number} amount - Amount of damage to deal
     * @param {unknown} [source] - Optional damage source metadata
     */
    takeDamage(amount, source = null) {
        void source;
        const damageTakenMultiplier = this.game?.getEnemyDamageTakenMultiplier?.() || 1;
        this.health -= amount * damageTakenMultiplier;
        
        // Trigger white flash effect when hit
        this.flashTimer = 100;
        
        // Handle splitting when killed
        if (this.health <= 0 && !this.dying) {
            this.triggerSplit();
            this.dying = true;
            this.deathTimer = 0;
        }
    }
    
    /**
     * Create smaller splitter enemies when this one dies.
     */
    triggerSplit() {
        // Only split if under max generation and game reference exists
        if (this.generation >= this.maxGeneration || !this.game) {
            return;
        }

        playSFX('enemy_split');
        
        // Create explosion effect
        if (this.game.createExplosion) {
            this.game.createExplosion(this.x, this.y, 8);
        }
        
        // Spawn smaller splitters
        for (let i = 0; i < this.splitCount; i++) {
            const angle = (Math.PI * 2 / this.splitCount) * i + Math.random() * 0.5;
            const distance = 30 + Math.random() * 20;
            
            const splitX = this.x + Math.cos(angle) * distance;
            const splitY = this.y + Math.sin(angle) * distance;
            
            // Create smaller splitter with reduced stats
            const splitHealth = this.maxHealth * 0.6;
            const splitSpeed = this.speed * 1.2; // Slightly faster
            const splitDamage = this.damage * 0.7;
            
            const splitEnemy = new SplitterEnemy(
                splitX,
                splitY,
                splitSpeed,
                splitHealth,
                splitDamage,
                this.generation + 1
            );
            
            // Set game reference for potential future splits
            splitEnemy.setGameReference(this.game);
            
            // Add slight random velocity to spread out
            const spreadVelocity = 50;
            splitEnemy.x += (Math.random() - 0.5) * spreadVelocity;
            splitEnemy.y += (Math.random() - 0.5) * spreadVelocity;
            
            // Add to game enemies array
            if (this.game && this.game.enemies) {
                this.game.enemies.push(splitEnemy);
            }
        }
    }
    
    /**
     * Set game reference for splitting mechanics.
     * @param {import('./Game.js').Game} game - Game instance
     */
    setGameReference(game) {
        super.setGameReference(game);
    }
    
    /**
     * Override draw method to show generation indicators.
     * @param {CanvasRenderingContext2D} ctx - 2D rendering context
     */
    draw(ctx) {
        // Call parent draw method
        super.draw(ctx);
        
        // Add generation indicators for non-dying splitters
        if (!this.dying && this.generation > 1) {
            ctx.save();
            
            // Draw generation indicator dots
            ctx.fillStyle = '#fff';
            ctx.shadowColor = this.glowColor;
            ctx.shadowBlur = 5;
            
            const dotCount = this.generation - 1;
            const dotRadius = 2;
            const dotSpacing = 6;
            const startX = this.x - ((dotCount - 1) * dotSpacing) / 2;
            const dotY = this.y - this.radius - 20;
            
            for (let i = 0; i < dotCount; i++) {
                ctx.beginPath();
                ctx.arc(startX + i * dotSpacing, dotY, dotRadius, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.restore();
        }
        
        // Add pulsating effect for original splitters
        if (this.generation === 1 && !this.dying) {
            ctx.save();
            
            const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
            ctx.globalAlpha = pulse * 0.2;
            ctx.strokeStyle = this.glowColor;
            ctx.lineWidth = 3;
            
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.restore();
        }
    }
}
