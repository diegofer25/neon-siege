import { MathUtils } from '../utils/MathUtils.js';
import { GameConfig } from '../config/GameConfig.js';
import { createFloatingText, playSFX, screenFlash } from './../main.js';

/**
 * Handles all collision detection and resolution in the game.
 * Provides optimized collision algorithms and manages collision responses.
 */
export class CollisionSystem {
    /**
     * Creates a new collision system instance.
     * @param {import('./../Game.js').Game} game - Reference to the main game instance
     */
    constructor(game) {
        this.game = game;
    }

    /**
     * Check all collision types and handle responses.
     */
    checkAllCollisions() {
        this._checkProjectileEnemyCollisions();
        this._checkPlayerEnemyCollisions();
        this._checkEnemyProjectilePlayerCollisions();
    }

    _removeProjectileAt(index) {
        const projectile = this.game.projectiles[index];
        if (!projectile) return;

        this.game.projectiles.splice(index, 1);
        if (projectile._fromPool) {
            this.game.projectilePool.release(projectile);
        }
    }

    /**
     * Handle projectile vs enemy collisions with piercing and explosive logic.
     * @private
     */
    _checkProjectileEnemyCollisions() {
        for (let pIndex = this.game.projectiles.length - 1; pIndex >= 0; pIndex--) {
            const projectile = this.game.projectiles[pIndex];
            if (!projectile || projectile.isEnemyProjectile) continue;

            for (let eIndex = this.game.enemies.length - 1; eIndex >= 0; eIndex--) {
                const enemy = this.game.enemies[eIndex];
                if (!enemy) continue;
                if (enemy.dying || enemy.health <= 0) continue;

                if (MathUtils.circleCollision(projectile, enemy)) {
                    const projectileRemoved = this._handleProjectileHit(projectile, enemy, pIndex);
                    if (projectileRemoved) {
                        break;
                    }
                }
            }
        }
    }

    /**
     * Handle player vs enemy collisions.
     * @private
     */
    _checkPlayerEnemyCollisions() {
        for (let index = this.game.enemies.length - 1; index >= 0; index--) {
            const enemy = this.game.enemies[index];
            if (!enemy) continue;
            if (MathUtils.circleCollision(enemy, this.game.player)) {
                this._handlePlayerHit(enemy, index);
            }
        }
    }

    /**
     * Process projectile hitting an enemy.
     * @private
     * @param {import('./../Projectile.js').Projectile} projectile - The projectile that hit
     * @param {import('./../Enemy.js').Enemy} enemy - The enemy that was hit
     * @param {number} projectileIndex - Index of projectile in array
     */
    _handleProjectileHit(projectile, enemy, projectileIndex) {
        if (enemy.dying || enemy.health <= 0) {
            this.game.trace('hit.ignored.deadEnemy', {
                enemyId: enemy.id,
                enemyHealth: enemy.health,
                enemyDying: enemy.dying,
                projectileIndex
            });
            return;
        }

        // If projectile has already hit this enemy, ignore
        if (projectile.hitEnemyIds.includes(enemy.id)) {
            this.game.trace('hit.ignored.alreadyHitEnemy', {
                enemyId: enemy.id,
                projectileIndex,
                hitEnemyIdsCount: projectile.hitEnemyIds.length
            });
            return;
        }

        // Calculate damage based on piercing mechanics
        const currentDamage = projectile.getCurrentDamage();
        const enemyHealthBefore = enemy.health;
        this.game.trace('hit.enemy', {
            enemyId: enemy.id,
            projectileIndex,
            projectilePiercing: projectile.piercing,
            projectileExplosive: projectile.explosive,
            damage: currentDamage,
            enemyHealthBefore
        });
        
        // Damage enemy - pass projectile for special effects
        enemy.takeDamage(currentDamage, projectile);
        projectile.hitEnemyIds.push(enemy.id); // Record hit
        this.game.trace('hit.enemy.applied', {
            enemyId: enemy.id,
            projectileIndex,
            enemyHealthAfter: enemy.health,
            enemyDying: enemy.dying
        });
        
        // Increment enemies hit count for piercing damage reduction
        projectile.enemiesHit++;
        
        // Create visual effects
        this.game.effectsManager.createHitEffect(enemy.x, enemy.y);
        this._showDamageText(enemy, currentDamage);
        
        // Handle explosive projectiles
        if (projectile.explosive) {
            projectile.explode(this.game, enemy.id);
            playSFX('impact_explosion_small');
        } else if (projectile.piercing) {
            playSFX('impact_pierce');
        } else {
            playSFX('impact_enemy_hit');
        }

        // Meltdown: hitting a burning enemy triggers a bonus explosion
        const meltdown = this.game.player?.meltdown;
        if (meltdown && enemy.isBurning && Math.random() < meltdown.chance) {
            const meltdownDmg = currentDamage * meltdown.damageRatio;
            // Deal AoE damage around the burning enemy
            for (const e of this.game.enemies) {
                if (e === enemy || e.dying || e.health <= 0) continue;
                const ddx = e.x - enemy.x;
                const ddy = e.y - enemy.y;
                if (ddx * ddx + ddy * ddy <= meltdown.radius * meltdown.radius) {
                    e.takeDamage(meltdownDmg * (1 - Math.sqrt(ddx * ddx + ddy * ddy) / meltdown.radius));
                }
            }
            this.game.createExplosion(enemy.x, enemy.y, 6);
            this.game.createExplosionRing(enemy.x, enemy.y, meltdown.radius);
        }

        // Volatile Kills: enemy death explosion
        if (enemy.health <= 0 && !enemy.dying) {
            const volatileKills = this.game.player?.volatileKills;
            if (volatileKills) {
                const deathDmg = enemy.maxHealth * volatileKills.percent;
                for (const e of this.game.enemies) {
                    if (e === enemy || e.dying || e.health <= 0) continue;
                    const ddx = e.x - enemy.x;
                    const ddy = e.y - enemy.y;
                    if (ddx * ddx + ddy * ddy <= volatileKills.radius * volatileKills.radius) {
                        e.takeDamage(deathDmg);
                    }
                }
                this.game.createExplosion(enemy.x, enemy.y, 10);
                this.game.createExplosionRing(enemy.x, enemy.y, volatileKills.radius);
            }
        }

        // Non-piercing projectiles are consumed on first hit
        if (!projectile.piercing) {
            this._removeProjectileAt(projectileIndex);
            return true;
        }

        // Piercing projectiles are consumed once their hit budget is exhausted
        if (projectile.enemiesHit > projectile.piercingCount) {
            this._removeProjectileAt(projectileIndex);
            return true;
        }

        return false;
    }

