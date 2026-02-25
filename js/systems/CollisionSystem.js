import { MathUtils } from '../utils/MathUtils.js';
import { GameConfig } from '../config/GameConfig.js';
import { playSFX } from './../main.js';
import { vfxHelper } from './../managers/VFXHelper.js';
import { ActionTypes } from '../state/index.js';
const createFloatingText = vfxHelper.createFloatingText.bind(vfxHelper);
const screenFlash = vfxHelper.screenFlash.bind(vfxHelper);

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
        let currentDamage = projectile.getCurrentDamage();

        // Apply Berserker ascension bonus: +X% damage per 10% HP missing
        const berserker = this.game.player?.berserker;
        if (berserker && berserker.damagePerMissingHpPercent > 0) {
            const hpPct = this.game.player.maxHp > 0 ? this.game.player.hp / this.game.player.maxHp : 1;
            const missingPct = Math.max(0, 1 - hpPct);
            // Each 10% missing = one stack
            const stacks = Math.floor(missingPct * 10);
            currentDamage *= 1 + stacks * berserker.damagePerMissingHpPercent;
        }

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

        // Emit enemy:hit event for skill plugins (MeltdownPlugin, etc.)
        this.game.eventBus.emit('enemy:hit', {
            enemy,
            projectile,
            damage: currentDamage,
        });

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

        // Emit shield:broken event for ascension plugins (ShieldNovaPlugin)
        if (this.game.player._shieldJustBroke) {
            this.game.player._shieldJustBroke = false;
            this.game.eventBus.emit('shield:broken', {
                player: this.game.player,
                maxShieldHp: this.game.player.maxShieldHp,
            });
        }

        // Dispatch to state store
        this.game.dispatcher?.dispatch({
            type: ActionTypes.PLAYER_DAMAGE,
            payload: {
                damage: enemy.damage,
                source: 'enemy',
                currentHp: this.game.player.hp,
                maxHp: this.game.player.maxHp,
            },
        });

        // Emit player:damaged event for skill plugins
        this.game.eventBus.emit('player:damaged', { damage: enemy.damage, source: 'enemy' });
        
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
        const screen = MathUtils.canvasToScreen(this.game.canvas, enemy.x, enemy.y);
        createFloatingText(`-${damage.toFixed(1)}`, screen.x, screen.y, 'damage');
    }

    /**
     * Display floating damage text for player hits.
     * @private
     * @param {number} damage - Amount of damage taken
     */
    _showPlayerDamageText(damage) {
        const screen = MathUtils.canvasToScreen(this.game.canvas, this.game.player.x, this.game.player.y);
        createFloatingText(`-${damage.toFixed(1)}`, screen.x, screen.y, 'player-damage');
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

        // Emit shield:broken event for ascension plugins (ShieldNovaPlugin)
        if (this.game.player._shieldJustBroke) {
            this.game.player._shieldJustBroke = false;
            this.game.eventBus.emit('shield:broken', {
                player: this.game.player,
                maxShieldHp: this.game.player.maxShieldHp,
            });
        }

        // Dispatch to state store
        this.game.dispatcher?.dispatch({
            type: ActionTypes.PLAYER_DAMAGE,
            payload: {
                damage: projectile.damage,
                source: 'enemyProjectile',
                currentHp: this.game.player.hp,
                maxHp: this.game.player.maxHp,
            },
        });

        // Emit player:damaged event for skill plugins
        this.game.eventBus.emit('player:damaged', { damage: projectile.damage, source: 'enemyProjectile' });
        
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
