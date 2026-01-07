import { playSFX } from "./../main.js";

/**
 * Manages all game entities including players, enemies, and projectiles.
 * Handles entity updates, lifecycle management, and cleanup.
 */
export class EntityManager {
    /**
     * Creates a new entity manager instance.
     * @param {import('./../Game.js').Game} game - Reference to the main game instance
     */
    constructor(game) {
        this.game = game;
    }

    /**
     * Update all entities in the game.
     * @param {number} delta - Time elapsed since last frame
     * @param {Object} input - Current input state
     */
    updateAll(delta, input) {
        // Skip all entity updates if game is not in playing state
        if (this.game.gameState !== 'playing') return;
        
        this._updatePlayer(delta, input);
        this._updateEnemies(delta);
        this._updateProjectiles(delta);
    }

    /**
     * Handle enemy death and rewards.
     * @param {import('./../Enemy.js').Enemy} enemy - The enemy that died
     * @param {number} index - Index of enemy in array
     */
    onEnemyDeath(enemy, index) {
        // Skip enemy death processing if game is not playing
        if (this.game.gameState !== 'playing') return;
        
        // Create visual explosion effect
        this.game.effectsManager.createExplosion(enemy.x, enemy.y, 10);
        
        // Apply life steal if player has this upgrade
        if (this.game.player.hasLifeSteal) {
            this.game.player.onEnemyKill(enemy);
        }
        
        // Calculate and award coin reward
        const coinReward = this._calculateCoinReward();
        this.game.player.addCoins(coinReward);
        
        // Remove enemy and update counters
        this.game.enemies.splice(index, 1);
        this.game.waveManager.onEnemyKilled();
        this.game.score += 10;
        
        // Audio feedback
        playSFX('explode');
    }

    /**
     * Clean up off-screen projectiles.
     */
    cleanupProjectiles() {
        // Skip cleanup if game is not playing
        if (this.game.gameState !== 'playing') return;

        for (let i = this.game.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.game.projectiles[i];
            if (projectile.isOffScreen(this.game.canvas)) {
                this.game.projectiles.splice(i, 1);
                if (projectile._fromPool) {
                    this.game.projectilePool.release(projectile);
                }
            }
        }
    }

    /**
     * Update player entity.
     * @private
     * @param {number} delta - Time elapsed since last frame
     * @param {Object} input - Current input state
     */
    _updatePlayer(delta, input) {
        this.game.player.update(delta, input, this.game);
    }

    /**
     * Update all enemy entities.
     * @private
     * @param {number} delta - Time elapsed since last frame
     */
    _updateEnemies(delta) {
        for (let index = this.game.enemies.length - 1; index >= 0; index--) {
            const enemy = this.game.enemies[index];
            enemy.update(delta, this.game.player, this.game);

            if (enemy.health <= 0) {
                this.onEnemyDeath(enemy, index);
            }
        }
    }

    /**
     * Update all projectile entities.
     * @private
     * @param {number} delta - Time elapsed since last frame
     */
    _updateProjectiles(delta) {
        for (let index = this.game.projectiles.length - 1; index >= 0; index--) {
            const projectile = this.game.projectiles[index];
            projectile.update(delta);

            if (projectile.isOffScreen(this.game.canvas)) {
                this.game.projectiles.splice(index, 1);
                if (projectile._fromPool) {
                    this.game.projectilePool.release(projectile);
                }
            }
        }
    }

    /**
     * Calculate coin reward for enemy kills.
     * @private
     * @returns {number} Coin reward amount
     */
    _calculateCoinReward() {
        const baseReward = 1;
        const waveBonus = this.game.wave * 0.2;
        const baseAmount = Math.ceil((baseReward + waveBonus) / 2); // Reduced by half for balance
        
        // Apply coin magnet multiplier
        return Math.ceil(baseAmount * this.game.player.coinMagnetMultiplier);
    }
}
