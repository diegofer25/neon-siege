import { Boss } from '../Boss.js';
import { GameConfig } from '../config/GameConfig.js';
import { ShieldBoss } from './ShieldBoss.js';
import { TeleporterBoss } from './TeleporterBoss.js';
import { SplitterBoss } from './SplitterBoss.js';
import { VortexBoss } from './VortexBoss.js';
import { ChronoBoss } from './ChronoBoss.js';

/**
 * Factory function to create the appropriate boss for the current wave.
 * Progressively unlocks boss types as waves advance.
 *
 * @param {import('../Game.js').Game} game
 * @returns {Boss}
 */
export function createBoss(game) {
    const wave = game.wave;
    const difficultyPreset = game.waveManager?.difficultyPreset || GameConfig.DIFFICULTY_PRESETS.normal;
    const healthMultiplier = difficultyPreset.enemyHealthMultiplier || 1;
    const speedMultiplier = difficultyPreset.enemySpeedMultiplier || 1;
    const damageMultiplier = difficultyPreset.enemyDamageMultiplier || 1;
    const health = GameConfig.BOSS.BASE_HEALTH * (1 + (wave / 10) * 0.5) * healthMultiplier;
    const damage = GameConfig.BOSS.BASE_DAMAGE * (1 + (wave / 10) * 0.2) * damageMultiplier;

    const canvasWidth = game.canvas.logicalWidth || game.canvas.width;
    const canvasHeight = game.canvas.logicalHeight || game.canvas.height;

    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const arenaScale = game.getArenaScale?.() || 1;
    const spawnMargin = GameConfig.ENEMY.SPAWN_MARGIN * arenaScale;
    const spawnRadius = Math.max(canvasWidth, canvasHeight) / 2 + spawnMargin;
    const angle = Math.random() * Math.PI * 2;
    const x = centerX + Math.cos(angle) * spawnRadius;
    const y = centerY + Math.sin(angle) * spawnRadius;

    // Progressive boss pool — unlocked by wave number
    // Wave 30 (MAX_WAVE) always spawns the Chrono final boss
    const maxWave = GameConfig.BOSS.MAX_WAVE;
    let boss;
    if (wave === maxWave) {
        boss = new ChronoBoss(x, y, health, damage, game);
    } else {
        // Build pool of unlocked boss types based on wave progression
        const pool = [Boss]; // Classic always available
        if (wave >= 10) pool.push(TeleporterBoss);
        if (wave >= 15) pool.push(SplitterBoss);
        if (wave >= 20) pool.push(ShieldBoss);
        if (wave >= 25) pool.push(VortexBoss);
        // In endless mode (wave > maxWave), all bosses including Chrono
        if (wave > maxWave) pool.push(ChronoBoss);

        const BossClass = pool[Math.floor(Math.random() * pool.length)];
        boss = new BossClass(x, y, health, damage, game);
    }

    boss.speed *= speedMultiplier;
    return boss;
}