    /**
     * Process player being hit by an enemy.
     * @private
     * @param {import('./../Enemy.js').Enemy} enemy - The enemy that hit the player
     * @param {number} enemyIndex - Index of enemy in array
     */
    _handlePlayerHit(enemy, enemyIndex) {
        const shieldBeforeHit = this.game.player.shieldHp;

        // Damage player
        this.game.player.takeDamage(enemy.damage);
        
        // Visual and audio feedback
        this.game.effectsManager.addScreenShake(
            GameConfig.VFX.SCREEN_SHAKE.PLAYER_HIT_INTENSITY,
            GameConfig.VFX.SCREEN_SHAKE.PLAYER_HIT_DURATION
        );
        
        screenFlash();
        if (shieldBeforeHit > 0) {
            playSFX(this.game.player.shieldHp <= 0 ? 'player_shield_break' : 'player_shield_hit');
        } else {
            playSFX('player_hurt');
        }
        
        // Show damage text
        this._showPlayerDamageText(enemy.damage);
        
        // Remove enemy after collision
        this.game.trace('enemy.removed.playerCollision', {
            enemyId: enemy.id,
            enemyIndex,
            enemyDamage: enemy.damage,
            enemiesBefore: this.game.enemies.length
        });
        this.game.enemies.splice(enemyIndex, 1);
    }

    /**
     * Display floating damage text for enemy hits.
     * @private
     * @param {import('./../Enemy.js').Enemy} enemy - The enemy that took damage
     * @param {number} damage - Amount of damage dealt
     */
    _showDamageText(enemy, damage) {
        const rect = this.game.canvas.getBoundingClientRect();
        const canvasWidth = this.game.canvas.logicalWidth || this.game.canvas.width;
        const canvasHeight = this.game.canvas.logicalHeight || this.game.canvas.height;
       createFloatingText(
            `-${damage.toFixed(1)}`,
            enemy.x * (rect.width / canvasWidth) + rect.left,
            enemy.y * (rect.height / canvasHeight) + rect.top,
            'damage'
        );
    }

    /**
     * Display floating damage text for player hits.
     * @private
     * @param {number} damage - Amount of damage taken
     */
    _showPlayerDamageText(damage) {
        const rect = this.game.canvas.getBoundingClientRect();
        const canvasWidth = this.game.canvas.logicalWidth || this.game.canvas.width;
        const canvasHeight = this.game.canvas.logicalHeight || this.game.canvas.height;
        createFloatingText(
            `-${damage.toFixed(1)}`,
            this.game.player.x * (rect.width / canvasWidth) + rect.left,
            this.game.player.y * (rect.height / canvasHeight) + rect.top,
            'player-damage'
        );
    }
    
    /**
     * Handle enemy projectiles vs player collisions.
     * @private
     */
    _checkEnemyProjectilePlayerCollisions() {
        for (let pIndex = this.game.projectiles.length - 1; pIndex >= 0; pIndex--) {
            const projectile = this.game.projectiles[pIndex];
            if (!projectile || !projectile.isEnemyProjectile) continue;

            if (MathUtils.circleCollision(projectile, this.game.player)) {
                this._handleEnemyProjectileHit(projectile, pIndex);
            }
        }
    }
    
    /**
     * Process enemy projectile hitting the player.
     * @private
     * @param {import('./../Projectile.js').Projectile} projectile - The projectile that hit
     * @param {number} projectileIndex - Index of projectile in array
     */
    _handleEnemyProjectileHit(projectile, projectileIndex) {
        const shieldBeforeHit = this.game.player.shieldHp;

        // Damage player
        this.game.player.takeDamage(projectile.damage, 'enemyProjectile');
        
        // Visual and audio feedback
        this.game.effectsManager.addScreenShake(8, 200);
        screenFlash();
        if (shieldBeforeHit > 0) {
            playSFX(this.game.player.shieldHp <= 0 ? 'player_shield_break' : 'player_shield_hit');
        } else {
            playSFX('player_hurt');
        }
        
        // Show damage text
        this._showPlayerDamageText(projectile.damage);
        
        // Create hit effect
        this.game.effectsManager.createHitEffect(this.game.player.x, this.game.player.y);
        
        // Remove projectile
        this._removeProjectileAt(projectileIndex);
    }
}
