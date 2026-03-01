import { Enemy } from '../Enemy.js';
import { GameConfig } from '../config/GameConfig.js';
import { SplitterEnemy } from './SplitterEnemy.js';
import { HealerEnemy } from './HealerEnemy.js';

/**
 * Factory functions to create different enemy types with appropriate stats.
 */

/**
 * Creates a standard enemy with balanced stats.
 * @param {number} x - Spawn X coordinate
 * @param {number} y - Spawn Y coordinate
 * @param {number} waveScale - Difficulty scaling factor (default: 1)
 * @returns {Enemy} New basic enemy instance
 */
export function createBasicEnemy(x, y, waveScale = 1) {
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
export function createFastEnemy(x, y, waveScale = 1) {
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
export function createTankEnemy(x, y, waveScale = 1) {
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
export function createSplitterEnemy(x, y, waveScale = 1) {
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

/**
 * Creates a healer enemy that restores nearby allies.
 * @param {number} x - Spawn X coordinate
 * @param {number} y - Spawn Y coordinate
 * @param {number} waveScale - Difficulty scaling factor (default: 1)
 * @returns {HealerEnemy} New healer enemy instance with green coloring
 */
export function createHealerEnemy(x, y, waveScale = 1) {
    const baseHealth = GameConfig.ENEMY.BASE_HEALTH * GameConfig.ENEMY.VARIANTS.HEALER.health;
    const baseSpeed = GameConfig.ENEMY.BASE_SPEED * GameConfig.ENEMY.VARIANTS.HEALER.speed;
    const baseDamage = GameConfig.ENEMY.BASE_DAMAGE * GameConfig.ENEMY.VARIANTS.HEALER.damage;

    return new HealerEnemy(
        x, y,
        baseSpeed * waveScale,
        baseHealth * waveScale,
        baseDamage * waveScale
    );
}
