import { Enemy } from '../Enemy.js';
import { playSFX } from '../main.js';

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
     * @param {import('../Game.js').Game} game - Game instance
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
